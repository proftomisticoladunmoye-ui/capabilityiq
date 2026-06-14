// Capability IQ™ — application server.
// Serves the SPA and the JSON API for assessment, profiling, AI coaching,
// portfolio, benchmarking, institutional analytics and reporting.

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

// Resolve the acting user from header (demo-grade auth shim). The full platform
// replaces this with OAuth/RBAC middleware; the route contract stays identical.
function actingUser(req) {
  const id = req.get('x-user-id') || req.query.userId;
  if (id) {
    const u = store.getUser(id);
    if (u) return u;
  }
  return null;
}

// ---- meta / framework ---------------------------------------------------
app.get('/api/framework', (_req, res) => {
  res.json({ dimensions: DIMENSIONS, levels: LEVELS, coachRoles: COACH_ROLES });
});

app.get('/api/assessment', (_req, res) => {
  res.json(buildAssessment());
});

// ---- session / user -----------------------------------------------------
app.post('/api/session', (req, res) => {
  const { name, email, role, org, id } = req.body || {};
  if (!name && !id) return res.status(400).json({ error: 'name required' });
  const user = store.upsertUser({ id, name, email, role, org });
  const profile = store.latestProfile(user.id);
  res.json({ user, hasProfile: !!profile });
});

app.get('/api/me', (req, res) => {
  const user = actingUser(req);
  if (!user) return res.status(401).json({ error: 'no session' });
  res.json({ user, profile: store.latestProfile(user.id) });
});

// ---- assessment submission ---------------------------------------------
app.post('/api/assessment/submit', (req, res) => {
  const user = actingUser(req);
  if (!user) return res.status(401).json({ error: 'no session' });
  const responses = req.body?.responses || {};
  const scored = scoreResponses(responses);
  if (scored.answered === 0) return res.status(400).json({ error: 'no responses' });
  const profile = buildProfile(scored);
  store.saveResponses(user.id, responses);
  const saved = store.saveProfile(user.id, profile);
  res.json({ profile: saved });
});

app.get('/api/profile', (req, res) => {
  const user = actingUser(req);
  if (!user) return res.status(401).json({ error: 'no session' });
  const profile = store.latestProfile(user.id);
  if (!profile) return res.status(404).json({ error: 'no profile' });
  res.json({ profile, history: store.profileHistory(user.id).map((p) => ({ at: p.generatedAt, hci: p.hci })) });
});

// ---- AI coach -----------------------------------------------------------
app.post('/api/coach', async (req, res) => {
  const user = actingUser(req);
  const { message, role } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const profile = user ? store.latestProfile(user.id) : null;
  const out = await coach({ message, role, profile });
  if (user) store.logAI(user.id, { role, message, answer: out.answer, source: out.source });
  res.json(out);
});

// ---- portfolio ----------------------------------------------------------
app.get('/api/portfolio', (req, res) => {
  const user = actingUser(req);
  if (!user) return res.status(401).json({ error: 'no session' });
  const items = store.listPortfolio(user.id);
  res.json({ items, analytics: portfolioAnalytics(items) });
});

app.post('/api/portfolio', (req, res) => {
  const user = actingUser(req);
  if (!user) return res.status(401).json({ error: 'no session' });
  const item = store.addPortfolioItem(user.id, req.body || {});
  res.json({ item, analytics: portfolioAnalytics(store.listPortfolio(user.id)) });
});

app.delete('/api/portfolio/:id', (req, res) => {
  const user = actingUser(req);
  if (!user) return res.status(401).json({ error: 'no session' });
  store.deletePortfolioItem(user.id, req.params.id);
  res.json({ analytics: portfolioAnalytics(store.listPortfolio(user.id)) });
});

// ---- benchmarking / institutional analytics ----------------------------
app.get('/api/institutional', (req, res) => {
  const user = actingUser(req);
  const profiles = store.allProfiles();
  // Aggregate cohort intelligence across all profiles in the store.
  const n = profiles.length;
  const mean = (sel) =>
    n ? Math.round((profiles.reduce((a, p) => a + (sel(p) || 0), 0) / n) * 10) / 10 : 0;
  const dimMeans = DIMENSIONS.map((d) => ({
    id: d.id,
    short: d.short,
    name: d.name,
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
    dimMeans,
    distribution,
    org: user?.org || 'All cohorts',
  });
});

// ---- research analytics (psychometrics) --------------------------------
app.get('/api/research/psychometrics', (_req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true });
  res.json(analyseCohort(records));
});

app.get('/api/research/correlation/:dimensionId', (req, res) => {
  const records = store.raw().responses;
  const m = correlationMatrix(records, req.params.dimensionId);
  if (!m) return res.status(404).json({ error: 'unknown dimension' });
  res.json(m);
});

app.get('/api/research/efa', (req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true, reason: 'no responses' });
  const maxFactors = Math.max(1, Math.min(6, Number(req.query.maxFactors) || 4));
  res.json(runEFA(records, { maxFactors }));
});

app.get('/api/research/cfa', (_req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true, reason: 'no responses' });
  res.json(runCFA(records));
});

app.get('/api/research/rasch/:dimensionId', (req, res) => {
  const records = store.raw().responses;
  if (!records.length) return res.json({ empty: true, reason: 'no responses' });
  res.json(calibrateDimension(records, req.params.dimensionId));
});

// ---- exports ------------------------------------------------------------
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

app.get('/api/report.docx', (req, res) => {
  const user = actingUser(req);
  const profile = user ? store.latestProfile(user.id) : null;
  if (!profile) return res.status(404).send('no profile');
  sendDoc(res, buildDocx, profile, user, 'capability-iq-report.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

app.get('/api/report.xlsx', (req, res) => {
  const user = actingUser(req);
  const profile = user ? store.latestProfile(user.id) : null;
  if (!profile) return res.status(404).send('no profile');
  sendDoc(res, buildXlsx, profile, user, 'capability-iq-report.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

app.get('/api/report.pptx', (req, res) => {
  const user = actingUser(req);
  const profile = user ? store.latestProfile(user.id) : null;
  if (!profile) return res.status(404).send('no profile');
  sendDoc(res, buildPptx, profile, user, 'capability-iq-report.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation');
});

app.get('/api/report.csv', (req, res) => {
  const user = actingUser(req);
  const profile = user ? store.latestProfile(user.id) : null;
  if (!profile) return res.status(404).send('no profile');
  res.setHeader('content-type', 'text/csv');
  res.setHeader('content-disposition', 'attachment; filename="capability-iq-report.csv"');
  res.send(profileToCSV(profile));
});

app.get('/api/report.json', (req, res) => {
  const user = actingUser(req);
  const profile = user ? store.latestProfile(user.id) : null;
  if (!profile) return res.status(404).json({ error: 'no profile' });
  res.setHeader('content-disposition', 'attachment; filename="capability-iq-report.json"');
  res.json(profile);
});

app.get('/api/report.html', (req, res) => {
  const user = actingUser(req);
  const profile = user ? store.latestProfile(user.id) : null;
  if (!profile) return res.status(404).send('no profile');
  res.setHeader('content-type', 'text/html');
  res.send(profileToHTML(profile, user));
});

// SPA fallback.
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const ai =
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
      ? 'LLM-connected'
      : 'deterministic engine';
  console.log(`\n  Capability IQ™  ·  http://localhost:${PORT}`);
  console.log(`  AI Coach: ${ai}\n`);
});
