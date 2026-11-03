/**
 * Dados fictícios da demonstração: "Barbearia Navalha de Ouro" (Campinas – SP).
 * Tudo é gerado com datas relativas a "agora", com um gerador pseudoaleatório
 * de semente fixa para o resultado ser estável entre execuções.
 */
import type { AppointmentStatus, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  addCalendarDays,
  localMinuteToInstant,
  toLocalDate,
  weekdayOf,
  type LocalDate,
} from '../availability/availability.engine.js';
import { generateAppointmentCode, generateManageToken } from '../common/ids.js';

export const DEMO_SLUG = 'navalha-de-ouro';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_OWNER_EMAIL = 'demo@agendai.app';
export const DEMO_BARBER_EMAIL = 'barbeiro@agendai.app';
const TZ = 'America/Sao_Paulo';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVICES = [
  { key: 'corte', name: 'Corte', description: 'Corte na tesoura ou máquina, com lavagem e finalização.', durationMinutes: 45, priceCents: 5500 },
  { key: 'barba', name: 'Barba', description: 'Barba modelada com toalha quente e navalha.', durationMinutes: 30, priceCents: 4000 },
  { key: 'combo', name: 'Corte + Barba', description: 'O combo completo da casa, com toalha quente.', durationMinutes: 75, priceCents: 8500 },
  { key: 'sobrancelha', name: 'Sobrancelha', description: 'Alinhamento na navalha ou pinça.', durationMinutes: 15, priceCents: 2000 },
  { key: 'pigmentacao', name: 'Pigmentação', description: 'Pigmentação de barba ou cabelo para cobrir falhas.', durationMinutes: 40, priceCents: 4500 },
  { key: 'pezinho', name: 'Pezinho', description: 'Acabamento do contorno entre um corte e outro.', durationMinutes: 15, priceCents: 2000 },
] as const;

type ServiceKey = (typeof SERVICES)[number]['key'];

const H = (h: number, m = 0) => h * 60 + m;

const PROFESSIONALS: Array<{
  key: string;
  name: string;
  bio: string;
  services: ServiceKey[];
  hours: Array<[weekday: number, start: number, end: number]>;
}> = [
  {
    key: 'rafael',
    name: 'Rafael Montes',
    bio: 'Barbeiro há 12 anos, especialista em degradê e navalhado.',
    services: ['corte', 'barba', 'combo', 'sobrancelha', 'pigmentacao', 'pezinho'],
    hours: [2, 3, 4, 5, 6].flatMap((d): Array<[number, number, number]> => [
      [d, H(9), H(12)],
      [d, H(13), H(19)],
    ]),
  },
  {
    key: 'diego',
    name: 'Diego Albuquerque',
    bio: 'Cortes clássicos e barba terapia. Atende com hora marcada.',
    services: ['corte', 'barba', 'combo', 'pezinho'],
    hours: [
      ...[1, 2, 3, 4, 5].flatMap((d): Array<[number, number, number]> => [
        [d, H(10), H(14)],
        [d, H(15), H(20)],
      ]),
      [6, H(9), H(14)],
    ],
  },
  {
    key: 'lucas',
    name: 'Lucas Ferraz',
    bio: 'Freestyle, pigmentação e tendências. Atende até mais tarde.',
    services: ['corte', 'barba', 'combo', 'sobrancelha', 'pigmentacao', 'pezinho'],
    hours: [
      ...[2, 3, 4, 5].map((d): [number, number, number] => [d, H(13), H(21)]),
      [6, H(8), H(16)],
    ],
  },
];

const FIRST = ['João', 'Pedro', 'Gabriel', 'Matheus', 'Lucas', 'Gustavo', 'Felipe', 'Bruno', 'Thiago', 'André', 'Rodrigo', 'Henrique',
  'Vinícius', 'Leonardo', 'Caio', 'Eduardo', 'Marcelo', 'Ricardo', 'Fernando', 'Daniel', 'Samuel', 'Igor', 'Otávio', 'Renato',
  'Paulo', 'Murilo', 'Arthur', 'Heitor', 'Davi', 'Enzo', 'Bernardo', 'Vitor', 'Fábio', 'César', 'Alexandre', 'Rafael', 'Wesley',
  'Juliano', 'Márcio', 'Diego'];
const LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Carvalho', 'Ribeiro', 'Almeida', 'Costa', 'Gomes',
  'Martins', 'Araújo', 'Barbosa', 'Rocha', 'Dias', 'Teixeira', 'Moreira', 'Mendes', 'Nunes', 'Cardoso', 'Freitas', 'Campos'];

const NOTES = [null, null, null, 'Prefere máquina 2 nas laterais.', 'Alergia a pós-barba com álcool.', 'Cliente desde a inauguração.', null];

export interface SeedSummary {
  businessId: string;
  services: number;
  professionals: number;
  customers: number;
  appointments: number;
}

/** Apaga os dados do negócio demo (se existirem) e recria tudo relativo a `now`. */
export async function resetDemo(prisma: PrismaClient, now = new Date()): Promise<SeedSummary> {
  const rand = mulberry32(20261103);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

  // Remove o negócio demo (cascata nos dados ligados a ele).
  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { business: { slug: DEMO_SLUG } } }),
    prisma.user.deleteMany({ where: { OR: [{ business: { slug: DEMO_SLUG } }, { email: { in: [DEMO_OWNER_EMAIL, DEMO_BARBER_EMAIL] } }] } }),
    prisma.business.deleteMany({ where: { slug: DEMO_SLUG } }),
  ]);

  const business = await prisma.business.create({
    data: {
      name: 'Barbearia Navalha de Ouro',
      slug: DEMO_SLUG,
      description:
        'Barbearia clássica no coração do Cambuí. Corte, barba e aquele café enquanto você espera. Agende online em menos de um minuto.',
      phone: '(19) 3232-0000',
      whatsapp: '5519990000000',
      email: 'contato@navalhadeouro.example',
      instagram: 'navalhadeouro.demo',
      addressLine: 'Rua Fictícia dos Barbeiros, 123 — Cambuí',
      city: 'Campinas',
      state: 'SP',
      timezone: TZ,
      slotIntervalMinutes: 15,
      minAdvanceMinutes: 60,
      maxAdvanceDays: 30,
      cancellationPolicyHours: 2,
    },
  });

  const services = new Map<ServiceKey, { id: string; durationMinutes: number; priceCents: number }>();
  for (const [index, s] of SERVICES.entries()) {
    const created = await prisma.service.create({
      data: {
        businessId: business.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
        sortOrder: index,
      },
    });
    services.set(s.key, created);
  }

  const professionals: Array<{ id: string; key: string; services: ServiceKey[]; hours: Array<[number, number, number]> }> = [];
  for (const [index, p] of PROFESSIONALS.entries()) {
    const created = await prisma.professional.create({
      data: {
        businessId: business.id,
        name: p.name,
        bio: p.bio,
        sortOrder: index,
        services: { create: p.services.map((k) => ({ serviceId: services.get(k)!.id })) },
        workingHours: { create: p.hours.map(([weekday, startMinute, endMinute]) => ({ weekday, startMinute, endMinute })) },
      },
    });
    professionals.push({ id: created.id, key: p.key, services: p.services, hours: p.hours });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.createMany({
    data: [
      { businessId: business.id, name: 'Carlos Andrade', email: DEMO_OWNER_EMAIL, passwordHash, role: 'OWNER' },
      {
        businessId: business.id,
        name: 'Rafael Montes',
        email: DEMO_BARBER_EMAIL,
        passwordHash,
        role: 'PROFESSIONAL',
        professionalId: professionals[0]!.id,
      },
    ],
  });

  // Clientes
  const customers: string[] = [];
  const usedNames = new Set<string>();
  while (customers.length < 40) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    const n = customers.length;
    const c = await prisma.customer.create({
      data: {
        businessId: business.id,
        name,
        whatsapp: `55199${String(81000000 + n * 7919).padStart(8, '0')}`,
        email: rand() < 0.45 ? `${name.split(' ')[0]!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${n}@email.example` : null,
        notes: pick(NOTES),
      },
    });
    customers.push(c.id);
  }

  // Bloqueios
  const today = toLocalDate(now, TZ);
  const holiday = nextWeekday(addCalendarDays(today, 9), 3); // uma quarta, ~10 dias à frente
  const rafaelOff = nextWeekday(addCalendarDays(today, 4), 5); // uma sexta à frente
  const lucasCourse = nextWeekday(addCalendarDays(today, -12), 4); // uma quinta passada
  const timeOffs = [
    { professionalId: null, start: localMinuteToInstant(holiday, 0, TZ), end: localMinuteToInstant(addCalendarDays(holiday, 1), 0, TZ), reason: 'Feriado municipal (fictício)' },
    { professionalId: professionals[0]!.id, start: localMinuteToInstant(rafaelOff, H(13), TZ), end: localMinuteToInstant(rafaelOff, H(19), TZ), reason: 'Consulta médica' },
    { professionalId: professionals[2]!.id, start: localMinuteToInstant(lucasCourse, 0, TZ), end: localMinuteToInstant(addCalendarDays(lucasCourse, 1), 0, TZ), reason: 'Curso de colorimetria' },
  ];
  await prisma.timeOff.createMany({
    data: timeOffs.map((t) => ({ businessId: business.id, professionalId: t.professionalId, startsAt: t.start, endsAt: t.end, reason: t.reason })),
  });

  // Agendamentos: últimos 30 dias e próximos 14
  const weights: Array<[ServiceKey, number]> = [
    ['corte', 34], ['combo', 24], ['barba', 16], ['pezinho', 9], ['sobrancelha', 9], ['pigmentacao', 8],
  ];
  const pickService = (allowed: ServiceKey[]): ServiceKey => {
    const pool = weights.filter(([k]) => allowed.includes(k));
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [k, w] of pool) {
      r -= w;
      if (r <= 0) return k;
    }
    return pool[0]![0];
  };

  const rows: Array<{
    serviceId: string; professionalId: string; customerId: string; startsAt: Date; endsAt: Date;
    priceCents: number; status: AppointmentStatus; source: 'ONLINE' | 'MANUAL'; canceledAt: Date | null; createdAt: Date;
  }> = [];
  const blocked = (proId: string, start: Date, end: Date) =>
    timeOffs.some((t) => (t.professionalId === null || t.professionalId === proId) && start < t.end && t.start < end);

  for (let offset = -30; offset <= 14; offset++) {
    const day = addCalendarDays(today, offset);
    const weekday = weekdayOf(day);
    // Ocupação: passado ~60%, sexta/sábado mais cheios, futuro vai esvaziando.
    const base = offset < 0 ? 0.58 : offset === 0 ? 0.55 : Math.max(0.12, 0.5 - offset * 0.03);
    const fill = Math.min(0.85, base + (weekday === 5 || weekday === 6 ? 0.15 : 0));

    for (const pro of professionals) {
      for (const [wd, start, end] of pro.hours.filter(([wd]) => wd === weekday)) {
        void wd;
        let cursor = start;
        while (cursor < end) {
          const key = pickService(pro.services);
          const svc = services.get(key)!;
          if (cursor + svc.durationMinutes > end) break;
          const startsAt = localMinuteToInstant(day, cursor, TZ);
          const endsAt = localMinuteToInstant(day, cursor + svc.durationMinutes, TZ);
          if (rand() < fill && !blocked(pro.id, startsAt, endsAt)) {
            const isPast = endsAt <= now;
            const r = rand();
            let status: AppointmentStatus;
            if (isPast) status = r < 0.82 ? 'COMPLETED' : r < 0.9 ? 'NO_SHOW' : 'CANCELED';
            else if (startsAt <= now) status = 'CONFIRMED';
            else status = r < 0.45 ? 'SCHEDULED' : r < 0.92 ? 'CONFIRMED' : 'CANCELED';
            const createdAt = new Date(startsAt.getTime() - (1 + Math.floor(rand() * 6)) * 86_400_000);
            rows.push({
              serviceId: svc.id,
              professionalId: pro.id,
              customerId: pick(customers),
              startsAt,
              endsAt,
              priceCents: svc.priceCents,
              status,
              source: rand() < 0.72 ? 'ONLINE' : 'MANUAL',
              canceledAt: status === 'CANCELED' ? new Date(Math.min(now.getTime(), startsAt.getTime() - 3_600_000)) : null,
              createdAt: createdAt > now ? now : createdAt,
            });
            cursor += svc.durationMinutes;
          } else {
            cursor += 15 * (1 + Math.floor(rand() * 3));
          }
          // Arredonda para a grade de 15 minutos
          cursor = Math.ceil(cursor / 15) * 15;
        }
      }
    }
  }

  const codes = new Set<string>();
  await prisma.appointment.createMany({
    data: rows.map((r) => {
      let code = generateAppointmentCode();
      while (codes.has(code)) code = generateAppointmentCode();
      codes.add(code);
      return { ...r, businessId: business.id, code, manageToken: generateManageToken() };
    }),
  });

  return {
    businessId: business.id,
    services: services.size,
    professionals: professionals.length,
    customers: customers.length,
    appointments: rows.length,
  };
}

function nextWeekday(from: LocalDate, weekday: number): LocalDate {
  const diff = (weekday - weekdayOf(from) + 7) % 7;
  return addCalendarDays(from, diff);
}
