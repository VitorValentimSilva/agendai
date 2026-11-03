import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { CurrentUser, Roles, type SessionUser } from '../common/decorators.js';
import { BusinessService } from '../business/business.service.js';
import { addCalendarDays, localDayRange } from '../availability/availability.engine.js';
import { parseDateParam } from '../common/dates.js';
import { AdminController } from './admin.decorator.js';
import {
  AdminProfessionalDto,
  AdminServiceDto,
  ProfessionalInputDto,
  ServiceInputDto,
  TimeOffDto,
  TimeOffInputDto,
  TimeOffQueryDto,
  UpdateProfessionalDto,
  UpdateServiceDto,
  WorkingHoursInputDto,
  type WorkingHoursItemDto,
} from './admin.dto.js';

const professionalInclude = {
  services: { select: { serviceId: true } },
  workingHours: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
  user: { select: { email: true } },
} satisfies Prisma.ProfessionalInclude;

type ProfessionalRow = Prisma.ProfessionalGetPayload<{ include: typeof professionalInclude }>;

function toProfessional(p: ProfessionalRow): AdminProfessionalDto {
  return {
    id: p.id,
    name: p.name,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    active: p.active,
    serviceIds: p.services.map((s) => s.serviceId),
    workingHours: p.workingHours.map((w) => ({ weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute })),
    userEmail: p.user?.email ?? null,
  };
}

/** Valida intervalos: fim > início e sem sobreposição no mesmo dia. */
export function validateWorkingHours(items: WorkingHoursItemDto[]): void {
  for (const it of items) {
    if (it.endMinute <= it.startMinute) throw new BadRequestException('Cada intervalo precisa terminar depois de começar.');
  }
  for (let d = 0; d < 7; d++) {
    const day = items.filter((i) => i.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < day.length; i++) {
      if (day[i]!.startMinute < day[i - 1]!.endMinute) {
        throw new BadRequestException('Há intervalos sobrepostos no mesmo dia.');
      }
    }
  }
}

@AdminController('cadastros')
@Controller('admin')
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
  ) {}

  // ---------------- Serviços ----------------

  @Get('services')
  @ApiOkResponse({ type: [AdminServiceDto] })
  async listServices(@CurrentUser() user: SessionUser): Promise<AdminServiceDto[]> {
    const rows = await this.prisma.service.findMany({
      where: { businessId: user.businessId },
      include: { professionals: { select: { professionalId: true } } },
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(({ professionals, businessId: _b, sortOrder: _s, createdAt: _c, updatedAt: _u, ...s }) => ({
      ...s,
      professionalIds: professionals.map((p) => p.professionalId),
    }));
  }

  @Post('services')
  @Roles('OWNER')
  @ApiCreatedResponse({ type: AdminServiceDto })
  async createService(@CurrentUser() user: SessionUser, @Body() dto: ServiceInputDto): Promise<AdminServiceDto> {
    const { professionalIds, ...data } = dto;
    const last = await this.prisma.service.aggregate({ where: { businessId: user.businessId }, _max: { sortOrder: true } });
    const created = await this.prisma.service.create({
      data: {
        ...data,
        businessId: user.businessId,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        professionals: { create: await this.ownProfessionalIds(user, professionalIds ?? []).then((ids) => ids.map((professionalId) => ({ professionalId }))) },
      },
    });
    return (await this.listServices(user)).find((s) => s.id === created.id)!;
  }

  @Patch('services/:id')
  @Roles('OWNER')
  @ApiOkResponse({ type: AdminServiceDto })
  async updateService(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: UpdateServiceDto): Promise<AdminServiceDto> {
    await this.assertService(user, id);
    const { professionalIds, ...data } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data });
      if (professionalIds) {
        const ids = await this.ownProfessionalIds(user, professionalIds);
        await tx.professionalService.deleteMany({ where: { serviceId: id } });
        await tx.professionalService.createMany({ data: ids.map((professionalId) => ({ professionalId, serviceId: id })) });
      }
    });
    return (await this.listServices(user)).find((s) => s.id === id)!;
  }

  @Delete('services/:id')
  @Roles('OWNER')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove o serviço (ou só desativa, se já houver agendamentos)' })
  @ApiNoContentResponse()
  async deleteService(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.assertService(user, id);
    const used = await this.prisma.appointment.count({ where: { serviceId: id } });
    if (used > 0) await this.prisma.service.update({ where: { id }, data: { active: false } });
    else await this.prisma.service.delete({ where: { id } });
  }

  // ---------------- Profissionais ----------------

  @Get('professionals')
  @ApiOkResponse({ type: [AdminProfessionalDto] })
  async listProfessionals(@CurrentUser() user: SessionUser): Promise<AdminProfessionalDto[]> {
    const rows = await this.prisma.professional.findMany({
      where: { businessId: user.businessId },
      include: professionalInclude,
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toProfessional);
  }

  @Post('professionals')
  @Roles('OWNER')
  @ApiCreatedResponse({ type: AdminProfessionalDto })
  async createProfessional(@CurrentUser() user: SessionUser, @Body() dto: ProfessionalInputDto): Promise<AdminProfessionalDto> {
    const { serviceIds, ...data } = dto;
    const ids = await this.ownServiceIds(user, serviceIds ?? []);
    const last = await this.prisma.professional.aggregate({ where: { businessId: user.businessId }, _max: { sortOrder: true } });
    const created = await this.prisma.professional.create({
      data: {
        ...data,
        businessId: user.businessId,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        services: { create: ids.map((serviceId) => ({ serviceId })) },
      },
      include: professionalInclude,
    });
    return toProfessional(created);
  }

  @Patch('professionals/:id')
  @Roles('OWNER')
  @ApiOkResponse({ type: AdminProfessionalDto })
  async updateProfessional(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ): Promise<AdminProfessionalDto> {
    await this.assertProfessional(user, id);
    const { serviceIds, ...data } = dto;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (serviceIds) {
        const ids = await this.ownServiceIds(user, serviceIds);
        await tx.professionalService.deleteMany({ where: { professionalId: id } });
        await tx.professionalService.createMany({ data: ids.map((serviceId) => ({ serviceId, professionalId: id })) });
      }
      return tx.professional.update({ where: { id }, data, include: professionalInclude });
    });
    return toProfessional(updated);
  }

  @Delete('professionals/:id')
  @Roles('OWNER')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove o profissional (ou só desativa, se já houver agendamentos)' })
  @ApiNoContentResponse()
  async deleteProfessional(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.assertProfessional(user, id);
    const used = await this.prisma.appointment.count({ where: { professionalId: id } });
    if (used > 0) await this.prisma.professional.update({ where: { id }, data: { active: false } });
    else await this.prisma.professional.delete({ where: { id } });
  }

  @Put('professionals/:id/working-hours')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Substitui o expediente semanal (vários intervalos por dia)' })
  @ApiOkResponse({ type: AdminProfessionalDto })
  async setWorkingHours(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: WorkingHoursInputDto,
  ): Promise<AdminProfessionalDto> {
    await this.assertProfessional(user, id);
    validateWorkingHours(dto.items);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({ where: { professionalId: id } });
      await tx.workingHours.createMany({ data: dto.items.map((i) => ({ ...i, professionalId: id })) });
      return tx.professional.findUniqueOrThrow({ where: { id }, include: professionalInclude });
    });
    return toProfessional(updated);
  }

  // ---------------- Bloqueios ----------------

  @Get('time-offs')
  @ApiOkResponse({ type: [TimeOffDto] })
  async listTimeOffs(@CurrentUser() user: SessionUser, @Query() q: TimeOffQueryDto): Promise<TimeOffDto[]> {
    const business = await this.businesses.getById(user.businessId);
    const where: Prisma.TimeOffWhereInput = { businessId: business.id };
    if (q.from) where.endsAt = { gt: localDayRange(parseDateParam(q.from, 'from'), business.timezone).start };
    if (q.to) where.startsAt = { lt: localDayRange(addCalendarDays(parseDateParam(q.to, 'to'), 1), business.timezone).start };
    const professionalId = user.role === 'PROFESSIONAL' ? user.professionalId : q.professionalId;
    if (professionalId) where.OR = [{ professionalId }, { professionalId: null }];
    const rows = await this.prisma.timeOff.findMany({ where, orderBy: { startsAt: 'asc' } });
    return rows.map((t) => ({
      id: t.id,
      professionalId: t.professionalId,
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt.toISOString(),
      reason: t.reason,
    }));
  }

  @Post('time-offs')
  @ApiOperation({ summary: 'Cria bloqueio (sem profissional = negócio inteiro, só OWNER)' })
  @ApiCreatedResponse({ type: TimeOffDto })
  async createTimeOff(@CurrentUser() user: SessionUser, @Body() dto: TimeOffInputDto): Promise<TimeOffDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('O fim do bloqueio precisa ser depois do início.');
    let professionalId = dto.professionalId ?? null;
    if (user.role === 'PROFESSIONAL') {
      if (professionalId && professionalId !== user.professionalId) {
        throw new ForbiddenException('Você só pode bloquear a sua própria agenda.');
      }
      professionalId = user.professionalId;
    } else if (professionalId) {
      await this.assertProfessional(user, professionalId);
    }
    const t = await this.prisma.timeOff.create({
      data: { businessId: user.businessId, professionalId, startsAt, endsAt, reason: dto.reason ?? null },
    });
    return { id: t.id, professionalId: t.professionalId, startsAt: t.startsAt.toISOString(), endsAt: t.endsAt.toISOString(), reason: t.reason };
  }

  @Delete('time-offs/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async deleteTimeOff(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    const t = await this.prisma.timeOff.findFirst({ where: { id, businessId: user.businessId } });
    if (!t) throw new NotFoundException('Bloqueio não encontrado.');
    if (user.role === 'PROFESSIONAL' && t.professionalId !== user.professionalId) {
      throw new ForbiddenException('Você só pode remover bloqueios da sua própria agenda.');
    }
    await this.prisma.timeOff.delete({ where: { id } });
  }

  // ---------------- Auxiliares ----------------

  private async assertService(user: SessionUser, id: string): Promise<void> {
    const found = await this.prisma.service.count({ where: { id, businessId: user.businessId } });
    if (!found) throw new NotFoundException('Serviço não encontrado.');
  }

  private async assertProfessional(user: SessionUser, id: string): Promise<void> {
    const found = await this.prisma.professional.count({ where: { id, businessId: user.businessId } });
    if (!found) throw new NotFoundException('Profissional não encontrado.');
  }

  private async ownProfessionalIds(user: SessionUser, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.professional.findMany({ where: { id: { in: ids }, businessId: user.businessId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  private async ownServiceIds(user: SessionUser, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.service.findMany({ where: { id: { in: ids }, businessId: user.businessId }, select: { id: true } });
    return rows.map((r) => r.id);
  }
}
