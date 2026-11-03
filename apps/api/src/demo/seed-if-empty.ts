/** Usado no build da Vercel: só popula o banco se ele estiver vazio. */
import { PrismaClient } from '@prisma/client';
import { resetDemo } from './demo-data.js';

const prisma = new PrismaClient();
try {
  const count = await prisma.business.count();
  if (count > 0) {
    console.log(`Banco já possui ${count} negócio(s); seed ignorado.`);
  } else {
    const summary = await resetDemo(prisma);
    console.log('✔ Banco vazio populado com dados de demonstração:', summary);
  }
} finally {
  await prisma.$disconnect();
}
