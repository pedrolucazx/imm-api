# imm-api

> Backend do **Inside My Mind** — rastreamento de hábitos com orquestração de agentes de IA.

[![CI](https://github.com/pedrolucazx/imm-api/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/pedrolucazx/imm-api/actions/workflows/ci.yml)

![Fastify](https://img.shields.io/badge/Fastify_5-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger_UI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

---

## Índice

- [O que é Inside My Mind?](#o-que-é-inside-my-mind)
- [Agentes de IA](#agentes-de-ia)
- [Arquitetura](#arquitetura) · [Documento completo](docs/architecture.md)
- [Stack de Tecnologias](#stack-de-tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Como Começar](#como-começar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados](#banco-de-dados)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Testes](#testes)
- [Pipeline CI/CD](#pipeline-cicd)
- [Deployment](#deployment)
- [Estratégia de Branches](#estratégia-de-branches)
- [Contribuindo](#contribuindo)

---

## O que é Inside My Mind?

**Inside My Mind** é uma aplicação de rastreamento de hábitos que usa IA para gerar feedback personalizado. O usuário registra seu progresso diário, escreve sobre sua experiência e recebe análise de um dos três agentes especializados: um planejador de hábitos, um professor de idiomas ou um coach comportamental.

É um projeto de código aberto, feito para aprendizado e portfólio, 100% gratuito e sem funcionalidades bloqueadas.

---

## Agentes de IA

A API orquestra três agentes especializados, cada um ativado por tipo de hábito. O provider de IA é configurável via `AI_PROVIDER` (padrão: Google Gemini Flash):

- **Habit Planner**: gera um plano de 66 dias com fases progressivas ao criar um novo hábito; suporta regeneração com feedback do usuário
- **Language Teacher**: avalia gramática, vocabulário e fluência nas entradas de hábitos de idiomas; aceita áudio gravado pelo usuário, transcreve via provider configurável (`TRANSCRIPTION_PROVIDER`) e retorna score de pronúncia com lista de palavras corretas e erradas
- **Behavioral Coach**: identifica padrões de humor e sugere micro-ações para hábitos comportamentais

Usando o Gemini Flash como provider padrão, todos os agentes rodam dentro das cotas gratuitas do modelo — sem custo para o usuário.

---

## Arquitetura

```text
imm-web (Next.js) ──► imm-api (Fastify) ──► PostgreSQL 16 (Supabase)
                                       ├──► AI Provider (padrão: Google Gemini Flash)
                                       ├──► Storage Provider (padrão: Supabase Storage)
                                       └──► Resend (e-mails transacionais)
```

`imm-api` é o backend da plataforma. Expõe uma API RESTful consumida exclusivamente por [`imm-web`](https://github.com/pedrolucazx/imm-web). Segue um monolito modular organizado por domínio — cada módulo em `src/modules/` possui suas próprias routes, controller, service e repository. A API é documentada via Swagger UI em `/docs`.

---

## Stack de Tecnologias

| Camada              | Tecnologia                                                          |
| ------------------- | ------------------------------------------------------------------- |
| Runtime             | Node.js (ESM)                                                       |
| Framework           | Fastify 5                                                           |
| Linguagem           | TypeScript 5                                                        |
| Banco de Dados      | PostgreSQL 16 (Supabase)                                            |
| ORM                 | Drizzle ORM                                                         |
| Validação           | Zod 4                                                               |
| Autenticação        | JWT — access + refresh tokens (`@fastify/jwt`)                      |
| E-mail              | Resend                                                              |
| Documentação da API | Swagger UI (`@fastify/swagger` + `@fastify/swagger-ui`)             |
| Integração com IA   | Provider plugável via `AI_PROVIDER` (padrão: Google Gemini Flash)   |
| Storage             | Provider plugável via `STORAGE_PROVIDER` (padrão: Supabase Storage) |
| Logging             | Pino + pino-pretty                                                  |
| Containerização     | Docker + Docker Compose                                             |
| Deployment          | Railway                                                             |

---

## Estrutura do Projeto

```text
imm-api/
├── src/
│   ├── modules/                          # Feature modules (uma pasta por domínio)
│   │   ├── auth/                         # Autenticação completa
│   │   │   ├── auth.controller.ts        # Login, register, refresh, logout
│   │   │   ├── auth.routes.ts            # Rotas + schemas Zod/Swagger
│   │   │   ├── auth.service.ts           # Lógica: JWT, hash, verificação
│   │   │   ├── auth.types.ts
│   │   │   ├── email.service.ts          # Templates e envio via Resend
│   │   │   ├── email-verification-tokens.repository.ts
│   │   │   └── password-reset-tokens.repository.ts
│   │   ├── users/                        # Perfil, onboarding e exclusão de conta
│   │   │   ├── users.controller.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── users.service.ts
│   │   │   ├── onboarding.controller.ts
│   │   │   ├── onboarding.repository.ts
│   │   │   └── onboarding.service.ts
│   │   ├── habits/                       # Criação, listagem, logging diário
│   │   ├── journal/                      # Entradas de journal + feedback de IA
│   │   ├── ai-agents/                    # Orquestração dos três agentes de IA
│   │   ├── analytics/                    # Métricas de progresso e streaks
│   │   ├── pronunciation/                # Upload de áudio, transcrição e score
│   │   └── health/                       # Health check endpoint
│   ├── core/
│   │   ├── config/                       # Env validation (Zod) e logger (Pino)
│   │   ├── database/                     # Drizzle connection e schema definitions
│   │   │   └── schema/                   # Uma tabela por arquivo
│   │   ├── ai/                           # Interfaces, factories e providers de IA
│   │   └── storage/                      # Interface, factory e providers de storage
│   ├── plugins/                          # Plugins Fastify (cors, jwt, swagger)
│   ├── shared/
│   │   ├── constants.ts
│   │   ├── errors/                       # Error classes tipadas
│   │   ├── guards/                       # Rate limit de IA
│   │   ├── types/
│   │   └── utils/                        # password hash, date utils
│   ├── migrations/                       # Drizzle SQL migrations
│   └── index.ts                          # Entry point
├── tests/
│   ├── __setup__/                        # Setup global (env, mocks)
│   ├── unit/                             # Testes unitários (sem I/O)
│   ├── integration/                      # Testes com DB real (TestContainers)
│   └── e2e/                              # Testes HTTP end-to-end
├── scripts/
│   ├── db-wipe.ts                        # Drop e recria o schema público
│   └── db-seed-local.ts                  # Seed para desenvolvimento local
├── .github/workflows/
│   ├── ci.yml                            # Code quality + testes
│   └── cd-railway.yml                    # Health check pós-deploy Railway
├── .env.example
├── docker-compose.yml                    # PostgreSQL local
├── drizzle.config.ts
├── jest.config.cjs
├── railway.toml                          # Start command Railway
└── tsconfig.json
```

---

## Pré-requisitos

- **Node.js** >= 20
- **npm** >= 10
- **Docker** + **Docker Compose** (para PostgreSQL local)
- **Git**

---

## Como Começar

```bash
# 1. Clone o repositório
git clone git@github.com:pedrolucazx/imm-api.git
cd imm-api

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Preencha os valores — veja a seção Variáveis de Ambiente

# 4. Suba banco local + migrations + seed de dados de exemplo
npm run db:start

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

- API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/docs`

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure os valores:

```env
# Aplicação
NODE_ENV=development
PORT=3001
API_HOST=localhost:3001
LOG_LEVEL=info

# CORS
CORS_ORIGIN=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev

# JWT
JWT_SECRET=sua-super-chave-secreta-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Seleção de providers (suportam lista separada por vírgula para fallback)
AI_PROVIDER=gemini                # gemini | (futuros: openai, anthropic)
TRANSCRIPTION_PROVIDER=gemini     # gemini | (futuros: whisper)
STORAGE_PROVIDER=supabase         # supabase | (futuros: s3, r2)

# Gemini (obrigatório se AI_PROVIDER ou TRANSCRIPTION_PROVIDER inclui "gemini")
# Google AI Studio — https://aistudio.google.com/apikey
GEMINI_API_KEY=sua-chave-api-gemini

# Supabase Storage (obrigatório se STORAGE_PROVIDER inclui "supabase")
# https://supabase.com/dashboard
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
SUPABASE_STORAGE_BUCKET=avatars
SUPABASE_AUDIO_BUCKET=audio-entries

# E-mail (Resend — https://resend.com)
RESEND_API_KEY=re_your_resend_api_key
APP_URL=http://localhost:3000

# Rate Limiting (opcional)
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000
```

| Variável                    | Obrigatória                                                | Descrição                                          |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`              | Sim                                                        | String de conexão PostgreSQL                       |
| `JWT_SECRET`                | Sim                                                        | Segredo JWT (mín. 32 chars)                        |
| `JWT_ACCESS_EXPIRES`        | Sim                                                        | TTL do access token (ex: `15m`)                    |
| `JWT_REFRESH_EXPIRES`       | Sim                                                        | TTL do refresh token (ex: `7d`)                    |
| `CORS_ORIGIN`               | Sim                                                        | Origem(ns) do frontend permitidas                  |
| `RESEND_API_KEY`            | Sim                                                        | API key Resend para e-mails transacionais          |
| `APP_URL`                   | Sim                                                        | URL base do frontend (usado nos links dos e-mails) |
| `AI_PROVIDER`               | Não (padrão: `gemini`)                                     | Provider de IA; lista CSV para fallback            |
| `TRANSCRIPTION_PROVIDER`    | Não (padrão: `gemini`)                                     | Provider de transcrição; lista CSV para fallback   |
| `STORAGE_PROVIDER`          | Não (padrão: `supabase`)                                   | Provider de storage; lista CSV para fallback       |
| `GEMINI_API_KEY`            | Se `AI_PROVIDER` ou `TRANSCRIPTION_PROVIDER` inclui gemini | API key do Google Gemini                           |
| `SUPABASE_URL`              | Se `STORAGE_PROVIDER` inclui `supabase`                    | URL do projeto Supabase                            |
| `SUPABASE_SERVICE_ROLE_KEY` | Se `STORAGE_PROVIDER` inclui `supabase`                    | Chave service role do Supabase                     |
| `SUPABASE_STORAGE_BUCKET`   | Não (padrão: `avatars`)                                    | Bucket para avatares                               |
| `SUPABASE_AUDIO_BUCKET`     | Não (padrão: `audio-entries`)                              | Bucket para áudios                                 |
| `LOG_LEVEL`                 | Não (padrão: `info`)                                       | Nível de log Pino                                  |
| `RATE_LIMIT_MAX`            | Não (padrão: `100`)                                        | Máx. requisições por janela                        |
| `RATE_LIMIT_TIMEWINDOW`     | Não (padrão: `60000`)                                      | Janela de rate limit em ms                         |

---

## Banco de Dados

Drizzle ORM gerencia o schema e as migrations. **Nunca edite arquivos de migration manualmente** — sempre regenere-os a partir de mudanças no schema.

```bash
# Gere uma nova migration a partir de mudanças no schema
npm run db:generate

# Aplique todas as pending migrations
npm run db:migrate

# Aplique as migrations no banco local (Docker)
npm run db:migrate:local

# Popule o banco local com dados de exemplo
npm run db:seed:local

# Drop completo do schema público e recriação
npm run db:wipe

# Push do schema diretamente para o DB (dev only, sem arquivo de migration)
npm run db:push

# Abra o Drizzle Studio — visual DB browser
npm run db:studio
```

- Arquivos de schema: `src/core/database/schema/`
- Output de migrations: `src/migrations/`

---

## Scripts Disponíveis

| Script                     | Descrição                                                      |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | Dev server com hot reload (`tsx watch`)                        |
| `npm run build`            | Compila TypeScript para `dist/`                                |
| `npm start`                | Executa servidor compilado (production)                        |
| `npm run lint`             | ESLint em `src/`                                               |
| `npm run lint:fix`         | ESLint com auto-fix                                            |
| `npm run format`           | Prettier em todos os arquivos                                  |
| `npm run format:check`     | Verifica formatação sem escrever                               |
| `npm test`                 | Executa todas as test suites                                   |
| `npm run test:unit`        | Apenas testes unitários                                        |
| `npm run test:integration` | Apenas testes de integração                                    |
| `npm run test:e2e`         | Apenas testes e2e                                              |
| `npm run test:watch`       | Testes em watch mode                                           |
| `npm run test:coverage`    | Testes com relatório de coverage                               |
| `npm run db:generate`      | Gera migration a partir do schema diff                         |
| `npm run db:migrate`       | Aplica migrations com `DATABASE_URL` do ambiente (CI/produção) |
| `npm run db:migrate:local` | Aplica migrations carregando `DATABASE_URL` do arquivo `.env`  |
| `npm run db:push`          | Push do schema direto (sem migration)                          |
| `npm run db:studio`        | Abre Drizzle Studio GUI                                        |
| `npm run db:seed:local`    | Seed local com dados de exemplo                                |
| `npm run db:wipe`          | Drop e recria o schema público                                 |
| `npm run db:start`         | Docker + migrate local + seed local                            |
| `npm run commit`           | Conventional commit interativo via Commitizen                  |

---

## Testes

Três projetos Jest isolados:

| Suite         | Localização          | Timeout | Descrição                          |
| ------------- | -------------------- | ------- | ---------------------------------- |
| `unit`        | `tests/unit/`        | 10s     | Lógica pura — sem I/O externo      |
| `integration` | `tests/integration/` | 60s     | PostgreSQL real via TestContainers |
| `e2e`         | `tests/e2e/`         | 60s     | Requisições HTTP completas         |

Testes de integração disparam um container real de PostgreSQL 16 via `@testcontainers/postgresql` — Docker precisa estar rodando.

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

---

## Pipeline CI/CD

Todo push e pull request para `develop` ou `main` dispara o pipeline em `.github/workflows/ci.yml`:

```text
code_quality ──► tests ──► ai_review ──► quality_gate
     │              │           │              │
  ESLint         unit        CodeRabbit     required
  Prettier    integration   (PRs only,     status check
  tsc           e2e         non-blocking)  for branch merge
```

| Estágio        | Bloqueia pipeline               | Trigger   |
| -------------- | ------------------------------- | --------- |
| `code_quality` | Sim                             | push + PR |
| `tests`        | Sim                             | push + PR |
| `ai_review`    | Não (`continue-on-error: true`) | PR only   |
| `quality_gate` | Sim                             | push + PR |

`quality_gate` é o status check obrigatório na branch protection. Depende apenas de `code_quality` e `tests` — a review de IA nunca bloqueia um merge.

---

## Deployment

Deploy automático via Railway. Ao fazer push para `main`, o Railway detecta a mudança e redeploy automaticamente.

O pipeline CD (`.github/workflows/cd-railway.yml`) executa um health check em `https://api.insidemymind.tech/health` após o deploy.

**Start command (`railway.toml`):**

```bash
npm run db:migrate && npm start
```

As migrations são aplicadas automaticamente a cada deploy.

| Ambiente | Branch | URL                             |
| -------- | ------ | ------------------------------- |
| Produção | `main` | `https://api.insidemymind.tech` |

---

## Estratégia de Branches

```text
feature/* ──► develop ──► main (production)
                │               │
           CI obrigatório   admin-only merge
           (Quality Gate)   → redeploy Railway
```

- Todo trabalho vai para `develop` via pull requests
- `main` é protegida — apenas o admin pode fazer merge
- Branch protection exige que o check **Quality Gate** passe antes de qualquer merge

---

## Contribuindo

1. Crie uma branch a partir de `develop`: `git checkout -b feat/sua-feature develop`
2. Implemente suas mudanças seguindo o padrão de módulos em `src/modules/`
3. Escreva testes — unitários para lógica, integração para interações com DB
4. Verifique localmente: `npm test && npm run lint && npm run format:check`
5. Faça commit com [Conventional Commits](https://www.conventionalcommits.org/):

   ```bash
   npm run commit
   ```

6. Abra um pull request direcionado para `develop`

**Tipos de commit aceitos:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

Pre-commit hooks (Husky + lint-staged) executam lint e format automaticamente antes de cada commit.

---

## Licença

MIT — veja [LICENSE](LICENSE).
