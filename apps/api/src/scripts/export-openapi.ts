/** Gera `openapi.json` sem subir o servidor (não precisa de banco). */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { buildOpenApi } from '../setup.js';

const app = await NestFactory.create(AppModule, { logger: false });
const document = buildOpenApi(app);
const out = process.argv[2] ?? 'openapi.json';
writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
await app.close();
console.log(`OpenAPI salvo em ${out}`);
