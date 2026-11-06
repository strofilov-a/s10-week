/* S10 «Моя неделя» · release f10e1e8370: everything on one page.
   Today and this week · the paces · the master plan (your saved versions, the library, or a new one from a prompt) laid
   over the dates to the race · «Заполнить календарь» for the whole plan · «Запланировать неделю» for one week (calc3).
   It reads and writes the logged-in user's data through the site's own API. */
(async () => {
  /* ================= data source: the site's own API ================= */
  const ORIGIN = location.origin;
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const last = (a) => a[a.length - 1];
  async function get(u) {
    const r = await fetch(ORIGIN + u, { credentials: 'include' }); if (!r.ok) throw new Error(r.status); return r.json();
  }
  async function post(u, fd) {
    const r = await fetch(ORIGIN + u, { method: 'POST', body: fd, credentials: 'include' }); const b = await r.json().catch(() => ({})); if (!r.ok || b.error) throw new Error(b.error || r.status); return b;
  }
  async function generatePlanText(body, onProgress) {
    const r = await fetch('https://s10.run/t7/plan-templates/public/api/generate.php', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || `ошибка ${r.status}`); }
    if (!r.body) { const t = await r.text(); onProgress(t); return t; }
    const rd = r.body.getReader(), dec = new TextDecoder(); let out = '';
    for (;;) { const { done, value } = await rd.read(); if (done) break; out += dec.decode(value, { stream: true }); onProgress(out); }
    return out + dec.decode();
  }

  /* ================= words and dates ================= */
  const TYPES = { 0: 'Тренировка', 1: 'Восстановительная', 2: 'Развивающая', 3: 'Интервальная', 4: 'Повторная', 5: 'Длительная', 6: 'Соревнование' };
  const SHORT = { 1: 'Восст.', 2: 'Разв.', 3: 'Интерв.', 4: 'Повт.', 5: 'Длит.', 6: 'Старт' };
  const LEVEL = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3, 5: 2, 6: 3 };
  const OTHER = { HIKING: 'Поход', CYCLING: 'Велосипед', WALKING: 'Ходьба', SWIMMING: 'Плавание', STRENGTH_TRAINING: 'Силовая' };
  const TYPE_BY_NAME = { 'интервальная': 3, 'развивающая': 2, 'повторная': 4, 'длительная': 5, 'восстановительная': 1, 'соревнование': 6, 'силовая': 1 };
  const DISTANCES = ['Марафон · 42.2 км', 'Полумарафон · 21.1 км', '10 км', '5 км'];
  const DN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const LOGO = '<svg viewBox="0 0 89 27" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M23 17.9L22.6 17.6L22.5 17.7L22.4 17.5L22 17.7L21.6 17.3L21.2 17.5L20.7 17.3L20.1 16.8L20.2 16.1L20.6 15L20.7 14.1L21.2 14.1L21.4 13.9L21.4 13.5L21.2 13.1L21.5 12.3L22.6 11.5L22.5 11.3L22.9 10.9L22.7 10.7L23.3 10.3L23.6 9.7L23.6 9.6L23.2 10L22.5 10.2L22.1 10.8L22.1 10.4L22.7 8.9L23.1 7L23.3 6.8L24 4.6L24.8 3L24.7 2.5L25.6 1L25.6 .7L25.4 .4L25.8 0L26.3 .2L26.9 .1L28.8 1.4L28.9 2.1L28.4 3.3L28.5 3.4L28.4 3.8L28.6 3.9L27.5 6L27.4 6.3L27.6 6.3L27.3 7L27.2 7.8L26.8 8.3L26.8 8.8L26.3 9.2L26.3 10.6L26 10.9L26 11.1L25.1 13.2L25.2 14.2L24.9 14.9L24.7 15.5L24.9 15.9L24.4 17.6L23.9 18.3L23.2 18.1L23 17.9ZM20.6 15.3L20.7 15.6L20.8 15.3L20.6 15.3ZM20.8 15.1L21 15.1L21.1 14.9L20.9 14.8L20.8 15.1ZM21.7 11.6L21.9 11.4L22.1 11.4L21.9 11.8L21.7 11.9L21.7 11.6ZM22.1 12.7L21.8 13L21.8 13.3L22.3 13L22.5 13L22.5 13.2L22.9 12.8L22.1 12.7ZM22.3 12.5L22.8 12.4L23 11.7L22.3 12.5ZM24.6 16L24.2 16.2L24.6 16.1L24.6 16Z" fill="white"/><path d="M37.1 16.9L36.7 17.1L34.6 17L33.1 16.5L32.2 15.9L31.7 15.2L31.6 14.5L31.4 14.4L31.4 14.2L31.2 14.4L31.6 13.2L31.5 13.1L31.3 13.2L31.3 13.1L31.4 12.6L31.3 12.5L31.3 12.6L31.3 11.8L31.6 11.4L31.3 11.5L31.6 10.9L31.8 9.6L32 9.4L31.9 9.6L32.3 9.4L32.2 9.2L32.6 7.9L32.7 7.6L32.5 7.7L32.7 7L34.1 5L34 4.6L34.3 4.5L34.5 3.3L35.7 1.8L36.7 1.5L36.7 1.8L37.6 1.7L38 1.4L38.4 1.5L41.4 2.1L43 3.5L43.1 3.9L43.3 4L43.4 5.2L43.9 5.9L43.7 6.6L43.8 7L43.9 9L43.8 9.4L43.7 9.5L43.6 9.3L43.4 9.6L43.3 10.3L43.1 10.6L43.3 11.1L42.7 12.2L42.4 12.3L42.1 13.5L41.9 13.4L41.9 13.9L41.3 14.3L41.2 14.2L41.2 14.6L40.7 14.8L40.6 15.2L38.9 16.7L37.6 17.1L37.1 16.9ZM32.4 8.2L32.2 8.7L31.8 9.1L32.1 8.4L32.4 8.2ZM32.2 11L32.1 11.5L32.4 11.2L32.2 11ZM34.5 13.3L34.7 14.2L35.1 14.8L35.7 15L36.4 14.9L37.1 14.6L37.9 13.9L39.2 11.8L39.6 9.9L40.3 7.8L40.4 5.5L40.6 5L40 4.2L39.9 4.3L39.5 4.2L39.5 3.8L39.4 3.7L38.6 3.7L38.2 3.9L36.5 6.5L35.8 8.4L35.6 8.6L34.9 11.2L34.5 12L34.6 12.1L34.5 12.3L34.5 13.3ZM38.2 3.2L39.5 3.3L39.3 3.1L38.7 2.9L38.6 3.1L38.2 3.2ZM41 14L41.3 14L41.3 13.6L41 14ZM43.3 7.5L43.5 7.8L43.6 7.5L43.4 6.9L43.3 7.5Z" fill="white"/><path d="M43.4 18.1L43.6 16.2L45.3 15.5L46.5 15.7L47 16L47 16.6L46.7 17.6L46.7 18.8L46.1 19.3L45.3 19.5L44.2 19.4L43.6 18.8L43.4 18.1Z" fill="white"/><path d="M53.6 14.3L53.7 15.2L53.6 15.6L53.4 17.2L52.6 17.3L52.6 17.1L52.5 17.6L51.3 17.3L50.7 17.3L50.7 17L50.4 16.3L50 16.1L50.2 15.4L50.1 13.9L50.4 13.6L50.3 13.2L50.5 12.8L50.5 11.3L50.8 7L51.5 6.9L52.9 7.4L54 9L56.1 7.7L58.6 6.4L59.8 6.9L60.5 7.6L60.1 8.3L59.6 8.5L59.5 8.8L59.3 8.9L58.4 9.1L58.3 9.2L55.9 10.1L53.7 11.9L53.6 12.3L53.9 12.6L53.6 14.3ZM55.1 8.9L54.2 9.5L55.3 8.9L55.3 8.7L55.1 8.9ZM57.1 8L55.8 8.7L57.6 8L57.1 8Z" fill="white"/><path d="M70.8 9.4L71 9L71.1 9.6L71.3 9.6L71.6 8.8L71.6 8.6L71.3 8.7L71.2 8.1L71.6 7.1L71.6 6.6L71.9 6.5L74.2 6.5L75.2 7.3L75.4 7.7L75.5 8L74.6 10.8L74.1 13.7L74 13.7L73.8 14L73.6 15.2L73.8 16.5L73.7 17.1L72.3 17.3L71.6 17.5L71.1 17.5L69.9 16.7L69.9 15.5L68.4 16.4L66.2 16.7L66 16.5L64.7 16.3L63.6 15.4L63.2 14.8L62.9 13.6L63.6 9.5L64 8.7L64.2 7.7L64.4 7.3L65 7.3L65.6 7.7L66.4 8.4L66.7 9.1L65.8 13.4L66.1 14.3L66.3 14.5L67.6 14.4L68.9 13.9L69.9 13.1L70.2 12.4L70.4 12.4L71.1 11.9L71 11.7L70.4 11.7L70.9 10.8L70.4 10.6L70.9 10L70.8 9.4ZM70.9 10.3L70.7 10.4L70.8 10.5L70.9 10.3ZM71 11.5L71.2 11.4L71.5 10.7L71 11.5ZM71.2 10.2L71.2 10L71.2 10.2Z" fill="white"/><path d="M78.1 12.6L78.5 11.7L78.5 10.9L78.8 10.1L80.1 7.6L80.3 7.4L81.3 7.6L82.2 8.2L82.8 8.9L82.8 9.5L85.6 8.3L86.6 8.1L88.5 9L88.5 9.6L88.3 9.7L88.5 9.9L88.5 10.9L88.3 11.6L88 12.1L88.2 12.1L88.2 12.6L87.7 14.7L87.7 15.4L87.5 15.9L87.5 16.4L86.8 17L85.8 16.9L85.2 15.8L85.1 13.3L85.3 11.2L85.2 10.3L83.1 11.3L82.2 12.3L82 13L82 13.8L82.3 13.6L82.2 13.9L81.6 14.9L81.9 16L81.8 16.9L80.9 17.2L79.3 17L77.9 16.4L78.2 16L77.9 16L78 15.7L78.1 15.9L78.2 15.8L78.7 15.1L78.6 15L78.4 15.1L78 15L78.3 14.1L77.8 13.9L78.2 13.2L78.1 12.6ZM78.2 13.6L78.1 13.7L78.2 13.8L78.2 13.6ZM78.3 14.6L78.3 14.4L78.3 14.6ZM78.5 13.5L78.5 13.3L78.5 13.5ZM78.6 14.7L78.7 14.7L78.8 14L78.6 14.3L78.6 14.7Z" fill="white"/><path d="M5.4 2.8L5.7 2.2L5.4 2.3L5.4 2.8Z" fill="#FF6F61"/><path d="M5 4.3L5.2 3.3L4.9 4.1L5 4.3Z" fill="#FF6F61"/><path d="M15.3 9L15 8.7L14.4 8.5L14.1 8.1L14.7 8.2L15.2 8.5L15.4 8.7L15.3 9Z" fill="white"/><path d="M10.3 14.8L10.3 14.6L10.7 14.5L10.3 14.8Z" fill="white"/><path d="M19.4 1.5L17.5 .4L16.6 .3L12.6 .1L9.9 .4L7.4 .8L6.7 1.2L5.7 2.5L4.7 5.8L4.2 6.3L4.2 6.9L4 7.3L4.1 7.9L5.1 9.6L6.4 10.3L8.4 10.9L9.7 11.1L12.2 10.7L12.6 10.1L12.2 9.7L10.4 9.1L9.8 9.1L9.3 8.7L8.2 8.4L7.9 8.1L7.6 7.6L7.6 7L8 5.7L8.5 4.6L9.9 3.7L12.4 3.2L14.5 3.3L16.4 3.1L18.1 3.6L18.6 3.6L19.1 3.4L19.4 2.9L19.4 2.1L19.6 1.8L19.4 1.5ZM12.9 2.6L10.8 2.9L12.4 2.5L12.9 2.6ZM17.2 2.6L16.7 2.4L15.5 2.4L16.4 2.2L17.4 2.5L17.2 2.6Z" fill="#F9625A"/><path d="M16.1 9.2L15.8 8.7L15.2 8.1L14.2 7.6L11.4 7.2L9.3 7.2L8.7 7.7L8.8 7.9L10.4 8.6L12.3 9L12.9 9.3L13.2 9.7L13.3 11.8L11.7 13.8L11.2 14.1L9.7 14.5L3.8 14.2L1.8 13.8L.9 13.8L.4 14.1L.4 15.8L0 15.9L.2 16.1L0 16.3L3.8 17L8.4 17.3L11.5 17L13.1 16.5L13.9 15.9L16.2 13.1L16.4 11.2L16.1 9.2ZM.8 16.2L.7 15.9L1 16.1L.8 16.2ZM1.1 16.5L1.1 16.3L1.1 16.5ZM1.7 14.6L1.6 14.4L1 14.6L1.3 14.2L2 14.2L1.7 14.6ZM15.7 9.2L15.6 9.4L15.4 9.1L15.5 9L15.7 9.2Z" fill="white"/><path d="M6.2 19.1L5.8 19.1L6 19.3L5.3 19.1L6.1 19.9L5.8 19.9L9.6 22.7L13.4 25L15.4 25.9L17.5 26.5L19.7 26.9L21.8 27L23.9 26.8L26.1 26.3L28.3 25.5L30.5 24.4L32.7 22.9L34.7 21.3L34.7 21.1L33.3 22L35.3 20.3L35.1 20.4L35.3 20.2L35.3 19.7L34.9 19.9L36.1 18.8L31.9 21.7L28.2 23.5L25 24.4L23 24.7L21.1 24.8L17.7 24.5L15.6 24L13.8 23.4L11.5 22.3L8.2 20.1L8.2 20.3L6.2 19.1ZM34.3 21.5L34.1 21.6L34.3 21.5Z" fill="#F9625A"/><path d="M10.4 22.7L9.8 22.6L8.3 21.5L10.4 22.7Z" fill="white"/><path d="M26 25.9L26.8 25.7L27 25.3L26 25.9Z" fill="white"/><path d="M27.6 25.3L28.9 24.7L29.4 24.3L27.6 25.3Z" fill="white"/><path d="M10.6 23L10.8 23.2L11.1 23.2L10.6 23Z" fill="white"/><path d="M31 22.4L31.5 22.2L31 22.4Z" fill="white"/></svg>'; // the logo of the s10.run header, simplified
  const DNF = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  const DNS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const DNIN = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];
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
  const range = (a, b) => {
    if (a === b) return dayLbl(a);
    const A = d8(a), B = d8(b), dy = B.getUTCFullYear() - A.getUTCFullYear();
    if (dy > 1 || (dy === 1 && B.getUTCMonth() >= A.getUTCMonth())) return `${dayLbl(a)} ${A.getUTCFullYear()} – ${dayLbl(b)} ${B.getUTCFullYear()}`; // a year or more: months alone would repeat
    if (!dy && A.getUTCMonth() === B.getUTCMonth()) return `${A.getUTCDate()}–${B.getUTCDate()} ${MONS[B.getUTCMonth()]}`;
    return `${dayLbl(a)} – ${dayLbl(b)}`;
  };
  const wLabel = (k) => { const a = d8(k), b = d8(add(k, 6)); return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${b.getUTCDate()} ${MON[b.getUTCMonth()]}` : `${a.getUTCDate()} ${MONS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONS[b.getUTCMonth()]}`; };
  const hms = (t) => String(t || '').replace(/^0(\d):/, '$1:');
  const store = { get(k, d) { try { const v = localStorage.getItem('s10week.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('s10week.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } } };

  /* ================= load ================= */
  const me = await get('/apiweb/student/self/info/').catch(() => null);
  if (!me?.id) { // not logged in: the API answers null
    const box = document.createElement('main');
    box.style.cssText = 'font:16px/1.5 Roboto,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:48px 24px;color:#111';
    box.innerHTML = '<h1 style="font-size:24px;font-weight:500;margin:0 0 8px">Моя неделя</h1><p style="margin:0">Чтобы увидеть свою неделю и план до старта, <a href="/login" style="color:#1a4be0">войдите в S10</a>.</p>';
    document.body.appendChild(box); document.title = 'Моя неделя · S10.run';
    return 'S10 «Моя неделя»: нужен вход';
  }
  const id = new URLSearchParams(location.search).get('id') || me.id;
  const isSelf = String(id) === String(me.id); // a coach opening an athlete (?id=) gets no start window
  const [main, startParam, results, spRes, libRes, calcBase] = await Promise.all([
    get(`/apiweb/task.php?action=main&id=${id}`).catch(() => ({})),
    get(`/apiweb/userparam.php?action=get&id=${id}&param[]=studentMainStart`).catch(() => ({})),
    get(`/apiweb/planresults.php?action=list&id=${id}&limit=31`).catch(() => []),
    get(`/apiweb/userparam.php?action=get&param[]=studentPlans${id}`).catch(() => ({})),
    get('/apiweb/userparam.php?action=get&param[]=planTemplates').catch(() => ({})),
    get(`/apiweb/calc.php?id=${id}`).catch(() => null),
  ]);
  const parseList = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  let versions = parseList(spRes.param?.[`studentPlans${id}`]).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const library = parseList(libRes.param?.planTemplates).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const nameOf = (r) => { const l = r?.location || ''; return l && l === l.toUpperCase() ? l.charAt(0) + l.slice(1).toLowerCase() : l; }; // VALENCIA → Valencia, for display only
  // «Отсутствует» in the start window: no race date, the plan runs from the next S10 running week (syncRace); kept in the
  // browser and, once a plan is stored, with the active version, so other devices know it too
  let noRace = !main.main && (store.get(`noRace.${id}`, false) || !!versions.find((v) => v.active)?.student?.noRace);
  // race = the main race set on the site, or null; raceMon/raceEnd anchor the plan to dates: the race week, or without a
  // race the plan's own last week
  let race = null, raceName = '', raceMon = null, raceEnd = null;
  const setEnd = (mon) => { raceMon = mon; raceEnd = mon ? add(mon, 6) : null; };
  const setRace = (r) => { race = r; raceName = nameOf(r); setEnd(r ? monday(r.d) : null); };
  setRace(main.main || null);
  const startId = +(startParam.param?.studentMainStart || 0);
  const paceRow = results.find((r) => r.i === startId) || results.find((r) => r.prehms) || results[0] || null;
  const PACE_S10 = paceRow?.t ? Object.fromEntries(Object.entries(paceRow.t).map(([k, v]) => [k, hms(v)])) : null;
  const today = iso(new Date(((me.nowmsk || Date.now() / 1000) + 3 * 3600) * 1000)); // the site counts days in Moscow time
  // S10 plans in running weeks; calc.php gives their start days (dselect), on s10.run usually Wednesdays
  const runStart = (() => { const ds = Object.values(calcBase?.dselect || {}).map((v) => v.date).filter(Boolean).sort(); let d = ds.find((x) => x > today); if (!d && ds.length) { d = last(ds); while (d <= today) d = add(d, 7); } return d || add(today, 1); })();
  const days = new Map();
  // readiness rules (see «readiness» below); the first diary load reaches READY.days back
  const READY = { days: 42, recent: 14, done: 0.8, gap: 4, minDays: 7, w: { key: 0.35, vol: 0.25, long: 0.25, reg: 0.15 } };
  const loadedWeeks = new Set(); // Mondays of the weeks whose every diary day is in `days`
  // the diary API gives up to `limit` days with date <= last_date, newest first, and diaryTasksisMoreExist = the
  // last_date for the next page (0 when nothing older is left); so a long plan to the race takes several pages
  async function loadRange(from, to, force) {
    const mons = []; for (let m = monday(from); m <= to; m = add(m, 7)) mons.push(m);
    if (!force && mons.every((m) => loadedWeeks.has(m))) return;
    let cursor = Math.floor(d8(add(to, 1)).getTime() / 1000);
    for (let page = 0; page < 40; page++) {
      const res = await get(`/student?user_id=${id}&last_date=${cursor}&limit=60`);
      const list = res.diaryTasksInfo || [];
      for (const x of list) days.set(x.date, x);
      const oldest = list.reduce((a, x) => (x.date < a ? x.date : a), '9999');
      const more = +res.diaryTasksisMoreExist || 0;
      if (!list.length || !more || oldest <= from || more >= cursor) break;
      cursor = more;
    }
    mons.forEach((m) => loadedWeeks.add(m));
  }
  let wk = monday(today);
  const horizon = () => { const a = add(wk, 13); return raceEnd && raceEnd > a ? raceEnd : a; };
  { const h = horizon(), c = add(monday(today), 41); await loadRange(add(monday(today), -READY.days), h > c ? h : c); } // 6 weeks back (readiness), this week, every day to the race (or 6 weeks)

  /* ================= the chosen plan and the paces ================= */
  // sel: { src: 'version' | 'library' | 'new', id } ; the newly generated plan lives in memory until it is saved
  let fresh = null;
  let sel = store.get(`plan.${id}`, null);
  const findPlan = (s) => !s ? null : s.src === 'version' ? versions.find((v) => v.id === s.id) : s.src === 'library' ? library.find((v) => v.id === s.id) : s.src === 'new' ? fresh : null;
  const activeV = versions.find((v) => v.active);
  if (activeV) sel = { src: 'version', id: activeV.id }; // the plan the calendar was filled from, on any device
  if (!findPlan(sel)) sel = versions[0] ? { src: 'version', id: versions[0].id } : library[0] ? { src: 'library', id: library[0].id } : null;
  const plan = () => findPlan(sel);
  const studentPaces = (p) => p?.student?.t42 ? { 5: hms(p.student.t5), 10: hms(p.student.t10), 21: hms(p.student.t21), 42: hms(p.student.t42), ...(p.student.easy ? { easy: p.student.easy } : {}) } : null;
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
  // a saved version carries the athlete's settings: first-week volume, which day holds which workout, paces
  function applyVersion(v) {
    const L = v?.student?.layout; if (Array.isArray(L) && L.length === 7) layout = L.slice();
    const vol = +v?.student?.volume; volume = vol && vol !== +firstKmOf(v) ? vol : null;
  }
  const firstKmOf = (p) => p?.plan?.weeks?.slice().sort((a, b) => a.week - b.week)[0]?.km || 0;
  if (sel?.src === 'version') applyVersion(findPlan(sel));
  let maxrecov = 20;

  /* ================= workout text ================= */
  const PRE = /[ТT]\s*(42|21|10|5)(?:\s*([+\-−])\s*(\d+))?/g;
  const toSec = (s) => { const [m, x] = String(s).split(':').map(Number); return m * 60 + x; };
  const fmtSec = (s) => { const r = Math.round(s); return Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0'); }; // taste-skill-ignore: a pace, not a counter
  // «4:48», «4.48», «448» → seconds, or null
  const paceSec = (v) => { const m = String(v || '').trim().replace(/[.,]/g, ':').match(/^(\d{1,2}):?(\d{2})$/); return m && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  // a new athlete's paces when there are none: someone who already runs 3 times a week, 5–7 km, without a plan. 5 km in
  // 30:00 is the middle of recreational results; longer distances by Riegel (k = 1.06, the spread of S10's own forecasts),
  // rounded (owner's choice 01.11.2026): 10 km ~1:02:30, half ~2:17, marathon ~4:48. Easy runs for this level are
  // 7:00–7:30, set explicitly: the usual T42 + 55…75 s would make them 7:45–8:05
  const NEWBIE_PACES = { 5: '6:00', 10: '6:15', 21: '6:30', 42: '6:50', easy: '7:00-7:30' };
  // easy-run range in seconds: an explicit one (new athletes' paces) or T42 + 55…75 s
  const easyRange = (P) => { const e = String(P?.easy || '').split(/[-–]/).map(paceSec); return e.length === 2 && e[0] && e[1] && e[0] <= e[1] ? e : [toSec(P[42]) + 55, toSec(P[42]) + 75]; };
  // paces from a goal: the goal's own pace on its distance, the other distances by Riegel with the same k = 1.06 (S10's
  // forecast for 3:20 is 4:11/4:20/4:33/4:44, this gives 4:10/4:21/4:33/4:44), easy runs from T42 + 55…75 s for a trained
  // runner (marathon pace 4:45) to T42 + 10…40 s at 6:50 (7:00–7:30, the new athlete above), linear in between
  const level = (t42) => Math.min(1, Math.max(0, (t42 - 285) / (410 - 285))); // 0 trained … 1 new athlete
  function pacesFromGoal(km, sec) {
    // the site stores a marathon as «42», the window's list as «42.2»: both are 42.195 km
    const D = { 42: 42.195, 42.2: 42.195, 21: 21.0975, 21.1: 21.0975 }[km] || km, at = (d) => sec * (d / D) ** 1.06 / d;
    const t42 = at(42.195), L = level(t42), lo = t42 + 55 - 45 * L, hi = lo + 20 + 10 * L, r5 = (x) => Math.round(x / 5) * 5;
    return { 5: fmtSec(at(5)), 10: fmtSec(at(10)), 21: fmtSec(at(21.0975)), 42: fmtSec(t42), easy: `${fmtSec(r5(lo))}-${fmtSec(r5(hi))}` };
  }
  const hmsSec = (t) => String(t).split(':').reduce((a, x) => a * 60 + +x, 0);
  const pacesOk = (P) => !!P && [5, 10, 21, 42].every((k) => paceSec(P[k]));
  // the start window, for a new athlete only: asks for what is missing (a main race, paces) and nothing else
  const newOnb = (needRace, needPace, manual = false) => ({ race: needRace, pace: needPace, manual, d: '', dist: DISTANCES[0], name: '', goal: '', P: { ...NEWBIE_PACES }, touched: false, busy: false, err: '', focused: false });
  let onb = isSelf && ((!race && !noRace) || !pacesOk(PACE)) ? newOnb(!race && !noRace, !pacesOk(PACE)) : null;
  if (onb?.pace && race?.prediction && +race.prekm) onb.P = pacesFromGoal(+race.prekm, hmsSec(race.prediction)); // a race already set on the site
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
    // a line never ends on one short word alone ("…лёгкий" / "бег")
    const line = (p) => nb(esc(p.charAt(0).toUpperCase() + p.slice(1))).replace(/ ([^\s<>]{1,4})$/, '\u00a0$1').replace(new RegExp(`(${PACE_RX})`, 'g'), (m) => `<b>${m.replace(/\s*-\s*/, '–')}</b>`);
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

  /* ================= readiness: how the training so far supports the goal ================= */
  // stage 1 of the adaptive plan (owner, 06.11.2026), from the diary of the last 6 weeks, the last 2 counted twice:
  // key workouts (развивающая, интервальная, повторная) 35%, volume 25%, long runs 25%, regularity 15%, the parts with
  // nothing planned left out and the rest reweighted. A workout is done at 80% of its km; a pace-only task is in its
  // pace within 5 s/km. Then the S10 forecast against the goal: each 1% slower takes 5% off, at most half.
  const READY_LABEL = () => (race ? 'Готовность к цели' : 'Выполнение плана');
  function readiness() {
    const from = add(today, -READY.days), rows = [];
    for (let d = from; d < today; d = add(d, 1)) rows.push({ d, x: days.get(d) || null, k: d >= add(today, -READY.recent) ? 2 : 1 });
    if (runKm(days.get(today)) > 0) rows.push({ d: today, x: days.get(today), k: 2 }); // today counts once it is run
    const planned = rows.filter((r) => isRun(r.x));
    if (planned.length < READY.minDays) return null;
    const done = (r) => { const km = runKm(r.x), t = +r.x.target || 0; return t ? km >= READY.done * t : km > 0; };
    const share = (list) => { const all = list.reduce((a, r) => a + r.k, 0); return all ? list.filter(done).reduce((a, r) => a + r.k, 0) / all : null; };
    // key workouts, and of those done with a pace-only task, how many were in its pace
    const keys = planned.filter((r) => [2, 3, 4].includes(+r.x.type)), keyDone = keys.filter(done);
    const checked = keyDone.filter((r) => isPaceOnly(r.x.comment) && runFact(r.x)?.pace);
    const hits = checked.filter((r) => { const [lo, hi = lo] = r.x.comment.trim().split(/\s*[-–]\s*/).map(toSec), p = runFact(r.x).pace; return p >= lo - 5 && p <= hi + 5; });
    const keyShare = share(keys), key = keyShare == null ? null : keyShare * (checked.length ? 0.7 + 0.3 * hits.length / checked.length : 1);
    // volume: everything run (unplanned runs too) against everything planned, at most 100%
    const planKm = planned.reduce((a, r) => a + r.k * (+r.x.target || 0), 0), runAll = rows.reduce((a, r) => a + r.k * runKm(r.x), 0);
    const vol = planKm ? Math.min(1, runAll / planKm) : null;
    const longs = planned.filter((r) => +r.x.type === 5), long = share(longs);
    const maxRun = Math.max(0, ...rows.map((r) => runKm(r.x)));
    // regularity: the longest stretch without a run, from the first planned day in the window (a plan begun later is
    // not a break) to today
    const start = planned[0].d, ran = rows.filter((r) => r.d >= start && runKm(r.x) > 0).map((r) => r.d);
    let gap = 0, prev = add(start, -1);
    for (const d of [...ran, today]) { gap = Math.max(gap, Math.round((d8(d) - d8(prev)) / 864e5) - 1); prev = d; }
    const reg = Math.max(0, 1 - Math.max(0, gap - READY.gap) / 7);
    const parts = [
      { id: 'key', score: key, label: 'Ключевые тренировки', text: keys.length ? `${keyDone.length} из ${keys.length} выполнено${checked.length ? `, ${hits.length} из ${checked.length} в заданном темпе` : ''}` : '' },
      { id: 'vol', score: vol, label: 'Объём', text: `${n1(rows.reduce((a, r) => a + runKm(r.x), 0))} из ${n1(planned.reduce((a, r) => a + (+r.x.target || 0), 0))} км` },
      { id: 'long', score: long, label: 'Длительные', text: longs.length ? `${longs.filter(done).length} из ${longs.length}, самая длинная пробежка ${n1(maxRun)} км` : '' },
      { id: 'reg', score: reg, label: 'Регулярность', text: gap > READY.gap ? `перерыв ${gap} ${plural(gap, 'день', 'дня', 'дней')} без бега` : `перерывов больше ${READY.gap} дней не было` },
    ].filter((p) => p.score != null);
    const wsum = parts.reduce((a, p) => a + READY.w[p.id], 0);
    let pct = parts.reduce((a, p) => a + READY.w[p.id] * p.score, 0) / wsum;
    // the S10 forecast for the main race against its goal
    let fc = null;
    const fr = race && results.find((r) => r.d === race.d && +r.prehms), goal = race?.prediction ? hmsSec(race.prediction) : 0;
    if (fr && goal) { const f = Math.max(0.5, 1 - 5 * Math.max(0, (+fr.prehms - goal) / goal)); fc = { sec: +fr.prehms, goal, f }; pct *= f; }
    return { pct: Math.round(pct * 100), parts, fc, from: start };
  }
  const fmtHms = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = Math.round(s % 60); return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(x).padStart(2, '0')}`; };
  const readyLevel = (p) => (p >= 80 ? 'высокая' : p >= 60 ? 'средняя' : 'низкая');
  const readyBar = (p, cls = '') => `<div class="w-track w-ready-t ${cls}" data-l="${p >= 80 ? 3 : p >= 60 ? 2 : 1}" role="img" aria-label="${p}%"><i style="width:${p}%"></i></div>`;
  function readyCard(R) {
    const head = `<div class="w-ch"><h2 id="w-ready-h">${READY_LABEL()}</h2><span class="w-muted num">${R ? `по дневнику с ${dayLbl(R.from)}` : 'по дневнику за 6 недель'}</span></div>`;
    if (!R) return `<section class="w-card w-ready" aria-labelledby="w-ready-h">${head}<p class="w-note">Пока мало данных: нужно хотя бы ${READY.minDays} тренировок в дневнике за последние 6 недель. Шкала появится, когда наберётся.</p></section>`;
    return `<section class="w-card w-ready" aria-labelledby="w-ready-h">${head}
      <div class="w-step"><div class="w-ready-v"><b class="num">${R.pct}<small>%</small></b><span>${race ? `Цель${race.prediction ? ` ${esc(hms(race.prediction))}` : ''}${raceName ? `, ${esc(raceName)}` : ''}: готовность ${readyLevel(R.pct)}` : `Выполнение ${readyLevel(R.pct)}`}</span></div>${readyBar(R.pct)}</div>
      <ul class="w-ready-p">${R.parts.map((p) => `<li><span class="w-ready-n">${p.label}</span><span class="num w-ready-s">${Math.round(p.score * 100)}%</span>${readyBar(Math.round(p.score * 100), 'sm')}<span class="w-muted">${esc(p.text)}</span></li>`).join('')}
        ${R.fc ? `<li><span class="w-ready-n">Прогноз S10</span><span class="num w-ready-s">${R.fc.f < 1 ? `−${Math.round((1 - R.fc.f) * 100)}%` : '—'}</span><span aria-hidden="true"></span><span class="w-muted">${fmtHms(R.fc.sec)} при цели ${fmtHms(R.fc.goal)}${R.fc.f < 1 ? ', прогноз медленнее цели' : ', не медленнее цели'}</span></li>` : ''}</ul>
      <p class="w-note">Считается по вашему дневнику за последние 6 недель, последние две недели весят вдвое больше. Тренировка выполнена, если пробежано не меньше 80% её километров; темп проверяется у заданий, где задан только темп. Это оценка по правилам, а не вероятность.</p>
    </section>`;
  }

  /* ================= the plan laid over the dates ================= */
  // week −1 is the race week; week −n starts n−1 weeks before it
  const weekMon = (w) => add(raceMon, (w + 1) * 7);
  const firstKm = (p) => p?.plan?.weeks?.slice().sort((a, b) => a.week - b.week)[0]?.km || 0;
  const scaleK = (p) => { const f = firstKm(p); return volume && f ? volume / f : 1; };
  const easyText = () => (PACE ? easyRange(PACE).map(fmtSec).join('-') : 'Лёгкий бег');
  function layWeek(w, p) {
    const mon = weekMon(w.week), k = scaleK(p);
    const target = Math.round(w.km * k);
    const slots = w.slots.map((s) => ({ t: TYPE_BY_NAME[s.type] || 0, desc: s.desc, km: +s.km })).filter((s) => race || s.t !== 6); // no race: the race slot is not laid
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
    const easyIdx = roles.map((r, i) => (r === 'easy' ? i : -1)).filter((i) => i >= 0);
    const rest = Math.max(0, target - used);
    // easy runs of at least 6 km on every easy day, unless the week's volume has no room for that: then only as many
    // runs as fit (6 km each or more, at least one), spread over the easy days, so a small week is not inflated
    const nEasy = !rest || !easyIdx.length ? 0 : Math.min(easyIdx.length, Math.max(1, Math.floor(rest / 6)));
    const easyKm = nEasy ? Math.min(maxrecov, Math.round(rest / nEasy)) : 0;
    const easyOn = new Set(Array.from({ length: nEasy }, (_, j) => easyIdx[Math.floor((j + 0.5) * easyIdx.length / nEasy)]));
    roles.forEach((r, i) => {
      const d = add(mon, i), s = work[r];
      if (s) out.push({ d, typtrain: s.t, task: plain(s.desc), prekm: s.km, location: s.t === 6 ? (race?.location || '') : '', prediction: s.t === 6 ? hms(race?.prediction || '') : '' });
      else if (easyOn.has(i) && easyKm) out.push({ d, typtrain: 1, task: easyText(), prekm: easyKm, location: '', prediction: '' });
      else out.push({ d, typtrain: 0, task: 'отдых', prekm: 0, location: '', prediction: '' });
    });
    return { mon, target, total: out.reduce((a, t) => a + t.prekm, 0), days: out };
  }
  let keepExisting = true;
  let fillSpan = store.get('fillSpan', '2w'); // '2w': tomorrow + 14 days, so the athlete can adjust before the next fill; 'race': to the race
  function fillPreview(span = fillSpan) {
    const p = plan(); if (!p || !raceMon) return null;
    const weeks = p.plan.weeks.slice().sort((a, b) => a.week - b.week).map((w) => layWeek(w, p));
    const base = weeks.flatMap((w) => w.days).filter((t) => t.d > today && (!race || t.d !== race.d)); // the main race day stays as set on «Настройка плана»
    const same = (t) => { const x = days.get(t.d); return x && +x.type === +t.typtrain && +x.target === +t.prekm && String(x.comment || '').trim() === String(t.task).trim(); };
    const pick = (from, until) => {
      const all = base.filter((t) => t.d >= from && t.d <= until);
      const keep = keepExisting ? all.filter((t) => isRun(days.get(t.d))) : [];
      return { keep, write: all.filter((t) => !keep.includes(t) && !same(t)) }; // a day that already says exactly this is not sent again
    };
    if (span !== '2w') return { weeks, ...pick(add(today, 1), '9999-12-31'), span: null };
    // two running weeks: the first pair from the next running week on that still has something to write,
    // so after a fill the same button offers the next two weeks
    // without a race the weeks start with the plan itself (from tomorrow if it has begun), so a two-week plan fills whole
    const s0 = race ? runStart : (weeks[0].mon > today ? weeks[0].mon : add(today, 1)), end = raceEnd || add(s0, 13);
    for (let st = s0; st <= end; st = add(st, 7)) if (pick(st, add(st, 6)).write.length) return { weeks, ...pick(st, add(st, 13)), span: [st, add(st, 13)] };
    return { weeks, ...pick(s0, add(s0, 13)), span: [s0, add(s0, 13)] };
  }

  /* ================= colours: 20 palettes from the taste-skill library ================= */
  const PALETTES = [{"id": "s10", "name": "S10 как сейчас", "rec": false, "bg": "#f4f5f7", "surface": "#ffffff", "ink": "#14161a", "muted": "#565b66", "accent": "#2449c6", "accentInk": "#ffffff", "dark": false, "key": "#2f5d50", "keyInk": "#ffffff"}, {"id": "cool-white-slate", "name": "Иней и сланец", "rec": true, "bg": "#f7f9fa", "surface": "#ecf0f2", "ink": "#1f3038", "muted": "#5d6b72", "accent": "#0d7480", "accentInk": "#ffffff", "dark": false, "key": "#b84a32", "keyInk": "#ffffff"}, {"id": "white-link-blue", "name": "Лист, синяя и красная ручка", "rec": true, "bg": "#ffffff", "surface": "#f4f4f4", "ink": "#111111", "muted": "#595959", "accent": "#1a4be0", "accentInk": "#ffffff", "dark": false, "key": "#d62b1f", "keyInk": "#ffffff"}, {"id": "graphite-safety-orange", "name": "Графит, оранжевый, лёд", "rec": true, "bg": "#18191b", "surface": "#222427", "ink": "#eff0f1", "muted": "#9c9ea3", "accent": "#ff4a1f", "accentInk": "#18191b", "dark": true, "key": "#4cc3d9", "keyInk": "#111111"}, {"id": "cool-grey-cobalt", "name": "Серый, кобальт, киноварь", "rec": false, "bg": "#eef0f3", "surface": "#e2e5ea", "ink": "#0b0c0e", "muted": "#5d6470", "accent": "#1f2de6", "accentInk": "#ffffff", "dark": false, "key": "#c43a0a", "keyInk": "#ffffff"}, {"id": "blue-red-black", "name": "Белый, ультрасиний, жёлтый", "rec": false, "bg": "#ffffff", "surface": "#f3f3f3", "ink": "#0a0a0a", "muted": "#6b6b6b", "accent": "#2436ff", "accentInk": "#ffffff", "dark": false, "key": "#f2c200", "keyInk": "#111111", "keyData": "#2436ff"}, {"id": "stone-blueprint", "name": "Камень, чертёж, красный маркер", "rec": false, "bg": "#dfdedb", "surface": "#d3d2ce", "ink": "#26251e", "muted": "#5f5d55", "accent": "#2456d6", "accentInk": "#ffffff", "dark": false, "key": "#c8341f", "keyInk": "#ffffff"}, {"id": "mint-pink-accounts", "name": "Белый, бутылочный, розовый", "rec": false, "bg": "#f8f8f8", "surface": "#eeeeee", "ink": "#0a0a0a", "muted": "#6a6a6a", "accent": "#1f6b3a", "accentInk": "#ffffff", "dark": false, "key": "#d6336c", "keyInk": "#ffffff"}, {"id": "teal-on-paper", "name": "Бирюза и коралл на бумаге", "rec": false, "bg": "#f7f9f8", "surface": "#ebf0ee", "ink": "#06525c", "muted": "#2f737d", "accent": "#06525c", "accentInk": "#f7f9f8", "dark": false, "key": "#c2410c", "keyInk": "#ffffff"}, {"id": "three-stones", "name": "Три камня и глина", "rec": false, "bg": "#eeecea", "surface": "#e4e1dd", "ink": "#333231", "muted": "#6b6763", "accent": "#5c6b54", "accentInk": "#ffffff", "dark": false, "key": "#8a5a44", "keyInk": "#ffffff"}, {"id": "olive-on-bone", "name": "Олива и кирпич на кости", "rec": false, "bg": "#ecebe7", "surface": "#e1dfd9", "ink": "#38450f", "muted": "#5d683a", "accent": "#38450f", "accentInk": "#ecebe7", "dark": false, "key": "#b5452b", "keyInk": "#ffffff"}, {"id": "moss-sand", "name": "Песок, мох, сумерки", "rec": false, "bg": "#ddd6c6", "surface": "#d2cab8", "ink": "#2a2a26", "muted": "#59574e", "accent": "#4f6238", "accentInk": "#ffffff", "dark": false, "key": "#2f4a6d", "keyInk": "#ffffff"}, {"id": "green-mat-chocolate", "name": "Кость, зелень, шоколад", "rec": false, "bg": "#e5e1d8", "surface": "#dad5ca", "ink": "#2a1d17", "muted": "#6b5b51", "accent": "#456f3a", "accentInk": "#ffffff", "dark": false, "key": "#5a3a2a", "keyInk": "#ffffff"}, {"id": "card-pastels", "name": "Светлый, малиновый, бирюза", "rec": false, "bg": "#f7f7f5", "surface": "#ebebe8", "ink": "#000000", "muted": "#666662", "accent": "#d0106f", "accentInk": "#ffffff", "dark": false, "key": "#0f7b6c", "keyInk": "#ffffff"}, {"id": "cobalt-on-sand", "name": "Кобальт и терракота на песке", "rec": false, "bg": "#e6dbc7", "surface": "#ddd0b9", "ink": "#062b8a", "muted": "#3a5aa8", "accent": "#062b8a", "accentInk": "#e6dbc7", "dark": false, "key": "#a8321e", "keyInk": "#ffffff"}, {"id": "oxblood-grey", "name": "Бордо, серый, петроль", "rec": false, "bg": "#e2e2e2", "surface": "#d6d6d6", "ink": "#7d0c14", "muted": "#7a4a4e", "accent": "#7d0c14", "accentInk": "#e2e2e2", "dark": false, "key": "#2b4c5e", "keyInk": "#ffffff"}, {"id": "blue-black-cornflower", "name": "Ночь, васильковый, янтарь", "rec": false, "bg": "#0a0d14", "surface": "#131824", "ink": "#e9edf3", "muted": "#8891a1", "accent": "#5a9bfc", "accentInk": "#0a0d14", "dark": true, "key": "#f5b942", "keyInk": "#111111"}, {"id": "green-black-bone", "name": "Тёмно-зелёный, кость, персик", "rec": false, "bg": "#161c1a", "surface": "#1f2725", "ink": "#e3e2da", "muted": "#8e948d", "accent": "#9fc7b8", "accentInk": "#161c1a", "dark": true, "key": "#e8a87c", "keyInk": "#111111"}, {"id": "charcoal-room-sage", "name": "Уголь, шалфей, охра", "rec": false, "bg": "#1c1c1c", "surface": "#262626", "ink": "#f1f1ef", "muted": "#9a9b96", "accent": "#8fa68e", "accentInk": "#1c1c1c", "dark": true, "key": "#d9a96a", "keyInk": "#111111"}, {"id": "warm-black-gold", "name": "Чёрный, золото, терракота", "rec": false, "bg": "#0c0a08", "surface": "#181512", "ink": "#ffffff", "muted": "#8f8a84", "accent": "#c9a45a", "accentInk": "#0c0a08", "dark": true, "key": "#d9765f", "keyInk": "#111111"}];
  // palette chosen 31.10.2026: №3 «Лист, синяя и красная ручка». ?colors brings the picker back.
  const DEFAULT_PAL = 'white-link-blue';
  const SHOW_COLORS = new URLSearchParams(location.search).has('colors');
  let palId = SHOW_COLORS ? store.get('palette', DEFAULT_PAL) : DEFAULT_PAL, colorsOpen = false;
  function applyPalette() {
    const P = PALETTES.find((x) => x.id === palId) || PALETTES.find((x) => x.id === DEFAULT_PAL);
    const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    const mix = (a, pct, b) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, k) => Math.round((v * pct + B[k] * (100 - pct)) / 100).toString(16).padStart(2, '0')).join(''); }; // = color-mix(in srgb, a pct%, b), works in every browser
    const card = P.id === 's10' ? '#ffffff' : P.dark ? P.surface : (P.bg.toLowerCase() === '#ffffff' ? '#ffffff' : mix(P.bg, 30, '#ffffff'));
    const ground = P.id === 's10' ? P.bg : P.dark ? P.bg : (P.bg.toLowerCase() === '#ffffff' ? P.surface : P.bg);
    const v = {
      '--ground': ground, '--surface': card, '--field': P.dark ? mix(P.ink, 6, card) : '#ffffff', '--soft': mix(P.ink, 3, card),
      '--border': mix(P.ink, 13, card), '--rule': mix(P.ink, 7, card), '--control': mix(P.ink, 24, card),
      '--text': P.ink, '--muted': P.muted, '--faint': P.muted, '--accent': P.accent, '--accent-bg': mix(P.accent, P.dark ? 22 : 12, card), '--accent-soft': mix(P.accent, P.dark ? 10 : 5, card),
      '--glyph-off': mix(P.ink, 16, card), '--primary': P.key, '--primary-ink': P.keyInk, '--primary-hover': mix(P.key, 86, P.dark ? '#ffffff' : '#000000'), '--key': P.keyData || P.key,
      '--ok-bg': P.dark ? mix('#3fc07a', 20, card) : '#dcfae5', '--ok': P.dark ? '#86e3ae' : '#04250e',
      '--bad-bg': P.dark ? mix('#e5566f', 22, card) : '#ffedea', '--bad': P.dark ? '#ff9aa9' : '#831c1e',
      '--cell': mix(P.ink, 4, card), '--cell-hover': mix(P.ink, 8, card), '--key-bg': mix(P.keyData || P.key, 10, card), '--key-line': mix(P.keyData || P.key, 45, card),
      '--neutral-bg': mix(P.ink, 9, card), '--neutral': P.ink, '--warn-bg': P.dark ? mix('#d9a441', 16, card) : '#fffbeb',
    };
    for (const [k, val] of Object.entries(v)) root.style.setProperty(k, val);
    root.style.colorScheme = P.dark ? 'dark' : 'light';
    document.documentElement.style.background = ground;
  }
  function colorsPanel() {
    const cur = PALETTES.find((x) => x.id === palId) || PALETTES[0];
    return `<section class="w-card w-colors" aria-labelledby="w-col-h">
      <div class="w-ch"><h2 id="w-col-h">Цвета страницы</h2><span class="w-muted">Сейчас: ${esc(cur.name)}. В каждой палитре три цвета: фон, акцент (вкладки, сегодня, ссылки) и третий цвет (главные кнопки и полоски нагрузки). «Совет» — мои фавориты.</span><button class="w-btn sm" data-act="colors">Готово</button></div>
      <ul class="w-pals">${PALETTES.map((x, i) => `<li><button class="w-pal ${x.id === palId ? 'on' : ''}" data-act="pal" data-id="${x.id}" aria-pressed="${x.id === palId}">
        <span class="w-pal-prev" style="background:${x.bg}" aria-hidden="true"><i style="background:${x.dark ? x.surface : '#ffffff'}"><b style="background:${x.ink}"></b><b style="background:${x.muted};width:60%"></b><em style="background:${x.accent}"></em><em class="k" style="background:${x.key}"></em></i></span>
        <span class="w-pal-n"><span class="num">${i + 1}.</span> ${esc(x.name)}</span>${x.rec ? '<span class="w-pill now w-rec">совет</span>' : ''}<small>${x.dark ? 'тёмная' : 'светлая'}${x.id === 's10' ? ', фирменная' : ''}</small></button></li>`).join('')}</ul>
    </section>`;
  }

  /* ================= state of the panels ================= */
  let mode = 'view', PL = null, flash = '', shownFlash = '';
  let tab = store.get('tab', 'week');
  let chooser = !plan(), chooserTab = versions.length ? 'version' : library.length ? 'library' : 'new';
  // the master plan's length: the weeks to the race, or two weeks without one
  const weeksTo = (mon) => Math.max(1, Math.min(30, Math.round((d8(mon) - d8(monday(add(today, 1)))) / 6048e5) + 1));
  let gen = { distance: plan()?.distance || DISTANCES[0], weeks: race ? weeksTo(raceMon) : 2, prompt: '', touched: false, busy: false, lines: 0, err: '' };
  // the «о себе и цели» box starts filled: the race and its goal when there is one, or «заполни как есть, там
  // посмотрим»; once the athlete types in it, the text is theirs and is not replaced
  const KM_NAME = { 42: 'Марафон', 42.2: 'Марафон', 21: 'Полумарафон', 21.1: 'Полумарафон' };
  const promptDefault = () => {
    if (!race) return 'заполни как есть, там посмотрим';
    const km = +race.prekm, g = race.prediction ? hms(race.prediction).replace(/^0?0:/, '') : '';
    return `${KM_NAME[km] || `${n1(km)} км`} ${dayLbl(race.d)}${raceName ? `, ${raceName}` : ''}${g ? `, цель ${g}` : ''}.`.replace(/\u00a0/g, ' '); // plain spaces in a text for the model
  };
  gen.prompt = promptDefault();
  // the box takes the focus with its text selected, so typing replaces the filled-in words
  const focusAsk = () => { const t = root.querySelector('textarea[data-g=prompt]'); if (!t) return; t.focus(); if (!gen.touched) t.select(); };
  let fill = { confirm: false, busy: false, err: '', progress: '' };
  let undo = { confirm: false, where: 'card', busy: false, err: '', progress: '' }, flashUndo = '';
  // «Вернуть как было»: before a fill the page keeps what stood in those days; the record lives with the active plan in
  // the profile (and in the browser as a fallback). Each day: [date, before: type, km, text, place, forecast (type null =
  // the day was empty), after: type, km, text hash] — a day changed after the fill is left alone.
  const fp = (t) => { let h = 5381; for (const c of String(t || '').trim()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
  const lastUndo = () => versions.find((v) => v.active)?.undo || store.get(`undo.${id}`, null);
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
      PL = { base, tt, dsels, dsel: String(base.dselected || last(dsels)?.k || 1), rows: null, pre: [], sum: null, busy: false, err: '' };
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
    fd.append('tasks', JSON.stringify(list.map((r) => ({ d: r.d, task: r.task, prekm: String(r.prekm), typtrain: r.typtrain, main6: race && r.d === race.d && +r.typtrain === 6 ? 1 : 0, location: r.location || null, prediction: r.prediction || null }))));
    await post(`/apiweb/task.php?id=${id}&action=update`, fd);
  }
  async function saveWeek() {
    const bad = PL.rows.filter((r) => r.typtrain === 6 && !(r.location.trim() && r.prediction.trim()));
    if (bad.length) { PL.err = `Для соревнования укажите место и прогноз: ${bad.map((r) => dayLbl(r.d)).join(', ')}.`; bad.forEach((r) => { r.edit = true; }); return render(); }
    if (!me.isPremium) { PL.err = 'Ставить задачи можно с премиум-подпиской S10.'; return render(); }
    PL.busy = true; PL.err = ''; render();
    try {
      await writeTasks(PL.rows);
      const first = PL.rows[0].d, lastD = last(PL.rows).d, n = PL.rows.length;
      await loadRange(first, lastD, true).catch(() => {});
      mode = 'view'; wk = monday(first); PL = null;
      flash = `${'Задачи поставлены'}: ${n} ${plural(n, 'день', 'дня', 'дней')}, ${range(first, lastD)}.`;
    } catch (e) { PL.busy = false; PL.err = `Сервер не принял задачи (${e.message}). В дневнике ничего не изменилось.`; }
    render();
  }

  /* ================= whole plan: fill, save version, generate ================= */
  async function fillCalendar() {
    if (!me.isPremium) { fill.err = 'Ставить задачи можно с премиум-подпиской S10.'; return render(); }
    fill.busy = true; fill.err = ''; fill.progress = 'Проверяю дневник…'; render();
    try { await loadRange(add(today, 1), raceEnd || add(today, 1)); } catch { /* the preview below still uses what is loaded */ }
    const f = fillPreview(); if (!f || !f.write.length) { fill = { confirm: false, busy: false, err: '', progress: '' }; return render(); }
    fill.snap = f.write.slice();
    const before = f.write.map((t) => { const x = days.get(t.d); return [t.d, x ? +x.type || 0 : null, x ? +x.target || 0 : 0, x?.comment || '', x?.location || '', x?.prediction || '', +t.typtrain, +t.prekm, fp(t.task)]; });
    const prevFilled = sel.src === 'version' ? plan()?.filled || null : null;
    const weeks = []; for (const t of f.write) { const g = last(weeks); if (g && g.mon === monday(t.d)) g.list.push(t); else weeks.push({ mon: monday(t.d), list: [t] }); }
    let done = 0, upto = null, error = null;
    for (let i = 0; i < weeks.length; i++) {
      fill.progress = `Записываю неделю ${i + 1} из ${weeks.length}…`; render();
      try { await writeTasks(weeks[i].list); done += weeks[i].list.length; upto = last(weeks[i].list).d; } catch (e) { error = e; break; }
    }
    await loadRange(f.write[0].d, last(f.write).d, true).catch(() => {});
    const a = f.write[0].d, b = last(f.write).d, n = f.write.length;
    const rec = done ? { at: new Date().toISOString(), prevFilled, days: before.slice(0, done) } : null;
    if (rec) store.set(`undo.${id}`, rec);
    if (error) {
      if (done) await storePlan({ filled: { from: a, to: upto }, undo: rec }).catch(() => {}); // what did get written is still linked to the plan
      fill = { confirm: false, busy: false, progress: '', err: done
        ? `Записано ${done} ${plural(done, 'день', 'дня', 'дней')} из ${n}, по ${dayLbl(upto)}. Дальше сервер не принял задачи (${error.message}). Нажмите «Заполнить календарь» ещё раз, чтобы дописать остальное.`
        : `Сервер не принял задачи (${error.message}). В дневнике ничего не изменилось.` };
      return render();
    }
    fill.progress = 'Сохраняю план в профиль…'; render();
    let saved = true; try { await storePlan({ filled: { from: a, to: b }, undo: rec }); } catch { saved = false; }
    fill = { confirm: false, busy: false, err: '', progress: '' };
    flash = `${'Календарь заполнен'}: ${n} ${plural(n, 'день', 'дня', 'дней')}, ${range(a, b)}.${saved ? ' План и настройки сохранены в профиле.' : ' План в профиль сохранить не удалось, задачи при этом записаны.'}`;
    flashUndo = flash;
    wk = monday(a);
    render();
  }
  // writes the chosen plan with the current settings to the profile and marks it active; re-reads the list first,
  // so a version the coach saved meanwhile in calc5 is kept
  async function storePlan({ asNew = false, filled = null, undo: undoRec } = {}) {
    const p = plan(); if (!p) return null;
    let list = versions;
    try { const r = await get(`/apiweb/userparam.php?action=get&param[]=studentPlans${id}`); list = parseList(r.param?.[`studentPlans${id}`]); } catch { /* keep what we have */ }
    const first = p.plan.weeks.slice().sort((a, b) => a.week - b.week)[0];
    const keepId = !asNew && sel.src === 'version' ? p.id : null, old = keepId ? list.find((v) => v.id === keepId) : null;
    const f0 = old?.filled, f = filled ? { at: new Date().toISOString(), from: f0?.from && f0.from < filled.from ? f0.from : filled.from, to: f0?.to && f0.to > filled.to ? f0.to : filled.to } : f0 || null;
    const v = {
      ...(old || {}), id: keepId || Math.random().toString(36).slice(2, 16),
      name: old?.name || `${(p.name || 'План').replace(/ · \d+ нед\.$/, '')} · ${p.plan.weeks.length} нед.`, savedAt: new Date().toISOString(),
      templateId: old?.templateId || (sel.src === 'library' ? p.id : p.templateId || null), distance: p.distance || null, plan: { weeks: p.plan.weeks },
      student: { ...(old?.student || {}), raceDate: race?.d || null, noRace: !race && noRace ? true : undefined, planStart: weekMon(first.week), t5: PACE?.[5], t10: PACE?.[10], t21: PACE?.[21], t42: PACE?.[42], easy: PACE?.easy, volume: String(volume || firstKm(p)), layout: layout.slice() },
      active: true, filled: f, undo: undoRec === undefined ? old?.undo || null : undoRec,
    };
    const next = [v, ...list.filter((x) => x.id !== v.id).map((x) => { const { active, ...rest } = x; return rest; })];
    const fd = new FormData(); fd.append('action', 'set'); fd.append('id', id); fd.append(`param[studentPlans${id}]`, JSON.stringify(next));
    await post('/apiweb/userparam.php', fd);
    versions = next.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))); sel = { src: 'version', id: v.id }; persistSel(); fresh = null;
    return v;
  }
  // changes one saved version in the profile (re-read first), e.g. to drop the undo record after «Вернуть как было»
  async function patchVersion(vid, patch) {
    let list = versions;
    try { const r = await get(`/apiweb/userparam.php?action=get&param[]=studentPlans${id}`); list = parseList(r.param?.[`studentPlans${id}`]); } catch { /* keep what we have */ }
    const next = list.map((v) => (v.id === vid ? { ...v, ...patch } : v));
    const fd = new FormData(); fd.append('action', 'set'); fd.append('id', id); fd.append(`param[studentPlans${id}]`, JSON.stringify(next));
    await post('/apiweb/userparam.php', fd);
    versions = next.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }
  async function undoFill() {
    const u = lastUndo(); if (!u?.days?.length) return;
    if (!me.isPremium) { undo.err = 'Ставить задачи можно с премиум-подпиской S10.'; return render(); }
    undo.busy = true; undo.err = ''; undo.progress = 'Проверяю дневник…'; render();
    const ds = u.days.map((r) => r[0]).sort();
    await loadRange(ds[0], last(ds), true).catch(() => {});
    const back = [], changed = [];
    for (const [d, wt, wk, wc, wl, wp, nt, nk, nf] of u.days) {
      const x = days.get(d);
      if (!(x && +x.type === nt && +x.target === nk && fp(x.comment) === nf)) { changed.push(d); continue; } // changed after the fill: not ours to touch
      back.push(wt === null ? { d, typtrain: 0, task: '', prekm: 0, location: '', prediction: '' } : { d, typtrain: wt, task: wc, prekm: wk, location: wl, prediction: wp });
    }
    const weeks = []; for (const t of back) { const g = last(weeks); if (g && g.mon === monday(t.d)) g.list.push(t); else weeks.push({ mon: monday(t.d), list: [t] }); }
    let done = 0, error = null;
    for (let i = 0; i < weeks.length; i++) {
      undo.progress = `Возвращаю неделю ${i + 1} из ${weeks.length}…`; render();
      try { await writeTasks(weeks[i].list); done += weeks[i].list.length; } catch (e) { error = e; break; }
    }
    await loadRange(ds[0], last(ds), true).catch(() => {});
    const keptNote = changed.length ? ` ${changed.length} ${plural(changed.length, 'день', 'дня', 'дней')} поменяли после заполнения, ${changed.length === 1 ? 'его' : 'их'} не трогали.` : '';
    if (error) {
      undo = { confirm: false, where: 'card', busy: false, progress: '', err: `Вернули ${done} из ${back.length} ${plural(back.length, 'дня', 'дней', 'дней')}, дальше сервер не принял задачи (${error.message}). Нажмите «Вернуть как было» ещё раз.` };
      return render();
    }
    store.set(`undo.${id}`, null);
    const v = versions.find((x) => x.active && x.undo);
    if (v) await patchVersion(v.id, { undo: null, filled: u.prevFilled || null }).catch(() => {});
    undo = { confirm: false, where: 'card', busy: false, err: '', progress: '' };
    flash = `${'Календарь вернули как было'}: ${back.length} ${plural(back.length, 'день', 'дня', 'дней')}, ${range(ds[0], last(ds))}.${keptNote}`; flashUndo = '';
    wk = monday(ds[0]);
    render();
  }
  const undoHTML = (where) => {
    const u = lastUndo(); if (!undo.confirm || undo.where !== where || !u?.days?.length) return '';
    const ds = u.days.map((r) => r[0]).sort(), n = ds.length;
    return `<div class="w-confirm" role="alertdialog" aria-labelledby="w-un-h"><p id="w-un-h"><b>Вернуть ${n} ${plural(n, 'день', 'дня', 'дней')} как было до заполнения?</b> ${range(ds[0], last(ds))}. Дни, которые вы или тренер поменяли после заполнения, останутся как есть.</p><div class="w-acts"><button class="w-btn" data-act="undono">Отмена</button><button class="w-btn primary" data-act="undoyes" ${undo.busy ? 'disabled' : ''}>${undo.busy ? esc(undo.progress || 'Возвращаю…') : 'Вернуть'}</button></div></div>`;
  };
  async function saveVersion() {
    try { const v = await storePlan({ asNew: true }); if (v) flash = `Версия «${v.name}» сохранена в вашем профиле. Её видно и на странице «План ученика».`; }
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

  /* ================= markup ================= */
  const typeSelect = (v, attrs) => `<select ${attrs}>${[1, 2, 3, 4, 5, 6, 0].map((t) => `<option value="${t}" ${+v === t ? 'selected' : ''}>${t ? TYPES[t] : 'Отдых'}</option>`).join('')}</select>`;
  const kmField = (v, attrs) => `<label class="w-kmf"><input ${attrs} class="num" inputmode="decimal" value="${v || 0}"> км</label>`;
  const ROLE = { easy: 'Лёгкая', rest: 'Отдых', w1: 'Работа 1', w2: 'Работа 2', long: 'Длительная' };

  function chooserHTML() {
    const rows = (list, src) => list.length ? `<ul class="w-plans">${list.map((p) => {
      const on = sel && sel.src === src && sel.id === p.id, n = p.plan?.weeks?.length || 0, peak = Math.max(...(p.plan?.weeks || []).map((w) => +w.km || 0));
      return `<li class="${on ? 'on' : ''}"><div class="w-pl"><b>${esc(p.name || 'Без названия')}</b><span class="w-muted num">${esc((p.distance || '').split(' · ')[0])}${p.distance ? ' · ' : ''}${n} ${plural(n, 'неделя', 'недели', 'недель')} · пик ${n1(peak)} км · ${p.savedAt ? `сохранён ${dayLbl(String(p.savedAt).slice(0, 10))}` : ''}${p.student?.t42 ? ` · свои темпа, T42 ${hms(p.student.t42)}` : ''}${p.filled?.to ? ` · в календаре по ${dayLbl(p.filled.to)}` : ''}</span></div>${on ? '<span class="w-pill neutral">Выбран</span>' : `<button class="w-btn sm" data-act="psel" data-src="${src}" data-id="${esc(p.id)}">Выбрать</button>`}</li>`;
    }).join('')}</ul>` : `<p class="w-note">${src === 'version' ? 'Сохранённых версий пока нет. Их сохраняет тренер на странице «План ученика» или вы сами кнопкой «Сохранить версию». Можно сделать новый план по описанию.' : 'В библиотеке пока пусто.'}</p>`;
    return `<div class="w-chooser">
      <div class="w-tabs" role="tablist" aria-label="Откуда взять план">
        ${[['version', `Мои версии (${versions.length})`], library.length ? ['library', `Библиотека (${library.length})`] : null, ['new', 'Новый по описанию']].filter(Boolean).map(([k, l]) => `<button role="tab" aria-selected="${chooserTab === k}" tabindex="${chooserTab === k ? 0 : -1}" data-act="ptab" data-k="${k}">${l}</button>`).join('')}
      </div>
      ${chooserTab === 'version' ? rows(versions, 'version') : chooserTab === 'library' ? rows(library, 'library') : `
        <div class="w-gen">
          <label class="w-f w-f-wide w-ask"><span>Расскажите о себе и цели</span><textarea data-g="prompt" rows="3" aria-describedby="w-ask-hint" placeholder="Марафон 6 декабря на 3:20. 5 км 18:59, полумарафон 1:38. Сейчас ~40 км в неделю, 6 тренировок, четверг отдых, среда стадион, воскресенье длительная.">${esc(gen.prompt)}</textarea><small id="w-ask-hint">Сколько бегаете сейчас и как часто, лучшие результаты, какие дни свободны. По этому описанию модель составит план.</small></label>
          <label class="w-f"><span>Дистанция</span><select data-g="distance">${DISTANCES.map((d) => `<option ${d === gen.distance ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="w-f w-f-s"><span>Недель</span><input data-g="weeks" class="num" inputmode="numeric" value="${gen.weeks}"></label>
          <div class="w-go"><button class="w-btn primary" data-act="gen" ${gen.busy ? 'disabled' : ''}>${gen.busy ? 'Генерирую…' : 'Сгенерировать план'}</button><span class="w-muted" id="w-gen-status">${gen.busy ? 'Модель думает…' : `${gen.weeks} ${plural(gen.weeks, 'неделя', 'недели', 'недель')}${race ? ' до старта' : ''}. Генерация занимает до минуты.`}</span></div>
          ${gen.err ? `<p class="w-err" role="alert">${esc(gen.err)}</p>` : ''}
        </div>`}
    </div>`;
  }
  // the fill block's mode-dependent text: both modes drawn in one grid cell, the inactive one hidden, so the block is as
  // tall as the taller mode with any font and width and the buttons below never move when the mode is switched
  const SPANS = { '2w': '2 беговые недели', race: 'До старта' };
  const spanLabel = (k) => (k === 'race' && !race ? 'Весь план' : SPANS[k]);
  function fillModes(f) {
    const other = fillSpan === '2w' ? 'race' : '2w', F = { [fillSpan]: f, [other]: fillPreview(other) };
    const off = (k) => (k === fillSpan ? '' : ' aria-hidden="true"');
    const body = (k) => {
      const g = F[k], hint = k === '2w' ? [race ? `Беговая неделя в S10 начинается ${DNIN[dow(g.span ? g.span[0] : runStart)]}.` : `Две недели плана с ${dayLbl(g.span[0])}.`, 'Поправьте задачи, а следующие две недели допишите этой же кнопкой.'] : [!race ? 'Все оставшиеся недели плана сразу.' : 'Все оставшиеся недели плана сразу, до старта.', 'Поправить отдельные задачи можно потом в календаре S10.'];
      return `<div class="w-modev"${off(k)}><span class="w-lb">Запишется в дневник</span><b class="num">${g.write.length} ${plural(g.write.length, 'день', 'дня', 'дней')}</b><span class="w-muted num">${g.write.length ? `${range(g.write[0].d, last(g.write).d)}, всего ${n1(g.write.reduce((a, t) => a + t.prekm, 0))} км` : 'все дни плана уже прошли или заняты'}</span><span class="w-muted w-hint">${hint.map((x) => `<span>${x}</span>`).join('')}</span></div>`;
    };
    const count = (k) => `<span${off(k)}>${F[k].keep.length ? `(${F[k].keep.length})` : ''}</span>`;
    const modes = Object.keys(SPANS);
    return `<div class="w-modes">${modes.map(body).join('')}</div>
          <label class="w-chk"><input type="checkbox" data-p="keep" ${keepExisting ? 'checked' : ''}> <span>Не трогать дни, где задача уже стоит <span class="w-modes w-chk-n">${modes.map(count).join('')}</span></span></label>`;
  }
  function planCard() {
    const p = plan();
    const head = `<div class="w-ch"><h2 id="w-plan2-h">${p ? `Мастер-план «${esc(p.name || 'Без названия')}»` : 'Мастер-план'}</h2>${!race && raceEnd ? `<span class="w-muted num">без старта, по ${dayLbl(raceEnd)}</span>` : race ? `<span class="w-muted num">старт${raceName ? ` ${esc(raceName)}` : ''}, ${dayLbl(race.d)}</span>` : ''}${p ? `<button class="w-btn sm" data-act="pchoose" aria-expanded="${chooser}">${chooser ? 'Свернуть выбор' : 'Сменить план'}</button>` : ''}</div>`;
    if (!race && !noRace) return `<section class="w-card" aria-labelledby="w-plan2-h">${head}<p class="w-note">Главный старт не выбран. ${isSelf ? '<button class="w-link" data-act="onbopen">Укажите его здесь</button> или на' : 'Выберите его на'} странице <a href="${''}/calc3?id=${id}">«Настройка плана»</a>, и план ляжет на даты до него.</p></section>`;
    if (!p) return `<section class="w-card" aria-labelledby="w-plan2-h">${head}<p class="w-note">План ещё не выбран. Возьмите версию, которую сохранил тренер, или сделайте новый по описанию: это займёт около минуты.</p>${chooserHTML()}</section>`;
    const f = fillPreview(), src = sel.src === 'version' ? (p.active ? `в вашем профиле${p.filled?.to ? `, в календаре по ${dayLbl(p.filled.to)}` : ''}` : 'ваша версия') : sel.src === 'library' ? 'из библиотеки' : 'новый, не сохранён';
    const ws = f.weeks, first = ws[0], lastW = last(ws);
    const curMon = monday(today);
    return `<section class="w-card" aria-labelledby="w-plan2-h">${head}
      ${chooser ? chooserHTML() : ''}
      <div class="w-step">
        <div class="w-pmeta"><span class="w-muted num">${src} · ${ws.length} ${plural(ws.length, 'неделя', 'недели', 'недель')} · ${range(first.mon, add(lastW.mon, 6))} · темпа ${esc(paceLabel())}</span></div>
        <div class="w-pset">
          <label class="w-f w-f-s"><span>Объём первой недели</span><span class="w-inl"><input data-p="volume" class="num" inputmode="numeric" value="${volume || firstKm(p)}"> км</span></label>
          <div class="w-f w-f-wide"><span>Дни недели</span><div class="w-roles">${layout.map((r, i) => `<label class="w-role"><small>${DN[i]}</small><select data-p="role" data-i="${i}" aria-label="${DNF[i]}">${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${r === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div></div>
        </div>
      </div>
      <ol class="w-weeks">${ws.map((w, n) => {
        const src2 = p.plan.weeks.slice().sort((a, b) => a.week - b.week)[n];
        const past = add(w.mon, 6) < today, now = w.mon === curMon, isOpen = openWeek === src2.week || (openWeek == null && now);
        const works = w.days.filter((d) => d.typtrain >= 2);
        return `<li class="w-wk ${past ? 'past' : ''} ${now ? 'now' : ''}">
          <button class="w-wkh" data-act="wopen" data-w="${src2.week}" aria-expanded="${isOpen}">
            <span class="num w-wn">${src2.week}</span><span class="num">${range(w.mon, add(w.mon, 6))}</span><span class="w-per">${esc(src2.period || '')}</span>
            <span class="w-wworks">${works.map((d) => `<span>${glyph(LEVEL[d.typtrain], d.typtrain === 6)}${SHORT[d.typtrain]} ${n1(d.prekm)}</span>`).join('')}</span>
            <span class="num w-wkm">${n1(w.total)} км</span>${past ? '<span class="w-pill neutral">Прошла</span>' : now ? '<span class="w-pill now">Сейчас</span>' : '<span class="w-pill-sp"></span>'}
          </button>
          ${isOpen ? `<ol class="w-wdays">${w.days.map((d) => { const ex = days.get(d.d); const isMain = !!race && d.d === race.d; const keep = !isMain && keepExisting && d.d > today && isRun(ex);
            return `<li class="${d.d <= today ? 'gone' : ''}"><span class="w-wdd"><b>${DN[dow(d.d)]}</b><small class="num">${dayLbl(d.d)}</small></span>
              <div class="w-wdb"><span class="w-name ${d.typtrain ? '' : 'w-muted'}">${d.typtrain ? glyph(LEVEL[d.typtrain], d.typtrain === 6) + TYPES[d.typtrain] : 'Отдых'}</span>${d.typtrain ? taskHTML(d.task) : ''}${keep ? `<span class="w-muted">В дневнике уже стоит: ${esc(TYPES[ex.type] || 'тренировка').toLowerCase()} ${n1(+ex.target || 0)} км, её не трогаем</span>` : ''}${isMain ? '<span class="w-muted">Главный старт: он уже в дневнике, страница его не меняет</span>' : ''}</div>
              <span class="num w-wdk">${d.prekm ? `${n1(d.prekm)} км` : ''}</span></li>`; }).join('')}</ol>` : ''}
        </li>`;
      }).join('')}</ol>
      <div class="w-sum">
        <div><div class="w-seg w-span" role="radiogroup" aria-label="На сколько заполнить">${Object.keys(SPANS).map((k) => [k, spanLabel(k)]).map(([k, l]) => `<button role="radio" aria-checked="${fillSpan === k}" data-act="span" data-k="${k}">${l}</button>`).join('')}</div>
          ${fillModes(f)}
          ${(() => { const u = lastUndo(); if (!u?.days?.length) return ''; const ds = u.days.map((r) => r[0]).sort(); return `<span class="w-undo">Последнее заполнение: ${range(ds[0], last(ds))} · <button class="w-link" data-act="undoask" data-where="card">Вернуть как было</button></span>`; })()}</div>
        <div class="w-acts"><button class="w-btn" data-act="pversion">Сохранить версию</button><button class="w-btn primary" data-act="fillask" ${f.write.length && !fill.busy && me.isPremium && pacesOk(PACE) ? '' : 'disabled'}>Заполнить календарь</button></div>
        ${pacesOk(PACE) ? '' : '<p class="w-note w-prem">Задайте темпа на вкладке «Мои темпа»: без них в задания встанут T5…T42 вместо минут на километр.</p>'}
        ${me.isPremium ? '' : '<p class="w-note w-prem">Записывать задачи в календарь можно с премиум-подпиской S10, как на странице «Настройка плана».</p>'}
      </div>
      ${fill.confirm && (fill.snap || f.write.length) ? `<div class="w-confirm" role="alertdialog" aria-labelledby="w-cf-h"><p id="w-cf-h"><b>Записать ${(fill.snap || f.write).length} ${plural((fill.snap || f.write).length, 'день', 'дня', 'дней')} в дневник?</b> ${range((fill.snap || f.write)[0].d, last(fill.snap || f.write).d)}. ${keepExisting ? 'Дни, где задача уже стоит, останутся как есть.' : 'Задачи, которые уже стоят в эти дни, заменятся.'} План и настройки сохранятся в вашем профиле.</p><div class="w-acts"><button class="w-btn" data-act="fillno">Отмена</button><button class="w-btn primary" data-act="fillyes" ${fill.busy ? 'disabled' : ''}>${fill.busy ? esc(fill.progress || 'Записываю…') : 'Записать'}</button></div></div>` : ''}
      ${fill.err ? `<p class="w-note w-err" role="alert">${esc(fill.err)}</p>` : ''}
      ${undoHTML('card')}${undo.err ? `<p class="w-note w-err" role="alert">${esc(undo.err)}</p>` : ''}
    </section>`;
  }
  function pacesCard() {
    const P = PACE;
    const opts = [studentPaces(plan()) ? ['plan', `Из плана «${plan().name}»`] : null, PACE_S10 ? ['s10', `Прогноз S10${race?.prediction ? `, ${raceName} ${hms(race.prediction)}` : ''}`] : null, ['own', 'Свои']].filter(Boolean);
    const cur = (paceSrc === 'own' && PACE_OWN) ? 'own' : (paceSrc === 's10' && PACE_S10) ? 's10' : studentPaces(plan()) ? 'plan' : PACE_S10 ? 's10' : 'own';
    return `<section class="w-card" aria-labelledby="w-pace-h">
      <div class="w-ch"><h2 id="w-pace-h">Темпа для заданий, мин/км</h2><label class="w-inl w-muted">Откуда <select data-p="pacesrc" aria-label="Откуда брать темпа">${opts.map(([k, l]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
      <div class="w-paces num">${[['5', 'темп на 5 км'], ['10', 'темп на 10 км'], ['21', 'полумарафон'], ['42', 'марафон']].map(([k, l]) => `<label><span><b>T${k}</b><small>${l}</small></span><input data-p="pace" data-k="${k}" value="${P?.[k] || ''}" inputmode="numeric" aria-label="T${k}, мин/км" placeholder="4:30"></label>`).join('')}</div>
      ${paceTable(P)}
      <p class="w-note">Все задания на странице считаются по этим темпам: «T21+8» — это ваш T21 плюс 8 секунд. Если поменять цифру, темпа станут «своими» и сохранятся на этом устройстве.</p>
    </section>`;
  }
  function paceTable(P) {
    if (!P?.[42]) return '';
    const easy = easyRange(P);
    const rows = [['Лёгкий бег', easy], ['T42', [toSec(P[42])], 'марафон'], ['T21', [toSec(P[21])], 'полумарафон'], ['T10', [toSec(P[10])], '10 км'], ['T5', [toSec(P[5])], '5 км']];
    const cell = (r, m) => (r.length > 1 && m < 1000 ? '<span class="w-muted">—</span>' : r.map((v) => fmtSec(v * m / 1000)).join('–')); // easy runs are not timed on the track
    return `<div class="w-ptab-wrap"><table class="w-ptab num"><caption>Время на отрезок</caption>
      <thead><tr><th scope="col">Зона</th><th scope="col">1 км</th><th scope="col">400 м</th></tr></thead>
      <tbody>${rows.map(([n, r, sub]) => `<tr><th scope="row"><b>${n}</b>${sub ? `<small>${sub}</small>` : ''}</th><td>${cell(r, 1000)}</td><td>${cell(r, 400)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }
  function workCard(w, i) {
    const groups = [...new Set(PL.opts.map((o) => o.group))];
    const s = PL.opts.findIndex((o) => o.txt === w.txt && o.km === w.km);
    return `<div class="w-work">
      <div class="w-wh"><span class="w-name">${glyph(LEVEL[w.t] || 1)}Работа ${i + 1}: ${w.txt ? TYPES[w.t] : 'не выбрана'}</span>${w.txt ? `<span class="num">${n1(w.km)} км</span>` : ''}</div>
      ${w.txt ? taskHTML(w.txt) : '<p class="w-tx w-muted">Выберите работу из плана или шаблонов.</p>'}
      <div class="w-wa">
        <select data-w="${i}" data-f="pick" aria-label="Работа ${i + 1}: выбрать другую"><option value="-1" selected>${w.txt ? 'Заменить на…' : 'Выбрать…'}</option>${groups.map((g) => `<optgroup label="${esc(g)}">${PL.opts.map((o, k) => (o.group === g && k !== s ? `<option value="${k}">${esc(o.name)}</option>` : '')).join('')}</optgroup>`).join('')}</select>
        <button class="w-link" data-act="wedit" data-w="${i}" aria-expanded="${w.edit}">${w.edit ? 'Готово' : 'Изменить текст'}</button>
      </div>
      ${w.edit ? `<div class="w-edit">${typeSelect(w.t, `data-w="${i}" data-f="t" aria-label="Тип работы ${i + 1}"`)}${kmField(w.km, `data-w="${i}" data-f="km" aria-label="Километры работы ${i + 1}"`)}<textarea data-w="${i}" data-f="txt" rows="3" aria-label="Задание работы ${i + 1}">${esc(w.txt)}</textarea></div>` : ''}
    </div>`;
  }
  function dayRow(r, i) {
    const moveOpts = PL.rows.map((o, j) => (j === i ? '' : `<option value="${j}">на ${DNS[dow(o.d)]} ${dayLbl(o.d)}${o.typtrain && +o.prekm ? `, там ${TYPES[o.typtrain].toLowerCase()} ${n1(o.prekm)} км` : ', там отдых'}</option>`)).join('');
    const rest = !r.typtrain && !+r.prekm;
    return `<li class="w-pday ${rest ? 'rest' : ''}">
      <div class="w-pd"><b>${DNF[dow(r.d)]}</b><small class="num">${dayLbl(r.d)}</small></div>
      <div class="w-pbody">
        <div class="w-ph"><span class="w-name">${rest ? 'Отдых' : glyph(LEVEL[r.typtrain] || 1, r.typtrain === 6) + TYPES[r.typtrain]}</span>${rest ? '' : `<span class="num w-pkm">${+r.prekm ? `${n1(r.prekm)} км` : 'без расстояния'}</span>`}</div>
        ${rest ? '' : taskHTML(r.task)}
        ${r.alt ? `<div class="w-alt" role="radiogroup" aria-label="Длительная: откуда взять"><label><input type="radio" name="alt${i}" data-r="${i}" data-alt="gen" ${r.src === 'gen' ? 'checked' : ''}>Из расчёта S10, ${n1(r.gen.prekm)} км</label><label><input type="radio" name="alt${i}" data-r="${i}" data-alt="alt" ${r.src === 'alt' ? 'checked' : ''}>Из плана, ${n1(r.alt.prekm)} км</label></div>` : ''}
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
    const head = () => `<div class="w-ch"><h2 id="w-plan-h">Запланировать неделю</h2><button class="w-btn sm" data-act="close">Закрыть</button></div>`;
    if (!PL || PL.loading) return `<section class="w-card" aria-labelledby="w-plan-h">${head()}<p class="w-note">Загружаю ваши ограничения и шаблоны…</p></section>`;
    if (!PL.base) return `<section class="w-card" aria-labelledby="w-plan-h">${head()}<p class="w-note w-err" role="alert">${esc(PL.err)}</p></section>`;
    const p = PL.base.param || {}, n = weekNo(windowStart()), pw = planWeek(n);
    return `<section class="w-card" aria-labelledby="w-plan-h">${head()}
      <div class="w-step">
        <div class="w-steph"><h3>Начало недели</h3><span class="num">Лимиты: объём до ${p.maxweek?.v ?? '—'} км, длительная до ${p.maxlong?.v ?? '—'} км</span></div>
        <div class="w-seg" role="radiogroup" aria-label="Первый день недели">${PL.dsels.map((x) => `<button role="radio" aria-checked="${x.k === PL.dsel}" data-act="dsel" data-k="${x.k}">${DNF[dow(x.date)]}, ${dayLbl(x.date)}</button>`).join('')}</div>
      </div>
      <div class="w-step">
        <div class="w-steph"><h3>Две ключевые работы</h3><span>${pw ? `Из выбранного плана «${esc(plan().name)}», неделя ${n}` : plan() ? `В плане «${esc(plan().name)}» нет недели ${n}, выберите из шаблонов` : 'Из шаблонов или своё'}</span></div>
        <div class="w-works">${PL.works.map(workCard).join('')}</div>
        <div class="w-go"><button class="w-btn ${PL.rows && !PL.stale ? '' : 'primary'}" data-act="wgen" ${PL.busy ? 'disabled' : ''}>${PL.busy && !PL.rows ? 'Считаю расписание…' : PL.rows ? 'Пересчитать расписание' : 'Рассчитать расписание'}</button><span class="w-muted">${PL.stale ? 'Работы изменились, пересчитайте расписание.' : 'Остальные дни подберёт S10 по вашим лимитам.'}</span></div>
      </div>
      ${PL.err ? `<p class="w-note w-err" role="alert">${esc(PL.err)}</p>` : ''}
      ${PL.rows ? `<div class="w-step w-step-list"><div class="w-steph"><h3>Расписание</h3><span class="num">${PL.rows.length} ${plural(PL.rows.length, 'день', 'дня', 'дней')}, ${dayLbl(PL.rows[0].d)} – ${dayLbl(last(PL.rows).d)}</span></div></div>
        <ol class="w-plist">
          ${PL.pre.map((x) => `<li class="w-pday locked"><div class="w-pd"><b>${DNF[dow(x.d)]}</b><small class="num">${dayLbl(x.d)}</small></div><div class="w-pbody"><div class="w-ph"><span class="w-name">${glyph(LEVEL[+x.typtrain] || 1)}${TYPES[+x.typtrain] || 'Тренировка'}</span><span class="num w-pkm">${n1(+x.prekm || 0)} км</span></div>${taskHTML(x.task)}</div><div class="w-pa"><span class="w-pill neutral">Уже в дневнике</span></div></li>`).join('')}
          ${PL.rows.map(dayRow).join('')}
        </ol>
        <div class="w-sum">
          <div><span class="w-lb">Итого за ${PL.rows.length} ${plural(PL.rows.length, 'день', 'дня', 'дней')}</span><b class="num" id="w-total">${n1(planTotal())} км</b>${PL.sum?.['за последние 7 дней'] ? `<span class="w-muted num">Последние 7 дней: пробежано ${PL.sum['за последние 7 дней'].km0} из ${PL.sum['за последние 7 дней'].km1} км</span>` : ''}</div>
          <button class="w-btn primary" data-act="wsave" ${PL.busy || PL.stale || !me.isPremium ? 'disabled' : ''}>${PL.busy ? 'Ставлю задачи…' : 'Поставить задачи'}</button>${me.isPremium ? '' : '<p class="w-note w-prem">Записывать задачи можно с премиум-подпиской S10.</p>'}
        </div>` : ''}
    </section>`;
  }
  // what was actually run: km and average pace from the diary tracks, compared with a pace-only task
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
    if (pace < lo - 5) return '<span class="w-pill neutral">быстрее задания</span>';
    if (pace > hi + 5) return '<span class="w-pill neutral">медленнее задания</span>';
    return '<span class="w-pill ok">в задании</span>';
  }
  function factHTML(x, planned) {
    const f = runFact(x); if (!f) return '';
    const what = planned ? 'Факт' : 'Пробежка вне плана';
    return `<p class="w-fact"><span>${what}:</span><span class="w-nw"><b class="num">${n1(f.km)} км</b>${f.pace ? ` · <b class="num">${fmtSec(f.pace)}</b> мин/км` : ''}</span>${planned ? paceVerdict(x.comment, f.pace) : ''}</p>`;
  }
  function statusPill(r) {
    const x = r.x, km = runKm(x);
    if (!isRun(x)) return '';
    if (r.d > today) return '';
    if (km > 0) return '<span class="w-pill ok">Сделано</span>';
    if (r.d === today) return '<span class="w-pill neutral">Сегодня</span>';
    return '<span class="w-pill bad">Не выполнено</span>';
  }
  // the calendar: one row per week, from last week to the race week; a click opens that week below
  let calFrom = null, calAll = false;
  function calRange() {
    const curMon = monday(today);
    let from = calFrom || add(curMon, -7);
    let to = raceMon && raceMon > curMon ? raceMon : add(curMon, 35);
    if (wk < from) from = wk;
    if (wk > to) to = wk;
    const mons = []; for (let m = from; m <= to; m = add(m, 7)) mons.push(m);
    while (mons.length < 6) mons.push(add(last(mons), 7));
    return mons;
  }
  function calCell(d) {
    const x = days.get(d), run = isRun(x), fact = runKm(x) > 0, isRace = (race && d === race.d) || +x?.type === 6;
    const km = run && +x.target ? n1(+x.target) : '';
    const cls = [d < today ? 'past' : '', d === today ? 'today' : '', isRace ? 'race' : '', run ? 'run' : '', fact ? 'done' : ''].filter(Boolean).join(' ');
    const label = `${DNF[dow(d)]}, ${dayLbl(d)}: ${isRace ? `старт${raceName && race?.d === d ? ` ${raceName}` : ''}` : run ? `${(TYPES[+x.type] || 'тренировка').toLowerCase()}${km ? `, ${km} км` : ''}` : 'без тренировки'}${fact ? `, сделано ${n1(runKm(x))} км` : ''}`;
    return `<button class="w-cd ${cls}" data-act="cal" data-d="${d}" aria-label="${esc(label)}" title="${esc(label)}"${d === today ? ' aria-current="date"' : ''}><span class="w-cdn num">${d8(d).getUTCDate()}</span><i class="w-dot"></i></button>`;
  }
  function calHTML() {
    const mons = calRange(), hidden = !calAll && mons.length > 8 && mons.indexOf(wk) < 8 ? mons.length - 8 : 0;
    const shown = hidden ? mons.slice(0, 8) : mons;
    const monthOf = (m, k) => { const first = [...Array(7)].map((_, i) => add(m, i)).find((d) => d.endsWith('-01')); return first ? MONS[+first.slice(5, 7) - 1] : k === 0 ? MONS[+m.slice(5, 7) - 1] : ''; };
    return `<section class="w-card w-calc" aria-labelledby="w-cal-h">
      <div class="w-ch"><h2 id="w-cal-h">${race && raceMon > monday(today) ? 'Календарь до старта' : 'Календарь'}</h2><button class="w-link" data-act="calback">Раньше</button></div>
      <div class="w-cal">
        <div class="w-cwh" aria-hidden="true"><span></span>${DN.map((n) => `<span>${n}</span>`).join('')}</div>
        ${shown.map((m, k) => `<div class="w-cw ${m === wk ? 'sel' : ''}" role="group" aria-label="Неделя ${wLabel(m)}"><span class="w-cm" aria-hidden="true">${monthOf(m, k)}</span>${[...Array(7)].map((_, i) => calCell(add(m, i))).join('')}</div>`).join('')}
      </div>
      ${hidden ? `<button class="w-cal-all" data-act="calall">Все недели до старта: ещё ${hidden}</button>` : ''}
      <div class="w-cal-key" aria-hidden="true"><span><i class="k-plan"></i>в плане</span><span><i class="k-done"></i>сделано</span><span><i class="k-race"></i>старт</span></div>
    </section>`;
  }
  function todayCard(W) {
    const r = W.list.find((q) => q.d === today);
    if (!r) {
      const next = [...days.values()].filter((x) => x.date >= today && isRun(x)).sort((a, b) => a.date.localeCompare(b.date))[0];
      return `<div class="w-today"><span class="w-lb">Ближайшая тренировка</span>${next ? `<div class="w-type">${glyph(LEVEL[next.type] || 1, next.type === 6)}${TYPES[next.type] || 'Тренировка'}, ${DNF[dow(next.date)]} ${dayLbl(next.date)}</div><div class="w-big num">${n1(+next.target)}<small>км</small></div>${taskHTML(next.comment)}` : '<div class="w-type">Не запланирована</div>'}</div>`;
    }
    const x = r.x, d = d8(today), km = runKm(x);
    const head = `<span class="w-lb">Сегодня, ${DNF[r.i]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}</span>`;
    if (!isRun(x)) return `<div class="w-today">${head}<div class="w-big">Отдых</div><p class="w-tx">Тренировки сегодня нет.</p></div>`;
    return `<div class="w-today">${head}<div class="w-type">${glyph(LEVEL[x.type] || 1, x.type === 6)}${TYPES[x.type] || 'Тренировка'}</div>
      <div class="w-big num">${n1(+x.target)}<small>км</small></div>${taskHTML(x.comment)}${factHTML(x, true)}</div>`;
  }
  function weekSection(W) {
    if (mode === 'plan') return plannerHTML();
    return `<section class="w-card" aria-labelledby="w-days-h">
        <div class="w-ch"><h2 id="w-days-h">По дням</h2><span class="w-muted num">План ${n1(W.plan)} км</span><button class="w-btn sm" data-act="plan">Запланировать неделю</button></div>
        <ol class="w-days">${W.list.map((r) => {
          const x = r.x, run = isRun(x), o = others(x);
          return `<li class="w-day ${r.d === today ? 'today' : ''}">
            <div class="w-dn"><b>${DN[r.i]}</b><small class="num">${dayLbl(r.d)}</small></div>
            <div class="w-what ${run ? '' : 'rest'}">
              <span class="w-name">${run ? glyph(LEVEL[x.type] || 1, x.type === 6) + (TYPES[x.type] || 'Тренировка') : 'Отдых'}</span>
              ${run ? taskHTML(x.comment) : ''}
              ${factHTML(x, run)}
              ${o.length ? `<span class="w-muted">${o.map(esc).join(' · ')}</span>` : ''}
            </div>
            <div class="w-km">${run ? `<span class="num">${n1(+x.target)} км</span>` : ''}${statusPill(r)}</div>
          </li>`;
        }).join('')}</ol>
      </section>`;
  }
  function weekRel() {
    const n = Math.round((d8(wk) - d8(monday(today))) / 6048e5);
    if (!n) return 'Эта неделя';
    if (n === -1) return 'Прошлая неделя';
    if (n === 1) return 'Следующая неделя';
    const k = Math.abs(n), w = `${k} ${plural(k, 'неделя', 'недели', 'недель')}`;
    return n < 0 ? `${w} назад` : `Через ${w}`;
  }
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
    await loadRange(wk, add(wk, 6)).catch(() => {});
  }
  // without a race the plan's week −n starts in the week of the next S10 running week, so week −1 is n−1 weeks later
  function syncRace() {
    if (race || !noRace) return;
    const n = plan()?.plan?.weeks?.length || 0;
    setEnd(n ? add(monday(runStart), (n - 1) * 7) : null);
  }
  // the window's paces follow the goal (or the defaults without one) until the athlete edits a pace by hand
  const onbGoal = (o) => { const km = parseFloat(o.dist.match(/([\d.]+) км/)[1]), g = o.goal.trim().replace(/[.,]/g, ':'), goal = g ? goalOf(g, km) : null; return goal ? { km, goal } : null; };
  const onbPaceNote = (o) => { const g = o.race && onbGoal(o); return o.touched ? 'Темпа ваши.' : g ? `Посчитаны от цели ${g.goal.replace(/^00:/, '').replace(/^0/, '')} на ${o.dist.split(' · ')[0].toLowerCase()}.` : race?.prediction && !o.race ? `Посчитаны от прогноза на старт ${raceName || ''} ${hms(race.prediction)}.`.replace('  ', ' ') : 'Не знаете свои — оставьте как есть: это темпа человека, который бегает 3 раза в неделю по 5–7 км (5 км примерно за 30 минут). Укажете цель — посчитаем от неё.'; };
  function onbFollowGoal() {
    const o = onb; if (!o?.pace || o.touched) return;
    const g = onbGoal(o); o.P = g ? pacesFromGoal(g.km, hmsSec(g.goal)) : { ...NEWBIE_PACES };
    for (const k of [5, 10, 21, 42]) { const x = root.querySelector(`[data-o="t${k}"]`); if (x) x.value = o.P[k]; }
    const e = root.querySelector('[data-o="easy"]'); if (e) e.value = o.P.easy;
    const n = root.querySelector('#w-onb-pn'); if (n) n.textContent = onbPaceNote(o);
  }
  function onbHTML() {
    const o = onb, f = (k, label, extra = '') => `<label class="w-f"><span>${label}</span><input data-o="${k}" value="${esc(o[k])}" ${extra}></label>`;
    return `<div class="w-modal"><section class="w-dlg" role="dialog" aria-modal="true" aria-labelledby="w-onb-h">
      <h2 id="w-onb-h">${o.race ? 'Главный старт' : 'Ваши темпа'}</h2>
      ${o.race ? `<p class="w-muted">К какому старту готовимся? План ляжет на даты до него. Если старта пока нет, нажмите «Отсутствует»: план пойдёт со следующей беговой недели без даты старта.</p>
      <div class="w-onb-g">
        <label class="w-f"><span>Дата</span><input type="date" data-o="d" min="${add(today, 1)}" value="${o.d}"></label>
        <label class="w-f"><span>Дистанция</span><select data-o="dist">${DISTANCES.map((d) => `<option ${d === o.dist ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        ${f('name', 'Название', 'placeholder="Например, Valencia"')}
        ${f('goal', 'Цель, необязательно', 'class="num" inputmode="numeric" placeholder="3:20 или 22:30"')}
      </div>` : ''}
      ${o.pace ? `${o.race ? '<h3>Темпа</h3>' : ''}<p class="w-muted">По ним в задания встанут минуты на километр вместо T5…T42. <span id="w-onb-pn">${onbPaceNote(o)}</span> Поменять можно потом на вкладке «Мои темпа».</p>
      <label class="w-f"><span>Лёгкий бег, мин/км</span><input data-o="easy" class="num" inputmode="numeric" value="${esc(o.P.easy)}"></label>
      <div class="w-onb-p">${[5, 10, 21, 42].map((k) => `<label class="w-f"><span>T${k}</span><input data-o="t${k}" class="num" inputmode="numeric" value="${esc(o.P[k])}"></label>`).join('')}</div>` : ''}
      ${o.err ? `<p class="w-err" role="alert">${esc(o.err)}</p>` : ''}
      <div class="w-acts">${o.manual ? `<button class="w-btn" data-act="onbcancel">Отмена</button>` : ''}${o.race ? `<button class="w-btn" data-act="onbnone" ${o.busy ? 'disabled' : ''}>Отсутствует</button>` : ''}<button class="w-btn primary" data-act="onbok" ${o.busy ? 'disabled' : ''}>${o.busy ? 'Сохраняю…' : o.race ? 'Сохранить старт' : 'Готово'}</button></div>
    </section></div>`;
  }
  // a goal time as hh:mm:ss: «3:20» is hours for a half or a marathon, «22:30» is minutes for 10 km and shorter
  const goalOf = (g, km) => {
    const t = g.split(':').map(Number);
    if (t.length < 2 || t.length > 3 || t.some((x) => !Number.isInteger(x) || x < 0) || t.slice(1).some((x) => x >= 60)) return null;
    const hms3 = t.length === 3 ? t : km <= 10 ? [0, ...t] : [...t, 0];
    return hms3.map((x) => String(x).padStart(2, '0')).join(':');
  };
  // «Сохранить старт» writes the main race the way calc3 does (a task with main6 = 1); «Отсутствует» keeps the plan
  // without a race date; the paces go to «Мои темпа» as the athlete's own
  async function finishOnb(withRace) {
    const o = onb; o.err = '';
    let P = null;
    if (o.pace) {
      P = {};
      for (const k of [5, 10, 21, 42]) { const v = paceSec(o.P[k]); if (!v) { o.err = `T${k}: напишите минуты и секунды, например 6:20.`; return render(); } P[k] = fmtSec(v); }
      const e = String(o.P.easy).split(/[-–]/).map(paceSec);
      if (e.length !== 2 || !e[0] || !e[1] || e[0] > e[1]) { o.err = 'Лёгкий бег: от и до, например 7:00-7:30.'; return render(); }
      P.easy = e.map(fmtSec).join('-');
    }
    if (o.race && withRace) {
      if (!o.d || o.d <= today) { o.err = 'Выберите дату старта позже сегодняшнего дня.'; return render(); }
      const km = parseFloat(o.dist.match(/([\d.]+) км/)[1]), g = o.goal.trim().replace(/[.,]/g, ':');
      const goal = g ? goalOf(g, km) : '';
      if (goal == null) { o.err = km <= 10 ? 'Цель: минуты и секунды, например 22:30, или 1:05:00.' : 'Цель: часы и минуты, например 3:20, или 3:20:00.'; return render(); }
      o.busy = true; render();
      await loadRange(o.d, o.d).catch(() => {});
      const ex = days.get(o.d);
      if (ex && (+ex.type || +ex.target || String(ex.comment || '').trim()) && o.replace !== o.d) { // a task already there: ask once
        o.busy = false; o.replace = o.d;
        o.err = `На ${dayLbl(o.d)} в дневнике уже стоит: ${String(ex.comment || TYPES[+ex.type] || 'задача').slice(0, 60)}${+ex.target ? `, ${n1(+ex.target)} км` : ''}. Нажмите «Сохранить старт» ещё раз, и вместо неё встанет старт.`;
        return render();
      }
      const r = { d: o.d, task: 'ГОНКА', prekm: String(km), typtrain: 6, location: o.name.trim(), prediction: goal }, prev = race;
      setRace(r); // writeTasks sends main6 = 1 for the race day, as calc3 does
      try { await writeTasks([r]); } catch (e) { setRace(prev); o.busy = false; o.err = `Старт не сохранился (${e.message}). Попробуйте ещё раз, выберите его на странице «Настройка плана» или нажмите «Отсутствует».`; return render(); }
      noRace = false; store.set(`noRace.${id}`, false);
      days.set(r.d, { date: r.d, type: 6, target: km, comment: r.task, main6: 1, location: r.location, prediction: r.prediction, tracks: [] });
      gen.distance = o.dist; gen.weeks = weeksTo(raceMon);
    }
    if (o.race && !withRace) { noRace = true; store.set(`noRace.${id}`, true); gen.weeks = 2; }
    if (!gen.touched) gen.prompt = promptDefault();
    if (P) { PACE_OWN = P; paceSrc = 'own'; store.set(`paceOwn.${id}`, P); store.set(`paceSrc.${id}`, 'own'); reprice(); }
    onb = null;
    flash = o.race && withRace ? `${'Главный старт сохранён'}: ${dayLbl(race.d)}${raceName ? `, ${raceName}` : ''}. Теперь выберите или сделайте план.` : o.race ? 'План будет без даты старта: со следующей беговой недели вперёд.' : 'Темпа сохранены.';
    if (o.race) tab = 'plan';
    render();
    if (tab === 'plan' && chooser && chooserTab === 'new') focusAsk();
  }
  // the site's own header: the S10 menu on the left (the same links as the site's header), the logo, the profile with
  // the avatar on the right; the menu opens over the page, so nothing under it moves
  const SITE = '', CHALLENGES = 'https://challenges.s10.run';
  let menuOpen = false;
  const fullName = `${me.firstName || ''} ${me.lastName || ''}`.trim();
  const initials = (fullName.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2) || 'S').toUpperCase();
  const avatar = () => `<a class="w-ava" href="${SITE}/profile?${esc(me.id)}" aria-label="Мой профиль${fullName ? `, ${esc(fullName)}` : ''}" title="${esc(fullName)}"><span aria-hidden="true">${esc(initials)}</span>${me.avatarUrl ? `<img src="${esc(me.avatarUrl)}" alt="">` : ''}</a>`;
  function menuLinks() {
    const athlete = me.role !== 'trainer', L = [];
    if (me.currentTrainerId) L.push([`${SITE}/profile?${me.currentTrainerId}`, 'Мой тренер']);
    else if (athlete) L.push([`${SITE}/trainerlist`, 'Выбрать тренера']);
    if (athlete) L.push([`${SITE}/student?${me.id}&v2=1`, 'Задачи']); else L.push([`${SITE}/students`, 'Студенты']);
    if (!me.isPremium) L.push([`${SITE}/premium`, 'Премиум']);
    L.push(null, [`${CHALLENGES}/tournament/?utm_source=s10header&utm_campaign=tournament&utm_content=btn`, 'Турнир'], [`${CHALLENGES}/newrace`, 'Ближайший челендж'], [`${CHALLENGES}/rating`, 'Рейтинг'], [`https://s10.run/answers`, 'Вопросы и ответы']);
    L.push(null, [`${SITE}/money`, 'Платежи'], [`${SITE}/profile?${me.id}`, 'Мой профиль'], [`${SITE}/logout`, 'Выйти']);
    return L.map((l) => (l ? `<li><a href="${esc(l[0])}">${l[1]}</a></li>` : '<li class="sep" aria-hidden="true"></li>')).join('');
  }
  const topBar = (open) => `<div class="w-topin">
      <button class="w-menub" data-act="menu" aria-expanded="${open}" aria-label="${open ? 'Закрыть меню' : 'Меню S10'}"><i></i><i></i><i></i></button>
      <a class="w-wm" href="${SITE}/" aria-label="S10.run, главная">${LOGO}</a>
      <span class="w-topr">${SHOW_COLORS && !open ? `<button class="w-btn sm" data-act="colors" aria-expanded="${colorsOpen}">Цвета</button>` : ''}${avatar()}</span>
    </div>`;
  function render() {
    syncRace();
    // the diary to the plan's end, for «Не трогать…» and the counts (the first load covered 6 weeks or the race)
    if (raceEnd && raceEnd > today && !loadedWeeks.has(monday(raceEnd))) loadRange(add(today, 1), raceEnd).then(render, () => {});
    const W = week(wk), cur = wk === monday(today), R = readiness();
    const daysToRace = race ? Math.round((d8(race.d) - d8(today)) / 864e5) : null;
    const pct = W.plan ? Math.min(100, (W.done / W.plan) * 100) : 0;
    root.innerHTML = `
    ${''}
    <header class="w-top" ${onb || menuOpen ? 'inert' : ''}>${topBar(false)}</header>
    <main class="w-main" ${onb || menuOpen ? 'inert' : ''}>
      ${colorsOpen ? colorsPanel() : ''}
      <div class="w-head">
        <h1>${cur ? 'Моя неделя' : 'Неделя'}, ${wLabel(wk)}</h1>
      </div>
      <div class="w-duo">
      <section class="w-card w-hero" aria-label="Сегодня и итоги недели">
        ${todayCard(W)}
        <div class="w-stats">
          <div class="w-stat w-stat-wide"><span class="w-lb">Объём недели</span><span class="v num">${n1(W.done)}<small>из ${n1(W.plan)} км</small></span>
            ${W.plan ? `<div class="w-track" role="img" aria-label="${n1(W.done)} из ${n1(W.plan)} километров"><i style="width:${pct}%"></i></div><div class="w-track-l num" aria-hidden="true"><span>0</span><span>${n1(W.plan)} км</span></div>` : '<span class="s">на этой неделе ничего не запланировано</span>'}</div>
          <div class="w-stat"><span class="w-lb">${daysToRace != null ? 'До старта' : 'Главный старт'}</span><span class="v num">${daysToRace != null ? `${daysToRace}<small>${plural(daysToRace, 'день', 'дня', 'дней')}</small>` : '—'}</span><span class="s num">${daysToRace != null ? `${raceName ? `${esc(raceName)}, ` : ''}${dayLbl(race.d)}, ${race.prekm} км${race.prediction ? `, прогноз ${hms(race.prediction)}` : ''}` : noRace ? 'нет, план без даты старта' : 'не выбран'}${daysToRace == null && isSelf ? ` · <button class="w-link" data-act="onbopen">указать</button>` : ''}</span></div>
          <div class="w-stat w-stat-r"><span class="w-lb">${READY_LABEL()}</span><span class="v num">${R ? `${R.pct}<small>%</small>` : '—'}</span>${R ? readyBar(R.pct) : ''}<span class="s">${R ? `${readyLevel(R.pct)} · ` : 'мало данных · '}<button class="w-link" data-act="ready">подробнее</button></span></div>
        </div>
      </section>
      ${calHTML()}
      </div>
      ${flash ? `<div class="w-flash" role="status" tabindex="-1"><span>${esc(flash)}${flash === flashUndo && lastUndo() ? ' <button class="w-link" data-act="undoask" data-where="flash">Отменить</button>' : ''}</span><button data-act="flash" aria-label="Скрыть сообщение">×</button></div>` : ''}
      ${undoHTML('flash')}
      <div class="w-tabbar" role="tablist" aria-label="Разделы">
        ${[['week', 'Неделя'], ['plan', 'План до старта'], ['paces', 'Мои темпа']].map(([k, l]) => `<button role="tab" id="tab-${k}" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" aria-controls="w-panel" data-act="tab" data-k="${k}">${l}</button>`).join('')}
      </div>
      <div role="tabpanel" id="w-panel" aria-labelledby="tab-${tab}" class="w-panel">${tab === 'week' ? weekSection(W) : tab === 'plan' ? readyCard(R) + planCard() : pacesCard()}</div>
      <p class="w-foot">${`Данные из вашего дневника S10, обновлены ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.`} <a href="https://t.me/+wP4aOZ4910I2MTk6" target="_blank" rel="noopener">Чат «Моя неделя» в Telegram: вопросы и отзывы</a></p>
    </main>${onb ? onbHTML() : ''}${menuOpen ? `<div class="w-navwrap" role="dialog" aria-modal="true" aria-label="Меню S10"><header class="w-top">${topBar(true)}</header><nav class="w-sitemenu" aria-label="Меню S10"><ul>${menuLinks()}</ul></nav></div>` : ''}`;
    if (onb && !onb.focused) { onb.focused = true; root.querySelector('.w-dlg input, .w-dlg select')?.focus(); }
    root.querySelectorAll('textarea').forEach(fit);
    syncURL(false);
    if (flash && flash !== shownFlash) { shownFlash = flash; root.querySelector('.w-flash')?.focus({ preventScroll: false }); }
  }
  function fit(t) { t.style.height = 'auto'; t.style.height = Math.max(64, t.scrollHeight + 2) + 'px'; }

  /* ================= styles: light S10 brand on the taste-skill app-screen rules ================= */
  const css = `
  .w-app{--ground:#f4f4f4;--surface:#fff;--border:#e1e1e1;--rule:#eeeeee;--control:#c8c8c8;--text:#111111;--muted:#595959;--faint:#6b6b6b;--accent:#1a4be0;--accent-bg:#e4eafc;--glyph-off:#d6d6d6;--primary:#d62b1f;--primary-hover:#b8251b;--primary-ink:#fff;--key:#d62b1f;--field:#fff;--soft:#f9f9f9;--accent-soft:#f4f6fe;--warn-bg:#fffbeb;
    --ok-bg:#dcfae5;--ok:#04250e;--bad-bg:#ffedea;--bad:#831c1e;--neutral-bg:#eceef2;--neutral:#3d424b;
    min-height:100vh;background:var(--ground);color:var(--text);font:15px/1.5 Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;text-align:left}
  .w-app.w-over{position:fixed;inset:0;overflow:auto;z-index:2147483000;scrollbar-gutter:stable}
  html:has(.w-app:not(.w-over)){scrollbar-gutter:stable}
  .w-app *{box-sizing:border-box;margin:0;padding:0}
  .w-app .num{font-variant-numeric:tabular-nums}
  .w-app button,.w-app select,.w-app input,.w-app textarea{font:inherit;color:inherit}
  .w-app :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .w-app a{color:var(--accent)}
  .w-top{background:#004aad;padding:0 max(16px,env(safe-area-inset-right)) 0 max(16px,env(safe-area-inset-left))}
  .w-topin{margin:0 auto;height:48px;display:flex;align-items:center;gap:20px;position:relative}
  .w-wm{position:absolute;left:50%;top:8px;transform:translateX(-50%);display:block;height:32px;line-height:0}
  .w-wm svg{height:32px;width:auto}
  .w-menub{position:relative}.w-menub::before{content:"";position:absolute;inset:0 0 0 -9px;border-radius:6px;transition:background .15s}.w-menub:hover::before{background:rgba(255,255,255,.14)}.w-menub i{position:relative}.w-wm:hover{opacity:.85}.w-top .w-ava:hover{box-shadow:0 0 0 2px rgba(255,255,255,.7)}
  .w-top :focus-visible{outline-color:#fff}
  .w-menub{width:40px;height:40px;display:grid;place-content:center start;gap:5px;border:0;background:none;border-radius:6px;cursor:pointer}
  .w-menub i{display:block;width:22px;height:2.5px;border-radius:1px;background:#fff;transition:transform .2s ease-out,opacity .2s ease-out}
  .w-menub[aria-expanded="true"] i:nth-child(1){transform:translateY(7.5px) rotate(45deg)}
  .w-menub[aria-expanded="true"] i:nth-child(2){opacity:0}
  .w-menub[aria-expanded="true"] i:nth-child(3){transform:translateY(-7.5px) rotate(-45deg)}
  .w-topr{margin-left:auto;display:flex;align-items:center;gap:12px}
  .w-top .w-ava{position:relative;flex:none;display:block;width:32px;height:32px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.22);color:#fff;text-decoration:none}
  .w-ava span{display:grid;place-items:center;width:100%;height:100%;font-size:13px;font-weight:500;letter-spacing:.02em}
  .w-ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .w-navwrap{position:fixed;inset:0;z-index:2147483001;background:#004aad;overflow:auto;overscroll-behavior:contain}
  .w-sitemenu ul{list-style:none;max-width:1160px;margin:0 auto;padding:8px 0 40px}
  .w-sitemenu a{display:block;padding:12px max(20px,env(safe-area-inset-left));color:#fff;font-size:16px;text-decoration:none}
  .w-sitemenu a:hover{text-decoration:underline}
  .w-sitemenu .sep{height:1px;margin:8px 0;background:rgba(255,255,255,.5)}
  .w-main{max-width:1160px;margin:0 auto;padding:28px max(24px,env(safe-area-inset-right)) 48px max(24px,env(safe-area-inset-left));display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
  .w-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px 16px}
  .w-head h1{padding-top:3px}
  .w-head h1{font-size:32px;line-height:1.2;font-weight:500;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* the calendar: a small card beside the week's summary; dots for workouts, a red disc for a race */
  .w-duo{display:grid;grid-template-columns:minmax(0,1fr) 344px;gap:16px;align-items:stretch}
  .w-calc .w-ch{padding:14px 16px 6px}.w-calc .w-ch h2{font-size:17px}
  .w-calc .w-link{font-size:13px;padding:2px 0}
  .w-cal{display:grid;gap:2px;padding:0 10px}
  .w-cwh,.w-cw{display:grid;grid-template-columns:30px repeat(7,minmax(0,1fr));gap:2px;align-items:center}
  .w-cwh span{font-size:11px;color:var(--faint);text-align:center;line-height:20px}
  .w-cw{border-radius:8px;transition:background .15s}
  .w-cw.sel{background:var(--accent-bg)}
  .w-cm{font-size:11px;color:var(--faint);padding-left:6px}
  .w-cd{height:32px;min-width:0;border:0;background:none;border-radius:6px;cursor:pointer;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--text)}
  .w-cd:hover{background:var(--cell-hover)}
  .w-cdn{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;font-size:13px;line-height:1}
  .w-dot{width:4px;height:4px;border-radius:50%}
  .w-cd.run .w-dot{background:var(--control)}
  .w-cd.done .w-dot{background:var(--accent)}
  .w-cd.past .w-cdn{color:var(--muted)}
  .w-cd.today .w-cdn{box-shadow:inset 0 0 0 1.5px var(--accent);color:var(--accent);font-weight:500}
  .w-cd.race .w-cdn{background:var(--key);color:#fff;font-weight:500;box-shadow:none}
  .w-cd.race .w-dot{background:none}
  .w-cal-all{display:block;margin:4px 16px 0;padding:4px 0;border:0;background:none;color:var(--muted);cursor:pointer;font-size:13px;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--control)}
  .w-cal-all:hover{color:var(--text)}
  .w-cal-key{display:flex;flex-wrap:wrap;gap:4px 14px;padding:8px 16px 14px;font-size:11px;color:var(--faint)}
  .w-cal-key i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;vertical-align:1px}
  .k-plan{background:var(--control)}.k-done{background:var(--accent)}.k-race{background:var(--key);width:9px!important;height:9px!important;vertical-align:0!important}
  .w-span{margin-bottom:12px}
  .w-nav{display:flex;align-items:center;height:38px;border:1px solid var(--control);border-radius:6px;background:var(--surface)}
  .w-nav button{width:40px;height:36px;border:0;background:none;color:var(--muted);cursor:pointer;font-size:18px;border-radius:6px}
  .w-nav button:hover{color:var(--text);background:var(--rule)}
  .w-nav span{width:144px;text-align:center;font-weight:500;font-size:14px}
  .w-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;min-width:0}
  .w-lb{color:var(--muted);font-size:13px}
  .w-muted{color:var(--faint);font-size:13px}
  .w-name{display:inline-flex;align-items:center;gap:8px;font-weight:500}
  .w-tx{color:var(--muted);line-height:1.5}
  .w-tx b{color:var(--text);font-weight:500;white-space:nowrap}
  ul.w-tx{list-style:none;display:grid;gap:2px}
  ul.w-tx li{position:relative;padding-left:14px}
  ul.w-tx li::before{content:"";position:absolute;left:2px;top:.68em;width:5px;height:5px;border-radius:50%;background:var(--glyph-off)}
  .w-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
  .w-today{padding:24px;display:grid;gap:10px;align-content:start}
  .w-today .w-type{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:500}
  .w-big{font-size:32px;line-height:1.1;font-weight:500;letter-spacing:-.01em}
  .w-big small{font-size:15px;color:var(--faint);font-weight:400;margin-left:6px;letter-spacing:0}
  .w-today .w-tx{font-size:16px;max-width:56ch;text-wrap:pretty}
  .w-stats{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;border-left:1px solid var(--rule)}
  .w-stat{padding:20px 24px;display:grid;gap:4px;align-content:start;border-top:1px solid var(--rule)}
  .w-stat-wide{grid-column:1/-1;border-top:0}.w-stat-full{grid-column:1/-1}.w-stat-r{border-left:1px solid var(--rule)}
  .w-ready-t[data-l="1"] i{background:var(--key)}.w-ready-t.sm{height:6px;margin-top:0}
  .w-ready-v{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.w-ready-v b{font-size:40px;line-height:1;font-weight:500;letter-spacing:-.01em}.w-ready-v b small{font-size:20px;margin-left:2px}.w-ready-v span{color:var(--muted)}
  .w-ready-p{list-style:none;border-top:1px solid var(--rule)}.w-ready-p li{display:grid;grid-template-columns:200px 56px minmax(0,220px) minmax(0,1fr);gap:8px 16px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--rule)}.w-ready-n{font-weight:500}.w-ready-s{text-align:right}
  .w-ready .w-note{padding:14px 20px 18px}
  .w-stat .v{font-size:24px;line-height:1.2}
  .w-stat .v small{font-size:13px;color:var(--faint);margin-left:4px}
  .w-stat .s{color:var(--faint);font-size:13px}
  .w-track{height:8px;border-radius:999px;background:var(--rule);margin-top:10px;overflow:hidden}
  .w-track-l{display:flex;justify-content:space-between;color:var(--faint);font-size:12px;margin-top:6px}
  .w-track i{display:block;height:100%;background:var(--accent);border-radius:999px}
  .w-ch{display:flex;align-items:center;gap:12px;padding:16px 20px;flex-wrap:wrap}
  .w-ch h2{font-size:17px;font-weight:500;margin-right:auto}
  .w-days,.w-plist,.w-weeks,.w-wdays,.w-plans{list-style:none}
  .w-days,.w-plist,.w-weeks{border-top:1px solid var(--rule)}
  .w-day{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:16px;padding:16px 20px;border-top:1px solid var(--rule);align-items:start}
  .w-day:first-child{border-top:0}
  .w-day.today{background:var(--accent-soft)}
  .w-dn b,.w-pd b,.w-wdd b{display:block;font-weight:500}
  .w-dn small,.w-pd small,.w-wdd small{color:var(--faint);font-size:13px}
  .w-day.today .w-dn b{color:var(--accent)}
  .w-what{display:grid;gap:4px;min-width:0}
  .w-what.rest .w-name{color:var(--faint);font-weight:400}
  .w-km{display:grid;gap:6px;justify-items:end;white-space:nowrap}
  .w-km .num{font-size:16px}
  .w-pill{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:4px;font-size:12px;font-weight:500;white-space:nowrap;flex:none}
  .w-pill.ok{background:var(--ok-bg);color:var(--ok)}.w-pill.bad{background:var(--bad-bg);color:var(--bad)}.w-pill.neutral{background:var(--neutral-bg);color:var(--neutral)}.w-pill.now{background:var(--accent-bg);color:var(--accent)}
  .w-ig{display:inline-flex;align-items:flex-end;gap:2px;height:16px;flex:none}
  .w-ig i{width:4px;border-radius:1px;background:var(--glyph-off)}
  .w-ig i:nth-child(1){height:7px}.w-ig i:nth-child(2){height:11px}.w-ig i:nth-child(3){height:16px}
  .w-ig[data-l="1"] i:nth-child(-n+1),.w-ig[data-l="2"] i:nth-child(-n+2),.w-ig[data-l="3"] i:nth-child(-n+3){background:var(--key,var(--accent))}
  .w-ig[data-race] i{background:var(--text)!important}
  .w-note{padding:8px 20px 18px;color:var(--faint);font-size:13px;line-height:1.45}
  .w-modal{position:fixed;inset:0;z-index:50;display:flex;padding:16px;overflow:auto;background:rgba(20,22,26,.45)}
  .w-dlg{margin:auto;width:min(560px,100%);display:grid;gap:14px;padding:22px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.18)}
  .w-dlg h2{margin:0;font-size:20px;font-weight:500}.w-dlg h3{margin:4px 0 0;font-size:16px;font-weight:500}.w-dlg p{margin:0;font-size:14px;line-height:1.5}
  .w-onb-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .w-onb-p{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .w-dlg .w-acts{justify-content:flex-end}
  @media (max-width:480px){.w-onb-g{grid-template-columns:1fr}.w-onb-p{grid-template-columns:repeat(2,minmax(0,1fr))}.w-dlg .w-btn{flex:1}}
  .w-err{color:var(--bad)!important;font-size:14px}
  .w-sum .w-prem{flex-basis:100%;padding:0;text-align:right}
  .w-foot{color:var(--faint);font-size:12px}.w-foot a{text-underline-offset:2px}.w-foot a:hover{color:var(--text);text-decoration-thickness:2px}
  .w-btn{height:38px;padding:0 16px;border-radius:6px;border:1px solid var(--control);background:var(--surface);font-weight:500;cursor:pointer;white-space:nowrap;transition:background .15s,transform .12s}
  .w-btn:hover:not(:disabled){background:var(--rule)}
  .w-btn:active:not(:disabled){transform:translateY(1px)}
  .w-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-ink,#fff)}
  .w-btn.primary:hover:not(:disabled){background:var(--primary-hover)}
  .w-btn:disabled{opacity:.55;cursor:default}
  .w-btn.sm{height:34px;padding:0 12px;font-size:14px}
  .w-link{border:0;background:none;color:var(--accent);cursor:pointer;font-size:14px;font-weight:500;padding:6px 2px;white-space:nowrap}
  .w-link:hover{text-decoration:underline}
  .w-app select,.w-app input,.w-app textarea{border:1px solid var(--control);border-radius:6px;background:var(--field);min-width:0;max-width:100%}
  .w-app select{height:36px;padding:0 30px 0 10px;font-size:14px;appearance:none;cursor:pointer;
    background:var(--field) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%236b707a' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 11px center}
  .w-app input{height:36px;padding:0 10px}
  .w-app input[type=checkbox],.w-app input[type=radio]{height:16px;width:16px;accent-color:var(--accent)}
  .w-app textarea{width:100%;padding:8px 10px;line-height:1.5;resize:vertical}
  .w-inl{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
  .w-step{padding:18px 20px;border-top:1px solid var(--rule);display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  .w-step-list{padding-bottom:12px}
  .w-steph{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
  .w-steph h3{font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.w-steph span{color:var(--faint);font-size:13px}
  .w-seg,.w-tabs{display:inline-flex;flex-wrap:wrap;border:1px solid var(--control);border-radius:6px;overflow:hidden;justify-self:start}
  .w-seg button,.w-tabs button{height:36px;padding:0 16px;border:0;background:var(--field);cursor:pointer;color:var(--muted);font-size:14px}
  .w-seg button+button,.w-tabs button+button{border-left:1px solid var(--control)}
  .w-seg button[aria-checked="true"],.w-tabs button[aria-selected="true"]{background:var(--accent-bg);color:var(--accent);font-weight:500}
  .w-seg button:not([aria-checked="true"]):hover,.w-tabs button:not([aria-selected="true"]):hover{background:var(--soft);color:var(--text)}
  .w-works{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  .w-work{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-content:start;padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--soft);min-width:0}
  .w-wh,.w-ph{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
  .w-wh .num,.w-pkm{font-size:16px;white-space:nowrap}
  .w-wa{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .w-wa select{flex:1 1 180px}
  .w-edit{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
  .w-edit textarea,.w-edit input:not([data-f=prekm]):not([data-f=km]){grid-column:1/-1}
  .w-kmf{display:inline-flex;align-items:center;gap:6px;color:var(--faint);font-size:14px;white-space:nowrap}
  .w-kmf input{width:72px;text-align:right}
  .w-go{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .w-pday{display:grid;grid-template-columns:110px minmax(0,1fr) 180px;gap:16px;padding:16px 20px;border-top:1px solid var(--rule);align-items:start}
  .w-pday:first-child{border-top:0}
  .w-pday.locked{background:var(--soft)}
  .w-pday.rest .w-name{color:var(--faint);font-weight:400}
  .w-pd b{text-transform:capitalize}
  .w-pbody{display:grid;gap:6px;min-width:0}
  .w-pa{display:grid;gap:4px;justify-items:stretch}
  .w-pa .w-link,.w-pa .w-pill{justify-self:start}
  .w-app .w-pa select{border-color:transparent;background-color:transparent;color:var(--accent);font-weight:500;padding-left:2px;background-position:right 8px center}
  .w-app .w-pa select:hover{border-color:var(--control);background-color:var(--field)}
  .w-alt{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;color:var(--muted);padding-top:2px}
  .w-alt label{display:inline-flex;gap:8px;align-items:center;cursor:pointer}
  .w-sum{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;padding:18px 20px;border-top:1px solid var(--rule);background:var(--soft)}
  .w-card>.w-sum:last-child{border-radius:0 0 8px 8px}
  .w-sum>div{display:grid;gap:2px;flex:1 1 360px;min-width:0}.w-sum>.w-acts{flex:none;align-self:flex-end}
  .w-span button{font-weight:500}
  .w-modes{display:grid}.w-modes>*{grid-area:1/1}.w-modes>[aria-hidden]{visibility:hidden}.w-modev{display:grid;gap:2px;align-content:start}
  .w-hint{margin-top:4px}.w-hint>span{display:block}
  .w-undo{color:var(--muted);font-size:13px;margin-top:6px}.w-undo .w-link,.w-flash .w-link{font-size:inherit;padding:0}
  .w-main>.w-confirm{margin:0}
  .w-sum b{font-size:24px;font-weight:500;line-height:1.2}
  .w-acts{display:flex;gap:10px;flex-wrap:wrap}
  .w-chk{display:inline-flex;gap:8px;align-items:center;font-size:14px;color:var(--muted);margin-top:6px;cursor:pointer}
  .w-chk-n{display:inline-grid;vertical-align:top;white-space:nowrap}.w-chk>input{align-self:flex-start;margin-top:2px}
  .w-flash{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--ok-bg);color:var(--ok);border-radius:8px;padding:12px 16px}
  .w-nw{white-space:nowrap}
  .w-fact{display:flex;align-items:center;gap:4px 8px;flex-wrap:wrap;color:var(--muted);font-size:14px}
  .w-fact b{color:var(--text);font-weight:500}
  .w-flash:focus{outline:none}.w-flash:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .w-navs{display:flex;align-items:center;gap:8px}
  .w-tonow{order:-1}.w-tonow:disabled{visibility:hidden}
  .w-ptab-wrap{padding:0 20px 4px;overflow-x:auto}
  .w-ptab{width:100%;border-collapse:collapse;font-size:15px}
  .w-ptab caption{text-align:left;color:var(--muted);font-size:13px;padding:14px 0 8px}
  .w-ptab th,.w-ptab td{padding:10px 12px;border-top:1px solid var(--rule);text-align:right;white-space:nowrap}
  .w-ptab thead th{border-top:0;color:var(--muted);font-weight:400;font-size:13px}
  .w-ptab th[scope=row],.w-ptab thead th:first-child{text-align:left;padding-left:0}
  .w-ptab th[scope=row] b{font-weight:500;margin-right:8px}
  .w-ptab th[scope=row] small{color:var(--faint);font-size:13px;font-weight:400}
  .w-flash button{border:0;background:none;color:inherit;cursor:pointer;font-size:18px;width:32px;height:32px}
  .w-chooser{padding:4px 20px 18px;display:grid;gap:12px}
  .w-plans{border:1px solid var(--border);border-radius:8px}
  .w-plans li{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-top:1px solid var(--rule)}
  .w-plans li:first-child{border-top:0}
  .w-plans li.on{background:var(--accent-soft)}
  .w-pl{display:grid;gap:2px;min-width:0}
  .w-gen{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:12px}
  .w-f{display:grid;gap:6px;min-width:0}
  .w-f>span{color:var(--muted);font-size:13px}
  .w-f-wide{grid-column:1/-1}
  .w-ask>span{color:var(--text);font-size:16px;font-weight:500}
  .w-app .w-ask textarea{border:2px solid var(--accent);min-height:96px}
  .w-ask>small{color:var(--accent);font-size:14px;line-height:1.45}
  .w-gen .w-go{grid-column:1/-1}
  .w-pmeta{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
  .w-pset{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
  .w-pset>.w-f-s{display:flex;align-items:center;gap:12px;justify-self:start}.w-pset>.w-f-s>span:first-child{white-space:nowrap}
  .w-pset input[data-p=volume]{width:56px;padding:0 8px;text-align:center}
  .w-pset .w-f-wide{grid-column:auto}
  .w-roles{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
  .w-role{display:grid;gap:4px}
  .w-role small{color:var(--faint);font-size:12px}
  .w-app .w-role select{width:100%;padding:0 20px 0 8px;font-size:13px;background-position:right 6px center;text-overflow:ellipsis}
  .w-wk{border-top:1px solid var(--rule)}
  .w-wk:first-child{border-top:0}
  .w-wkh{width:100%;display:grid;grid-template-columns:44px 120px 120px minmax(0,1fr) 72px 84px;gap:12px;align-items:center;padding:12px 20px;border:0;background:none;cursor:pointer;text-align:left}
  .w-wkh:hover{background:var(--soft)}
  .w-wk.past .w-wkh{color:var(--faint)}
  .w-wk.now .w-wkh{background:var(--accent-soft)}
  .w-wn{font-weight:500}
  .w-per{color:var(--muted);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .w-wworks{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;color:var(--muted)}
  .w-wworks span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .w-wkm{text-align:right;font-size:15px}
  .w-wkh .w-pill,.w-pill-sp{justify-self:end}
  .w-wdays{padding:0 20px 12px 76px}
  .w-wdays>li{display:grid;grid-template-columns:70px minmax(0,1fr) 64px;gap:12px;padding:10px 0;border-top:1px solid var(--rule)}
  .w-wdays>li.gone :is(.w-name,.w-wdd b,.w-wdk){color:var(--muted)}.w-wdays>li.gone .w-ig{opacity:.45}
  .w-wdb{display:grid;gap:2px;min-width:0}
  .w-wdk{text-align:right;white-space:nowrap}
  .w-confirm{margin:0 20px 18px;padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--warn-bg);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
  .w-confirm p{max-width:62ch;color:var(--text)}
  .w-paces{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--rule)}
  .w-paces label{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px;border-left:1px solid var(--rule)}
  .w-paces label:first-child{border-left:0}
  .w-paces label>span{display:grid}
  .w-paces small{color:var(--faint);font-size:13px}
  .w-paces input{width:76px;text-align:right;font-size:20px;height:40px}
  .w-tabbar{display:flex;gap:4px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
  .w-tabbar button{border:0;background:none;padding:10px 4px;margin-right:20px;font-size:16px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
  .w-tabbar button:hover{color:var(--text)}
  .w-tabbar button[aria-selected="true"]{color:var(--text);font-weight:500;border-bottom-color:var(--accent)}
  .w-panel{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
  .w-pals{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:0 20px 20px}
  .w-pal{width:100%;display:grid;gap:6px;text-align:left;border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:8px 8px 10px;cursor:pointer}
  .w-pal:hover{border-color:var(--control)}
  .w-pal.on{border-color:var(--accent);outline:1px solid var(--accent)}
  .w-rec{justify-self:start;height:20px}
  .w-pal-prev{display:block;height:64px;border-radius:5px;padding:10px;position:relative}
  .w-pal-prev i{display:grid;gap:5px;height:100%;border-radius:4px;padding:8px;align-content:start;position:relative}
  .w-pal-prev b{display:block;height:5px;border-radius:2px;width:80%}
  .w-pal-prev em{position:absolute;right:36px;bottom:8px;width:22px;height:10px;border-radius:3px}.w-pal-prev em.k{right:8px}
  .w-pal-n{font-size:14px;font-weight:500}
  .w-pal small{color:var(--faint);font-size:12px}
  @media (max-width:1000px){.w-duo{grid-template-columns:minmax(0,1fr)}.w-duo>.w-calc{order:-1}.w-roles{grid-template-columns:repeat(4,minmax(0,1fr))}.w-hero{grid-template-columns:1fr}.w-stats{border-left:0;border-top:1px solid var(--rule)}
    .w-wkh{grid-template-columns:40px 110px minmax(0,1fr) 64px;grid-template-areas:"n d w k" "n p w s"}.w-wn{grid-area:n}.w-per{grid-area:p}.w-wworks{grid-area:w}.w-wkm{grid-area:k}.w-wkh>.w-pill,.w-wkh>.w-pill-sp{grid-area:s}
    .w-wdays{padding-left:20px}}
  @media (max-width:760px){.w-works{grid-template-columns:minmax(0,1fr)}
    .w-head{grid-template-columns:minmax(0,1fr)}.w-head h1{padding-top:0}.w-navs{order:-1}.w-tonow{order:0}
    .w-pday{grid-template-columns:minmax(0,1fr);gap:8px}.w-pd{display:flex;gap:8px;align-items:baseline}.w-pa{grid-template-columns:minmax(0,1fr) auto;align-items:center}
    .w-paces{grid-template-columns:1fr 1fr}.w-paces label:nth-child(3){border-left:0}.w-paces label:nth-child(n+3){border-top:1px solid var(--rule)}
    .w-pset{grid-template-columns:1fr}.w-roles{grid-template-columns:repeat(4,minmax(0,1fr))}
    .w-wkh{grid-template-columns:36px minmax(0,1fr) auto;grid-template-areas:"n d k" "n w w" "n p s"}.w-wkh>span:nth-child(2){grid-area:d}
    .w-gen{grid-template-columns:1fr}}
  @media (max-width:560px){.w-main{padding:20px 16px 40px;gap:16px}.w-topin{gap:14px}
    .w-head h1{font-size:24px}.w-big{font-size:24px}.w-today{padding:20px}.w-stat{padding:16px}
    .w-cal{padding:0 6px}.w-cwh,.w-cw{grid-template-columns:26px repeat(7,minmax(0,1fr))}.w-cm{padding-left:4px}
    .w-day{grid-template-columns:44px minmax(0,1fr) auto;gap:12px;padding:14px 16px}
    .w-ch,.w-step,.w-sum,.w-chooser{padding-left:16px;padding-right:16px}.w-pday{padding:14px 16px}.w-wkh{padding:12px 16px}.w-wdays{padding:0 16px 12px}
    .w-wdays>li{grid-template-columns:52px minmax(0,1fr) auto}
    .w-sum .w-acts,.w-sum .w-btn{width:100%}.w-sum .w-prem{text-align:left}.w-confirm{margin:0 16px 16px}.w-confirm .w-acts{width:100%}.w-confirm .w-btn{flex:1}
    .w-plans li{flex-wrap:wrap}.w-paces label{padding:12px 16px}
    .w-ready-p li{grid-template-columns:minmax(0,1fr) auto;padding:12px 16px}.w-ready-p li>.w-ready-t,.w-ready-p li>.w-muted{grid-column:1/-1}.w-ready .w-note{padding:12px 16px 16px}
    .w-roles{grid-template-columns:repeat(2,minmax(0,1fr))}.w-ptab-wrap{padding:0 16px 4px}.w-ptab{font-size:14px}.w-ptab th,.w-ptab td{padding:10px 6px}
    .w-paces label{flex-direction:column;align-items:flex-start;gap:8px}.w-paces input{width:100%}.w-ptab th[scope=row] small{display:block}}
  /* a wide screen: the open week of the plan as day cards, four in a row, Sunday across two, instead of short rows
     with an empty middle */
  @media (min-width:1200px){.w-wdays{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:4px 20px 20px 76px}
    .w-wdays>li{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"d k" "b b";align-content:start;gap:6px 12px;padding:12px 14px;border:1px solid var(--rule);border-radius:8px}
    .w-wdays>li:last-child{grid-column:span 2}.w-wdays>li.gone{background:var(--soft)}
    .w-wdd{grid-area:d;display:flex;gap:6px;align-items:baseline}.w-wdb{grid-area:b}.w-wdk{grid-area:k}}
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
      if (act === 'menu') return toggleMenu(!menuOpen);
      if (act === 'plan') { tab = 'week'; return openPlanner(); }
      if (act === 'close') { mode = 'view'; PL = null; return render(); }
      if (act === 'flash') { flash = ''; return render(); }
      if (act === 'onbok' || act === 'onbnone') return finishOnb(act === 'onbok');
      if (act === 'onbopen') { onb = newOnb(true, false, true); return render(); }
      if (act === 'onbcancel') { onb = null; return render(); }
      if (act === 'wgen') return generateWeek();
      if (act === 'wsave') return saveWeek();
      if (act === 'dsel') { PL.dsel = a.dataset.k; PL.rows = null; pickWorks(); return render(); }
      if (act === 'wedit') { const w = PL.works[+a.dataset.w]; w.edit = !w.edit; return render(); }
      if (act === 'redit') { const r = PL.rows[+a.dataset.r]; r.edit = !r.edit; return render(); }
      if (act === 'tab') { tab = a.dataset.k; store.set('tab', tab); syncURL(true); return render(); }
      if (act === 'today') { wk = monday(today); syncURL(true); return render(); }
      if (act === 'cal') { const d = a.dataset.d; wk = monday(d); tab = 'week'; store.set('tab', tab); mode = 'view'; PL = null; syncURL(true); render(); root.querySelector(`[data-act=cal][data-d="${d}"]`)?.focus({ preventScroll: true }); return; }
      if (act === 'calback') { const from = calRange()[0]; calFrom = add(from, -28); a.disabled = true; await loadRange(calFrom, add(from, -1)).catch(() => {}); render(); root.querySelector('[data-act=calback]')?.focus({ preventScroll: true }); return; }
      if (act === 'ready') { tab = 'plan'; store.set('tab', tab); mode = 'view'; PL = null; syncURL(true); render(); root.querySelector('#w-ready-h')?.scrollIntoView({ block: 'start' }); return; }
      if (act === 'calall') { calAll = true; return render(); }
      if (act === 'span') { fillSpan = a.dataset.k; store.set('fillSpan', fillSpan); fill.confirm = false; return render(); }
      if (act === 'colors') { colorsOpen = !colorsOpen; return render(); }
      if (act === 'pal') { palId = a.dataset.id; store.set('palette', palId); applyPalette(); return render(); }
      if (act === 'pchoose') { chooser = !chooser; return render(); }
      if (act === 'ptab') { chooserTab = a.dataset.k; render(); if (chooserTab === 'new') focusAsk(); return; }
      if (act === 'psel') { sel = { src: a.dataset.src, id: a.dataset.id }; persistSel(); chooser = false; volume = null; if (sel.src === 'version') applyVersion(plan()); if (paceSrc === 'plan') paceSrc = null; reprice(); if (PL?.base) { PL.rows = null; pickWorks(); } flash = `Выбран план «${plan().name}». Задания и темпа на странице пересчитаны.`; tab = 'plan'; return render(); }
      if (act === 'gen') return runGenerate();
      if (act === 'wopen') { const w = +a.dataset.w; openWeek = openWeek === w ? NaN : w; return render(); }
      if (act === 'fillask') { fill.confirm = true; fill.err = ''; undo.confirm = false; return render(); }
      if (act === 'undoask') { undo = { ...undo, confirm: true, where: a.dataset.where || 'card', err: '' }; fill.confirm = false; return render(); }
      if (act === 'undono') { undo.confirm = false; return render(); }
      if (act === 'undoyes') return undoFill();
      if (act === 'fillno') { fill.confirm = false; return render(); }
      if (act === 'fillyes') return fillCalendar();
      if (act === 'pversion') return saveVersion();
      return;
    }
    const b = e.target.closest('button[data-w]'); if (!b) return;
    wk = add(wk, 7 * +b.dataset.w);
    await loadRange(wk, add(wk, 6)).catch(() => {});
    syncURL(true); render();
  });
  // the menu covers the page: the page under it does not scroll, focus goes to its button and back
  function toggleMenu(open) {
    menuOpen = open; document.documentElement.style.overflow = open ? 'hidden' : ''; render();
    root.querySelector(open ? '.w-navwrap .w-menub' : '.w-top .w-menub')?.focus({ preventScroll: true });
  }
  // an avatar that does not load leaves the initials under it
  root.addEventListener('error', (e) => { if (e.target.matches?.('.w-ava img')) e.target.remove(); }, true);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) return toggleMenu(false);
    if (e.key === 'Escape' && onb?.manual) { onb = null; return render(); }
    const c = e.target.closest('.w-cd');
    if (c && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      const nx = root.querySelector(`.w-cd[data-d="${add(c.dataset.d, step)}"]`); if (nx) { e.preventDefault(); nx.focus(); }
      return;
    }
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
      const v = paceSec(t.value);
      if (!v) { t.setCustomValidity('Например 4:30'); t.reportValidity(); return; }
      t.setCustomValidity('');
      // never a partial set: the other three come from the current paces, or from a new athlete's defaults
      PACE_OWN = { ...(pacesOk(PACE) ? PACE : NEWBIE_PACES), [t.dataset.k]: fmtSec(v) }; paceSrc = 'own'; store.set(`paceOwn.${id}`, PACE_OWN); store.set(`paceSrc.${id}`, 'own'); reprice(); if (PL?.base) { PL.rows = null; pickWorks(); } return render();
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
    if (t.dataset.g === 'prompt') { gen.prompt = t.value; gen.touched = true; return; }
    if (t.dataset.o && onb) { // the start window keeps what is typed without redrawing (focus stays)
      const k = t.dataset.o;
      if (/^t\d+$/.test(k) || k === 'easy') { onb.P[k === 'easy' ? 'easy' : k.slice(1)] = t.value; onb.touched = true; return; }
      onb[k] = t.value;
      if (k === 'goal' || k === 'dist') onbFollowGoal();
      return;
    }
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
  return `S10 «Моя неделя» (${'live'}) для ${me.firstName} ${me.lastName}`;
})();
