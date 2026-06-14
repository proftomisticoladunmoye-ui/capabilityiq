// Capability IQ™ — application server.
// Serves the SPA and the JSON API for assessment, profiling, AI coaching,
// portfolio, benchmarking, institutional analytics, research and reporting.
// Auth: password accounts + opaque revocable session tokens + role-based access
// control + an audit trail. OAuth (Google/Microsoft/Apple) plugs in where marked.

import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIMENSIONS, LEVELS } from './src/capabilities.js';
import { buildAssessment, scoreResponses } from './src/assessment.js';
import { buildProfile } from './src/hci.js';
import { store } from './src/store.js';
import { coach, COACH_ROLES } from './src/ai-coach.js';
import { profileToCSV, profileToHTML, portfolioAnalytics } from './src/reports.js';
import { analyseCohort, correlationMatrix } from './src/psychometrics.js';
import { runEFA } from './src/efa.js';
import { runCFA } from './src/cfa.js';
import { calibrateDimension } from './src/irt.js';
import { buildDocx, buildXlsx, buildPptx } from './src/exporters.js';
import {
  hashPassword, verifyPassword, newToken, SESSION_TTL_MS,
  ROLES, canAccess, allowedAreas, publicUser, validateSignup,
} from './src/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

// ---- auth middleware ----------------------------------------------------
// Populate req.user from the Bearer token on every request (best-effort).
app.use((req, _res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token) {
    const session = store.getSession(token);
    if (session) { req.user = store.getUser(session.userId); req.token = token; }
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'authentication required' });
  next();
};

// RBAC guard for a restricted area.
const requireArea = (area) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'authentication required' });
  if (!canAccess(req.user.role, area)) {
    store.audit({ actorId: req.user.id, actorEmail: req.user.email, action: 'access_denied', target: area, ip: req.ip });
    return res.status(403).json({ error: `Your role (${req.user.role}) is not permitted to access ${area}.` });
  }
  next();
};

const sessionPayload = (user) => ({
  user: publicUser(user),
  allowed: allowedAreas(user.role),
  hasProfile: !!store.latestProfile(user.id),
});

// ---- meta / framework (public) -----------------------------------------
app.get('/api/framework', (_req, res) => {
  res.json({ dimensions: DIMENSIONS, levels: LEVELS, coachRoles: COACH_ROLES, roles: ROLES });
});

app.get('/api/assessment', (_req, res) => {
  res.json(buildAssessment());
});

// ---- authentication -----------------------------------------------------
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role = 'individual', org } = req.body || {};
  const err = validateSignup({ name, email, password });
  if (err) return res.status(400).json({ error: err });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' });

  const user = store.createUser({ name: name.trim(), email: email.toLowerCase(), role, org: org?.trim() || null, credentials: hashPassword(password) });
  const token = newToken();
  store.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  store.audit({ actorId: user.id, actorEmail: user.email, action: 'signup', target: role, ip: req.ip });
  res.json({ token, ...sessionPayload(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = store.findUserByEmail(email);
  if (!user || !verifyPassword(password || '', user.passwordSalt, user.passwordHash)) {
    store.audit({ actorEmail: email, action: 'login_failed', ip: req.ip });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = newToken();
  store.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  store.audit({ actorId: user.id, actorEmail: user.email, action: 'login', ip: req.ip });
  res.json({ token, ...sessionPayload(user) });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.token) {
    store.deleteSession(req.token);
    if (req.user) store.audit({ actorId: req.user.id, actorEmail: req.user.email, action: 'logout', ip: req.ip });
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ...sessionPayload(req.user), profile: store.latestProfile(req.user.id) });
});

// OAuth integration seam. With provider credentials configured (CLIENT_ID/SECRET +
// redirect URI) these endpoints would run the standard authorization-code flow and
// then mint a session exactly like /login above. Returns 501 until configured.
app.post('/api/auth/oauth/:provider', (req, res) => {
  const supported = ['google', 'microsoft', 'apple'];
  const provider = req.params.provider;
  if (!supported.includes(provider)) return res.status(404).json({ error: 'unknown provider' });
  res.status(501).json({
    error: 'oauth_not_configured',
    message: `${provider} SSO is wired but needs ${provider.toUpperCase()}_CLIENT_ID / _SECRET and a redirect URI. This build ships email + password auth.`,
  });
});

// ---- assessment submission ---------------------------------------------
app.post('/api/assessment/submit', requireAuth, (req, res) => {
  const responses = req.body?.responses || {};
  const scored = scoreResponses(responses);
  if (scored.answered === 0) return res.status(400).json({ error: 'no responses' });
  const profile = buildProfile(scored);
  store.saveResponses(req.user.id, responses);
  const saved = store.saveProfile(req.user.id, profile);
  res.json({ profile: saved });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: 'no profile' });
  res.json({ profile, history: store.profileHistory(req.user.id).map((p) => ({ at: p.generatedAt, hci: p.hci })) });
});

// ---- AI coach -----------------------------------------------------------
app.post('/api/coach', requireAuth, async (req, res) => {
  const { message, role } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const profile = store.latestProfile(req.user.id);
  const out = await coach({ message, role, profile });
  store.logAI(req.user.id, { role, message, answer: out.answer, source: out.source });
  res.json(out);
});

// ---- portfolio ----------------------------------------------------------
app.get('/api/portfolio', requireAuth, (req, res) => {
  const items = store.listPortfolio(req.user.id);
  res.json({ items, analytics: portfolioAnalytics(items) });
});

app.post('/api/portfolio', requireAuth, (req, res) => {
  const item = store.addPortfolioItem(req.user.id, req.body || {});
  res.json({ item, analytics: portfolioAnalytics(store.listPortfolio(req.user.id)) });
});

app.delete('/api/portfolio/:id', requireAuth, (req, res) => {
  store.deletePortfolioItem(req.user.id, req.params.id);
  res.json({ analytics: portfolioAnalytics(store.listPortfolio(req.user.id)) });
});

// ---- institutional analytics (RBAC: institutional roles) ---------------
app.get('/api/institutional', requireArea('institutional'), (req, res) => {
  const profiles = store.allProfiles();
  const n = profiles.length;
  const mean = (sel) =>
    n ? Math.round((profiles.reduce((a, p) => a + (sel(p) || 0), 0) / n) * 10) / 10 : 0;
  const dimMeans = DIMENSIONS.map((d) => ({
    id: d.id, short: d.short, name: d.name,
    mean: n ? Math.round((profiles.reduce((a, p) => a + (p.perDimension?.[d.id] || 0), 0) / n) * 10) / 10 : 0,
  }));
  const distribution = LEVELS.map((l) => ({
    label: l.label,
    count: profiles.filter((p) => p.hci >= l.min && p.hci <= l.max).length,
  }));
  res.json({
    cohortSize: n,
    avgHCI: mean((p) => p.hci),
    avgCareer: mean((p) => p.readiness?.career),
    avgAI: mean((p) => p.readiness?.ai),
    avgLeadership: mean((p) => p.readiness?.leadership),
    dimMeans, distribution,
    org: req.user.org || 'All cohorts',
  });
});

// ---- research analytics (RBAC: research roles) -------------------------
app.get('/api/research/psychometrics', requireArea('research'), (_req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true });
  res.json(analyseCohort(records));
});

app.get('/api/research/correlation/:dimensionId', requireArea('research'), (req, res) => {
  const m = correlationMatrix(store.raw().responses, req.params.dimensionId);
  if (!m) return res.status(404).json({ error: 'unknown dimension' });
  res.json(m);
});

app.get('/api/research/efa', requireArea('research'), (req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true, reason: 'no responses' });
  const maxFactors = Math.max(1, Math.min(6, Number(req.query.maxFactors) || 4));
  res.json(runEFA(records, { maxFactors }));
});

app.get('/api/research/cfa', requireArea('research'), (_req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true, reason: 'no responses' });
  res.json(runCFA(records));
});

app.get('/api/research/rasch/:dimensionId', requireArea('research'), (req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true, reason: 'no responses' });
  res.json(calibrateDimension(records, req.params.dimensionId));
});

// ---- audit trail (RBAC: institutional roles) ---------------------------
app.get('/api/audit', requireArea('audit'), (_req, res) => {
  res.json({ entries: store.recentAudit(30) });
});

// ---- exports (authenticated; profile owner) ----------------------------
function logExport(req, format) {
  store.audit({ actorId: req.user.id, actorEmail: req.user.email, action: 'export', target: format, ip: req.ip });
}
async function sendDoc(res, builder, profile, user, filename, mime) {
  try {
    const buf = await builder(profile, user);
    res.setHeader('content-type', mime);
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).send('export failed: ' + e.message);
  }
}

app.get('/api/report.docx', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).send('no profile');
  logExport(req, 'docx');
  sendDoc(res, buildDocx, profile, req.user, 'capability-iq-report.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

app.get('/api/report.xlsx', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).send('no profile');
  logExport(req, 'xlsx');
  sendDoc(res, buildXlsx, profile, req.user, 'capability-iq-report.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

app.get('/api/report.pptx', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).send('no profile');
  logExport(req, 'pptx');
  sendDoc(res, buildPptx, profile, req.user, 'capability-iq-report.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation');
});

app.get('/api/report.csv', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).send('no profile');
  logExport(req, 'csv');
  res.setHeader('content-type', 'text/csv');
  res.setHeader('content-disposition', 'attachment; filename="capability-iq-report.csv"');
  res.send(profileToCSV(profile));
});

app.get('/api/report.json', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: 'no profile' });
  logExport(req, 'json');
  res.setHeader('content-disposition', 'attachment; filename="capability-iq-report.json"');
  res.json(profile);
});

app.get('/api/report.html', requireAuth, (req, res) => {
  const profile = store.latestProfile(req.user.id);
  if (!profile) return res.status(404).send('no profile');
  logExport(req, 'pdf');
  res.setHeader('content-type', 'text/html');
  res.send(profileToHTML(profile, req.user));
});

// Unmatched API routes return JSON 404 (never the SPA HTML shell).
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// SPA fallback for everything else.
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// JSON error handler — malformed bodies and unexpected failures stay machine-readable.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  const ai =
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
      ? 'LLM-connected'
      : 'deterministic engine';
  console.log(`\n  Capability IQ™  ·  http://localhost:${PORT}`);
  console.log(`  AI Coach: ${ai}  ·  Auth: password + RBAC\n`);
});
