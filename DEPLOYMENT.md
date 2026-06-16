# Deploying Capability IQ™

The recommended stack is **Render** (app, auto-deploys from GitHub) + **Neon**
(free, persistent PostgreSQL) + your **Hostinger domain** (via DNS). Total cost: $0.

> Why not Hostinger shared hosting? It runs PHP, not a persistent Node.js server, so
> it can't host this app. Use a Hostinger **VPS** (see the bottom of this file) only if
> you specifically want everything on Hostinger.

The data layer auto-switches: with `DATABASE_URL` set it uses PostgreSQL; without it,
it falls back to a local JSON file (great for development).

---

## 1. Create the database (Neon — free, persistent)

1. Sign up at <https://neon.tech> and create a project (any region near your users).
2. Open **Connection Details** and copy the **connection string** — it looks like:
   `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
3. Keep it handy — this is your `DATABASE_URL`.

Neon's free tier is persistent (it does **not** expire like Render's own free Postgres).

---

## 2. Deploy the app (Render)

1. Push this repo to GitHub (already done).
2. At <https://render.com> → **New ▸ Blueprint**, connect the repo. Render reads
   [`render.yaml`](render.yaml) and proposes the `capability-iq` web service.
   *(Or: New ▸ Web Service → Build `npm install`, Start `npm start`.)*
3. Add environment variables (Dashboard ▸ the service ▸ **Environment**):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `OPENROUTER_API_KEY` | your OpenRouter key (AI coach) |
   | `OPENROUTER_MODEL` | `anthropic/claude-opus-4.8` (or a faster slug) |
   | `NODE_VERSION` | `22` |
4. Deploy. On boot the server creates its tables automatically (`initStore`). Watch the
   logs for `Capability IQ™ … Data: postgres`.

**Auto-deploy:** every `git push` to `main` redeploys. Because data is in Neon, redeploys
never lose anything.

**Free-tier note:** the service sleeps after ~15 min idle; the first request after a nap
takes ~30s to wake. Upgrade to a paid instance to keep it always-on.

### Seed demo cohort data (optional)
To populate the Institutional/Research dashboards, open the service's **Shell** in Render
and run (it reads `DATABASE_URL` from the environment):
```bash
npm run seed 200 "Demo University"
```

---

## 3. Connect your Hostinger domain

1. In Render: **Settings ▸ Custom Domains ▸ Add** your domain (e.g. `app.yourdomain.com`
   or the apex `yourdomain.com`). Render shows the DNS target(s).
2. In **Hostinger hPanel ▸ Domains ▸ DNS / Nameservers ▸ DNS Zone**, add what Render asks:
   - **Subdomain** (e.g. `app`): add a **CNAME** record → the Render hostname.
   - **Apex/root** (`yourdomain.com`): add the **A record(s)** Render lists (or an ALIAS
     if offered). If you prefer, point `www` via CNAME and redirect apex → `www`.
3. Wait for DNS to propagate (minutes to a couple of hours). Render issues a **free SSL
   certificate** automatically — your site is then live at `https://yourdomain.com`.

---

## Environment variables reference

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | prod | Postgres connection (Neon). Omit locally to use the JSON store. |
| `OPENROUTER_API_KEY` | optional | Powers the AI coach. Without it, the deterministic engine is used. |
| `OPENROUTER_MODEL` | optional | Default `anthropic/claude-opus-4.8`. |
| `PORT` | auto | Set by Render; defaults to 3000 locally. |
| `PGSSL` | optional | Set to `disable` only for a non-TLS local Postgres. |

---

## Alternative: Hostinger VPS

If you want everything on Hostinger, use a **VPS** (not shared hosting):
```bash
ssh root@your-vps
# install Node 20+ (nvm or NodeSource), then:
git clone https://github.com/proftomisticoladunmoye-ui/capabilityiq.git
cd capabilityiq && npm install
printf 'DATABASE_URL=postgresql://...\nOPENROUTER_API_KEY=sk-or-...\nPORT=3000\n' > .env
npm run seed 200            # optional
npm i -g pm2 && pm2 start "npm start" --name capability-iq && pm2 save
```
Then put **nginx** in front (reverse-proxy `:80/:443` → `:3000`) and add a Let's Encrypt
cert with `certbot`. You can use Neon for the database here too, or install Postgres on
the VPS. Deploys are a manual `git pull && pm2 restart capability-iq` (automatable with a
GitHub Action over SSH later).
