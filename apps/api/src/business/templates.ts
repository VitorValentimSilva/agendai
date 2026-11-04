/** Modelos iniciais para o cadastro self-service, por segmento. */
export const SEGMENTS = ['barbearia', 'salao', 'clinica', 'estudio'] as const;
export type Segment = (typeof SEGMENTS)[number];

export interface ServiceTemplate {
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
}

const H = (h: number, m = 0) => h * 60 + m;

export const SEGMENT_TEMPLATES: Record<Segment, { label: string; services: ServiceTemplate[] }> = {
  barbearia: {
    label: 'Barbearia',
    services: [
      { name: 'Corte', description: 'Corte na tesoura ou máquina, com finalização.', durationMinutes: 45, priceCents: 5000 },
      { name: 'Barba', description: 'Barba modelada com toalha quente.', durationMinutes: 30, priceCents: 3500 },
      { name: 'Corte + Barba', description: 'O combo completo.', durationMinutes: 75, priceCents: 8000 },
    ],
  },
  salao: {
    label: 'Salão de beleza',
    services: [
      { name: 'Corte feminino', description: 'Corte com lavagem e finalização.', durationMinutes: 60, priceCents: 9000 },
      { name: 'Escova', description: 'Escova modeladora.', durationMinutes: 45, priceCents: 6000 },
      { name: 'Manicure', description: 'Cutilagem e esmaltação.', durationMinutes: 45, priceCents: 4000 },
    ],
  },
  clinica: {
    label: 'Clínica / consultório',
    services: [
      { name: 'Consulta', description: 'Consulta de avaliação.', durationMinutes: 50, priceCents: 20000 },
      { name: 'Retorno', description: 'Consulta de retorno.', durationMinutes: 30, priceCents: 10000 },
    ],
  },
  estudio: {
    label: 'Estúdio (tatuagem, pilates, fotografia...)',
    services: [
      { name: 'Sessão', description: 'Sessão padrão.', durationMinutes: 60, priceCents: 15000 },
      { name: 'Avaliação', description: 'Conversa inicial e orçamento.', durationMinutes: 30, priceCents: 0 },
    ],
  },
};

/** Expediente padrão: segunda a sexta 9h–12h e 13h–18h, sábado 9h–13h. */
export const DEFAULT_WORKING_HOURS: Array<{ weekday: number; startMinute: number; endMinute: number }> = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startMinute: H(9), endMinute: H(12) },
    { weekday, startMinute: H(13), endMinute: H(18) },
  ]),
  { weekday: 6, startMinute: H(9), endMinute: H(13) },
];
