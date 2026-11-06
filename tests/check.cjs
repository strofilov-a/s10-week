// Checks for the S10 «Моя неделя» page, run against the demo (no network, nothing is sent anywhere).
//   npm ci && npx playwright install chromium        (once)
//   npm test                                          (serves the repo root itself on a free local port)
// BASE=<url of demo/> checks another address instead (e.g. GitHub Pages). Exit code 1 if any check fails.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

// a tiny static server for the repo root, 127.0.0.1 only
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const serve = () => new Promise((resolve) => {
  const srv = http.createServer((req, res) => {
    let f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    fs.readFile(f, (err, body) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(body); });
  });
  srv.listen(0, '127.0.0.1', () => resolve(srv));
});
let BASE = process.env.BASE;

// a 20-week build: race on Sun 21 Mar 2027, the coach already set Tue/Thu/Sat until the race, every plan has 20 weeks
const LONG = `
  x.main.main.d = '2027-03-21';
  const add = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const L = x.diary.diaryTasksInfo;
  for (let d = '2026-11-03'; d < '2027-03-21'; d = add(d, 1)) { const w = new Date(d + 'T12:00:00Z').getUTCDay(); if ([2, 4, 6].includes(w) && !L.find((r) => r.date === d)) L.push({ date: d, type: 1, comment: 'Задача тренера', target: 10, main6: null, tracks: [] }); }
  L.push({ date: '2027-03-21', type: 6, comment: 'ГОНКА', target: 42, main6: 1, location: 'TEST', prediction: '03:20:00', tracks: [] });
  for (const v of [...x.versions, ...x.library]) { const src = v.plan.weeks.slice().sort((a, b) => a.week - b.week); const race = src[src.length - 1], body = src.slice(0, -1);
    const out = []; for (let n = 20; n >= 2; n--) { const t = body[(20 - n) % body.length]; out.push({ ...t, week: -n }); } out.push({ ...race, week: -1 }); v.plan.weeks = out; }
`;
// the same build with every day already set by the coach: «(N)» next to «Не трогать…» gets three digits
const FULL = LONG.replace('[2, 4, 6].includes(w)', 'true');
if (FULL === LONG) throw new Error('FULL: the coach-days condition in LONG changed, update the replace');
// a brand-new athlete: no main race, no saved plans or library, no S10 forecast, an empty diary
const NEWBIE = `x.main = { main: null }; x.versions = []; x.library = []; x.results = []; x.startParam = { param: {} }; x.diary.diaryTasksInfo = [];`;
// changes the demo data before the page reads it; also records every task write
const hook = (mod = '', failOn = 0) => `(() => { let v; Object.defineProperty(window, 'S10_FIXTURES', { configurable: true, get() { return v; }, set(x) { ${mod}; v = x; } });
  window.__posts = 0; window.__days = []; window.__tasks = []; const ap = FormData.prototype.append;
  FormData.prototype.append = function (k, val) { if (k === 'tasks') { window.__posts++; if (${failOn} && window.__posts === ${failOn}) throw new Error('500'); window.__days.push(...JSON.parse(val).map((t) => t.d)); window.__tasks.push(...JSON.parse(val)); } return ap.apply(this, arguments); }; })()`;

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = BASE ? null : await serve();
  if (srv) BASE = `http://127.0.0.1:${srv.address().port}/demo/`;
  const browser = await chromium.launch();
  const open = async ({ w = 1280, h = 900, path = '', init = null } = {}) => {
    const p = await browser.newPage({ viewport: { width: w, height: h } }); p.errors = [];
    p.on('pageerror', (x) => p.errors.push(x.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    for (const s of [].concat(init || [])) await p.addInitScript(s); // one script or a list
    await p.goto(BASE + path); await wait(800); return p;
  };
  const box = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? `${Math.round(r.x)},${Math.round(r.y)}` : null; }, sel);

  // 1. the week view
  { const p = await open();
    check('page loads without errors', !p.errors.length, p.errors.join('; '));
    check('summary: volume, days to race, readiness', (await p.$$eval('.w-stat .w-lb', (l) => l.map((x) => x.textContent))).join('|') === 'Объём недели|До старта|Готовность к цели');
    check('calendar: race is a red disc', !!(await p.$('.w-cd.race')));
    check('site header with the logo', !!(await p.$('.w-top .w-wm svg')));
    await p.click('.w-cd[data-d="2026-10-21"]'); await wait(200);
    check('calendar click opens that week', (await p.textContent('h1')).includes('19–25') && p.url().includes('week=2026-10-19'));
    await p.goBack(); await wait(300);
    check('«назад» returns to this week', !p.url().includes('week='));
    await p.close(); }

  // 2. nothing moves when clicking the calendar
  for (const w of [1440, 768, 390]) {
    const p = await open({ w });
    const pos = async () => [await box(p, '.w-calc'), await box(p, '.w-cd[data-d="2026-11-04"]')].join(' ');
    const a = await pos(); await p.click('.w-cd[data-d="2026-11-18"]'); await wait(250); const b = await pos();
    await p.click('.w-cd[data-d="2026-10-27"]'); await wait(250); const c = await pos();
    check(`calendar stays put on clicks at ${w}px`, a === b && b === c, `${a} / ${b} / ${c}`);
    await p.close();
  }

  // 3. the fill block: the buttons keep their place when switching «2 беговые недели» / «До старта»
  // «wide text» widens every letter, like a wider fallback font on another OS (the CI runner's font caught a jump the Mac's did not)
  const WIDE = `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*{letter-spacing:.06em !important}'; document.head.appendChild(s); });`;
  const FILL_CASES = [{ w: 1440 }, { w: 768 }, { w: 390 }, { w: 390, wide: true }, { w: 768, wide: true },
    { w: 390, wide: true, data: LONG, label: '20-week plan' }, { w: 390, data: FULL, label: '20 weeks all set by the coach' }];
  for (const { w, wide, data, label } of FILL_CASES) {
    const p = await open({ w, path: '?tab=plan', init: [data && hook(data), wide && WIDE].filter(Boolean) });
    const rel = () => p.evaluate(() => { const s = document.querySelector('.w-sum').getBoundingClientRect(); return ['[data-act=pversion]', '[data-act=fillask]', '[data-act=span][data-k=race]'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return `${Math.round(r.x - s.x)},${Math.round(r.y - s.y)}`; }).join(' '); });
    const a = await rel(); await p.evaluate(() => document.querySelector('[data-act=span][data-k=race]').click()); await wait(150);
    const b = await rel(); await p.evaluate(() => document.querySelector('[data-act=span][data-k="2w"]').click()); await wait(150);
    const c = await rel();
    check(`fill buttons stay put at ${w}px${wide ? ', wide text' : ''}${label ? `, ${label}` : ''}`, a === b && b === c, a === b && b === c ? '' : `${a} / ${b} / ${c}`);
    await p.close();
  }

  // 4. two running weeks, profile link, undo
  { const p = await open({ path: '?tab=plan', init: hook() });
    const sum = await p.$eval('.w-sum', (x) => x.innerText.replace(/\s+/g, ' '));
    check('2 running weeks from Wednesday 4 Nov', sum.includes('14 дней') && sum.includes('4–17 ноя'), sum.slice(0, 80));
    await p.selectOption('select[data-p=role][data-i="3"]', 'easy'); await p.fill('input[data-p=volume]', '70'); await p.press('input[data-p=volume]', 'Tab'); await wait(200);
    await p.click('[data-act=fillask]'); await p.click('[data-act=fillyes]'); await wait(3000);
    const v = await p.evaluate(() => window.S10_FIXTURES.versions.find((x) => x.active));
    check('fill: plan stored in the profile as active', !!v && v.filled?.to === '2026-11-17' && v.student?.layout?.[3] === 'easy' && v.student?.volume === '70');
    check('fill: undo record kept', v?.undo?.days?.length === 14);
    await p.click('#tab-plan'); await wait(200);
    const nx = await p.$eval('.w-sum', (x) => x.innerText.replace(/\s+/g, ' '));
    check('next fill offers the next two weeks', nx.includes('18 ноя – 1 дек'), nx.slice(0, 90));
    // another device: empty browser storage, same profile
    const saved = await p.evaluate(() => JSON.stringify(window.S10_FIXTURES.versions));
    const q = await open({ path: '?tab=plan', init: hook(`x.versions = JSON.parse(${JSON.stringify(saved)})`) });
    check('another device opens the same plan and settings', (await q.$eval('input[data-p=volume]', (x) => x.value)) === '70' && (await q.$eval('select[data-p=role][data-i="3"]', (x) => x.value)) === 'easy');
    await q.close();
    // the coach changes 6 Nov, then the athlete undoes the fill
    await p.evaluate(() => { const r = window.S10_FIXTURES.diary.diaryTasksInfo.find((x) => x.date === '2026-11-06'); r.comment = 'Тренер поменял'; r.target = 9; });
    await p.click('.w-undo [data-act=undoask]'); await wait(200); await p.click('[data-act=undoyes]'); await wait(3000);
    const flash = await p.$eval('.w-flash', (x) => x.innerText);
    const nov6 = await p.$eval('.w-cd[data-d="2026-11-06"]', (x) => x.getAttribute('aria-label'));
    const after = await p.evaluate(() => window.S10_FIXTURES.versions.find((x) => x.active));
    check('undo: returns 13 days, leaves the changed one', flash.includes('13 дней') && nov6.includes('9 км'), flash.slice(0, 90));
    check('undo: record cleared in the profile', !after?.undo && !after?.filled);
    check('no errors in fill / undo', !p.errors.length, p.errors.join('; '));
    await p.close(); }

  // 5. a long build: the diary loads page by page, writes go week by week, the coach's days and the race stay
  { const p = await open({ path: '', init: hook(LONG) });
    check('long build: this week is visible', (await p.$$eval('.w-days > li', (l) => l.length)) === 7);
    check('long build: calendar shows 8 weeks and a button', (await p.$$eval('.w-cw', (l) => l.length)) === 8 && !!(await p.$('.w-cal-all')));
    await p.click('#tab-plan'); await wait(300);
    await p.click('[data-act=span][data-k=race]'); await wait(200);
    await p.click('[data-act=fillask]'); await p.click('[data-act=fillyes]'); await wait(9000);
    const r = await p.evaluate(() => ({ posts: window.__posts, days: window.__days }));
    const coach = r.days.filter((d) => [2, 4, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay()) && d >= '2026-11-03').length;
    check('long build: 78 days in 20 weekly writes', r.days.length === 78 && r.posts === 20, `${r.days.length} days, ${r.posts} writes`);
    check('long build: coach days and race untouched', coach === 0 && !r.days.includes('2027-03-21'));
    await p.close(); }

  // 6. the server stops on the 3rd write
  { const p = await open({ path: '?tab=plan', init: hook(LONG, 3) });
    await p.click('[data-act=span][data-k=race]'); await wait(200);
    await p.click('[data-act=fillask]'); await p.click('[data-act=fillyes]'); await wait(4000);
    const err = await p.$eval('.w-err', (x) => x.innerText).catch(() => '');
    check('partial write is reported', err.startsWith('Записано') && err.includes('ещё раз'), err.slice(0, 60));
    await p.close(); }

  // 7. special cases
  { const p = await open({ path: '?tab=plan', init: hook('x.me.isPremium = false') });
    check('no premium: fill disabled with a note', await p.$eval('[data-act=fillask]', (x) => x.disabled) && !!(await p.$('.w-prem')));
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook('x.library = []') });
    await p.click('[data-act=pchoose]'); await wait(200);
    check('empty library: tab hidden', !(await p.$$eval('[data-act=ptab]', (l) => l.map((x) => x.dataset.k))).includes('library'));
    await p.close(); }
  { const p = await open({ init: hook('x.me = null') });
    check('not logged in: «войдите в S10»', (await p.evaluate(() => document.body.innerText)).includes('войдите в S10'));
    await p.close(); }
  { const p = await open({ path: '?tab=paces' });
    await p.fill('input[data-k="5"]', '4:05'); await p.press('input[data-k="5"]', 'Tab'); await wait(300);
    check('own pace: T5 4:05 gives 400 m 1:38', (await p.$eval('.w-ptab', (x) => x.innerText)).includes('1:38') && (await p.$eval('select[data-p=pacesrc]', (x) => x.value)) === 'own');
    await p.close(); }
  { const p = await open({ path: '?open=plan' }); await wait(800);
    await p.click('[data-act=wsave]'); await wait(1500);
    check('week planner (calc3 flow) puts tasks', (await p.$eval('.w-flash', (x) => x.innerText).catch(() => '')).includes('задачи поставлены'));
    await p.close(); }

  // 7b. a new athlete: the start window, a plan without a race date, own paces
  { const p = await open({ path: '?tab=plan', init: hook(NEWBIE) });
    const dlg = await p.$('.w-dlg');
    check('new athlete: start window asks for the race and paces', dlg && await p.$('.w-dlg input[type=date]') && (await p.inputValue('[data-o=easy]')) === '7:00-7:30' && (await p.inputValue('[data-o=t5]')) === '6:00' && (await p.inputValue('[data-o=t10]')) === '6:15' && (await p.inputValue('[data-o=t21]')) === '6:30' && (await p.inputValue('[data-o=t42]')) === '6:50');
    await p.fill('[data-o=easy]', '7:30-7:00'); await p.click('[data-act=onbnone]'); await wait(200);
    check('start window: easy range must be from–to', (await p.$eval('.w-dlg .w-err', (x) => x.innerText).catch(() => '')).includes('Лёгкий бег'));
    await p.fill('[data-o=easy]', '7:00-7:30');
    await p.click('[data-act=onbok]'); await wait(200);
    check('start window: no date, no write', (await p.$eval('.w-dlg .w-err', (x) => x.innerText).catch(() => '')).includes('дату') && await p.evaluate(() => window.__posts) === 0);
    await p.click('[data-act=onbnone]'); await wait(300);
    check('«Отсутствует» closes the window, paces saved as own', !(await p.$('.w-dlg')) && (await p.innerText('#s10-week')).includes('План ещё не выбран'));
    await p.click('[data-act=ptab][data-k=new]').catch(() => {}); await wait(150);
    await p.fill('textarea[data-g=prompt]', 'Марафон, 40 км в неделю'); await p.click('[data-act=gen]'); await wait(3500);
    const txt = await p.innerText('#s10-week');
    check('no race: plan laid, «Весь план», no race date', txt.includes('Весь план') && txt.includes('без старта') && !(await p.$('.w-cd.race')));
    await p.click('[data-act=fillask]'); await wait(300); await p.click('[data-act=fillyes]'); await wait(2500);
    const t = await p.evaluate(() => window.__tasks);
    check('no race: 2 weeks written from the plan start, paces in numbers', t.length === 14 && t[0].d === '2026-11-02' && !t.some((x) => /T\s*(5|10|21|42)\b/.test(x.task)) && !t.some((x) => +x.typtrain === 6 || x.main6), `${t.length} days from ${t[0]?.d}`);
    check('new athlete: easy days get the explicit 7:00-7:30', t.filter((x) => +x.typtrain === 1).every((x) => x.task === '7:00-7:30') && t.some((x) => +x.typtrain === 1), [...new Set(t.filter((x) => +x.typtrain === 1).map((x) => x.task))].join(' | '));
    await p.click('[data-act=onbopen]'); await wait(200);
    const cancel = await p.$('[data-act=onbcancel]'); await p.keyboard.press('Escape'); await wait(200);
    check('«указать» opens the window again; Escape closes it, nothing changes', cancel && !(await p.$('.w-dlg')) && (await p.innerText('#s10-week')).includes('без старта'));
    check('no errors in the new-athlete flow', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(NEWBIE) });
    await p.fill('[data-o=d]', '2027-03-07'); await p.selectOption('[data-o=dist]', { index: 1 }); await p.fill('[data-o=name]', 'Барселона'); await p.fill('[data-o=goal]', '1:35');
    await p.click('[data-act=onbok]'); await wait(800);
    const t = await p.evaluate(() => window.__tasks);
    const r = t.find((x) => x.main6 === 1);
    check('start window saves the main race like calc3 (main6 = 1)', t.length === 1 && r && r.d === '2027-03-07' && r.typtrain === 6 && r.prekm === '21.1' && r.location === 'Барселона' && r.prediction === '01:35:00', JSON.stringify(r));
    const txt = (await p.innerText('#s10-week')).replace(/\s+/g, ' ');
    check('saved race: «До старта» and the plan to it', !(await p.$('.w-dlg')) && txt.includes('старт Барселона, 7 мар') && txt.includes('До старта 127'), (txt.match(/До старта.{0,40}/) || [''])[0]);
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(NEWBIE) });
    const val = async () => Promise.all(['t5', 't10', 't21', 't42', 'easy'].map((k) => p.inputValue(`[data-o=${k}]`))).then((v) => v.join(' '));
    await p.fill('[data-o=goal]', '3:20');
    check('goal marathon 3:20: paces from the goal (≈ S10 forecast 4:11/4:20/4:33/4:44)', (await val()) === '4:10 4:21 4:33 4:44 5:40-6:00', await val());
    await p.selectOption('[data-o=dist]', '10 км'); await p.fill('[data-o=goal]', '50:00');
    check('goal 10 km 50:00: T10 5:00', (await val()).startsWith('4:48 5:00'), await val());
    await p.fill('[data-o=goal]', '');
    check('no goal: back to the new athlete defaults', (await val()) === '6:00 6:15 6:30 6:50 7:00-7:30', await val());
    await p.fill('[data-o=t5]', '5:55'); await p.fill('[data-o=goal]', '45:00');
    check('a pace edited by hand stays when the goal changes', (await val()).startsWith('5:55 6:15'), await val());
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(`${NEWBIE} x.main = { main: { d: '2027-04-11', task: 'ГОНКА', prekm: '42', typtrain: 6, prediction: '03:45:00', location: 'PARIS' } };`) });
    const v = await Promise.all(['t42', 'easy'].map((k) => p.inputValue(`[data-o=${k}]`).catch(() => '?')));
    check('site race «42» km with a forecast 3:45: paces only, T42 5:20 (42.195 km)', !(await p.$('[data-o=d]')) && v[0] === '5:20', v.join(' '));
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(NEWBIE) });
    await p.fill('[data-o=d]', '2026-12-06'); await p.fill('[data-o=goal]', '3:20'); await p.click('[data-act=onbok]'); await wait(800);
    await p.click('#tab-paces'); await wait(200);
    const own = await Promise.all(['5', '10', '21', '42'].map((k) => p.inputValue(`input[data-k="${k}"]`)));
    check('saved race with a goal: own paces from it', own.join(' ') === '4:10 4:21 4:33 4:44' && (await p.$eval('.w-ptab', (x) => x.innerText)).includes('5:40–6:00'), own.join(' '));
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(`${NEWBIE} x.diary.diaryTasksInfo.push({ date: '2026-12-12', type: 1, comment: 'Задача тренера', target: 10, tracks: [] });`) });
    await p.fill('[data-o=d]', '2026-12-12'); await p.selectOption('[data-o=dist]', '5 км'); await p.fill('[data-o=goal]', '22:30');
    await p.click('[data-act=onbok]'); await wait(500);
    const warn = await p.$eval('.w-dlg .w-err', (x) => x.innerText).catch(() => '');
    check('start window asks before replacing a task on the race day', warn.includes('Задача тренера') && await p.evaluate(() => window.__posts) === 0, warn.slice(0, 80));
    await p.click('[data-act=onbok]'); await wait(800);
    const r = (await p.evaluate(() => window.__tasks))[0];
    check('second press saves it; 5 km goal 22:30 is minutes', r && r.d === '2026-12-12' && r.main6 === 1 && r.prekm === '5' && r.prediction === '00:22:30', JSON.stringify(r));
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(`${NEWBIE} x.me.isPremium = false;`) });
    await p.click('[data-act=onbnone]'); await wait(200); await p.click('[data-act=ptab][data-k=new]').catch(() => {}); await wait(150);
    await p.fill('textarea[data-g=prompt]', 'Марафон'); await p.click('[data-act=gen]'); await wait(3500);
    check('new athlete without premium: fill stays disabled', await p.$eval('[data-act=fillask]', (b) => b.disabled));
    await p.close(); }
  { const p = await open({ path: '?tab=plan', init: hook(`const w = x.versions[0]; delete w.student.volume; w.plan.weeks.find((k) => k.week === -7).km = 44;`) });
    const row = ((await p.innerText('#s10-week')).replace(/\s+/g, ' ').match(/-7 \d+[^А-Я]{0,12}МПК[^-]*?(\d+) км/) || [])[1];
    check('small week: easy runs fit the volume (44 km week, works 40 → 44, not 58)', row === '44', row);
    await p.close(); }
  { const p = await open({ path: '?newbie' });
    await p.click('[data-act=onbnone]'); await wait(300);
    const v = await p.inputValue('textarea[data-g=prompt]'), focused = await p.evaluate(() => document.activeElement?.dataset?.g);
    check('no race: «о себе и цели» filled «заполни как есть, там посмотрим», focused', v === 'заполни как есть, там посмотрим' && focused === 'prompt', `${v} / ${focused}`);
    await p.close(); }
  { const p = await open({ path: '?newbie' });
    await p.fill('[data-o=d]', '2026-12-06'); await p.fill('[data-o=name]', 'Valencia'); await p.fill('[data-o=goal]', '3:20'); await p.click('[data-act=onbok]'); await wait(800);
    const v = await p.inputValue('textarea[data-g=prompt]');
    check('race with a goal: «о себе и цели» filled from it', v === 'Марафон 6 дек, Valencia, цель 3:20:00.', v);
    await p.close(); }
  { const p = await open({ path: '?tab=plan' }); await p.click('[data-act=pchoose]'); await wait(200); await p.click('[data-act=ptab][data-k=new]'); await wait(200);
    const v = await p.inputValue('textarea[data-g=prompt]');
    check('athlete with a race: the box carries the race and forecast', v === 'Марафон 6 дек, Valencia, цель 3:19:59.', v);
    await p.close(); }
  { const p = await open({ path: '?newbie' });
    await p.click('[data-act=onbnone]'); await wait(200); await p.click('[data-act=ptab][data-k=new]').catch(() => {}); await wait(150);
    const def = await p.inputValue('[data-g=weeks]');
    await p.fill('[data-g=weeks]', '12'); await p.press('[data-g=weeks]', 'Tab'); await wait(150);
    await p.fill('textarea[data-g=prompt]', 'Марафон'); await p.click('[data-act=gen]'); await wait(4000);
    check('generator: «Недель» decides the plan length (no race: 2 by default)', def === '2' && (await p.innerText('#s10-week')).includes('План готов: 12 недель'), `default ${def}`);
    await p.close(); }
  { const p = await open({ path: '?newbie' });
    const once = !!(await p.$('.w-dlg')); await p.click('[data-act=onbnone]'); await wait(200);
    await p.reload(); await wait(900);
    check('demo ?newbie: a new athlete, afresh on every visit', once && !!(await p.$('.w-dlg')) && (await p.getAttribute('.w-top .w-ava', 'aria-label')).includes('Новый'));
    await p.close(); }
  { const p = await open();
    const tg = await p.$eval('.w-foot a[href^="https://t.me/"]', (a) => ({ href: a.href, text: a.innerText, blank: a.target === '_blank' && a.rel.includes('noopener') })).catch(() => null);
    check('footer: Telegram chat for questions and feedback', tg && tg.href === 'https://t.me/+wP4aOZ4910I2MTk6' && tg.blank && tg.text.includes('Telegram'), JSON.stringify(tg));
    await p.close(); }
  { const p = await open({ path: '?tab=plan' });
    check('athlete with a race and paces: no start window', !(await p.$('.w-dlg')));
    await p.close(); }

  // 7c. the header: the S10 menu on the left, the profile with the avatar on the right
  { const p = await open({ w: 390 });
    const ava = await p.$eval('.w-top .w-ava', (a) => ({ href: a.getAttribute('href'), text: a.innerText, img: !!a.querySelector('img') }));
    check('header: avatar links to the profile, initials without a photo', ava.href === 'https://s10.run/profile?1000000001' && ava.text === 'С' && !ava.img, JSON.stringify(ava));
    const before = await box(p, '.w-tabbar');
    await p.click('.w-top .w-menub'); await wait(250);
    const links = await p.$$eval('.w-sitemenu a', (l) => l.map((a) => `${a.innerText} ${a.getAttribute('href')}`));
    check('header: the menu opens with the site\'s links', links.includes('Задачи https://s10.run/student?1000000001&v2=1') && links.includes('Мой профиль https://s10.run/profile?1000000001') && links.includes('Выйти https://s10.run/logout') && !links.some((l) => l.startsWith('Премиум')), links.join(' | '));
    check('header: the menu covers the page, focus on its button', await p.evaluate(() => document.activeElement?.matches('.w-navwrap .w-menub') && document.querySelector('main').inert));
    await p.keyboard.press('Escape'); await wait(250);
    check('header: Escape closes the menu, focus back, nothing moved', !(await p.$('.w-navwrap')) && await p.evaluate(() => document.activeElement?.matches('.w-top .w-menub') && !document.documentElement.style.overflow) && (await box(p, '.w-tabbar')) === before);
    check('no errors in the header', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  { const p = await browser.newPage({ viewport: { width: 1280, height: 900 } }); p.errors = []; p.on('pageerror', (x) => p.errors.push(x.message));
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwAEAQH/7yMK/QAAAABJRU5ErkJggg==', 'base64'); // 1×1
    await p.route(/avatar-ok/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG })); await p.addInitScript(hook(`x.me.avatarUrl = 'https://s10.run/avatar-ok.png'; x.me.isPremium = false`));
    await p.goto(BASE); await wait(1000);
    check('header: the avatar photo when the profile has one', !!(await p.$('.w-top .w-ava img[src="https://s10.run/avatar-ok.png"]')));
    await p.click('.w-top .w-menub'); await wait(250);
    check('header: «Премиум» in the menu without premium', (await p.$$eval('.w-sitemenu a', (l) => l.map((a) => a.innerText))).includes('Премиум'));
    await p.close(); }
  { const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.route(/avatar-broken/, (r) => r.fulfill({ status: 404, body: '' })); await p.addInitScript(hook(`x.me.avatarUrl = 'https://s10.run/avatar-broken.jpg'`));
    await p.goto(BASE); await wait(1000);
    check('header: a broken avatar leaves the initials', !(await p.$('.w-top .w-ava img')) && (await p.innerText('.w-top .w-ava')) === 'С');
    await p.close(); }
  // 7d. the weekly planner on a phone: a long template name in «Заменить на…» must not push the cards off the screen
  // (on s10.run the site's templates have names far longer than the demo's; Safari sizes a select by its longest option)
  for (const w of [360, 390]) {
    const LONGTPL = `x.templates[0].items.push('5 по 1 км по Т21-5 через 60 секунд трусцой, разминка и заминка по 3 км лёгким бегом, после работы 6 ускорений по 100 м [14,3,] Километровые отрезки по Т21-5 с ускорениями после основной работы для подготовки к полумарафону')`;
    const p = await open({ w, path: '?open=plan', init: hook(LONGTPL) }); await wait(1200);
    const r = await p.evaluate(() => { const vw = document.documentElement.clientWidth, bad = [...document.querySelectorAll('#s10-week .w-work, #s10-week .w-work *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > Math.min(vw, e.closest('.w-work').getBoundingClientRect().right) + 0.5; });
      return { opt: Math.max(...[...document.querySelectorAll('.w-work select option')].map((o) => o.textContent.length)), bad: bad.map((e) => e.className || e.tagName).slice(0, 4), page: document.documentElement.scrollWidth - vw }; });
    check(`planner cards stay inside at ${w}px with a long template`, r.opt > 90 && !r.bad.length && r.page <= 0, JSON.stringify(r));
    await p.close();
  }

  // 7e. readiness: six made-up weeks before 31 Oct (Tue easy, Wed intervals, Thu easy, Fri a pace-only tempo, Sun long)
  const HISTORY = (run, tempo = '4:32') => `{
    const add = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const W = { 1: [1, '5:40-6:00', 10], 2: [3, '3 км разминка 5×1000 м 3:50-3:55 отдых 400 м 2 км заминка', 12], 3: [1, '5:40-6:00', 8], 4: [2, '4:30-4:35', 10], 6: [5, '5:20', 25] };
    const L = x.diary.diaryTasksInfo.filter((r) => r.date >= '2026-10-31');
    for (let d = '2026-09-19'; d < '2026-10-31'; d = add(d, 1)) { const w = (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7, p = W[w];
      if (p) L.push({ date: d, type: p[0], comment: p[1], target: p[2], tracks: ${run} ? [{ type: 'run', km: p[2], pace: p[0] === 2 ? '${tempo}' : '5:00', time: '1:00:00', json: { subtype: 'RUNNING' } }] : [] }); }
    x.diary.diaryTasksInfo = L;
  }`;
  const ready = async (mod) => { const p = await open({ init: hook(mod) }); await wait(400);
    const r = { pct: await p.$eval('.w-stat-r .v', (x) => x.innerText.replace(/\s/g, '')), s: await p.$eval('.w-stat-r .s', (x) => x.innerText) };
    await p.click('[data-act=ready]'); await wait(300); r.card = await p.$eval('.w-ready', (x) => x.innerText).catch(() => ''); r.tab = p.url().includes('tab=plan'); r.errors = p.errors.join('; '); await p.close(); return r; };
  { const r = await ready(HISTORY(true));
    check('readiness: every workout done in its pace, forecast = goal: 100%', r.pct === '100%' && r.card.includes('12 из 12 выполнено, 6 из 6 в заданном темпе') && r.card.includes('6 из 6, самая длинная пробежка 25 км') && r.card.includes('перерывов больше 4 дней не было'), `${r.pct} ${r.card.slice(0, 160)}`);
    check('readiness: «подробнее» opens the plan tab at the card', r.tab && r.card.startsWith('Готовность к цели') && !r.errors, r.errors); }
  { const r = await ready(HISTORY(false));
    check('readiness: nothing run: 0%, the break shown', r.pct === '0%' && r.s.includes('низкая') && r.card.includes('0 из 12 выполнено') && r.card.includes('без бега'), `${r.pct} ${r.s}`); }
  { const r = await ready(HISTORY(true, '4:50'));
    check('readiness: tempos 15 s too slow lower the key workouts', r.card.includes('0 из 6 в заданном темпе') && +r.pct.replace('%', '') >= 85 && +r.pct.replace('%', '') <= 92, r.pct); }
  { const r = await ready(HISTORY(true) + `; x.results[0].prehms = Math.round(11999 * 1.04)`);
    check('readiness: S10 forecast 4% slower than the goal takes 20% off', r.pct === '80%' && r.card.includes('прогноз медленнее цели'), `${r.pct} ${(r.card.match(/Прогноз S10.*/) || [''])[0]}`); }
  { const p = await open({ path: '?newbie', init: hook() }); await p.click('[data-act=onbnone]'); await wait(300);
    check('readiness: a new athlete gets «мало данных», not a figure', (await p.$eval('.w-stat-r', (x) => x.innerText)).includes('мало данных') && (await p.$eval('.w-stat-r .w-lb', (x) => x.innerText)) === 'Выполнение плана');
    await p.close(); }

  // 8. no sideways scroll
  for (const w of [360, 390, 768, 1024, 1440]) {
    const p = await open({ w }); let worst = -1e9;
    for (const t of ['week', 'plan', 'paces']) { await p.click('#tab-' + t); await wait(150); worst = Math.max(worst, await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
    check(`no sideways scroll at ${w}px`, worst <= 0);
    await p.close();
  }

  await browser.close();
  if (srv) srv.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
