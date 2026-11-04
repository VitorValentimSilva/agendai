import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class AvailabilityQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() serviceId: string;

  @ApiProperty({ example: 'any', description: 'ID do profissional ou "any".' })
  @IsString()
  @IsNotEmpty()
  professionalId: string;

  @ApiProperty({ example: '2026-11-04' })
  @Matches(DATE, { message: 'date deve estar no formato AAAA-MM-DD.' })
  date: string;
}

export class AvailableDaysQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() serviceId: string;
  @ApiProperty({ example: 'any' }) @IsString() @IsNotEmpty() professionalId: string;
  @ApiProperty({ example: '2026-11-01' }) @Matches(DATE, { message: 'from deve estar no formato AAAA-MM-DD.' }) from: string;
  @ApiProperty({ example: '2026-11-30' }) @Matches(DATE, { message: 'to deve estar no formato AAAA-MM-DD.' }) to: string;
}

export class TokenAvailabilityQueryDto {
  @ApiProperty({ example: '2026-11-04' })
  @Matches(DATE, { message: 'date deve estar no formato AAAA-MM-DD.' })
  date: string;
}

export class TokenAvailableDaysQueryDto {
  @ApiProperty({ example: '2026-11-01' }) @Matches(DATE, { message: 'from deve estar no formato AAAA-MM-DD.' }) from: string;
  @ApiProperty({ example: '2026-11-30' }) @Matches(DATE, { message: 'to deve estar no formato AAAA-MM-DD.' }) to: string;
}

export class OpeningIntervalDto {
  @ApiProperty({ description: 'Minutos desde 00:00' }) start: number;
  @ApiProperty() end: number;
}

export class OpeningHoursDto {
  @ApiProperty({ description: '0 = domingo' }) weekday: number;
  @ApiProperty({ type: [OpeningIntervalDto] }) intervals: OpeningIntervalDto[];
}

export class PublicBusinessDto {
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ example: 'barbearia' }) segment: string;
  @ApiProperty({ enum: ['NONE', 'DEPOSIT', 'FULL'], enumName: 'PaymentMode' }) paymentMode: 'NONE' | 'DEPOSIT' | 'FULL';
  @ApiProperty() depositPercent: number;
  @ApiProperty() paymentExpiryMinutes: number;
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
  @ApiProperty({ type: [OpeningHoursDto] }) openingHours: OpeningHoursDto[];
}

export class PublicServiceDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty() durationMinutes: number;
  @ApiProperty() priceCents: number;
}

export class PublicProfessionalDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) bio: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
}

export class SlotDto {
  @ApiProperty({ description: 'Início em ISO (UTC)' }) start: string;
  @ApiProperty() end: string;
  @ApiProperty({ example: '09:30', description: 'Horário no fuso do negócio' }) time: string;
  @ApiProperty({ type: [String] }) professionalIds: string[];
}

export class AvailabilityDto {
  @ApiProperty() date: string;
  @ApiProperty() timezone: string;
  @ApiProperty({ type: [SlotDto] }) slots: SlotDto[];
}

export class AvailableDaysDto {
  @ApiProperty({ type: [String], example: ['2026-11-04', '2026-11-05'] }) days: string[];
}

export class OptionalProfessionalQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string;
}
