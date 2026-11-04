import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service.js';
import type { SessionUser } from '../common/decorators.js';
import { AuthGuard } from './auth.guard.js';
import type { MeDto, SignupDto } from './auth.dto.js';
import { normalizeSlug, RESERVED_SLUGS } from '../common/tenant.js';
import { normalizeWhatsapp } from '../common/phone.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { DEFAULT_WORKING_HOURS, SEGMENT_TEMPLATES } from '../business/templates.js';

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

  async signup(dto: SignupDto): Promise<{ token: string; me: MeDto }> {
    const reason = await this.slugProblem(dto.slug);
    if (reason) throw new ConflictException(reason);
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('Já existe uma conta com este e-mail. Faça login.');
    }

    const template = SEGMENT_TEMPLATES[dto.segment];
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const whatsapp = normalizeWhatsapp(dto.whatsapp);

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: dto.businessName,
            slug: dto.slug,
            description: `Agende seu horário em ${dto.businessName} em menos de um minuto, a qualquer hora.`,
            segment: dto.segment,
            phone: dto.whatsapp,
            whatsapp,
            email: dto.email,
            addressLine: dto.addressLine,
            city: dto.city,
            state: dto.state,
            slotIntervalMinutes: 15,
          },
        });
        const services = await Promise.all(
          template.services.map((svc, index) =>
            tx.service.create({ data: { ...svc, businessId: business.id, sortOrder: index } }),
          ),
        );
        // O dono também atende (pode desativar depois em Profissionais)
        const professional = await tx.professional.create({
          data: {
            businessId: business.id,
            name: dto.ownerName,
            services: { create: services.map((svc) => ({ serviceId: svc.id })) },
            workingHours: { create: DEFAULT_WORKING_HOURS },
          },
        });
        return tx.user.create({
          data: {
            businessId: business.id,
            professionalId: professional.id,
            name: dto.ownerName,
            email: dto.email,
            passwordHash,
            role: 'OWNER',
          },
          include: { business: true },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Endereço ou e-mail já em uso. Tente outro.');
      throw error;
    }

    const session: SessionUser = { userId: user.id, businessId: user.businessId, role: user.role, professionalId: user.professionalId };
    const token = await this.jwt.signAsync(AuthGuard.payloadFor(session));
    return { token, me: this.toMe(user) };
  }

  /** Motivo pelo qual o slug não pode ser usado (ou null se estiver livre). */
  async slugProblem(raw: string): Promise<string | null> {
    const slug = normalizeSlug(raw);
    if (!slug) return 'Use de 1 a 40 caracteres: letras minúsculas, números e hífen.';
    if (RESERVED_SLUGS.has(slug)) return 'Este endereço é reservado. Escolha outro.';
    const taken = await this.prisma.business.count({ where: { slug } });
    return taken ? 'Este endereço já está em uso. Escolha outro.' : null;
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
    business: { name: string; slug: string; timezone: string };
  }): MeDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      professionalId: user.professionalId,
      businessId: user.businessId,
      businessName: user.business.name,
      businessSlug: user.business.slug,
      businessTimezone: user.business.timezone,
    };
  }
}
