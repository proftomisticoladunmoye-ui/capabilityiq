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
dashboard. No database or API keys are required locally — the platform runs fully
standalone on a JSON file store and the deterministic AI coach.

> If port 3000 is busy, set `PORT` (e.g. `set PORT=4000 && npm start` on Windows,
> `PORT=4000 npm start` on macOS/Linux). Run the test suite with `npm test`.

## Deploy

Recommended: **Render** (app, auto-deploys from GitHub) + **Neon** (free persistent
PostgreSQL) + your domain. The data layer switches to Postgres automatically when
`DATABASE_URL` is set. Full walkthrough — including pointing a Hostinger domain at it —
in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

> Hostinger *shared* hosting can't run this (it's PHP-only); use Render/a Node host, or a
> Hostinger **VPS**.

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
| **IRT · Rasch (Rating Scale Model)** | ✅ Live | Andrich RSM via JMLE — item difficulties, step thresholds, person abilities, infit/outfit, separation & reliability, Wright map, category curves |
| **Reporting & Export** | ✅ Live | PDF (print) · **Word .docx · Excel .xlsx · PowerPoint .pptx** · JSON · CSV — all generated server-side |
| **Auth, RBAC & Audit** | ✅ Live | Password accounts (scrypt), revocable session tokens, role-based access control, audit trail; OAuth seam |

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
│  ├─ irt.js              Rasch Rating Scale Model (JMLE, fit, Wright map, curves)
│  ├─ auth.js             Password hashing, session tokens, RBAC policy
│  ├─ exporters.js        Word / Excel / PowerPoint document generators
│  ├─ reports.js          CSV / HTML(PDF) generation + portfolio analytics
│  ├─ store.js            Backend selector (Postgres if DATABASE_URL, else JSON)
│  ├─ store-pg.js         PostgreSQL backend (async)
│  └─ store-json.js       JSON-file backend (async, local dev)
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

- `store.js` selects a backend by `DATABASE_URL`: **PostgreSQL** (`store-pg.js`) in
  production, or a local **JSON file** (`store-json.js`) for zero-config development —
  both implement the same async interface.
- The Express routes are the API contract → re-host under NestJS unchanged.
- `hci.js`, `psychometrics.js`, `efa.js`, `cfa.js` and `irt.js` are pure functions → the
  Node analytics engine (descriptives, Cronbach α, McDonald's ω, item-total correlations,
  eigendecomposition, varimax EFA, ML CFA with full fit indices, KMO/Bartlett, Rasch RSM
  via JMLE) can be extended or swapped for a FastAPI/R service (full SEM, 2PL/GRM IRT)
  without changing the frontend.
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
| GET | `/api/framework` | Dimensions, levels, coach roles, roles |
| GET | `/api/assessment` | The 60-item instrument |
| POST | `/api/auth/signup` | Create a credentialed account → session token |
| POST | `/api/auth/login` | Authenticate → session token |
| POST | `/api/auth/logout` | Revoke the current session token |
| GET | `/api/auth/me` | Current user, allowed areas + latest profile |
| POST | `/api/auth/oauth/:provider` | OAuth seam (Google/Microsoft/Apple) |
| GET | `/api/audit` | Security audit trail *(RBAC: institutional roles)* |
| POST | `/api/assessment/submit` | Score responses → HCI profile |
| GET | `/api/profile` | Latest profile + HCI history |
| POST | `/api/coach` | Ask the AI Capability Coach |
| GET/POST/DELETE | `/api/portfolio` | Portfolio CRUD + analytics |
| GET | `/api/institutional` | Cohort intelligence aggregate |
| GET | `/api/research/psychometrics` | Reliability + item analysis across the cohort |
| GET | `/api/research/correlation/:dimensionId` | Inter-item correlation matrix |
| GET | `/api/research/efa` | Exploratory factor analysis across the 12 dimensions |
| GET | `/api/research/cfa` | Confirmatory factor analysis of the 3-factor model + fit indices |
| GET | `/api/research/rasch/:dimensionId` | Rasch (RSM) item calibration for a dimension |
| GET | `/api/report.{html,docx,xlsx,pptx,json,csv}` | Exports |

Every route except `/api/framework`, `/api/assessment` and the auth endpoints requires a
`Authorization: Bearer <token>` session token.

---

## Security & access control

**Live in this build:**
- **Password accounts** — scrypt-hashed (salt + 64-byte derived key, constant-time compare), no external crypto deps
- **Session tokens** — opaque 256-bit random tokens, server-side and revocable (logout deletes them), 7-day TTL
- **Role-based access control** — six roles; the Institutional dashboard, Research Analytics and audit trail are restricted to institutional/research roles. Enforced on the backend (401/403) and reflected in the UI (restricted nav hidden, routes guarded)
- **Audit trail** — signup, login, failed login, logout, exports and access-denied events are logged with actor, action, target, IP and timestamp; viewable by institutional roles

```
Role → restricted-area access
 individual / student   →  own dashboard, assessment, coach, portfolio, career, dev, benchmarking, reports
 faculty / employer / government / researcher  →  the above + Institutional + audit
 faculty / government / researcher              →  + Research Analytics
```

**OAuth (Google/Microsoft/Apple)** is wired at `/api/auth/oauth/:provider` and surfaced in
the sign-in modal; it returns `501 oauth_not_configured` until provider `CLIENT_ID/SECRET`
and a redirect URI are supplied — then it mints a session exactly like `/login`.

**Production hardening** (not in this reference build): MFA, encryption at rest, GDPR
data-subject tooling and ISO 27001 alignment layer onto these same isolated seams.

---

© Capability IQ™ — Measure. Develop. Predict. Amplify Human Capability.
