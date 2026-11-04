import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { CustomerInputDto } from '../appointments/appointments.dto.js';

export class JoinWaitlistDto {
  @ApiProperty() @IsString() @IsNotEmpty() serviceId: string;
  @ApiProperty({ description: 'ID do profissional ou "any"', example: 'any' }) @IsString() @IsNotEmpty() professionalId: string;
  @ApiProperty({ example: '2026-11-20' }) @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida.' }) date: string;
  @ApiProperty({ type: CustomerInputDto }) @ValidateNested() @Type(() => CustomerInputDto) customer: CustomerInputDto;
}

export class WaitlistEntryPublicDto {
  @ApiProperty() token: string;
  @ApiProperty() date: string;
  @ApiProperty() serviceName: string;
  @ApiProperty({ type: String, nullable: true }) professionalName: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'NOTIFIED', 'BOOKED', 'CANCELED'], enumName: 'WaitlistStatus' })
  status: 'ACTIVE' | 'NOTIFIED' | 'BOOKED' | 'CANCELED';
}

export class WaitlistEntryAdminDto {
  @ApiProperty() id: string;
  @ApiProperty() date: string;
  @ApiProperty({ enum: ['ACTIVE', 'NOTIFIED', 'BOOKED', 'CANCELED'], enumName: 'WaitlistStatus' })
  status: 'ACTIVE' | 'NOTIFIED' | 'BOOKED' | 'CANCELED';
  @ApiProperty() serviceId: string;
  @ApiProperty() serviceName: string;
  @ApiProperty({ type: String, nullable: true }) professionalId: string | null;
  @ApiProperty({ type: String, nullable: true }) professionalName: string | null;
  @ApiProperty() customerName: string;
  @ApiProperty() customerWhatsapp: string;
  @ApiProperty({ type: String, nullable: true }) notifiedAt: string | null;
  @ApiProperty() createdAt: string;
}

export class WaitlistQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'NOTIFIED', 'BOOKED', 'CANCELED', 'ALL'], default: 'ALL' })
  @IsOptional()
  @IsIn(['ACTIVE', 'NOTIFIED', 'BOOKED', 'CANCELED', 'ALL'])
  status?: 'ACTIVE' | 'NOTIFIED' | 'BOOKED' | 'CANCELED' | 'ALL';
}
