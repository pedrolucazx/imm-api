# imm-api

> Backend API for **Inside My Mind** — a SaaS platform for habit tracking and AI-powered journaling.

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

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Branch Strategy](#branch-strategy)
- [Contributing](#contributing)

---

## Overview

`imm-api` is the backend of the **Inside My Mind** platform. It exposes a RESTful API consumed exclusively by [`imm-web`](https://github.com/pedrolucazx/imm-web). It handles user authentication, habit tracking, journaling, and orchestrates AI agents to generate personalized insights for each user.

**AI Agents (in development):**

- **Habit Planner** — generates personalized habit plans based on user goals
- **Language Teacher** — integrates language learning into the journaling experience
- **Behavioral Coach** — delivers insights and recommendations based on habit history

> Architecture decisions, database schema, and AI agent strategy are documented in [docs/architecture.pdf](./docs/architecture.pdf).

---

## Architecture

```
imm-web (Next.js) ──► imm-api (Fastify) ──► PostgreSQL 16
                                       └──► Anthropic API (AI agents)
```

Modular monolith organized around domain features. Each module under `src/modules/` owns its routes, controller, service, and repository. The API is fully documented via Swagger UI at `/docs`.

---

## Tech Stack

| Layer             | Technology                                              |
| ----------------- | ------------------------------------------------------- |
| Runtime           | Node.js (ESM)                                           |
| Framework         | Fastify 5                                               |
| Language          | TypeScript 5                                            |
| Database          | PostgreSQL 16                                           |
| ORM               | Drizzle ORM                                             |
| Validation        | Zod 4                                                   |
| Authentication    | JWT — access + refresh tokens (`@fastify/jwt`)          |
| API Documentation | Swagger UI (`@fastify/swagger` + `@fastify/swagger-ui`) |
| AI Integration    | Anthropic API                                           |
| Logging           | Pino + pino-pretty                                      |
| Containerization  | Docker + Docker Compose                                 |
| Deployment        | Render                                                  |

---

## Project Structure

```
imm-api/
├── src/
│   ├── modules/                  # Feature modules (one folder per domain)
│   │   ├── auth/                 # Authentication (login, register, refresh token)
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.types.ts
│   │   ├── users/                # User management
│   │   │   └── users.repository.ts
│   │   ├── habits/               # Habit tracking (planned)
│   │   ├── journal/              # Journaling system (planned)
│   │   ├── ai-agents/            # AI agent orchestration (planned)
│   │   └── health/               # Health check endpoint
│   │       └── health.routes.ts
│   ├── core/
│   │   ├── config/               # Environment config & logger setup
│   │   │   ├── env.ts
│   │   │   └── logger.ts
│   │   ├── database/             # Drizzle connection & schema definitions
│   │   │   ├── connection.ts
│   │   │   └── schema/
│   │   │       ├── index.ts
│   │   │       └── users.schema.ts
│   │   └── plugins/              # Fastify plugins (cors, jwt, swagger)
│   ├── shared/
│   │   └── utils/
│   │       └── password.ts       # bcrypt helpers
│   ├── migrations/               # Auto-generated Drizzle SQL migrations
│   └── index.ts                  # Application entry point
├── tests/
│   ├── __setup__/                # Global setup (env vars, mocks)
│   ├── unit/                     # Pure unit tests — no I/O
│   ├── integration/              # DB integration tests (TestContainers)
│   └── e2e/                      # Full HTTP request tests
├── .github/
│   └── workflows/
│       ├── ci.yml                # Code quality + tests pipeline
│       └── cd.yml                # Deploy to Render on CI success
├── .env.example
├── docker-compose.yml            # Local PostgreSQL
├── drizzle.config.ts
├── jest.config.cjs
├── render.yaml                   # Render IaC (homolog + production)
└── tsconfig.json
```

---

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Docker** + **Docker Compose** (for local PostgreSQL)
- **Git**

---

## Getting Started

```bash
# 1. Clone the repository
git clone git@github.com:pedrolucazx/imm-api.git
cd imm-api

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in the values — see Environment Variables section below

# 4. Start PostgreSQL via Docker
docker compose up -d postgres

# 5. Run database migrations
npm run db:migrate

# 6. Start the development server
npm run dev
```

- API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/docs`

---

## Environment Variables

Copy `.env.example` to `.env` and configure the values:

```env
# Application
NODE_ENV=development
PORT=3001
API_HOST=localhost:3001
LOG_LEVEL=info

# CORS — frontend origin(s) allowed to call this API
CORS_ORIGIN=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# AI Integration
ANTHROPIC_API_KEY=your-anthropic-api-key

# Rate Limiting (optional)
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000
```

| Variable                | Required | Description                                |
| ----------------------- | -------- | ------------------------------------------ |
| `DATABASE_URL`          | Yes      | Full PostgreSQL connection string          |
| `JWT_SECRET`            | Yes      | Secret for signing JWTs (min 32 chars)     |
| `JWT_ACCESS_EXPIRES`    | Yes      | Access token TTL (e.g. `15m`)              |
| `JWT_REFRESH_EXPIRES`   | Yes      | Refresh token TTL (e.g. `7d`)              |
| `CORS_ORIGIN`           | Yes      | Allowed frontend origin(s)                 |
| `ANTHROPIC_API_KEY`     | No\*     | Required for AI agent features             |
| `LOG_LEVEL`             | No       | Pino log level (default: `info`)           |
| `RATE_LIMIT_MAX`        | No       | Max requests per window (default: `100`)   |
| `RATE_LIMIT_TIMEWINDOW` | No       | Rate limit window in ms (default: `60000`) |

---

## Database

Drizzle ORM manages the schema and migrations. **Never edit migration files manually** — always regenerate them from schema changes.

```bash
# Generate a new migration from schema changes
npm run db:generate

# Apply all pending migrations
npm run db:migrate

# Push schema directly to DB (dev only, no migration file created)
npm run db:push

# Open Drizzle Studio — visual DB browser
npm run db:studio
```

- Schema files: `src/core/database/schema/`
- Migration output: `src/migrations/`

---

## Available Scripts

| Script                     | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Start dev server with hot reload (`tsx watch`) |
| `npm run build`            | Compile TypeScript to `dist/`                  |
| `npm start`                | Run compiled server (production)               |
| `npm run lint`             | Run ESLint on `src/`                           |
| `npm run lint:fix`         | Run ESLint with auto-fix                       |
| `npm run format`           | Format all source files with Prettier          |
| `npm run format:check`     | Check formatting without writing               |
| `npm test`                 | Run all test suites                            |
| `npm run test:unit`        | Run unit tests only                            |
| `npm run test:integration` | Run integration tests only                     |
| `npm run test:e2e`         | Run e2e tests only                             |
| `npm run test:watch`       | Run tests in watch mode                        |
| `npm run test:coverage`    | Run tests and generate coverage report         |
| `npm run db:generate`      | Generate Drizzle migration from schema diff    |
| `npm run db:migrate`       | Apply pending migrations                       |
| `npm run db:push`          | Push schema directly (no migration file)       |
| `npm run db:studio`        | Open Drizzle Studio GUI                        |
| `npm run commit`           | Interactive conventional commit via Commitizen |

---

## Testing

Three isolated Jest projects, each with its own timeout and environment:

| Suite         | Location             | Timeout | Description                                |
| ------------- | -------------------- | ------- | ------------------------------------------ |
| `unit`        | `tests/unit/`        | 10s     | Pure logic — no external I/O               |
| `integration` | `tests/integration/` | 60s     | Real PostgreSQL via TestContainers         |
| `e2e`         | `tests/e2e/`         | 60s     | Full HTTP requests against the running app |

Integration tests spin up a real PostgreSQL 16 container automatically via `@testcontainers/postgresql` — Docker must be running.

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

---

## CI/CD Pipeline

Every push and pull request to `develop` or `main` triggers the pipeline defined in `.github/workflows/ci.yml`:

```
code_quality ──► tests ──► ai_review ──► quality_gate
     │              │           │              │
  ESLint         unit        CodeRabbit     required
  Prettier    integration   (PRs only,     status check
  tsc           e2e         non-blocking)  for branch merge
```

| Stage          | Blocks pipeline                | Trigger   |
| -------------- | ------------------------------ | --------- |
| `code_quality` | Yes                            | push + PR |
| `tests`        | Yes                            | push + PR |
| `ai_review`    | No (`continue-on-error: true`) | PR only   |
| `quality_gate` | Yes                            | push + PR |

`quality_gate` is the required status check in branch protection. It depends only on `code_quality` and `tests` — the AI review never blocks a merge.

---

## Deployment

Managed via [`render.yaml`](render.yaml) (Infrastructure as Code). The CD pipeline (`.github/workflows/cd.yml`) triggers Render deployments after CI passes — `autoDeploy: false` is set on both services so Render never deploys on direct pushes.

| Environment  | Branch    | Render Service   |
| ------------ | --------- | ---------------- |
| Homologation | `develop` | `imm-homolog`    |
| Production   | `main`    | `imm-production` |

**Build command:**

```bash
npm ci && npm run db:migrate && npm run build
```

**Start command:**

```bash
npm start
```

---

## Branch Strategy

```
feature/* ──► develop (homolog) ──► main (production)
                   │                       │
             auto-deploys to         admin-only merge
             imm-homolog             to imm-production
```

- All work goes to `develop` via pull requests
- `main` is protected — only the admin can merge `develop → main`
- Branch protection requires the **Quality Gate** check to pass before any merge

---

## Contributing

1. Create a branch from `develop`: `git checkout -b feat/your-feature develop`
2. Implement your changes, following the module pattern in `src/modules/`
3. Write tests — unit for logic, integration for DB interactions
4. Verify everything passes locally: `npm test && npm run lint && npm run format:check`
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   npm run commit
   # or manually: git commit -m "feat(habits): add streak calculation"
   ```
6. Open a pull request targeting `develop`

**Accepted commit types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

Pre-commit hooks (Husky + lint-staged) run lint and format checks automatically before each commit.

---

## License

This project is public and open for learning purposes.
