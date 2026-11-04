import { BadRequestException, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { RateLimitGuard } from '../common/rate-limit.js';
import { env } from '../common/env.js';
import { AdminController } from '../admin/admin.decorator.js';
import { CalendarService } from './calendar.service.js';

class UrlDto {
  @ApiProperty({ type: String, nullable: true }) url: string | null;
}

@ApiTags('Agenda (feed)')
@UseGuards(RateLimitGuard)
@Controller()
export class CalendarPublicController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('calendar/:file')
  @ApiOperation({ summary: 'Feed iCal do profissional (assinar no Google Agenda/Apple/Outlook)' })
  @ApiProduces('text/calendar')
  async feed(@Param('file') file: string, @Res() res: Response): Promise<void> {
    const token = file.replace(/\.ics$/, '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new BadRequestException('Link inválido.');
    const content = await this.calendar.feed(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(content);
  }

  /** Retorno do OAuth do Google → volta para o painel. */
  @Get('integrations/google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    const back = new URL('/admin/agenda', env.webOrigin);
    try {
      if (error || !code || !state) throw new Error(error ?? 'Resposta incompleta do Google.');
      await this.calendar.googleCallback(code, state);
      back.searchParams.set('google', 'ok');
    } catch (e) {
      back.searchParams.set('google', 'erro');
      back.searchParams.set('motivo', e instanceof Error ? e.message.slice(0, 120) : 'erro');
    }
    res.redirect(302, back.toString());
  }
}

@AdminController('agenda externa')
@Controller('admin/professionals/:id')
export class CalendarAdminController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('calendar-feed')
  @ApiOperation({ summary: 'Link do feed iCal (null se desativado)' })
  @ApiOkResponse({ type: UrlDto })
  async getFeed(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<UrlDto> {
    return { url: await this.calendar.feedUrlFor(user, id) };
  }

  @Post('calendar-feed')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gera um novo link do feed iCal (o anterior deixa de funcionar)' })
  @ApiOkResponse({ type: UrlDto })
  async enableFeed(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<UrlDto> {
    return { url: await this.calendar.enableFeed(user, id) };
  }

  @Delete('calendar-feed')
  @HttpCode(204)
  @ApiNoContentResponse()
  async disableFeed(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.calendar.disableFeed(user, id);
  }

  @Get('google/connect')
  @ApiOperation({ summary: 'URL para conectar o Google Calendar do profissional (OAuth)' })
  @ApiOkResponse({ type: UrlDto })
  async googleConnect(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<UrlDto> {
    return { url: await this.calendar.googleConnectUrl(user, id) };
  }

  @Delete('google')
  @HttpCode(204)
  @ApiNoContentResponse()
  async googleDisconnect(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.calendar.googleDisconnect(user, id);
  }
}
