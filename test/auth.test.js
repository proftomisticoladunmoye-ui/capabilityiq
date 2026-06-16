// Auth primitives + RBAC policy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, newToken,
  canAccess, allowedAreas, publicUser, validateSignup, ROLES,
} from '../src/auth.js';

test('password hash round-trips and rejects wrong passwords', () => {
  const { salt, hash } = hashPassword('correct horse battery');
  assert.ok(salt && hash);
  assert.equal(verifyPassword('correct horse battery', salt, hash), true);
  assert.equal(verifyPassword('wrong', salt, hash), false);
  assert.equal(verifyPassword('correct horse battery', salt, 'deadbeef'), false);
});

test('two hashes of the same password differ (random salt)', () => {
  const a = hashPassword('same');
  const b = hashPassword('same');
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.salt, b.salt);
});

test('newToken is a 64-char hex string and unique', () => {
  const t1 = newToken(), t2 = newToken();
  assert.match(t1, /^[0-9a-f]{64}$/);
  assert.notEqual(t1, t2);
});

test('RBAC: restricted areas only allow the right roles', () => {
  // research: faculty / government / researcher
  assert.equal(canAccess('researcher', 'research'), true);
  assert.equal(canAccess('faculty', 'research'), true);
  assert.equal(canAccess('individual', 'research'), false);
  assert.equal(canAccess('student', 'research'), false);
  assert.equal(canAccess('employer', 'research'), false);

  // institutional: faculty / employer / government / researcher
  assert.equal(canAccess('employer', 'institutional'), true);
  assert.equal(canAccess('individual', 'institutional'), false);

  // unknown / open area → everyone
  assert.equal(canAccess('individual', 'dashboard'), true);
});

test('allowedAreas reflects the policy for a role', () => {
  const individual = allowedAreas('individual');
  assert.equal(individual.research, false);
  assert.equal(individual.institutional, false);

  const researcher = allowedAreas('researcher');
  assert.equal(researcher.research, true);
  assert.equal(researcher.institutional, true);
});

test('publicUser strips credentials', () => {
  const safe = publicUser({ id: '1', name: 'A', email: 'a@x.com', role: 'individual', passwordSalt: 's', passwordHash: 'h' });
  assert.equal(safe.passwordSalt, undefined);
  assert.equal(safe.passwordHash, undefined);
  assert.equal(safe.email, 'a@x.com');
});

test('validateSignup enforces name, email, and password length', () => {
  assert.match(validateSignup({ name: '', email: 'a@x.com', password: 'longenough' }), /name/i);
  assert.match(validateSignup({ name: 'A', email: 'bad', password: 'longenough' }), /email/i);
  assert.match(validateSignup({ name: 'A', email: 'a@x.com', password: 'short' }), /8/);
  assert.equal(validateSignup({ name: 'A', email: 'a@x.com', password: 'longenough' }), null);
});

test('ROLES contains the six expected roles', () => {
  assert.deepEqual([...ROLES].sort(), ['employer', 'faculty', 'government', 'individual', 'researcher', 'student'].sort());
});
