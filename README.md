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
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)

---

## Índice

- [O que é Inside My Mind?](#o-que-é-inside-my-mind)
- [Agentes de IA](#agentes-de-ia)
- [Arquitetura](#arquitetura)
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

É um projeto de código aberto, feito para aprendizado e portfólio.

---

## Agentes de IA

A API orquestra três agentes especializados via Google Gemini Flash, cada um ativado por tipo de hábito:

- **Habit Planner**: gera um plano de 66 dias com fases progressivas ao criar um novo hábito
- **Language Teacher**: avalia gramática, vocabulário e fluência nas entradas de hábitos de idiomas; também aceita áudio gravado pelo usuário, transcreve via Gemini e retorna score de acerto com lista de palavras corretas e erradas
- **Behavioral Coach**: identifica padrões de humor e sugere micro-ações para hábitos comportamentais

Todos os agentes rodam dentro das cotas gratuitas do modelo — sem custo para o usuário.

---

## Arquitetura

```text
imm-web (Next.js) ──► imm-api (Fastify) ──► PostgreSQL 16
                                       └──► Google Gemini Flash (agentes de IA)
```

`imm-api` é o backend da plataforma **Inside My Mind**. Expõe uma API RESTful consumida exclusivamente por [`imm-web`](https://github.com/pedrolucazx/imm-web). Segue um monolito modular organizado por domínio — cada módulo em `src/modules/` possui suas próprias routes, controller, service e repository. A API é documentada via Swagger UI em `/docs`.

---

## Stack de Tecnologias

| Camada              | Tecnologia                                              |
| ------------------- | ------------------------------------------------------- |
| Runtime             | Node.js (ESM)                                           |
| Framework           | Fastify 5                                               |
| Linguagem           | TypeScript 5                                            |
| Banco de Dados      | PostgreSQL 16                                           |
| ORM                 | Drizzle ORM                                             |
| Validação           | Zod 4                                                   |
| Autenticação        | JWT — access + refresh tokens (`@fastify/jwt`)          |
| Documentação da API | Swagger UI (`@fastify/swagger` + `@fastify/swagger-ui`) |
| Integração com IA   | Google Gemini Flash                                     |
| Storage             | Supabase Storage (avatars + audio)                      |
| Logging             | Pino + pino-pretty                                      |
| Containerização     | Docker + Docker Compose                                 |
| Deployment          | Render                                                  |

---

## Estrutura do Projeto

```text
imm-api/
├── src/
│   ├── modules/                  # Feature modules (uma pasta por domínio)
│   │   ├── auth/                 # Autenticação (login, register, refresh token)
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.types.ts
│   │   ├── users/                # Gerenciamento de usuários
│   │   │   └── users.repository.ts
│   │   ├── habits/               # Rastreamento de hábitos
│   │   ├── journal/              # Sistema de journaling
│   │   ├── ai-agents/            # Orquestração de agentes de IA
│   │   ├── pronunciation/        # Gravação, transcrição e score de pronúncia via Gemini (hábitos de idiomas)
│   │   └── health/               # Health check endpoint
│   │       └── health.routes.ts
│   ├── core/
│   │   ├── config/               # Config de ambiente & setup de logger
│   │   │   ├── env.ts
│   │   │   └── logger.ts
│   │   ├── database/             # Drizzle connection & schema definitions
│   │   │   ├── connection.ts
│   │   │   └── schema/
│   │   │       ├── index.ts
│   │   │       ├── users.schema.ts
│   │   │       ├── journal-entries.schema.ts
│   │   │       └── pronunciation.schema.ts
│   │   └── plugins/              # Plugins Fastify (cors, jwt, swagger)
│   ├── shared/
│   │   └── utils/
│   │       └── password.ts       # Helpers bcrypt
│   ├── migrations/               # Drizzle SQL migrations geradas automaticamente
│   └── index.ts                  # Entry point da aplicação
├── tests/
│   ├── __setup__/                # Setup global (env vars, mocks)
│   ├── unit/                     # Testes unitários puros — sem I/O
│   ├── integration/              # Testes de integração com DB (TestContainers)
│   └── e2e/                      # Testes HTTP end-to-end
├── .github/
│   └── workflows/
│       ├── ci.yml                # Pipeline de code quality + testes
│       └── cd.yml                # Deploy para Render após CI bem-sucedido
├── .env.example
├── docker-compose.yml            # PostgreSQL local
├── drizzle.config.ts
├── jest.config.cjs
├── render.yaml                   # Render IaC (homolog + production)
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
cp .env.example .env.local
# .env = remoto (ex.: Supabase)
# .env.local = local (Docker)
# Preencha os valores — veja a seção Variáveis de Ambiente abaixo

# 4. Suba banco local + migrations + seed de dados de exemplo
npm run db:start

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

- API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/docs`

---

## Variáveis de Ambiente

Use dois arquivos para separar ambientes:

- `.env`: remoto (Supabase/produção)
- `.env.local`: local (Docker)

Copie `.env.example` para `.env.local` e configure os valores:

```env
# Aplicação
NODE_ENV=development
PORT=3001
API_HOST=localhost:3001
LOG_LEVEL=info

# CORS — origem(ns) do frontend permitida(s) para chamar esta API
CORS_ORIGIN=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev

# JWT
JWT_SECRET=sua-super-chave-secreta-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Integração com IA
GEMINI_API_KEY=sua-chave-api-gemini
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent

# Supabase Storage
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
SUPABASE_STORAGE_BUCKET=avatars
SUPABASE_AUDIO_BUCKET=audio-entries

# Rate Limiting (opcional)
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000

# Email (Resend — https://resend.com)
RESEND_API_KEY=re_your_resend_api_key
APP_URL=http://localhost:3000
```

| Variável                    | Obrigatória | Descrição                                                       |
| --------------------------- | ----------- | --------------------------------------------------------------- |
| `DATABASE_URL`              | Sim         | String completa de conexão PostgreSQL                           |
| `JWT_SECRET`                | Sim         | Segredo para assinar JWTs (mín 32 chars)                        |
| `JWT_ACCESS_EXPIRES`        | Sim         | TTL do access token (ex: `15m`)                                 |
| `JWT_REFRESH_EXPIRES`       | Sim         | TTL do refresh token (ex: `7d`)                                 |
| `CORS_ORIGIN`               | Sim         | Origem(ns) do frontend permitida(s)                             |
| `GEMINI_API_KEY`            | Não\*       | Obrigatória para features de agentes de IA                      |
| `GEMINI_API_URL`            | Não         | Endpoint Gemini (padrão: gemini-flash-latest)                   |
| `SUPABASE_URL`              | Sim         | URL do projeto Supabase                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim         | Chave service role do Supabase                                  |
| `SUPABASE_STORAGE_BUCKET`   | Não         | Bucket para avatares (padrão: `avatars`)                        |
| `SUPABASE_AUDIO_BUCKET`     | Não         | Bucket para áudios de pronúncia (padrão: `audio-entries`)       |
| `RESEND_API_KEY`            | Não\*       | Obrigatória para envio de e-mails (verificação, reset de senha) |
| `APP_URL`                   | Não\*       | URL base do frontend — usada nos links dos e-mails              |
| `LOG_LEVEL`                 | Não         | Nível de log Pino (padrão: `info`)                              |
| `RATE_LIMIT_MAX`            | Não         | Máx requisições por janela (padrão: `100`)                      |
| `RATE_LIMIT_TIMEWINDOW`     | Não         | Janela de rate limit em ms (padrão: `60000`)                    |

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

# Popule o banco local com usuário e hábitos de exemplo
npm run db:seed:local

# Push do schema diretamente para o DB (dev only, sem arquivo de migration)
npm run db:push

# Abra o Drizzle Studio — visual DB browser
npm run db:studio
```

- Arquivos de schema: `src/core/database/schema/`
- Output de migrations: `src/migrations/`

---

## Scripts Disponíveis

| Script                     | Descrição                                      |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Inicia dev server com hot reload (`tsx watch`) |
| `npm run build`            | Compila TypeScript para `dist/`                |
| `npm start`                | Executa servidor compilado (production)        |
| `npm run lint`             | Executa ESLint em `src/`                       |
| `npm run lint:fix`         | Executa ESLint com auto-fix                    |
| `npm run format`           | Formata todos os arquivos com Prettier         |
| `npm run format:check`     | Verifica formatação sem escrever               |
| `npm test`                 | Executa todas as test suites                   |
| `npm run test:unit`        | Executa apenas testes unitários                |
| `npm run test:integration` | Executa apenas testes de integração            |
| `npm run test:e2e`         | Executa apenas testes e2e                      |
| `npm run test:watch`       | Executa testes em watch mode                   |
| `npm run test:coverage`    | Executa testes e gera relatório de coverage    |
| `npm run db:generate`      | Gera Drizzle migration a partir do schema diff |
| `npm run db:migrate`       | Aplica pending migrations via `.env`           |
| `npm run db:migrate:local` | Aplica pending migrations via `.env.local`     |
| `npm run db:push`          | Push do schema direto (sem arquivo migration)  |
| `npm run db:studio`        | Abre Drizzle Studio GUI                        |
| `npm run db:seed:local`    | Seed local com usuário e hábitos de exemplo    |
| `npm run db:start`         | Docker local + migrate local + seed local      |
| `npm run commit`           | Conventional commit interativo via Commitizen  |

---

## Testes

Três projetos Jest isolados, cada um com seu próprio timeout e ambiente:

| Suite         | Localização          | Timeout | Descrição                          |
| ------------- | -------------------- | ------- | ---------------------------------- |
| `unit`        | `tests/unit/`        | 10s     | Lógica pura — sem I/O externo      |
| `integration` | `tests/integration/` | 60s     | PostgreSQL real via TestContainers |
| `e2e`         | `tests/e2e/`         | 60s     | Requisições HTTP completas         |

Testes de integração disparam um container real de PostgreSQL 16 automaticamente via `@testcontainers/postgresql` — Docker precisa estar rodando.

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

---

## Pipeline CI/CD

Todo push e pull request para `develop` ou `main` dispara o pipeline definido em `.github/workflows/ci.yml`:

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

Gerenciado via [`render.yaml`](render.yaml) (Infrastructure as Code). O pipeline CD (`.github/workflows/cd.yml`) dispara deployments no Render após CI passar — `autoDeploy: false` está configurado em ambos os serviços para que o Render nunca faça deploy em pushes diretos.

| Ambiente    | Branch    | Render Service   |
| ----------- | --------- | ---------------- |
| Homologação | `develop` | `imm-homolog`    |
| Produção    | `main`    | `imm-production` |

**Build command:**

```bash
npm ci && npm run db:migrate && npm run build
```

**Start command:**

```bash
npm start
```

---

## Estratégia de Branches

```text
feature/* ──► develop (homolog) ──► main (production)
                   │                       │
             auto-deploys to         admin-only merge
             imm-homolog             to imm-production
```

- Todo trabalho vai para `develop` via pull requests
- `main` é protegida — apenas o admin pode fazer merge `develop → main`
- Branch protection exige que o check **Quality Gate** passe antes de qualquer merge

---

## Contribuindo

1. Crie uma branch a partir de `develop`: `git checkout -b feat/sua-feature develop`
2. Implemente suas mudanças seguindo o padrão de módulos em `src/modules/`
3. Escreva testes — unitários para lógica, integração para interações com DB
4. Verifique se tudo passa localmente: `npm test && npm run lint && npm run format:check`
5. Faça commit com [Conventional Commits](https://www.conventionalcommits.org/):

   ```bash
   npm run commit
   # ou manualmente: git commit -m "feat(habits): adicionar cálculo de streak"
   ```

6. Abra um pull request direcionado para `develop`

**Tipos de commit aceitos:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

Pre-commit hooks (Husky + lint-staged) executam checagens de lint e format automaticamente antes de cada commit.

---

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
