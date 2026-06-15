// Reporting & export framework.
// Produces CSV, JSON and a print-ready HTML report (which the browser exports to PDF).
// The same profile object feeds Word/Excel/PPTX generators in the full platform.

import { DIMENSIONS } from './capabilities.js';

export function profileToCSV(profile) {
  const rows = [['Dimension', 'Score', 'Level', 'Weight']];
  for (const d of profile.dimensions) {
    rows.push([d.name, d.score ?? '', d.level ?? '', d.weight]);
  }
  rows.push([]);
  rows.push(['Human Capability Index', profile.hci, profile.level.label, '']);
  rows.push(['Career readiness', profile.readiness.career, '', '']);
  rows.push(['AI readiness', profile.readiness.ai, '', '']);
  rows.push(['Leadership readiness', profile.readiness.leadership, '', '']);
  rows.push(['Entrepreneurship readiness', profile.readiness.entrepreneurship, '', '']);
  rows.push(['Research readiness', profile.readiness.research, '', '']);
  return rows
    .map((r) => r.map((c) => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(','))
    .join('\n');
}

export function profileToHTML(profile, user) {
  const dimRows = profile.dimensions
    .map(
      (d) => `<tr><td>${d.name}</td><td class="num">${d.score ?? '—'}</td>
      <td>${d.level ?? '—'}</td>
      <td><div class="bar"><span style="width:${d.score ?? 0}%"></span></div></td></tr>`
    )
    .join('');

  const gapRows = profile.gaps
    .map(
      (g, i) =>
        `<tr><td>${i + 1}</td><td>${g.name}</td><td class="num">${g.score}</td><td class="num">${g.gap}</td><td>${profile.recommendations[i]?.action || ''}</td></tr>`
    )
    .join('');

  const benchRows = profile.benchmarks
    .map(
      (b) =>
        `<tr><td style="text-transform:capitalize">${b.cohort}</td><td class="num">${b.mean}</td><td class="num">${b.delta > 0 ? '+' : ''}${b.delta}</td><td class="num">${b.percentile}th</td></tr>`
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Capability IQ Report — ${user?.name || 'Individual'}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: 'Merriweather', Georgia, serif; color:#1a2233; line-height:1.5; max-width:900px; margin:0 auto; padding:24px; }
  h1,h2,h3 { font-family:'Inter','Segoe UI',sans-serif; color:#0B2545; }
  h1 { font-size:26px; margin-bottom:2px; }
  .tag { color:#B8860B; font-weight:600; letter-spacing:.04em; font-family:'Inter',sans-serif; font-size:12px; text-transform:uppercase; }
  .hero { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0B2545; padding-bottom:14px; margin-bottom:18px; }
  .score { text-align:right; }
  .score .big { font-size:54px; font-weight:800; color:#0B2545; font-family:'Inter',sans-serif; line-height:1; }
  .score .lvl { color:#B8860B; font-weight:700; font-family:'Inter',sans-serif; }
  table { width:100%; border-collapse:collapse; margin:10px 0 22px; font-family:'Inter',sans-serif; font-size:13px; }
  th { text-align:left; background:#0B2545; color:#fff; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
  td { padding:7px 10px; border-bottom:1px solid #e6e9ef; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; }
  .bar { background:#eef1f6; border-radius:6px; height:8px; width:120px; overflow:hidden; }
  .bar span { display:block; height:100%; background:linear-gradient(90deg,#0B2545,#B8860B); }
  .meta { color:#5C677D; font-family:'Inter',sans-serif; font-size:12px; }
  .pillars { display:flex; gap:10px; margin:14px 0; }
  .pill { flex:1; background:#F8F9FB; border:1px solid #e6e9ef; border-radius:10px; padding:10px 12px; font-family:'Inter',sans-serif; }
  .pill .l { font-size:11px; color:#5C677D; text-transform:uppercase; }
  .pill .v { font-size:22px; font-weight:700; color:#0B2545; }
  footer { margin-top:30px; color:#5C677D; font-size:11px; font-family:'Inter',sans-serif; border-top:1px solid #e6e9ef; padding-top:10px; }
  .logo-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .logo { border-radius:9px; flex:none; }
  @media screen and (max-width:600px) {
    body { padding:16px; }
    .hero { flex-direction:column; align-items:flex-start; gap:12px; }
    .score { text-align:left; }
    .pillars { flex-wrap:wrap; }
    .pill { min-width:30%; }
  }
</style></head><body>
<div class="hero">
  <div class="brandcol">
    <div class="logo-row">
      <svg class="logo" width="38" height="38" viewBox="0 0 100 100" aria-label="Capability IQ logo">
        <rect width="100" height="100" rx="22" fill="#0B2545"/>
        <text x="50" y="68" font-size="52" text-anchor="middle" fill="#B8860B" font-family="Inter, Arial, sans-serif" font-weight="800">iQ</text>
      </svg>
      <div class="tag">Capability IQ™ · Human Capability Intelligence Report</div>
    </div>
    <h1>${user?.name || 'Individual Capability Profile'}</h1>
    <div class="meta">${user?.role || 'individual'} · Generated ${new Date(profile.generatedAt).toLocaleDateString()} · ${profile.completion}% complete</div>
  </div>
  <div class="score">
    <div class="big">${profile.hci}</div>
    <div class="lvl">${profile.level.label}</div>
    <div class="meta">HCI / 100</div>
  </div>
</div>

<div class="pillars">
  <div class="pill"><div class="l">Career</div><div class="v">${profile.readiness.career ?? '—'}</div></div>
  <div class="pill"><div class="l">AI</div><div class="v">${profile.readiness.ai ?? '—'}</div></div>
  <div class="pill"><div class="l">Leadership</div><div class="v">${profile.readiness.leadership ?? '—'}</div></div>
  <div class="pill"><div class="l">Entrepreneur</div><div class="v">${profile.readiness.entrepreneurship ?? '—'}</div></div>
  <div class="pill"><div class="l">Research</div><div class="v">${profile.readiness.research ?? '—'}</div></div>
</div>

<h2>Capability Dimensions</h2>
<table><thead><tr><th>Dimension</th><th>Score</th><th>Level</th><th>Profile</th></tr></thead>
<tbody>${dimRows}</tbody></table>

<h2>Priority Development Gaps</h2>
<table><thead><tr><th>#</th><th>Dimension</th><th>Score</th><th>Gap</th><th>Recommended action</th></tr></thead>
<tbody>${gapRows}</tbody></table>

<h2>Benchmarking</h2>
<table><thead><tr><th>Cohort</th><th>Mean</th><th>Delta</th><th>Percentile</th></tr></thead>
<tbody>${benchRows}</tbody></table>

<h2>Growth Outlook</h2>
<p>Growth potential score <strong>${profile.growth.score}</strong> with ${profile.growth.headroom} points of headroom.
Projected 12-month HCI: <strong>${profile.growth.projected12mo}</strong>. Modelled 24-month optimistic ceiling: <strong>${profile.forecast.optimistic.at(-1)}</strong>.</p>

<footer>Capability IQ™ — Measure. Develop. Predict. Amplify Human Capability. This report is generated from a self-assessment instrument and is intended for developmental purposes.</footer>
</body></html>`;
}

// Portfolio analytics: evidence score and per-dimension capability contribution.
const TYPE_WEIGHT = {
  publication: 5,
  patent: 5,
  research: 4,
  award: 4,
  innovation: 4,
  project: 3,
  leadership: 3,
  conference: 2,
  certification: 2,
  media: 2,
  membership: 1,
  volunteering: 1,
};

export function portfolioAnalytics(items) {
  const byType = {};
  const byDimension = {};
  let evidence = 0;
  for (const it of items) {
    const w = TYPE_WEIGHT[it.type] ?? 1;
    evidence += w;
    byType[it.type] = (byType[it.type] || 0) + 1;
    if (it.dimensionId) byDimension[it.dimensionId] = (byDimension[it.dimensionId] || 0) + w;
  }
  // Strength is a saturating function of accumulated evidence weight.
  const strength = Math.round(100 * (1 - Math.exp(-evidence / 18)));
  return {
    count: items.length,
    evidenceScore: evidence,
    strength,
    byType,
    byDimension,
    diversity: Object.keys(byType).length,
  };
}
