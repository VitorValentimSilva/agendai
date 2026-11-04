import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Business } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { CurrentUser, Roles, type SessionUser } from '../common/decorators.js';
import { BusinessService } from '../business/business.service.js';
import { normalizeWhatsapp } from '../common/phone.js';
import { encryptSecret } from '../common/crypto.js';
import { AdminController } from './admin.decorator.js';
import { BusinessSettingsDto, UpdateBusinessDto } from './admin.dto.js';

/** Nunca devolve o token cifrado do Mercado Pago — só se ele existe. */
function toSettings(b: Business): BusinessSettingsDto {
  const { createdAt: _c, updatedAt: _u, mercadoPagoTokenEnc, ...rest } = b;
  return { ...rest, hasMercadoPagoToken: Boolean(mercadoPagoTokenEnc) };
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

@AdminController('configurações')
@Roles('OWNER')
@Controller('admin/business')
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
  ) {}

  @Get()
  @ApiOkResponse({ type: BusinessSettingsDto })
  async get(@CurrentUser() user: SessionUser): Promise<BusinessSettingsDto> {
    return toSettings(await this.businesses.getById(user.businessId));
  }

  @Patch()
  @ApiOkResponse({ type: BusinessSettingsDto })
  async update(@CurrentUser() user: SessionUser, @Body() dto: UpdateBusinessDto): Promise<BusinessSettingsDto> {
    if (dto.timezone && !isValidTimezone(dto.timezone)) throw new BadRequestException('Fuso horário inválido.');
    const { mercadoPagoToken, ...fields } = dto;
    const data = {
      ...fields,
      ...(mercadoPagoToken !== undefined ? { mercadoPagoTokenEnc: mercadoPagoToken ? encryptSecret(mercadoPagoToken) : null } : {}),
      ...(dto.whatsapp ? { whatsapp: normalizeWhatsapp(dto.whatsapp) } : {}),
      ...(dto.state ? { state: dto.state.toUpperCase() } : {}),
    };
    return toSettings(await this.prisma.business.update({ where: { id: user.businessId }, data }));
  }
}
