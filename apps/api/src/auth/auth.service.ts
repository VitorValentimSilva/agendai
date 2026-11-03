import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service.js';
import type { SessionUser } from '../common/decorators.js';
import { AuthGuard } from './auth.guard.js';
import type { MeDto } from './auth.dto.js';

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar contas válidas.
const DUMMY_HASH = '$2b$10$uJLseLxIbt6gxIrerZ6cUOWFkTZLlsRkpoiatfJNMGOqIEDSNbk2K';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; me: MeDto }> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { business: true } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('E-mail ou senha incorretos.');

    const session: SessionUser = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      professionalId: user.professionalId,
    };
    const token = await this.jwt.signAsync(AuthGuard.payloadFor(session));
    return { token, me: this.toMe(user) };
  }

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { business: true } });
    if (!user) throw new UnauthorizedException('Sessão inválida.');
    return this.toMe(user);
  }

  private toMe(user: {
    id: string;
    name: string;
    email: string;
    role: 'OWNER' | 'PROFESSIONAL';
    professionalId: string | null;
    businessId: string;
    business: { name: string };
  }): MeDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      professionalId: user.professionalId,
      businessId: user.businessId,
      businessName: user.business.name,
    };
  }
}
