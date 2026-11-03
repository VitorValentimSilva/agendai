/** `npm run db:seed` — recria os dados de demonstração (apaga os existentes do negócio demo). */
import { PrismaClient } from '@prisma/client';
import { resetDemo } from './demo-data.js';

const prisma = new PrismaClient();
try {
  const summary = await resetDemo(prisma);
  console.log('✔ Dados de demonstração criados:', summary);
} finally {
  await prisma.$disconnect();
}
