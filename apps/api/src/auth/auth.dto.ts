import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'demo@agendai.app' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({ example: 'demo1234' })
  @IsString()
  @MinLength(6, { message: 'A senha tem pelo menos 6 caracteres.' })
  password: string;
}

export class MeDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ['OWNER', 'PROFESSIONAL'] }) role: 'OWNER' | 'PROFESSIONAL';
  @ApiProperty({ type: String, nullable: true }) professionalId: string | null;
  @ApiProperty() businessId: string;
  @ApiProperty() businessName: string;
}
