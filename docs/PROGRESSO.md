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

## Fase 2 — Site público
- [ ] Next.js + Tailwind + shadcn/ui, tema escuro com dourado
- [ ] Página do negócio, stepper de agendamento, sucesso, "Meu agendamento"

## Fase 3 — Painel
- [ ] Login com acesso de demonstração, layout, dashboard, agenda, cadastros, clientes, configurações

## Fase 4 — Acabamento
- [ ] Prints 375px/1440px, revisão visual, E2E pelo navegador
- [ ] README completo, CLAUDE.md, guia de deploy (Vercel + Neon)
