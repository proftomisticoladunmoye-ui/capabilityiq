/* Capability IQ — ECharts factory helpers.
   Centralises theme + chart builders used across the dashboard and analytics views. */

const CIQ = (window.CIQ = window.CIQ || {});

const C = {
  navy: '#0B2545',
  navy2: '#1d4e85',
  gold: '#B8860B',
  gold2: '#cf9a1e',
  slate: '#5C677D',
  line: '#e3e8f0',
  ink: '#16213a',
};
CIQ.colors = C;

const FONT = "Inter, 'Segoe UI', sans-serif";
const charts = new Map();

function mount(el, option) {
  if (!el) return null;
  if (charts.has(el)) charts.get(el).dispose();
  const inst = echarts.init(el, null, { renderer: 'canvas' });
  inst.setOption(option);
  charts.set(el, inst);
  return inst;
}

// Resize all live charts on viewport change.
window.addEventListener('resize', () => charts.forEach((c) => c.resize()));
CIQ.resizeCharts = () => charts.forEach((c) => c.resize());
CIQ.disposeCharts = () => {
  charts.forEach((c) => c.dispose());
  charts.clear();
};

// ---- Capability radar --------------------------------------------------
CIQ.radar = function (el, dims, opts = {}) {
  const indicators = dims.map((d) => ({ name: d.short, max: 100 }));
  const values = dims.map((d) => d.score ?? 0);
  return mount(el, {
    textStyle: { fontFamily: FONT },
    tooltip: {},
    radar: {
      indicator: indicators,
      radius: '68%',
      splitNumber: 4,
      axisName: { color: C.slate, fontSize: 11 },
      splitLine: { lineStyle: { color: C.line } },
      splitArea: { areaStyle: { color: ['#fff', '#f8f9fb'] } },
      axisLine: { lineStyle: { color: C.line } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: 'Capability',
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { color: C.gold, width: 2 },
            itemStyle: { color: C.navy },
            areaStyle: { color: 'rgba(184,134,11,0.18)' },
          },
          opts.benchmark
            ? {
                value: dims.map(() => opts.benchmark),
                name: 'Benchmark',
                lineStyle: { color: C.slate, width: 1, type: 'dashed' },
                itemStyle: { color: C.slate },
                areaStyle: { color: 'rgba(92,103,125,0.05)' },
              }
            : null,
        ].filter(Boolean),
      },
    ],
  });
};

// ---- Capability wheel (polar bar) -------------------------------------
CIQ.wheel = function (el, dims) {
  return mount(el, {
    textStyle: { fontFamily: FONT },
    polar: { radius: ['28%', '78%'] },
    tooltip: { trigger: 'item', formatter: (p) => `${p.name}<br/><b>${p.value}</b>/100` },
    angleAxis: {
      type: 'category',
      data: dims.map((d) => d.short),
      axisLabel: { color: C.slate, fontSize: 10 },
      axisLine: { lineStyle: { color: C.line } },
    },
    radiusAxis: { max: 100, axisLabel: { show: false }, splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: 'bar',
        coordinateSystem: 'polar',
        data: dims.map((d) => ({
          value: d.score ?? 0,
          itemStyle: {
            borderRadius: 4,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: C.navy },
              { offset: 1, color: C.gold },
            ]),
          },
        })),
      },
    ],
  });
};

// ---- Trajectory forecast ----------------------------------------------
CIQ.trajectory = function (el, fc) {
  const x = fc.months.map((m) => (m === 0 ? 'Now' : `+${m}m`));
  const band = fc.optimistic.map((v, i) => [fc.conservative[i], v]);
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 38, right: 18, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['Expected', 'Range'], right: 0, top: 0, textStyle: { color: C.slate, fontSize: 11 } },
    xAxis: { type: 'category', data: x, axisLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.slate, fontSize: 10, interval: 2 } },
    yAxis: { type: 'value', min: Math.max(0, Math.floor(fc.conservative[0] - 8)), max: 100, splitLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.slate } },
    series: [
      { name: 'low', type: 'line', data: fc.conservative, lineStyle: { opacity: 0 }, stack: 'band', symbol: 'none' },
      { name: 'Range', type: 'line', data: fc.optimistic.map((v, i) => v - fc.conservative[i]), lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(184,134,11,0.12)' }, stack: 'band', symbol: 'none' },
      { name: 'Expected', type: 'line', data: fc.expected, smooth: true, symbol: 'none', lineStyle: { color: C.gold, width: 3 }, itemStyle: { color: C.gold } },
    ],
  });
};

// ---- HCI gauge ---------------------------------------------------------
CIQ.gauge = function (el, value) {
  return mount(el, {
    textStyle: { fontFamily: FONT },
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        progress: { show: true, width: 14, itemStyle: { color: C.gold } },
        axisLine: { lineStyle: { width: 14, color: [[1, C.line]] } },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { color: C.line } },
        axisLabel: { color: C.slate, fontSize: 9, distance: 14 },
        pointer: { width: 5, itemStyle: { color: C.navy } },
        anchor: { show: true, size: 10, itemStyle: { color: C.navy } },
        detail: { valueAnimation: true, fontSize: 30, fontWeight: 800, color: C.navy, offsetCenter: [0, '38%'], fontFamily: 'Poppins' },
        data: [{ value }],
      },
    ],
  });
};

// ---- Benchmark bars ----------------------------------------------------
CIQ.benchmarkBars = function (el, you, benchmarks) {
  const cats = benchmarks.map((b) => b.cohort.charAt(0).toUpperCase() + b.cohort.slice(1));
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 80, right: 28, top: 18, bottom: 18 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.slate } },
    yAxis: { type: 'category', data: cats, axisLabel: { color: C.ink, fontSize: 12 }, axisLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: 'bar',
        data: benchmarks.map((b) => b.mean),
        barWidth: 11,
        itemStyle: { color: C.slate, borderRadius: 4, opacity: 0.45 },
        markLine: {
          symbol: 'none',
          data: [{ xAxis: you }],
          lineStyle: { color: C.gold, width: 2 },
          label: { formatter: `You ${you}`, color: C.gold, fontWeight: 700, position: 'insideEndTop' },
        },
      },
    ],
  });
};

// ---- Heat map (institutional) -----------------------------------------
CIQ.heat = function (el, dimMeans) {
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 8, right: 8, top: 8, bottom: 70 },
    tooltip: { position: 'top', formatter: (p) => `${dimMeans[p.dataIndex].name}<br/><b>${p.value[1]}</b>` },
    xAxis: { type: 'category', data: dimMeans.map((d) => d.short), axisLabel: { rotate: 40, color: C.slate, fontSize: 10 }, splitArea: { show: true } },
    yAxis: { type: 'category', data: ['Cohort'], axisLabel: { color: C.slate } },
    visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eef1f6', C.slate, C.navy, C.gold] }, textStyle: { color: C.slate } },
    series: [{ type: 'heatmap', data: dimMeans.map((d, i) => [i, 0, d.mean]), label: { show: true, color: '#fff', fontWeight: 600 } }],
  });
};

// ---- Distribution bars -------------------------------------------------
CIQ.distribution = function (el, dist) {
  const palette = ['#9AA5B1', '#5C677D', '#2D6A9F', '#0B2545', '#B8860B'];
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 36, right: 16, top: 18, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dist.map((d) => d.label), axisLabel: { color: C.slate, fontSize: 10 }, axisLine: { lineStyle: { color: C.line } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.slate } },
    series: [{ type: 'bar', data: dist.map((d, i) => ({ value: d.count, itemStyle: { color: palette[i], borderRadius: 5 } })), barWidth: '52%' }],
  });
};

// ---- Correlation matrix heatmap ---------------------------------------
CIQ.corrMatrix = function (el, corr) {
  const labels = corr.items;
  const data = [];
  for (let i = 0; i < labels.length; i++)
    for (let j = 0; j < labels.length; j++) data.push([j, i, corr.matrix[i][j]]);
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 40, right: 14, top: 14, bottom: 50 },
    tooltip: { formatter: (p) => `${labels[p.value[1]]} × ${labels[p.value[0]]}<br/><b>r = ${p.value[2]}</b>` },
    xAxis: { type: 'category', data: labels, axisLabel: { color: C.slate, fontSize: 10 }, splitArea: { show: true } },
    yAxis: { type: 'category', data: labels, axisLabel: { color: C.slate, fontSize: 10 }, splitArea: { show: true } },
    visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#b5462f', '#f8f9fb', C.navy] }, textStyle: { color: C.slate, fontSize: 10 } },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 10, color: '#16213a' } }],
  });
};

// ---- Scree plot (EFA) --------------------------------------------------
CIQ.scree = function (el, scree, retained) {
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 38, right: 16, top: 22, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: scree.map((s) => s.component), name: 'Component', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: C.slate, fontSize: 11 }, axisLabel: { color: C.slate, fontSize: 10 }, axisLine: { lineStyle: { color: C.line } } },
    yAxis: { type: 'value', name: 'Eigenvalue', nameTextStyle: { color: C.slate, fontSize: 11 }, splitLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.slate } },
    series: [
      {
        type: 'line', data: scree.map((s) => s.eigenvalue), smooth: false, symbol: 'circle', symbolSize: 7,
        lineStyle: { color: C.gold, width: 2.5 },
        itemStyle: { color: (p) => (p.dataIndex < retained ? C.navy : C.slate) },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: C.slate, type: 'dashed' }, label: { formatter: 'Kaiser = 1', color: C.slate, fontSize: 10, position: 'insideEndTop' } },
      },
    ],
  });
};

// ---- Factor-loadings heatmap (EFA) ------------------------------------
CIQ.loadingsHeat = function (el, loadings, nFactors) {
  const data = [];
  loadings.forEach((l, i) => l.loadings.forEach((v, f) => data.push([f, i, v])));
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 120, right: 16, top: 30, bottom: 40 },
    tooltip: { formatter: (p) => `${loadings[p.value[1]].short} · F${p.value[0] + 1}<br/><b>${p.value[2]}</b>` },
    xAxis: { type: 'category', position: 'top', data: Array.from({ length: nFactors }, (_, i) => 'Factor ' + (i + 1)), axisLabel: { color: C.navy, fontWeight: 600, fontSize: 11 }, splitArea: { show: true } },
    yAxis: { type: 'category', data: loadings.map((l) => l.short), axisLabel: { color: C.slate, fontSize: 11 }, inverse: true, splitArea: { show: true } },
    visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#b5462f', '#f8f9fb', C.navy] }, textStyle: { color: C.slate, fontSize: 10 } },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 10, color: (p) => (Math.abs(p.value[2]) > 0.5 ? '#fff' : '#16213a'), formatter: (p) => p.value[2].toFixed(2) } }],
  });
};

// ---- Wright person-item map (Rasch) -----------------------------------
CIQ.wrightMap = function (el, wright) {
  const bins = wright.bins;
  const labels = bins.map((b) => b.logit);
  // bin the item difficulties onto the same logit bins
  const itemCounts = new Array(bins.length).fill(0);
  const itemLabels = bins.map(() => []);
  const lo = labels[0], step = labels.length > 1 ? labels[1] - labels[0] : 1;
  wright.items.forEach((it) => {
    let b = Math.round((it.difficulty - lo) / step);
    b = Math.max(0, Math.min(bins.length - 1, b));
    itemCounts[b]++; itemLabels[b].push(it.label);
  });
  const maxP = Math.max(1, ...bins.map((b) => b.count));
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 60, right: 60, top: 28, bottom: 28 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        return `Logit ${labels[i]}<br/>Persons: <b>${bins[i].count}</b><br/>Items: <b>${itemLabels[i].join(', ') || '—'}</b>`;
      },
    },
    legend: { data: ['Persons', 'Items'], top: 0, textStyle: { color: C.slate, fontSize: 11 } },
    xAxis: { type: 'value', axisLabel: { formatter: (v) => Math.abs(v), color: C.slate, fontSize: 10 }, splitLine: { lineStyle: { color: C.line } }, min: -maxP, max: maxP },
    yAxis: { type: 'category', data: labels, name: 'logit', nameTextStyle: { color: C.slate }, axisLabel: { color: C.slate, fontSize: 9, interval: 1 }, axisLine: { lineStyle: { color: C.line } } },
    series: [
      { name: 'Persons', type: 'bar', stack: 'x', data: bins.map((b) => -b.count), itemStyle: { color: C.slate, opacity: 0.65 }, barWidth: '80%' },
      { name: 'Items', type: 'bar', stack: 'x', data: itemCounts, itemStyle: { color: C.gold }, barWidth: '80%',
        label: { show: true, position: 'right', color: C.navy, fontSize: 10, formatter: (p) => itemLabels[p.dataIndex].join(' ') } },
    ],
  });
};

// ---- Category probability curves (Rasch RSM) --------------------------
CIQ.categoryCurves = function (el, curves) {
  const palette = ['#9AA5B1', '#5C677D', '#2D6A9F', '#0B2545', '#7a5b12', '#B8860B', '#cf9a1e'];
  return mount(el, {
    textStyle: { fontFamily: FONT },
    grid: { left: 40, right: 46, top: 24, bottom: 30 },
    tooltip: { trigger: 'axis' },
    legend: { data: curves.categories.map((_, k) => 'Cat ' + k).concat(['E(score)']), top: 0, textStyle: { color: C.slate, fontSize: 10 }, itemWidth: 14 },
    xAxis: { type: 'category', data: curves.theta, name: 'Ability θ (logit)', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: C.slate, fontSize: 11 }, axisLabel: { color: C.slate, fontSize: 9, interval: 7 }, axisLine: { lineStyle: { color: C.line } } },
    yAxis: [
      { type: 'value', name: 'P(category)', min: 0, max: 1, splitLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.slate } },
      { type: 'value', name: 'E(score)', min: 0, max: 6, position: 'right', splitLine: { show: false }, axisLabel: { color: C.slate } },
    ],
    series: [
      ...curves.categories.map((data, k) => ({ name: 'Cat ' + k, type: 'line', data, smooth: true, symbol: 'none', lineStyle: { color: palette[k], width: 2 } })),
      { name: 'E(score)', type: 'line', yAxisIndex: 1, data: curves.expected, smooth: true, symbol: 'none', lineStyle: { color: C.gold, width: 2.5, type: 'dashed' } },
    ],
  });
};

// ---- Mini hero orb (landing) ------------------------------------------
CIQ.heroOrb = function (el) {
  const dims = ['Knowledge', 'Value', 'Initiative', 'Exposure', 'Reputation', 'Cognition', 'Collab', 'Agility', 'Digital', 'AI', 'Venture', 'Resilience'];
  const vals = [78, 71, 66, 62, 70, 81, 74, 88, 69, 84, 64, 72];
  return mount(el, {
    textStyle: { fontFamily: FONT },
    radar: {
      indicator: dims.map((n) => ({ name: n, max: 100 })),
      radius: '70%',
      axisName: { color: '#8b94a6', fontSize: 9 },
      splitLine: { lineStyle: { color: '#e8ecf3' } },
      splitArea: { areaStyle: { color: ['#fff', '#f8f9fb'] } },
      axisLine: { lineStyle: { color: '#e8ecf3' } },
    },
    series: [{ type: 'radar', data: [{ value: vals, symbol: 'none', lineStyle: { color: C.gold, width: 2 }, areaStyle: { color: 'rgba(184,134,11,0.16)' } }] }],
  });
};
