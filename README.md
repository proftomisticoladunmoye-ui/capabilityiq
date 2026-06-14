# Capability IQ™

### Measure. Develop. Predict. Amplify Human Capability.

A **Human Capability Intelligence Platform** — the operating system for measuring,
developing, benchmarking, predicting and amplifying human capability. Built in Node.js,
this is a fully runnable reference implementation of the Capability IQ vision: the
flagship **Human Capability Index (HCI)**, a 12-dimension psychometric assessment engine,
an AI Capability Coach, a capability portfolio, benchmarking, institutional analytics and
multi-format reporting.

---

## Quick start

```bash
npm install
npm run seed 200 # optional: generate a synthetic cohort (3-factor latent structure)
                 #           powers the Institutional and Research Analytics dashboards
npm start        # → http://localhost:3000
```

Then open the URL, click **Get started**, complete the assessment, and explore your
dashboard. No database or API keys are required — the platform runs fully standalone.

> If port 3000 is busy, set `PORT` (e.g. `set PORT=4000 && npm start` on Windows,
> `PORT=4000 npm start` on macOS/Linux).

---

## What's implemented (live)

| Module | Status | Notes |
|---|---|---|
| **Capability Assessment Engine** | ✅ Live | 12 dimensions × 5 items (60 items), 7-point Likert, reverse-keyed items, 0–100 normalisation |
| **Human Capability Index (HCI)** | ✅ Live | Weighted composite, 5 maturity bands (Foundational → Elite) |
| **Capability Dashboard** | ✅ Live | HCI hero, radar, capability wheel, 24-month trajectory forecast, strengths/gaps/risks |
| **AI Capability Coach** | ✅ Live | 6 coaching domains; profile-grounded; deterministic engine + optional LLM (Claude/OpenAI) |
| **Capability Portfolio** | ✅ Live | Evidence items, evidence score, portfolio-strength analytics |
| **Career Intelligence** | ✅ Live | Career-fit scoring, emerging roles, mobility & risk |
| **Development Engine** | ✅ Live | 90-day / 1-year / 5-year plans + trajectory projection |
| **Benchmarking Engine** | ✅ Live | Peer / institution / industry / country / continent / global norms + percentiles |
| **Institutional Intelligence** | ✅ Live | Cohort heat map, HCI distribution, dimension league table |
| **Research Analytics (psychometrics)** | ✅ Live | Cronbach's α, McDonald's ω, item-total correlations, descriptive stats (skew/kurtosis), inter-item correlation matrix |
| **Exploratory Factor Analysis** | ✅ Live | Jacobi eigendecomposition, Kaiser retention, varimax rotation, KMO & Bartlett's test, scree plot, factor loadings & communalities |
| **Confirmatory Factor Analysis** | ✅ Live | ML fit of the 3-factor model — χ²/CFI/TLI/RMSEA/SRMR, standardised loadings, AVE, composite reliability, Fornell-Larcker discriminant validity |
| **Reporting & Export** | ✅ Live | PDF (print) · **Word .docx · Excel .xlsx · PowerPoint .pptx** · JSON · CSV — all generated server-side |

The 12 dimensions: **Knowledge Intelligence · Value Creation Skills · Initiative &
Evidence Portfolio · Exposure & Perspective · Identity, Reputation & Influence ·
Cognitive Architecture · Human Collaboration Intelligence · Learning Agility · Digital
Intelligence · AI Partnership Capability · Entrepreneurial Value Creation · Wellbeing &
Resilience Capital.**

---

## Architecture

```
capability-iq/
├─ server.js              Express app + JSON API
├─ src/
│  ├─ capabilities.js     The 12-dimension framework + HCI maturity bands
│  ├─ assessment.js       Question bank, Likert config, response scoring
│  ├─ hci.js              HCI composite, readiness, gaps, growth, forecast, benchmark
│  ├─ ai-coach.js         Profile-grounded coach (deterministic + optional LLM)
│  ├─ psychometrics.js    Reliability (α/ω), item analysis, correlation matrices
│  ├─ efa.js              Exploratory factor analysis (eigen, varimax, KMO, Bartlett)
│  ├─ cfa.js              Confirmatory factor analysis (ML fit, fit indices, AVE/CR)
│  ├─ exporters.js        Word / Excel / PowerPoint document generators
│  ├─ reports.js          CSV / HTML(PDF) generation + portfolio analytics
│  └─ store.js            Zero-dependency JSON persistence (repository-shaped)
├─ public/
│  ├─ index.html          SPA shell (Inter / Poppins / Merriweather, ECharts)
│  ├─ css/styles.css      Design system: tokens, components, responsive grid
│  └─ js/
│     ├─ app.js           Router, state, all views
│     └─ charts.js        ECharts factories (radar, wheel, gauge, heat, forecast)
└─ scripts/seed.js        Synthetic cohort generator
```

**Design system** — three-colour brand (Deep Navy `#0B2545`, Burnt Gold `#B8860B`,
Slate Grey `#5C677D`), Inter/Poppins/Merriweather type, mobile-first responsive grid
(desktop → laptop → tablet → mobile breakpoints, no horizontal scroll).

### Why this stack

The full product spec calls for Next.js + NestJS + FastAPI + Postgres/Redis/Mongo +
Python analytics. This reference build implements the **same domain logic and contracts**
in a single zero-friction Node.js service so the platform actually *runs and demonstrates*
end-to-end. Each boundary is shaped for the production swap:

- `store.js` exposes a repository interface → drop-in PostgreSQL/Prisma.
- The Express routes are the API contract → re-host under NestJS unchanged.
- `hci.js`, `psychometrics.js`, `efa.js` and `cfa.js` are pure functions → the Node
  analytics engine (descriptives, Cronbach α, McDonald's ω, item-total correlations,
  eigendecomposition, varimax EFA, ML CFA with full fit indices, KMO/Bartlett) can be
  extended or swapped for a FastAPI/R service (IRT/Rasch, SEM) without changing the frontend.
- `ai-coach.js` already speaks to Anthropic/OpenAI; add a vector store for RAG.

---

## AI Capability Coach

Runs a deterministic, profile-aware reasoning engine out of the box. To connect a live
LLM, copy `.env.example` → `.env` and add a key:

```bash
ANTHROPIC_API_KEY=sk-ant-...      # preferred (claude-opus-4-8)
# or
OPENAI_API_KEY=sk-...
```

The coach injects the user's full HCI profile (scores, gaps, readiness, forecast) as
grounding context so every answer is specific to the individual.

---

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/framework` | Dimensions, levels, coach roles |
| GET | `/api/assessment` | The 60-item instrument |
| POST | `/api/session` | Create / resume a user |
| GET | `/api/me` | Current user + latest profile |
| POST | `/api/assessment/submit` | Score responses → HCI profile |
| GET | `/api/profile` | Latest profile + HCI history |
| POST | `/api/coach` | Ask the AI Capability Coach |
| GET/POST/DELETE | `/api/portfolio` | Portfolio CRUD + analytics |
| GET | `/api/institutional` | Cohort intelligence aggregate |
| GET | `/api/research/psychometrics` | Reliability + item analysis across the cohort |
| GET | `/api/research/correlation/:dimensionId` | Inter-item correlation matrix |
| GET | `/api/research/efa` | Exploratory factor analysis across the 12 dimensions |
| GET | `/api/research/cfa` | Confirmatory factor analysis of the 3-factor model + fit indices |
| GET | `/api/report.{html,docx,xlsx,pptx,json,csv}` | Exports |

Auth in this build is a header shim (`x-user-id`); the route contract is unchanged when
OAuth/RBAC/MFA is layered in for production.

---

## Security & compliance (production design)

RBAC, MFA, OAuth (Google/Microsoft/Apple), audit logging, encryption at rest/in transit,
GDPR data-subject controls and ISO 27001 alignment are part of the platform's security
architecture. This reference build ships the application and data model; the auth shim is
the single, isolated integration point.

---

© Capability IQ™ — Measure. Develop. Predict. Amplify Human Capability.
