import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/setup.js';
import { PrismaService } from '../src/common/prisma.service.js';
import { resetDemo } from '../src/demo/demo-data.js';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication({ rawBody: true }));
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const prisma = app.get(PrismaService);
  await resetDemo(prisma);
  return { app, prisma, http: () => request(url) };
}

/** Faz login e devolve o cookie de sessão. */
export async function login(ctx: TestContext, email: string, password = 'demo1234'): Promise<string> {
  const res = await ctx.http().post('/auth/login').send({ email, password }).expect(200);
  const cookies = res.get('Set-Cookie') ?? [];
  const session = cookies.find((c) => c.startsWith('agendai_session='));
  if (!session) throw new Error('Cookie de sessão não retornado');
  return session.split(';')[0]!;
}

/** Procura o primeiro dia (a partir de amanhã) com horário livre para o serviço/profissional. */
export async function findFreeSlot(
  ctx: TestContext,
  serviceId: string,
  professionalId: string,
): Promise<{ date: string; start: string; professionalIds: string[] }> {
  for (let i = 1; i <= 25; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    const res = await ctx.http().get('/availability').query({ serviceId, professionalId, date }).expect(200);
    const slots = res.body.slots as Array<{ start: string; professionalIds: string[] }>;
    if (slots.length > 0) {
      const slot = slots[Math.floor(slots.length / 2)]!;
      return { date, start: slot.start, professionalIds: slot.professionalIds };
    }
  }
  throw new Error('Nenhum horário livre encontrado');
}
