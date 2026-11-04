/**
 * Entrypoint da API. O nome `src/app.ts` segue a convenção que a Vercel
 * reconhece automaticamente para projetos NestJS (zero configuration).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './setup.js';
import { env } from './common/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  configureApp(app);
  await app.listen(env.port);
}

// Sem top-level await: a Vercel carrega este arquivo com require(), que não aceita
// módulos ESM com await no topo (ERR_REQUIRE_ASYNC_MODULE).
bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar a API', error);
  process.exit(1);
});
