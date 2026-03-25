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
git clone https://github.com/rafaelmarcoo/AI-BOSS.git
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
npm test             # Run Jest test suite
npm run test:watch   # Run Jest in watch mode
```

## 🧪 Testing

The project is set up for **Jest + React Testing Library** so we can test UI components, route handlers, and pure business logic in a way that fits the current Next.js 16 app structure.

### Testing stack

- **Jest** for the test runner, assertions, mocking, and watch mode
- **React Testing Library** for component tests focused on user-visible behaviour
- **jest-dom** for DOM-specific assertions such as `toBeInTheDocument()`
- **next/jest** so Jest works cleanly with Next.js and the existing TypeScript configuration

### Current setup files

- `jest.config.js` - Main Jest configuration using `next/jest`
- `jest.setup.ts` - Shared test setup that loads `@testing-library/jest-dom`
- `package.json` - Test scripts such as `npm test` and `npm run test:watch`

### How to run tests

Run the full suite:

```bash
npm test
```

Run Jest in watch mode while developing:

```bash
npm run test:watch
```

If no tests have been written yet, Jest may report that no tests were found. That is expected during initial setup until the first test files are added.

### Recommended test structure

Keep tests inside a root `__tests__/` folder so the structure stays easy to scan as the project grows:

```text
__tests__/
├── api/          # Route handler tests
├── components/   # React component tests
└── lib/          # Pure utility and business-logic tests
```

Use these naming conventions:

- `*.test.ts` for utility, API, and non-React tests
- `*.test.tsx` for React component tests

Examples:

- `__tests__/components/chat-message.test.tsx`
- `__tests__/api/health.route.test.ts`
- `__tests__/lib/runway.test.ts`

### What we should test

Focus on testing behaviour that matters to users and developers:

- **Components**: what renders, what text appears, what happens when a user interacts
- **API route handlers**: status codes, JSON payloads, validation, and error handling
- **Utilities / formulas**: pure functions such as financial calculations or data transforms

Good candidates for tests in this repo include:

- authentication form behaviours
- health endpoint responses
- financial helpers such as runway or burn-rate calculations
- response helpers in `lib/api`

### Testing guidelines

Write tests that are small, readable, and focused on one behaviour at a time.

- Test what the user can observe, not implementation details
- Prefer accessible queries such as `getByRole`, `getByLabelText`, and `getByText`
- Avoid testing library internals, generated class names, or framework implementation details
- Keep business logic in small pure functions where possible so it is easy to test
- Mock external systems only when necessary, such as network calls, auth providers, or Supabase clients

### Component testing guidance

For React components:

- render the component with React Testing Library
- assert visible content and interactive behaviour
- prefer user-centric assertions over snapshot-heavy tests
- keep presentational components simple so they are easy to verify

Examples of useful assertions:

- the correct heading or message is shown
- a submit button becomes disabled while a request is in progress
- validation feedback appears when an API call fails

### API route testing guidance

For App Router route handlers under `app/api/.../route.ts`:

- import the exported `GET`, `POST`, or other handler directly
- call the handler in the test
- inspect the returned `Response` object
- assert status codes and JSON payload shape

This is usually simpler and faster than spinning up the full app server for every route test.

Typical things to check:

- success responses return the expected JSON structure
- invalid input returns the right error code and message
- protected routes reject unauthenticated requests

### Utility and formula testing guidance

Financial logic should live in plain helper functions whenever possible.

This makes it easier to:

- test calculations without involving UI or network layers
- reuse the same logic in route handlers and components
- reduce the amount of mocking required

Examples:

- runway months calculation
- burn-rate helpers
- API payload normalization

### Practical conventions for this repo

- Put shared helpers in `lib/` when they are framework-agnostic
- Keep route-specific logic in `app/api/.../route.ts`
- If a route becomes hard to test, move complex logic into `lib/` and test that helper directly
- Keep each test file close to one feature area and avoid giant mixed-purpose test files

### Before opening a PR

When test coverage exists for your feature, run:

```bash
npm test
npm run lint
```

Before merging work, aim to make sure:

- all relevant tests pass locally
- new logic includes tests where practical
- failing edge cases are covered for important financial or auth behaviour

### Future expansion

This setup is a starting point. As the project grows, we can extend it with:

- mocked Supabase integration tests
- more API route coverage
- scenario-planning calculation tests
- CI checks that run `npm test` automatically on pull requests

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
