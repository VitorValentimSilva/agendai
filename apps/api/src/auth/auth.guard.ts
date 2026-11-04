import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { ROLES_KEY, type AuthedRequest, type SessionUser } from '../common/decorators.js';
import { SESSION_COOKIE } from '../common/env.js';
import { PrismaService } from '../common/prisma.service.js';

export const SESSION_AUDIENCE = 'agendai:session';

interface JwtPayload {
  sub: string;
  bid: string;
  role: Role;
  pid: string | null;
}

/** Autentica pelo JWT no cookie httpOnly e aplica @Roles(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Faça login para continuar.');

    let payload: JwtPayload;
    try {
      // A audiência impede usar outros JWTs do sistema (ex.: o "state" do OAuth do Google) como sessão.
      payload = await this.jwt.verifyAsync<JwtPayload>(token, { audience: SESSION_AUDIENCE });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    if (typeof payload.sub !== 'string' || !payload.sub) throw new UnauthorizedException('Sessão inválida.');

    // Papel, negócio e vínculo vêm sempre do banco: mudanças (ou usuário removido) valem na hora,
    // sem esperar o token expirar.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, businessId: true, role: true, professionalId: true },
    });
    if (!dbUser) throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    const user: SessionUser = { userId: dbUser.id, businessId: dbUser.businessId, role: dbUser.role, professionalId: dbUser.professionalId };
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }
    return true;
  }

  static payloadFor(user: SessionUser): JwtPayload {
    return { sub: user.userId, bid: user.businessId, role: user.role, pid: user.professionalId };
  }
}
