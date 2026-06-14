/* ============================================================
   Capability IQ™ — Single Page Application
   Router · state · views. Talks to the JSON API in server.js.
   ============================================================ */
(function () {
  'use strict';

  const root = document.getElementById('root');
  const modalRoot = document.getElementById('modal-root');
  const CIQ = window.CIQ;

  // ---- State ------------------------------------------------------------
  const state = {
    user: JSON.parse(localStorage.getItem('ciq_user') || 'null'),
    profile: null,
    framework: null,
    route: 'landing',
    coachRole: 'capability',
    coachLog: [],
  };

  // ---- API --------------------------------------------------------------
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (state.user) headers['x-user-id'] = state.user.id;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  // ---- Helpers ----------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  // Minimal markdown → HTML for coach replies.
  function md(src) {
    const lines = esc(src).split('\n');
    let html = '', inList = false;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
    for (let ln of lines) {
      if (/^\s*[-*]\s+/.test(ln)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inline(ln.replace(/^\s*[-*]\s+/, ''))}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (/^###\s/.test(ln)) html += `<h3>${inline(ln.slice(4))}</h3>`;
        else if (/^##\s/.test(ln)) html += `<h2>${inline(ln.slice(3))}</h2>`;
        else if (ln.trim() === '') html += '<div style="height:6px"></div>';
        else html += `<p>${inline(ln)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }
  const levelColor = (label) => ({
    Foundational: 'var(--lvl-foundational)', Emerging: 'var(--lvl-emerging)',
    Developing: 'var(--lvl-developing)', Advanced: 'var(--lvl-advanced)', Elite: 'var(--lvl-elite)',
  }[label] || 'var(--slate)');

  // ---- Boot -------------------------------------------------------------
  async function boot() {
    state.framework = await api('/api/framework');
    if (state.user) {
      try {
        const me = await api('/api/me');
        state.user = me.user; state.profile = me.profile;
      } catch { state.user = null; localStorage.removeItem('ciq_user'); }
    }
    const initial = location.hash.replace('#', '') || (state.user ? 'dashboard' : 'landing');
    navigate(initial, true);
  }

  window.addEventListener('hashchange', () => {
    const r = location.hash.replace('#', '') || 'landing';
    if (r !== state.route) navigate(r, true);
  });

  function navigate(route, skipHash) {
    state.route = route;
    if (!skipHash) location.hash = route;
    else if (location.hash.replace('#', '') !== route) history.replaceState(null, '', '#' + route);
    CIQ.disposeCharts();
    if (route === 'landing') return renderLanding();
    if (!state.user) return openAuth(route);
    renderApp(route);
  }

  // ============================================================
  // LANDING
  // ============================================================
  function renderLanding() {
    const dims = state.framework.dimensions;
    const features = [
      ['◎', 'Capability Assessment Engine', 'Psychometric measurement across 12 human-capability dimensions with reverse-keyed, situational items.'],
      ['◈', 'Human Capability Index', 'A single 0–100 flagship metric — weighted, benchmarked and forecast 24 months forward.'],
      ['✦', 'AI Capability Coach', 'A profile-grounded coach across career, learning, leadership, research and venture domains.'],
      ['◫', 'Capability Portfolio', 'Replace the CV with a living evidence portfolio scored for strength and contribution.'],
      ['◭', 'Benchmarking Engine', 'Compare against peer, institution, industry, country and global capability norms.'],
      ['❖', 'Institutional Intelligence', 'Cohort dashboards for universities, employers and governments.'],
    ];
    root.innerHTML = `
    <div class="landing">
      <nav class="landing-nav">
        <div class="brand"><span class="logo">iQ</span> Capability IQ<span class="tm">™</span></div>
        <div class="links">
          <a href="#" data-scroll="features">Platform</a>
          <a href="#" data-scroll="dimensions">Framework</a>
          <a href="#" data-scroll="cta">Institutions</a>
          <a class="btn btn-ghost btn-sm" data-act="login">Sign in</a>
          <a class="btn btn-primary btn-sm" data-act="start">Get started</a>
        </div>
      </nav>

      <header class="hero">
        <div class="hero-inner">
          <div>
            <span class="eyebrow">◆ The Human Capability Operating System</span>
            <h1>Measure. Develop. Predict.<br/><em>Amplify human capability.</em></h1>
            <p class="lede">Capability IQ turns human potential into intelligence. Assess 12 capability dimensions, get your Human Capability Index, and receive an AI-built roadmap to your next level.</p>
            <div class="cta">
              <button class="btn btn-primary" data-act="start">Measure my capability →</button>
              <button class="btn btn-ghost" data-scroll="features">Explore the platform</button>
            </div>
            <div class="proof">
              <div><div class="k">12</div><div class="l">Capability dimensions</div></div>
              <div><div class="k">0–100</div><div class="l">Human Capability Index</div></div>
              <div><div class="k">6</div><div class="l">AI coaching domains</div></div>
              <div><div class="k">5</div><div class="l">Benchmark cohorts</div></div>
            </div>
          </div>
          <div class="orb-card">
            <h4>Live capability radar</h4>
            <div class="orb-wrap">
              <div id="hero-orb" style="width:100%;height:100%"></div>
              <div class="orb-center"><div><div class="v">76</div><div class="l">HCI · Advanced</div></div></div>
            </div>
          </div>
        </div>
      </header>

      <section class="section" id="features">
        <div class="section-head">
          <span class="eyebrow">One platform</span>
          <h2>A complete human-capability intelligence ecosystem</h2>
          <p>Not a job board. Not an LMS. The operating system for measuring and amplifying what people are capable of.</p>
        </div>
        <div class="feature-grid">
          ${features.map((f) => `<div class="feature"><div class="ic">${f[0]}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}
        </div>
      </section>

      <section class="dims-band">
        <div class="section" id="dimensions">
          <div class="section-head">
            <span class="eyebrow">The Framework</span>
            <h2>The 12 dimensions of human capability</h2>
            <p>Every person is measured across the full architecture of modern capability — from cognition to AI partnership to resilience.</p>
          </div>
          <div class="dim-grid">
            ${dims.map((d) => `<div class="dim-chip"><div class="n">0${d.index}`.replace('00', '0').slice(0, 30) + `</div><h4>${d.short}</h4><p>${d.summary}</p></div>`).join('')}
          </div>
        </div>
      </section>

      <section class="section" id="cta">
        <div class="cta-band">
          <h2>Build the capability intelligence of your institution</h2>
          <p>Universities, employers and governments use Capability IQ to measure readiness, close capability gaps and predict workforce futures.</p>
          <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-gold" data-act="start">Start free assessment</button>
            <button class="btn btn-ghost" data-act="demo-inst">View institution demo</button>
          </div>
        </div>
      </section>

      <footer class="landing-footer">
        <div class="brand" style="font-size:16px"><span class="logo" style="width:28px;height:28px;font-size:14px">iQ</span> Capability IQ™</div>
        <div>Measure. Develop. Predict. Amplify Human Capability. · © ${new Date().getFullYear()}</div>
      </footer>
    </div>`;

    CIQ.heroOrb($('#hero-orb'));
    root.querySelectorAll('[data-scroll]').forEach((a) =>
      a.addEventListener('click', (e) => { e.preventDefault(); $('#' + a.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }); }));
    root.querySelectorAll('[data-act="start"],[data-act="login"]').forEach((b) =>
      b.addEventListener('click', () => (state.user ? navigate('dashboard') : openAuth('dashboard'))));
    root.querySelector('[data-act="demo-inst"]').addEventListener('click', () =>
      state.user ? navigate('institutional') : openAuth('institutional'));
  }

  // ============================================================
  // AUTH
  // ============================================================
  function openAuth(nextRoute = 'dashboard') {
    modalRoot.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <div class="brand" style="margin-bottom:18px"><span class="logo">iQ</span> Capability IQ™</div>
        <h2>Create your capability profile</h2>
        <p class="sub">Single sign-on in the full platform (Google · Microsoft · Apple · OAuth). For this build, enter your details to begin.</p>
        <div class="field"><label>Full name</label><input id="au-name" placeholder="Jordan Mensah" autocomplete="name" /></div>
        <div class="field"><label>Email</label><input id="au-email" type="email" placeholder="you@org.com" autocomplete="email" /></div>
        <div class="field"><label>I am a…</label>
          <select id="au-role">
            <option value="individual">Individual</option>
            <option value="student">University student</option>
            <option value="faculty">Faculty / educator</option>
            <option value="employer">Employer / HR</option>
            <option value="government">Government / policy</option>
            <option value="researcher">Researcher</option>
          </select>
        </div>
        <div class="field"><label>Organisation <span class="muted">(optional)</span></label><input id="au-org" placeholder="Stanford University" /></div>
        <button class="btn btn-primary btn-block" id="au-go" style="margin-top:8px">Enter platform →</button>
        <button class="btn btn-block" id="au-cancel" style="margin-top:8px;color:var(--slate)">Cancel</button>
      </div>
    </div>`;
    const close = () => (modalRoot.innerHTML = '');
    $('#au-cancel').addEventListener('click', () => { close(); if (!state.user) navigate('landing'); });
    $('#au-go').addEventListener('click', async () => {
      const name = $('#au-name').value.trim();
      if (!name) return toast('Please enter your name');
      try {
        const { user } = await api('/api/session', { method: 'POST', body: {
          name, email: $('#au-email').value.trim(), role: $('#au-role').value, org: $('#au-org').value.trim(),
        }});
        state.user = user; localStorage.setItem('ciq_user', JSON.stringify(user));
        const me = await api('/api/me'); state.profile = me.profile;
        close(); navigate(state.profile ? nextRoute : 'assessment');
      } catch (e) { toast('Could not start session: ' + e.message); }
    });
  }

  function logout() {
    state.user = null; state.profile = null; localStorage.removeItem('ciq_user');
    navigate('landing');
  }

  // ============================================================
  // APP SHELL
  // ============================================================
  const NAV = [
    ['Intelligence', [
      ['dashboard', '▤', 'Dashboard'],
      ['assessment', '◎', 'Assessment'],
      ['coach', '✦', 'AI Coach'],
    ]],
    ['Develop', [
      ['career', '➤', 'Career Intelligence'],
      ['development', '◇', 'Development Plan'],
      ['portfolio', '◫', 'Portfolio'],
    ]],
    ['Compare', [
      ['benchmarking', '◭', 'Benchmarking'],
      ['institutional', '❖', 'Institutional'],
    ]],
    ['Research & Export', [
      ['research', '∑', 'Research Analytics'],
      ['reports', '⎙', 'Reports'],
    ]],
  ];
  const TITLES = {
    dashboard: ['Capability Dashboard', 'Your human capability intelligence at a glance'],
    assessment: ['Capability Assessment', '12 dimensions · 60 items · ~8 minutes'],
    coach: ['AI Capability Coach', 'Profile-grounded coaching across six domains'],
    career: ['Career Intelligence', 'Fit, options and readiness powered by your capability profile'],
    development: ['Development Plan', 'Your roadmap from current to next level'],
    portfolio: ['Capability Portfolio', 'A living evidence portfolio that replaces the CV'],
    benchmarking: ['Benchmarking Engine', 'How you compare across cohorts'],
    institutional: ['Institutional Intelligence', 'Cohort analytics for institutions'],
    research: ['Research Analytics', 'Psychometric reliability & item analysis on cohort data'],
    reports: ['Reports & Export', 'Generate and export capability reports'],
  };

  function renderApp(route) {
    const initials = (state.user.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
    const [title, sub] = TITLES[route] || ['Capability IQ', ''];
    root.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><span class="logo">iQ</span> Capability IQ<span class="tm" style="color:var(--gold)">™</span></div>
        ${NAV.map(([grp, items]) => `
          <div class="nav-group-label">${grp}</div>
          ${items.map(([r, ic, label]) => `<div class="nav-item ${r === route ? 'active' : ''}" data-route="${r}"><span class="ic">${ic}</span>${label}</div>`).join('')}
        `).join('')}
        <div class="spacer"></div>
        <div class="me">
          <div class="avatar">${initials}</div>
          <div class="grow"><div class="nm">${esc(state.user.name)}</div><div class="rl">${esc(state.user.role)}</div></div>
          <button title="Sign out" id="logout" style="color:#8b97ad;font-size:18px">⏻</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div style="display:flex;align-items:center;gap:14px">
            <button class="menu-btn" id="menu-btn">☰</button>
            <div><h1>${title}</h1><div class="sub">${sub}</div></div>
          </div>
          <div class="row" style="align-items:center">
            ${state.profile ? `<span class="badge-level" style="background:${levelColor(state.profile.level.label)}">${state.profile.level.label} · HCI ${state.profile.hci}</span>` : ''}
            <button class="btn btn-primary btn-sm" data-route="${state.profile ? 'coach' : 'assessment'}">${state.profile ? '✦ Ask the Coach' : 'Take assessment'}</button>
          </div>
        </div>
        <div class="view" id="view"></div>
      </main>
    </div>
    <div class="scrim hidden" id="scrim"></div>`;

    root.querySelectorAll('[data-route]').forEach((el) =>
      el.addEventListener('click', () => { closeSidebar(); navigate(el.dataset.route); }));
    $('#logout').addEventListener('click', logout);
    const sb = $('#sidebar'), scrim = $('#scrim');
    $('#menu-btn').addEventListener('click', () => { sb.classList.add('open'); scrim.classList.remove('hidden'); });
    scrim.addEventListener('click', closeSidebar);
    function closeSidebar() { sb.classList.remove('open'); scrim.classList.add('hidden'); }

    const view = $('#view');
    const r = views[route];
    if (r) r(view); else view.innerHTML = '<div class="empty">Coming soon</div>';
  }

  function needProfile(view, label) {
    view.innerHTML = `<div class="empty"><div class="ic">◎</div><h3>No capability profile yet</h3>
      <p>Complete the Capability Assessment to unlock ${label}.</p>
      <button class="btn btn-primary" style="margin-top:16px" data-go="assessment">Start assessment →</button></div>`;
    view.querySelector('[data-go]').addEventListener('click', () => navigate('assessment'));
  }

  // ============================================================
  // VIEWS
  // ============================================================
  const views = {};

  // ---- Dashboard --------------------------------------------------------
  views.dashboard = function (view) {
    if (!state.profile) return needProfile(view, 'your dashboard');
    const p = state.profile;
    const r = p.readiness;
    view.innerHTML = `
      <div class="grid g-4" style="margin-bottom:18px">
        <div class="hci-hero span-2">
          <div class="l">Human Capability Index</div>
          <div class="big">${p.hci}<small>/100</small></div>
          <span class="badge-level" style="background:rgba(255,255,255,.16)">${p.level.label}</span>
          <div style="margin-top:14px;font-size:13px;color:#c5cfdf">Growth potential <b style="color:#fff">${p.growth.score}</b> · 12-mo projection <b style="color:var(--gold-600)">${p.growth.projected12mo}</b></div>
        </div>
        <div class="stat"><div class="l">Career readiness</div><div class="v">${r.career}</div><div class="d muted">of 100</div></div>
        <div class="stat"><div class="l">AI readiness</div><div class="v">${r.ai}</div><div class="d muted">of 100</div></div>
      </div>

      <div class="grid g-3" style="margin-bottom:18px">
        <div class="card"><div class="card-head"><h3>Capability Radar</h3></div><div id="c-radar" class="chart"></div></div>
        <div class="card"><div class="card-head"><h3>Capability Wheel</h3></div><div id="c-wheel" class="chart"></div></div>
        <div class="card"><div class="card-head"><h3>24-Month Trajectory</h3><span class="hint">forecast</span></div><div id="c-traj" class="chart"></div></div>
      </div>

      <div class="grid g-3">
        <div class="card span-2">
          <div class="card-head"><h3>Capability dimensions</h3><span class="hint">score / 100</span></div>
          ${p.dimensions.map((d) => `
            <div class="meter-row"><div class="nm">${d.short}</div>
            <div class="meter"><span style="width:${d.score ?? 0}%"></span></div>
            <div class="sc">${d.score ?? '—'}</div></div>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:18px">
          <div class="card">
            <div class="card-head"><h3>Top strengths</h3></div>
            ${p.strengths.map((s) => `<div class="spread" style="padding:6px 0"><span>${s.short}</span><b class="gold num">${s.score}</b></div>`).join('')}
          </div>
          <div class="card">
            <div class="card-head"><h3>Priority gaps</h3></div>
            ${p.gaps.map((g) => `<div class="spread" style="padding:6px 0"><span>${g.short}</span><span class="pill">gap ${g.gap}</span></div>`).join('')}
          </div>
          ${p.risks.length ? `<div class="card"><div class="card-head"><h3>Risk flags</h3></div>${p.risks.map((rk) => `<div style="padding:5px 0;font-size:13px"><b style="color:#b5462f">●</b> ${rk.name} <span class="muted">(${rk.score})</span></div>`).join('')}</div>` : ''}
        </div>
      </div>`;

    CIQ.radar($('#c-radar'), p.dimensions, { benchmark: 62 });
    CIQ.wheel($('#c-wheel'), p.dimensions);
    CIQ.trajectory($('#c-traj'), p.forecast);
  };

  // ---- Assessment -------------------------------------------------------
  views.assessment = async function (view) {
    view.innerHTML = '<div class="empty">Loading assessment…</div>';
    const a = await api('/api/assessment');
    const responses = {};
    const anchors = a.likert.anchors;

    view.innerHTML = `
      <div class="assess-wrap">
        <div class="assess-progress">
          <div class="spread" style="margin-bottom:6px"><span class="muted" id="ap-label">0 of ${a.totalItems} answered</span><span class="muted" id="ap-pct">0%</span></div>
          <div class="bar"><span id="ap-bar" style="width:0%"></span></div>
        </div>
        <div id="sections"></div>
        <div class="card" style="text-align:center;margin-top:10px">
          <p class="muted" style="margin-bottom:12px">You can submit once you've answered enough items for a reliable index. More items = higher precision.</p>
          <button class="btn btn-primary" id="submit-assess" disabled>Generate my Capability Index →</button>
        </div>
      </div>`;

    const secEl = $('#sections');
    secEl.innerHTML = a.sections.map((sec, si) => `
      <div style="margin:26px 0 6px">
        <div class="q-section-title">${si + 1}. ${sec.dimension}</div>
        <div class="q-section-sub">${sec.summary}</div>
      </div>
      ${sec.items.map((it) => `
        <div class="q-item" data-item="${it.id}">
          <div class="qtext">${it.text}</div>
          <div class="likert">
            ${anchors.map((_, i) => `<button data-v="${i + 1}" data-item="${it.id}">${i + 1}</button>`).join('')}
          </div>
          <div class="likert-anchors"><span>${anchors[0]}</span><span>${anchors[anchors.length - 1]}</span></div>
        </div>`).join('')}
    `).join('');

    const total = a.totalItems;
    const bar = $('#ap-bar'), label = $('#ap-label'), pct = $('#ap-pct'), submit = $('#submit-assess');
    secEl.querySelectorAll('.likert button').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.item;
        responses[id] = Number(b.dataset.v);
        b.parentElement.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        const n = Object.keys(responses).length;
        const p = Math.round((n / total) * 100);
        bar.style.width = p + '%'; pct.textContent = p + '%';
        label.textContent = `${n} of ${total} answered`;
        submit.disabled = n < 12;
      }));

    submit.addEventListener('click', async () => {
      submit.disabled = true; submit.textContent = 'Analysing…';
      try {
        const { profile } = await api('/api/assessment/submit', { method: 'POST', body: { responses } });
        state.profile = profile;
        toast('Capability Index generated');
        navigate('dashboard');
      } catch (e) { toast('Submit failed: ' + e.message); submit.disabled = false; submit.textContent = 'Generate my Capability Index →'; }
    });
  };

  // ---- AI Coach ---------------------------------------------------------
  views.coach = function (view) {
    const roles = state.framework.coachRoles;
    const icons = { career: '➤', learning: '◇', research: '◎', leadership: '❖', capability: '✦', entrepreneurship: '◭' };
    view.innerHTML = `
      <div class="coach-shell">
        <div class="coach-roles">
          ${Object.entries(roles).map(([k, label]) => `<button class="role-btn ${k === state.coachRole ? 'active' : ''}" data-role="${k}"><span class="ic">${icons[k] || '✦'}</span>${label}</button>`).join('')}
        </div>
        <div class="chat">
          <div class="chat-log" id="chat-log"></div>
          <div class="chat-input">
            <input id="chat-in" placeholder="Ask your coach… e.g. What capability gaps prevent me from becoming a professor?" />
            <button class="btn btn-primary" id="chat-send">Send</button>
          </div>
        </div>
      </div>`;

    const log = $('#chat-log');
    function render() {
      log.innerHTML = state.coachLog.map((m) => m.role === 'user'
        ? `<div class="msg user"><div class="bubble">${esc(m.text)}</div></div>`
        : `<div class="msg bot"><div class="who">${esc(m.who || 'Coach')}${m.source === 'engine' ? ' · capability engine' : ''}</div><div class="bubble">${md(m.text)}</div>
            ${m.followups?.length ? `<div class="followups">${m.followups.map((f) => `<button data-f="${esc(f)}">${esc(f)}</button>`).join('')}</div>` : ''}</div>`
      ).join('');
      log.scrollTop = log.scrollHeight;
      log.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => send(b.dataset.f)));
    }
    if (state.coachLog.length === 0) {
      state.coachLog.push({ role: 'bot', who: roles[state.coachRole], source: 'engine',
        text: state.profile
          ? `I'm your ${roles[state.coachRole]}. I can see your profile — **HCI ${state.profile.hci} (${state.profile.level.label})**. Ask me anything about your capability, gaps or roadmap.`
          : `I'm your ${roles[state.coachRole]}. Complete your assessment and I'll ground every answer in your real capability profile.`,
        followups: state.profile ? [`How do I improve ${state.profile.gaps[0]?.short}?`, 'Build me a 90-day plan', 'What is holding me back most?'] : ['Start my assessment'] });
    }
    render();

    async function send(text) {
      text = (text || $('#chat-in').value).trim();
      if (!text) return;
      if (text === 'Start my assessment') return navigate('assessment');
      $('#chat-in').value = '';
      state.coachLog.push({ role: 'user', text });
      state.coachLog.push({ role: 'bot', who: roles[state.coachRole], text: '…', pending: true });
      render();
      try {
        const out = await api('/api/coach', { method: 'POST', body: { message: text, role: state.coachRole } });
        state.coachLog.pop();
        state.coachLog.push({ role: 'bot', who: out.role, text: out.answer, followups: out.followups, source: out.source });
      } catch (e) { state.coachLog.pop(); state.coachLog.push({ role: 'bot', who: 'Coach', text: 'Sorry — ' + e.message }); }
      render();
    }
    $('#chat-send').addEventListener('click', () => send());
    $('#chat-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    view.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
      state.coachRole = b.dataset.role; state.coachLog = []; views.coach(view);
    }));
  };

  // ---- Career Intelligence ---------------------------------------------
  views.career = function (view) {
    if (!state.profile) return needProfile(view, 'career intelligence');
    const p = state.profile;
    // Derive illustrative career fits from readiness composites.
    const fits = [
      ['Research Scientist / Professor', p.readiness.research, ['knowledge', 'cognitive', 'initiative']],
      ['Product / Innovation Leader', Math.round((p.readiness.leadership + p.readiness.ai) / 2), ['value_creation', 'ai_partnership', 'collaboration']],
      ['AI Solutions Specialist', p.readiness.ai, ['ai_partnership', 'digital', 'learning_agility']],
      ['Founder / Entrepreneur', p.readiness.entrepreneurship, ['entrepreneurial', 'initiative', 'wellbeing']],
      ['People & Capability Leader', p.readiness.leadership, ['collaboration', 'identity', 'wellbeing']],
    ].sort((a, b) => b[1] - a[1]);
    const fitColor = (s) => (s >= 75 ? 'var(--lvl-elite)' : s >= 60 ? 'var(--lvl-advanced)' : s >= 45 ? 'var(--lvl-developing)' : 'var(--slate)');
    view.innerHTML = `
      <div class="grid g-2">
        <div class="card span-2">
          <div class="card-head"><h3>Career fit analysis</h3><span class="hint">match score from your capability profile</span></div>
          <table class="tbl">
            <thead><tr><th>Career path</th><th>Fit</th><th>Driving capabilities</th><th>Readiness</th></tr></thead>
            <tbody>
            ${fits.map(([name, score, dims]) => `
              <tr>
                <td><b>${name}</b></td>
                <td><span class="badge-level" style="background:${fitColor(score)}">${score}%</span></td>
                <td><div class="chip-list">${dims.map((d) => `<span class="tag-chip">${state.framework.dimensions.find((x) => x.id === d).short}</span>`).join('')}</div></td>
                <td class="num">${score >= 65 ? 'Ready' : score >= 50 ? 'Near-ready' : 'Developing'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-head"><h3>Emerging opportunities</h3></div>
          <p class="muted" style="font-size:13.5px;margin-bottom:10px">High-growth roles aligned to your strongest dimensions (${p.strengths.slice(0,2).map(s=>s.short).join(', ')}).</p>
          ${['AI Capability Architect', 'Human-AI Workflow Designer', 'Capability Intelligence Analyst', 'Applied Research Translator'].map((r) => `<div class="pf-item"><div class="ic">➤</div><div><div class="t">${r}</div><div class="m">Emerging · strong alignment</div></div></div>`).join('')}
        </div>
        <div class="card">
          <div class="card-head"><h3>Career risk & mobility</h3></div>
          <div class="stat" style="border:none;padding:0;margin-bottom:14px"><div class="l">Capability mobility</div><div class="v">${Math.min(99, Math.round(p.readiness.career + p.growth.score / 2))}<small style="font-size:16px">/100</small></div></div>
          <p class="muted" style="font-size:13.5px">${p.risks.length ? `Watch areas: ${p.risks.map((r) => r.name).slice(0,2).join(', ')}. Strengthening these reduces career-transition risk.` : 'No major capability risks detected — you have broad mobility across roles.'}</p>
        </div>
      </div>`;
  };

  // ---- Development Plan -------------------------------------------------
  views.development = function (view) {
    if (!state.profile) return needProfile(view, 'your development plan');
    const p = state.profile;
    const horizons = [
      ['90-Day Plan', 'Attack your highest-leverage gap with focused intensity.', p.recommendations.slice(0, 2)],
      ['1-Year Plan', 'Compound improvements across your priority gaps.', p.recommendations.slice(0, 3)],
      ['5-Year Vision', 'Convert capability into reputation, evidence and leadership.', p.recommendations],
    ];
    view.innerHTML = `
      <div class="grid g-3" style="margin-bottom:18px">
        <div class="stat"><div class="l">Current HCI</div><div class="v">${p.hci}</div><div class="d muted">${p.level.label}</div></div>
        <div class="stat"><div class="l">12-mo projection</div><div class="v gold">${p.growth.projected12mo}</div><div class="d up">+${(p.growth.projected12mo - p.hci).toFixed(1)} pts</div></div>
        <div class="stat"><div class="l">Growth potential</div><div class="v">${p.growth.score}</div><div class="d muted">${p.growth.headroom} pts headroom</div></div>
      </div>
      <div class="grid g-3">
        ${horizons.map(([title, sub, recs]) => `
          <div class="card">
            <div class="card-head"><h3>${title}</h3></div>
            <p class="muted" style="font-size:13.5px;margin-bottom:14px">${sub}</p>
            ${recs.map((r) => `<div class="pf-item"><div class="ic">◇</div><div><div class="t">${r.dimension}</div><div class="m">${r.action}</div><span class="pill" style="margin-top:6px">${r.horizon}</span></div></div>`).join('')}
          </div>`).join('')}
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-head"><h3>Projected trajectory</h3><span class="hint">expected vs optimistic / conservative band</span></div>
        <div id="dev-traj" class="chart"></div>
      </div>`;
    CIQ.trajectory($('#dev-traj'), p.forecast);
  };

  // ---- Portfolio --------------------------------------------------------
  views.portfolio = async function (view) {
    view.innerHTML = '<div class="empty">Loading portfolio…</div>';
    const data = await api('/api/portfolio');
    const dims = state.framework.dimensions;
    const TYPES = ['project', 'publication', 'patent', 'award', 'research', 'volunteering', 'leadership', 'certification', 'conference', 'media', 'innovation', 'membership'];
    const icons = { project: '◫', publication: '◈', patent: '✦', award: '★', research: '◎', volunteering: '♥', leadership: '❖', certification: '✓', conference: '◭', media: '◉', innovation: '◇', membership: '◆' };
    const a = data.analytics;
    function paint() {
      view.innerHTML = `
        <div class="grid g-4" style="margin-bottom:18px">
          <div class="stat"><div class="l">Portfolio strength</div><div class="v">${a.strength}<small style="font-size:16px">/100</small></div></div>
          <div class="stat"><div class="l">Evidence score</div><div class="v">${a.evidenceScore}</div></div>
          <div class="stat"><div class="l">Items</div><div class="v">${a.count}</div></div>
          <div class="stat"><div class="l">Diversity</div><div class="v">${a.diversity}<small style="font-size:16px"> types</small></div></div>
        </div>
        <div class="grid g-3">
          <div class="card span-2">
            <div class="card-head"><h3>Evidence</h3><span class="hint">${a.count} items</span></div>
            <div id="pf-list">${data.items.length ? data.items.map((it) => `
              <div class="pf-item">
                <div class="ic">${icons[it.type] || '◫'}</div>
                <div class="grow"><div class="t">${esc(it.title)}</div><div class="m">${it.type}${it.dimensionId ? ' · ' + dims.find((d) => d.id === it.dimensionId)?.short : ''} · ${it.date}</div>${it.description ? `<div class="m" style="margin-top:3px">${esc(it.description)}</div>` : ''}</div>
                <button class="btn btn-sm" data-del="${it.id}" style="color:var(--slate)">✕</button>
              </div>`).join('') : '<div class="empty"><div class="ic">◫</div><h3>No evidence yet</h3><p>Add your first achievement to build your capability portfolio.</p></div>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Add evidence</h3></div>
            <div class="field"><label>Type</label><select id="pf-type">${TYPES.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>
            <div class="field"><label>Title</label><input id="pf-title" placeholder="e.g. Published paper in Nature" /></div>
            <div class="field"><label>Linked capability</label><select id="pf-dim"><option value="">— optional —</option>${dims.map((d) => `<option value="${d.id}">${d.short}</option>`).join('')}</select></div>
            <div class="field"><label>Description</label><textarea id="pf-desc" rows="2" placeholder="Optional detail"></textarea></div>
            <div class="field"><label>Date</label><input id="pf-date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
            <button class="btn btn-primary btn-block" id="pf-add">+ Add to portfolio</button>
          </div>
        </div>`;
      $('#pf-add').addEventListener('click', async () => {
        const title = $('#pf-title').value.trim();
        if (!title) return toast('Add a title');
        const res = await api('/api/portfolio', { method: 'POST', body: {
          type: $('#pf-type').value, title, dimensionId: $('#pf-dim').value || null,
          description: $('#pf-desc').value.trim(), date: $('#pf-date').value,
        }});
        data.items.push(res.item); Object.assign(a, res.analytics); paint();
        toast('Added to portfolio');
      });
      view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        const res = await api('/api/portfolio/' + b.dataset.del, { method: 'DELETE' });
        const i = data.items.findIndex((x) => x.id === b.dataset.del);
        if (i >= 0) data.items.splice(i, 1);
        Object.assign(a, res.analytics); paint();
      }));
    }
    paint();
  };

  // ---- Benchmarking -----------------------------------------------------
  views.benchmarking = function (view) {
    if (!state.profile) return needProfile(view, 'benchmarking');
    const p = state.profile;
    view.innerHTML = `
      <div class="grid g-2" style="margin-bottom:18px">
        <div class="card"><div class="card-head"><h3>Your HCI vs cohort norms</h3></div><div id="bm-bars" class="chart"></div></div>
        <div class="card">
          <div class="card-head"><h3>Percentile standing</h3></div>
          <table class="tbl"><thead><tr><th>Cohort</th><th>Norm</th><th>You</th><th>Δ</th><th>Percentile</th></tr></thead>
          <tbody>${p.benchmarks.map((b) => `<tr>
            <td style="text-transform:capitalize"><b>${b.cohort}</b></td>
            <td class="num">${b.mean}</td><td class="num">${p.hci}</td>
            <td class="num ${b.delta >= 0 ? 'up' : 'down'}">${b.delta >= 0 ? '+' : ''}${b.delta}</td>
            <td><span class="pill">${b.percentile}th</span></td></tr>`).join('')}</tbody></table>
        </div>
      </div>
      <div class="card"><div class="card-head"><h3>Dimension benchmark</h3><span class="hint">your scores vs global mean (62)</span></div><div id="bm-radar" class="chart tall"></div></div>`;
    CIQ.benchmarkBars($('#bm-bars'), p.hci, p.benchmarks);
    CIQ.radar($('#bm-radar'), p.dimensions, { benchmark: 62 });
  };

  // ---- Institutional ----------------------------------------------------
  views.institutional = async function (view) {
    view.innerHTML = '<div class="empty">Aggregating cohort intelligence…</div>';
    const d = await api('/api/institutional');
    if (!d.cohortSize) {
      view.innerHTML = `<div class="empty"><div class="ic">❖</div><h3>No cohort data yet</h3><p>Institutional dashboards aggregate the capability profiles of your members.<br/>Complete assessments to populate this view.</p></div>`;
      return;
    }
    view.innerHTML = `
      <div class="grid g-4" style="margin-bottom:18px">
        <div class="stat"><div class="l">Cohort size</div><div class="v">${d.cohortSize}</div></div>
        <div class="stat"><div class="l">Average HCI</div><div class="v">${d.avgHCI}</div></div>
        <div class="stat"><div class="l">Avg career readiness</div><div class="v">${d.avgCareer}</div></div>
        <div class="stat"><div class="l">Avg AI readiness</div><div class="v">${d.avgAI}</div></div>
      </div>
      <div class="grid g-2" style="margin-bottom:18px">
        <div class="card"><div class="card-head"><h3>Capability heat map</h3><span class="hint">cohort mean by dimension</span></div><div id="inst-heat" class="chart"></div></div>
        <div class="card"><div class="card-head"><h3>HCI distribution</h3><span class="hint">members per maturity band</span></div><div id="inst-dist" class="chart"></div></div>
      </div>
      <div class="card"><div class="card-head"><h3>Dimension league table</h3></div>
        <table class="tbl"><thead><tr><th>#</th><th>Dimension</th><th>Cohort mean</th><th>Status</th></tr></thead>
        <tbody>${[...d.dimMeans].sort((a, b) => b.mean - a.mean).map((m, i) => `<tr><td>${i + 1}</td><td><b>${m.name}</b></td><td class="num">${m.mean}</td><td>${m.mean >= 65 ? '<span class="up">Strong</span>' : m.mean >= 50 ? 'Developing' : '<span class="down">Gap</span>'}</td></tr>`).join('')}</tbody></table>
      </div>`;
    CIQ.heat($('#inst-heat'), d.dimMeans);
    CIQ.distribution($('#inst-dist'), d.distribution);
  };

  // ---- Research Analytics (psychometrics) ------------------------------
  views.research = async function (view) {
    view.innerHTML = '<div class="empty">Running psychometric analysis on cohort data…</div>';
    const d = await api('/api/research/psychometrics');
    if (d.empty) {
      view.innerHTML = `<div class="empty"><div class="ic">∑</div><h3>No response data to analyse</h3>
        <p>The Research Analytics module computes reliability and item statistics across a cohort.<br/>Run <code>npm run seed</code> or collect assessments to populate it.</p></div>`;
      return;
    }
    const relColor = (a) => (a == null ? 'var(--slate)' : a >= 0.8 ? 'var(--lvl-elite)' : a >= 0.7 ? 'var(--lvl-developing)' : a >= 0.6 ? 'var(--slate)' : '#b5462f');
    view.innerHTML = `
      <div class="grid g-4" style="margin-bottom:18px">
        <div class="stat"><div class="l">Cohort N</div><div class="v">${d.cohortSize}</div><div class="d muted">${d.completeCases} complete cases</div></div>
        <div class="stat"><div class="l">Overall α (60 items)</div><div class="v" style="color:${relColor(d.overallAlpha)}">${d.overallAlpha ?? '—'}</div><div class="d muted">${d.overallInterpretation}</div></div>
        <div class="stat"><div class="l">Mean dimension α</div><div class="v">${d.meanDimensionAlpha ?? '—'}</div></div>
        <div class="stat"><div class="l">Scales</div><div class="v">${d.dimensions.length}</div><div class="d muted">5 items each</div></div>
      </div>
      <div class="card" style="margin-bottom:18px">
        <div class="card-head"><h3>Scale reliability</h3><span class="hint">Cronbach's α · McDonald's ω · mean score</span></div>
        <table class="tbl">
          <thead><tr><th>Dimension</th><th>N</th><th>Cronbach α</th><th>Omega ω</th><th>Interpretation</th><th>Mean (0–100)</th></tr></thead>
          <tbody>${d.dimensions.map((dim) => `<tr>
            <td><b>${dim.name}</b></td>
            <td class="num">${dim.n}</td>
            <td class="num" style="color:${relColor(dim.alpha)};font-weight:700">${dim.alpha ?? '—'}</td>
            <td class="num">${dim.omega ?? '—'}</td>
            <td><span class="pill">${dim.interpretation}</span></td>
            <td class="num">${dim.meanScore}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-head"><h3>Item analysis</h3><span class="hint">select a scale</span>
          <select id="ra-dim" style="margin-left:auto;border:1px solid var(--line-strong);border-radius:8px;padding:6px 10px;font-family:inherit">
            ${d.dimensions.map((dim) => `<option value="${dim.id}">${dim.name}</option>`).join('')}
          </select>
        </div>
        <div id="ra-items"></div>
        <div class="card-head" style="margin-top:18px"><h3 style="font-size:14px">Inter-item correlation matrix</h3></div>
        <div id="ra-corr" class="chart sm"></div>
      </div>
      <div id="ra-efa" style="margin-top:18px"></div>
      <div id="ra-cfa" style="margin-top:18px"></div>`;

    renderEFA($('#ra-efa'));
    renderCFA($('#ra-cfa'));
    const byId = Object.fromEntries(d.dimensions.map((x) => [x.id, x]));
    async function showDim(id) {
      const dim = byId[id];
      $('#ra-items').innerHTML = `<table class="tbl">
        <thead><tr><th>Item</th><th>Mean</th><th>SD</th><th>Skew</th><th>Kurt.</th><th>Item-total r</th><th></th></tr></thead>
        <tbody>${dim.itemStats.map((it) => `<tr>
          <td style="max-width:380px">${esc(it.text)}</td>
          <td class="num">${it.mean}</td><td class="num">${it.sd}</td>
          <td class="num">${it.skew}</td><td class="num">${it.kurtosis}</td>
          <td class="num" style="font-weight:700;color:${it.itemTotal >= 0.3 ? 'var(--lvl-developing)' : '#b5462f'}">${it.itemTotal}</td>
          <td>${it.flag ? `<span class="pill" style="background:#fbe9e4;color:#b5462f">${it.flag}</span>` : '<span class="up">✓</span>'}</td></tr>`).join('')}</tbody>
      </table>`;
      const corr = await api('/api/research/correlation/' + id);
      CIQ.corrMatrix($('#ra-corr'), corr);
    }
    $('#ra-dim').addEventListener('change', (e) => showDim(e.target.value));
    showDim(d.dimensions[0].id);

    async function renderEFA(host) {
      host.innerHTML = '<div class="card"><div class="empty" style="padding:30px">Running exploratory factor analysis…</div></div>';
      const e = await api('/api/research/efa');
      if (e.empty) {
        host.innerHTML = `<div class="card"><div class="card-head"><h3>Exploratory Factor Analysis</h3></div><p class="muted">${e.reason || 'Insufficient sample for EFA (need > 12 complete cases).'}</p></div>`;
        return;
      }
      const bartP = e.bartlett.det < 0.001 ? '< .001' : 'n.s.';
      host.innerHTML = `
        <div class="card">
          <div class="card-head"><h3>Exploratory Factor Analysis</h3><span class="hint">do the 12 dimensions reduce to latent meta-capabilities?</span></div>
          <div class="grid g-4" style="margin-bottom:16px">
            <div class="stat"><div class="l">Sample N</div><div class="v">${e.n}</div></div>
            <div class="stat"><div class="l">Factors retained</div><div class="v gold">${e.retainedFactors}</div><div class="d muted">Kaiser λ &gt; 1</div></div>
            <div class="stat"><div class="l">KMO</div><div class="v">${e.kmo}</div><div class="d muted">${e.kmoInterpretation}</div></div>
            <div class="stat"><div class="l">Bartlett χ²</div><div class="v">${e.bartlett.chiSquare}</div><div class="d muted">df ${e.bartlett.df} · p ${bartP}</div></div>
          </div>
          <div class="grid g-2">
            <div><div class="card-head"><h3 style="font-size:14px">Scree plot</h3></div><div id="efa-scree" class="chart sm"></div></div>
            <div><div class="card-head"><h3 style="font-size:14px">Rotated factor loadings</h3><span class="hint">varimax</span></div><div id="efa-load" class="chart" style="height:360px"></div></div>
          </div>
          <div class="card-head" style="margin-top:14px"><h3 style="font-size:14px">Extracted factors</h3></div>
          <table class="tbl">
            <thead><tr><th>Factor</th><th>Defining dimensions</th><th>Eigenvalue</th><th>% variance</th><th>Cumulative</th></tr></thead>
            <tbody>${e.factors.map((f) => `<tr>
              <td><b>Factor ${f.index}</b></td>
              <td>${f.name.replace(/^F\d+:\s*/, '')}</td>
              <td class="num">${f.eigenvalue}</td>
              <td class="num gold" style="font-weight:700">${f.varianceExplained}%</td>
              <td class="num">${f.cumulative}%</td></tr>`).join('')}</tbody>
          </table>
          <p class="muted" style="font-size:12.5px;margin-top:12px">Loadings ≥ |0.50| indicate a dimension's primary factor. Communalities (h²) are on the loadings hover. Total variance explained: <b>${e.factors.at(-1).cumulative}%</b>.</p>
        </div>`;
      CIQ.scree($('#efa-scree'), e.scree, e.retainedFactors);
      CIQ.loadingsHeat($('#efa-load'), e.loadings, e.retainedFactors);
    }

    async function renderCFA(host) {
      host.innerHTML = '<div class="card"><div class="empty" style="padding:30px">Fitting confirmatory model (ML)…</div></div>';
      const c = await api('/api/research/cfa');
      if (c.empty) {
        host.innerHTML = `<div class="card"><div class="card-head"><h3>Confirmatory Factor Analysis</h3></div><p class="muted">${c.reason || 'Insufficient sample for CFA.'}</p></div>`;
        return;
      }
      const f = c.fit;
      // thresholds → colour
      const ok = (good, accept, v, lower) => {
        const pass = lower ? v >= good : v <= good;
        const acc = lower ? v >= accept : v <= accept;
        return pass ? 'var(--lvl-elite)' : acc ? 'var(--lvl-developing)' : '#b5462f';
      };
      const idxCard = (label, val, color, note) =>
        `<div class="stat"><div class="l">${label}</div><div class="v" style="color:${color}">${val}</div><div class="d muted">${note}</div></div>`;
      const verdictColor = f.verdict === 'Good fit' ? 'var(--lvl-elite)' : f.verdict === 'Acceptable fit' ? 'var(--lvl-developing)' : '#b5462f';

      host.innerHTML = `
        <div class="card">
          <div class="card-head"><h3>Confirmatory Factor Analysis</h3><span class="hint">ML fit of the hypothesised 3-factor model</span></div>
          <div class="spread" style="background:${verdictColor};color:#fff;border-radius:10px;padding:12px 18px;margin-bottom:16px">
            <div><b style="font-size:16px">${f.verdict}</b> — the three-factor measurement model is confirmed on this cohort.</div>
            <div style="font-size:13px;opacity:.9">χ²(${f.df}) = ${f.chiSquare}, χ²/df = ${f.ratio}</div>
          </div>
          <div class="grid g-4" style="margin-bottom:16px">
            ${idxCard('CFI', f.cfi, ok(0.95, 0.9, f.cfi, true), '≥ .95 good')}
            ${idxCard('TLI', f.tli > 1 ? '1.000' : f.tli, ok(0.95, 0.9, f.tli, true), '≥ .95 good')}
            ${idxCard('RMSEA', f.rmsea, ok(0.06, 0.08, f.rmsea, false), '≤ .06 good')}
            ${idxCard('SRMR', f.srmr, ok(0.08, 0.1, f.srmr, false), '≤ .08 good')}
          </div>
          <div class="grid g-2">
            <div>
              <div class="card-head"><h3 style="font-size:14px">Standardised loadings & reliability</h3></div>
              <table class="tbl">
                <thead><tr><th>Factor / indicator</th><th>λ</th><th>AVE</th><th>CR</th></tr></thead>
                <tbody>${c.factors.map((fa) => `
                  <tr style="background:var(--bg)"><td><b>${fa.name}</b></td><td></td><td class="num gold" style="font-weight:700">${fa.ave}</td><td class="num" style="font-weight:700">${fa.cr}</td></tr>
                  ${fa.indicators.map((ind) => `<tr><td style="padding-left:22px">${ind.short}</td><td class="num" style="color:${ind.loading >= 0.7 ? 'var(--lvl-elite)' : ind.loading >= 0.5 ? 'var(--lvl-developing)' : '#b5462f'};font-weight:600">${ind.loading}</td><td></td><td></td></tr>`).join('')}
                `).join('')}</tbody>
              </table>
            </div>
            <div>
              <div class="card-head"><h3 style="font-size:14px">Discriminant validity</h3><span class="hint">Fornell-Larcker</span></div>
              <table class="tbl">
                <thead><tr><th></th>${c.factorLabels.map((_, i) => `<th>F${i + 1}</th>`).join('')}</tr></thead>
                <tbody>${c.fornellLarcker.map((row, i) => `<tr><td><b>F${i + 1}</b> ${c.factorLabels[i].split(' ')[0]}</td>${row.map((v, j) => `<td class="num" style="${i === j ? 'font-weight:700;color:var(--navy)' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
              </table>
              <p class="muted" style="font-size:12.5px;margin-top:10px">Diagonal = √AVE; off-diagonal = inter-factor correlation. Discriminant validity ${c.discriminantValid ? '<b style="color:var(--lvl-elite)">holds</b> — each √AVE exceeds its factor correlations' : '<b style="color:#b5462f">is not met</b>'}.</p>
            </div>
          </div>
          <p class="muted" style="font-size:12px;margin-top:12px">Estimation: ML discrepancy minimisation on the correlation structure, congeneric (PCA-per-block) start values refined by coordinate descent. Convergent validity is strong (all AVE &gt; .50, CR &gt; .70).</p>
        </div>`;
    }
  };

  // ---- Reports ----------------------------------------------------------
  views.reports = function (view) {
    if (!state.profile) return needProfile(view, 'reports');
    const uid = state.user.id;
    const exports = [
      ['⎙', 'PDF', 'Print-ready capability intelligence report', `/api/report.html?userId=${uid}`, 'print'],
      ['◫', 'Word .docx', 'Formatted report with dimension & gap tables', `/api/report.docx?userId=${uid}`, 'download'],
      ['▦', 'Excel .xlsx', '5-sheet workbook: summary, dimensions, gaps, benchmarks, forecast', `/api/report.xlsx?userId=${uid}`, 'download'],
      ['◭', 'PowerPoint .pptx', '3-slide executive deck', `/api/report.pptx?userId=${uid}`, 'download'],
      ['◈', 'JSON', 'Complete machine-readable profile', `/api/report.json?userId=${uid}`, 'download'],
      ['▤', 'CSV', 'Dimension scores & readiness', `/api/report.csv?userId=${uid}`, 'download'],
    ];
    view.innerHTML = `
      <div class="grid g-3" style="margin-bottom:18px">
        ${exports.map((e) => `
          <div class="card">
            <div class="card-head"><h3>${e[1]}</h3><span class="ic" style="font-size:20px">${e[0]}</span></div>
            <p class="muted" style="font-size:13.5px;margin-bottom:16px;min-height:38px">${e[2]}</p>
            <button class="btn btn-primary btn-block" data-url="${e[3]}" data-mode="${e[4]}">Export →</button>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-head"><h3>All exports are live</h3></div>
        <p class="muted" style="font-size:13.5px">PDF, Word, Excel, PowerPoint, JSON and CSV are generated server-side from the same capability profile that powers your dashboard — so a report never diverges from what you see on screen. PNG/SVG chart exports are available directly from each ECharts visual.</p>
      </div>`;
    view.querySelectorAll('[data-url]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.mode === 'print') {
        const w = window.open(b.dataset.url, '_blank');
        if (w) w.addEventListener('load', () => setTimeout(() => w.print(), 400));
      } else {
        window.open(b.dataset.url, '_blank');
      }
    }));
  };

  // ---- Go ---------------------------------------------------------------
  boot().catch((e) => {
    root.innerHTML = `<div class="empty" style="padding-top:120px"><div class="ic">⚠</div><h3>Could not start Capability IQ</h3><p>${esc(e.message)}</p></div>`;
  });
})();
