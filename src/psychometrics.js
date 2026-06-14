// Psychometric analytics engine (Research Analytics Module).
// Operates on the raw cohort response matrix to produce the kind of statistics a
// psychometrician needs: descriptive statistics, scale reliability (Cronbach's alpha
// and a McDonald's-omega approximation), item–total correlations, inter-item
// correlations and a per-dimension reliability table. Pure JS, no Python required —
// the function boundary mirrors what a FastAPI/R service would expose in production.

import { buildAssessment } from './assessment.js';
import { DIMENSIONS } from './capabilities.js';

// ---- primitive statistics ----------------------------------------------
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function variance(xs, sample = true) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const ss = xs.reduce((a, b) => a + (b - m) ** 2, 0);
  return ss / (xs.length - (sample ? 1 : 0));
}
const sd = (xs, sample = true) => Math.sqrt(variance(xs, sample));

function moment(xs, k) {
  const m = mean(xs);
  const s = sd(xs, false) || 1;
  return mean(xs.map((x) => ((x - m) / s) ** k));
}
const skewness = (xs) => (xs.length < 3 ? 0 : moment(xs, 3));
const kurtosis = (xs) => (xs.length < 4 ? 0 : moment(xs, 4) - 3); // excess kurtosis

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ---- response matrix assembly ------------------------------------------
// Builds, per dimension, a column-keyed matrix of reverse-corrected item scores
// (1..7), keeping only respondents who answered every item in that dimension.
function buildMatrices(responseRecords) {
  const assessment = buildAssessment();
  const matrices = {};
  for (const sec of assessment.sections) {
    const items = sec.items;
    const rows = [];
    for (const rec of responseRecords) {
      const r = rec.responses || rec; // accept raw maps or {responses}
      const row = [];
      let complete = true;
      for (const it of items) {
        let v = Number(r[it.id]);
        if (!v) { complete = false; break; }
        if (it.reverse) v = 8 - v; // direction-align reverse-keyed items
        row.push(v);
      }
      if (complete) rows.push(row);
    }
    matrices[sec.dimensionId] = { items: items.map((i) => i.id), texts: items.map((i) => i.text), rows };
  }
  return matrices;
}

// Cronbach's alpha for a respondent×item matrix.
function cronbachAlpha(rows) {
  const k = rows[0]?.length || 0;
  if (k < 2 || rows.length < 2) return null;
  const itemVars = [];
  for (let j = 0; j < k; j++) itemVars.push(variance(rows.map((r) => r[j])));
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0));
  const totalVar = variance(totals);
  if (totalVar === 0) return 0;
  return (k / (k - 1)) * (1 - itemVars.reduce((a, b) => a + b, 0) / totalVar);
}

// McDonald's omega approximation from a single-factor (first principal component)
// loading estimate derived from the average inter-item correlation.
function omegaApprox(rows, alpha) {
  const k = rows[0]?.length || 0;
  if (k < 2) return null;
  let sum = 0, n = 0;
  for (let a = 0; a < k; a++)
    for (let b = a + 1; b < k; b++) { sum += pearson(rows.map((r) => r[a]), rows.map((r) => r[b])); n++; }
  const avgR = n ? sum / n : 0;
  const lambda = Math.sqrt(Math.max(0, avgR)); // standardised loading estimate
  const sumLoad = k * lambda;
  const omega = (sumLoad ** 2) / (sumLoad ** 2 + k * (1 - lambda ** 2));
  // guard against degenerate estimates; fall back toward alpha
  return Number.isFinite(omega) && omega > 0 ? omega : alpha;
}

function interpretAlpha(a) {
  if (a == null) return 'insufficient data';
  if (a >= 0.9) return 'excellent';
  if (a >= 0.8) return 'good';
  if (a >= 0.7) return 'acceptable';
  if (a >= 0.6) return 'questionable';
  if (a >= 0.5) return 'poor';
  return 'unacceptable';
}

// ---- public: full psychometric report ----------------------------------
export function analyseCohort(responseRecords) {
  const matrices = buildMatrices(responseRecords);
  const dims = [];
  let scaleN = 0;

  for (const dim of DIMENSIONS) {
    const M = matrices[dim.id];
    const rows = M.rows;
    const n = rows.length;
    scaleN = Math.max(scaleN, n);
    const k = M.items.length;

    const alpha = n >= 2 ? cronbachAlpha(rows) : null;
    const omega = n >= 2 ? omegaApprox(rows, alpha) : null;

    // Per-item descriptives + item-total correlation (corrected: item excluded from total).
    const items = M.items.map((id, j) => {
      const col = rows.map((r) => r[j]);
      const restTotals = rows.map((r) => r.reduce((a, b, idx) => (idx === j ? a : a + b), 0));
      const itc = n >= 2 ? pearson(col, restTotals) : 0;
      return {
        id,
        text: M.texts[j],
        mean: round(mean(col), 2),
        sd: round(sd(col), 2),
        skew: round(skewness(col), 2),
        kurtosis: round(kurtosis(col), 2),
        itemTotal: round(itc, 2),
        flag: n >= 2 && itc < 0.3 ? 'low discrimination' : null,
      };
    });

    dims.push({
      id: dim.id,
      name: dim.name,
      short: dim.short,
      n,
      items: k,
      alpha: alpha == null ? null : round(alpha, 3),
      omega: omega == null ? null : round(omega, 3),
      interpretation: interpretAlpha(alpha),
      meanScore: round(mean(rows.map((r) => mean(r))) * (100 / 7), 1), // 0..100 scale
      itemStats: items,
    });
  }

  // Overall scale alpha across all 60 (direction-aligned) items.
  const fullRows = [];
  const ids = DIMENSIONS.flatMap((d) => matrices[d.id].items);
  // Recompute a complete-case full matrix.
  const assembled = assembleFull(responseRecords, ids);
  for (const row of assembled) fullRows.push(row);
  const overallAlpha = fullRows.length >= 2 ? cronbachAlpha(fullRows) : null;

  const valid = dims.filter((d) => d.alpha != null);
  const meanAlpha = valid.length ? round(mean(valid.map((d) => d.alpha)), 3) : null;

  return {
    cohortSize: scaleN,
    completeCases: fullRows.length,
    overallAlpha: overallAlpha == null ? null : round(overallAlpha, 3),
    overallInterpretation: interpretAlpha(overallAlpha),
    meanDimensionAlpha: meanAlpha,
    dimensions: dims,
    generatedAt: new Date().toISOString(),
  };
}

function assembleFull(responseRecords, ids) {
  const assessment = buildAssessment();
  const reverse = {};
  for (const sec of assessment.sections) for (const it of sec.items) reverse[it.id] = it.reverse;
  const out = [];
  for (const rec of responseRecords) {
    const r = rec.responses || rec;
    const row = [];
    let complete = true;
    for (const id of ids) {
      let v = Number(r[id]);
      if (!v) { complete = false; break; }
      if (reverse[id]) v = 8 - v;
      row.push(v);
    }
    if (complete) out.push(row);
  }
  return out;
}

// Inter-item correlation matrix for one dimension (for the heatmap view).
export function correlationMatrix(responseRecords, dimensionId) {
  const M = buildMatrices(responseRecords)[dimensionId];
  if (!M) return null;
  const k = M.items.length;
  const cols = Array.from({ length: k }, (_, j) => M.rows.map((r) => r[j]));
  const matrix = [];
  for (let a = 0; a < k; a++) {
    const row = [];
    for (let b = 0; b < k; b++) row.push(round(pearson(cols[a], cols[b]), 2));
    matrix.push(row);
  }
  return { items: M.items.map((_, i) => `Q${i + 1}`), matrix, n: M.rows.length };
}
