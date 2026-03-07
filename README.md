# imm-api

> API Backend para **Inside My Mind** — Rastreamento de hábitos e journaling potencializado por três agentes de inteligência artificial.

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
- [Os Três Agentes de IA](#os-três-agentes-de-ia)
- [Arquitetura](#arquitetura)
- [Stack de Tecnologias](#stack-de-tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Como Começar](#como-começar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados](#banco-de-dados)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Testes](#testes)
- [Pipeline CI/CD](#pipelineCICD)
- [Deployment](#deployment)
- [Estratégia de Branches](#estratégia-de-branches)
- [Contribuindo](#contribuindo)

---

## O que é Inside My Mind?

**Inside My Mind** é uma aplicação gratuita e de código aberto que ajuda você a construir hábitos consistentes ao longo de 66 dias — o tempo médio que a ciência mostra ser necessário para transformar um comportamento em uma rotina automática.

O diferencial é que o app conta com três agentes de IA que trabalham para você **sem custo nenhum**: um que monta seu plano personalizado, um que corrige sua escrita em outros idiomas e um que analisa seu humor e padrões comportamentais ao longo do tempo. Tudo rodando dentro de cotas gratuitas de IA sem monetização.

É um projeto de portfólio e aprendizado que qualquer pessoa pode usar, estudar e contribuir.

---

## Os Três Agentes de IA

### 🧠 Habit Planner — O Estrategista

Gera planos personalizados de 66 dias quando você cria um novo hábito. Divide sua jornada em três fases embasadas cientificamente:

- **Fase 1 (Dias 1-14)** — Fundação: Tarefas leves e introdutórias para estabelecer a prática diária
- **Fase 2 (Dias 15-44)** — Produção Ativa: Aumento gradual de dificuldade com prática deliberada
- **Fase 3 (Dias 45-66)** — Consolidação: Foco em fluência, autonomia e maestria

Cada fase inclui técnicas específicas (spaced repetition, deliberate practice, shadowing) e métricas de sucesso adaptadas ao seu estilo de aprendizado e tempo disponível.

### 📝 Language Teacher — O Coach Linguístico

Ativado para hábitos de aprendizado de idiomas. Analisa suas entradas diárias no journal e retorna feedback linguístico detalhado:

- **Grammar Score** (0-100): Destaca os erros mais impactantes com explicações
- **Vocabulary Score** (0-100): Avalia a riqueza do vocabulário e sugere alternativas mais avançadas
- **Fluency Score** (0-100): Mede coerência, fluidez e estrutura do texto
- **Top 3 erros**: Cada um com a versão original, corrigida e uma explicação clara
- **Frase-modelo**: Uma sentença exemplar para você praticar seu ponto fraco
- **Desafio para amanhã**: Uma tarefa concreta para seu próximo journal

### 🎯 Behavioral Coach — O Analista de Padrões

Ativado para todos os hábitos não-linguísticos (fitness, leitura, meditação, etc.). Lê seu journal e analisa padrões comportamentais:

- **Detecção de humor**: Identifica positividade, fadiga, frustração ou neutralidade em sua escrita
- **Nível de energia**: Classifica a energia percebida (alta, média, baixa)
- **Score de alinhamento com hábito**: Mede quão bem seu journal está alinhado com o hábito rastreado
- **Insights comportamentais**: Identifica padrões recorrentes (ex: "Energia mais baixa nos dias de aula")
- **Micro-ações**: Sugestões específicas e executáveis para amanhã

---

## Visão Geral

`imm-api` é o backend da plataforma **Inside My Mind**. Expõe uma API RESTful consumida exclusivamente por [`imm-web`](https://github.com/pedrolucazx/imm-web). Gerencia autenticação de usuários, rastreamento de hábitos, journaling e orquestra três agentes de IA para gerar insights personalizados.

> Decisões de arquitetura, schema do banco de dados e estratégia de agentes de IA estão documentados em [docs/architecture.pdf](./docs/architecture.pdf).

---

## Arquitetura

```
imm-web (Next.js) ──► imm-api (Fastify) ──► PostgreSQL 16
                                      └──► Anthropic API (Agentes de IA)
```

Monolito modular organizado em torno de features por domínio. Cada módulo sob `src/modules/` possui suas routes, controller, service e repository. A API é totalmente documentada via Swagger UI em `/docs`.

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
| Integração com IA   | Anthropic API                                           |
| Logging             | Pino + pino-pretty                                      |
| Containerização     | Docker + Docker Compose                                 |
| Deployment          | Render                                                  |

---

## Estrutura do Projeto

```
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
│   │   ├── habits/               # Rastreamento de hábitos (planejado)
│   │   ├── journal/              # Sistema de journaling (planejado)
│   │   ├── ai-agents/            # Orquestração de agentes de IA (planejado)
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
│   │   │       └── users.schema.ts
│   │   └── plugins/              # Plugins Fastify (cors, jwt, swagger)
│   ├── shared/
│   │   └── utils/
│   │       └── password.ts       # Helpers bcrypt
│   ├── migrations/               # Auto-generated Drizzle SQL migrations
│   └── index.ts                  # Application entry point
├── tests/
│   ├── __setup__/                # Global setup (env vars, mocks)
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
cp .env.example .env
# Preencha os valores — veja a seção Variáveis de Ambiente abaixo

# 4. Inicie o PostgreSQL via Docker
docker compose up -d postgres

# 5. Execute as migrations do banco de dados
npm run db:migrate

# 6. Inicie o servidor de desenvolvimento
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

# CORS — origem(ns) do frontend permitida(s) para chamar esta API
CORS_ORIGIN=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev

# JWT
JWT_SECRET=sua-super-chave-secreta-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Integração com IA
ANTHROPIC_API_KEY=sua-chave-api-anthropic

# Rate Limiting (opcional)
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000
```

| Variável                | Obrigatória | Descrição                                    |
| ----------------------- | ----------- | -------------------------------------------- |
| `DATABASE_URL`          | Sim         | String completa de conexão PostgreSQL        |
| `JWT_SECRET`            | Sim         | Segredo para assinar JWTs (mín 32 chars)     |
| `JWT_ACCESS_EXPIRES`    | Sim         | TTL do access token (ex: `15m`)              |
| `JWT_REFRESH_EXPIRES`   | Sim         | TTL do refresh token (ex: `7d`)              |
| `CORS_ORIGIN`           | Sim         | Origem(ns) do frontend permitida(s)          |
| `ANTHROPIC_API_KEY`     | Não\*       | Obrigatória para features de agentes de IA   |
| `LOG_LEVEL`             | Não         | Nível de log Pino (padrão: `info`)           |
| `RATE_LIMIT_MAX`        | Não         | Máx requisições por janela (padrão: `100`)   |
| `RATE_LIMIT_TIMEWINDOW` | Não         | Janela de rate limit em ms (padrão: `60000`) |

---

## Banco de Dados

Drizzle ORM gerencia o schema e as migrations. **Nunca edite arquivos de migration manualmente** — sempre regenere-os a partir de mudanças no schema.

```bash
# Gere uma nova migration a partir de mudanças no schema
npm run db:generate

# Aplique todas as pending migrations
npm run db:migrate

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
| `npm run dev`              | Inicie dev server com hot reload (`tsx watch`) |
| `npm run build`            | Compile TypeScript para `dist/`                |
| `npm start`                | Execute servidor compilado (production)        |
| `npm run lint`             | Execute ESLint em `src/`                       |
| `npm run lint:fix`         | Execute ESLint com auto-fix                    |
| `npm run format`           | Formate todos os arquivos com Prettier         |
| `npm run format:check`     | Verifique formatação sem escrever              |
| `npm test`                 | Execute todas as test suites                   |
| `npm run test:unit`        | Execute apenas testes unitários                |
| `npm run test:integration` | Execute apenas testes de integração            |
| `npm run test:e2e`         | Execute apenas testes e2e                      |
| `npm run test:watch`       | Execute testes em watch mode                   |
| `npm run test:coverage`    | Execute testes e gere relatório de coverage    |
| `npm run db:generate`      | Gere Drizzle migration a partir do schema diff |
| `npm run db:migrate`       | Aplique pending migrations                     |
| `npm run db:push`          | Push do schema direto (sem arquivo migration)  |
| `npm run db:studio`        | Abra Drizzle Studio GUI                        |
| `npm run commit`           | Conventional commit interativo via Commitizen  |

---

## Testes

Três projetos Jest isolados, cada um com seu próprio timeout e ambiente:

| Suite         | Localização          | Timeout | Descrição                          |
| ------------- | -------------------- | ------- | ---------------------------------- |
| `unit`        | `tests/unit/`        | 10s     | Lógica pura — sem I/O externo      |
| `integration` | `tests/integration/` | 60s     | PostgreSQL real via TestContainers |
| `e2e`         | `tests/e2e/`         | 60s     | Requisições HTTP completas         |

Testes de integração disparam um container real de PostgreSQL 16 automaticamente via `@testcontainers/postgresql` — Docker deve estar rodando.

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

---

## Pipeline CI/CD

Todo push e pull request para `develop` ou `main` dispara o pipeline definido em `.github/workflows/ci.yml`:

```
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

Gerenciado via [`render.yaml`](render.yaml) (Infrastructure as Code). O pipeline CD (`.github/workflows/cd.yml`) dispara deployments no Render após CI passar — `autoDeploy: false` está configurado em ambos os serviços para que Render nunca faça deploy em pushes diretos.

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

```
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
2. Implemente suas mudanças, seguindo o padrão de módulos em `src/modules/`
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

## Por Que Este Projeto Importa para Seu Portfólio

Este backend mostra várias práticas de engenharia de nível production e padrões modernos:

- **Arquitetura Modular**: Domain-driven design com clara separação de responsabilidades. Cada feature tem suas routes, controller, service e repository.
- **Type Safety**: TypeScript end-to-end garante correção em compile-time em toda a stack.
- **Integração com IA**: Integração real da API Anthropic com prompt engineering para três agentes distintos (Planner, Language Teacher, Coach).
- **Testes Abrangentes**: Test suites de unit, integração (com TestContainers) e E2E com automação CI/CD.
- **IA sem Custo**: Todas as features de IA rodam dentro de quotas gratuitas do modelo — demonstra otimização com restrições e design eficiente de prompts.
- **DevOps Production**: Containerização Docker, deployments gerenciados no Render, infrastructure as code (IaC) e estratégia dual-environment (homolog + production).
- **Developer Experience**: Pre-commit hooks, automação com lint-staged, documentação de API via Swagger e Drizzle Studio para gerenciamento visual de banco de dados.

---

## Licença

Este projeto é público e aberto para fins de aprendizado.
