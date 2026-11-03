import { Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { CurrentUser, Roles, type SessionUser } from '../common/decorators.js';
import { appointmentInclude, toAdminAppointment } from '../appointments/appointment.mapper.js';
import { AdminController } from './admin.decorator.js';
import { CustomerDetailDto, CustomerListItemDto, CustomerPageDto, CustomersQueryDto, UpdateCustomerDto } from './admin.dto.js';

type CustomerWithAppointments = Prisma.CustomerGetPayload<{
  include: { appointments: { select: { startsAt: true; status: true; priceCents: true } } };
}>;

function summarize(c: CustomerWithAppointments, now: Date): CustomerListItemDto {
  const visits = c.appointments.filter((a) => a.status === 'COMPLETED');
  const last = visits.map((a) => a.startsAt).sort((a, b) => b.getTime() - a.getTime())[0];
  const next = c.appointments
    .filter((a) => (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && a.startsAt >= now)
    .map((a) => a.startsAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    id: c.id,
    name: c.name,
    whatsapp: c.whatsapp,
    email: c.email,
    appointmentsCount: c.appointments.filter((a) => a.status !== 'CANCELED').length,
    lastVisitAt: last?.toISOString() ?? null,
    nextAppointmentAt: next?.toISOString() ?? null,
    totalSpentCents: visits.reduce((s, a) => s + a.priceCents, 0),
  };
}

@AdminController('clientes')
@Roles('OWNER')
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: CustomerPageDto })
  async list(@CurrentUser() user: SessionUser, @Query() q: CustomersQueryDto): Promise<CustomerPageDto> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const search = q.search?.trim();
    const digits = search?.replace(/\D/g, '');
    const where: Prisma.CustomerWhereInput = {
      businessId: user.businessId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              ...(digits && digits.length >= 3 ? [{ whatsapp: { contains: digits } }] : []),
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { appointments: { select: { startsAt: true, status: true, priceCents: true } } },
      }),
    ]);
    const now = new Date();
    return { items: rows.map((c) => summarize(c, now)), total, page, pageSize };
  }

  @Get(':id')
  @ApiOkResponse({ type: CustomerDetailDto })
  async detail(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<CustomerDetailDto> {
    const c = await this.prisma.customer.findFirst({
      where: { id, businessId: user.businessId },
      include: { appointments: { select: { startsAt: true, status: true, priceCents: true } } },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    const history = await this.prisma.appointment.findMany({
      where: { customerId: id },
      orderBy: { startsAt: 'desc' },
      include: appointmentInclude,
    });
    return {
      ...summarize(c, new Date()),
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      history: history.map(toAdminAppointment),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ type: CustomerDetailDto })
  async update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto): Promise<CustomerDetailDto> {
    const found = await this.prisma.customer.count({ where: { id, businessId: user.businessId } });
    if (!found) throw new NotFoundException('Cliente não encontrado.');
    await this.prisma.customer.update({ where: { id }, data: dto });
    return this.detail(user, id);
  }
}
