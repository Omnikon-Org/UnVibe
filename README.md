# UnVibe

> "Don't use AI as a crutch. Use it as a benchmark."

UnVibe is an open-source AI-powered learning platform that trains developers to deeply understand code — not just generate it.

---

## Live Demo

[![Live Demo](https://img.shields.io/badge/DEMO-https://unvibe--omnikon--vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://unvibe-omnikon.vercel.app)

The application is deployed with:
- Frontend: Vercel (main branch)
- Backend: Render (Node.js + Express)
- AI Service: Render (Python + FastAPI)
- Database: Upstash PostgreSQL
- Cache: Upstash Redis

---

## Overview

UnVibe implements a **Decode → Rebuild → Defend** learning loop:

1. **Decode** — Analyze AI-generated production code, annotate it, and pass a comprehension quiz
2. **Rebuild** — Rewrite the solution from memory without AI assistance
3. **Defend** — Explain and modify your code under Socratic questioning

Your progress is tracked through an **Irreplaceability Score (IRS)** that measures code comprehension depth versus AI dependency.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, tRPC, Prisma |
| AI Service | Python, FastAPI, OpenRouter (Claude, Gemini, Llama) |
| Database | Upstash PostgreSQL 16 |
| Cache | Upstash Redis 7 |
| Storage | Cloudflare R2 |
| Infrastructure | Turborepo, pnpm, Vercel, Render, GitHub Actions |

---

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm 9+
- Python 3.12+
- Docker & Docker Compose (for local development)

### Setup

```bash
# Clone and install
git clone https://github.com/Omnikon-Org/UnVibe.git
cd UnVibe
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure (PostgreSQL + Redis)
docker-compose -f infra/docker-compose.yml up -d

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm dev
```

---

## Project Structure

```
apps/
├── web/          # Next.js 14 frontend (App Router)
├── api/          # Node.js + Express backend (tRPC)
└── ai-service/   # Python FastAPI AI service

packages/
├── types/        # Shared TypeScript types
└── config/       # Shared ESLint, Prettier, tsconfig

infra/
└── docker-compose.yml  # Local PostgreSQL + Redis
```

---

## Environment Variables

Required for local development:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/unvibe
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=<generate-with-openssl>
OPENROUTER_API_KEY=<your-key>
```

See `.env.example` for complete configuration options including:
- GitHub & Google OAuth credentials
- Upstash Redis/PostgreSQL connection strings
- Cloudflare R2 storage credentials
- PostHog analytics key

---

## Deployment

| Component | Platform | Branch |
|-----------|----------|--------|
| Web app + API (single Next.js deployment) | Vercel | main |
| Database | Neon PostgreSQL | — |

Changes merged to `main` trigger automatic deployment.

---

## Contributing

1. Comment on an issue to claim it
2. Create a branch: `feat/your-feature` or `fix/bug-description`
3. Make focused changes, follow conventional commits
4. Run `pnpm lint` and `pnpm test` before pushing
5. Open a PR with one review required

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

Built for developers who want to be irreplaceable.

UnVibe — Stop vibing. Start understanding.
