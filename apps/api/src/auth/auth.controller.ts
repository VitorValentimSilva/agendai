import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, CookieOptions } from 'express';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { env, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../common/env.js';
import { AuthGuard } from './auth.guard.js';
import { LoginDto, MeDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

function cookieOptions(): CookieOptions {
  return { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: '/' };
}

@ApiTags('Painel — autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: MeDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const { token, me } = await this.auth.login(dto.email, dto.password);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
    return me;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: SessionUser): Promise<MeDto> {
    return this.auth.me(user.userId);
  }
}
