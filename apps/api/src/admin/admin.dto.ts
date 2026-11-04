import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AdminAppointmentDto, CustomerInputDto } from '../appointments/appointments.dto.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

// ---------- Agenda ----------

export class AgendaQueryDto {
  @ApiProperty({ example: '2026-11-03' }) @Matches(DATE) from: string;
  @ApiProperty({ example: '2026-11-09' }) @Matches(DATE) to: string;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string;
}

export class TimeOffDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) professionalId: string | null;
  @ApiProperty() startsAt: string;
  @ApiProperty() endsAt: string;
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
}

export class AgendaDto {
  @ApiProperty() timezone: string;
  @ApiProperty({ type: [AdminAppointmentDto] }) appointments: AdminAppointmentDto[];
  @ApiProperty({ type: [TimeOffDto] }) timeOffs: TimeOffDto[];
}

export class ManualAppointmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() serviceId: string;
  @ApiProperty({ description: 'ID do profissional ou "any"' }) @IsString() @IsNotEmpty() professionalId: string;
  @ApiProperty() @IsISO8601({ strict: true }) startsAt: string;
  @ApiProperty({ type: CustomerInputDto }) @ValidateNested() @Type(() => CustomerInputDto) customer: CustomerInputDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

// ---------- Dashboard ----------

export class DashboardSeriesPointDto {
  @ApiProperty() date: string;
  @ApiProperty() appointments: number;
  @ApiProperty({ description: 'Faturamento realizado (concluídos) em centavos' }) revenueCents: number;
}

export class TopServiceDto {
  @ApiProperty() serviceId: string;
  @ApiProperty() name: string;
  @ApiProperty() count: number;
  @ApiProperty() revenueCents: number;
}

export class DashboardDto {
  @ApiProperty() timezone: string;
  @ApiProperty() today: string;
  @ApiProperty() appointmentsToday: number;
  @ApiProperty() appointmentsWeek: number;
  @ApiProperty() expectedRevenueMonthCents: number;
  @ApiProperty() realizedRevenueMonthCents: number;
  @ApiProperty({ description: '0..1, últimos 30 dias' }) cancellationRate: number;
  @ApiProperty({ description: '0..1, últimos 30 dias' }) noShowRate: number;
  @ApiProperty({ type: [TopServiceDto] }) topServices: TopServiceDto[];
  @ApiProperty({ type: [DashboardSeriesPointDto] }) series: DashboardSeriesPointDto[];
  @ApiProperty({ type: [AdminAppointmentDto] }) upcoming: AdminAppointmentDto[];
}

// ---------- Serviços ----------

export class ServiceInputDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 60) name: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;
  @ApiProperty() @IsInt() @Min(5) @Max(600) durationMinutes: number;
  @ApiProperty({ description: 'Preço em centavos' }) @IsInt() @Min(0) @Max(10_000_00) priceCents: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) professionalIds?: string[];
}

export class UpdateServiceDto extends PartialType(ServiceInputDto) {}

export class AdminServiceDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty() durationMinutes: number;
  @ApiProperty() priceCents: number;
  @ApiProperty() active: boolean;
  @ApiProperty({ type: [String] }) professionalIds: string[];
}

// ---------- Profissionais ----------

export class WorkingHoursItemDto {
  @ApiProperty({ description: '0 = domingo' }) @IsInt() @Min(0) @Max(6) weekday: number;
  @ApiProperty({ description: 'Minutos desde 00:00' }) @IsInt() @Min(0) @Max(1440) startMinute: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1440) endMinute: number;
}

export class WorkingHoursInputDto {
  @ApiProperty({ type: [WorkingHoursItemDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursItemDto)
  items: WorkingHoursItemDto[];
}

export class ProfessionalInputDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 60) name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(300) bio?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Avatar deve ser uma URL https.' })
  avatarUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];
  @ApiPropertyOptional({ description: 'Comissão (%) sobre atendimentos concluídos' }) @IsOptional() @IsInt() @Min(0) @Max(100) commissionPercent?: number;
}

export class UpdateProfessionalDto extends PartialType(ProfessionalInputDto) {}

export class AdminProfessionalDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) bio: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
  @ApiProperty() active: boolean;
  @ApiProperty({ type: [String] }) serviceIds: string[];
  @ApiProperty({ type: [WorkingHoursItemDto] }) workingHours: WorkingHoursItemDto[];
  @ApiProperty({ type: String, nullable: true }) userEmail: string | null;
  @ApiProperty() commissionPercent: number;
  @ApiProperty({ description: 'Feed iCal ativo' }) hasCalendarFeed: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Conta Google conectada' }) googleEmail: string | null;
}

// ---------- Bloqueios ----------

export class TimeOffQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01' }) @IsOptional() @Matches(DATE) from?: string;
  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @Matches(DATE) to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string;
}

export class TimeOffInputDto {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Vazio = negócio inteiro' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  professionalId?: string | null;
  @ApiProperty() @IsISO8601({ strict: true }) startsAt: string;
  @ApiProperty() @IsISO8601({ strict: true }) endsAt: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(120) reason?: string | null;
}

// ---------- Clientes ----------

export class CustomersQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class CustomerListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() whatsapp: string;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty() appointmentsCount: number;
  @ApiProperty({ type: String, nullable: true }) lastVisitAt: string | null;
  @ApiProperty({ type: String, nullable: true }) nextAppointmentAt: string | null;
  @ApiProperty() totalSpentCents: number;
}

export class CustomerPageDto {
  @ApiProperty({ type: [CustomerListItemDto] }) items: CustomerListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
}

export class CustomerDetailDto extends CustomerListItemDto {
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty({ type: [AdminAppointmentDto] }) history: AdminAppointmentDto[];
}

export class UpdateCustomerDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsEmail() email?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}

// ---------- Configurações ----------

export class BusinessSettingsDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty() phone: string;
  @ApiProperty() whatsapp: string;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) instagram: string | null;
  @ApiProperty() addressLine: string;
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() timezone: string;
  @ApiProperty() slotIntervalMinutes: number;
  @ApiProperty() minAdvanceMinutes: number;
  @ApiProperty() maxAdvanceDays: number;
  @ApiProperty() cancellationPolicyHours: number;
  @ApiProperty() segment: string;
  @ApiProperty() remindersEnabled: boolean;
  @ApiProperty() reminderHoursBefore: number;
  @ApiProperty({ enum: ['NONE', 'DEPOSIT', 'FULL'], enumName: 'PaymentMode' }) paymentMode: 'NONE' | 'DEPOSIT' | 'FULL';
  @ApiProperty() depositPercent: number;
  @ApiProperty() paymentExpiryMinutes: number;
  @ApiProperty({ description: 'Há um token do Mercado Pago salvo (o valor nunca é devolvido)' }) hasMercadoPagoToken: boolean;
}

export class UpdateBusinessDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(400) description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[\d\s()+-]{10,20}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[\d\s()+-]{10,20}$/) whatsapp?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsEmail() email?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(60) instagram?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 120) addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 2) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(120) slotIntervalMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10080) minAdvanceMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365) maxAdvanceDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(168) cancellationPolicyHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() remindersEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(72) reminderHoursBefore?: number;
  @ApiPropertyOptional({ enum: ['NONE', 'DEPOSIT', 'FULL'], enumName: 'PaymentMode' })
  @IsOptional()
  @IsIn(['NONE', 'DEPOSIT', 'FULL'])
  paymentMode?: 'NONE' | 'DEPOSIT' | 'FULL';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100) depositPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(1440) paymentExpiryMinutes?: number;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Access token do Mercado Pago (vazio/null remove). Guardado cifrado.' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  mercadoPagoToken?: string | null;
}
