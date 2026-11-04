import { Controller, Get, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { safeEqual } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { resetDemo } from '../demo/demo-data.js';

class ResetDemoResultDto {
  @ApiProperty() ok: boolean;
  @ApiProperty() appointments: number;
  @ApiProperty() customers: number;
}


@ApiTags('Interno')
@ApiBearerAuth()
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  private async reset(authorization?: string): Promise<ResetDemoResultDto> {
    const secret = env.cronSecret;
    if (!secret || !authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
      throw new UnauthorizedException();
    }
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
