// Verifies the PostgreSQL store backend against an in-memory Postgres (pg-mem),
// so the SQL + schema are exercised without a live database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgStore } from '../src/store-pg.js';

function freshStore() {
  // noAstCoverageCheck: pg-mem otherwise rejects perfectly valid DDL (inline
  // PRIMARY KEY / UNIQUE) out of caution — disable that paranoia for the harness.
  const db = newDb({ noAstCoverageCheck: true });
  const { Pool } = db.adapters.createPg();
  return makePgStore(new Pool());
}

test('init creates schema and is idempotent', async () => {
  const store = freshStore();
  await store.init();
  await store.init(); // running twice must not throw (IF NOT EXISTS)
  assert.equal(store.backend, 'postgres');
});

test('user + session lifecycle', async () => {
  const store = freshStore();
  await store.init();

  const user = await store.createUser({
    name: 'Ada', email: 'ada@x.com', role: 'researcher',
    credentials: { salt: 's', hash: 'h' },
  });
  assert.ok(user.id);
  assert.equal(user.passwordHash, 'h');

  const byEmail = await store.findUserByEmail('ADA@X.COM'); // case-insensitive
  assert.equal(byEmail.id, user.id);
  const byId = await store.getUser(user.id);
  assert.equal(byId.email, 'ada@x.com');

  await store.createSession({ userId: user.id, token: 'tok1', expiresAt: new Date(Date.now() + 60000).toISOString() });
  const s = await store.getSession('tok1');
  assert.equal(s.userId, user.id);

  await store.deleteSession('tok1');
  assert.equal(await store.getSession('tok1'), null);

  // expired session is rejected + cleaned
  await store.createSession({ userId: user.id, token: 'old', expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(await store.getSession('old'), null);
});

test('responses + profiles round-trip and aggregate', async () => {
  const store = freshStore();
  await store.init();
  const u = await store.createUser({ name: 'B', email: 'b@x.com', role: 'student', credentials: {} });

  await store.saveResponses(u.id, { knowledge_1: 5, knowledge_2: 6 });
  const profile = { hci: 72.5, level: { label: 'Advanced' }, perDimension: { knowledge: 80 }, readiness: { career: 70 }, generatedAt: new Date().toISOString() };
  const saved = await store.saveProfile(u.id, profile);
  assert.equal(saved.hci, 72.5);

  const latest = await store.latestProfile(u.id);
  assert.equal(latest.hci, 72.5);
  assert.equal(latest.perDimension.knowledge, 80);
  assert.equal(latest.userId, u.id);

  const all = await store.allProfiles();
  assert.equal(all.length, 1);
  assert.equal(all[0].hci, 72.5);

  const resp = await store.allResponses();
  assert.equal(resp.length, 1);
  assert.equal(resp[0].responses.knowledge_1, 5);

  const history = await store.profileHistory(u.id);
  assert.equal(history.length, 1);
});

test('portfolio CRUD', async () => {
  const store = freshStore();
  await store.init();
  const u = await store.createUser({ name: 'C', email: 'c@x.com', role: 'individual', credentials: {} });

  const item = await store.addPortfolioItem(u.id, { type: 'project', title: 'Thesis', dimensionId: 'knowledge' });
  assert.ok(item.id);
  let list = await store.listPortfolio(u.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Thesis');

  const removed = await store.deletePortfolioItem(u.id, item.id);
  assert.equal(removed, true);
  list = await store.listPortfolio(u.id);
  assert.equal(list.length, 0);
});

test('audit trail records and reads back newest-first', async () => {
  const store = freshStore();
  await store.init();
  await store.audit({ actorEmail: 'a@x.com', action: 'signup', target: 'researcher' });
  await store.audit({ actorEmail: 'a@x.com', action: 'login' });
  const entries = await store.recentAudit(10);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].action, 'login'); // most recent first
  assert.equal(entries[1].target, 'researcher');
});

test('reset clears all tables', async () => {
  const store = freshStore();
  await store.init();
  const u = await store.createUser({ name: 'D', email: 'd@x.com', role: 'individual', credentials: {} });
  await store.saveProfile(u.id, { hci: 50 });
  await store.reset();
  assert.equal((await store.allProfiles()).length, 0);
  assert.equal(await store.findUserByEmail('d@x.com'), null);
});
