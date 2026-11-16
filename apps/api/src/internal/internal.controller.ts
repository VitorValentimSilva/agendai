import { Controller, Get, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { safeEqual } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { resetDemo } from '../demo/demo-data.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PaymentsService } from '../payments/payments.service.js';

class ReminderRunDto {
  @ApiProperty() sent: number;
  @ApiProperty() failed: number;
  @ApiProperty({ description: 'Pix expirados cancelados nesta rodada' }) expired: number;
}

class ResetDemoResultDto {
  @ApiProperty() ok: boolean;
  @ApiProperty() appointments: number;
  @ApiProperty() customers: number;
}


@ApiTags('Interno')
@ApiBearerAuth()
@Controller('internal')
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly payments: PaymentsService,
  ) {}

  private authorize(authorization?: string): void {
    const secret = env.cronSecret;
    if (!secret || !authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
      throw new UnauthorizedException();
    }
  }

  /**
   * Cron: expira Pix vencidos e envia os lembretes de WhatsApp devidos (todos os negócios).
   * Chamado a cada 15 min por um agendador externo (cron-job.org) e 1x/dia pelo Cron da Vercel (Hobby).
   * Idempotente: cada lembrete é reservado antes do envio, então chamadas sobrepostas não duplicam.
   */
  private async runReminders(authorization?: string): Promise<ReminderRunDto> {
    this.authorize(authorization);
    const expired = await this.payments.expireStale();
    const result = await this.messaging.sendDueReminders();
    return { ...result, expired };
  }

  @Get('send-reminders')
  @ApiOperation({ summary: 'Envia lembretes de WhatsApp devidos (Authorization: Bearer CRON_SECRET)' })
  @ApiOkResponse({ type: ReminderRunDto })
  sendReminders(@Headers('authorization') authorization?: string): Promise<ReminderRunDto> {
    return this.runReminders(authorization);
  }

  @Post('send-reminders')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mesmo que o GET (para agendadores que só fazem POST)' })
  @ApiOkResponse({ type: ReminderRunDto })
  sendRemindersPost(@Headers('authorization') authorization?: string): Promise<ReminderRunDto> {
    return this.runReminders(authorization);
  }

  private async reset(authorization?: string): Promise<ResetDemoResultDto> {
    this.authorize(authorization);
    const summary = await resetDemo(this.prisma);
    return { ok: true, appointments: summary.appointments, customers: summary.customers };
  }

  @Post('reset-demo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apaga e recria os dados de demonstração (Authorization: Bearer CRON_SECRET)' })
  @ApiOkResponse({ type: ResetDemoResultDto })
  resetPost(@Headers('authorization') authorization?: string): Promise<ResetDemoResultDto> {
    return this.reset(authorization);
  }

  /** Cron da Vercel faz GET com o CRON_SECRET no header Authorization. */
  @Get('reset-demo')
  @ApiOperation({ summary: 'Mesmo que o POST — usado pelo Cron da Vercel' })
  @ApiOkResponse({ type: ResetDemoResultDto })
  resetGet(@Headers('authorization') authorization?: string): Promise<ResetDemoResultDto> {
    return this.reset(authorization);
  }
}
