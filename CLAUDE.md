# CLAUDE.md — Agendaí

Sistema de agendamento online white-label (demo: "Barbearia Navalha de Ouro", fictícia).
Dois apps independentes, sem workspaces e sem pacote compartilhado — cada um faz deploy sozinho.

## Estrutura
- `apps/api` — Nest.js 12 (ESM), Prisma 6, PostgreSQL. Entrypoint `src/app.ts` (convenção da Vercel).
- `apps/web` — Next.js (App Router), Tailwind, shadcn/ui. Fala com a API via rewrite `/api/*`.
- `docs/` — `PROGRESSO.md` (status), `screenshots/`.

## Comandos (API, em `apps/api`)
- `npm run start:dev` — API em http://localhost:3001 (lê `.env`). Swagger: `/docs`.
- `npm test` — unitários (Vitest). `npm run test:e2e` — e2e no banco `agendai_test` (é recriado!).
- `npm run lint` (oxlint type-aware) · `npm run typecheck` · `npm run build`.
- `npx prisma migrate dev` · `npm run db:seed` (recria a demo) · `npm run openapi` (gera `openapi.json`).

## Comandos (web, em `apps/web`)
- `npm run dev` — site em http://localhost:3000 (precisa da API; `API_URL` no `.env.local`).
- `npm run lint` · `npm run typecheck` · `npm run build`.
- `npm run gen:api` — regenera `src/lib/api/schema.d.ts` do OpenAPI (rode após mudar DTOs da API e commite o arquivo).
- `npm run screenshots` / `npm run e2e:browser` — puppeteer-core com `CHROME_PATH` (API + web rodando).

## Web — pontos de atenção (Next 16)
- Middleware se chama `src/proxy.ts`. `cacheComponents` está ligado: não leia `Date.now()`/`new Date()` durante o
  prerender de componentes (use dentro de dados carregados no cliente, efeitos ou `useNow`); `useSearchParams`/`useParams`
  em client components precisam de `<Suspense>` na página.
- Componentes shadcn/ui ficam em `src/components/ui` (escritos à mão; o registry não é acessível nesta máquina).
- Tema por tokens em `src/app/globals.css` (`--gold`, `--primary`...). Datas/moeda via `src/lib/format.ts` (pt-BR, fuso do negócio).
- React Compiler: evite `form.watch()` (use `useWatch`) e `useMemo` manual com dependências instáveis.
- Dados via TanStack Query (`src/hooks/use-public.ts`, `src/hooks/use-admin.ts`) + `unwrap()` de `src/lib/api/client.ts`.

## Convenções
- Imports relativos com sufixo `.js` (ESM/nodenext). TypeScript estrito.
- Datas: tudo em UTC no banco (`timestamptz`); regras no fuso do negócio (`Business.timezone`).
  Use os helpers de `src/availability/availability.engine.ts` (`toLocalDate`, `localMinuteToInstant`, `localDayRange`).
- O motor de disponibilidade é PURO (sem Prisma, recebe `now`). Regra nova de agenda → teste unitário nele.
- Agendamento duplo é barrado pela exclusion constraint `Appointment_no_overlap` (migration SQL);
  o serviço traduz o erro em 409 (`isOverlapViolation`). Não remova a migration.
- Rotas sem prefixo. Públicas em `src/public`, painel em `src/admin` (`@AdminController` + `@Roles`).
  PROFESSIONAL só enxerga/altera a própria agenda — sempre filtre por `user.professionalId`.
- DTOs com class-validator + `@ApiProperty` (o web gera tipos a partir do OpenAPI; mantenha as respostas tipadas).
- Mensagens de erro e textos em pt-BR.
- Testes: Vitest (API compatível com Jest; padrão do Nest 12).

## Git
- Commits pequenos, mensagens em português. Atualize `docs/PROGRESSO.md` ao concluir etapas.
