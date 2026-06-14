// Human Capability Index (HCI) engine.
// Computes the flagship composite, derived readiness indices, gap analysis,
// growth-potential modelling and a forward trajectory forecast.

import { DIMENSIONS, DIMENSION_BY_ID, levelFor } from './capabilities.js';

// Weighted composite of the 12 dimensions, scaled 0..100.
export function computeHCI(perDimension) {
  let weighted = 0;
  let weightSum = 0;
  for (const dim of DIMENSIONS) {
    const s = perDimension[dim.id];
    if (s == null) continue;
    weighted += s * dim.weight;
    weightSum += dim.weight;
  }
  const score = weightSum > 0 ? weighted / weightSum : 0;
  return Math.round(score * 10) / 10;
}

// Derived readiness composites are weighted blends of the relevant dimensions.
const READINESS = {
  career: { knowledge: 0.2, value_creation: 0.25, initiative: 0.2, identity: 0.15, learning_agility: 0.2 },
  ai: { digital: 0.3, ai_partnership: 0.45, learning_agility: 0.15, cognitive: 0.1 },
  leadership: { collaboration: 0.3, identity: 0.25, cognitive: 0.2, wellbeing: 0.15, value_creation: 0.1 },
  entrepreneurship: { entrepreneurial: 0.4, initiative: 0.2, value_creation: 0.2, exposure: 0.1, wellbeing: 0.1 },
  research: { knowledge: 0.3, cognitive: 0.3, initiative: 0.2, digital: 0.1, learning_agility: 0.1 },
};

export function computeReadiness(perDimension) {
  const out = {};
  for (const [key, weights] of Object.entries(READINESS)) {
    let sum = 0;
    let wSum = 0;
    for (const [dimId, w] of Object.entries(weights)) {
      const s = perDimension[dimId];
      if (s == null) continue;
      sum += s * w;
      wSum += w;
    }
    out[key] = wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
  }
  return out;
}

// Strengths = top dimensions; gaps = lowest dimensions relative to a target ceiling.
export function analyseGaps(perDimension, target = 85) {
  const rows = DIMENSIONS.filter((d) => perDimension[d.id] != null).map((d) => {
    const score = perDimension[d.id];
    const gap = Math.max(0, Math.round((target - score) * 10) / 10);
    // Priority blends gap size with the dimension's HCI weight (high-leverage gaps first).
    const priority = Math.round(gap * d.weight * 10) / 10;
    return {
      id: d.id,
      name: d.name,
      short: d.short,
      score,
      gap,
      priority,
      weight: d.weight,
      level: levelFor(score).label,
    };
  });
  const strengths = [...rows].sort((a, b) => b.score - a.score).slice(0, 4);
  const gaps = [...rows].sort((a, b) => b.priority - a.priority).slice(0, 4);
  return { rows, strengths, gaps };
}

// Growth potential: how much headroom exists, modulated by learning agility (the
// dimension most predictive of future capability acquisition).
export function growthPotential(perDimension, hci) {
  const agility = perDimension['learning_agility'] ?? 50;
  const headroom = 100 - hci;
  // A learner with high agility realises a larger fraction of available headroom.
  const realisable = headroom * (0.45 + 0.4 * (agility / 100));
  const projected12mo = Math.min(100, Math.round((hci + realisable * 0.45) * 10) / 10);
  return {
    score: Math.round(realisable * 10) / 10,
    headroom: Math.round(headroom * 10) / 10,
    projected12mo,
    agility,
  };
}

// 24-month trajectory forecast with an optimistic / expected / conservative band.
// Gains compound on remaining headroom and decay as the score matures.
export function forecast(hci, perDimension, months = 24) {
  const agility = (perDimension['learning_agility'] ?? 50) / 100;
  const monthlyBase = 0.012 + 0.02 * agility; // expected fractional headroom captured / month
  const series = { expected: [], optimistic: [], conservative: [] };
  const run = (rate) => {
    let s = hci;
    const arr = [Math.round(s * 10) / 10];
    for (let m = 1; m <= months; m++) {
      const headroom = 100 - s;
      s += headroom * rate;
      arr.push(Math.round(s * 10) / 10);
    }
    return arr;
  };
  series.expected = run(monthlyBase);
  series.optimistic = run(monthlyBase * 1.6);
  series.conservative = run(monthlyBase * 0.55);
  series.months = Array.from({ length: months + 1 }, (_, i) => i);
  return series;
}

// Capability risk: dimensions that are both low and high-leverage create exposure.
export function riskAnalysis(perDimension) {
  const risks = [];
  for (const d of DIMENSIONS) {
    const s = perDimension[d.id];
    if (s == null) continue;
    if (s < 45) {
      const severity = s < 30 ? 'high' : s < 38 ? 'elevated' : 'moderate';
      risks.push({
        id: d.id,
        name: d.name,
        score: s,
        severity,
        note: `${d.short} is below resilient threshold and is a high-weight capability.`,
      });
    }
  }
  return risks.sort((a, b) => a.score - b.score).slice(0, 5);
}

// Synthetic benchmark norms (z-anchored) for peer / industry / country / global cohorts.
// In production these come from the Benchmarking Engine's live cohort tables.
const NORMS = {
  peer: 58,
  institution: 61,
  industry: 64,
  country: 56,
  continent: 59,
  global: 62,
};

export function benchmark(hci) {
  return Object.entries(NORMS).map(([cohort, mean]) => {
    const delta = Math.round((hci - mean) * 10) / 10;
    // Approximate percentile via a logistic mapping around the cohort mean (sd≈14).
    const z = (hci - mean) / 14;
    const percentile = Math.round(100 / (1 + Math.exp(-1.7 * z)));
    return { cohort, mean, delta, percentile };
  });
}

// Targeted development recommendations for the priority gaps.
const PLAYBOOK = {
  knowledge: 'Commit to a structured deep-dive: one authoritative source + one applied project per month.',
  value_creation: 'Ship one tangible, measurable outcome every two weeks and quantify its impact.',
  initiative: 'Start a self-directed flagship project and document evidence as you go.',
  exposure: 'Engage deliberately with a different culture, industry or discipline this quarter.',
  identity: 'Publish your thinking publicly and grow a credible professional network.',
  cognitive: 'Practise structured reasoning frameworks and red-team your own conclusions.',
  collaboration: 'Seek a high-stakes collaborative role and request direct feedback on communication.',
  learning_agility: 'Adopt a deliberate learning loop: learn → apply → reflect → unlearn, weekly.',
  digital: 'Build fluency in one core data/digital tool to working-professional level.',
  ai_partnership: 'Integrate an AI co-pilot into your daily workflow and master prompt orchestration.',
  entrepreneurial: 'Validate one opportunity with a small, real-world experiment this month.',
  wellbeing: 'Install recovery routines and protect energy with hard boundaries.',
};

export function recommendations(gaps) {
  return gaps.map((g) => ({
    dimensionId: g.id,
    dimension: g.name,
    priority: g.priority,
    action: PLAYBOOK[g.id],
    horizon: g.gap > 35 ? '90-day intensive' : g.gap > 20 ? '1-year build' : 'continuous',
  }));
}

// Full intelligence profile assembled from a scored response set.
export function buildProfile(scored) {
  const perDimension = scored.perDimension;
  const hci = computeHCI(perDimension);
  const level = levelFor(hci);
  const readiness = computeReadiness(perDimension);
  const gapAnalysis = analyseGaps(perDimension);
  const growth = growthPotential(perDimension, hci);
  const projection = forecast(hci, perDimension);
  const risks = riskAnalysis(perDimension);
  const benchmarks = benchmark(hci);
  const recs = recommendations(gapAnalysis.gaps);

  return {
    hci,
    level,
    completion: scored.completion,
    answered: scored.answered,
    totalItems: scored.totalItems,
    perDimension,
    dimensions: DIMENSIONS.map((d) => ({
      id: d.id,
      name: d.name,
      short: d.short,
      summary: d.summary,
      color: d.color,
      weight: d.weight,
      score: perDimension[d.id],
      level: perDimension[d.id] != null ? levelFor(perDimension[d.id]).label : null,
    })),
    readiness,
    strengths: gapAnalysis.strengths,
    gaps: gapAnalysis.gaps,
    growth,
    forecast: projection,
    risks,
    benchmarks,
    recommendations: recs,
    generatedAt: new Date().toISOString(),
  };
}
