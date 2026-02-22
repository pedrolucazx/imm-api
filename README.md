# imm-api

> Backend API for **Inside My Mind** — a habit tracking and AI-powered journaling SaaS.

![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)
![Google Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

---

## 🔗 Architecture

Modular monolith serving the [`imm-web`](https://github.com/pedrolucazx/imm-web) frontend. Orchestrates three specialized AI agents (Habit Planner, Language Teacher, Behavioral Coach) using the Gemini 2.5 Flash free tier.

> Architecture, database schema and AI agent strategy documented in the [Architecture Document](./docs/architecture.pdf).

## 🛠️ Tech Stack

- **Framework:** Fastify 5
- **Language:** TypeScript 5+
- **Database:** PostgreSQL 16
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **AI Integration:** Google Gemini 2.5 Flash (free tier)
- **Authentication:** JWT (access + refresh tokens)
- **Documentation:** Swagger/OpenAPI
- **Containerization:** Docker + Docker Compose
- **Deployment:** Railway

## 🤖 AI Agents

1. **Habit Planner** — Creates personalized habit plans based on user goals
2. **Language Teacher** — Helps users learn new languages through journaling
3. **Behavioral Coach** — Provides insights and recommendations based on habit data

## 📦 Project Structure

```
src/
├── modules/
│   ├── auth/         # Authentication & authorization
│   ├── users/        # User management
│   ├── habits/       # Habit tracking
│   ├── journal/      # Journaling system
│   └── ai-agents/    # AI agent orchestration
├── core/
│   ├── database/     # Database connection & schema
│   ├── config/       # Configuration management
│   └── plugins/      # Fastify plugins
└── shared/
    ├── types/        # Shared TypeScript types
    └── utils/        # Utility functions
```

## 🚀 Getting Started

```bash
# Clone the repository
git clone git@github.com:pedrolucazx/imm-api.git
cd imm-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

API will be available at [http://localhost:3001](http://localhost:3001).

Swagger documentation: [http://localhost:3001/docs](http://localhost:3001/docs).

## 📝 Environment Variables

See [`.env.example`](.env.example) for all required environment variables:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT signing
- `GEMINI_API_KEY` — Google AI Studio API key

## 🗄️ Database

```bash
# Generate migration
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio (GUI)
npm run db:studio
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📄 License

Private repository — Inside My Mind SaaS
