// Item Response Theory — Andrich Rating Scale Model (Research Analytics Module).
// Calibrates a dimension's 5 Likert items under the polytomous Rasch (Rating Scale)
// model via Joint Maximum Likelihood Estimation (JMLE). Produces item difficulties,
// the shared rating-scale step thresholds, person abilities (all on a common logit
// scale), Wright/person-item map data, infit/outfit fit statistics, separation &
// reliability, and category-probability curves. Pure JS, deterministic.
//
// RSM probability of scoring in category k (0..m) for person ability θ and item
// difficulty δ given step thresholds τ_1..τ_m (τ_0 ≡ 0):
//   P(X=k) ∝ exp( Σ_{j=1}^{k} (θ − δ − τ_j) )

import { DIMENSIONS, DIMENSION_BY_ID } from './capabilities.js';
import { buildAssessment } from './assessment.js';

const round = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Direction-aligned response matrix (categories 0..m) for one dimension.
function buildMatrix(responseRecords, dimensionId) {
  const assessment = buildAssessment();
  const sec = assessment.sections.find((s) => s.dimensionId === dimensionId);
  if (!sec) return null;
  const items = sec.items;
  const rows = [];
  for (const rec of responseRecords) {
    const r = rec.responses || rec;
    const row = [];
    let complete = true;
    for (const it of items) {
      let v = Number(r[it.id]);
      if (!v) { complete = false; break; }
      if (it.reverse) v = 8 - v;            // align reverse-keyed items
      row.push(clamp(Math.round(v), 1, 7) - 1); // → category 0..6
    }
    if (complete) rows.push(row);
  }
  return { items: items.map((it, i) => ({ id: it.id, label: `Q${i + 1}`, text: it.text })), rows, m: 6 };
}

// Category probabilities under the RSM.
function categoryProbs(theta, delta, tau) {
  const m = tau.length;
  const logit = new Array(m + 1);
  logit[0] = 0;
  let cum = 0;
  for (let k = 1; k <= m; k++) { cum += theta - delta - tau[k - 1]; logit[k] = cum; }
  const mx = Math.max(...logit);
  let denom = 0;
  const p = logit.map((v) => { const e = Math.exp(v - mx); denom += e; return e; });
  return p.map((e) => e / denom);
}

function expVar(probs) {
  let E = 0, E2 = 0;
  for (let k = 0; k < probs.length; k++) { E += k * probs[k]; E2 += k * k * probs[k]; }
  return { E, V: Math.max(E2 - E * E, 1e-6) };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs) => { const m = mean(xs); return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length; };

export function calibrateDimension(responseRecords, dimensionId) {
  const M = buildMatrix(responseRecords, dimensionId);
  if (!M) return { empty: true, reason: 'unknown dimension' };
  const { rows, items, m } = M;
  const P = rows.length, I = items.length;
  if (P < I + 5) return { empty: true, reason: 'insufficient sample for Rasch calibration', n: P };

  const maxScore = I * m;
  const personRaw = rows.map((r) => r.reduce((a, b) => a + b, 0));
  const itemRaw = items.map((_, i) => rows.reduce((a, r) => a + r[i], 0));

  // Persons / items at extreme (min/max) scores cannot be estimated (infinite logit)
  // under JMLE; flag them and exclude from the joint estimation.
  const personExtreme = personRaw.map((s) => s === 0 || s === maxScore);
  const estPersons = personRaw.map((_, p) => !personExtreme[p]);

  // ---- initialise (PROX-style log-odds) ----
  let theta = personRaw.map((s) => {
    const prop = clamp(s / maxScore, 0.02, 0.98);
    return Math.log(prop / (1 - prop));
  });
  let delta = itemRaw.map((s) => {
    const prop = clamp(s / (P * m), 0.02, 0.98);
    return -Math.log(prop / (1 - prop)); // higher endorsement → lower difficulty
  });
  // centre item difficulties
  const dMean0 = mean(delta); delta = delta.map((d) => d - dMean0);
  // initialise thresholds from category frequencies
  const catCount = new Array(m + 1).fill(0);
  for (const r of rows) for (const x of r) catCount[x]++;
  let tau = new Array(m).fill(0).map((_, k) => Math.log((catCount[k] + 1) / (catCount[k + 1] + 1)));
  const tMean0 = mean(tau); tau = tau.map((t) => t - tMean0);

  // ---- JMLE iterations ----
  let iters = 0;
  for (let it = 0; it < 200; it++) {
    iters++;
    let maxChange = 0;

    // person abilities
    for (let p = 0; p < P; p++) {
      if (!estPersons[p]) continue;
      let sumE = 0, sumV = 0;
      for (let i = 0; i < I; i++) { const { E, V } = expVar(categoryProbs(theta[p], delta[i], tau)); sumE += E; sumV += V; }
      const step = clamp((personRaw[p] - sumE) / sumV, -1.5, 1.5);
      theta[p] = clamp(theta[p] + step, -6, 6);
      maxChange = Math.max(maxChange, Math.abs(step));
    }

    // item difficulties (over estimable persons)
    for (let i = 0; i < I; i++) {
      let sumE = 0, sumV = 0, obs = 0;
      for (let p = 0; p < P; p++) {
        if (!estPersons[p]) continue;
        const { E, V } = expVar(categoryProbs(theta[p], delta[i], tau));
        sumE += E; sumV += V; obs += rows[p][i];
      }
      const step = clamp((sumE - obs) / sumV, -1.5, 1.5); // raise δ when observed < expected
      delta[i] = delta[i] + step;
      maxChange = Math.max(maxChange, Math.abs(step));
    }
    const dm = mean(delta); delta = delta.map((d) => d - dm);

    // rating-scale thresholds: match observed vs expected "step passed" counts
    const stepObs = new Array(m).fill(0);
    const stepExp = new Array(m).fill(0);
    const stepVar = new Array(m).fill(0);
    for (let p = 0; p < P; p++) {
      if (!estPersons[p]) continue;
      for (let i = 0; i < I; i++) {
        const probs = categoryProbs(theta[p], delta[i], tau);
        // cumulative P(X >= k)
        let tail = 1;
        for (let k = 1; k <= m; k++) {
          tail -= probs[k - 1];
          stepExp[k - 1] += tail;
          stepVar[k - 1] += tail * (1 - tail);
          if (rows[p][i] >= k) stepObs[k - 1] += 1;
        }
      }
    }
    for (let k = 0; k < m; k++) {
      const tstep = clamp((stepExp[k] - stepObs[k]) / Math.max(stepVar[k], 1e-3), -1, 1) * 0.5;
      tau[k] = tau[k] + tstep;
      maxChange = Math.max(maxChange, Math.abs(tstep));
    }
    const tm = mean(tau); tau = tau.map((t) => t - tm);

    if (maxChange < 1e-3) break;
  }

  // ---- fit statistics & standard errors ----
  const itemStats = items.map((item, i) => {
    let infitNum = 0, infitDen = 0, outfit = 0, count = 0, infoSum = 0;
    for (let p = 0; p < P; p++) {
      if (!estPersons[p]) continue;
      const probs = categoryProbs(theta[p], delta[i], tau);
      const { E, V } = expVar(probs);
      const resid = rows[p][i] - E;
      infitNum += resid * resid; infitDen += V;
      outfit += (resid * resid) / V; count++;
      infoSum += V;
    }
    const infit = round(infitNum / infitDen, 2);
    const out = round(outfit / count, 2);
    const fit = (v) => (v == null ? '' : v > 1.5 ? 'underfit' : v < 0.5 ? 'overfit' : 'productive');
    return {
      id: item.id, label: item.label, text: item.text,
      difficulty: round(delta[i], 2), se: round(1 / Math.sqrt(infoSum), 2),
      infit, outfit: out, fitFlag: fit(infit),
    };
  });

  // person SEs & reliability/separation
  const estTheta = [], estSE2 = [];
  for (let p = 0; p < P; p++) {
    if (!estPersons[p]) continue;
    let info = 0;
    for (let i = 0; i < I; i++) info += expVar(categoryProbs(theta[p], delta[i], tau)).V;
    estTheta.push(theta[p]); estSE2.push(1 / info);
  }
  const obsVar = variance(estTheta);
  const mse = mean(estSE2);
  const trueVar = Math.max(obsVar - mse, 1e-6);
  const personReliability = round(trueVar / obsVar, 2);
  const personSeparation = round(Math.sqrt(trueVar / mse), 2);

  const itemSE2 = itemStats.map((s) => s.se * s.se);
  const itemObsVar = variance(delta);
  const itemMse = mean(itemSE2);
  const itemTrue = Math.max(itemObsVar - itemMse, 1e-6);
  const itemReliability = round(itemTrue / itemObsVar, 2);
  const itemSeparation = round(Math.sqrt(itemTrue / itemMse), 2);

  // ---- Wright map (person ability histogram + item difficulty markers) ----
  const lo = -5, hi = 5, bins = 20, width = (hi - lo) / bins;
  const personBins = new Array(bins).fill(0);
  for (const t of estTheta) { const b = clamp(Math.floor((t - lo) / width), 0, bins - 1); personBins[b]++; }
  const wright = {
    bins: personBins.map((c, b) => ({ logit: round(lo + (b + 0.5) * width, 2), count: c })),
    items: itemStats.map((s) => ({ label: s.label, difficulty: s.difficulty })),
  };

  // ---- category probability curves at δ = 0 ----
  const grid = [];
  for (let t = -5; t <= 5.0001; t += 0.25) grid.push(round(t, 2));
  const curves = Array.from({ length: m + 1 }, () => []);
  const expectedCurve = [];
  for (const t of grid) {
    const probs = categoryProbs(t, 0, tau);
    probs.forEach((pk, k) => curves[k].push(round(pk, 3)));
    expectedCurve.push(round(expVar(probs).E, 3));
  }

  return {
    dimension: DIMENSION_BY_ID[dimensionId].name,
    dimensionShort: DIMENSION_BY_ID[dimensionId].short,
    n: P,
    estimableN: estTheta.length,
    extremePersons: personExtreme.filter(Boolean).length,
    iterations: iters,
    items: itemStats,
    thresholds: tau.map((t, k) => ({ step: k + 1, value: round(t, 2) })),
    thresholdsOrdered: tau.every((t, k) => k === 0 || t >= tau[k - 1]),
    reliability: { personReliability, personSeparation, itemReliability, itemSeparation },
    person: { mean: round(mean(estTheta), 2), sd: round(Math.sqrt(obsVar), 2) },
    wright,
    curves: { theta: grid, categories: curves, expected: expectedCurve },
    generatedAt: new Date().toISOString(),
  };
}

export function dimensionList() {
  return DIMENSIONS.map((d) => ({ id: d.id, name: d.name, short: d.short }));
}
