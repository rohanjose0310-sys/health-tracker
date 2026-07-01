/* ============================================================
   Cycle Care — app logic
   A gentle period tracker for a boyfriend who cares.
   All data lives on THIS device (localStorage). Nothing is uploaded.
   ============================================================ */
'use strict';

/* ---------------- Storage ---------------- */
const KEY = 'cyclecare.v1';
const DAY = 86400000;

const DEFAULTS = {
  partnerName: '',
  yourName: '',
  cycleLength: 28,
  periodLength: 5,
  // Seeded with her real cycle: started 30 June 2026.
  history: [{ start: '2026-06-30', end: null }],
  prefs: {
    comfortFoods: [],
    drinks: [],
    cravings: [],
    activities: [],
    relief: [],
    loveLanguage: '',
    avoid: '',
    notes: '',
  },
  checkState: {}, // { 'YYYY-MM-DD': { 'itemId': true } }
  logs: {},       // { 'YYYY-MM-DD': { flow, mood, symptoms:[], note } }
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    // shallow-merge to survive schema additions
    return {
      ...structuredClone(DEFAULTS),
      ...s,
      prefs: { ...DEFAULTS.prefs, ...(s.prefs || {}) },
    };
  } catch (e) {
    return structuredClone(DEFAULTS);
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
let state = load();

/* ---------------- Date helpers ---------------- */
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function parse(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function diffDays(a, b) {
  return Math.round((a - b) / DAY);
}
function fmt(d, opts = { month: 'short', day: 'numeric' }) {
  return d.toLocaleDateString(undefined, opts);
}

/* ---------------- Cycle math ---------------- */
function sortedStarts() {
  return state.history
    .map((h) => parse(h.start))
    .sort((a, b) => a - b);
}

function avgCycle() {
  const starts = sortedStarts();
  if (starts.length >= 2) {
    let sum = 0, n = 0;
    for (let i = 1; i < starts.length; i++) {
      const gap = diffDays(starts[i], starts[i - 1]);
      if (gap >= 18 && gap <= 45) { sum += gap; n++; } // ignore outliers
    }
    if (n) return Math.round(sum / n);
  }
  return state.cycleLength;
}

/* Returns the full picture for `date` (default today). */
function cycleInfo(date = today()) {
  const starts = sortedStarts();
  const cyc = avgCycle();
  const plen = state.periodLength;

  if (!starts.length) {
    return { hasData: false, cycleLength: cyc, periodLength: plen };
  }

  // Find the most recent period start on/before `date`.
  let lastStart = null;
  for (const s of starts) if (s <= date) lastStart = s;
  // If date is before the very first record, project backwards.
  if (!lastStart) lastStart = starts[0];

  const dayOfCycle = diffDays(date, lastStart) + 1; // 1-indexed
  const nextStart = addDays(lastStart, cyc);
  const daysUntilNext = diffDays(nextStart, date);
  const ovulation = addDays(nextStart, -14);
  const daysUntilOvul = diffDays(ovulation, date);

  // Fertile window: 5 days before ovulation through ovulation day.
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = ovulation;
  // PMS: 5 days before next period.
  const pmsStart = addDays(nextStart, -5);

  let phase;
  if (dayOfCycle <= plen) phase = 'menstrual';
  else if (date >= fertileStart && date < ovulation) phase = 'fertile';
  else if (iso(date) === iso(ovulation)) phase = 'ovulation';
  else if (date >= pmsStart) phase = 'pms';
  else if (dayOfCycle <= Math.round(cyc / 2)) phase = 'follicular';
  else phase = 'luteal';

  return {
    hasData: true,
    date,
    lastStart,
    nextStart,
    dayOfCycle: Math.max(1, dayOfCycle),
    cycleLength: cyc,
    periodLength: plen,
    daysUntilNext,
    ovulation,
    daysUntilOvul,
    fertileStart,
    fertileEnd,
    pmsStart,
    phase,
  };
}

/* Is `date` inside a logged (or predicted) period? */
function classifyDay(date) {
  // logged periods
  for (const h of state.history) {
    const s = parse(h.start);
    const e = h.end ? parse(h.end) : addDays(s, state.periodLength - 1);
    if (date >= s && date <= e) return 'period';
  }
  const info = cycleInfo(date);
  if (!info.hasData) return null;
  // predicted future periods (project a few cycles ahead)
  const cyc = info.cycleLength;
  const firstStart = sortedStarts()[0];
  const k = Math.floor(diffDays(date, firstStart) / cyc);
  for (let i = 0; i <= k + 2; i++) {
    const ps = addDays(firstStart, i * cyc);
    const pe = addDays(ps, state.periodLength - 1);
    if (date >= ps && date <= pe && date > today()) return 'predperiod';
  }
  if (iso(date) === iso(info.ovulation)) return 'ovul';
  if (date >= info.fertileStart && date <= info.fertileEnd) return 'fertile';
  if (date >= info.pmsStart && date < info.nextStart) return 'pms';
  return null;
}

/* ---------------- Phase content ---------------- */
const PHASES = {
  menstrual: {
    name: 'Period', color: '#f06795',
    feel: (n) => `${n ? n : 'She'} may feel low-energy, crampy, or tender right now. Warmth, softness, and zero pressure go a long way. 💗`,
    care: [
      { t: 'Fill a hot water bottle / heating pad', tag: 'Cramps ease with heat on the lower belly or back' },
      { t: 'Make something warm & comforting to eat', tag: 'Soup, congee, noodles, dark chocolate' },
      { t: 'Keep her hydrated', tag: 'Warm water or ginger/peppermint tea helps bloating' },
      { t: 'Stock pain relief & supplies', tag: 'Ibuprofen, pads/tampons, fresh underwear' },
      { t: 'Offer iron-rich snacks', tag: 'Blood loss dips iron — leafy greens, red meat, dark choc' },
      { t: 'Plan a cozy low-key night', tag: 'Movie, blankets, cuddles — no big outings' },
      { t: 'Be extra patient & gentle', tag: 'A back rub and reassurance beat advice' },
    ],
  },
  follicular: {
    name: 'Follicular', color: '#a8d0ff',
    feel: (n) => `Energy and mood are climbing back up. ${n ? n : 'She'} may feel fresh, social, and up for things again. ☀️`,
    care: [
      { t: 'Suggest a fun plan or date', tag: 'Rising energy — great for activities she loves' },
      { t: 'Cook something fresh & light', tag: 'She may crave lighter, brighter food now' },
      { t: 'Encourage a workout or walk together', tag: 'Energy supports movement she enjoys' },
      { t: 'Be spontaneous', tag: 'Openness and optimism are high this week' },
    ],
  },
  fertile: {
    name: 'Fertile window', color: '#9fe3c9',
    feel: (n) => `${n ? n : 'She'} is likely feeling her most energetic, confident, and affectionate. 🌿`,
    care: [
      { t: 'Plan a special date', tag: 'Peak energy, mood, and confidence' },
      { t: 'Be affectionate & present', tag: 'Libido and closeness often peak here' },
      { t: 'Note: this is the fertile window', tag: 'Higher chance of pregnancy — not a contraception tool' },
      { t: 'Keep meals balanced', tag: 'Fresh food, good hydration' },
    ],
  },
  ovulation: {
    name: 'Ovulation', color: '#7ad3ad',
    feel: (n) => `Right around ovulation — ${n ? n : 'she'} may feel radiant and high-energy, though some feel a twinge of mid-cycle cramp. 🌸`,
    care: [
      { t: 'Make her feel appreciated', tag: 'Confidence peaks — a compliment lands well' },
      { t: 'Have a light painkiller handy', tag: 'Some feel a brief ovulation twinge (mittelschmerz)' },
      { t: 'Plan something memorable', tag: 'Great energy for a proper date' },
    ],
  },
  luteal: {
    name: 'Luteal', color: '#b09cf0',
    feel: (n) => `Energy gently winds down. ${n ? n : 'She'} may start craving comfort and calm as the next period approaches. 🌙`,
    care: [
      { t: 'Keep comfort snacks around', tag: 'Cravings (salty / sweet / carby) start ramping up' },
      { t: 'Ease off the caffeine together', tag: 'Can reduce irritability & breast tenderness' },
      { t: 'Offer magnesium-rich food', tag: 'Dark chocolate, nuts, bananas — may ease PMS' },
      { t: 'Protect her rest', tag: 'Wind-down evenings help as energy dips' },
    ],
  },
  pms: {
    name: 'PMS', color: '#c8a0e8',
    feel: (n) => `The days before her period. ${n ? n : 'She'} may feel more emotional, bloated, tired, or irritable — none of it is personal. Lead with patience. 🫂`,
    care: [
      { t: 'Lead with patience & reassurance', tag: 'Mood swings are hormonal, not about you' },
      { t: 'Stock her cravings in advance', tag: 'Have the salty/sweet comfort foods ready' },
      { t: 'Pre-position period supplies', tag: 'Pads/tampons, painkillers, hot water bottle' },
      { t: 'Reduce her load', tag: 'Handle a chore or errand without being asked' },
      { t: 'Offer magnesium & water', tag: 'May ease bloating, headaches, and mood' },
      { t: 'Keep plans flexible', tag: 'Low energy — an easy escape hatch is kind' },
    ],
  },
};

/* Merge her saved preferences into a phase's checklist. */
function careItemsFor(phase) {
  const base = PHASES[phase].care.map((c, i) => ({ id: `${phase}-${i}`, ...c, fav: false }));
  const p = state.prefs;
  const extras = [];
  const push = (arr, verb, tag) => {
    (arr || []).forEach((v, i) => extras.push({
      id: `pref-${verb}-${i}-${v}`, t: `${verb} ${v}`, tag, fav: true,
    }));
  };
  if (phase === 'menstrual' || phase === 'pms' || phase === 'luteal') {
    push(p.comfortFoods, 'Get / make', 'Her comfort food 💗');
    push(p.cravings, 'Have', 'Her craving 💗');
    push(p.drinks, 'Bring her a', 'Her go-to drink 💗');
    push(p.relief, 'Set up', 'What helps her 💗');
  }
  if (phase === 'follicular' || phase === 'fertile' || phase === 'ovulation') {
    push(p.activities, 'Suggest', 'Something she loves 💗');
  }
  return [...extras, ...base];
}

/* ---------------- Rendering ---------------- */
const views = document.getElementById('views');
let current = 'today';
let calMonth = today().getMonth();
let calYear = today().getFullYear();
let careTab = 'guide';

function h(html) { return html; }

function render() {
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('on', t.dataset.view === current));
  if (current === 'today') views.innerHTML = viewToday();
  else if (current === 'calendar') views.innerHTML = viewCalendar();
  else if (current === 'care') views.innerHTML = viewCare();
  else if (current === 'settings') views.innerHTML = viewSettings();
  views.scrollTop = 0;
  wire();
}

/* ---- Today ---- */
function viewToday() {
  const name = state.partnerName.trim();
  const info = cycleInfo();
  if (!info.hasData) {
    return `<div class="view">
      ${header('Today', 'Let’s set things up 💗')}
      <div class="card center">
        <p class="muted">Add her most recent period start date to begin.</p>
        <button class="btn mt" data-go="calendar">Log her period</button>
      </div></div>`;
  }
  const ph = PHASES[info.phase];
  const totalDays = info.cycleLength;
  const pct = Math.min(1, (info.dayOfCycle - 1) / totalDays);
  const R = 92, C = 2 * Math.PI * R;
  const off = C * (1 - pct);

  const items = careItemsFor(info.phase);
  const todayKey = iso(today());
  const checks = state.checkState[todayKey] || {};

  const greeting = name ? `How ${name} is doing` : 'How she’s doing';

  return `<div class="view">
    ${header(greeting, `${fmt(today(), { weekday: 'long', month: 'long', day: 'numeric' })}`)}

    <div class="card hero">
      <div class="ring-wrap">
        <svg viewBox="0 0 220 220">
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="${ph.color}"/>
              <stop offset="1" stop-color="#b09cf0"/>
            </linearGradient>
          </defs>
          <circle class="ring-bg" cx="110" cy="110" r="${R}"/>
          <circle class="ring-fg" cx="110" cy="110" r="${R}"
            stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
        </svg>
        <div class="ring-center">
          <div class="day-num">${info.dayOfCycle}</div>
          <div class="day-lbl">Cycle Day</div>
        </div>
      </div>
      <div class="phase-pill"><span class="dot" style="background:${ph.color}"></span>${ph.name}</div>
      <p class="feel">${ph.feel(name)}</p>

      <div class="stats">
        <div class="stat"><div class="n">${info.dayOfCycle}</div><div class="l">Day of cycle</div></div>
        <div class="stat"><div class="n">${info.daysUntilNext <= 0 ? '•' : info.daysUntilNext}</div><div class="l">${info.daysUntilNext <= 0 ? 'Due now' : 'Days to period'}</div></div>
        <div class="stat"><div class="n">${info.cycleLength}</div><div class="l">Cycle length</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Today’s care plan</h2>
      <p class="sub">Tap to check things off. Items marked 💗 are her saved favourites.</p>
      <ul class="checklist">
        ${items.map((it) => `
          <li class="check-item ${checks[it.id] ? 'done' : ''}" data-check="${it.id}">
            <span class="check-box"><svg viewBox="0 0 20 20"><path d="M8 13.2 4.8 10l-1.4 1.4L8 16 17 7l-1.4-1.4z"/></svg></span>
            <span class="ci-text ${it.fav ? 'ci-fav' : ''}">${esc(it.t)}<span class="ci-tag">${esc(it.tag)}</span></span>
          </li>`).join('')}
      </ul>
      <button class="btn ghost sm mt" data-go="care">Personalise these →</button>
    </div>

    <p class="disclaimer">Predictions are estimates and every body is different. This is a care companion, not medical advice or birth control.</p>
  </div>`;
}

/* ---- Calendar ---- */
function viewCalendar() {
  const first = new Date(calYear, calMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    const cls = classifyDay(date);
    const isToday = iso(date) === iso(today());
    cells += `<div class="cal-cell ${cls || ''} ${isToday ? 'today' : ''}" data-day="${iso(date)}">${d}</div>`;
  }

  const info = cycleInfo();
  const predBlock = info.hasData ? `
    <div class="card">
      <h2>What’s coming</h2>
      <ul class="checklist">
        ${predRow('🩸', 'Next period', `${fmt(info.nextStart, { weekday: 'short', month: 'long', day: 'numeric' })}`, info.daysUntilNext > 0 ? `in ${info.daysUntilNext} days` : 'around now')}
        ${predRow('🌸', 'Ovulation (est.)', `${fmt(info.ovulation, { weekday: 'short', month: 'long', day: 'numeric' })}`, info.daysUntilOvul > 0 ? `in ${info.daysUntilOvul} days` : (info.daysUntilOvul === 0 ? 'today' : 'passed'))}
        ${predRow('🌿', 'Fertile window', `${fmt(info.fertileStart)} – ${fmt(info.fertileEnd)}`, '')}
        ${predRow('🌙', 'PMS may start', `${fmt(info.pmsStart, { weekday: 'short', month: 'long', day: 'numeric' })}`, '')}
      </ul>
    </div>` : '';

  return `<div class="view">
    ${header('Calendar', 'Her cycle at a glance')}
    <div class="card">
      <div class="cal-head">
        <div class="m">${monthName}</div>
        <div class="cal-nav">
          <button data-cal="-1" aria-label="Previous month">‹</button>
          <button data-cal="today" aria-label="This month">•</button>
          <button data-cal="1" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="cal-grid">
        ${dows.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="legend">
        <span><i style="background:linear-gradient(135deg,var(--rose),var(--rose-deep))"></i>Period</span>
        <span><i style="background:repeating-linear-gradient(45deg,rgba(240,103,149,.4),rgba(240,103,149,.4) 4px,transparent 4px,transparent 8px)"></i>Predicted</span>
        <span><i style="background:linear-gradient(135deg,var(--mint),var(--sky))"></i>Fertile</span>
        <span><i style="background:rgba(176,156,240,.5)"></i>PMS</span>
      </div>
    </div>

    ${predBlock}

    <div class="card">
      <h2>Log a period</h2>
      <p class="sub">Tap a day on the calendar to set it as a start date, or add one here. The more you log, the smarter predictions get.</p>
      <div class="field">
        <label>Period start date</label>
        <input type="date" id="newStart" value="${iso(today())}" max="${iso(today())}"/>
      </div>
      <div class="btn-row">
        <button class="btn" id="addPeriod">Add start date</button>
        <button class="btn ghost" id="endToday">Mark ended today</button>
      </div>
      ${state.history.length ? historyList() : ''}
    </div>
  </div>`;
}
function predRow(emoji, title, val, tag) {
  return `<li class="check-item" style="cursor:default">
    <span style="font-size:22px;flex:none;width:26px;text-align:center">${emoji}</span>
    <span class="ci-text"><strong>${title}</strong> — ${esc(val)}<span class="ci-tag">${esc(tag)}</span></span>
  </li>`;
}
function historyList() {
  const rows = [...state.history]
    .sort((a, b) => parse(b.start) - parse(a.start))
    .slice(0, 8)
    .map((hst, idx) => {
      const realIdx = state.history.indexOf(hst);
      const s = parse(hst.start);
      const label = hst.end
        ? `${fmt(s, { month: 'short', day: 'numeric' })} – ${fmt(parse(hst.end), { month: 'short', day: 'numeric' })}`
        : `${fmt(s, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      return `<div class="chip">🩸 ${label}<span class="x" data-delperiod="${realIdx}">✕</span></div>`;
    }).join('');
  return `<hr class="hr"><div class="chips">${rows}</div>`;
}

/* ---- Care ---- */
function viewCare() {
  const name = state.partnerName.trim() || 'her';
  return `<div class="view">
    ${header('Care', `Everything to show up for ${esc(name)}`)}
    <div class="seg">
      <button data-caretab="guide" class="${careTab === 'guide' ? 'on' : ''}">Phase guide</button>
      <button data-caretab="prefs" class="${careTab === 'prefs' ? 'on' : ''}">Her favourites</button>
    </div>
    ${careTab === 'guide' ? careGuide() : carePrefs()}
  </div>`;
}
function careGuide() {
  const cur = cycleInfo().phase;
  const order = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal', 'pms'];
  return `<div class="card">
    <h2>The four phases, simply</h2>
    <p class="sub">Her hormones shift through the month — so do her energy, mood, and needs. Here’s how to meet each one.</p>
    ${order.map((k) => {
      const p = PHASES[k];
      const isCur = k === cur;
      return `<details class="acc" ${isCur ? 'open' : ''}>
        <summary><span class="dot" style="background:${p.color}"></span>${p.name}${isCur ? ' · now' : ''}<span class="chev">›</span></summary>
        <div class="body">
          <p>${p.feel(state.partnerName.trim())}</p>
          <strong>How to show up:</strong>
          <ul>${p.care.map((c) => `<li>${esc(c.t)} <span style="opacity:.7">— ${esc(c.tag)}</span></li>`).join('')}</ul>
        </div>
      </details>`;
    }).join('')}
  </div>`;
}
function carePrefs() {
  const p = state.prefs;
  const group = (key, title, sub, placeholder) => `
    <div class="card">
      <h2>${title}</h2>
      <p class="sub">${sub}</p>
      <div class="chips" id="chips-${key}">
        ${(p[key] || []).map((v, i) => `<span class="chip">${esc(v)}<span class="x" data-delpref="${key}:${i}">✕</span></span>`).join('')}
        <span class="chip add" data-addpref="${key}" data-ph="${esc(placeholder)}">+ Add</span>
      </div>
      ${(p[key] || []).length === 0 ? `<p class="empty-hint">Nothing yet — tap “+ Add”.</p>` : ''}
    </div>`;

  return `
    <p class="muted" style="margin:0 4px 14px">Save what <strong>she</strong> loves. These appear as 💗 favourites in her daily care plan at the right time of the month.</p>
    ${group('comfortFoods', 'Comfort foods 🍜', 'Meals & treats that make her feel better', 'e.g. tomato soup')}
    ${group('cravings', 'Cravings 🍫', 'What she reaches for around her period', 'e.g. dark chocolate')}
    ${group('drinks', 'Drinks 🍵', 'Her go-to warm or comforting drinks', 'e.g. ginger tea')}
    ${group('relief', 'What helps her feel better 🧣', 'Heating pad, meds, a specific blanket…', 'e.g. hot water bottle')}
    ${group('activities', 'Things she loves to do 🎬', 'Her favourite ways to relax or have fun', 'e.g. cozy movie night')}
    <div class="card">
      <h2>Notes to self 📝</h2>
      <p class="sub">Anything else that helps you take care of her.</p>
      <div class="field">
        <label>Her love language / what she needs most</label>
        <input type="text" id="pref-loveLanguage" value="${esc(p.loveLanguage)}" placeholder="e.g. quality time & words of affirmation"/>
      </div>
      <div class="field">
        <label>Things to avoid when she’s not feeling well</label>
        <input type="text" id="pref-avoid" value="${esc(p.avoid)}" placeholder="e.g. don’t try to ‘fix it’, just listen"/>
      </div>
      <div class="field">
        <label>Free notes</label>
        <textarea id="pref-notes" placeholder="Anything you learn about her cycle…">${esc(p.notes)}</textarea>
      </div>
      <button class="btn" id="saveNotes">Save notes</button>
    </div>`;
}

/* ---- Settings ---- */
function viewSettings() {
  return `<div class="view">
    ${header('Settings', 'Tune it to her, and to you')}
    <div class="card">
      <h2>Names</h2>
      <div class="field"><label>Her name</label>
        <input type="text" id="set-partner" value="${esc(state.partnerName)}" placeholder="e.g. Mia"/></div>
      <div class="field"><label>Your name (optional)</label>
        <input type="text" id="set-you" value="${esc(state.yourName)}" placeholder="e.g. Alex"/></div>
      <button class="btn" id="saveNames">Save</button>
    </div>

    <div class="card">
      <h2>Cycle settings</h2>
      <p class="sub">Defaults are fine to start — the app learns her real average as you log more periods.</p>
      <div class="field">
        <label>Average cycle length (days)</label>
        <div class="stepper"><button data-step="cycleLength:-1">−</button><div class="val" id="v-cycle">${state.cycleLength}</div><button data-step="cycleLength:1">+</button></div>
      </div>
      <div class="field">
        <label>Typical period length (days)</label>
        <div class="stepper"><button data-step="periodLength:-1">−</button><div class="val" id="v-period">${state.periodLength}</div><button data-step="periodLength:1">+</button></div>
      </div>
      <p class="tiny">Detected average from her logged history: <strong>${avgCycle()} days</strong>.</p>
    </div>

    <div class="card">
      <h2>Reminders on your iPhone 🔔</h2>
      <p class="sub">iPhone limits web-app notifications, so the most reliable nudges come from Apple’s own apps. Two easy options:</p>
      <div class="acc" open><div class="body" style="padding:16px 18px">
        <strong>Calendar (simplest):</strong>
        <ul>
          <li>Open <em>Calendar</em> → new event on her next predicted period date (see the Calendar tab).</li>
          <li>Set it to <em>Repeat: every ${state.cycleLength} days</em>, alert <em>2 days before</em>.</li>
          <li>Rename it “Prep for her 💗 — supplies, snacks, heating pad”.</li>
        </ul>
        <strong>Shortcuts automation (smart):</strong>
        <ul>
          <li>Open <em>Shortcuts</em> → <em>Automation</em> → <em>Time of Day</em>.</li>
          <li>Have it show a reminder / send yourself a message with your care checklist.</li>
        </ul>
      </div></div>
      <button class="btn ghost" id="addToHome">How to add to Home Screen</button>
    </div>

    <div class="card">
      <h2>Your data</h2>
      <p class="sub">Everything is stored only on this device. Nothing is uploaded anywhere.</p>
      <div class="btn-row">
        <button class="btn ghost" id="exportData">Export backup</button>
        <button class="btn ghost" id="importData">Import backup</button>
      </div>
      <button class="btn ghost mt" id="resetData" style="color:var(--rose-deep)">Reset everything</button>
      <input type="file" id="importFile" accept="application/json" hidden/>
    </div>

    <p class="disclaimer">Cycle Care is a personal companion to help you support your partner. It is not medical advice, a diagnostic tool, or a method of contraception. If she has concerns about her health, please see a doctor. Made with 💗</p>
    <p class="tiny center mt">Cycle Care · v1 · works offline</p>
  </div>`;
}

/* ---------------- Shared ---------------- */
function header(title, sub) {
  return `<header class="hd">
    <div class="eyebrow"><span class="heart-beat">💗</span> Cycle Care</div>
    <h1>${esc(title)}</h1>
    <p>${esc(sub)}</p>
  </header>`;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- Wiring ---------------- */
function wire() {
  // navigate buttons
  views.querySelectorAll('[data-go]').forEach((b) =>
    b.onclick = () => go(b.dataset.go));

  // today: check items
  views.querySelectorAll('[data-check]').forEach((el) =>
    el.onclick = () => {
      const id = el.dataset.check;
      const k = iso(today());
      state.checkState[k] = state.checkState[k] || {};
      state.checkState[k][id] = !state.checkState[k][id];
      el.classList.toggle('done', state.checkState[k][id]);
      save();
    });

  // calendar nav
  views.querySelectorAll('[data-cal]').forEach((b) =>
    b.onclick = () => {
      const v = b.dataset.cal;
      if (v === 'today') { calMonth = today().getMonth(); calYear = today().getFullYear(); }
      else {
        calMonth += Number(v);
        if (calMonth < 0) { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0; calYear++; }
      }
      render();
    });

  // calendar day tap -> set start date field
  views.querySelectorAll('[data-day]').forEach((c) =>
    c.onclick = () => {
      const d = c.dataset.day;
      if (parse(d) > today()) { toast('That day hasn’t happened yet 😊'); return; }
      const input = document.getElementById('newStart');
      if (input) { input.value = d; toast(`Selected ${fmt(parse(d))}. Tap “Add start date”.`); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });

  bindEl('addPeriod', 'onclick', () => {
    const v = document.getElementById('newStart').value;
    if (!v) return toast('Pick a date first');
    if (state.history.some((hst) => hst.start === v)) return toast('That start date is already logged');
    state.history.push({ start: v, end: null });
    save(); toast('Period logged 🩸'); render();
  });
  bindEl('endToday', 'onclick', () => {
    const starts = sortedStarts();
    if (!starts.length) return toast('Log a start date first');
    const last = iso(starts[starts.length - 1]);
    const hst = state.history.find((x) => x.start === last);
    hst.end = iso(today());
    save(); toast('Marked ended today'); render();
  });
  views.querySelectorAll('[data-delperiod]').forEach((x) =>
    x.onclick = (e) => {
      e.stopPropagation();
      state.history.splice(Number(x.dataset.delperiod), 1);
      save(); toast('Removed'); render();
    });

  // care tabs
  views.querySelectorAll('[data-caretab]').forEach((b) =>
    b.onclick = () => { careTab = b.dataset.caretab; render(); });

  // prefs add/remove
  views.querySelectorAll('[data-addpref]').forEach((b) =>
    b.onclick = () => {
      const key = b.dataset.addpref;
      const val = prompt(`Add — ${b.dataset.ph}`);
      if (val && val.trim()) {
        state.prefs[key] = state.prefs[key] || [];
        state.prefs[key].push(val.trim());
        save(); render(); toast('Added 💗');
      }
    });
  views.querySelectorAll('[data-delpref]').forEach((x) =>
    x.onclick = () => {
      const [key, i] = x.dataset.delpref.split(':');
      state.prefs[key].splice(Number(i), 1);
      save(); render();
    });
  bindEl('saveNotes', 'onclick', () => {
    state.prefs.loveLanguage = valOf('pref-loveLanguage');
    state.prefs.avoid = valOf('pref-avoid');
    state.prefs.notes = valOf('pref-notes');
    save(); toast('Saved 💗');
  });

  // settings
  bindEl('saveNames', 'onclick', () => {
    state.partnerName = valOf('set-partner');
    state.yourName = valOf('set-you');
    save(); toast('Saved'); render();
  });
  views.querySelectorAll('[data-step]').forEach((b) =>
    b.onclick = () => {
      const [key, delta] = b.dataset.step.split(':');
      const min = key === 'periodLength' ? 2 : 20;
      const max = key === 'periodLength' ? 10 : 40;
      state[key] = Math.max(min, Math.min(max, state[key] + Number(delta)));
      save();
      const el = document.getElementById(key === 'cycleLength' ? 'v-cycle' : 'v-period');
      if (el) el.textContent = state[key];
    });
  bindEl('addToHome', 'onclick', () =>
    toast('In Safari: tap Share ⬆️ → “Add to Home Screen”'));
  bindEl('exportData', 'onclick', exportData);
  bindEl('importData', 'onclick', () => document.getElementById('importFile').click());
  bindEl('importFile', 'onchange', importData);
  bindEl('resetData', 'onclick', () => {
    if (confirm('Reset everything and start over? This cannot be undone.')) {
      localStorage.removeItem(KEY);
      state = load();
      go('today'); toast('Reset');
    }
  });
}
function bindEl(id, ev, fn) { const el = document.getElementById(id); if (el) el[ev] = fn; }
function valOf(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cyclecare-backup-${iso(today())}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('Backup downloaded');
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = { ...structuredClone(DEFAULTS), ...data, prefs: { ...DEFAULTS.prefs, ...(data.prefs || {}) } };
      save(); go('today'); toast('Backup restored 💗');
    } catch (err) { toast('Could not read that file'); }
  };
  reader.readAsText(file);
}

/* ---------------- Router ---------------- */
function go(view) { current = view; render(); }
document.querySelectorAll('.tab').forEach((t) =>
  t.onclick = () => go(t.dataset.view));

render();

/* ---------------- Service worker (offline) ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {}));
}
