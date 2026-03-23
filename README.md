# AI-BOSS

> AI-powered Financial Advisor for SME Founders

**AUT Final Year Project 2025**  
**Team:** Rafael, Mohaned, Kaiden, Hamza, Akshay  
**Supervisors:** Dr. Jeffrey Kilby, Phillip Wong

---

## 🎯 Project Overview

AI-BOSS helps small business founders make better financial decisions through:
- Real-time financial insights from Xero integration
- AI-powered forecasting using multi-agent system (LangGraph)
- Scenario modeling (What if I hire 2 people?)
- Privacy-first architecture with MCP security boundary

---

## 🏗️ Tech Stack

- **Frontend:** Next.js 16, TypeScript, Material-UI, Tailwind CSS
- **Backend:** Next.js API Routes
- **AI:** LangChain.js, LangGraph.js, OpenAI GPT-4o / Claude 3.5 Sonnet
- **Database:** Supabase (PostgreSQL)
- **Integration:** Xero API (OAuth 2.0)
- **Deployment:** Vercel

---

## 🚀 Quick Start

### Prerequisites

- Node.js v22+ (recommended)
- npm v10+
- Git

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/AI-BOSS.git
cd AI-BOSS
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Copy the template
cp .env.example .env.local

# Edit .env.local with your actual keys
```

4. **Run development server:**
```bash
npm run dev
```

5. **Open browser:**
```
http://localhost:3000
```

---

## 📁 Project Structure
```
AI-BOSS/
├── AGENTS.md             # Repository instructions for agents
├── CLAUDE.md             # Claude agent / instructions reference
├── README.md             # This document
├── app/                  # Next.js 16 App Router (at root!)
│   ├── api/              # API routes (we'll create)
│   ├── favicon.ico       # Site icon
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page + landing UI
├── components/           # React components
├── db/                   # Supabase/Postgres helpers and SQL scripts
├── docs/                 # Project documentation and guides
├── lib/                  # Utilities, helpers, supabase clients
├── public/               # Static assets
├── types/                # Shared TypeScript types
├── proxy.ts              # Development proxy / custom server hooks
├── next.config.ts        # Next.js configuration (TypeScript)
├── next-env.d.ts         # Next.js ambient types
├── eslint.config.mjs     # ESLint config
├── postcss.config.mjs    # PostCSS configuration
├── package.json          # npm metadata & scripts
├── package-lock.json     # npm lockfile
├── tsconfig.json         # TypeScript compiler options
└── node_modules/         # Installed dependencies (ignored in git)
```

**Note:** Next.js 16 uses root-level `app/` folder (no `src/`)

## 🧰 Developer onboarding checklist

1. **GitHub access** – Confirm Rafael has invited you (emails Rafael already has: Akshay `akshayyadavkumar06@gmail.com`, Mo `Mohanadhtsm04@gmail.com`, Hamza `wct8670@autuni.ac.nz`, Kaiden `dxv5648@autuni.ac.nz`). If you want to use a different email for GitHub or need Rafael to resend the invite, reply with the new address so he can update Supabase/Vercel invites too.
2. **Clone + branch** – `git clone https://github.com/rafaelmarcoo/AI-BOSS.git`, `cd AI-BOSS`, `git checkout -b feature/<card-name>`. Branch from `main`, keep histories tidy, and push via `git push -u origin feature/...` before opening a PR.
3. **Environment setup**
   - Install Node.js 22+ and npm 10+ via `nvm` or Homebrew. Confirm versions with `node -v` and `npm -v`.
   - Copy `.env.example` to `.env.local` and update keys (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `XERO_*`). Treat `.env.local` as private.
4. **Install dependencies** – Run `npm install`. If you hit conflicts, remove `node_modules` + `package-lock.json` and reinstall clean.
5. **Run locally** – `npm run dev` and visit `http://localhost:3000`. Expect live reload when you edit files.

### Contribution tips
- Pull the latest `main` before work (`git fetch origin && git rebase origin/main`).
- Use clear commit messages like `feat: add forecast modal` or `fix: correct tooltip`.
- Mention Supabase or Vercel considerations in PR descriptions if your change touches deployments or database schemas.
- When stuck, describe the steps you tried and paste relevant logs/screenshots in Teams or the PR thread.

## 🌀 Supabase & data access
1. Sign up at [supabase.com](https://supabase.com/) using the email you share with Rafael so he can invite you to the project. We plan to keep the same emails for GitHub/Supabase/Vercel; if you must switch, confirm the new address so invites align.
2. Accept the Supabase invite, open **Project Settings > API**, and copy the `anon` and `service_role` keys into `.env.local`.
3. Supabase hosts the Postgres database used for forecasts, transactions, and the LangGraph agents. Use the `db/` SQL scripts and `lib/supabase` helpers rather than editing the production console unless Rafael explicitly approves it.
4. Coordinate schema changes or migrations with Rafael before deploying; run migrations locally with the service role key and verify data integrity.

## 🌍 Vercel access
1. Rafael will add you to the Vercel team so you can monitor deployments. Use the collaborator email we agreed on; if it changes, let Rafael know so he can update the invite.
2. Link your GitHub account when prompted so Vercel can create preview deployments for your branches.
3. Vercel serves PR previews and production builds. Review build logs, environment variables, and preview URLs from the dashboard to confirm your change behaves in staging before merging.
4. Deployments happen automatically when you push to `main` or open a PR; do not trigger manual redeploys unless Rafael asks for a hotfix.
5. Use Vercel’s logs and artifacts to troubleshoot failing builds, then share relevant excerpts in your PR comments.

## 🧭 Workflow reminders
- Run `npm run lint` before pushing code.
- Keep commits small and descriptive, following the Conventional Commits style when practical.
- Main is protected; wait for Rafael’s review and green CI before merging.
- Use Teams/GitHub issues for blockers or to clarify requirements.
- Mention Supabase/Vercel changes in your PR to help reviewers understand deployment risk.

---

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Branching Strategy

- `main` - Production (protected)
- `feature/card-X-name` - Feature branches

### Making Changes

1. Create branch: `git checkout -b feature/card-2-database`
2. Make changes: `git add .` and `git commit -m "feat: message"`
3. Push: `git push origin feature/card-2-database`
4. Create Pull Request on GitHub
5. Get review from Rafael
6. Merge after approval

---

## 🤝 Team

- **Rafael**
- **Mohaned**
- **Kaiden** 
- **Hamza** 
- **Akshay** 

---

## 🆘 Getting Help

- Post in Teams channel
- Create GitHub issue
- Message Rafael, Phillip

---

**Built with Next.js 16 🚀**
