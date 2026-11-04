import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value;

export class CustomerInputDto {
  @ApiProperty({ example: 'João da Silva' })
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Informe seu nome (2 a 80 caracteres).' })
  name: string;

  @ApiProperty({ example: '(19) 99999-0000', description: 'WhatsApp com DDD; aceita máscara.' })
  @IsString()
  @Matches(/^[\d\s()+-]{10,20}$/, { message: 'Informe um WhatsApp válido com DDD.' })
  whatsapp: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;
}

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'ID do profissional ou "any" para qualquer um.', example: 'any' })
  @IsString()
  @IsNotEmpty()
  professionalId: string;

  @ApiProperty({ example: '2026-11-04T12:00:00.000Z', description: 'Início em ISO 8601 (UTC).' })
  @IsISO8601({ strict: true }, { message: 'Horário inválido.' })
  startsAt: string;

  @ApiProperty({ type: CustomerInputDto })
  @ValidateNested()
  @Type(() => CustomerInputDto)
  customer: CustomerInputDto;

  @ApiPropertyOptional({ example: 'Prefiro máquina 2 nas laterais.' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RescheduleDto {
  @ApiProperty({ example: '2026-11-05T13:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: 'Horário inválido.' })
  startsAt: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: AppointmentStatus, enumName: 'AppointmentStatus' })
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;
}

// ---------- Respostas ----------

export class NamedRefDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class AppointmentServiceRefDto extends NamedRefDto {
  @ApiProperty() durationMinutes: number;
}

export class AppointmentProfessionalRefDto extends NamedRefDto {
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
}

export class AppointmentCustomerRefDto extends NamedRefDto {
  @ApiProperty() whatsapp: string;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
}

export class PublicBusinessRefDto {
  @ApiProperty() name: string;
  @ApiProperty() timezone: string;
  @ApiProperty() address: string;
  @ApiProperty() whatsapp: string;
  @ApiProperty() cancellationPolicyHours: number;
}

export class ManageInfoDto {
  @ApiProperty() canChange: boolean;
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
  @ApiProperty() deadline: string;
}

export class PublicPaymentDto {
  @ApiProperty({ enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'REFUNDED'], enumName: 'PaymentStatus' })
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED' | 'REFUNDED';
  @ApiProperty({ description: 'MERCADO_PAGO ou SIMULATED' }) provider: string;
  @ApiProperty() amountCents: number;
  @ApiProperty({ type: String, nullable: true, description: 'Pix copia e cola (só enquanto pendente)' }) qrCode: string | null;
  @ApiProperty({ type: String, nullable: true }) qrCodeBase64: string | null;
  @ApiProperty({ type: String, nullable: true }) ticketUrl: string | null;
  @ApiProperty() expiresAt: string;
  @ApiProperty({ type: String, nullable: true }) paidAt: string | null;
}

export class AdminPaymentDto {
  @ApiProperty({ enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'REFUNDED'], enumName: 'PaymentStatus' })
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED' | 'REFUNDED';
  @ApiProperty() amountCents: number;
  @ApiProperty() provider: string;
}

export class PublicAppointmentDto {
  @ApiProperty() code: string;
  @ApiProperty({ enum: AppointmentStatus, enumName: 'AppointmentStatus' }) status: AppointmentStatus;
  @ApiProperty() startsAt: string;
  @ApiProperty() endsAt: string;
  @ApiProperty() priceCents: number;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ type: AppointmentServiceRefDto }) service: AppointmentServiceRefDto;
  @ApiProperty({ type: AppointmentProfessionalRefDto }) professional: AppointmentProfessionalRefDto;
  @ApiProperty() customerName: string;
  @ApiProperty({ type: PublicBusinessRefDto }) business: PublicBusinessRefDto;
  @ApiProperty({ type: ManageInfoDto }) manage: ManageInfoDto;
  @ApiProperty({ type: PublicPaymentDto, nullable: true }) payment: PublicPaymentDto | null;
}

export class CreatedAppointmentDto extends PublicAppointmentDto {
  @ApiProperty({ description: 'Token secreto para o cliente gerenciar o agendamento.' })
  manageToken: string;
}

export class AdminAppointmentDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty({ enum: AppointmentStatus, enumName: 'AppointmentStatus' }) status: AppointmentStatus;
  @ApiProperty({ enum: ['ONLINE', 'MANUAL'] }) source: 'ONLINE' | 'MANUAL';
  @ApiProperty() startsAt: string;
  @ApiProperty() endsAt: string;
  @ApiProperty() priceCents: number;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ type: AppointmentServiceRefDto }) service: AppointmentServiceRefDto;
  @ApiProperty({ type: AppointmentProfessionalRefDto }) professional: AppointmentProfessionalRefDto;
  @ApiProperty({ type: AppointmentCustomerRefDto }) customer: AppointmentCustomerRefDto;
  @ApiProperty() manageToken: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ type: String, nullable: true, description: 'WHATSAPP, PIX ou PAINEL' }) confirmedVia: string | null;
  @ApiProperty({ type: String, nullable: true }) reminderSentAt: string | null;
  @ApiProperty({ type: AdminPaymentDto, nullable: true }) payment: AdminPaymentDto | null;
}
