import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response, CookieOptions } from 'express';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { env, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../common/env.js';
import { AuthGuard } from './auth.guard.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { LoginDto, MeDto, SignupDto, SlugAvailabilityDto } from './auth.dto.js';
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
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10 })
  @ApiOkResponse({ type: MeDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const { token, me } = await this.auth.login(dto.email, dto.password);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
    return me;
  }

  @Post('signup')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, ttlMs: 60 * 60_000 })
  @ApiOperation({ summary: 'Cadastro self-service: cria o negócio, o dono e serviços iniciais' })
  @ApiCreatedResponse({ type: MeDto })
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const { token, me } = await this.auth.signup(dto);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
    return me;
  }

  @Get('slug-available')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Verifica se o endereço (slug) está livre' })
  @ApiOkResponse({ type: SlugAvailabilityDto })
  async slugAvailable(@Query('slug') slug: string = ''): Promise<SlugAvailabilityDto> {
    const reason = await this.auth.slugProblem(slug);
    return { slug: slug.trim().toLowerCase(), available: reason === null, reason };
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
