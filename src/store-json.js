// JSON-file store backend (default for local development — zero dependencies).
// Implements the async store interface; the Postgres backend in store-pg.js mirrors it.
// Activated when DATABASE_URL is NOT set.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'db.json');

const EMPTY = {
  users: [], profiles: [], responses: [], portfolios: [],
  aiLogs: [], sessions: [], auditLogs: [],
};

function load() {
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY);
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_PATH, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

let db = load();

function persist() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function removeSession(token) {
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.token !== token);
  if (db.sessions.length !== before) persist();
}

export const jsonStore = {
  backend: 'json',
  async init() { /* nothing to initialise */ },

  // ---- users ------------------------------------------------------------
  async upsertUser({ id, name, email, role = 'individual', org = null }) {
    let user = id ? db.users.find((u) => u.id === id) : null;
    if (!user && email) user = db.users.find((u) => u.email === email);
    if (user) {
      Object.assign(user, { name: name ?? user.name, role: role ?? user.role, org: org ?? user.org });
    } else {
      user = { id: randomUUID(), name, email, role, org, createdAt: new Date().toISOString() };
      db.users.push(user);
    }
    persist();
    return user;
  },
  async createUser({ name, email, role = 'individual', org = null, credentials }) {
    const user = {
      id: randomUUID(), name, email, role, org,
      passwordSalt: credentials?.salt || null,
      passwordHash: credentials?.hash || null,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    persist();
    return user;
  },
  async getUser(id) {
    return db.users.find((u) => u.id === id) || null;
  },
  async findUserByEmail(email) {
    if (!email) return null;
    const e = email.toLowerCase();
    return db.users.find((u) => (u.email || '').toLowerCase() === e) || null;
  },

  // ---- sessions ---------------------------------------------------------
  async createSession({ userId, token, expiresAt }) {
    const rec = { token, userId, createdAt: new Date().toISOString(), expiresAt };
    db.sessions.push(rec);
    persist();
    return rec;
  },
  async getSession(token) {
    if (!token) return null;
    const s = db.sessions.find((x) => x.token === token);
    if (!s) return null;
    if (new Date(s.expiresAt).getTime() < Date.now()) { removeSession(token); return null; }
    return s;
  },
  async deleteSession(token) { removeSession(token); },

  // ---- audit ------------------------------------------------------------
  async audit(entry) {
    db.auditLogs.push({ id: randomUUID(), ...entry, at: new Date().toISOString() });
    if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(-500);
    persist();
  },
  async recentAudit(limit = 25) {
    return db.auditLogs.slice(-limit).reverse();
  },

  // ---- responses + profiles --------------------------------------------
  async saveResponses(userId, responses) {
    const rec = { id: randomUUID(), userId, responses, at: new Date().toISOString() };
    db.responses.push(rec);
    persist();
    return rec;
  },
  async saveProfile(userId, profile) {
    const rec = { id: randomUUID(), userId, ...profile };
    db.profiles.push(rec);
    persist();
    return rec;
  },
  async latestProfile(userId) {
    const mine = db.profiles.filter((p) => p.userId === userId);
    return mine.length ? mine[mine.length - 1] : null;
  },
  async profileHistory(userId) {
    return db.profiles.filter((p) => p.userId === userId);
  },
  async allProfiles() {
    return db.profiles;
  },
  async allResponses() {
    return db.responses;
  },

  // ---- portfolio --------------------------------------------------------
  async addPortfolioItem(userId, item) {
    const rec = {
      id: randomUUID(), userId,
      type: item.type, title: item.title, description: item.description || '',
      date: item.date || new Date().toISOString().slice(0, 10),
      dimensionId: item.dimensionId || null, url: item.url || '',
      createdAt: new Date().toISOString(),
    };
    db.portfolios.push(rec);
    persist();
    return rec;
  },
  async listPortfolio(userId) {
    return db.portfolios.filter((p) => p.userId === userId);
  },
  async deletePortfolioItem(userId, id) {
    const before = db.portfolios.length;
    db.portfolios = db.portfolios.filter((p) => !(p.userId === userId && p.id === id));
    persist();
    return db.portfolios.length < before;
  },

  // ---- AI logs ----------------------------------------------------------
  async logAI(userId, entry) {
    db.aiLogs.push({ id: randomUUID(), userId, ...entry, at: new Date().toISOString() });
    persist();
  },

  async reset() { db = structuredClone(EMPTY); persist(); },
};
