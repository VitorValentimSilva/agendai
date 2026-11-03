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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Faça login para continuar.');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    const user: SessionUser = { userId: payload.sub, businessId: payload.bid, role: payload.role, professionalId: payload.pid };
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
