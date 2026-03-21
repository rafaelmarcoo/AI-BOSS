# AI-BOSS

> AI-powered Financial Advisor for SME Founders

**AUT Final Year Project 2025**  
**Team:** Rafael Manubay (Tech Lead), Mohaned, Kaiden, Hamza, Akshay  
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
├── app/                  # Next.js 16 App Router (at root!)
│   ├── api/              # API routes (we'll create)
│   ├── favicon.ico       # Site icon
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
├── lib/                  # Utilities & helpers
├── types/                # TypeScript types
├── docs/                 # Documentation
├── public/               # Static assets
├── next.config.ts        # Next.js config (TypeScript)
├── tsconfig.json         # TypeScript config
└── package.json
```

**Note:** Next.js 16 uses root-level `app/` folder (no `src/`)

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
- Message Rafael

---

**Built with Next.js 16 🚀**