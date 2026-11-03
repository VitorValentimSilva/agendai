import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';

/** Controlador do painel: exige sessão (cookie) e documenta no Swagger. */
export function AdminController(tag: string) {
  return applyDecorators(
    UseGuards(AuthGuard),
    ApiCookieAuth(),
    ApiTags(`Painel — ${tag}`),
    ApiUnauthorizedResponse({ description: 'Sem sessão' }),
    ApiForbiddenResponse({ description: 'Sem permissão para o papel atual' }),
  );
}
