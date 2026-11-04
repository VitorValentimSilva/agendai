import { ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { decryptSecret, encryptSecret, randomToken } from '../common/crypto.js';
import type { SessionUser } from '../common/decorators.js';
import { AppointmentEvents, type AppointmentEvent } from '../appointments/appointment-events.js';
import type { AppointmentWithRelations } from '../appointments/appointment.mapper.js';
import { buildIcsCalendar, type IcsEvent } from '../appointments/ics.js';
import { GoogleClient } from './google.client.js';
import { googleEventFor } from './google-event.js';

interface GoogleState {
  purpose: 'google-connect';
  pid: string;
  bid: string;
}

@Injectable()
export class CalendarService implements OnModuleInit {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleClient,
    private readonly jwt: JwtService,
    private readonly events: AppointmentEvents,
  ) {}

  onModuleInit(): void {
    this.events.register({ onAppointmentEvent: (event, a) => this.syncGoogle(event, a) });
  }

  /** OWNER mexe em qualquer profissional; PROFESSIONAL só no próprio. */
  async assertCanManage(user: SessionUser, professionalId: string) {
    const pro = await this.prisma.professional.findFirst({ where: { id: professionalId, businessId: user.businessId } });
    if (!pro) throw new NotFoundException('Profissional não encontrado.');
    if (user.role === 'PROFESSIONAL' && user.professionalId !== professionalId) {
      throw new ForbiddenException('Você só pode configurar a sua própria agenda.');
    }
    return pro;
  }

  // ---------------- Feed iCal ----------------

  feedUrl(token: string): string {
    return `${env.publicApiUrl}/calendar/${token}.ics`;
  }

  async enableFeed(user: SessionUser, professionalId: string): Promise<string> {
    await this.assertCanManage(user, professionalId);
    const token = randomToken();
    await this.prisma.professional.update({ where: { id: professionalId }, data: { calendarFeedToken: token } });
    return this.feedUrl(token);
  }

  async disableFeed(user: SessionUser, professionalId: string): Promise<void> {
    await this.assertCanManage(user, professionalId);
    await this.prisma.professional.update({ where: { id: professionalId }, data: { calendarFeedToken: null } });
  }

  async feedUrlFor(user: SessionUser, professionalId: string): Promise<string | null> {
    const pro = await this.assertCanManage(user, professionalId);
    return pro.calendarFeedToken ? this.feedUrl(pro.calendarFeedToken) : null;
  }

  /** Agenda do profissional dos últimos 30 dias aos próximos 90 (sem cancelados). */
  async feed(token: string, now = new Date()): Promise<string> {
    const pro = await this.prisma.professional.findUnique({ where: { calendarFeedToken: token }, include: { business: true } });
    if (!pro) throw new NotFoundException('Agenda não encontrada.');
    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId: pro.id,
        status: { notIn: ['CANCELED'] },
        startsAt: { gte: new Date(now.getTime() - 30 * 86_400_000), lt: new Date(now.getTime() + 90 * 86_400_000) },
      },
      include: { service: true, customer: true },
      orderBy: { startsAt: 'asc' },
      take: 2000,
    });
    const b = pro.business;
    const events: IcsEvent[] = appointments.map((a) => ({
      uid: `${a.id}@agendai.app`,
      start: a.startsAt,
      end: a.endsAt,
      summary: `${a.service.name} — ${a.customer.name}`,
      description: `Cliente: ${a.customer.name}\nWhatsApp: +${a.customer.whatsapp}\nCódigo: ${a.code}`,
      location: `${b.addressLine}, ${b.city} - ${b.state}`,
      status: a.status === 'PENDING_PAYMENT' ? 'TENTATIVE' : 'CONFIRMED',
      now,
    }));
    return buildIcsCalendar(`${pro.name} — ${b.name}`, events, b.timezone);
  }

  // ---------------- Google Calendar ----------------

  async googleConnectUrl(user: SessionUser, professionalId: string): Promise<string> {
    if (!this.google.enabled) throw new ServiceUnavailableException('Integração com o Google não configurada (GOOGLE_CLIENT_ID/SECRET).');
    await this.assertCanManage(user, professionalId);
    const state = await this.jwt.signAsync({ purpose: 'google-connect', pid: professionalId, bid: user.businessId } satisfies GoogleState, {
      expiresIn: 600,
    });
    return this.google.authUrl(state);
  }

  /** Retorno do OAuth: troca o code pelo refresh token e guarda cifrado. */
  async googleCallback(code: string, state: string): Promise<void> {
    let payload: GoogleState;
    try {
      payload = await this.jwt.verifyAsync<GoogleState>(state);
    } catch {
      throw new ForbiddenException('Link de conexão expirado. Tente de novo pelo painel.');
    }
    if (payload.purpose !== 'google-connect') throw new ForbiddenException();
    const pro = await this.prisma.professional.findFirst({ where: { id: payload.pid, businessId: payload.bid } });
    if (!pro) throw new NotFoundException('Profissional não encontrado.');
    const { refreshToken, email } = await this.google.exchangeCode(code);
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { googleRefreshTokenEnc: encryptSecret(refreshToken), googleEmail: email, googleCalendarId: 'primary' },
    });
  }

  async googleDisconnect(user: SessionUser, professionalId: string): Promise<void> {
    const pro = await this.assertCanManage(user, professionalId);
    if (pro.googleRefreshTokenEnc) {
      try {
        await this.google.revoke(decryptSecret(pro.googleRefreshTokenEnc));
      } catch {
        // segue limpando localmente
      }
    }
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { googleRefreshTokenEnc: null, googleEmail: null, googleCalendarId: null },
    });
  }

  /** Mantém o evento no Google do profissional igual ao agendamento. */
  private async syncGoogle(event: AppointmentEvent, a: AppointmentWithRelations): Promise<void> {
    if (!this.google.enabled || event === 'slot-freed') return;
    const pro = await this.prisma.professional.findUnique({ where: { id: a.professionalId }, include: { business: true } });
    if (!pro?.googleRefreshTokenEnc) return;
    const calendarId = pro.googleCalendarId ?? 'primary';
    const accessToken = await this.google.accessToken(decryptSecret(pro.googleRefreshTokenEnc));
    const current = await this.prisma.appointment.findUnique({ where: { id: a.id }, select: { googleEventId: true } });
    const eventId = current?.googleEventId ?? null;

    if (event === 'canceled' || a.status === 'CANCELED') {
      if (eventId) {
        await this.google.deleteEvent(accessToken, calendarId, eventId);
        await this.prisma.appointment.update({ where: { id: a.id }, data: { googleEventId: null } });
      }
      return;
    }
    const id = await this.google.upsertEvent(accessToken, calendarId, eventId, googleEventFor(a, pro.business));
    if (id !== eventId) await this.prisma.appointment.update({ where: { id: a.id }, data: { googleEventId: id } });
  }
}
