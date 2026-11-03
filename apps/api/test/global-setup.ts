import { execSync } from 'node:child_process';

/**
 * Prepara o banco de TESTES (agendai_test): limpa o schema e aplica todas as
 * migrations, incluindo a exclusion constraint.
 */
export default function setup(): void {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/agendai_test?schema=public';
  if (!/agendai_test|_test\b|test/.test(url)) {
    throw new Error(`Recusando limpar um banco que não parece ser de testes: ${url}`);
  }
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync('npx prisma db execute --stdin --schema prisma/schema.prisma', {
    input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    stdio: ['pipe', 'inherit', 'inherit'],
    env,
  });
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
}
