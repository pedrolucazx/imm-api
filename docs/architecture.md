# Arquitetura — imm-api

Backend do Inside My Mind. API RESTful construída como monolito modular em Fastify 5, organizada por domínio de negócio.

---

## Visão Geral

```text
                          ┌─────────────────────────────────────┐
                          │              imm-api                 │
                          │                                      │
 imm-web ──── HTTPS ────► │  Fastify 5 (Node.js ESM)            │
                          │  ├── Plugins (cors, jwt, swagger)    │
                          │  ├── Modules (auth, habits, ...)     │
                          │  └── Core (config, db, storage)      │
                          │           │          │          │    │
                          └───────────┼──────────┼──────────┼────┘
                                      │          │          │
                               PostgreSQL    Storage    Resend
                              (Supabase)    Provider   (e-mail)
                                      │
                               AI Provider
                               (padrão: Gemini Flash)
```

---

## Módulos de Domínio

Cada módulo em `src/modules/` é autônomo: possui routes, controller, service e repository próprios. Dependências entre módulos acontecem apenas via service-to-service, nunca cruzando camadas.

### auth

Responsável por todo o ciclo de vida de autenticação.

```
auth/
├── auth.routes.ts                     # POST /auth/login, /register, /refresh, /logout
│                                      # POST /auth/forgot-password, /reset-password
│                                      # POST /auth/verify-email, /resend-verification
├── auth.controller.ts                 # Handlers HTTP — delega para auth.service
├── auth.service.ts                    # Lógica: JWT, hash bcrypt, fluxo de tokens
├── auth.types.ts                      # Tipos Zod e TypeScript
├── email.service.ts                   # Templates HTML + envio via Resend
├── email-verification-tokens.repository.ts
└── password-reset-tokens.repository.ts
```

**Fluxo de autenticação:**

1. `POST /auth/register` → cria usuário com senha hasheada → envia e-mail de verificação
2. `POST /auth/verify-email` → valida token → ativa conta
3. `POST /auth/login` → valida credenciais + conta ativa → retorna `accessToken` (15m) + `refreshToken` (7d, httpOnly cookie)
4. `POST /auth/refresh` → valida refresh token → rotaciona par de tokens
5. `POST /auth/logout` → invalida refresh token no banco

**Fluxo de recuperação de senha:**

1. `POST /auth/forgot-password` → gera token com TTL → envia link por e-mail
2. `POST /auth/reset-password` → valida token (single-use) → atualiza hash

### users

Perfil do usuário, onboarding e exclusão de conta.

```
users/
├── users.routes.ts                    # GET/PUT /users/me, DELETE /users/me
│                                      # GET/PUT /users/me/onboarding
├── users.controller.ts
├── users.service.ts                   # Update de perfil, delete cascade
├── users.repository.ts
├── onboarding.controller.ts
├── onboarding.repository.ts
└── onboarding.service.ts              # Estado do tour (currentStep, completedAt)
```

### habits

Criação de hábitos com ou sem plano de IA, listagem, logging diário.

```
habits/
├── habits.routes.ts                   # GET/POST /habits
│                                      # POST /habits/create-with-plan
│                                      # POST /habits/preview-plan
│                                      # POST /habits/:id/log
├── habits.controller.ts
├── habits.service.ts                  # Regra de negócio: limite de 5, streak, fases
└── habits.repository.ts
```

**Fluxo de criação com plano:**

1. `POST /habits/preview-plan` → chama Habit Planner → retorna prévia (não persiste)
2. Usuário aprova ou envia feedback para regenerar (volta ao passo 1)
3. `POST /habits/create-with-plan` → persiste hábito + plano aprovado

### journal

Entradas de journal com análise de IA.

```
journal/
├── journal.routes.ts                  # POST /journal/entry, GET /journal/entries
│                                      # GET /journal/entries/:date
├── journal.controller.ts
├── journal.service.ts                 # Roteamento para Language Teacher ou Behavioral Coach
└── journal.repository.ts
```

### ai-agents

Orquestração dos três agentes de IA. Não expõe rotas HTTP — é chamado internamente por `habits.service` e `journal.service`. Recebe `TextAIProvider` e `TranscriptionProvider` via injeção de dependência nos `.module.ts`.

```
ai-agents/
├── ai.service.ts                      # Roteador: decide qual agente usar por tipo de hábito
├── habit-planner.ts                   # Agente de planejamento 66 dias
├── language-agent.ts                  # Agente de análise linguística
└── behavioral-agent.ts                # Agente de comportamento e humor
```

### analytics

Métricas agregadas de progresso por usuário.

```
analytics/
├── analytics.routes.ts                # GET /analytics/summary
├── analytics.controller.ts
├── analytics.service.ts               # Cálculo de streak, taxa de conclusão, humor médio
└── analytics.repository.ts            # Queries agregadas no PostgreSQL
```

### pronunciation

Upload de áudio, transcrição e score de pronúncia.

```
pronunciation/
├── pronunciation.routes.ts            # POST /pronunciation/upload-url
│                                      # POST /pronunciation/analyze
│                                      # GET /pronunciation/word-cloud
├── pronunciation.controller.ts
├── pronunciation.service.ts           # Gera URL assinada via Storage Provider → transcreve → calcula score
└── pronunciation.repository.ts
```

**Fluxo de análise de pronúncia:**

1. `POST /pronunciation/upload-url` → gera URL pré-assinada via Storage Provider
2. Frontend faz upload do áudio diretamente para o storage
3. `POST /pronunciation/analyze` → Transcription Provider transcreve o áudio → compara com texto original → calcula score por palavra → persiste entrada

---

## Core

### config

```
core/config/
├── env.ts                             # Schema Zod com todas as variáveis de ambiente
│                                      # Falha com exit(1) se alguma var obrigatória faltar
└── logger.ts                          # Instância Pino com pino-pretty em desenvolvimento
```

A validação do `env.ts` acontece no import — qualquer var ausente ou inválida mata o processo antes de o servidor subir.

### database

```
core/database/
├── connection.ts                      # Pool Drizzle + postgres.js
└── schema/
    ├── users.schema.ts
    ├── user_profiles.schema.ts
    ├── habits.schema.ts
    ├── habit_logs.schema.ts
    ├── journal-entries.schema.ts
    ├── onboarding-sessions.schema.ts
    ├── email-verification-tokens.schema.ts
    ├── password-reset-tokens.schema.ts
    ├── pronunciation.schema.ts
    ├── consents.schema.ts
    └── index.ts                       # Re-export de todos os schemas
```

### ai

```text
core/ai/
├── text-ai.interface.ts               # Interface TextAIProvider (generate)
├── transcription.interface.ts         # Interface TranscriptionProvider (transcribe)
├── errors.ts                          # AIRateLimitError, AITemporaryError
├── with-fallback.ts                   # Wrappers de fallback encadeado entre providers
├── ai.factory.ts                      # createTextAIProvider / getTextAIProvider (singleton lazy)
├── transcription.factory.ts           # createTranscriptionProvider / getTranscriptionProvider
└── providers/
    ├── gemini-text.ts                 # GeminiTextProvider (implementa TextAIProvider)
    └── gemini-transcription.ts        # GeminiTranscriptionProvider (implementa TranscriptionProvider)
```

### storage

```text
core/storage/
├── storage.interface.ts               # Interface StorageProvider (upload, download, delete)
├── storage.factory.ts                 # createStorageProvider / getStorageProvider (singleton lazy)
└── providers/
    └── supabase-storage.ts            # supabaseStorageProvider (implementa StorageProvider)
```

---

## Plugins Fastify

```
plugins/
├── cors.ts                            # @fastify/cors — origens permitidas via CORS_ORIGIN
├── jwt.ts                             # @fastify/jwt — assina e verifica tokens
└── swagger.ts                         # @fastify/swagger + @fastify/swagger-ui em /docs
```

Todos os plugins são registrados em `src/app.ts` antes dos módulos.

---

## Shared

```
shared/
├── constants.ts                       # Constantes globais (MAX_HABITS, MAX_ONBOARDING_STEP, etc.)
├── errors/
│   └── index.ts                       # Classes de erro tipadas (NotFoundError, UnauthorizedError, etc.)
├── guards/
│   └── ai-rate-limit.guard.ts         # Limite diário de requests de IA por usuário
├── types/
│   └── rate-limit.ts
└── utils/
    ├── password.ts                    # bcrypt hash + compare
    └── date.ts                        # Utilitários de timezone e formatação
```

---

## Fluxo de uma Requisição

```
HTTP Request
    │
    ▼
Fastify Router
    │
    ├── Plugin: JWT verification (rotas protegidas)
    ├── Plugin: Rate limit
    │
    ▼
Route Handler (routes.ts)
    │  Valida body/params com Zod schema
    │
    ▼
Controller (controller.ts)
    │  Extrai dados validados, chama service
    │
    ▼
Service (service.ts)
    │  Lógica de negócio, orquestra repositories e clients externos
    │
    ├──► Repository (repository.ts)  ──► PostgreSQL (Drizzle)
    ├──► AI Service                  ──► AI Provider (padrão: Gemini Flash)
    ├──► Email Service               ──► Resend
    └──► Storage Provider            ──► Storage Provider (padrão: Supabase Storage)
    │
    ▼
Response (JSON)
```

---

## Banco de Dados

**PostgreSQL 16** hospedado no Supabase. ORM: **Drizzle**.

### Tabelas principais

| Tabela                      | Descrição                                       |
| --------------------------- | ----------------------------------------------- |
| `users`                     | Conta, email, senha hash, status de verificação |
| `user_profiles`             | Nome, bio, timezone, idioma da interface        |
| `habits`                    | Hábito criado: nome, tipo, plano de IA, status  |
| `habit_logs`                | Registro diário de conclusão por hábito         |
| `journal_entries`           | Texto do journal + feedback de IA + scores      |
| `onboarding_sessions`       | Estado do tour (step atual, completedAt)        |
| `email_verification_tokens` | Tokens de verificação de e-mail (TTL)           |
| `password_reset_tokens`     | Tokens de reset de senha (single-use, TTL)      |
| `pronunciation_entries`     | Score de pronúncia por palavra, URL do áudio    |
| `consents`                  | Consentimento de cookies por usuário            |

### Migrations

As migrations ficam em `src/migrations/` e são aplicadas automaticamente no deploy:

```bash
# Start command Railway
npm run db:migrate && npm start
```

---

## Autenticação

**JWT stateless** com dois tokens:

| Token          | TTL | Armazenamento      | Uso                      |
| -------------- | --- | ------------------ | ------------------------ |
| `accessToken`  | 15m | Memória (frontend) | Autoriza cada requisição |
| `refreshToken` | 7d  | httpOnly cookie    | Renova o par de tokens   |

O refresh token é armazenado no banco (`refresh_tokens`) para permitir revogação no logout. A rotação acontece a cada `/auth/refresh` — o token anterior é invalidado.

---

## Estratégia de Testes

| Suite         | Localização          | O que testa                                            |
| ------------- | -------------------- | ------------------------------------------------------ |
| `unit`        | `tests/unit/`        | Services, repositories e utils em isolamento com mocks |
| `integration` | `tests/integration/` | Queries reais no PostgreSQL via TestContainers         |
| `e2e`         | `tests/e2e/`         | Requisições HTTP completas contra servidor Fastify     |

**Sem mocks de banco** nos testes de integração e e2e — cada suite usa um PostgreSQL real descartável via `@testcontainers/postgresql`. Isso garante que migrations e constraints reais sejam testados.

---

## Rate Limiting

Duas camadas:

1. **Global** (`@fastify/rate-limit`): 100 req/min por IP por padrão (configurável via `RATE_LIMIT_MAX` e `RATE_LIMIT_TIMEWINDOW`)
2. **IA** (`ai-rate-limit.guard.ts`): limite diário de requests de agentes por usuário autenticado, calculado via `habit_logs` — impede abuso dentro da cota gratuita do Gemini
