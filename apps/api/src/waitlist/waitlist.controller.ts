import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service.js';
import { BusinessService } from '../business/business.service.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { TenantSlug } from '../common/tenant.js';
import { env } from '../common/env.js';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { AdminController } from '../admin/admin.decorator.js';
import { WaitlistService } from './waitlist.service.js';
import { JoinWaitlistDto, WaitlistEntryAdminDto, WaitlistEntryPublicDto, WaitlistQueryDto } from './waitlist.dto.js';

@ApiTags('Público')
@ApiHeader({ name: 'x-business-slug', required: false })
@UseGuards(RateLimitGuard)
@Controller('waitlist')
export class WaitlistPublicController {
  constructor(
    private readonly businesses: BusinessService,
    private readonly waitlist: WaitlistService,
  ) {}

  @Post()
  @RateLimit({ limit: env.bookingThrottleLimit })
  @ApiOperation({ summary: 'Entrar na fila de espera de um dia sem vagas' })
  @ApiCreatedResponse({ type: WaitlistEntryPublicDto })
  async join(@Body() dto: JoinWaitlistDto, @TenantSlug() tenant?: string): Promise<WaitlistEntryPublicDto> {
    const business = await this.businesses.getPublicBusiness(tenant);
    return this.waitlist.join(business, dto);
  }

  @Post(':token/leave')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sair da fila de espera' })
  @ApiNoContentResponse()
  async leave(@Param('token') token: string): Promise<void> {
    await this.waitlist.leave(token);
  }
}

@AdminController('fila de espera')
@Controller('admin/waitlist')
export class WaitlistAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waitlist: WaitlistService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Fila de espera (PROFESSIONAL vê a própria e as de "qualquer profissional")' })
  @ApiOkResponse({ type: [WaitlistEntryAdminDto] })
  async list(@CurrentUser() user: SessionUser, @Query() q: WaitlistQueryDto): Promise<WaitlistEntryAdminDto[]> {
    const rows = await this.waitlist.listForAdmin(
      user.businessId,
      user.role === 'PROFESSIONAL' ? (user.professionalId ?? '__none__') : null,
      q.status ?? 'ALL',
    );
    const services = await this.prisma.service.findMany({ where: { businessId: user.businessId }, select: { id: true, name: true } });
    const serviceName = new Map(services.map((s) => [s.id, s.name]));
    return rows.map((e) => ({
      id: e.id,
      date: e.date,
      status: e.status,
      serviceId: e.serviceId,
      serviceName: serviceName.get(e.serviceId) ?? '—',
      professionalId: e.professionalId,
      professionalName: e.professional?.name ?? null,
      customerName: e.customer.name,
      customerWhatsapp: e.customer.whatsapp,
      notifiedAt: e.notifiedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover da fila' })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    const where = {
      id,
      businessId: user.businessId,
      ...(user.role === 'PROFESSIONAL' ? { professionalId: user.professionalId ?? '__none__' } : {}),
    };
    const updated = await this.prisma.waitlistEntry.updateMany({ where, data: { status: 'CANCELED' } });
    if (!updated.count) throw new NotFoundException('Inscrição não encontrada.');
  }
}
