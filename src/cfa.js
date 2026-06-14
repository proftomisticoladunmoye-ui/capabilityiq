// Confirmatory Factor Analysis (Research Analytics Module).
// Tests the hypothesised three-factor measurement model — the structure the EFA
// surfaced — against the observed correlation structure, and reports the standard
// CFA fit indices plus convergent / discriminant validity statistics.
//
// Estimation: a genuine (approximate) maximum-likelihood fit on the correlation
// structure. Standardised loadings and inter-factor correlations are initialised with a
// congeneric moment estimator (leading principal component per factor block) and then
// refined by coordinate descent minimising the ML discrepancy function
//   F_ML = ln|Σ| − ln|S| + tr(SΣ⁻¹) − p
// using a Cholesky-based objective. Fit is evaluated with χ²/CFI/TLI/RMSEA/SRMR on the
// model-implied vs observed matrix. Deterministic; no external solver.

import { DIMENSIONS, DIMENSION_BY_ID } from './capabilities.js';
import { jacobiEigen, pearson, dimensionScoreMatrix } from './efa.js';

// Hypothesised measurement model (the theory being confirmed).
export const FACTOR_MODEL = [
  { id: 'cognitive_capital', name: 'Cognitive–Learning Capital', dims: ['knowledge', 'cognitive', 'learning_agility', 'digital'] },
  { id: 'human_capital', name: 'Human–Influence Capital', dims: ['exposure', 'identity', 'collaboration', 'wellbeing'] },
  { id: 'venture_capital', name: 'Execution–Venture Capital', dims: ['value_creation', 'initiative', 'entrepreneurial', 'ai_partnership'] },
];

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---- Cholesky helpers (Σ, S are positive-definite correlation matrices) ----
function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (sum <= 1e-12) return null; // not positive-definite
        L[i][i] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return L;
}
const logDetFromChol = (L) => 2 * L.reduce((a, _, i) => a + Math.log(L[i][i]), 0);

// Solve A X = B (B is a matrix) given chol(A)=L; returns X.
function cholSolveMatrix(L, B) {
  const n = L.length, m = B[0].length;
  const X = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let c = 0; c < m; c++) {
    const y = new Array(n);
    for (let i = 0; i < n; i++) { let s = B[i][c]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * X[k][c]; X[i][c] = s / L[i][i]; }
  }
  return X;
}

export function runCFA(responseRecords) {
  const rows = dimensionScoreMatrix(responseRecords);
  const n = rows.length;
  const order = DIMENSIONS.map((d) => d.id);
  const p = order.length;
  if (n < p + 1) return { empty: true, reason: 'insufficient sample (need > 12 complete cases)', n };

  // Observed correlation matrix S in DIMENSIONS order.
  const cols = order.map((_, j) => rows.map((r) => r[j]));
  const S = cols.map((ci) => cols.map((cj) => pearson(ci, cj)));
  const idx = Object.fromEntries(order.map((id, i) => [id, i]));
  const cholS = cholesky(S);
  if (!cholS) return { empty: true, reason: 'observed matrix is singular', n };
  const logDetS = logDetFromChol(cholS);

  // factor index per dimension + the three free factor-correlation slots.
  const fIdx = order.map((d) => FACTOR_MODEL.findIndex((f) => f.dims.includes(d)));
  const PAIR = { '0,1': 0, '0,2': 1, '1,2': 2 };
  const phiVal = (PH, a, b) => (a === b ? 1 : PH[PAIR[a < b ? `${a},${b}` : `${b},${a}`]]);

  // ---- moment-estimate starting values: PCA per congeneric block ----
  let L = new Array(p).fill(0.7);
  FACTOR_MODEL.forEach((f) => {
    const ix = f.dims.map((d) => idx[d]);
    const sub = ix.map((a) => ix.map((b) => S[a][b]));
    const { values, vectors } = jacobiEigen(sub);
    let v = vectors[0].slice();
    if (v.reduce((a, b) => a + b, 0) < 0) v = v.map((x) => -x);
    const scale = Math.sqrt(Math.max(values[0], 0));
    ix.forEach((globalI, k) => { L[globalI] = clamp(v[k] * scale, 0.05, 0.99); });
  });
  let PH = [0, 0, 0].map((_, slot) => {
    const [a, b] = Object.keys(PAIR).find((k) => PAIR[k] === slot).split(',').map(Number);
    let sum = 0, cnt = 0;
    for (const di of FACTOR_MODEL[a].dims) for (const dj of FACTOR_MODEL[b].dims) {
      const denom = L[idx[di]] * L[idx[dj]];
      if (denom > 0.05) { sum += S[idx[di]][idx[dj]] / denom; cnt++; }
    }
    return cnt ? clamp(sum / cnt, -0.95, 0.95) : 0;
  });

  // ---- objective: F_ML for a parameter set ----
  const buildSigma = (Lv, PHv) =>
    order.map((_, i) => order.map((__, j) => (i === j ? 1 : Lv[i] * Lv[j] * phiVal(PHv, fIdx[i], fIdx[j]))));
  const objective = (Lv, PHv) => {
    const Sigma = buildSigma(Lv, PHv);
    const cholSig = cholesky(Sigma);
    if (!cholSig) return Infinity;
    const Y = cholSolveMatrix(cholSig, S); // Σ⁻¹ S
    let tr = 0;
    for (let i = 0; i < p; i++) tr += Y[i][i];
    return logDetFromChol(cholSig) - logDetS + tr - p;
  };

  // ---- coordinate-descent minimisation of F_ML ----
  let bestF = objective(L, PH);
  let step = 0.08;
  for (let iter = 0; iter < 60 && step > 1e-4; iter++) {
    let improved = false;
    for (let i = 0; i < p; i++) {
      for (const dir of [step, -step]) {
        const cand = L.slice(); cand[i] = clamp(cand[i] + dir, 0.05, 0.99);
        const f = objective(cand, PH);
        if (f < bestF - 1e-9) { L = cand; bestF = f; improved = true; }
      }
    }
    for (let s = 0; s < PH.length; s++) {
      for (const dir of [step, -step]) {
        const cand = PH.slice(); cand[s] = clamp(cand[s] + dir, -0.95, 0.95);
        const f = objective(L, cand);
        if (f < bestF - 1e-9) { PH = cand; bestF = f; improved = true; }
      }
    }
    if (!improved) step *= 0.5;
  }
  L = L.map((v) => round(v, 3));
  PH = PH.map((v) => round(v, 3));

  // ---- fit indices from the refined solution ----
  const Sigma = buildSigma(L, PH);
  const fml = Math.max(bestF, 0);
  const chi = (n - 1) * fml;
  const qFree = p + (FACTOR_MODEL.length * (FACTOR_MODEL.length - 1)) / 2;
  const dfModel = (p * (p - 1)) / 2 - qFree;
  const chiBase = (n - 1) * -logDetS; // independence model
  const dfBase = (p * (p - 1)) / 2;

  const d_m = Math.max(chi - dfModel, 0);
  const d_b = Math.max(chiBase - dfBase, 0);
  const cfi = d_b > 0 ? round(1 - d_m / Math.max(d_b, d_m, 1e-9), 3) : 1;
  const tli = round((chiBase / dfBase - chi / dfModel) / (chiBase / dfBase - 1), 3);
  const rmsea = round(Math.sqrt(d_m / (dfModel * (n - 1))), 3);
  let ss = 0, m = 0;
  for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) { ss += (S[i][j] - Sigma[i][j]) ** 2; m++; }
  const srmr = round(Math.sqrt(ss / m), 3);

  // ---- convergent / discriminant validity ----
  const loadingOf = Object.fromEntries(order.map((d, i) => [d, L[i]]));
  const phiBetween = (fi, fj) => phiVal(PH, fi, fj);
  const factors = FACTOR_MODEL.map((f, fi) => {
    const ls = f.dims.map((d) => loadingOf[d]);
    const sumL = ls.reduce((a, b) => a + b, 0);
    const ave = ls.reduce((a, b) => a + b * b, 0) / ls.length;
    const cr = sumL ** 2 / (sumL ** 2 + ls.reduce((a, b) => a + (1 - b * b), 0));
    return {
      id: f.id, name: f.name, factorIndex: fi,
      indicators: f.dims.map((d) => ({ id: d, short: DIMENSION_BY_ID[d].short, loading: loadingOf[d] })),
      ave: round(ave, 3), cr: round(cr, 3), sqrtAve: round(Math.sqrt(ave), 3),
    };
  });
  const flMatrix = factors.map((fi) =>
    factors.map((fj) => (fi.id === fj.id ? fi.sqrtAve : round(Math.abs(phiBetween(fi.factorIndex, fj.factorIndex)), 3))));
  const discriminantOk = factors.every((fi) =>
    factors.every((fj) => fi.id === fj.id || fi.sqrtAve > Math.abs(phiBetween(fi.factorIndex, fj.factorIndex))));

  const good = cfi >= 0.95 && tli >= 0.95 && rmsea <= 0.06 && srmr <= 0.08;
  const ok = cfi >= 0.9 && tli >= 0.9 && rmsea <= 0.08 && srmr <= 0.1;
  const verdict = good ? 'Good fit' : ok ? 'Acceptable fit' : 'Poor fit';

  return {
    n,
    model: FACTOR_MODEL.map((f) => ({ id: f.id, name: f.name, dims: f.dims.map((d) => DIMENSION_BY_ID[d].short) })),
    fit: {
      chiSquare: round(chi, 1), df: dfModel, ratio: round(chi / dfModel, 2),
      cfi, tli, rmsea, srmr, verdict,
    },
    factors,
    factorCorrelations: FACTOR_MODEL.map((_, i) => FACTOR_MODEL.map((__, j) => round(phiVal(PH, i, j), 3))),
    factorLabels: FACTOR_MODEL.map((f) => f.name),
    fornellLarcker: flMatrix,
    discriminantValid: discriminantOk,
    generatedAt: new Date().toISOString(),
  };
}
