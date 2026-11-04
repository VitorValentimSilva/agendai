import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../common/prisma.service.js';
import { CurrentUser, Roles, type SessionUser } from '../common/decorators.js';
import { BusinessService } from '../business/business.service.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { AdminController } from './admin.decorator.js';

export class MessageDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['OUT', 'IN'] }) direction: 'OUT' | 'IN';
  @ApiProperty({ description: 'reminder, waitlist, reply, inbound' }) kind: string;
  @ApiProperty() phone: string;
  @ApiProperty() body: string;
  @ApiProperty() provider: string;
  @ApiProperty() status: string;
  @ApiProperty({ type: String, nullable: true }) error: string | null;
  @ApiProperty({ type: String, nullable: true }) appointmentId: string | null;
  @ApiProperty({ type: String, nullable: true }) customerName: string | null;
  @ApiProperty() createdAt: string;
}

class MessagesQueryDto {
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

class SimulateReplyDto {
  @ApiProperty() @IsString() appointmentId: string;
  @ApiProperty({ enum: ['1', '2'], description: '1 = confirmar, 2 = cancelar' }) @IsIn(['1', '2']) reply: '1' | '2';
}

class ReminderRunResultDto {
  @ApiProperty() sent: number;
  @ApiProperty() failed: number;
}

class SimulateReplyResultDto {
  @ApiProperty() handled: boolean;
  @ApiPropertyOptional({ enum: ['confirmed', 'canceled', 'rejected'] }) action?: 'confirmed' | 'canceled' | 'rejected';
}

@AdminController('mensagens')
@Controller('admin')
export class MessagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
    private readonly appointments: AppointmentsService,
    private readonly messaging: MessagingService,
  ) {}

  @Get('messages')
  @ApiOperation({ summary: 'Histórico de WhatsApp (PROFESSIONAL vê só os da própria agenda)' })
  @ApiOkResponse({ type: [MessageDto] })
  async list(@CurrentUser() user: SessionUser, @Query() q: MessagesQueryDto): Promise<MessageDto[]> {
    const rows = await this.prisma.messageLog.findMany({
      where: {
        businessId: user.businessId,
        ...(user.role === 'PROFESSIONAL' ? { appointment: { professionalId: user.professionalId ?? '__none__' } } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 50,
    });
    return rows.map((m) => ({
      id: m.id,
      direction: m.direction,
      kind: m.kind,
      phone: m.phone,
      body: m.body,
      provider: m.provider,
      status: m.status,
      error: m.error,
      appointmentId: m.appointmentId,
      customerName: m.customer?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  @Post('messages/send-reminders')
  @Roles('OWNER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envia agora os lembretes devidos deste negócio' })
  @ApiOkResponse({ type: ReminderRunResultDto })
  sendReminders(@CurrentUser() user: SessionUser): Promise<ReminderRunResultDto> {
    return this.messaging.sendDueReminders(new Date(), user.businessId);
  }

  @Post('appointments/:id/remind')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envia o lembrete de um agendamento agora' })
  @ApiOkResponse({ type: ReminderRunResultDto })
  async remind(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<ReminderRunResultDto> {
    const appointment = await this.appointments.findForUser(id, user);
    const business = await this.businesses.getById(user.businessId);
    const ok = await this.messaging.sendReminder(appointment, business);
    return { sent: ok ? 1 : 0, failed: ok ? 0 : 1 };
  }

  @Post('messages/simulate-reply')
  @Roles('OWNER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Demonstração: simula a resposta do cliente (1 confirma, 2 cancela). Só no modo simulado.' })
  @ApiOkResponse({ type: SimulateReplyResultDto })
  async simulate(@CurrentUser() user: SessionUser, @Body() dto: SimulateReplyDto): Promise<SimulateReplyResultDto> {
    const result = await this.messaging.simulateReply(user.businessId, dto.appointmentId, dto.reply);
    return result.handled ? { handled: true, action: result.action } : { handled: false };
  }
}
