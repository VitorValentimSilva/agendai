import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Length, Matches, MinLength } from 'class-validator';
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
  @ApiProperty() businessSlug: string;
  @ApiProperty() businessTimezone: string;
}

const trimStr = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignupDto {
  @ApiProperty({ example: 'Barbearia do Zé' })
  @Transform(trimStr)
  @IsString()
  @Length(2, 80, { message: 'Informe o nome do negócio (2 a 80 caracteres).' })
  businessName: string;

  @ApiProperty({ example: 'barbearia-do-ze', description: 'Endereço do seu link: letras minúsculas, números e hífen.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, {
    message: 'O endereço deve ter de 1 a 40 caracteres: letras minúsculas, números e hífen (sem começar/terminar com hífen).',
  })
  slug: string;

  @ApiProperty({ enum: ['barbearia', 'salao', 'clinica', 'estudio'] })
  @IsIn(['barbearia', 'salao', 'clinica', 'estudio'], { message: 'Segmento inválido.' })
  segment: 'barbearia' | 'salao' | 'clinica' | 'estudio';

  @ApiProperty({ example: 'José da Silva' })
  @Transform(trimStr)
  @IsString()
  @Length(2, 80, { message: 'Informe seu nome.' })
  ownerName: string;

  @ApiProperty({ example: 'ze@barbearia.com' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({ example: 'senha-forte-123' })
  @IsString()
  @Length(8, 72, { message: 'A senha precisa ter de 8 a 72 caracteres.' })
  password: string;

  @ApiProperty({ example: '(19) 99999-0000' })
  @IsString()
  @Matches(/^[\d\s()+-]{10,20}$/, { message: 'Informe um WhatsApp válido com DDD.' })
  whatsapp: string;

  @ApiProperty({ example: 'Campinas' })
  @Transform(trimStr)
  @IsString()
  @Length(2, 60, { message: 'Informe a cidade.' })
  city: string;

  @ApiProperty({ example: 'SP' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'Use a sigla do estado (ex.: SP).' })
  state: string;

  @ApiProperty({ example: 'Rua das Flores, 100 — Centro' })
  @Transform(trimStr)
  @IsString()
  @Length(3, 120, { message: 'Informe o endereço.' })
  addressLine: string;
}

export class SlugAvailabilityDto {
  @ApiProperty() slug: string;
  @ApiProperty() available: boolean;
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
}
