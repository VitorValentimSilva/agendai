import { Controller, Delete, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiProperty } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Roles, type SessionUser } from '../common/decorators.js';
import { RateLimitGuard } from '../common/rate-limit.js';
import { env } from '../common/env.js';
import { AdminController } from '../admin/admin.decorator.js';
import { BusinessSettingsDto } from '../admin/admin.dto.js';
import { toSettings } from '../admin/settings.mapper.js';
import { MercadoPagoOAuthService } from './mercadopago-oauth.service.js';

class ConnectUrlDto {
  @ApiProperty() url: string;
}

/** Retorno do OAuth do Mercado Pago → volta para as configurações do painel. */
@UseGuards(RateLimitGuard)
@Controller('integrations/mercadopago')
export class MercadoPagoOAuthCallbackController {
  constructor(private readonly oauth: MercadoPagoOAuthService) {}

  @Get('callback')
  @ApiExcludeEndpoint()
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    const back = new URL('/admin/configuracoes', env.webOrigin);
    try {
      if (error || !code || !state) throw new Error(error ?? 'Resposta incompleta do Mercado Pago.');
      await this.oauth.callback(code, state);
      back.searchParams.set('mercadopago', 'ok');
    } catch (e) {
      back.searchParams.set('mercadopago', 'erro');
      back.searchParams.set('motivo', e instanceof Error ? e.message.slice(0, 120) : 'erro');
    }
    res.redirect(302, back.toString());
  }
}

@AdminController('integrações')
@Roles('OWNER')
@Controller('admin/integrations/mercadopago')
export class MercadoPagoOAuthAdminController {
  constructor(private readonly oauth: MercadoPagoOAuthService) {}

  @Get('connect')
  @ApiOperation({ summary: 'URL para conectar a conta do Mercado Pago do negócio (OAuth)' })
  @ApiOkResponse({ type: ConnectUrlDto })
  async connect(@CurrentUser() user: SessionUser): Promise<ConnectUrlDto> {
    return { url: await this.oauth.connectUrl(user) };
  }

  @Delete()
  @ApiOperation({ summary: 'Desconecta a conta do Mercado Pago (desliga a cobrança Pix fora da demo)' })
  @ApiOkResponse({ type: BusinessSettingsDto })
  async disconnect(@CurrentUser() user: SessionUser): Promise<BusinessSettingsDto> {
    return toSettings(await this.oauth.disconnect(user));
  }
}
