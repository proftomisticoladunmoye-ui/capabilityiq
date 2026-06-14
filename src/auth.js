// Authentication & authorisation core.
// Password hashing (scrypt, no external dependencies), opaque revocable session
// tokens, and a role-based access-control policy. The OAuth providers (Google /
// Microsoft / Apple) plug in at the documented seam in server.js — this module owns
// the local credential and RBAC logic that production SSO would delegate to.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// ---- password hashing ---------------------------------------------------
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function newToken() {
  return randomBytes(32).toString('hex');
}

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---- roles & RBAC -------------------------------------------------------
export const ROLES = ['individual', 'student', 'faculty', 'employer', 'government', 'researcher'];

// Restricted areas → the roles permitted to use them. Any area not listed here is
// available to every authenticated user (their own dashboard, assessment, coach, etc.).
export const AREA_ACCESS = {
  institutional: ['faculty', 'employer', 'government', 'researcher'],
  research: ['faculty', 'government', 'researcher'],
  audit: ['government', 'researcher', 'employer', 'faculty'],
};

export function canAccess(role, area) {
  const allowed = AREA_ACCESS[area];
  return allowed ? allowed.includes(role) : true;
}

// The map the frontend uses to hide nav items it must not show. The backend still
// enforces every rule independently — this is presentation only.
export function allowedAreas(role) {
  return Object.fromEntries(Object.keys(AREA_ACCESS).map((area) => [area, canAccess(role, area)]));
}

// Strip secrets before a user object ever leaves the server.
export function publicUser(u) {
  if (!u) return null;
  const { passwordSalt, passwordHash, ...safe } = u;
  return safe;
}

// Basic input validation for sign-up.
export function validateSignup({ name, email, password }) {
  if (!name || !name.trim()) return 'Name is required';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'A valid email is required';
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  return null;
}
