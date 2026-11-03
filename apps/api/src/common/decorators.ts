import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { Request } from 'express';

export interface SessionUser {
  userId: string;
  businessId: string;
  role: Role;
  professionalId: string | null;
}

export type AuthedRequest = Request & { user?: SessionUser };

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new Error('CurrentUser usado sem AuthGuard');
  return req.user;
});
