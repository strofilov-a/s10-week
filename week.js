/* S10 «Моя неделя»: everything on one page.
   Today and this week · the paces · the master plan (your saved versions, the library, or a new one from a prompt) laid
   over the dates to the race · «Заполнить календарь» for the whole plan · «Запланировать неделю» for one week (calc3).
   On s10.run it reads and writes the logged-in user's data through the site's own API.
   Anywhere else (GitHub Pages, a local file) it runs as a demo on window.S10_FIXTURES and never sends anything. */
(async () => {
  /* ================= data source: live on s10.run, demo elsewhere ================= */
  const LIVE = /(^|\.)s10\.run$/.test(location.hostname) && !window.S10_FORCE_DEMO;
  const FX = window.S10_FIXTURES || null;
  const ORIGIN = location.origin;
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function get(u) {
    if (LIVE) { const r = await fetch(ORIGIN + u, { credentials: 'include' }); if (!r.ok) throw new Error(r.status); return r.json(); }
    if (!FX) throw new Error('нет демо-данных');
    await wait(100);
    if (u.includes('/student/self/info')) return FX.me;
    if (u.includes('task.php?action=main')) return FX.main;
    if (u.includes('studentMainStart')) return FX.startParam;
    if (u.includes('planresults.php')) return FX.results;
    if (u.startsWith('/student?')) return FX.diary;
    if (u.includes('tasktemplates.php')) return FX.templates;
    if (u.includes('param[]=studentPlans')) return { param: { [`studentPlans${FX.me.id}`]: JSON.stringify(FX.versions) } };
    if (u.includes('param[]=planTemplates')) return { param: { planTemplates: JSON.stringify(FX.library) } };
    if (u.includes('calc.php') && u.includes('step=2')) return demoSchedule(new URLSearchParams(u.split('?')[1]));
    if (u.includes('calc.php')) return FX.base;
    throw new Error('нет демо-данных для ' + u);
  }
  async function post(u, fd) {
    if (LIVE) { const r = await fetch(ORIGIN + u, { method: 'POST', body: fd, credentials: 'include' }); const b = await r.json().catch(() => ({})); if (!r.ok || b.error) throw new Error(b.error || r.status); return b; }
    await wait(250);
    if (u.includes('task.php')) {
      for (const t of JSON.parse(fd.get('tasks'))) {
        const list = FX.diary.diaryTasksInfo, old = list.find((x) => x.date === t.d);
        const row = { date: t.d, type: +t.typtrain, comment: t.task, target: +t.prekm, tracks: old?.tracks || [] };
        if (old) Object.assign(old, row); else list.push(row);
      }
    }
    if (u.includes('userparam.php')) { for (const [k, v] of fd.entries()) if (k.startsWith('param[studentPlans')) FX.versions = JSON.parse(v); }
    return { ok: true };
  }
  async function generatePlanText(body, onProgress) {
    if (!LIVE) { const txt = FX.generated; let out = ''; for (const line of txt.split('\n')) { out += line + '\n'; onProgress(out); await wait(60); } return out; }
    const r = await fetch('https://s10.run/t7/plan-templates/public/api/generate.php', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || `ошибка ${r.status}`); }
    if (!r.body) { const t = await r.text(); onProgress(t); return t; }
    const rd = r.body.getReader(), dec = new TextDecoder(); let out = '';
    for (;;) { const { done, value } = await rd.read(); if (done) break; out += dec.decode(value, { stream: true }); onProgress(out); }
    return out + dec.decode();
  }
  function demoSchedule(q) {
    const start = FX.base.dselect[q.get('dselect')]?.date || FX.base.dselect[2].date;
    const w = (n) => q.get('task' + n) ? [+q.get('typtrain' + n), q.get('task' + n), +q.get('prekm' + n)] : [1, '10 км (пульс до 140)', 10];
    const plan = [w(1), [1, '8 км (пульс до 140)', 8], w(2), [1, 'Потрусите медленно в удовольствие без контроля расстояния и темпа', 0], [5, '10 км (пульс до 150)', 10], [0, 'отдых', 0], [1, '8 км (пульс до 140)', 8]];
    const task = {};
    plan.forEach(([t, txt, km], i) => { const d = add(start, i); task[d] = { d, typtrain: t, task: txt, prekm: km }; });
    const prev = FX.diary.diaryTasksInfo.find((x) => x.date === add(start, -1));
    return { task, pretask: prev && prev.date > today ? { [prev.date]: { d: prev.date, typtrain: prev.type, task: prev.comment, prekm: prev.target } } : {}, tasksummary: { 'за последние 7 дней': { km0: 20, km1: 48 } } };
  }

  /* ================= words and dates ================= */
  const TYPES = { 0: 'Тренировка', 1: 'Восстановительная', 2: 'Развивающая', 3: 'Интервальная', 4: 'Повторная', 5: 'Длительная', 6: 'Соревнование' };
  const SHORT = { 1: 'Восст.', 2: 'Разв.', 3: 'Интерв.', 4: 'Повт.', 5: 'Длит.', 6: 'Старт' };
  const LEVEL = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3, 5: 2, 6: 3 };
  const OTHER = { HIKING: 'Поход', CYCLING: 'Велосипед', WALKING: 'Ходьба', SWIMMING: 'Плавание', STRENGTH_TRAINING: 'Силовая' };
  const TYPE_BY_NAME = { 'интервальная': 3, 'развивающая': 2, 'повторная': 4, 'длительная': 5, 'восстановительная': 1, 'соревнование': 6, 'силовая': 1 };
  const DISTANCES = ['Марафон · 42.2 км', 'Полумарафон · 21.1 км', '10 км', '5 км', 'Паркран · 5 км'];
  const DN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const DNF = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  const DNS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const d8 = (s) => new Date(s + 'T12:00:00Z'), iso = (d) => d.toISOString().slice(0, 10);
  const add = (s, n) => { const d = d8(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const dow = (s) => (d8(s).getUTCDay() + 6) % 7;
  const monday = (s) => add(s, -dow(s));
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU');
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  const dayLbl = (s) => { const d = d8(s); return `${d.getUTCDate()} ${MONS[d.getUTCMonth()]}`; };
  const range = (a, b) => d8(a).getUTCMonth() === d8(b).getUTCMonth() ? `${d8(a).getUTCDate()}–${d8(b).getUTCDate()} ${MONS[d8(b).getUTCMonth()]}` : `${dayLbl(a)} – ${dayLbl(b)}`;
  const wLabel = (k) => { const a = d8(k), b = d8(add(k, 6)); return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${b.getUTCDate()} ${MON[b.getUTCMonth()]}` : `${a.getUTCDate()} ${MONS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONS[b.getUTCMonth()]}`; };
  const hms = (t) => String(t || '').replace(/^0(\d):/, '$1:');
  const store = { get(k, d) { try { const v = localStorage.getItem('s10week.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('s10week.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } } };

  /* ================= load ================= */
  const me = await get('/apiweb/student/self/info/');
  const id = new URLSearchParams(location.search).get('id') || me.id;
  const [main, startParam, results, spRes, libRes] = await Promise.all([
    get(`/apiweb/task.php?action=main&id=${id}`).catch(() => ({})),
    get(`/apiweb/userparam.php?action=get&id=${id}&param[]=studentMainStart`).catch(() => ({})),
    get(`/apiweb/planresults.php?action=list&id=${id}&limit=31`).catch(() => []),
    get(`/apiweb/userparam.php?action=get&param[]=studentPlans${id}`).catch(() => ({})),
    get('/apiweb/userparam.php?action=get&param[]=planTemplates').catch(() => ({})),
  ]);
  const parseList = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  let versions = parseList(spRes.param?.[`studentPlans${id}`]).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const library = parseList(libRes.param?.planTemplates).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const race = main.main || null;
  const raceName = (() => { const l = race?.location || ''; return l && l === l.toUpperCase() ? l.charAt(0) + l.slice(1).toLowerCase() : l; })(); // VALENCIA → Valencia, for display only
  const raceMon = race ? monday(race.d) : null;
  const startId = +(startParam.param?.studentMainStart || 0);
  const paceRow = results.find((r) => r.i === startId) || results.find((r) => r.prehms) || results[0] || null;
  const PACE_S10 = paceRow?.t ? Object.fromEntries(Object.entries(paceRow.t).map(([k, v]) => [k, hms(v)])) : null;
  const today = iso(new Date(((me.nowmsk || Date.now() / 1000) + 3 * 3600) * 1000)); // the site counts days in Moscow time
  const days = new Map();
  async function loadUntil(lastDay) {
    const ts = Math.floor(d8(add(lastDay, 1)).getTime() / 1000);
    const res = await get(`/student?user_id=${id}&last_date=${ts}&limit=60`);
    for (const x of res.diaryTasksInfo || []) days.set(x.date, x);
  }
  let wk = monday(today);
  const horizon = () => { const a = add(wk, 13), b = raceMon ? add(raceMon, 6) : a; return a > b ? a : b; };
  await loadUntil(horizon());

  /* ================= the chosen plan and the paces ================= */
  // sel: { src: 'version' | 'library' | 'new', id } ; the newly generated plan lives in memory until it is saved
  let fresh = null;
  let sel = store.get(`plan.${id}`, null);
  const findPlan = (s) => !s ? null : s.src === 'version' ? versions.find((v) => v.id === s.id) : s.src === 'library' ? library.find((v) => v.id === s.id) : s.src === 'new' ? fresh : null;
  if (!findPlan(sel)) sel = versions[0] ? { src: 'version', id: versions[0].id } : library[0] ? { src: 'library', id: library[0].id } : null;
  const plan = () => findPlan(sel);
  const studentPaces = (p) => p?.student?.t42 ? { 5: hms(p.student.t5), 10: hms(p.student.t10), 21: hms(p.student.t21), 42: hms(p.student.t42) } : null;
  let paceSrc = store.get(`paceSrc.${id}`, null);
  let PACE_OWN = store.get(`paceOwn.${id}`, null);
  function activePaces() {
    if (paceSrc === 'own' && PACE_OWN) return PACE_OWN;
    if (paceSrc === 's10' && PACE_S10) return PACE_S10;
    return studentPaces(plan()) || PACE_S10 || PACE_OWN;
  }
  const paceLabel = () => (paceSrc === 'own' && PACE_OWN) ? 'свои' : (paceSrc === 's10' && PACE_S10) ? `прогноз S10${raceName ? ` (${raceName})` : ''}` : studentPaces(plan()) ? `из плана «${plan().name}»` : PACE_S10 ? `прогноз S10${raceName ? ` (${raceName})` : ''}` : 'не заданы';
  let PACE = activePaces();
  let layout = store.get('layout', ['easy', 'easy', 'w1', 'rest', 'w2', 'easy', 'long']); // Mon..Sun
  let volume = null; // start volume, km per week; null = as in the plan
  let maxrecov = 20;

  /* ================= workout text ================= */
  const PRE = /[ТT]\s*(42|21|10|5)(?:\s*([+\-−])\s*(\d+))?/g;
  const toSec = (s) => { const [m, x] = String(s).split(':').map(Number); return m * 60 + x; };
  const fmtSec = (s) => Math.floor(s / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0'); // taste-skill-ignore: a pace, not a counter
  const plain = (t) => (PACE ? String(t).replace(PRE, (m, d, sg, n) => { let s = toSec(PACE[d]); if (sg) s += (sg === '+' ? 1 : -1) * +n; return fmtSec(s); }) : String(t))
    .replace(/(\d)\s*[xх×]\s*(\d)/g, '$1×$2').replace(/(\d)(км|м)(?=[\s,;.]|$)/g, '$1 $2').replace(/\s{2,}/g, ' ').trim();
  const isPaceOnly = (t) => /^\s*\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?\s*$/.test(t || '');
  // display only: diary texts like "4 км разминка 3×2000 м 4:00-4:05 отдых 400 м 2200 м заминка" become
  // Разминка / работа / Заминка lines; the text written to the diary is never changed here
  const DIST = String.raw`\d+(?:[.,]\d+)?\s*(?:км|м)`;
  const PACE_RX = String.raw`\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?`;
  function structure(text) {
    const out = [];
    for (let p of text.split(/;\s*|\s\+\s/).map((x) => x.trim()).filter(Boolean)) {
      let tail = '';
      const w = p.match(new RegExp(`^(${DIST})\\s+разминк\\S*\\s*`, 'i'));
      if (w) { out.push(`Разминка ${w[1]}`); p = p.slice(w[0].length).trim(); }
      const c = p.match(new RegExp(`\\s*(${DIST})\\s+заминк\\S*\\s*$`, 'i'));
      if (c && c.index > 0) { tail = `Заминка ${c[1]}`; p = p.slice(0, c.index).trim(); }
      else if (c && c.index === 0) { out.push(`Заминка ${c[1]}`); p = ''; }
      p = p.replace(new RegExp(`(${DIST})\\s+отдых`, 'gi'), 'отдых $1')
        .replace(new RegExp(`(${DIST})\\s+(${PACE_RX})`, 'g'), '$1 по $2').replace(/\s+,/g, ',')
        .replace(/([^,\s])\s+отдых/g, '$1, отдых').trim();
      if (p) out.push(p);
      if (tail) out.push(tail);
    }
    return out;
  }
  const nb = (h) => h.replace(/(\d) (км|м|мин|с|сек)(?=[\s,;.)]|$)/g, '$1\u00a0$2');
  function taskHTML(t) {
    if (!String(t || '').trim()) return '';
    if (isPaceOnly(t)) return `<p class="w-tx">Темп <span class="w-nw"><b>${esc(t.trim().replace(/\s*-\s*/, '–'))}</b>\u00a0мин/км</span></p>`;
    const parts = structure(plain(t));
    const line = (p) => nb(esc(p.charAt(0).toUpperCase() + p.slice(1))).replace(new RegExp(`(${PACE_RX})`, 'g'), (m) => `<b>${m.replace(/\s*-\s*/, '–')}</b>`);
    return parts.length > 1 ? `<ul class="w-tx">${parts.map((p) => `<li>${line(p)}</li>`).join('')}</ul>` : `<p class="w-tx">${line(parts[0])}</p>`;
  }
  const isRun = (x) => x && (+x.target > 0 || !!(x.comment || '').trim() && !/^отдых\.?$/i.test((x.comment || '').trim()));
  const runKm = (x) => (x?.tracks || []).filter((t) => t.type === 'run').reduce((a, t) => a + (+t.km || 0), 0);
  const others = (x) => (x?.tracks || []).filter((t) => t.type !== 'run').map((t) => `${OTHER[t.json?.subtype] || 'Активность'} ${n1(+t.km || 0)} км`);
  const glyph = (l, isRace) => `<span class="w-ig" data-l="${l}" ${isRace ? 'data-race' : ''} aria-hidden="true"><i></i><i></i><i></i></span>`;
  function week(k) {
    const list = [...Array(7)].map((_, i) => { const d = add(k, i); return { d, i, x: days.get(d) || null }; });
    return {
      list,
      plan: list.reduce((a, r) => a + (+r.x?.target || 0), 0),
      done: list.reduce((a, r) => a + runKm(r.x), 0),
      left: list.filter((r) => r.d >= today && isRun(r.x) && !(r.d === today && runKm(r.x) > 0)).length,
      long: list.filter((r) => r.x?.type === 5).sort((a, b) => b.x.target - a.x.target)[0] || null,
    };
  }

  /* ================= the plan laid over the dates ================= */
  // week −1 is the race week; week −n starts n−1 weeks before it
  const weekMon = (w) => add(raceMon, (w + 1) * 7);
  const firstKm = (p) => p?.plan?.weeks?.slice().sort((a, b) => a.week - b.week)[0]?.km || 0;
  const scaleK = (p) => { const f = firstKm(p); return volume && f ? volume / f : 1; };
  const easyText = () => (PACE ? `${fmtSec(toSec(PACE[42]) + 55)}-${fmtSec(toSec(PACE[42]) + 75)}` : 'Лёгкий бег');
  function layWeek(w, p) {
    const mon = weekMon(w.week), k = scaleK(p);
    const target = Math.round(w.km * k);
    const slots = w.slots.map((s) => ({ t: TYPE_BY_NAME[s.type] || 0, desc: s.desc, km: +s.km }));
    const raceSlot = slots.find((s) => s.t === 6);
    const roles = layout.slice();
    let raceDow = -1;
    if (raceSlot && race && monday(race.d) === mon) {
      // race week: nothing after the race, rest the day before, the two works on the earliest free days before that
      raceDow = dow(race.d);
      for (let i = 0; i < 7; i++) {
        if (i > raceDow) roles[i] = 'rest';
        else if (i === raceDow) roles[i] = 'race';
        else if (i === raceDow - 1) roles[i] = 'rest';
        else if (roles[i] === 'w1' || roles[i] === 'w2' || roles[i] === 'long') roles[i] = 'easy';
      }
      const free = [1, 2, 0, 3, 4].filter((i) => i < raceDow - 1);
      if (free[0] != null && slots[0] && slots[0] !== raceSlot) roles[free[0]] = 'w1';
      if (free[1] != null && slots[1] && slots[1] !== raceSlot) roles[free[1]] = 'w2';
    }
    const out = [];
    const work = { w1: slots[0], w2: slots[1], long: slots.find((s) => s.t === 5) || slots[2], race: raceSlot };
    const used = roles.map((r) => (work[r] ? work[r].km : 0)).reduce((a, b) => a + b, 0);
    const easyDays = roles.filter((r) => r === 'easy').length;
    const rest = Math.max(0, target - used);
    const easyKm = easyDays ? Math.min(maxrecov, Math.max(rest ? 6 : 0, Math.round(rest / easyDays))) : 0;
    roles.forEach((r, i) => {
      const d = add(mon, i), s = work[r];
      if (s) out.push({ d, typtrain: s.t, task: plain(s.desc), prekm: s.km, location: s.t === 6 ? (race?.location || '') : '', prediction: s.t === 6 ? hms(race?.prediction || '') : '' });
      else if (r === 'easy' && easyKm) out.push({ d, typtrain: 1, task: easyText(), prekm: easyKm, location: '', prediction: '' });
      else out.push({ d, typtrain: 0, task: 'отдых', prekm: 0, location: '', prediction: '' });
    });
    return { mon, target, total: out.reduce((a, t) => a + t.prekm, 0), days: out };
  }
  let keepExisting = true;
  function fillPreview() {
    const p = plan(); if (!p || !race) return null;
    const weeks = p.plan.weeks.slice().sort((a, b) => a.week - b.week).map((w) => layWeek(w, p));
    const all = weeks.flatMap((w) => w.days).filter((t) => t.d > today);
    const keep = keepExisting ? all.filter((t) => isRun(days.get(t.d))) : [];
    const write = all.filter((t) => !keep.includes(t));
    return { weeks, write, keep };
  }

  /* ================= colours: 20 palettes from the taste-skill library ================= */
  const PALETTES = [{"id": "s10", "name": "S10 как сейчас", "rec": false, "bg": "#f4f5f7", "surface": "#ffffff", "ink": "#14161a", "muted": "#565b66", "accent": "#2449c6", "accentInk": "#ffffff", "dark": false, "key": "#2f5d50", "keyInk": "#ffffff"}, {"id": "cool-white-slate", "name": "Иней и сланец", "rec": true, "bg": "#f7f9fa", "surface": "#ecf0f2", "ink": "#1f3038", "muted": "#5d6b72", "accent": "#0d7480", "accentInk": "#ffffff", "dark": false, "key": "#b84a32", "keyInk": "#ffffff"}, {"id": "white-link-blue", "name": "Лист, синяя и красная ручка", "rec": true, "bg": "#ffffff", "surface": "#f4f4f4", "ink": "#111111", "muted": "#6b6b6b", "accent": "#1a4be0", "accentInk": "#ffffff", "dark": false, "key": "#d62b1f", "keyInk": "#ffffff"}, {"id": "graphite-safety-orange", "name": "Графит, оранжевый, лёд", "rec": true, "bg": "#18191b", "surface": "#222427", "ink": "#eff0f1", "muted": "#9c9ea3", "accent": "#ff4a1f", "accentInk": "#18191b", "dark": true, "key": "#4cc3d9", "keyInk": "#111111"}, {"id": "cool-grey-cobalt", "name": "Серый, кобальт, киноварь", "rec": false, "bg": "#eef0f3", "surface": "#e2e5ea", "ink": "#0b0c0e", "muted": "#5d6470", "accent": "#1f2de6", "accentInk": "#ffffff", "dark": false, "key": "#c43a0a", "keyInk": "#ffffff"}, {"id": "blue-red-black", "name": "Белый, ультрасиний, жёлтый", "rec": false, "bg": "#ffffff", "surface": "#f3f3f3", "ink": "#0a0a0a", "muted": "#6b6b6b", "accent": "#2436ff", "accentInk": "#ffffff", "dark": false, "key": "#f2c200", "keyInk": "#111111", "keyData": "#2436ff"}, {"id": "stone-blueprint", "name": "Камень, чертёж, красный маркер", "rec": false, "bg": "#dfdedb", "surface": "#d3d2ce", "ink": "#26251e", "muted": "#5f5d55", "accent": "#2456d6", "accentInk": "#ffffff", "dark": false, "key": "#c8341f", "keyInk": "#ffffff"}, {"id": "mint-pink-accounts", "name": "Белый, бутылочный, розовый", "rec": false, "bg": "#f8f8f8", "surface": "#eeeeee", "ink": "#0a0a0a", "muted": "#6a6a6a", "accent": "#1f6b3a", "accentInk": "#ffffff", "dark": false, "key": "#d6336c", "keyInk": "#ffffff"}, {"id": "teal-on-paper", "name": "Бирюза и коралл на бумаге", "rec": false, "bg": "#f7f9f8", "surface": "#ebf0ee", "ink": "#06525c", "muted": "#2f737d", "accent": "#06525c", "accentInk": "#f7f9f8", "dark": false, "key": "#c2410c", "keyInk": "#ffffff"}, {"id": "three-stones", "name": "Три камня и глина", "rec": false, "bg": "#eeecea", "surface": "#e4e1dd", "ink": "#333231", "muted": "#6b6763", "accent": "#5c6b54", "accentInk": "#ffffff", "dark": false, "key": "#8a5a44", "keyInk": "#ffffff"}, {"id": "olive-on-bone", "name": "Олива и кирпич на кости", "rec": false, "bg": "#ecebe7", "surface": "#e1dfd9", "ink": "#38450f", "muted": "#5d683a", "accent": "#38450f", "accentInk": "#ecebe7", "dark": false, "key": "#b5452b", "keyInk": "#ffffff"}, {"id": "moss-sand", "name": "Песок, мох, сумерки", "rec": false, "bg": "#ddd6c6", "surface": "#d2cab8", "ink": "#2a2a26", "muted": "#59574e", "accent": "#4f6238", "accentInk": "#ffffff", "dark": false, "key": "#2f4a6d", "keyInk": "#ffffff"}, {"id": "green-mat-chocolate", "name": "Кость, зелень, шоколад", "rec": false, "bg": "#e5e1d8", "surface": "#dad5ca", "ink": "#2a1d17", "muted": "#6b5b51", "accent": "#456f3a", "accentInk": "#ffffff", "dark": false, "key": "#5a3a2a", "keyInk": "#ffffff"}, {"id": "card-pastels", "name": "Светлый, малиновый, бирюза", "rec": false, "bg": "#f7f7f5", "surface": "#ebebe8", "ink": "#000000", "muted": "#666662", "accent": "#d0106f", "accentInk": "#ffffff", "dark": false, "key": "#0f7b6c", "keyInk": "#ffffff"}, {"id": "cobalt-on-sand", "name": "Кобальт и терракота на песке", "rec": false, "bg": "#e6dbc7", "surface": "#ddd0b9", "ink": "#062b8a", "muted": "#3a5aa8", "accent": "#062b8a", "accentInk": "#e6dbc7", "dark": false, "key": "#a8321e", "keyInk": "#ffffff"}, {"id": "oxblood-grey", "name": "Бордо, серый, петроль", "rec": false, "bg": "#e2e2e2", "surface": "#d6d6d6", "ink": "#7d0c14", "muted": "#7a4a4e", "accent": "#7d0c14", "accentInk": "#e2e2e2", "dark": false, "key": "#2b4c5e", "keyInk": "#ffffff"}, {"id": "blue-black-cornflower", "name": "Ночь, васильковый, янтарь", "rec": false, "bg": "#0a0d14", "surface": "#131824", "ink": "#e9edf3", "muted": "#8891a1", "accent": "#5a9bfc", "accentInk": "#0a0d14", "dark": true, "key": "#f5b942", "keyInk": "#111111"}, {"id": "green-black-bone", "name": "Тёмно-зелёный, кость, персик", "rec": false, "bg": "#161c1a", "surface": "#1f2725", "ink": "#e3e2da", "muted": "#8e948d", "accent": "#9fc7b8", "accentInk": "#161c1a", "dark": true, "key": "#e8a87c", "keyInk": "#111111"}, {"id": "charcoal-room-sage", "name": "Уголь, шалфей, охра", "rec": false, "bg": "#1c1c1c", "surface": "#262626", "ink": "#f1f1ef", "muted": "#9a9b96", "accent": "#8fa68e", "accentInk": "#1c1c1c", "dark": true, "key": "#d9a96a", "keyInk": "#111111"}, {"id": "warm-black-gold", "name": "Чёрный, золото, терракота", "rec": false, "bg": "#0c0a08", "surface": "#181512", "ink": "#ffffff", "muted": "#8f8a84", "accent": "#c9a45a", "accentInk": "#0c0a08", "dark": true, "key": "#d9765f", "keyInk": "#111111"}];
  // palette chosen 31.10.2026: №3 «Лист, синяя и красная ручка». ?colors brings the picker back.
  const DEFAULT_PAL = 'white-link-blue';
  const SHOW_COLORS = new URLSearchParams(location.search).has('colors');
  let palId = SHOW_COLORS ? store.get('palette', DEFAULT_PAL) : DEFAULT_PAL, colorsOpen = false;
  function applyPalette() {
    const P = PALETTES.find((x) => x.id === palId) || PALETTES.find((x) => x.id === DEFAULT_PAL);
    const mix = (a, pct, b) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
    const ground = P.bg, panel = P.surface.toLowerCase() === P.bg.toLowerCase() ? mix(P.ink, 4, P.bg) : P.surface;
    const primary = P.dark ? P.ink : (P.id === 'white-link-blue' ? '#111111' : P.ink);
    const v = {
      '--ground': ground, '--panel': panel, '--raised': P.dark ? mix(P.ink, 10, panel) : '#ffffff',
      '--rule': mix(P.ink, 11, ground), '--rule-p': mix(P.ink, 11, panel), '--control': mix(P.ink, 22, ground),
      '--text': P.ink, '--muted': P.muted, '--faint': P.muted, '--pen': P.accent, '--pen-soft': mix(P.accent, P.dark ? 16 : 6, ground), '--key': P.keyData || P.key,
      '--primary': primary, '--primary-ink': P.dark ? P.bg : '#ffffff', '--primary-hover': mix(primary, 84, ground),
      '--chip': mix(P.ink, 8, ground), '--chip-hover': mix(P.ink, 13, ground), '--field': P.dark ? mix(P.ink, 6, panel) : '#ffffff',
      '--bar': mix(P.ink, 22, panel), '--bar-past': mix(P.ink, 11, panel), '--bad': P.dark ? '#ff9aa9' : '#b42318',
      '--warn-bg': P.dark ? mix('#d9a441', 16, ground) : '#fffbeb', '--warn-line': P.dark ? mix('#d9a441', 40, ground) : '#fde68a', '--warn-ink': P.dark ? '#f0c36a' : '#92400e',
    };
    for (const [k, val] of Object.entries(v)) root.style.setProperty(k, val);
    root.style.colorScheme = P.dark ? 'dark' : 'light';
    document.documentElement.style.background = ground;
  }
  function colorsPanel() {
    const cur = PALETTES.find((x) => x.id === palId) || PALETTES[0];
    return `<section class="w-card w-colors" aria-labelledby="w-col-h">
      <div class="w-ch"><h2 id="w-col-h">Цвета страницы</h2><span class="w-muted">Сейчас: ${esc(cur.name)}. В каждой палитре три цвета: фон, акцент (вкладки, сегодня, ссылки) и третий цвет (главные кнопки и полоски нагрузки). «Совет» отмечает мои фавориты.</span><button class="w-btn sm" data-act="colors">Готово</button></div>
      <ul class="w-pals">${PALETTES.map((x, i) => `<li><button class="w-pal ${x.id === palId ? 'on' : ''}" data-act="pal" data-id="${x.id}" aria-pressed="${x.id === palId}">
        <span class="w-pal-prev" style="background:${x.bg}" aria-hidden="true"><i style="background:${x.dark ? x.surface : '#ffffff'}"><b style="background:${x.ink}"></b><b style="background:${x.muted};width:60%"></b><em style="background:${x.accent}"></em><em class="k" style="background:${x.key}"></em></i></span>
        <span class="w-pal-n"><span class="num">${i + 1}.</span> ${esc(x.name)}</span>${x.rec ? '<span class="w-pill now w-rec">совет</span>' : ''}<small>${x.dark ? 'тёмная' : 'светлая'}${x.id === 's10' ? ', фирменная' : ''}</small></button></li>`).join('')}</ul>
    </section>`;
  }

  /* ================= state of the panels ================= */
  let mode = 'view', PL = null, flash = '', shownFlash = '';
  let tab = store.get('tab', 'week');
  let chooser = !plan(), chooserTab = versions.length ? 'version' : library.length ? 'library' : 'new';
  let gen = { distance: plan()?.distance || DISTANCES[0], weeks: raceMon ? Math.max(1, Math.round((d8(raceMon) - d8(monday(add(today, 1)))) / 6048e5) + 1) : 8, prompt: '', busy: false, lines: 0, err: '' };
  let fill = { confirm: false, busy: false, err: '' };
  let openWeek = null;
  const persistSel = () => { store.set(`plan.${id}`, sel && sel.src !== 'new' ? sel : null); };
  const reprice = () => { PACE = activePaces(); };

  // plan text from the generator: "## -5 | ПАНО | 80" then "-5, интервальная, описание, 14 км" (calc4's format)
  function parsePlanText(text) {
    const weeks = [], errors = []; let cur = null;
    text.split('\n').forEach((raw, n) => {
      const s = raw.trim(); if (!s || /^ПРЕДУПРЕЖДЕНИЕ/i.test(s)) return;
      if (s.startsWith('##')) { const u = s.slice(2).split('|').map((x) => x.trim()); const w = parseInt(u[0], 10), km = parseFloat((u[2] || '').replace(',', '.')); if (u.length < 3 || isNaN(w) || w >= 0 || isNaN(km)) { errors.push(n + 1); return; } cur = { week: w, period: u[1], km, slots: [] }; weeks.push(cur); return; }
      const a = s.indexOf(','), b = s.indexOf(',', a + 1), c = s.lastIndexOf(',');
      if (a < 0 || b < 0 || c <= b || !cur) { errors.push(n + 1); return; }
      const type = s.slice(a + 1, b).trim().toLowerCase(), desc = s.slice(b + 1, c).trim(), km = parseFloat(s.slice(c + 1).replace(',', '.'));
      if (!TYPE_BY_NAME[type] || isNaN(km) || cur.slots.length >= 3) { errors.push(n + 1); return; }
      cur.slots.push({ type, desc, km });
    });
    return { weeks: weeks.sort((x, y) => x.week - y.week), errors };
  }

  /* ================= weekly planner (calc3) ================= */
  const parseTpl = (s) => { const m = String(s).match(/^(.*?)\s*\[\s*(\d+)\s*,\s*(\d+)\s*,?\s*\]\s*(.*)$/); return m ? { txt: m[1].replace(/\s+,/g, ',').replace(/\s+\./g, '.').trim(), km: +m[2], t: +m[3], name: m[4] } : null; };
  const weekNo = (start) => raceMon && start ? -(Math.round((d8(raceMon) - d8(monday(start))) / 6048e5) + 1) : null;
  const windowStart = () => PL.dsels.find((x) => x.k === PL.dsel)?.date;
  const planWeek = (n) => plan()?.plan?.weeks?.find((x) => x.week === n) || null;
  function workOptions() {
    const out = [], n = weekNo(windowStart()), pw = planWeek(n);
    if (pw) pw.slots.forEach((sl) => { const t = TYPE_BY_NAME[sl.type]; if (t && ![1, 5, 6].includes(t)) out.push({ group: `План «${plan().name}», неделя ${n}`, name: `${TYPES[t]}, ${sl.km} км`, t, km: +sl.km, txt: plain(sl.desc) }); });
    (PL.tt || []).forEach((g) => (g.items || []).forEach((it) => { const m = parseTpl(it); if (m && ![1, 5, 6].includes(m.t)) out.push({ group: `Шаблоны: ${g.name}`, name: `${m.name || plain(m.txt.split(/ через|,|\./)[0])}, ${m.km} км`, t: m.t, km: m.km, txt: plain(m.txt) }); }));
    return out;
  }
  function pickWorks() {
    PL.opts = workOptions();
    PL.works = [0, 1].map((k) => (PL.opts[k] ? { ...PL.opts[k] } : { t: k ? 2 : 3, km: 0, txt: '' }));
    PL.works.forEach((w) => { w.edit = false; });
  }
  async function openPlanner() {
    mode = 'plan'; PL = { loading: true }; render(); root.querySelector('#w-plan-h')?.scrollIntoView({ block: 'start' });
    try {
      const [base, tt] = await Promise.all([get(`/apiweb/calc.php?id=${id}`), get('/apiweb/tasktemplates.php').catch(() => [])]);
      const dsels = Object.entries(base.dselect || {}).map(([k, v]) => ({ k: String(k), date: v.date }));
      PL = { base, tt, dsels, dsel: String(base.dselected || dsels.at(-1)?.k || 1), rows: null, pre: [], sum: null, busy: false, err: '' };
      maxrecov = +base.param?.maxrecov?.v || maxrecov;
      pickWorks();
    } catch (e) { PL = { err: `Не удалось загрузить ограничения и шаблоны (${e.message}). Обновите страницу.` }; }
    render();
  }
  async function generateWeek() {
    PL.busy = true; PL.err = ''; render();
    const b = PL.base, q = new URLSearchParams({ id, dselect: PL.dsel, step: 2 });
    for (const [k, v] of Object.entries(b.param || {})) q.set(k, v.v);
    if (b.phase) { q.set('phaset', b.phase.t); if (b.phase.d) { const d = d8(b.phase.d); q.set('phased', `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`); } }
    PL.works.forEach((w, i) => { if (w.txt.trim()) { q.set('typtrain' + (i + 1), w.t); q.set('task' + (i + 1), w.txt.trim()); q.set('prekm' + (i + 1), w.km || 0); } });
    try {
      const c = await get('/apiweb/calc.php?' + q.toString());
      const pw = planWeek(weekNo(windowStart()));
      PL.pre = Object.values(c.pretask || {});
      PL.rows = Object.values(c.task || {}).sort((a, z) => a.d.localeCompare(z.d)).map((x) => {
        const r = { d: x.d, typtrain: +x.typtrain, task: x.task || '', prekm: +x.prekm || 0, location: x.location || '', prediction: x.prediction || '', src: 'gen', edit: false };
        r.gen = { typtrain: r.typtrain, task: r.task, prekm: r.prekm };
        const sl = r.typtrain === 5 && pw ? pw.slots.find((z) => TYPE_BY_NAME[z.type] === 5) : null;
        if (sl) r.alt = { typtrain: 5, task: plain(sl.desc), prekm: +sl.km };
        return r;
      });
      PL.sum = c.tasksummary || null; PL.stale = false;
      if (!PL.rows.length) PL.err = 'Сервер не вернул ни одного дня. Попробуйте другой день начала.';
    } catch (e) { PL.err = `Расписание не рассчиталось (${e.message}). Попробуйте ещё раз.`; }
    PL.busy = false; render();
  }
  const planTotal = () => PL.rows.reduce((a, r) => a + (+r.prekm || 0) + (r.task.trim().startsWith('Потрусите медленно') && !+r.prekm ? 8 : 0), 0);
  async function writeTasks(list) {
    const fd = new FormData();
    fd.append('tasks', JSON.stringify(list.map((r) => ({ d: r.d, task: r.task, prekm: String(r.prekm), typtrain: r.typtrain, main6: 0, location: r.location || null, prediction: r.prediction || null }))));
    await post(`/apiweb/task.php?id=${id}&action=update`, fd);
  }
  async function saveWeek() {
    const bad = PL.rows.filter((r) => r.typtrain === 6 && !(r.location.trim() && r.prediction.trim()));
    if (bad.length) { PL.err = `Для соревнования укажите место и прогноз: ${bad.map((r) => dayLbl(r.d)).join(', ')}.`; bad.forEach((r) => { r.edit = true; }); return render(); }
    if (!me.isPremium) { PL.err = 'Ставить задачи можно с премиум-подпиской S10.'; return render(); }
    PL.busy = true; PL.err = ''; render();
    try {
      await writeTasks(PL.rows);
      const first = PL.rows[0].d, last = PL.rows.at(-1).d, n = PL.rows.length;
      await loadUntil(horizon());
      mode = 'view'; wk = monday(first); PL = null;
      flash = `${LIVE ? 'Задачи поставлены' : 'Демо: задачи поставлены только на этой странице'}: ${n} ${plural(n, 'день', 'дня', 'дней')}, ${range(first, last)}.`;
    } catch (e) { PL.busy = false; PL.err = `Сервер не принял задачи (${e.message}). В дневнике ничего не изменилось.`; }
    render();
  }

  /* ================= whole plan: fill, save version, generate ================= */
  async function fillCalendar() {
    const f = fillPreview(); if (!f || !f.write.length) return;
    if (!me.isPremium) { fill.err = 'Ставить задачи можно с премиум-подпиской S10.'; return render(); }
    fill.busy = true; fill.err = ''; render();
    try {
      await writeTasks(f.write);
      await loadUntil(horizon());
      fill = { confirm: false, busy: false, err: '' };
      const a = f.write[0].d, b = f.write.at(-1).d;
      flash = `${LIVE ? 'Календарь заполнен' : 'Демо: календарь заполнен только на этой странице'}: ${f.write.length} ${plural(f.write.length, 'день', 'дня', 'дней')}, ${range(a, b)}.`;
      wk = monday(a);
    } catch (e) { fill.busy = false; fill.err = `Сервер не принял задачи (${e.message}). В дневнике ничего не изменилось.`; }
    render();
  }
  async function saveVersion() {
    const p = plan(); if (!p) return;
    const weeksN = p.plan.weeks.length, first = p.plan.weeks.slice().sort((a, b) => a.week - b.week)[0];
    const v = {
      id: Math.random().toString(36).slice(2, 16), name: `${(p.name || 'План').replace(/ · \d+ нед\.$/, '')} · ${weeksN} нед.`, savedAt: new Date().toISOString(),
      templateId: sel.src === 'library' ? p.id : p.templateId || null, distance: p.distance || null, plan: { weeks: p.plan.weeks },
      student: { raceDate: race?.d || null, planStart: weekMon(first.week), t5: PACE?.[5], t10: PACE?.[10], t21: PACE?.[21], t42: PACE?.[42], volume: String(volume || firstKm(p)) },
    };
    const list = [v, ...versions];
    const fd = new FormData(); fd.append('action', 'set'); fd.append('id', id); fd.append(`param[studentPlans${id}]`, JSON.stringify(list));
    try { await post('/apiweb/userparam.php', fd); versions = list; sel = { src: 'version', id: v.id }; persistSel(); flash = `Версия «${v.name}» сохранена. Её видно и на странице «План ученика».`; }
    catch (e) { flash = `Версию не удалось сохранить (${e.message}).`; }
    render();
  }
  async function runGenerate() {
    if (!gen.prompt.trim()) { gen.err = 'Опишите бегуна и цель: результаты, объём, сколько тренировок в неделю, какие дни.'; return render(); }
    gen.busy = true; gen.err = ''; gen.lines = 0; render();
    try {
      const text = await generatePlanText({ distance: gen.distance, weeks: gen.weeks, prompt: gen.prompt.trim() }, (t) => { const n = t.split('\n').length; if (n !== gen.lines) { gen.lines = n; const s = root.querySelector('#w-gen-status'); if (s) s.textContent = `Модель пишет план… ${n} ${plural(n, 'строка', 'строки', 'строк')}`; } });
      const parsed = parsePlanText(text);
      if (!parsed.weeks.length) throw new Error('в ответе нет ни одной недели');
      fresh = { id: 'new', name: `Новый план, ${gen.distance.split(' · ')[0].toLowerCase()}`, distance: gen.distance, savedAt: new Date().toISOString(), plan: { weeks: parsed.weeks } };
      sel = { src: 'new', id: 'new' }; chooser = false; volume = null; reprice();
      flash = `План готов: ${parsed.weeks.length} ${plural(parsed.weeks.length, 'неделя', 'недели', 'недель')}${parsed.errors.length ? `, строк с ошибками: ${parsed.errors.length}` : ''}. Проверьте его ниже и сохраните версию, чтобы он остался.`;
    } catch (e) { gen.err = `План не получился: ${e.message}.`; }
    gen.busy = false; render();
  }

  /* ================= markup =================
     Direction (taste-skill, app screen, style «editorial greeting», brand palette №3 kept):
     the page is a training diary. The sheet is white and printed in ink; what the athlete ran is written in the blue pen;
     the coach's red pen marks only the key sessions (intervals, repeats, the race). Grey panels carry the structure, no borders,
     figures at regular weight. Grid: a centred 1100px column, 12 columns of 77px with 16px gutters (12·77 + 11·16 = 1100). */
  const NB = ' ';
  const KEY = (t) => t === 3 || t === 4 || t === 6;
  const typeLabel = (t, tag = 'span', run = !!+t) => `<${tag} class="w-type${run && KEY(+t) ? ' key' : ''}${run ? '' : ' rest'}">${run ? TYPES[+t] || 'Тренировка' : 'Отдых'}</${tag}>`;
  const dash = '<span class="w-dash">—</span>';
  const typeSelect = (v, attrs) => `<select ${attrs}>${[1, 2, 3, 4, 5, 6, 0].map((t) => `<option value="${t}" ${+v === t ? 'selected' : ''}>${t ? TYPES[t] : 'Отдых'}</option>`).join('')}</select>`;
  const kmField = (v, attrs) => `<label class="w-kmf"><input ${attrs} class="num" inputmode="decimal" value="${v || 0}"> км</label>`;
  const ROLE = { easy: 'Лёгкая', rest: 'Отдых', w1: 'Работа 1', w2: 'Работа 2', long: 'Длительная' };
  const btn = (act, label, kind = '', extra = '') => `<button class="w-btn ${kind}" data-act="${act}" ${extra}>${label}</button>`;
  // one line of a workout, for the greeting: «Разминка 3 км · 3×2000 м по 4:02, отдых 400 м · Заминка 3 км»
  function taskLine(t) {
    if (!String(t || '').trim()) return '';
    if (isPaceOnly(t)) return `Темп <b>${esc(t.trim().replace(/\s*-\s*/, '–'))}</b>${NB}мин/км`;
    return structure(plain(t)).map((p) => nb(esc(p.charAt(0).toUpperCase() + p.slice(1))).replace(new RegExp(`(${PACE_RX})`, 'g'), (m) => `<b>${m.replace(/\s*-\s*/, '–')}</b>`)).join(' · ');
  }
  const planWeekOf = (k) => { const n = weekNo(k); const pw = planWeek(n); return n != null && n < 0 ? { n, period: pw?.period || '' } : null; };
  const weekTag = (k) => { const w = planWeekOf(k); return w ? `неделя плана ${String(w.n).replace('-', '−')}${w.period ? `, ${esc(w.period)}` : ''}` : ''; };

  /* ---- what was actually run ---- */
  const tSec = (t) => String(t || '').split(':').reduce((a, v) => a * 60 + (+v || 0), 0);
  function runFact(x) {
    const tr = (x?.tracks || []).filter((t) => t.type === 'run' && +t.km > 0);
    // the track's own pace (moving pace, as S10 shows it), averaged by distance; elapsed time only as a fallback
    const km = tr.reduce((a, t) => a + +t.km, 0);
    const sec = tr.reduce((a, t) => a + (t.pace ? tSec(t.pace) * +t.km : tSec(t.time)), 0);
    return km ? { km, pace: sec ? sec / km : null } : null;
  }
  function paceVerdict(task, pace) {
    if (!pace || !isPaceOnly(task)) return '';
    const [lo, hi = lo] = task.trim().split(/\s*[-–]\s*/).map(toSec);
    return pace < lo - 5 ? 'быстрее задания' : pace > hi + 5 ? 'медленнее задания' : 'в задании';
  }
  function factCell(r) {
    const x = r.x, run = isRun(x), f = runFact(x);
    if (f) {
      const v = run ? paceVerdict(x.comment, f.pace) : 'вне плана';
      return `<b class="w-pen num">${n1(f.km)}${NB}км</b>${f.pace ? `<span class="num">${fmtSec(f.pace)}${NB}мин/км</span>` : ''}${v ? `<span>${v}</span>` : ''}`;
    }
    if (!run) return '';
    if (r.d === today) return '<span class="w-pen">сегодня</span>';
    return r.d < today ? '<span class="w-miss">пропущено</span>' : '';
  }

  /* ---- week ---- */
  function weekRel() {
    const n = Math.round((d8(wk) - d8(monday(today))) / 6048e5);
    if (!n) return 'Эта неделя';
    if (n === -1) return 'Прошлая неделя';
    if (n === 1) return 'Следующая неделя';
    const k = Math.abs(n), w = `${k} ${plural(k, 'неделя', 'недели', 'недель')}`;
    return n < 0 ? `${w} назад` : `Через ${w}`;
  }
  function weekNav() {
    const cur = wk === monday(today);
    return `<div class="w-navs"><div class="w-nav" role="group" aria-label="Выбор недели">
        <button data-w="-1" aria-label="Предыдущая неделя">‹</button><span>${weekRel()}</span><button data-w="1" aria-label="Следующая неделя">›</button>
      </div><button class="w-btn w-tonow" data-act="today" ${cur ? 'aria-hidden="true" tabindex="-1" disabled' : ''}>К этой неделе</button></div>`;
  }
  function weekHead(W) {
    const cur = wk === monday(today), r = cur ? W.list.find((q) => q.d === today) : null, tag = weekTag(wk);
    if (!r) return `<div class="w-head"><div class="w-hgroup"><h1>Неделя ${wLabel(wk)}</h1><p class="w-meta">${weekRel()}${tag ? ` · ${tag}` : ''}</p></div>${weekNav()}</div>`;
    const x = r.x, run = isRun(x), f = runFact(x), d = d8(today);
    const title = run ? `Сегодня ${(TYPES[x.type] || 'тренировка').toLowerCase()}, ${n1(+x.target)}${NB}км` : 'Сегодня отдых';
    const sub = run ? taskLine(x.comment) : 'Тренировки сегодня нет.';
    return `<div class="w-head"><div class="w-hgroup">
        <h1>${title}</h1>
        ${sub ? `<p class="w-sub">${sub}</p>` : ''}
        ${f ? `<p class="w-sub w-pen">Сделано: ${n1(f.km)}${NB}км${f.pace ? ` · ${fmtSec(f.pace)}${NB}мин/км` : ''}</p>` : ''}
        <p class="w-meta">${DNF[r.i].charAt(0).toUpperCase() + DNF[r.i].slice(1)}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}${tag ? ` · ${tag}` : ''}</p>
      </div>${weekNav()}</div>`;
  }
  function weekTiles(W) {
    const n = race ? Math.round((d8(race.d) - d8(today)) / 864e5) : null;
    const f = W.plan ? Math.min(100, (W.done / W.plan) * 100) : 0;
    return `<section class="w-tiles" aria-label="Итоги недели">
      <div class="w-tile"><span class="w-lb">Объём недели</span><span class="w-v num">${n1(W.done)}<small>из ${n1(W.plan)}${NB}км</small></span>
        ${W.plan ? `<span class="w-scale" role="img" aria-label="${n1(W.done)} из ${n1(W.plan)} километров"><i style="width:${f}%"></i></span>` : '<span class="w-cap">ничего не запланировано</span>'}</div>
      <div class="w-tile"><span class="w-lb">Длительная</span><span class="w-v num">${W.long ? `${n1(+W.long.x.target)}<small>км</small>` : dash}</span><span class="w-cap">${W.long ? `${DNF[W.long.i]}, ${dayLbl(W.long.d)}` : 'на этой неделе нет'}</span></div>
      <div class="w-tile"><span class="w-lb">До старта</span><span class="w-v num">${n != null ? `${n}<small>${plural(n, 'день', 'дня', 'дней')}</small>` : dash}</span><span class="w-cap">${race ? `${raceName ? `${esc(raceName)}, ` : ''}${dayLbl(race.d)}` : 'старт не выбран'}</span></div>
    </section>`;
  }
  function weekLog(W) {
    if (mode === 'plan') return plannerHTML();
    const rows = W.list.map((r) => {
      const x = r.x, run = isRun(x), o = others(x);
      return `<tr class="${r.d === today ? 'today' : ''}${run ? '' : ' rest'}">
        <th scope="row" class="w-d"><b>${DN[r.i]}</b><span class="num">${dayLbl(r.d)}</span></th>
        <td class="w-t">${typeLabel(x?.type || 0, 'span', run)}${run ? taskHTML(x.comment) : ''}${o.length ? `<span class="w-oth">${o.map(esc).join(' · ')}</span>` : ''}</td>
        <td class="w-n num">${run ? `${n1(+x.target)}${NB}км` : ''}</td>
        <td class="w-fc">${factCell(r)}</td>
      </tr>`;
    }).join('');
    return `<section class="w-sec" aria-labelledby="w-log-h">
      <div class="w-sech"><h2 id="w-log-h">Дневник недели</h2><span class="w-meta num">${range(wk, add(wk, 6))}</span>${btn('plan', 'Запланировать неделю', 'quiet')}</div>
      <table class="w-log">
        <thead><tr><th scope="col">День</th><th scope="col">Тренировка</th><th scope="col" class="w-n">План</th><th scope="col" class="w-fc">Факт</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th scope="row" colspan="2">Итого за неделю</th><td class="w-n num">${n1(W.plan)}${NB}км</td><td class="w-fc"><b class="w-pen num">${n1(W.done)}${NB}км</b></td></tr></tfoot>
      </table>
    </section>`;
  }

  /* ---- plan to the race ---- */
  function chooserHTML() {
    const rows = (list, src) => list.length ? `<ul class="w-plans">${list.map((p) => {
      const on = sel && sel.src === src && sel.id === p.id, n = p.plan?.weeks?.length || 0, peak = Math.max(...(p.plan?.weeks || []).map((w) => +w.km || 0));
      return `<li class="${on ? 'on' : ''}"><div class="w-pl"><b>${esc(p.name || 'Без названия')}</b><span class="w-meta num">${esc((p.distance || '').split(' · ')[0])}${p.distance ? ' · ' : ''}${n} ${plural(n, 'неделя', 'недели', 'недель')} · пик ${n1(peak)}${NB}км${p.savedAt ? ` · сохранён ${dayLbl(String(p.savedAt).slice(0, 10))}` : ''}${p.student?.t42 ? ` · свои темпа, T42 ${hms(p.student.t42)}` : ''}</span></div>${on ? '<span class="w-meta">выбран</span>' : `<button class="w-btn quiet" data-act="psel" data-src="${src}" data-id="${esc(p.id)}">Выбрать</button>`}</li>`;
    }).join('')}</ul>` : `<p class="w-note">${src === 'version' ? 'Сохранённых версий пока нет. Выберите план из библиотеки или сделайте новый.' : 'В библиотеке пока пусто.'}</p>`;
    return `<section class="w-panel-sec w-chooser" aria-label="Выбор мастер-плана">
      <div class="w-seg" role="tablist" aria-label="Откуда взять план">
        ${[['version', `Мои версии (${versions.length})`], ['library', `Библиотека (${library.length})`], ['new', 'Новый по описанию']].map(([k, l]) => `<button role="tab" aria-selected="${chooserTab === k}" tabindex="${chooserTab === k ? 0 : -1}" data-act="ptab" data-k="${k}">${l}</button>`).join('')}
      </div>
      ${chooserTab === 'version' ? rows(versions, 'version') : chooserTab === 'library' ? rows(library, 'library') : `
        <div class="w-gen">
          <label class="w-f"><span>Дистанция</span><select data-g="distance">${DISTANCES.map((d) => `<option ${d === gen.distance ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="w-f"><span>Недель</span><input data-g="weeks" class="num" inputmode="numeric" value="${gen.weeks}"></label>
          <label class="w-f w-f-wide"><span>Бегун и цель</span><textarea data-g="prompt" rows="3" placeholder="Марафон 3 декабря на 3:20. 5 км 18:59, полумарафон 1:38. Сейчас ~40 км в неделю, 6 тренировок, четверг отдых, среда стадион, воскресенье длительная.">${esc(gen.prompt)}</textarea></label>
          <div class="w-go">${btn('gen', gen.busy ? 'Генерирую…' : 'Сгенерировать план', 'primary', gen.busy ? 'disabled' : '')}<span class="w-meta" id="w-gen-status">${gen.busy ? 'Модель думает…' : `${gen.weeks} ${plural(gen.weeks, 'неделя', 'недели', 'недель')} до старта. Генерация занимает до минуты.`}</span></div>
          ${gen.err ? `<p class="w-err" role="alert">${esc(gen.err)}</p>` : ''}
        </div>`}
    </section>`;
  }
  // the signature of the page: the build to the race as one row of weekly volumes, grouped by training period
  function volumeChart(ws, src, curMon) {
    const max = Math.max(...ws.map((w) => w.total), 1);
    const groups = []; src.forEach((s, i) => { const g = groups.at(-1); if (g && g.name === (s.period || '')) g.n++; else groups.push({ name: s.period || '', n: 1, i }); });
    return `<section class="w-panel-sec w-vchart" aria-labelledby="w-vc-h">
      <div class="w-sech"><h2 id="w-vc-h">Объём по неделям</h2><span class="w-meta">км в неделю, синим текущая, красным неделя старта</span></div>
      <div class="w-bars" style="--n:${ws.length}">
        ${ws.map((w, i) => { const now = w.mon === curMon, past = add(w.mon, 6) < today, raceW = i === ws.length - 1;
          return `<button class="w-col ${now ? 'now' : ''} ${past ? 'past' : ''} ${raceW ? 'race' : ''}" data-act="wopen" data-w="${src[i].week}" aria-label="Неделя ${src[i].week}, ${range(w.mon, add(w.mon, 6))}, ${n1(w.total)} километров">
            <span class="w-bv num">${n1(w.total)}</span><span class="w-bar"><i style="height:${Math.max(4, Math.round((w.total / max) * 100))}%"></i></span>
            <span class="w-bn num">${String(src[i].week).replace('-', '−')}</span><span class="w-bd num">${dayLbl(w.mon)}</span></button>`; }).join('')}
        ${groups.map((g) => `<span class="w-phase" style="grid-column:${g.i + 1} / span ${g.n}">${esc(g.name)}</span>`).join('')}
      </div>
    </section>`;
  }
  function planView() {
    const p = plan();
    if (!race) return `<p class="w-note">Главный старт не выбран. Выберите его на странице <a href="${LIVE ? '' : 'https://s10.run'}/calc3?id=${id}">«Настройка плана»</a>, и план ляжет на даты до него.</p>`;
    if (!p) return `<p class="w-note">План ещё не выбран. Возьмите сохранённую версию, шаблон из библиотеки или сгенерируйте новый.</p>${chooserHTML()}`;
    const f = fillPreview(), ws = f.weeks, curMon = monday(today);
    const src = p.plan.weeks.slice().sort((a, b) => a.week - b.week);
    const weekRows = ws.map((w, n) => {
      const s = src[n], past = add(w.mon, 6) < today, now = w.mon === curMon, isOpen = openWeek === s.week || (openWeek == null && now);
      const works = w.days.filter((d) => d.typtrain >= 2);
      const head = `<tr class="w-wk ${past ? 'past' : ''} ${now ? 'now' : ''}">
          <th scope="row"><button class="w-wkb" data-act="wopen" data-w="${s.week}" aria-expanded="${isOpen}"><span class="num">${String(s.week).replace('-', '−')}</span>${now ? '<span class="w-pen">сейчас</span>' : ''}</button></th>
          <td class="num">${range(w.mon, add(w.mon, 6))}</td><td>${esc(s.period || '')}</td>
          <td class="w-wworks">${works.map((d) => `<span class="${KEY(d.typtrain) ? 'key' : ''}">${SHORT[d.typtrain]}${NB}${n1(d.prekm)}</span>`).join('')}</td>
          <td class="w-n num">${n1(w.total)}${NB}км</td></tr>`;
      if (!isOpen) return head;
      return head + `<tr class="w-wkd"><td colspan="5"><div class="w-mini-w"><table class="w-mini">${w.days.map((d) => { const ex = days.get(d.d); const keep = keepExisting && d.d > today && isRun(ex);
        return `<tr class="${d.d <= today ? 'gone' : ''}"><th scope="row"><b>${DN[dow(d.d)]}</b><span class="num">${dayLbl(d.d)}</span></th>
          <td>${typeLabel(d.typtrain)}${d.typtrain ? taskHTML(d.task) : ''}${keep ? `<span class="w-oth">В дневнике уже стоит: ${esc(TYPES[ex.type] || 'тренировка').toLowerCase()} ${n1(+ex.target || 0)}${NB}км, её не трогаем</span>` : ''}</td>
          <td class="w-n num">${d.prekm ? `${n1(d.prekm)}${NB}км` : ''}</td></tr>`; }).join('')}</table></div></td></tr>`;
    }).join('');
    return `${chooser ? chooserHTML() : ''}
      ${volumeChart(ws, src, curMon)}
      <section class="w-set" aria-labelledby="w-lay-h">
        <div class="w-set-l"><h2 id="w-lay-h">Как разложить</h2><p>Объём первой недели масштабирует весь план. Дни недели говорят, куда ставить две работы, длительную и отдых; лёгкие дни делят оставшийся объём.</p></div>
        <div class="w-panel-sec w-lay">
          <label class="w-f"><span>Объём первой недели</span><span class="w-inl"><input data-p="volume" class="num" inputmode="numeric" value="${volume || firstKm(p)}"> км</span></label>
          <div class="w-f"><span>Дни недели</span><div class="w-roles">${layout.map((r, i) => `<label class="w-role"><small>${DN[i]}</small><select data-p="role" data-i="${i}" aria-label="${DNF[i]}">${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${r === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div></div>
        </div>
      </section>
      <section class="w-sec" aria-labelledby="w-wk-h">
        <div class="w-sech"><h2 id="w-wk-h">Недели до старта</h2><span class="w-meta">нажмите на неделю, чтобы увидеть дни</span></div>
        <table class="w-log w-weeks"><thead><tr><th scope="col">Неделя</th><th scope="col">Даты</th><th scope="col">Период</th><th scope="col">Ключевые тренировки</th><th scope="col" class="w-n">Объём</th></tr></thead><tbody>${weekRows}</tbody></table>
      </section>
      <section class="w-panel-sec w-commit" aria-label="Запись в дневник">
        <div class="w-cm"><span class="w-lb">Запишется в дневник</span><span class="w-v num">${f.write.length}<small>${plural(f.write.length, 'день', 'дня', 'дней')}</small></span>
          <span class="w-cap num">${f.write.length ? `${range(f.write[0].d, f.write.at(-1).d)}, всего ${n1(f.write.reduce((a, t) => a + t.prekm, 0))}${NB}км` : 'все дни плана уже прошли или заняты'}</span>
          <label class="w-chk"><input type="checkbox" data-p="keep" ${keepExisting ? 'checked' : ''}> Не трогать дни, где задача уже стоит${f.keep.length ? ` (${f.keep.length})` : ''}</label></div>
        <div class="w-acts">${btn('pversion', 'Сохранить версию', 'quiet')}${btn('fillask', 'Заполнить календарь', 'primary', f.write.length && !fill.busy ? '' : 'disabled')}</div>
        ${fill.confirm ? `<div class="w-confirm" role="alertdialog" aria-labelledby="w-cf-h"><p id="w-cf-h"><b>Записать ${f.write.length} ${plural(f.write.length, 'день', 'дня', 'дней')} в дневник?</b> ${range(f.write[0].d, f.write.at(-1).d)}. ${keepExisting ? 'Дни, где задача уже стоит, останутся как есть.' : 'Задачи, которые уже стоят в эти дни, заменятся.'}</p><div class="w-acts">${btn('fillno', 'Отмена', 'quiet')}${btn('fillyes', fill.busy ? 'Записываю…' : 'Записать', 'primary', fill.busy ? 'disabled' : '')}</div></div>` : ''}
        ${fill.err ? `<p class="w-err" role="alert">${esc(fill.err)}</p>` : ''}
      </section>`;
  }

  /* ---- paces ---- */
  function pacesView() {
    const P = PACE;
    const opts = [studentPaces(plan()) ? ['plan', `Из плана «${plan().name}»`] : null, PACE_S10 ? ['s10', `Прогноз S10${race?.prediction ? `, ${raceName} ${hms(race.prediction)}` : ''}`] : null, ['own', 'Свои']].filter(Boolean);
    const cur = (paceSrc === 'own' && PACE_OWN) ? 'own' : (paceSrc === 's10' && PACE_S10) ? 's10' : studentPaces(plan()) ? 'plan' : PACE_S10 ? 's10' : 'own';
    const zones = [['5', 'T5', 'темп на 5 км'], ['10', 'T10', 'темп на 10 км'], ['21', 'T21', 'полумарафон'], ['42', 'T42', 'марафон']];
    const lap = (sec) => fmtSec(sec * 0.4); // 400 m, one stadium lap
    const easy = P?.[42] ? [toSec(P[42]) + 55, toSec(P[42]) + 75] : null;
    return `<section class="w-set" aria-labelledby="w-pace-h">
      <div class="w-set-l">
        <h2 id="w-pace-h">Темпа по зонам</h2>
        <p>«T21+8» в задании означает ваш T21 плюс 8 секунд. Если поменять цифру в таблице, темпа станут «своими» и сохранятся на этом устройстве.</p>
        <label class="w-f"><span>Откуда брать</span><select data-p="pacesrc">${opts.map(([k, l]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      </div>
      <div class="w-panel-sec w-ptab-p">
        <table class="w-ptab num">
          <thead><tr><th scope="col">Зона</th><th scope="col">1${NB}км</th><th scope="col">400${NB}м</th></tr></thead>
          <tbody>${zones.map(([k, n, sub]) => `<tr><th scope="row"><b>${n}</b><small>${sub}</small></th><td><input data-p="pace" data-k="${k}" value="${P?.[k] || ''}" inputmode="numeric" autocomplete="off" aria-label="${n}, минут на километр" placeholder="4:30"></td><td>${P?.[k] ? lap(toSec(P[k])) : dash}</td></tr>`).join('')}
            ${easy ? `<tr><th scope="row"><b>Лёгкий бег</b><small>T42 + 55–75${NB}с</small></th><td><span class="w-pv">${fmtSec(easy[0])}–${fmtSec(easy[1])}</span></td><td>${dash}</td></tr>` : ''}</tbody>
        </table>
      </div>
    </section>`;
  }

  /* ---- planning one week (calc3's flow) ---- */
  function workCard(w, i) {
    const groups = [...new Set(PL.opts.map((o) => o.group))];
    const s = PL.opts.findIndex((o) => o.txt === w.txt && o.km === w.km);
    return `<div class="w-work">
      <div class="w-wh"><span class="w-lb">Работа ${i + 1}</span>${w.txt ? `<span class="num">${n1(w.km)}${NB}км</span>` : ''}</div>
      ${w.txt ? typeLabel(w.t, 'b', true) + taskHTML(w.txt) : '<p class="w-tx w-meta">Выберите работу из плана или шаблонов.</p>'}
      <div class="w-wa">
        <select data-w="${i}" data-f="pick" aria-label="Работа ${i + 1}: выбрать другую"><option value="-1" selected>${w.txt ? 'Заменить на…' : 'Выбрать…'}</option>${groups.map((g) => `<optgroup label="${esc(g)}">${PL.opts.map((o, k) => (o.group === g && k !== s ? `<option value="${k}">${esc(o.name)}</option>` : '')).join('')}</optgroup>`).join('')}</select>
        <button class="w-link" data-act="wedit" data-w="${i}" aria-expanded="${w.edit}">${w.edit ? 'Готово' : 'Изменить текст'}</button>
      </div>
      ${w.edit ? `<div class="w-edit">${typeSelect(w.t, `data-w="${i}" data-f="t" aria-label="Тип работы ${i + 1}"`)}${kmField(w.km, `data-w="${i}" data-f="km" aria-label="Километры работы ${i + 1}"`)}<textarea data-w="${i}" data-f="txt" rows="3" aria-label="Задание работы ${i + 1}">${esc(w.txt)}</textarea></div>` : ''}
    </div>`;
  }
  function dayRow(r, i) {
    const moveOpts = PL.rows.map((o, j) => (j === i ? '' : `<option value="${j}">на ${DNS[dow(o.d)]} ${dayLbl(o.d)}${o.typtrain && +o.prekm ? `, там ${TYPES[o.typtrain].toLowerCase()} ${n1(o.prekm)}${NB}км` : ', там отдых'}</option>`)).join('');
    const rest = !r.typtrain && !+r.prekm;
    return `<li class="w-pday ${rest ? 'rest' : ''}">
      <div class="w-d"><b>${DN[dow(r.d)]}</b><span class="num">${dayLbl(r.d)}</span></div>
      <div class="w-pbody">
        <div class="w-ph">${typeLabel(r.typtrain, 'span', !rest)}${rest ? '' : `<span class="num w-pkm">${+r.prekm ? `${n1(r.prekm)}${NB}км` : 'без расстояния'}</span>`}</div>
        ${rest ? '' : taskHTML(r.task)}
        ${r.alt ? `<div class="w-alt" role="radiogroup" aria-label="Длительная: откуда взять"><label><input type="radio" name="alt${i}" data-r="${i}" data-alt="gen" ${r.src === 'gen' ? 'checked' : ''}>Из расчёта S10, ${n1(r.gen.prekm)}${NB}км</label><label><input type="radio" name="alt${i}" data-r="${i}" data-alt="alt" ${r.src === 'alt' ? 'checked' : ''}>Из плана, ${n1(r.alt.prekm)}${NB}км</label></div>` : ''}
        ${r.edit ? `<div class="w-edit">${typeSelect(r.typtrain, `data-r="${i}" data-f="typtrain" aria-label="Тип, ${dayLbl(r.d)}"`)}${kmField(r.prekm, `data-r="${i}" data-f="prekm" aria-label="Километры, ${dayLbl(r.d)}"`)}<textarea data-r="${i}" data-f="task" rows="3" aria-label="Задание, ${dayLbl(r.d)}">${esc(r.task)}</textarea>
          ${r.typtrain === 6 ? `<input data-r="${i}" data-f="location" placeholder="Место старта" value="${esc(r.location)}" aria-label="Место старта"><input data-r="${i}" data-f="prediction" placeholder="Прогноз, например 1:38:00" value="${esc(r.prediction)}" aria-label="Прогноз на старт">` : ''}</div>` : ''}
      </div>
      <div class="w-pa">
        <select data-r="${i}" data-f="move" aria-label="Перенести тренировку с ${dayLbl(r.d)} на другой день"><option value="-1" selected>Перенести…</option>${moveOpts}</select>
        <button class="w-link" data-act="redit" data-r="${i}" aria-expanded="${r.edit}">${r.edit ? 'Готово' : 'Изменить'}</button>
      </div>
    </li>`;
  }
  function plannerHTML() {
    const head = `<div class="w-sech"><h2 id="w-plan-h">Запланировать неделю</h2>${btn('close', 'Закрыть', 'quiet')}</div>`;
    if (!PL || PL.loading) return `<section class="w-sec" aria-labelledby="w-plan-h">${head}<p class="w-note">Загружаю ваши ограничения и шаблоны…</p></section>`;
    if (!PL.base) return `<section class="w-sec" aria-labelledby="w-plan-h">${head}<p class="w-err" role="alert">${esc(PL.err)}</p></section>`;
    const p = PL.base.param || {}, n = weekNo(windowStart()), pw = planWeek(n);
    return `<section class="w-sec" aria-labelledby="w-plan-h">${head}
      <div class="w-step">
        <div class="w-steph"><h3>Начало недели</h3><span class="w-meta num">Лимиты: объём до ${p.maxweek?.v ?? '—'}${NB}км, длительная до ${p.maxlong?.v ?? '—'}${NB}км</span></div>
        <div class="w-seg" role="radiogroup" aria-label="Первый день недели">${PL.dsels.map((x) => `<button role="radio" aria-checked="${x.k === PL.dsel}" data-act="dsel" data-k="${x.k}">${DNF[dow(x.date)]}, ${dayLbl(x.date)}</button>`).join('')}</div>
      </div>
      <div class="w-step">
        <div class="w-steph"><h3>Две ключевые работы</h3><span class="w-meta">${pw ? `Из выбранного плана «${esc(plan().name)}», неделя ${String(n).replace('-', '−')}` : plan() ? `В плане «${esc(plan().name)}» нет недели ${n}, выберите из шаблонов` : 'Из шаблонов или своё'}</span></div>
        <div class="w-works">${PL.works.map(workCard).join('')}</div>
        <div class="w-go">${btn('wgen', PL.busy && !PL.rows ? 'Считаю расписание…' : PL.rows ? 'Пересчитать расписание' : 'Рассчитать расписание', PL.rows && !PL.stale ? 'quiet' : 'primary', PL.busy ? 'disabled' : '')}<span class="w-meta">${PL.stale ? 'Работы изменились, пересчитайте расписание.' : 'Остальные дни подберёт S10 по вашим лимитам.'}</span></div>
      </div>
      ${PL.err ? `<p class="w-err" role="alert">${esc(PL.err)}</p>` : ''}
      ${PL.rows ? `<div class="w-step"><div class="w-steph"><h3>Расписание</h3><span class="w-meta num">${PL.rows.length} ${plural(PL.rows.length, 'день', 'дня', 'дней')}, ${range(PL.rows[0].d, PL.rows.at(-1).d)}</span></div>
        <ol class="w-plist">
          ${PL.pre.map((x) => `<li class="w-pday locked"><div class="w-d"><b>${DN[dow(x.d)]}</b><span class="num">${dayLbl(x.d)}</span></div><div class="w-pbody"><div class="w-ph">${typeLabel(+x.typtrain, 'span', true)}<span class="num w-pkm">${n1(+x.prekm || 0)}${NB}км</span></div>${taskHTML(x.task)}</div><div class="w-pa"><span class="w-meta">уже в дневнике</span></div></li>`).join('')}
          ${PL.rows.map(dayRow).join('')}
        </ol></div>
        <div class="w-panel-sec w-commit">
          <div class="w-cm"><span class="w-lb">Итого за ${PL.rows.length} ${plural(PL.rows.length, 'день', 'дня', 'дней')}</span><span class="w-v num" id="w-total">${n1(planTotal())}${NB}км</span>${PL.sum?.['за последние 7 дней'] ? `<span class="w-cap num">Последние 7 дней: пробежано ${PL.sum['за последние 7 дней'].km0} из ${PL.sum['за последние 7 дней'].km1}${NB}км</span>` : ''}</div>
          <div class="w-acts">${btn('wsave', PL.busy ? 'Ставлю задачи…' : 'Поставить задачи', 'primary', PL.busy || PL.stale ? 'disabled' : '')}</div>
        </div>` : ''}
    </section>`;
  }

  /* ---- address ---- */
  // tab and week live in the address, so a link opens the same view and «назад» works
  function syncURL(push) {
    const u = new URL(location.href);
    if (tab === 'week') u.searchParams.delete('tab'); else u.searchParams.set('tab', tab);
    if (wk === monday(today)) u.searchParams.delete('week'); else u.searchParams.set('week', wk);
    u.searchParams.delete('open');
    if (u.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', u);
  }
  async function readURL(first) {
    const q = new URLSearchParams(location.search);
    const t = q.get('tab'); tab = ['plan', 'paces'].includes(t) ? t : (first && !t && !q.has('week') ? tab : 'week');
    const w = q.get('week'); wk = /^\d{4}-\d{2}-\d{2}$/.test(w || '') ? monday(w) : monday(today);
    if (![...Array(7)].some((_, i) => days.has(add(wk, i)))) await loadUntil(add(wk, 6)).catch(() => {});
  }

  /* ---- the page ---- */
  function viewHTML(W) {
    if (tab === 'plan') {
      const p = plan(), n = race ? Math.round((d8(race.d) - d8(today)) / 864e5) : null;
      const src = !p ? '' : sel.src === 'version' ? 'ваша версия' : sel.src === 'library' ? 'из библиотеки' : 'новый, не сохранён';
      return `<div class="w-head"><div class="w-hgroup"><h1>План до старта</h1>
          ${p ? `<p class="w-sub">«${esc(p.name || 'Без названия')}», ${src} · темпа ${paceLabel() === `из плана «${p.name}»` ? 'из этого плана' : esc(paceLabel())}</p>` : ''}
          <p class="w-meta">${race ? `${raceName ? `${esc(raceName)}, ` : ''}${dayLbl(race.d)}, через ${n}${NB}${plural(n, 'день', 'дня', 'дней')}` : 'Главный старт не выбран'}</p></div>
        ${p ? btn('pchoose', chooser ? 'Свернуть выбор' : 'Сменить план', 'quiet', `aria-expanded="${chooser}"`) : ''}</div>
        ${flashHTML()}${planView()}`;
    }
    if (tab === 'paces') return `<div class="w-head"><div class="w-hgroup"><h1>Мои темпа</h1><p class="w-sub">По ним считаются все задания на странице.</p></div></div>${flashHTML()}${pacesView()}`;
    return `${weekHead(W)}${flashHTML()}${weekTiles(W)}${weekLog(W)}`;
  }
  const flashHTML = () => (flash ? `<div class="w-flash" role="status" tabindex="-1"><span>${esc(flash)}</span><button data-act="flash" aria-label="Скрыть сообщение">×</button></div>` : '');
  function render() {
    const W = week(wk);
    root.innerHTML = `
    <header class="w-top"><div class="w-topin">
      <a class="w-wm" href="${LIVE ? '/' : 'https://s10.run/'}" aria-label="S10.run, главная" translate="no">S10<span>.run</span></a>
      <div class="w-tabbar" role="tablist" aria-label="Разделы">
        ${[['week', 'Неделя'], ['plan', 'План до старта'], ['paces', 'Мои темпа']].map(([k, l]) => `<button role="tab" id="tab-${k}" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" aria-controls="w-panel" data-act="tab" data-k="${k}">${l}</button>`).join('')}
      </div>
      <span class="w-who">${LIVE ? '' : '<span class="w-demo">демо, данные от 31 октября</span>'}${esc(me.firstName)} ${esc(me.lastName)}</span>${SHOW_COLORS ? `<button class="w-btn quiet w-colbtn" data-act="colors" aria-expanded="${colorsOpen}">Цвета</button>` : ''}
    </div></header>
    <main class="w-main">
      ${colorsOpen ? colorsPanel() : ''}
      <div role="tabpanel" id="w-panel" aria-labelledby="tab-${tab}" class="w-view">${viewHTML(W)}</div>
      <p class="w-foot">${LIVE ? `Данные из вашего дневника S10, обновлены ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.` : 'Демо-версия страницы «Моя неделя» для S10.run. Кнопки работают, но ничего не отправляется в S10.'}</p>
    </main>`;
    root.querySelectorAll('textarea').forEach(fit);
    syncURL(false);
    if (flash && flash !== shownFlash) { shownFlash = flash; root.querySelector('.w-flash')?.focus({ preventScroll: false }); }
  }
  function fit(t) { t.style.height = 'auto'; t.style.height = Math.max(64, t.scrollHeight + 2) + 'px'; }

  /* ================= styles: the training diary (taste-skill app screen, editorial greeting, palette №3) ================= */
  const css = `
  .w-app{--ground:#ffffff;--panel:#f4f4f4;--raised:#ffffff;--rule:#e6e6e6;--rule-p:#e1e1e1;--control:#cfcfcf;--text:#111111;--muted:#5f5f5f;--faint:#6b6b6b;
    --pen:#1a4be0;--pen-soft:#f1f4fd;--key:#d62b1f;--primary:#111111;--primary-ink:#ffffff;--primary-hover:#2e2e2e;--chip:#ececec;--chip-hover:#e1e1e1;--field:#ffffff;
    --bar:#cfcfcf;--bar-past:#e2e2e2;--bad:#b42318;--warn-bg:#fffbeb;--warn-line:#fde68a;--warn-ink:#92400e;
    min-height:100vh;background:var(--ground);color:var(--text);font:15px/1.5 Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;text-align:left}
  .w-app.w-over{position:fixed;inset:0;overflow:auto;z-index:2147483000;scrollbar-gutter:stable}
  html:has(.w-app:not(.w-over)){scrollbar-gutter:stable}
  .w-app *{box-sizing:border-box;margin:0;padding:0}
  .w-app .num{font-variant-numeric:tabular-nums}
  .w-app button,.w-app select,.w-app input,.w-app textarea{font:inherit;color:inherit}
  .w-app :focus-visible{outline:2px solid var(--pen);outline-offset:2px}
  .w-app a{color:var(--pen)}
  .w-nw{white-space:nowrap}

  /* shell: the wordmark, the three views, the athlete */
  .w-top{background:var(--ground);border-bottom:1px solid var(--rule);padding:0 max(24px,env(safe-area-inset-right)) 0 max(24px,env(safe-area-inset-left))}
  .w-topin{max-width:1100px;margin:0 auto;height:60px;display:flex;align-items:stretch;gap:44px}
  .w-wm{align-self:center;font-weight:900;font-style:italic;font-size:22px;letter-spacing:-.02em;color:var(--pen)!important;text-decoration:none}
  .w-wm span{font-weight:500}
  .w-tabbar{display:flex;gap:28px;overflow-x:auto;scrollbar-width:none}
  .w-tabbar button{border:0;background:none;padding:0 2px;font-size:15px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
  .w-tabbar button:hover{color:var(--text)}
  .w-tabbar button[aria-selected="true"]{color:var(--text);font-weight:500;border-bottom-color:var(--text)}
  .w-who{margin-left:auto;align-self:center;display:flex;align-items:center;gap:16px;color:var(--muted);font-size:14px;white-space:nowrap}
  .w-demo{font-size:12px;color:var(--faint)}
  .w-colbtn{align-self:center}
  .w-main{max-width:1100px;box-sizing:content-box!important;margin:0 auto;padding:40px max(24px,env(safe-area-inset-right)) 64px max(24px,env(safe-area-inset-left));display:grid;gap:48px}
  .w-view{display:grid;gap:32px;min-width:0}

  /* the greeting */
  .w-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px 24px;align-items:start}
  .w-head>.w-btn{margin-top:2px}
  .w-hgroup{display:grid;gap:6px;min-width:0;max-width:760px}
  .w-head h1{font-size:32px;line-height:1.2;font-weight:500;letter-spacing:-.015em}
  .w-sub{font-size:16px;color:var(--muted)}
  .w-sub b{color:var(--text);font-weight:500}
  .w-meta{font-size:13px;color:var(--muted)}
  .w-head .w-meta{margin-top:4px}
  .w-pen{color:var(--pen)!important}
  .w-navs{display:flex;align-items:center;gap:8px}
  .w-tonow{order:-1}.w-tonow:disabled{visibility:hidden}
  .w-nav{display:flex;align-items:center;height:40px;border-radius:999px;background:var(--chip)}
  .w-nav button{width:40px;height:40px;border:0;background:none;color:var(--text);cursor:pointer;font-size:18px;border-radius:999px}
  .w-nav button:hover{background:var(--chip-hover)}
  .w-nav span{width:148px;text-align:center;font-weight:500;font-size:14px}

  /* three figures of the week on grey panels, 4 columns each */
  .w-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .w-tile{background:var(--panel);border-radius:16px;padding:20px 22px;display:grid;gap:6px;align-content:start;min-height:128px}
  .w-lb{font-size:13px;color:var(--muted)}
  .w-v{font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-.01em}
  .w-v small{font-size:15px;color:var(--muted);margin-left:6px;letter-spacing:0}
  .w-cap{font-size:13px;color:var(--muted)}
  .w-scale{display:block;height:6px;border-radius:999px;background:var(--rule-p);margin-top:12px;overflow:hidden}
  .w-scale i{display:block;height:100%;background:var(--pen);border-radius:999px}
  .w-dash{color:var(--faint)}

  /* sections */
  .w-sec{display:grid;min-width:0}
  .w-sech{display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-height:40px;margin-bottom:12px}
  .w-sech h2{font-size:18px;font-weight:500}
  .w-sech>.w-btn{margin-left:auto}
  .w-panel-sec{background:var(--panel);border-radius:16px;padding:20px 24px;min-width:0}

  /* the diary: a ruled sheet, figures right-aligned */
  .w-log{width:100%;border-collapse:collapse}
  .w-log th,.w-log td{padding:16px 12px;border-top:1px solid var(--rule);vertical-align:top;text-align:left;font-weight:400}
  .w-log thead th{border-top:0;padding-top:0;padding-bottom:10px;font-size:13px;color:var(--muted)}
  .w-log tr>:first-child{padding-left:0}.w-log tr>:last-child{padding-right:0}
  .w-log .w-n,.w-log .w-fc{text-align:right;white-space:nowrap}
  .w-log td.w-n{width:96px;font-size:16px}
  .w-log td.w-fc{width:160px}
  .w-d{width:84px}
  .w-d b{display:block;font-weight:500;font-size:15px}
  .w-d span{display:block;font-size:13px;color:var(--muted)}
  tr.today .w-d b,tr.today .w-d span{color:var(--pen)}
  .w-type{display:block;font-weight:500;font-size:15px}
  .w-type.key{color:var(--key)}
  .w-type.rest{color:var(--muted);font-weight:400}
  .w-t .w-tx{margin-top:4px}
  .w-tx{color:var(--muted);line-height:1.5}
  .w-tx b{color:var(--text);font-weight:500;white-space:nowrap}
  ul.w-tx{list-style:none;display:grid;gap:2px}
  ul.w-tx li{position:relative;padding-left:14px}
  ul.w-tx li::before{content:"";position:absolute;left:2px;top:.68em;width:5px;height:5px;border-radius:50%;background:var(--control)}
  .w-oth{display:block;margin-top:4px;font-size:13px;color:var(--muted)}
  .w-fc b{display:block;font-weight:500;font-size:16px}
  .w-fc span{display:block;font-size:13px;color:var(--muted)}
  .w-miss{color:var(--muted)}
  .w-log tfoot th,.w-log tfoot td{border-top:1px solid var(--text);padding-top:14px;font-weight:500;font-size:15px}

  /* plan: the build to the race */
  .w-bars{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));column-gap:12px;row-gap:12px}
  .w-col{grid-row:1;border:0;background:none;color:inherit;cursor:pointer;display:grid;grid-template-rows:auto 140px auto auto;justify-items:center;gap:6px;padding:0;border-radius:8px}
  .w-bv{font-size:14px}
  .w-bar{width:100%;max-width:64px;height:140px;display:flex;align-items:flex-end;border-bottom:1px solid var(--control)}
  .w-bar i{display:block;width:100%;background:var(--bar);border-radius:4px 4px 0 0;transition:background .15s}
  .w-col:hover .w-bar i{background:var(--control)}
  .w-col.past .w-bar i{background:var(--bar-past)}
  .w-col.past .w-bv,.w-col.past .w-bn{color:var(--muted)}
  .w-col.now .w-bar i{background:var(--pen)}
  .w-col.now .w-bv,.w-col.now .w-bn{color:var(--pen);font-weight:500}
  .w-col.race .w-bar i{background:var(--key)}
  .w-col.race .w-bv,.w-col.race .w-bn{color:var(--key);font-weight:500}
  .w-bn{font-size:14px;font-weight:500}
  .w-bd{font-size:12px;color:var(--muted)}
  .w-phase{grid-row:2;font-size:13px;color:var(--muted);border-top:1px solid var(--rule-p);padding-top:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .w-weeks td.w-n{width:96px}
  .w-wkb{border:0;background:none;padding:0;cursor:pointer;display:inline-flex;gap:10px;align-items:baseline;font-weight:500}
  .w-wkb:hover .num{text-decoration:underline;text-underline-offset:3px}
  .w-weeks tr.past>*{color:var(--muted)}
  .w-wworks span{display:inline-block;margin-right:16px;white-space:nowrap}
  .w-wworks span.key{color:var(--key)}
  .w-weeks tr.past .w-wworks span.key{color:var(--muted)}
  .w-wkd>td{border-top:0;padding-top:0}
  .w-mini-w{background:var(--panel);border-radius:12px;padding:4px 20px}
  .w-mini{width:100%;border-collapse:collapse}
  .w-mini th,.w-mini td{padding:12px 8px;border-top:1px solid var(--rule-p);vertical-align:top;text-align:left;font-weight:400}
  .w-mini tr:first-child>*{border-top:0}
  .w-mini tr>:first-child{padding-left:0;width:84px}.w-mini tr>:last-child{padding-right:0}
  .w-mini th b{display:block;font-weight:500}.w-mini th span{display:block;font-size:13px;color:var(--muted)}
  .w-mini .w-n{text-align:right;white-space:nowrap;width:80px}
  .w-mini tr.gone{opacity:.55}

  /* settings rows: label column (4 of 12) beside its panel (8 of 12): 356 + 16 + 728 = 1100 */
  .w-set{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:16px;align-items:start}
  .w-set-l{display:grid;gap:10px;align-content:start;padding:20px 24px 0 0}
  .w-set-l h2{font-size:18px;font-weight:500}
  .w-set-l p{color:var(--muted);font-size:14px}
  .w-set-l .w-f{margin-top:8px}
  .w-lay{display:grid;gap:20px}
  .w-f{display:grid;gap:8px;min-width:0}
  .w-f>span{font-size:14px;font-weight:500}
  .w-inl{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;font-weight:400}
  .w-roles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 8px}
  .w-role{display:grid;gap:4px}
  .w-role small{font-size:12px;color:var(--muted)}
  .w-app .w-role select{padding:0 24px 0 10px;font-size:13px;background-position:right 9px center}
  .w-lay input[data-p=volume]{width:84px;text-align:right}
  .w-ptab-p{padding:6px 24px}
  .w-ptab{width:100%;border-collapse:collapse}
  .w-ptab th,.w-ptab td{padding:14px 0 14px 24px;border-top:1px solid var(--rule-p);text-align:right;white-space:nowrap;vertical-align:middle;font-size:16px;font-weight:400}
  .w-ptab thead th{border-top:0;color:var(--muted);font-size:13px;padding-top:12px;padding-bottom:10px}
  .w-ptab th[scope=row],.w-ptab thead th:first-child{text-align:left;width:100%;padding-left:0}
  .w-ptab th[scope=row] b{font-weight:500;margin-right:10px}
  .w-ptab th[scope=row] small{color:var(--muted);font-size:13px}
  .w-ptab td input{width:84px;text-align:right;font-size:16px}
  .w-ptab td:last-child{min-width:72px}
  .w-pv{display:inline-block;padding-right:13px}

  /* writing to the diary */
  .w-commit{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
  .w-cm{display:grid;gap:4px}
  .w-acts{display:flex;gap:10px;flex-wrap:wrap}
  .w-chk{display:inline-flex;gap:8px;align-items:center;font-size:14px;color:var(--muted);margin-top:8px;cursor:pointer}
  .w-confirm{flex-basis:100%;background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
  .w-confirm p{max-width:62ch}
  .w-chooser{display:grid;gap:16px}
  .w-plans{list-style:none}
  .w-plans li{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid var(--rule-p)}
  .w-plans li:first-child{border-top:0}
  .w-pl{display:grid;gap:2px;min-width:0}
  .w-gen{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:16px}
  .w-f-wide,.w-gen .w-go{grid-column:1/-1}

  /* planning one week */
  .w-step{display:grid;gap:14px;padding:20px 0;border-top:1px solid var(--rule)}
  .w-steph{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
  .w-steph h3{font-size:16px;font-weight:500}
  .w-works{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .w-work{background:var(--panel);border-radius:16px;padding:20px 22px;display:grid;gap:8px;align-content:start;min-width:0}
  .w-wh{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
  .w-wh .num{font-size:16px}
  .w-wa{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px}
  .w-wa select{flex:1 1 200px}
  .w-edit{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
  .w-edit textarea,.w-edit input:not([data-f=prekm]):not([data-f=km]){grid-column:1/-1}
  .w-kmf{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;white-space:nowrap}
  .w-kmf input{width:76px;text-align:right}
  .w-go{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .w-plist{list-style:none}
  .w-pday{display:grid;grid-template-columns:84px minmax(0,1fr) 190px;gap:16px;padding:16px 0;border-top:1px solid var(--rule);align-items:start}
  .w-pday:first-child{border-top:0}
  .w-pday.locked{opacity:.7}
  .w-pbody{display:grid;gap:4px;min-width:0}
  .w-ph{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
  .w-pkm{font-size:16px;white-space:nowrap}
  .w-pa{display:grid;gap:2px;justify-items:start}
  .w-app .w-pa select{border-color:transparent;background-color:transparent;font-weight:500;padding-left:0;background-position:right 8px center}
  .w-app .w-pa select:hover{border-color:var(--control);background-color:var(--field);padding-left:10px}
  .w-alt{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;color:var(--muted);padding-top:4px}
  .w-alt label{display:inline-flex;gap:8px;align-items:center;cursor:pointer}

  /* controls: full pills with the soft panels; one ink primary per view */
  .w-btn{height:40px;padding:0 18px;border-radius:999px;border:0;background:var(--chip);color:var(--text);font-weight:500;font-size:14px;cursor:pointer;white-space:nowrap;transition:background .15s,transform .12s}
  .w-btn:hover:not(:disabled){background:var(--chip-hover)}
  .w-btn:active:not(:disabled){transform:translateY(1px)}
  .w-btn.primary{background:var(--primary);color:var(--primary-ink)}
  .w-btn.primary:hover:not(:disabled){background:var(--primary-hover)}
  .w-btn:disabled{opacity:.5;cursor:default}
  .w-link{border:0;background:none;color:var(--text);cursor:pointer;font-size:14px;font-weight:500;padding:6px 0;white-space:nowrap;text-decoration:underline;text-decoration-color:var(--control);text-underline-offset:3px}
  .w-link:hover{text-decoration-color:var(--text)}
  .w-app select,.w-app input,.w-app textarea{border:1px solid var(--control);border-radius:10px;background:var(--field);min-width:0;max-width:100%}
  .w-app select{height:40px;padding:0 32px 0 12px;font-size:14px;appearance:none;cursor:pointer;
    background:var(--field) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%235f5f5f' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 12px center}
  .w-app input{height:40px;padding:0 12px}
  .w-app input[type=checkbox],.w-app input[type=radio]{height:16px;width:16px;accent-color:var(--text)}
  .w-app textarea{width:100%;padding:10px 12px;line-height:1.5;resize:vertical}
  .w-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:999px;background:var(--chip);justify-self:start}
  .w-seg button{height:32px;padding:0 14px;border:0;border-radius:999px;background:none;color:var(--text);cursor:pointer;font-size:14px}
  .w-seg button:hover{background:var(--chip-hover)}
  .w-seg button[aria-checked="true"],.w-seg button[aria-selected="true"]{background:var(--raised);color:var(--text);font-weight:500}
  .w-panel-sec .w-seg{background:var(--chip-hover)}

  .w-flash{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--pen-soft);border-radius:12px;padding:12px 16px}
  .w-flash:focus{outline:none}.w-flash:focus-visible{outline:2px solid var(--pen);outline-offset:2px}
  .w-flash button{border:0;background:none;color:inherit;cursor:pointer;font-size:18px;width:32px;height:32px}
  .w-note{color:var(--muted);font-size:14px}
  .w-err{color:var(--bad);font-size:14px}
  .w-foot{color:var(--muted);font-size:12px}

  /* the colour picker (?colors) */
  .w-colors{background:var(--panel);border-radius:16px}
  .w-ch{display:flex;align-items:center;gap:12px;padding:16px 20px;flex-wrap:wrap}
  .w-ch h2{margin-right:auto;font-size:18px;font-weight:500}
  .w-muted{color:var(--muted);font-size:13px}
  .w-pill{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:500;background:var(--chip)}
  .w-pals{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:0 20px 20px}
  .w-pal{width:100%;display:grid;gap:6px;text-align:left;border:1px solid var(--rule-p);border-radius:12px;background:var(--raised);padding:8px 8px 10px;cursor:pointer}
  .w-pal:hover{border-color:var(--control)}
  .w-pal.on{border-color:var(--text);outline:1px solid var(--text)}
  .w-rec{justify-self:start}
  .w-pal-prev{display:block;height:64px;border-radius:8px;padding:10px;position:relative}
  .w-pal-prev i{display:grid;gap:5px;height:100%;border-radius:6px;padding:8px;align-content:start;position:relative}
  .w-pal-prev b{display:block;height:5px;border-radius:2px;width:80%}
  .w-pal-prev em{position:absolute;right:36px;bottom:8px;width:22px;height:10px;border-radius:3px}.w-pal-prev em.k{right:8px}
  .w-pal-n{font-size:14px;font-weight:500}
  .w-pal small{color:var(--muted);font-size:12px}

  @media (max-width:1000px){.w-head{grid-template-columns:minmax(0,1fr)}.w-head>.w-navs{order:-1}.w-head>.w-btn{justify-self:start}
    .w-set{grid-template-columns:1fr}.w-set-l{padding:0}
    .w-weeks th:nth-child(3),.w-weeks td:nth-child(3){display:none}}
  @media (max-width:760px){.w-works{grid-template-columns:1fr}.w-gen{grid-template-columns:1fr}.w-roles{grid-template-columns:repeat(4,minmax(0,1fr))}
    .w-pday{grid-template-columns:minmax(0,1fr);gap:8px}.w-pday .w-d{display:flex;gap:8px;align-items:baseline}.w-pa{grid-template-columns:minmax(0,1fr) auto;align-items:center}
    .w-tiles{grid-template-columns:1fr;gap:0;background:var(--panel);border-radius:16px}
    .w-tile{background:none;border-radius:0;min-height:0;padding:14px 20px;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;column-gap:12px;border-top:1px solid var(--rule-p)}
    .w-tile:first-child{border-top:0}
    .w-tile .w-lb{grid-row:1}.w-tile .w-v{grid-row:1;grid-column:2;font-size:22px;text-align:right}
    .w-tile .w-cap,.w-tile .w-scale{grid-column:1/-1}
    .w-log thead{display:none}
    .w-log,.w-log tbody,.w-log tfoot{display:block}
    .w-log tr{display:grid;grid-template-columns:52px minmax(0,1fr) auto;column-gap:12px;row-gap:6px;padding:14px 0;border-top:1px solid var(--rule)}
    .w-log tbody tr:first-child{border-top:0}
    .w-log th,.w-log td{border:0!important;padding:0!important;width:auto!important}
    .w-log .w-d{grid-row:1/span 2}
    .w-log td.w-n{grid-column:3;grid-row:1}
    .w-log td.w-fc{grid-column:2/-1;text-align:left;white-space:normal}
    .w-log .w-fc b,.w-log .w-fc span{display:inline;margin-right:8px}
    .w-log tfoot tr{border-top:1px solid var(--text)}
    .w-log tfoot th{grid-column:1/3}.w-log tfoot td.w-fc{grid-column:3;grid-row:2;text-align:right}
    .w-weeks tr{grid-template-columns:44px minmax(0,1fr) auto;grid-template-areas:"n d v" "n w w"}
    .w-weeks tr>th{grid-area:n}.w-weeks tr>td:nth-child(2){grid-area:d}.w-weeks tr>td:nth-child(4){grid-area:w}.w-weeks tr>td.w-n{grid-area:v}
    .w-wkb{flex-direction:column;gap:0}.w-wkb .w-pen{font-size:12px;font-weight:400}
    .w-weeks tr.w-wkd{display:block;padding-top:0;border-top:0}.w-weeks tr.w-wkd>td{display:block}
    .w-col{grid-template-rows:auto 110px auto}.w-bar{height:110px}.w-bd{display:none}.w-bars{column-gap:6px}}
  @media (max-width:560px){.w-main{padding:20px 16px 40px;gap:32px}.w-view{gap:24px}.w-top{padding:0 16px}
    .w-topin{height:auto;flex-wrap:wrap;gap:0 14px}.w-wm{height:52px;display:flex;align-items:center}.w-demo{display:none}
    .w-tabbar{order:3;flex-basis:100%;height:44px;gap:24px}.w-tonow{order:0}
    .w-head h1{font-size:24px}.w-sub{font-size:15px}.w-panel-sec{padding:16px 18px}.w-mini-w{padding:2px 14px}
    .w-roles{grid-template-columns:repeat(2,minmax(0,1fr))}.w-ptab-p{padding:4px 16px}.w-ptab th,.w-ptab td{padding-left:16px}.w-ptab th[scope=row] small{display:block}
    .w-commit .w-acts,.w-commit .w-btn{width:100%}.w-confirm .w-acts{width:100%}.w-confirm .w-btn{flex:1}
    .w-plans li{flex-wrap:wrap}.w-phase{font-size:12px}}
  @media (prefers-reduced-motion:reduce){.w-app *{transition:none!important}}
  `;

  /* ================= mount and events ================= */
  document.getElementById('s10-week')?.remove();
  document.getElementById('s10-week-css')?.remove();
  const style = document.createElement('style'); style.id = 's10-week-css'; style.textContent = css; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 's10-week'; root.className = document.getElementById('root') ? 'w-app w-over' : 'w-app'; document.body.appendChild(root);
  document.title = 'Моя неделя · S10.run';
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'plan') { tab = 'week'; return openPlanner(); }
      if (act === 'close') { mode = 'view'; PL = null; return render(); }
      if (act === 'flash') { flash = ''; return render(); }
      if (act === 'wgen') return generateWeek();
      if (act === 'wsave') return saveWeek();
      if (act === 'dsel') { PL.dsel = a.dataset.k; PL.rows = null; pickWorks(); return render(); }
      if (act === 'wedit') { const w = PL.works[+a.dataset.w]; w.edit = !w.edit; return render(); }
      if (act === 'redit') { const r = PL.rows[+a.dataset.r]; r.edit = !r.edit; return render(); }
      if (act === 'tab') { tab = a.dataset.k; store.set('tab', tab); syncURL(true); return render(); }
      if (act === 'today') { wk = monday(today); syncURL(true); return render(); }
      if (act === 'colors') { colorsOpen = !colorsOpen; return render(); }
      if (act === 'pal') { palId = a.dataset.id; store.set('palette', palId); applyPalette(); return render(); }
      if (act === 'pchoose') { chooser = !chooser; return render(); }
      if (act === 'ptab') { chooserTab = a.dataset.k; return render(); }
      if (act === 'psel') { sel = { src: a.dataset.src, id: a.dataset.id }; persistSel(); chooser = false; volume = null; if (paceSrc === 'plan') paceSrc = null; reprice(); if (PL?.base) { PL.rows = null; pickWorks(); } flash = `Выбран план «${plan().name}». Задания и темпа на странице пересчитаны.`; tab = 'plan'; return render(); }
      if (act === 'gen') return runGenerate();
      if (act === 'wopen') { const w = +a.dataset.w; openWeek = openWeek === w ? NaN : w; return render(); }
      if (act === 'fillask') { fill.confirm = true; fill.err = ''; return render(); }
      if (act === 'fillno') { fill.confirm = false; return render(); }
      if (act === 'fillyes') return fillCalendar();
      if (act === 'pversion') return saveVersion();
      return;
    }
    const b = e.target.closest('button[data-w]'); if (!b) return;
    wk = add(wk, 7 * +b.dataset.w);
    if (![...Array(7)].some((_, i) => days.has(add(wk, i)))) await loadUntil(add(wk, 6)).catch(() => {});
    syncURL(true); render();
  });
  root.addEventListener('keydown', (e) => {
    const t = e.target.closest('[role=tab]'); if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = [...t.parentElement.querySelectorAll('[role=tab]')], label = t.parentElement.getAttribute('aria-label');
    let i = list.indexOf(t);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    e.preventDefault(); list[i].click();
    requestAnimationFrame(() => root.querySelector(`[aria-label="${label}"] [role=tab][aria-selected=true]`)?.focus());
  });
  root.addEventListener('change', (e) => {
    const t = e.target, f = t.dataset.f, pk = t.dataset.p;
    if (pk === 'role') { layout[+t.dataset.i] = t.value; store.set('layout', layout); return render(); }
    if (pk === 'keep') { keepExisting = t.checked; fill.confirm = false; return render(); }
    if (pk === 'pacesrc') { paceSrc = t.value; if (paceSrc === 'own' && !PACE_OWN) PACE_OWN = { ...PACE }; store.set(`paceSrc.${id}`, paceSrc); reprice(); if (PL?.base) { PL.rows = null; pickWorks(); } return render(); }
    if (pk === 'pace') {
      const v = t.value.trim().replace(/[.,]/g, ':'), m = v.match(/^(\d{1,2}):?(\d{2})$/);
      if (!m) { t.setCustomValidity('Например 4:30'); t.reportValidity(); return; }
      t.setCustomValidity('');
      PACE_OWN = { ...PACE, [t.dataset.k]: `${+m[1]}:${m[2]}` }; paceSrc = 'own'; store.set(`paceOwn.${id}`, PACE_OWN); store.set(`paceSrc.${id}`, 'own'); reprice(); if (PL?.base) { PL.rows = null; pickWorks(); } return render();
    }
    if (pk === 'volume') { const v = +t.value.replace(',', '.'); volume = v > 0 ? v : null; return render(); }
    if (t.dataset.g) { const k = t.dataset.g; gen[k] = k === 'weeks' ? Math.max(1, Math.min(30, +t.value || gen.weeks)) : t.value; if (k !== 'prompt') render(); return; }
    if (t.dataset.alt != null) { const r = PL.rows[+t.dataset.r]; r.src = t.dataset.alt; Object.assign(r, t.dataset.alt === 'alt' ? r.alt : r.gen); return render(); }
    if (f === 'pick') { const o = PL.opts[+t.value]; if (o) Object.assign(PL.works[+t.dataset.w], { t: o.t, km: o.km, txt: o.txt }); if (PL.rows) PL.stale = true; return render(); }
    if (f === 'move') {
      const i = +t.dataset.r, j = +t.value; if (j < 0) return;
      const A = PL.rows[i], B = PL.rows[j];
      for (const k of ['typtrain', 'task', 'prekm', 'location', 'prediction', 'src', 'gen', 'alt', 'edit']) [A[k], B[k]] = [B[k], A[k]];
      return render();
    }
    if (f === 'typtrain') { PL.rows[+t.dataset.r].typtrain = +t.value; return render(); }
    if (f === 't') { PL.works[+t.dataset.w].t = +t.value; if (PL.rows) PL.stale = true; return render(); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target, f = t.dataset.f;
    if (t.tagName === 'TEXTAREA') fit(t);
    if (t.dataset.g === 'prompt') { gen.prompt = t.value; return; }
    if (!f || f === 'pick' || f === 'move' || f === 'typtrain' || f === 't') return;
    if (t.dataset.w != null) { const w = PL.works[+t.dataset.w]; if (f === 'km') w.km = +t.value.replace(',', '.') || 0; else w.txt = t.value; if (PL.rows && !PL.stale) { PL.stale = true; const s = root.querySelector('[data-act=wsave]'); if (s) s.disabled = true; } return; }
    if (t.dataset.r != null) {
      const r = PL.rows[+t.dataset.r];
      if (f === 'prekm') r.prekm = +t.value.replace(',', '.') || 0; else r[f] = t.value;
      const tot = root.querySelector('#w-total'); if (tot) tot.textContent = `${n1(planTotal())} км`;
    }
  });
  const q = new URLSearchParams(location.search).get('open');
  await readURL(true);
  applyPalette();
  render();
  window.addEventListener('popstate', async () => { await readURL(); mode = 'view'; PL = null; render(); });
  if (!LIVE && q === 'plan') { tab = 'week'; await openPlanner(); await generateWeek(); }
  if (!LIVE && q === 'choose') { tab = 'plan'; chooser = true; render(); }
  if (!LIVE && q === 'colors') { colorsOpen = true; render(); }
  if (!LIVE && q === 'tab-plan') { tab = 'plan'; render(); }
  if (!LIVE && q === 'tab-paces') { tab = 'paces'; render(); }
  return `S10 «Моя неделя» (${LIVE ? 'live' : 'demo'}) для ${me.firstName} ${me.lastName}`;
})();
