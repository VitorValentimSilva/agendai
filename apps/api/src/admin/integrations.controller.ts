import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { BusinessService } from '../business/business.service.js';
import { WhatsAppClient } from '../messaging/whatsapp.client.js';
import { PaymentsService } from '../payments/payments.service.js';
import { GoogleClient } from '../calendar/google.client.js';
import { AdminController } from './admin.decorator.js';

class IntegrationsDto {
  @ApiProperty({ enum: ['WHATSAPP_CLOUD', 'SIMULATED'] }) whatsapp: 'WHATSAPP_CLOUD' | 'SIMULATED';
  @ApiProperty({ enum: ['MERCADO_PAGO', 'SIMULATED'] }) pix: 'MERCADO_PAGO' | 'SIMULATED';
  @ApiProperty({ description: 'Sincronização com Google Calendar disponível' }) google: boolean;
}

@AdminController('integrações')
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly businesses: BusinessService,
    private readonly whatsapp: WhatsAppClient,
    private readonly payments: PaymentsService,
    private readonly google: GoogleClient,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Quais integrações estão ativas (reais ou simuladas)' })
  @ApiOkResponse({ type: IntegrationsDto })
  async get(@CurrentUser() user: SessionUser): Promise<IntegrationsDto> {
    const business = await this.businesses.getById(user.businessId);
    return { whatsapp: this.whatsapp.provider, pix: this.payments.providerFor(business), google: this.google.enabled };
  }
}
