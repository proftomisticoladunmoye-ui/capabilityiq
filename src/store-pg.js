// PostgreSQL store backend (production — Neon / any Postgres).
// Activated when DATABASE_URL is set. Mirrors the async interface of store-json.js.
// `makePgStore(pool)` takes any pg-compatible pool so it can be unit-tested (e.g. pg-mem).
//
// Timestamps are set in application code (not DB DEFAULTs) so the schema is portable
// across Postgres engines and verifiable without a live database.

import { randomUUID } from 'node:crypto';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT,
  org TEXT,
  password_salt TEXT,
  password_hash TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID,
  created_at TEXT,
  expires_at TEXT
);
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY,
  user_id UUID,
  responses JSONB,
  at TEXT
);
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  user_id UUID,
  hci REAL,
  data JSONB,
  generated_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY,
  user_id UUID,
  type TEXT, title TEXT, description TEXT,
  date TEXT, dimension_id TEXT, url TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY,
  user_id UUID, role TEXT, message TEXT, answer TEXT, source TEXT,
  at TEXT
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID, actor_email TEXT, action TEXT, target TEXT, ip TEXT,
  at TEXT
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

const now = () => new Date().toISOString();

// Map a users row → the camelCase shape the app expects.
function userRow(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, email: r.email, role: r.role, org: r.org,
    passwordSalt: r.password_salt, passwordHash: r.password_hash,
    createdAt: r.created_at,
  };
}

export function makePgStore(pool) {
  const q = (text, params) => pool.query(text, params);

  return {
    backend: 'postgres',
    async init() {
      // Run statements individually for portability across drivers/engines.
      for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
        await q(stmt);
      }
    },

    // ---- users ----------------------------------------------------------
    async upsertUser({ id, name, email, role = 'individual', org = null }) {
      if (email) {
        const found = (await q('SELECT * FROM users WHERE lower(email)=lower($1)', [email])).rows[0];
        if (found) {
          const u = (await q(
            'UPDATE users SET name=COALESCE($2,name), role=COALESCE($3,role), org=COALESCE($4,org) WHERE id=$1 RETURNING *',
            [found.id, name, role, org]
          )).rows[0];
          return userRow(u);
        }
      }
      const u = (await q(
        'INSERT INTO users(id,name,email,role,org,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [id || randomUUID(), name, email, role, org, now()]
      )).rows[0];
      return userRow(u);
    },
    async createUser({ name, email, role = 'individual', org = null, credentials }) {
      const u = (await q(
        'INSERT INTO users(id,name,email,role,org,password_salt,password_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [randomUUID(), name, email, role, org, credentials?.salt || null, credentials?.hash || null, now()]
      )).rows[0];
      return userRow(u);
    },
    async getUser(id) {
      return userRow((await q('SELECT * FROM users WHERE id=$1', [id])).rows[0]);
    },
    async findUserByEmail(email) {
      if (!email) return null;
      return userRow((await q('SELECT * FROM users WHERE lower(email)=lower($1)', [email])).rows[0]);
    },

    // ---- sessions -------------------------------------------------------
    async createSession({ userId, token, expiresAt }) {
      await q('INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)', [token, userId, now(), expiresAt]);
      return { token, userId, expiresAt };
    },
    async getSession(token) {
      if (!token) return null;
      const s = (await q('SELECT * FROM sessions WHERE token=$1', [token])).rows[0];
      if (!s) return null;
      if (new Date(s.expires_at).getTime() < Date.now()) {
        await q('DELETE FROM sessions WHERE token=$1', [token]);
        return null;
      }
      return { token: s.token, userId: s.user_id, expiresAt: s.expires_at };
    },
    async deleteSession(token) {
      await q('DELETE FROM sessions WHERE token=$1', [token]);
    },

    // ---- audit ----------------------------------------------------------
    async audit(entry) {
      await q(
        'INSERT INTO audit_logs(id,actor_id,actor_email,action,target,ip,at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), entry.actorId || null, entry.actorEmail || null, entry.action, entry.target || null, entry.ip || null, now()]
      );
      try {
        await q('DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY at DESC OFFSET 500)');
      } catch { /* trimming is best-effort */ }
    },
    async recentAudit(limit = 25) {
      const rows = (await q('SELECT * FROM audit_logs ORDER BY at DESC LIMIT $1', [limit])).rows;
      return rows.map((r) => ({
        id: r.id, actorId: r.actor_id, actorEmail: r.actor_email,
        action: r.action, target: r.target, ip: r.ip, at: r.at,
      }));
    },

    // ---- responses + profiles -------------------------------------------
    async saveResponses(userId, responses) {
      const id = randomUUID();
      await q('INSERT INTO responses(id,user_id,responses,at) VALUES($1,$2,$3,$4)', [id, userId, JSON.stringify(responses), now()]);
      return { id, userId, responses };
    },
    async saveProfile(userId, profile) {
      const id = randomUUID();
      await q('INSERT INTO profiles(id,user_id,hci,data,generated_at) VALUES($1,$2,$3,$4,$5)', [id, userId, profile.hci, JSON.stringify(profile), profile.generatedAt || now()]);
      return { id, userId, ...profile };
    },
    async latestProfile(userId) {
      const r = (await q('SELECT id,data FROM profiles WHERE user_id=$1 ORDER BY generated_at DESC LIMIT 1', [userId])).rows[0];
      return r ? { id: r.id, userId, ...r.data } : null;
    },
    async profileHistory(userId) {
      const rows = (await q('SELECT data FROM profiles WHERE user_id=$1 ORDER BY generated_at ASC', [userId])).rows;
      return rows.map((r) => r.data);
    },
    async allProfiles() {
      return (await q('SELECT data FROM profiles')).rows.map((r) => r.data);
    },
    async allResponses() {
      return (await q('SELECT responses FROM responses')).rows.map((r) => ({ responses: r.responses }));
    },

    // ---- portfolio ------------------------------------------------------
    async addPortfolioItem(userId, item) {
      const rec = {
        id: randomUUID(), userId,
        type: item.type, title: item.title, description: item.description || '',
        date: item.date || new Date().toISOString().slice(0, 10),
        dimensionId: item.dimensionId || null, url: item.url || '',
      };
      await q(
        'INSERT INTO portfolios(id,user_id,type,title,description,date,dimension_id,url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [rec.id, userId, rec.type, rec.title, rec.description, rec.date, rec.dimensionId, rec.url, now()]
      );
      return rec;
    },
    async listPortfolio(userId) {
      const rows = (await q('SELECT * FROM portfolios WHERE user_id=$1 ORDER BY created_at ASC', [userId])).rows;
      return rows.map((r) => ({
        id: r.id, userId: r.user_id, type: r.type, title: r.title,
        description: r.description, date: r.date, dimensionId: r.dimension_id, url: r.url,
      }));
    },
    async deletePortfolioItem(userId, id) {
      const r = await q('DELETE FROM portfolios WHERE user_id=$1 AND id=$2', [userId, id]);
      return (r.rowCount || 0) > 0;
    },

    // ---- AI logs --------------------------------------------------------
    async logAI(userId, entry) {
      await q(
        'INSERT INTO ai_logs(id,user_id,role,message,answer,source,at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), userId, entry.role || null, entry.message || null, entry.answer || null, entry.source || null, now()]
      );
    },

    async reset() {
      for (const t of ['users', 'sessions', 'responses', 'profiles', 'portfolios', 'ai_logs', 'audit_logs']) {
        await q(`DELETE FROM ${t}`);
      }
    },
  };
}
