// Checks for the S10 «Моя неделя» page, run against the demo (no network, nothing is sent anywhere).
//   python3 -m http.server 8766 --bind 127.0.0.1     (in the repo root, in a second terminal)
//   node tests/check.cjs                              (needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium)
// BASE=<url of demo/> overrides the address. Exit code 1 if any check fails.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8766/demo/';

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
// changes the demo data before the page reads it; also records every task write
const hook = (mod = '', failOn = 0) => `(() => { let v; Object.defineProperty(window, 'S10_FIXTURES', { configurable: true, get() { return v; }, set(x) { ${mod}; v = x; } });
  window.__posts = 0; window.__days = []; const ap = FormData.prototype.append;
  FormData.prototype.append = function (k, val) { if (k === 'tasks') { window.__posts++; if (${failOn} && window.__posts === ${failOn}) throw new Error('500'); window.__days.push(...JSON.parse(val).map((t) => t.d)); } return ap.apply(this, arguments); }; })()`;

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const open = async ({ w = 1280, h = 900, path = '', init = null } = {}) => {
    const p = await browser.newPage({ viewport: { width: w, height: h } }); p.errors = [];
    p.on('pageerror', (x) => p.errors.push(x.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    if (init) await p.addInitScript(init);
    await p.goto(BASE + path); await wait(800); return p;
  };
  const box = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? `${Math.round(r.x)},${Math.round(r.y)}` : null; }, sel);

  // 1. the week view
  { const p = await open();
    check('page loads without errors', !p.errors.length, p.errors.join('; '));
    check('summary: volume and days to race', (await p.$$eval('.w-stat .w-lb', (l) => l.map((x) => x.textContent))).join('|') === 'Объём недели|До старта');
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
  for (const w of [1440, 768, 390]) {
    const p = await open({ w, path: '?tab=plan' });
    const rel = () => p.evaluate(() => { const s = document.querySelector('.w-sum').getBoundingClientRect(); return ['[data-act=pversion]', '[data-act=fillask]', '[data-act=span][data-k=race]'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return `${Math.round(r.x - s.x)},${Math.round(r.y - s.y)}`; }).join(' '); });
    const a = await rel(); await p.evaluate(() => document.querySelector('[data-act=span][data-k=race]').click()); await wait(150);
    const b = await rel(); await p.evaluate(() => document.querySelector('[data-act=span][data-k="2w"]').click()); await wait(150);
    const c = await rel();
    check(`fill buttons stay put at ${w}px`, a === b && b === c);
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

  // 8. no sideways scroll
  for (const w of [360, 390, 768, 1024, 1440]) {
    const p = await open({ w }); let worst = -1e9;
    for (const t of ['week', 'plan', 'paces']) { await p.click('#tab-' + t); await wait(150); worst = Math.max(worst, await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
    check(`no sideways scroll at ${w}px`, worst <= 0);
    await p.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
