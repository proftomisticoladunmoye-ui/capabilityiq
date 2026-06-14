// Lightweight zero-dependency JSON store.
// Persists the platform's domain entities to ./data/db.json. In production this maps
// onto the PostgreSQL schema (users, assessments, responses, portfolios, reports …);
// the interface here is deliberately repository-shaped so it can be swapped out.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'db.json');

const EMPTY = {
  users: [],
  profiles: [], // computed HCI intelligence profiles
  responses: [], // raw assessment responses
  portfolios: [], // portfolio evidence items keyed by userId
  institutions: [],
  aiLogs: [],
  sessions: [], // active auth sessions: { token, userId, createdAt, expiresAt }
  auditLogs: [], // security audit trail
};

function load() {
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY);
  try {
    const raw = JSON.parse(readFileSync(DB_PATH, 'utf8'));
    return { ...structuredClone(EMPTY), ...raw };
  } catch {
    return structuredClone(EMPTY);
  }
}

let db = load();

function persist() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

export const store = {
  // ---- users ------------------------------------------------------------
  upsertUser({ id, name, email, role = 'individual', org = null }) {
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
  // Create a credentialed account. `credentials` carries { salt, hash }.
  createUser({ name, email, role = 'individual', org = null, credentials }) {
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
  getUser(id) {
    return db.users.find((u) => u.id === id) || null;
  },
  findUserByEmail(email) {
    if (!email) return null;
    const e = email.toLowerCase();
    return db.users.find((u) => (u.email || '').toLowerCase() === e) || null;
  },
  listUsers() {
    return db.users;
  },

  // ---- sessions ---------------------------------------------------------
  createSession({ userId, token, expiresAt }) {
    const rec = { token, userId, createdAt: new Date().toISOString(), expiresAt };
    db.sessions.push(rec);
    persist();
    return rec;
  },
  getSession(token) {
    if (!token) return null;
    const s = db.sessions.find((x) => x.token === token);
    if (!s) return null;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      this.deleteSession(token);
      return null;
    }
    return s;
  },
  deleteSession(token) {
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.token !== token);
    if (db.sessions.length !== before) persist();
  },

  // ---- audit ------------------------------------------------------------
  audit(entry) {
    db.auditLogs.push({ id: randomUUID(), ...entry, at: new Date().toISOString() });
    // keep the trail bounded
    if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(-500);
    persist();
  },
  recentAudit(limit = 25) {
    return db.auditLogs.slice(-limit).reverse();
  },

  // ---- assessment responses + profiles ---------------------------------
  saveResponses(userId, responses) {
    const rec = { id: randomUUID(), userId, responses, at: new Date().toISOString() };
    db.responses.push(rec);
    persist();
    return rec;
  },
  saveProfile(userId, profile) {
    const rec = { id: randomUUID(), userId, ...profile };
    db.profiles.push(rec);
    persist();
    return rec;
  },
  latestProfile(userId) {
    const mine = db.profiles.filter((p) => p.userId === userId);
    return mine.length ? mine[mine.length - 1] : null;
  },
  profileHistory(userId) {
    return db.profiles.filter((p) => p.userId === userId);
  },
  allProfiles() {
    return db.profiles;
  },

  // ---- portfolio --------------------------------------------------------
  addPortfolioItem(userId, item) {
    const rec = {
      id: randomUUID(),
      userId,
      type: item.type,
      title: item.title,
      description: item.description || '',
      date: item.date || new Date().toISOString().slice(0, 10),
      dimensionId: item.dimensionId || null,
      url: item.url || '',
      createdAt: new Date().toISOString(),
    };
    db.portfolios.push(rec);
    persist();
    return rec;
  },
  listPortfolio(userId) {
    return db.portfolios.filter((p) => p.userId === userId);
  },
  deletePortfolioItem(userId, id) {
    const before = db.portfolios.length;
    db.portfolios = db.portfolios.filter((p) => !(p.userId === userId && p.id === id));
    persist();
    return db.portfolios.length < before;
  },

  // ---- AI coach logs ----------------------------------------------------
  logAI(userId, entry) {
    db.aiLogs.push({ id: randomUUID(), userId, ...entry, at: new Date().toISOString() });
    persist();
  },

  reset() {
    db = structuredClone(EMPTY);
    persist();
  },
  raw() {
    return db;
  },
};
