# Progresso do Agendaí

Arquivo vivo: o que já foi feito e o que falta. Atualizado ao fim de cada fase.

## Fase 1 — Estrutura + API ✅
- [x] Estrutura do repositório (`apps/api`, `apps/web`, `docker-compose.yml`, `docs/`)
- [x] Prisma (PostgreSQL) com todos os modelos: Business, User, Professional, Service,
      ProfessionalService, WorkingHours, TimeOff, Customer, Appointment
- [x] Migration SQL com `btree_gist` + exclusion constraint (sem agendamento duplo)
- [x] Motor de disponibilidade puro (`availability.engine.ts`) com testes unitários
- [x] Endpoints públicos: negócio, serviços, profissionais, disponibilidade (dia e dias do mês),
      criar agendamento, ver/cancelar/remarcar por token, `.ics`
- [x] Auth do painel (bcryptjs + JWT em cookie httpOnly) com papéis OWNER/PROFESSIONAL
- [x] Painel: dashboard, agenda, agendamento manual, status, serviços, profissionais,
      expediente, bloqueios, clientes, configurações
- [x] Seed idempotente + `/internal/reset-demo` + cron da Vercel
- [x] Swagger em `/docs` (assets por CDN) e `/openapi.json`
- [x] Testes: unitários (motor, status, .ics) e e2e (fluxo, permissões, concorrência 10×)

## Fase 2 — Site público ✅
- [x] Next.js 16 + Tailwind 4 + shadcn/ui (componentes escritos no padrão shadcn), tema escuro com dourado
- [x] Tipos da API gerados do OpenAPI (`npm run gen:api`) + client `openapi-fetch`; rewrite `/api/*`
- [x] Página do negócio, stepper de agendamento (5 etapas), sucesso (.ics, Google Agenda), "Meu agendamento"
      (cancelar/remarcar), estados de carregamento/vazio/erro, mobile-first

## Fase 3 — Painel ✅
- [x] `src/proxy.ts` (Next 16) protege `/admin/*`; login com caixa "Acesso de demonstração"
- [x] Layout com sidebar (Sheet no celular), tema claro/escuro, menu por papel
- [x] Dashboard: métricas, gráfico de 30 dias (Chart/Recharts), serviços mais vendidos, próximos
- [x] Agenda dia (colunas por profissional) e semana, bloqueios, linha do "agora", detalhes com
      confirmar/concluir/faltou/cancelar e "Lembrar no WhatsApp", agendamento manual
- [x] Serviços, Profissionais (expediente multi-intervalo + bloqueios), Clientes (busca, histórico,
      observações), Configurações + feriados (só OWNER)

## Fase 4 — Acabamento
- [ ] Prints 375px/1440px, revisão visual, E2E pelo navegador
- [ ] README completo, CLAUDE.md, guia de deploy (Vercel + Neon)
