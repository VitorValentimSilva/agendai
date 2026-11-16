# Passo a passo das variáveis de ambiente (Vercel)

Onde colocar: Vercel → projeto → **Settings → Environment Variables** → *Add* (ambiente **Production**) → **Save** →
**Deployments → ⋯ → Redeploy**. Variáveis só valem depois do redeploy.

- Projeto da **API**: `agendai` (`https://agendai-five.vercel.app`)
- Projeto do **site**: `agendai-glev` (`https://agendai-glev.vercel.app`)

Sem as credenciais das integrações (WhatsApp, Mercado Pago, Google) tudo continua funcionando em **modo simulado**.

---

## Já configuradas (base)

| Variável | Projeto | Como gerar |
| --- | --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | API | Neon → *Connection Details*: pooled (`-pooler`) e direta |
| `JWT_SECRET` | API | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | API | `openssl rand -base64 32` (não troque depois: os tokens salvos ficam ilegíveis) |
| `CRON_SECRET` | API | `openssl rand -hex 24` |
| `PROXY_SECRET` | API **e** site (mesmo valor) | `openssl rand -hex 24` |
| `WEB_ORIGIN` | API | URL do site |
| `PUBLIC_API_URL` | API | URL da API |
| `API_URL` | site | URL da API |

---

## 1. Rate limit distribuído — Upstash Redis

`UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (API). A API também aceita `KV_REST_API_URL` / `KV_REST_API_TOKEN`.

1. Vercel → projeto **agendai** (API) → aba **Storage** → **Create Database** → **Upstash** (*Redis*).
2. Plano **Free**; região **Washington, D.C. (us-east-1)** — a mesma das funções da API (`iad1`).
3. **Connect Project** → `agendai` → ambientes Production (e Preview, se quiser).
4. A Vercel cria as variáveis sozinha. Faça **Redeploy**.
5. Conferência: a resposta de `GET /business` traz `X-RateLimit-Remaining` diminuindo entre chamadas,
   mesmo vindas de instâncias diferentes. Se o Redis cair, a API volta sozinha para o contador em memória.

## 2. Lembretes a cada 15 minutos — cron-job.org

Não precisa de variável nova: usa o `CRON_SECRET`.

1. Crie conta grátis em **cron-job.org** → **Create cronjob**.
2. **URL:** `https://agendai-five.vercel.app/internal/send-reminders` · **Method:** GET (POST também funciona).
3. **Execution schedule:** *Every 15 minutes*.
4. **Advanced → Headers → Add:** `Authorization` = `Bearer SEU_CRON_SECRET` (o mesmo valor da Vercel).
5. **Save** → **Test run**: precisa voltar **200** com `{"sent":…,"failed":…,"expired":…}`.
   401 = `CRON_SECRET` diferente.
6. O cron diário da Vercel continua como rede de segurança. Chamadas sobrepostas não duplicam lembretes.

## 3. Pix — Mercado Pago

`MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` (API). Opcional: `ALLOW_SIMULATIONS` (deixe sem definir).

1. **mercadopago.com.br/developers** → **Suas integrações** → **Criar aplicação**
   (solução *Pagamentos online*, produto **Checkout Transparente / API de Pagamentos**).
2. A conta precisa ter **chave Pix cadastrada** (app do Mercado Pago → Pix → Minhas chaves).
3. **Credenciais de produção** → copie o **Access Token** (`APP_USR-…`) → `MP_ACCESS_TOKEN`.
   Para testar antes, use as **credenciais de teste** (`TEST-…`).
4. Na mesma aplicação → **Webhooks → Configurar notificações**:
   - URL de produção: `https://agendai-five.vercel.app/webhooks/mercadopago`
   - Evento: **Pagamentos** → **Salvar**
   - **Assinatura secreta → Revelar** → copie → `MP_WEBHOOK_SECRET`.
5. Redeploy. No painel do negócio: **Configurações → Cobrança** → escolha *Sinal* ou *Total*.
   Cada negócio pode salvar o **próprio** token ali (fica cifrado); sem ele, usa o `MP_ACCESS_TOKEN` da plataforma.
6. Estorno automático (Pix pago depois de expirar com horário ocupado) usa o mesmo token — sem variável extra.
   Se o Mercado Pago recusar, o caso aparece no dashboard em **Pix a estornar**.

## 4. WhatsApp — Cloud API da Meta

`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_REMINDER_TEMPLATE`, `WHATSAPP_WAITLIST_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG` (API).

1. **developers.facebook.com** → **Meus apps → Criar app** → caso de uso *Outro* → tipo **Empresa** →
   vincule seu **portfólio empresarial** (Business Manager).
2. No app → **Adicionar produto → WhatsApp → Configurar**.
3. **WhatsApp → Configuração da API**: adicione um **número real** (o de teste só envia para até 5 números cadastrados)
   e copie o **Identificação do número de telefone** → `WHATSAPP_PHONE_NUMBER_ID`.
4. **Token permanente** → `WHATSAPP_TOKEN`:
   business.facebook.com → **Configurações → Usuários → Usuários do sistema → Adicionar** (Admin) →
   **Atribuir ativos** (o app, controle total) → **Gerar novo token** → app → validade **Nunca** →
   permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
5. **App secret** → `WHATSAPP_APP_SECRET`: no app → **Configurações do app → Básico → Chave secreta do app → Mostrar**.
6. **Verify token** → `WHATSAPP_VERIFY_TOKEN`: você inventa (ex.: `openssl rand -hex 16`).
7. Salve as variáveis acima na Vercel e faça **Redeploy antes** do próximo passo.
8. **WhatsApp → Configuração → Webhook → Editar**: URL `https://agendai-five.vercel.app/webhooks/whatsapp`,
   token = o mesmo `WHATSAPP_VERIFY_TOKEN` → **Verificar e salvar** → em *Campos do webhook*, **Assinar `messages`**.
9. **Templates** (Gerenciador do WhatsApp → **Modelos de mensagem → Criar**), categoria **Utilidade**, idioma **Português (BR)**:
   - **Lembrete** (ex.: `lembrete_agendamento`): corpo com 6 variáveis —
     `Olá, {{1}}! Lembrete do seu horário em {{2}}: {{3}} com {{4}}, {{5}} às {{6}}.` +
     botões de **resposta rápida** `CONFIRMAR` e `CANCELAR`.
   - **Fila de espera** (ex.: `vaga_fila_espera`): 5 variáveis —
     `Oi, {{1}}! Abriu um horário em {{2}} para {{3}} em {{4}}. Agende: {{5}}`.
   - Após aprovados (minutos a 24h): `WHATSAPP_REMINDER_TEMPLATE=lembrete_agendamento`,
     `WHATSAPP_WAITLIST_TEMPLATE=vaga_fila_espera`, `WHATSAPP_TEMPLATE_LANG=pt_BR`.
10. Redeploy. No painel → **Mensagens**, o provedor passa de *Simulado* para *WhatsApp*.

## 5. Google Calendar

`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (API).

1. **console.cloud.google.com** → seletor de projeto → **Novo projeto** ("Agendaí").
2. **APIs e serviços → Biblioteca** → **Google Calendar API** → **Ativar**.
3. **APIs e serviços → Tela de permissão OAuth** (Google Auth Platform): tipo **Externo**, nome *Agendaí*,
   e-mail de suporte; em **Acesso a dados**, adicione os escopos `openid`, `.../auth/userinfo.email` e
   `.../auth/calendar.events`. Em **Público**, adicione os profissionais como **usuários de teste**
   (até 100). Para abrir a qualquer pessoa, **Publicar app** e passar pela verificação do Google (escopo sensível).
4. **Credenciais → Criar credenciais → ID do cliente OAuth** → **Aplicativo da Web**:
   - URI de redirecionamento autorizado: `https://agendai-five.vercel.app/integrations/google/callback`
   - Copie **ID do cliente** → `GOOGLE_CLIENT_ID` e **Chave secreta** → `GOOGLE_CLIENT_SECRET`.
5. Redeploy. No painel → **Profissionais** → *Conectar Google*. A partir daí, os agendamentos vão para a agenda do
   profissional **e** os compromissos pessoais dele (marcados como *Ocupado*) bloqueiam horários no site.

## 6. Domínio próprio e subdomínios (opcional)

`ROOT_DOMAIN` (API) e `NEXT_PUBLIC_ROOT_DOMAIN` (site), mesmo valor.

1. Registre o domínio (ex.: `agendai.com.br` no **registro.br**).
2. Projeto do **site** → **Settings → Domains** → adicione `agendai.com.br` e `*.agendai.com.br`.
   O curinga exige os **nameservers da Vercel**: no registro.br → *Alterar servidores DNS* →
   `ns1.vercel-dns.com` e `ns2.vercel-dns.com` (propagação: até algumas horas).
3. (Opcional) Projeto da **API** → domínio `api.agendai.com.br`; atualize `PUBLIC_API_URL`, `API_URL` (site) e as URLs
   de webhook/redirect do Mercado Pago, Meta e Google.
4. Variáveis: `ROOT_DOMAIN=agendai.com.br` (API), `NEXT_PUBLIC_ROOT_DOMAIN=agendai.com.br` (site) e
   `WEB_ORIGIN=https://agendai.com.br` (API). Redeploy dos dois.
5. Cada negócio fica em `https://SLUG.agendai.com.br`; o link `/n/SLUG` continua valendo.
