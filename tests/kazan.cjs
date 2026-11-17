// Checks for the Kazan marathon mode, run against the demo (no network, nothing is sent anywhere).
//   npm test        (serves the repo root itself on a free local port)
// BASE=<url of demo/> checks another address instead. Exit code 1 if any check fails.
// REACT=1 (npm run react): the release checks (7–10) run on react-src/ as the developers' app would run it (tests/react:
// webpack, ReactDOM.render, <SoloKazan /> at /solo/kazan, <SoloPlan /> at /solo/plan), plus unmount/remount; the
// demo-only checks are left out.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

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
const REACT = !!process.env.REACT, DEMO = !REACT;
const REACT_SHELL = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#f4f4f4}</style></head><body><div id="app"></div><script src="/app.js"></script></body></html>';
// the release build (release/, `node deploy/build.cjs` first) as s10.run would serve it at /solo/kazan, its API answered
// by `site()` below from the demo snapshot (as tests/release.cjs does)
const REL = path.join(ROOT, 'release');
global.window = {}; require(path.join(ROOT, 'demo', 'fixtures.js')); const BASE_FX = JSON.stringify(window.S10_FIXTURES);
const serveRelease = () => new Promise((resolve) => {
  const srv = http.createServer((q, r) => {
    const p = new URL(q.url, 'http://x').pathname;
    if (REACT && (p === '/solo/kazan' || p === '/solo/plan')) { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end(REACT_SHELL); }
    if (REACT && p === '/app.js') { r.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); return r.end(fs.readFileSync(path.join(__dirname, 'react', 'dist', 'app.js'))); }
    const f = p === '/solo/kazan' || p === '/solo/plan' ? path.join(REL, 'solo.html') : p === '/t5/solo/solo.js' ? path.join(REL, 't5', 'solo', 'solo.js') : null;
    if (!f) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); r.end(fs.readFileSync(f));
  });
  srv.listen(0, '127.0.0.1', () => resolve(srv));
});
let RBASE = '';
// FormData bodies arrive as multipart: the value of one field
const formField = (body, name) => { const m = String(body).match(new RegExp(`name="${name.replace(/[[\]]/g, '\\$&')}"\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n--`)); return m ? m[1] : null; };
const decodeTasks = (body) => { const v = formField(body, 'tasks'); return v ? JSON.parse(v) : []; };
// the site's API on the snapshot FX; unlike tests/release.cjs it keeps what is written (diary days, the plan versions, the
// main race: a day written with main6 1 becomes it, as task.php does), so a second fill and a later visit with the same FX
// see them. `FX.mainOf[id]`: another profile's main race (a coach opening an athlete); `writes.reads`: the GET addresses
async function site(page, FX) {
  const writes = []; writes.reads = [];
  const idOf = (u) => (u.match(/[?&]id=(\d+)/) || [])[1];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/(apiweb|student\?|t7\/plan-templates)/, async (route) => {
    const req = route.request(), u = req.url();
    if (req.method() === 'POST') {
      if (u.includes('generate.php')) return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: FX.generated });
      const body = req.postData() || ''; writes.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), body });
      if (FX.slow && u.includes('task.php')) await wait(FX.slow); // `FX.slow`: the diary answers late (a write in progress)
      if (u.includes('task.php')) for (const t of decodeTasks(body)) {
        const list = FX.diary.diaryTasksInfo, i = list.findIndex((x) => x.date === t.d);
        if (!t.task) { if (i >= 0) list.splice(i, 1); continue; }
        const row = { date: t.d, type: +t.typtrain, comment: t.task, target: +t.prekm, main6: +t.main6 || 0, location: t.location, prediction: t.prediction, tracks: i >= 0 ? list[i].tracks : [] };
        if (i >= 0) list[i] = row; else list.push(row);
        if (+t.main6 === 1) { const m = { main: { d: t.d, task: t.task, prekm: t.prekm, typtrain: +t.typtrain, prediction: t.prediction, location: t.location } }; if (FX.mainOf?.[idOf(u)]) FX.mainOf[idOf(u)] = m; else FX.main = m; }
      }
      const pl = formField(body, `param[studentPlans${FX.me.id}]`); if (pl) FX.versions = JSON.parse(pl);
      return json(route, u.includes('task.php') ? { message: {} } : { ok: true });
    }
    writes.reads.push(u.replace(/^https?:\/\/[^/]+/, ''));
    if (u.includes('/student/self/info')) return json(route, FX.me);
    if (u.includes('task.php?action=main')) return json(route, FX.mainOf?.[idOf(u)] || FX.main);
    if (u.includes('studentMainStart')) return json(route, FX.startParam);
    if (u.includes('planresults.php')) return json(route, FX.results);
    if (u.includes('/student?')) return json(route, { diaryTasksInfo: FX.diary.diaryTasksInfo, diaryTasksisMoreExist: 0 });
    if (u.includes('tasktemplates.php')) return json(route, FX.templates);
    if (u.includes('param[]=studentPlans')) return json(route, { param: { [`studentPlans${FX.me.id}`]: JSON.stringify(FX.versions) } });
    if (u.includes('param[]=planTemplates')) return json(route, { param: { planTemplates: JSON.stringify(FX.library) } });
    if (u.includes('param[]=soloGen')) return json(route, { param: { soloGen: null } });
    if (u.includes('calc.php')) return json(route, FX.base);
    return route.fulfill({ status: 404, body: '' });
  });
  return writes;
}
const last = (a) => a[a.length - 1];
const add = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = BASE ? null : await serve();
  if (srv) BASE = `http://127.0.0.1:${srv.address().port}/demo/`;
  const rsrv = await serveRelease(); RBASE = `http://127.0.0.1:${rsrv.address().port}`;
  const browser = await chromium.launch();
  // `init`: a script run before the page's own (e.g. KZMAIN: the demo snapshot's main race made the Kazan marathon)
  const open = async (query = '', init = null) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } }); p.errors = [];
    p.on('pageerror', (x) => p.errors.push(x.message)); if (init) await p.addInitScript(init);
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto(BASE + query); await p.waitForFunction(() => document.querySelector('#s10-week .w-tabbar, #s10-week .w-dlg, main h1'), null, { timeout: 20000 }).catch(() => {}); await wait(300); return p;
  };

  // 1. the owner's plan and its parser
  if (DEMO) { const p = await open('?kazan');
    const file = fs.readFileSync(path.join(ROOT, 'plans/kazan-2027.md'), 'utf8');
    const same = await p.evaluate((f) => window.S10_TEST?.KAZAN_PLAN_MD === f, file);
    check('kazan plan: embedded text equals plans/kazan-2027.md', same);
    const r = await p.evaluate(() => window.S10_TEST ? window.S10_TEST.parseTemplateMd(window.S10_TEST.KAZAN_PLAN_MD) : null);
    const ws = r?.weeks || [], by = (n) => ws.find((w) => w.week === n);
    check('kazan plan: 24 weeks -24…-1, 3 slots each, no errors', r && ws.length === 24 && ws.every((w, i) => w.week === i - 24 && w.slots.length === 3) && r.errors.length === 0, r ? `${ws.length} weeks, errors ${r.errors}` : 'no hook');
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    check('kazan plan: week -24 km = 37.2, week -6 = 99, week -1 = 49.2 (header 45 ignored)', r && by(-24) && by(-6) && by(-1) && near(by(-24).km, 37.2) && near(by(-6).km, 99) && near(by(-1).km, 49.2), ws.length ? [-24, -6, -1].map((n) => by(n)?.km).join(' / ') : 'no hook');
    const t = by(-1)?.slots;
    check('kazan plan: week -1 slot 2 is «длительная» 0 km, slot 3 «соревнование» 42.2', t && t[1].type === 'длительная' && t[1].km === 0 && t[2].type === 'соревнование' && t[2].km === 42.2);
    check('kazan plan: page loads without errors', !p.errors.length, p.errors.join('; '));
    // a malformed snippet: a slot before any header (1), an unknown type (3), a line in no known form (5)
    const bad = await p.evaluate(() => window.S10_TEST?.parseTemplateMd('- Интервальная | рано | 5 км\n## Неделя -2 | База | 10 км\n- Бег | что-то | 5 км\n- Длительная | 20 км по T42+45 | 20 км\nчто это'));
    check('kazan plan: malformed lines reported by number (1, 3, 5)', bad && bad.errors.join() === '1,3,5' && bad.weeks.length === 1 && bad.weeks[0].slots.length === 1 && bad.weeks[0].km === 30, bad ? `errors ${bad.errors}, ${bad.weeks.length} weeks` : 'no hook');
    const weeksOk = await p.evaluate(() => { const T = window.S10_TEST; if (!T?.kazanWeeksOf) return null; const md = T.KAZAN_PLAN_MD;
      return { whole: T.kazanWeeksOf(md)?.length, gap: T.kazanWeeksOf(md.replace(/## Неделя -24[\s\S]*?(?=## Неделя -23)/, '')), err: T.kazanWeeksOf(md + '\nстрока не по формату\n') }; });
    check('kazan plan: laid only when its weeks are exactly -24…-1 and it parses clean', weeksOk && weeksOk.whole === 24 && weeksOk.gap === null && weeksOk.err === null, JSON.stringify(weeksOk));
    await p.close(); }

  // 2. the Kazan mode: the race fixed, the goal picked on the page
  const pct = (p) => p.$eval('.w-stat-r .v', (x) => parseInt(x.innerText, 10));
  const goal = async (p, g) => { await p.click(`[data-act=kgoal][data-g="${g}"]`); await wait(250); };
  if (DEMO) { const p = await open('?kazan');
    const h1 = await p.$eval('h1', (x) => x.innerText).catch(() => '');
    check('kazan: h1 «Казанский марафон» and «2 мая»', h1.includes('Казанский марафон') && h1.includes('2 мая') && h1.includes('2027'), h1);
    const btns = await p.$$eval('[data-act=kgoal]', (l) => l.map((x) => [x.dataset.g, x.getAttribute('aria-pressed'), x.innerText.trim()]));
    check('kazan: goal picker, 3:30 pressed by default', btns.map((b) => b[0]).join() === '3:00:00,3:30:00,4:00:00' && btns.map((b) => b[1]).join() === 'false,true,false' && btns.map((b) => b[2]).join() === '3:00,3:30,4:00', JSON.stringify(btns));
    check('kazan: no start window', !(await p.$('.w-dlg')));
    const c330 = await pct(p);
    const box = async () => p.$eval('[data-act=kgoal][data-g="3:30:00"]', (x) => { const r = x.getBoundingClientRect(); return [r.x, r.y, r.width].map(Math.round).join(); });
    const b0 = await box();
    await goal(p, '3:00:00'); const c300 = await pct(p);
    const pressed = await p.$$eval('[data-act=kgoal]', (l) => l.map((x) => x.getAttribute('aria-pressed')).join());
    const b1 = await box();
    await goal(p, '4:00:00'); const c400 = await pct(p);
    check('kazan: switching goal moves «Вероятность достижения цели»', c300 < c330 && c330 < c400 && pressed === 'true,false,false', `3:00 ${c300}%, 3:30 ${c330}%, 4:00 ${c400}%`);
    check('kazan: the goal picker does not jump on click', b0 === b1, `${b0} → ${b1}`);
    const race = (await p.$eval('.w-goal', (x) => x.innerText).catch(() => '')).replace(/\s+/g, ' '); // nowrap parts read with no-break spaces
    check('kazan: the summary names Казань, 2 мая', race.includes('Казань') && race.includes('2 мая') && !race.includes('цель'), race);
    await p.click('[data-act=tab][data-k=paces]'); await wait(250);
    const want = await p.evaluate(() => [window.S10_TEST?.pacesFromGoal?.(42.195, 3 * 3600)?.[42], window.S10_TEST?.pacesFromGoal?.(42.195, 4 * 3600)?.[42]]);
    const t42at400 = await p.inputValue('input[data-k="42"]');
    await goal(p, '3:00:00'); const t42at300 = await p.inputValue('input[data-k="42"]');
    check('kazan: 3:00 → T42 4:16, 4:00 → T42 5:41', t42at300 === '4:16' && t42at400 === '5:41' && want[0] === '4:16' && want[1] === '5:41', `page ${t42at300} / ${t42at400}, pacesFromGoal ${want}`);
    const srcSel = await p.$eval('select[data-p=pacesrc]', (x) => [x.value, x.selectedOptions[0].text]).catch(() => []);
    check('kazan: paces come «от цели»', srcSel[0] === 'goal' && /от цели 3:00/i.test(srcSel[1] || ''), srcSel.join(' / '));
    await p.click('[data-act=tab][data-k=plan]'); await wait(300);
    const planTab = await p.evaluate(() => ({ chooser: !!document.querySelector('[data-act=pchoose], .w-chooser, [data-act=psel]'), gen: !!document.querySelector('[data-act=gen], textarea[data-g=prompt]'), goalBtns: !!document.querySelector('[data-act=goaladd], [data-act=racereset]'), text: document.body.innerText, weeks: document.querySelectorAll('.w-wk').length, per: document.querySelector('.w-wk .w-per')?.innerText || '' }));
    check('kazan: no plan chooser, no generator, no «Добавить цель»/«Сбросить»', !planTab.chooser && !planTab.gen && !planTab.goalBtns && !/Добавить цель|Изменить цель|Сбросить|Сменить план|Сгенерировать/.test(planTab.text), JSON.stringify({ ...planTab, text: undefined }));
    check('kazan: the plan tab lays the 24 weeks of the plan with their phases', planTab.weeks === 24 && planTab.per === 'База' && /Мастер-план «Казань 3:00»/.test(planTab.text), `${planTab.weeks} weeks, «${planTab.per}»`);
    check('kazan: no page errors', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  if (DEMO) { const p = await open('?kazan&tab=paces'); // Review Focus 2: the athlete's own paces stay when the goal changes
    await p.fill('input[data-k="42"]', '4:50'); await p.press('input[data-k="42"]', 'Tab'); await wait(300);
    const c0 = await pct(p);
    await goal(p, '3:00:00');
    const after = [await p.inputValue('input[data-k="42"]'), await p.$eval('select[data-p=pacesrc]', (x) => x.value)];
    check('kazan: own paces typed in «Мои темпа» survive a goal switch', after[0] === '4:50' && after[1] === 'own' && (await pct(p)) !== c0, after.join(' / '));
    await p.close(); }
  // the re-plan is offered once Kazan is the diary's main race (fix round 1): the demo's main race made Kazan
  const KZMAIN = () => { let v; Object.defineProperty(window, 'S10_FIXTURES', { configurable: true, get: () => v, set: (x) => { x.main = { main: { d: '2027-05-02', task: 'ГОНКА', prekm: '42.2', typtrain: 6, prediction: '03:30:00', location: 'Казань' } }; v = x; } }); };
  // 3. a re-plan in the Kazan mode: the re-planned weeks are what is stored and shown; undo brings back the plan and volume
  const stored = (p) => p.evaluate(() => (window.S10_FIXTURES.versions || []).filter((v) => /^Казань/.test(v.name || '')).map((v) => ({ id: v.id, name: v.name, active: !!v.active, filled: v.filled, undo: !!v.undo, km: v.plan.weeks.map((w) => w.km).join(), vol: v.student?.volume })));
  if (DEMO) { const p = await open('?kazan&tab=plan', KZMAIN);
    const orig = await p.evaluate(() => window.S10_TEST?.kazanWeeksOf(window.S10_TEST.KAZAN_PLAN_MD).map((w) => w.km).join());
    await p.fill('input[data-p=volume]', '30'); await p.press('input[data-p=volume]', 'Tab'); await wait(300);
    await p.click('[data-act=rprules]'); await wait(300);
    const canApply = await p.$eval('[data-act=rpapply]', (b) => !b.disabled).catch(() => false);
    await p.click('[data-act=rpapply]').catch(() => {}); await wait(2500);
    const vs = await stored(p), rv = vs.find((v) => v.active && /перестроен/.test(v.name));
    const shown = await p.evaluate(() => { const P = window.S10_TEST?.plan?.(); return P ? { name: P.name, km: P.plan.weeks.map((w) => w.km).join() } : null; });
    const head = await p.$eval('#w-plan2-h', (x) => x.innerText).catch(() => '');
    check('kazan re-plan: the stored and the shown weeks are the re-planned ones', canApply && rv && rv.km !== orig && shown && shown.km === rv.km && head.includes('перестроен'), `apply ${canApply}, stored ${rv ? rv.name : 'none'}, shown ${shown ? shown.name : 'none'}, «${head}»`);
    const volRe = await p.inputValue('input[data-p=volume]');
    await p.click('[data-act=undoask]'); await wait(200); await p.click('[data-act=undoyes]'); await wait(2500);
    const back = await p.evaluate(() => { const P = window.S10_TEST?.plan?.(); return P ? P.plan.weeks.map((w) => w.km).join() : null; });
    const volBack = await p.inputValue('input[data-p=volume]');
    check('kazan re-plan undo: the plan and the first-week volume come back', back === orig && volBack === '30' && !(await p.$eval('#w-plan2-h', (x) => x.innerText)).includes('перестроен'), `volume ${volRe} → ${volBack}, weeks ${back === orig ? 'original' : 'not original'}`);
    const left = await stored(p);
    check('kazan re-plan undo (built-in plan): the one Kazan version holds the plan\'s own weeks and name again', left.length === 1 && left[0].km === orig && left[0].name === 'Казань 3:30', JSON.stringify(left.map((v) => ({ name: v.name, active: v.active, orig: v.km === orig }))));
    check('kazan re-plan: no page errors', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  // 4. two fills in one session keep one Kazan version, with the first fill's range and the undo record
  if (DEMO) { const p = await open('?kazan&tab=plan');
    const fillOnce = async () => { await p.click('[data-act=fillask]'); await wait(200); await p.click('[data-act=fillyes]'); await wait(150); if (await p.$('[data-act=kmainyes]')) await p.click('[data-act=kmainyes]'); await p.waitForFunction(() => !document.querySelector('[data-act=fillyes]') && document.querySelector('.w-flash'), null, { timeout: 20000 }).catch(() => {}); await wait(500); };
    await fillOnce(); const v1 = await stored(p);
    await fillOnce(); const v2 = await stored(p);
    const meta = await p.$eval('.w-pmeta', (x) => x.innerText).catch(() => '');
    check('kazan: two fills in one session leave one Kazan version with filled.from and undo', v1.length === 1 && v2.length === 1 && v2[0].id === v1[0].id && v2[0].active && v2[0].filled?.from === v1[0].filled?.from && v2[0].filled?.to > v1[0].filled?.to && v2[0].undo, JSON.stringify(v2.map((v) => ({ ...v, km: undefined }))));
    check('kazan: after a fill the plan reads «в вашем профиле, в календаре по …»', /в вашем профиле, в календаре по/.test(meta), meta);
    check('kazan fills: no page errors', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  // 5. the goal sets the volume: the week's target and the long run scale with it; the race week has no easy runs
  if (DEMO) { const p = await open('?kazan');
    const sl = (d, km, f) => p.evaluate(([d, km, f]) => window.S10_TEST?.scaleLongDesc?.(d, km, f) || null, [d, km, f]);
    // the parts of a long run after its length: «K по N км» = K×N, «через M км» right after it = (K−1)×M, else N
    const parts = (s) => { let k = 0; return (s.match(/\d+ по \d+ км|через \d+ км|\d+ км/g) || []).slice(1).reduce((a, x) => { const m = x.match(/(\d+) по (\d+)/), n = +x.match(/(\d+) км/)[1], v = m ? +m[1] * +m[2] : /^через/.test(x) && k ? (k - 1) * n : n; k = m ? +m[1] : 0; return a + v; }, 0); };
    const D26 = '26 км. Первые 20 км по T42+45, последние 6 км по T42';
    const a = await sl(D26, 26, 0.7);
    check('scaleLongDesc: 26 км ×0.7 → «18 км. Первые 14 км …, последние 4 км …», 18', a && a.km === 18 && a.desc === '18 км. Первые 14 км по T42+45, последние 4 км по T42', JSON.stringify(a));
    const b = await sl(D26, 26, 0.85);
    check('scaleLongDesc: 26 км ×0.85 → 22 км, parts 17 + 5', b && b.km === 22 && b.desc === '22 км. Первые 17 км по T42+45, последние 5 км по T42', JSON.stringify(b));
    // Review Focus 3: «3 по 4 км … через 1 км» counts as 3×4 + 2×1; the «3 по» stays, the km in «по 4 км» and «1 км» scale
    const c = await sl('28 км. Первые 10 км по T42+45, потом 3 по 4 км по T42 через 1 км трусцой, последние 4 км трусцой', 28, 0.7);
    check('scaleLongDesc: «3 по 4 км … через 1 км» ×0.7 → 20 км, its parts add up to 20, «3 по» kept', c && c.km === 20 && c.desc.startsWith('20 км.') && / 3 по \d+ км по T42 через \d+ км трусцой/.test(c.desc) && parts(c.desc) === 20, JSON.stringify(c));
    // a re-plan's long run: km changed, text kept (rules: shortened; AI: km divided back by the goal's scale)
    const r1 = await sl('32 км. Первые 12 км по T42+45, потом 18 км по T42, последние 2 км трусцой', 24, 0.85), r2 = await sl('22 км спокойно по T42+50', 25.9, 0.85);
    check('scaleLongDesc: a re-planned km with the old text → the text from its own length (20 км, parts 20; 22 км unchanged)', r1 && r1.km === 20 && r1.desc.startsWith('20 км.') && parts(r1.desc) === 20 && r2 && r2.km === 22 && r2.desc === '22 км спокойно по T42+50', JSON.stringify([r1, r2]));
    // fix round 1: a re-planned km equal to an inner part: the opening «24 км» is the head, not «20 км»
    const r3 = await sl('24 км. Первые 20 км по T42+50, последние 4 км по T42', 20, 0.85);
    check('scaleLongDesc: re-planned km = an inner part (24 км text, 20 km, ×0.85) → head 17 = km, parts sum 17', r3 && r3.km === 17 && r3.desc.startsWith('17 км.') && parts(r3.desc) === 17, JSON.stringify(r3));
    // fix round 1: «первые/последние 1 км» → «первый/последний 1 км», the capital kept
    const g1 = await sl('30 км. Первые 10 км по T42+45, потом 2 по 8 км по T42 через 1 км трусцой, последние 3 км трусцой', 30, 0.7);
    const g2 = await sl('6 км. Первые 3 км по T42+45. Последние 3 км по T42', 6, 0.5), g3 = await sl('10 км: первые 2 км трусцой, потом 8 км по T42', 10, 0.5);
    check('scaleLongDesc: «последние 1 км» → «последний 1 км», «Последние» → «Последний», «первые 1 км» → «первый 1 км»', g1 && /, последний 1 км трусцой$/.test(g1.desc) && g2 && g2.desc === '3 км. Первые 2 км по T42+45. Последний 1 км по T42' && g3 && g3.desc === '5 км: первый 1 км трусцой, потом 4 км по T42', JSON.stringify([g1?.desc, g2?.desc, g3?.desc]));
    // final review, Minor 5: an unnamed «остаток» keeps at least 1 km, the first part gives it up (week −6 at 4:00, and
    // at 4:00 in a soft week ×0.75)
    const D6 = '32 км. Первые 12 км по T42+45, потом 3 по 5 км по T42 через 1 км трусцой, остаток трусцой';
    const o1 = await sl(D6, 32, 0.7), o2 = await sl(D6, 32, 0.7 * 0.75);
    check('scaleLongDesc: «остаток» never 0 km (week −6 at 4:00 → 22 км, first 7; ×0.75 → 17 км, first 5)', o1 && o1.km === 22 && o1.desc === '22 км. Первые 7 км по T42+45, потом 3 по 4 км по T42 через 1 км трусцой, остаток трусцой' && parts(o1.desc) === 21
      && o2 && o2.km === 17 && o2.desc === '17 км. Первые 5 км по T42+45, потом 3 по 3 км по T42 через 1 км трусцой, остаток трусцой' && parts(o2.desc) === 16, JSON.stringify([o1, o2]));
    const z = await sl('Потрусите как пойдёт, бег без обязательств', 0, 0.7);
    check('scaleLongDesc: «Потрусите как пойдёт», 0 km → unchanged', z && z.km === 0 && z.desc === 'Потрусите как пойдёт, бег без обязательств', JSON.stringify(z));
    const weekKm = (n) => p.$eval(`[data-act=wopen][data-w="${n}"] .w-wkm`, (x) => parseFloat(x.innerText.replace(',', '.'))).catch(() => NaN);
    await goal(p, '4:00:00'); await p.click('[data-act=tab][data-k=plan]'); await wait(300);
    const k6 = await weekKm(-6);
    check('kazan 4:00: week -6 laid total ≈ 0.7 × 99 (±3 km)', Math.abs(k6 - 0.7 * 99) <= 3, `${k6} km`);
    await p.click('[data-act=wopen][data-w="-1"]'); await wait(250);
    const rw = await p.$$eval('.w-wk', (l) => { const li = l.find((x) => x.querySelector('[data-w="-1"]')); return li ? [...li.querySelectorAll('.w-wdays > li')].map((d) => [d.querySelector('.w-wdd small')?.innerText.replace(/\s+/g, ' '), d.querySelector('.w-name')?.innerText.trim(), d.querySelector('.w-wdk')?.innerText.trim()]) : []; });
    const k1 = await weekKm(-1);
    const works = rw.filter((d) => d[1] !== 'Отдых').map((d) => d[1]);
    check('kazan: race week has no easy runs, the marathon on Sunday 2 May', rw.length === 7 && works.join() === 'Интервальная,Соревнование' && rw[6][0] === '2 мая' && rw[6][1] === 'Соревнование' && Math.abs(k1 - 49.2) < 0.05, `${k1} km; ${JSON.stringify(rw)}`);
    await goal(p, '3:00:00'); await wait(100);
    const k24 = await weekKm(-24);
    check('kazan 3:00: week -24 laid total = 37 (±1)', Math.abs(k24 - 37) <= 1, `${k24} km`);
    check('kazan volume by goal: no page errors', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  // 6. long runs under a Kazan re-plan (fix round 1)
  if (DEMO) { const p = await open('?kazan&tab=plan', KZMAIN);
    await goal(p, '4:00:00');
    // S10's long-run limit is real km: at 4:00 (k 0.7) every laid long run is under 25 km, so a limit of 25 changes none
    const capped = await p.evaluate(() => { const T = window.S10_TEST, FX = window.S10_FIXTURES; if (!T?.replanByRules || !T.lay) return null;
      const longs = (r) => r.weeksNew.map((w) => T.lay(w.week, { ...T.plan(), plan: { weeks: r.weeksNew } }).days.filter((d) => d.typtrain === 5).map((d) => d.prekm)).flat();
      const keep = FX.base.param.maxlong.v; FX.base.param.maxlong.v = '999'; const a = T.replanByRules(); FX.base.param.maxlong.v = '25'; const b = T.replanByRules(); FX.base.param.maxlong.v = keep;
      return { rows: a.rows.length, free: longs(a).join(), cap: longs(b).join() }; });
    check('kazan re-plan 4:00: the long-run limit 25 km is real km (no laid long run changes)', capped && capped.rows > 0 && capped.free === capped.cap, JSON.stringify(capped));
    await goal(p, '3:00:00');
    const capped3 = await p.evaluate(() => { const T = window.S10_TEST, FX = window.S10_FIXTURES; if (!T?.replanByRules) return null;
      const keep = FX.base.param.maxlong.v; FX.base.param.maxlong.v = '25'; const r = T.replanByRules(); FX.base.param.maxlong.v = keep;
      const ls = r.weeksNew.map((w) => T.lay(w.week, { ...T.plan(), plan: { weeks: r.weeksNew } }).days.filter((d) => d.typtrain === 5).map((d) => d.prekm)).flat();
      return { max: Math.max(...ls), at25: ls.filter((x) => x === 25).length }; });
    check('kazan re-plan 3:00: the limit 25 km caps the laid long runs at 25', capped3 && capped3.max === 25 && capped3.at25 > 0, JSON.stringify(capped3));
    // the AI re-plan: its long runs are laid at the generator's km with the generator's text, and the version keeps `real`
    await goal(p, '4:00:00');
    await p.click('[data-act=rpai]'); await p.waitForSelector('[data-act=rpapply]', { timeout: 20000 }).catch(() => {}); await wait(300);
    await p.click('[data-act=rpapply]').catch(() => {}); await wait(2500);
    const ai = await p.evaluate(() => { const T = window.S10_TEST, P = T.plan(), v = (window.S10_FIXTURES.versions || []).find((x) => x.active);
      const real = P.plan.weeks.flatMap((w) => w.slots.filter((s) => s.real).map((s) => ({ week: w.week, desc: s.desc })));
      const kmOf = (t) => (String(t).match(/\d+(?:[.,]\d+)?\s*км/g) || []).join('|');
      const laid = real.map((r) => { const d = T.lay(r.week).days.find((x) => x.typtrain === 5); return { head: parseFloat(r.desc), km: d?.prekm, same: !!d && kmOf(d.task) === kmOf(r.desc) }; });
      return { name: P.name, n: real.length, stored: !!v && v.plan.weeks.some((w) => w.slots.some((s) => s.real === true)), bad: laid.filter((x) => x.km !== x.head || !x.same) }; });
    check('kazan AI re-plan 4:00: long runs laid at the generator\'s km, text unchanged; `real` stored with the version', ai && /перестроен/.test(ai.name) && ai.n > 10 && ai.stored && !ai.bad.length, JSON.stringify(ai));
    check('kazan re-plan long runs: no page errors', !p.errors.length, p.errors.join('; '));
    await p.close(); }
  // 7. the soft entry for a late athlete (Task 4). The release build at /solo/kazan against a stand-in of the site's API
  // (the demo snapshot, `me.nowmsk` per test); the stand-in keeps what is written, so a second fill and a later visit
  // see the diary and the stored version. The reference (no soft entry) is the demo's own laying: its today, 31 Oct
  // 2026, is before the plan, so nothing there is softened
  const ref = await (async () => { const p = await open('?kazan');
    const r = await p.evaluate(() => { const T = window.S10_TEST; return T.kazanWeeksOf(T.KAZAN_PLAN_MD).map((w) => ({ week: w.week, km: w.km, long: w.slots.find((s) => s.type === 'длительная')?.km || 0, lay: T.lay(w.week) })); });
    await p.close(); return Object.fromEntries(r.map((w) => [w.week, w])); })();
  const refDay = (d) => Object.values(ref).flatMap((w) => w.lay.days).find((x) => x.d === d);
  const weekOfDay = (d) => Object.values(ref).find((w) => d >= w.lay.mon && d <= add(w.lay.mon, 6))?.week;
  const K = 0.85; // the default goal 3:30
  const fxAt = (day, mod = (x) => x) => { const x = JSON.parse(BASE_FX); x.me.nowmsk = Date.parse(`${day}T09:00:00Z`) / 1000; return mod(x); };
  const kOpen = async (FX, q = '?tab=plan') => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } }); p.errors = []; p.on('pageerror', (x) => p.errors.push(x.message));
    const w = await site(p, FX); await p.goto(`${RBASE}/solo/kazan${q}`);
    await p.waitForFunction(() => document.querySelector('#s10-week .w-tabbar'), null, { timeout: 20000 }).catch(() => {}); await wait(300); return [p, w];
  };
  // a fill; the question «… станет главным стартом …» (Task 5) answered «Да» when it comes, its race-day write left out
  const kFill = async (p, w) => { const n = w.length; await p.click('[data-act=fillask]'); await wait(200); await p.click('[data-act=fillyes]');
    await wait(150); const asked = !!(await p.$('[data-act=kmainyes]')); if (asked) await p.click('[data-act=kmainyes]');
    await p.waitForFunction(() => !document.querySelector('[data-act=fillyes]') && document.querySelector('.w-flash'), null, { timeout: 20000 }).catch(() => {}); await wait(500);
    return w.slice(n).filter((x) => x.url.includes('task.php')).slice(asked ? 1 : 0).flatMap((x) => decodeTasks(x.body)).map((t) => ({ ...t, typtrain: +t.typtrain, prekm: +t.prekm })); };
  const totals = (p, ns) => Promise.all(ns.map((n) => p.$eval(`[data-act=wopen][data-w="${n}"] .w-wkm`, (x) => parseFloat(x.innerText.replace(/\s/g, '').replace(',', '.'))).catch(() => NaN)));
  const kazanV = (FX) => FX.versions.find((v) => /^Казань/.test(v.name || ''));
  const sameAsRef = (t) => { const r = refDay(t.d); return !!r && r.typtrain === t.typtrain && r.prekm === t.prekm && r.task === t.task; };
  const LATE = fxAt('2027-03-01');
  { const [p, w] = await kOpen(LATE);
    const tt = await totals(p, [-10, -9, -8, -7]);
    const tw = (n, s) => Math.round(ref[n].km * K * s);
    const okTot = Math.abs(tt[1] - tw(-9, 0.75)) <= 2 && Math.abs(tt[2] - tw(-8, 0.9)) <= 2 && tt[0] === ref[-10].lay.total && tt[3] === ref[-7].lay.total;
    const ws = await kFill(p, w), first = ws[0]?.d, byWeek = (n) => ws.filter((t) => weekOfDay(t.d) === n);
    const soft = [[-9, 0.75], [-8, 0.9]].map(([n, s]) => { const list = byWeek(n), long = list.find((t) => t.typtrain === 5), easy = list.filter((t) => t.typtrain === 1);
      const refEasy = list.reduce((a, t) => a + (refDay(t.d).typtrain === 1 ? refDay(t.d).prekm : 0), 0), refLong = ref[n].lay.days.find((d) => d.typtrain === 5)?.prekm;
      return { week: n, keys: list.filter((t) => t.typtrain >= 2 && t.typtrain <= 4).every(sameAsRef), long: long?.prekm, longWant: Math.round(ref[n].long * (K * s)), refLong, easy: easy.reduce((a, t) => a + t.prekm, 0), refEasy, n: list.length }; });
    const okSoft = soft.every((x) => x.keys && x.long === x.longWant && x.long < x.refLong && x.easy < x.refEasy && x.n);
    const after = byWeek(-7);
    check('kazan late (today 2027-03-01, week −9): first two weeks ×0.75 and ×0.9 on easy + long, key workouts unchanged', first === '2027-03-03' && okTot && okSoft && after.length && after.every(sameAsRef) && !p.errors.length,
      `first ${first}; totals -10…-7 ${tt} (want ${ref[-10].lay.total}, ≈${tw(-9, 0.75)}, ≈${tw(-8, 0.9)}, ${ref[-7].lay.total}); ${JSON.stringify(soft)}; week -7 as planned ${after.every(sameAsRef)}; ${p.errors.join('; ')}`);
    // Review Focus 5: a second «2 беговые недели» (the next pair) and a later visit keep the first fill's start
    const ws2 = await kFill(p, w), tt2 = await totals(p, [-9, -8, -7]);
    const v = kazanV(LATE);
    await p.close();
    const LATER = JSON.parse(JSON.stringify(LATE)); LATER.me.nowmsk = Date.parse('2027-03-15T09:00:00Z') / 1000; // week −7: today's own start would soften −7 and −6
    const [q] = await kOpen(LATER), tt3 = await totals(q, [-9, -8, -7, -6]);
    check('kazan late: a second «2 беговые недели» keeps kazanStart (soft weeks do not move)', v && v.student?.kazanStart === -9 && ws2.length && ws2[0].d === '2027-03-17' && ws2.every(sameAsRef)
      && tt2.join() === tt.slice(1).join() && tt3.join() === [...tt.slice(1), ref[-6].lay.total].join() && !q.errors.length,
      `stored kazanStart ${v?.student?.kazanStart}; second fill from ${ws2[0]?.d}, as planned ${ws2.every(sameAsRef)}; totals -9…-7 ${tt2} (first ${tt.slice(1)}); on 15 Mar -9…-6 ${tt3}; ${q.errors.join('; ')}`);
    await q.close(); }
  { const EARLY = fxAt('2026-11-25'); const [p, w] = await kOpen(EARLY);
    const all = await totals(p, Object.keys(ref).map(Number).sort((a, b) => a - b)), want = Object.keys(ref).map(Number).sort((a, b) => a - b).map((n) => ref[n].lay.total);
    const ws = await kFill(p, w), v = kazanV(EARLY);
    check('kazan early (today 2026-11-25, week −23): no soft entry', all.join() === want.join() && ws[0]?.d === '2026-12-02' && ws.every(sameAsRef) && v?.student?.kazanStart === -22 && !p.errors.length,
      `totals ${all.join() === want.join() ? 'as planned' : `${all} vs ${want}`}; first ${ws[0]?.d}, as planned ${ws.every(sameAsRef)}; stored kazanStart ${v?.student?.kazanStart}; ${p.errors.join('; ')}`);
    await p.close(); }
  // controller ruling 3: a re-plan works in the laid km of each week, the soft ones too (demo, today moved to 1 Mar 2027,
  // the last 2 weeks planned and not run, so the rules lower every next week)
  if (DEMO) { const p = await browser.newPage({ viewport: { width: 1280, height: 900 } }); p.errors = []; p.on('pageerror', (x) => p.errors.push(x.message));
    await p.addInitScript(() => { let v; Object.defineProperty(window, 'S10_FIXTURES', { configurable: true, get: () => v, set: (x) => {
      x.me.nowmsk = Date.parse('2027-03-01T09:00:00Z') / 1000;
      for (let i = 1; i <= 14; i++) x.diary.diaryTasksInfo.push({ date: new Date(Date.parse('2027-03-01T12:00:00Z') - i * 864e5).toISOString().slice(0, 10), type: 1, comment: '8 км', target: 8, tracks: [] });
      v = x; } }); });
    await p.goto(BASE + '?kazan&tab=plan'); await p.waitForFunction(() => document.querySelector('#s10-week .w-tabbar'), null, { timeout: 20000 }).catch(() => {}); await wait(300);
    const r = await p.evaluate(() => { const T = window.S10_TEST, R = T.replanByRules(), row = R.rows.find((x) => x.week === -8), was = T.lay(-8), now = T.lay(-8, { ...T.plan(), plan: { weeks: R.weeksNew } });
      return row ? { was: row.was, now: row.now, laidWas: was.total, laidTarget: was.target, laidNow: now.target } : null; });
    check('kazan re-plan: «было» of a soft week (−8, ×0.9) is its laid total, the new week is laid with «стало» as its volume', r && Math.abs(r.was - r.laidWas) <= 1 && r.was === r.laidTarget && Math.abs(r.now - r.laidNow) <= 1 && !p.errors.length, `${JSON.stringify(r)}; ${p.errors.join('; ')}`);
    await p.close(); }

  // 8. the main race (Task 5): before a fill Kazan becomes the diary's main race, after a question. The release build at
  // /solo/kazan, today 25 Nov 2026, the snapshot's main race Valencia 6 Dec. Writes come from the stand-in's record
  const NOV = (mod) => fxAt('2026-11-25', mod);
  const tasksOf = (w, from = 0) => w.slice(from).filter((x) => x.url.includes('task.php')).map((x) => decodeTasks(x.body));
  const kAsk = async (p) => { await p.click('[data-act=fillask]'); await wait(200); await p.click('[data-act=fillyes]'); await wait(150); };
  const filled = (p) => p.waitForFunction(() => !document.querySelector('[data-act=fillyes], [data-act=kmainyes]') && document.querySelector('.w-flash'), null, { timeout: 20000 }).catch(() => {}).then(() => wait(500));
  const pressedGoal = (p) => p.$eval('[data-act=kgoal][aria-pressed=true]', (x) => x.dataset.g).catch(() => '');
  const cfText = (p) => p.$eval('#w-cf-h', (x) => x.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  const askText = (p) => p.$eval('[data-act=kmainyes]', (x) => x.closest('.w-confirm')?.querySelector('p')?.innerText.replace(/\s+/g, ' ').trim() || '').catch(() => ''); // short words are held with no-break spaces
  { const [p, w] = await kOpen(NOV());
    const pos = () => p.$eval('[data-act=fillask]', (x) => { const r = x.getBoundingClientRect(); return [r.x, r.y + scrollY, r.width].map(Math.round).join(); }); // on the page, not the screen
    const n0 = w.length, b0 = await pos();
    await kAsk(p);
    const q = await askText(p), btns = await p.$$eval('[data-act=kmainno], [data-act=kmainyes]', (l) => l.map((x) => `${x.dataset.act}:${x.innerText.trim()}`).join()), b1 = await pos();
    await p.click('[data-act=kmainno]').catch(() => {}); await wait(600);
    const left = await p.evaluate(() => ({ ask: !!document.querySelector('[data-act=kmainyes]'), confirm: !!document.querySelector('[data-act=fillyes]'), flash: !!document.querySelector('.w-flash') }));
    check('kazan, main race Valencia: «станет главным стартом вместо Valencia», Отмена writes nothing', q === 'Казанский марафон 2 мая станет главным стартом вместо Valencia, 6 дек' && btns === 'kmainno:Отмена,kmainyes:Да' && b0 === b1 && w.length === n0 && !left.ask && !left.confirm && !left.flash && !p.errors.length,
      `«${q}»; ${btns}; fill button ${b0} → ${b1}; writes ${w.length - n0}: ${w.slice(n0).map((x) => x.url).join(' ')}; after Отмена ${JSON.stringify(left)}; ${p.errors.join('; ')}`);
    await p.close(); }
  { const [p, w] = await kOpen(NOV((x) => { x.me.isPremium = false; return x; })); // controller ruling 7
    const has = await p.evaluate(() => ({ fill: !!document.querySelector('[data-act=fillask]'), ask: !!document.querySelector('[data-act=kmainyes]') }));
    check('kazan, no Premium: no «Заполнить календарь», no question, nothing written', !has.fill && !has.ask && !w.length && !p.errors.length, `${JSON.stringify(has)}; writes ${w.map((x) => x.url).join(' ')}`);
    await p.close(); }
  { const FX = NOV(); const [p, w] = await kOpen(FX);
    await kAsk(p); const n0 = w.length;
    await p.click('[data-act=kmainyes]').catch(() => {}); await filled(p);
    const tw = tasksOf(w, n0), r = tw[0]?.[0] || {}, rest = tw.slice(1).flat();
    const firstIsTask = !!w[n0]?.url.includes('task.php');
    const n1 = w.length; await kAsk(p); const again = !!(await p.$('[data-act=kmainyes]')); await filled(p);
    const tw2 = tasksOf(w, n1).flat();
    check('kazan, Да: first write is 2027-05-02 typtrain 6 main6 1, then the fill', firstIsTask && tw[0]?.length === 1 && r.d === '2027-05-02' && r.task === 'ГОНКА' && r.prekm === '42.2' && +r.typtrain === 6 && +r.main6 === 1 && r.location === 'Казань' && r.prediction === '03:30:00'
      && rest.length > 0 && rest.every((t) => t.d !== '2027-05-02' && +t.main6 === 0) && !again && tw2.length > 0 && tw2.every((t) => t.d !== '2027-05-02') && FX.main?.main?.d === '2027-05-02' && !p.errors.length,
      `first write ${w[n0]?.url} ${JSON.stringify(tw[0])}; then ${rest.length} days (${rest[0]?.d}…${last(rest)?.d}); a second fill asks again: ${again}, writes ${tw2.length}; stand-in main ${FX.main?.main?.d}; ${p.errors.join('; ')}`);
    await p.close(); }
  { const KZ = { d: '2027-05-01', task: 'Мой марафон', prekm: '42', typtrain: 6, prediction: '03:20:00', location: 'Казань' };
    const FX = NOV((x) => { x.main = { main: { ...KZ } }; x.diary.diaryTasksInfo.push({ date: KZ.d, type: 6, comment: KZ.task, target: 42, main6: 1, location: KZ.location, prediction: KZ.prediction, tracks: [] }); return x; });
    const [p, w] = await kOpen(FX);
    const sum = (await p.$eval('.w-goal', (x) => x.innerText).catch(() => '')).replace(/\s+/g, ' ');
    const seeded = await pressedGoal(p); await goal(p, '3:30:00'); // final review, Important 1: 3:20 opens at the nearest, 3:30
    await p.click('[data-act=fillask]'); await wait(200); const cf = await cfText(p); await p.click('[data-act=fillyes]'); await wait(150);
    const asked = !!(await p.$('[data-act=kmainyes]')); await filled(p);
    const tw = tasksOf(w), up = tw[0]?.[0] || {}, rest = tw.slice(1).flat();
    const n1 = w.length; await kFill(p, w); const tw2 = tasksOf(w, n1).flat();
    check('kazan, main race already Kazan 3:20 → goal 3:30: the day keeps task/location/prekm, prediction 03:30:00', !asked && sum.includes('1 мая') && tw[0]?.length === 1 && up.d === KZ.d && up.task === KZ.task && up.location === KZ.location && up.prekm === KZ.prekm && +up.typtrain === 6 && +up.main6 === 1 && up.prediction === '03:30:00'
      && rest.length > 0 && rest.every((t) => t.d !== KZ.d && t.d !== '2027-05-02') && tw2.length > 0 && tw2.every((t) => t.d !== KZ.d) && !p.errors.length,
      `asked ${asked}; summary «${sum}»; first ${JSON.stringify(tw[0])}; then ${rest.length} days; a second fill (goal unchanged) touches the race day: ${tw2.some((t) => t.d === KZ.d)}; ${p.errors.join('; ')}`);
    check('kazan, diary goal 3:20: the picker opens at the nearest 3:30; the confirm says «Цель на старт 1 мая сменится: 3:20 → 3:30.»', seeded === '3:30:00' && cf.includes('Цель на старт 1 мая сменится: 3:20 → 3:30.'), `picker ${seeded}; «${cf}»`);
    await p.close(); }
  // final review, Important 1: a diary goal that is one of the three opens the picker at it and is never rewritten
  { const KZ = { d: '2027-05-02', task: 'ГОНКА', prekm: '42.2', typtrain: 6, prediction: '04:00:00', location: 'Казань' };
    const FX = NOV((x) => { x.main = { main: { ...KZ } }; x.diary.diaryTasksInfo.push({ date: KZ.d, type: 6, comment: KZ.task, target: 42.2, main6: 1, location: KZ.location, prediction: KZ.prediction, tracks: [] }); return x; });
    const [p, w] = await kOpen(FX);
    const seeded = await pressedGoal(p);
    await p.click('[data-act=fillask]'); await wait(200); const cf = await cfText(p); await p.click('[data-act=fillyes]'); await filled(p);
    const ds = tasksOf(w).flat(), v = kazanV(FX);
    check('kazan, diary Kazan at 4:00 → the picker opens at 4:00, the race day is not rewritten', seeded === '4:00:00' && !/Цель на старт/.test(cf) && ds.length > 0 && ds.every((t) => t.d !== KZ.d) && v?.student?.kazanGoal === '4:00:00' && !p.errors.length,
      `picker ${seeded}; «${cf}»; ${ds.length} days, race day ${ds.some((t) => t.d === KZ.d)}; version goal ${v?.student?.kazanGoal}; ${p.errors.join('; ')}`);
    await p.close(); }
  // final review, Important 1: every day already taken, only the goal changes: the button stays on, the confirm says so,
  // only the race day is written, a flash tells it
  { const KZ = { d: '2027-05-02', task: 'ГОНКА', prekm: '42.2', typtrain: 6, prediction: '04:00:00', location: 'Казань' };
    const FX = NOV((x) => { x.main = { main: { ...KZ } }; x.diary.diaryTasksInfo.push({ date: KZ.d, type: 6, comment: KZ.task, target: 42.2, main6: 1, location: KZ.location, prediction: KZ.prediction, tracks: [] });
      for (let d = '2026-11-26'; d < KZ.d; d = add(d, 1)) x.diary.diaryTasksInfo.push({ date: d, type: 1, comment: '8 км', target: 8, tracks: [] }); return x; });
    const [p, w] = await kOpen(FX);
    const off0 = await p.$eval('[data-act=fillask]', (b) => b.disabled).catch(() => null);
    await goal(p, '3:30:00');
    const off1 = await p.$eval('[data-act=fillask]', (b) => b.disabled).catch(() => null);
    await p.click('[data-act=fillask]').catch(() => {}); await wait(200); const cf = await cfText(p); await p.click('[data-act=fillyes]').catch(() => {});
    await p.waitForFunction(() => document.querySelector('.w-flash'), null, { timeout: 20000 }).catch(() => {}); await wait(500);
    const ds = tasksOf(w).flat(), fl = (await p.$eval('.w-flash', (x) => x.innerText).catch(() => '')).replace(/\s+/g, ' ');
    check('kazan, every day taken, goal 4:00 → 3:30: only the race day\'s goal is written, «Цель на старт обновлена: 3:30»', off0 === true && off1 === false && cf.includes('Цель на старт 2 мая сменится: 4:00 → 3:30.') && ds.length === 1 && ds[0].d === KZ.d && ds[0].prediction === '03:30:00' && +ds[0].main6 === 1 && fl.includes('Цель на старт обновлена: 3:30') && !p.errors.length,
      `button off ${off0} → ${off1}; «${cf}»; writes ${JSON.stringify(ds)}; flash «${fl}»; ${p.errors.join('; ')}`);
    await p.close(); }
  // final review, Minor 6 and 7: the old main race (an ordinary race after «Да») is never written over, even with
  // «Не трогать…» unticked; the undo question says Kazan stays the main race
  { const FX = NOV((x) => { x.diary.diaryTasksInfo.push({ date: '2026-12-06', type: 6, comment: 'гонка', target: 42, main6: 1, location: 'VALENCIA', prediction: '03:19:59', tracks: [] }); return x; });
    const [p, w] = await kOpen(FX);
    await p.click('input[data-p=keep]'); await wait(200);
    const keep = await p.$eval('input[data-p=keep]', (x) => x.checked);
    await kAsk(p); await p.click('[data-act=kmainyes]').catch(() => {}); await filled(p);
    const ds = tasksOf(w).flat().map((t) => t.d);
    await p.click('[data-act=undoask]').catch(() => {}); await wait(200);
    const un = (await p.$eval('#w-un-h', (x) => x.innerText).catch(() => '')).replace(/\s+/g, ' ');
    check('kazan, «Не трогать…» unticked: the old main race day (6 Dec, type 6) is not written', !keep && ds.length > 5 && ds.includes('2026-12-05') && ds.includes('2026-12-07') && !ds.includes('2026-12-06') && !p.errors.length, `keep ${keep}; ${ds.join(' ')}`);
    check('kazan undo with Kazan the main race: «Главным стартом останется Казанский марафон.»', un.includes('Главным стартом останется Казанский марафон.'), `«${un}»`);
    await p.close(); }
  { const ATH = '2000000002', COACH = String(JSON.parse(BASE_FX).me.id); // Review Focus 4
    const FX = NOV((x) => { x.mainOf = { [ATH]: { main: { d: '2026-12-20', task: 'ГОНКА', prekm: '42', typtrain: 6, prediction: '03:10:00', location: 'BERLIN' } } }; return x; });
    const [p, w] = await kOpen(FX, `?id=${ATH}&tab=plan`);
    await kAsk(p); const q = await askText(p), n0 = w.length;
    await p.click('[data-act=kmainyes]').catch(() => {}); await filled(p);
    const tw = tasksOf(w, n0), r = tw[0]?.[0] || {};
    await p.click('[data-act=rpai]').catch(() => {}); await p.waitForSelector('[data-act=rpapply]', { timeout: 20000 }).catch(() => {}); await wait(300);
    const taskUrls = w.filter((x) => x.url.includes('task.php')).map((x) => x.url), plans = w.filter((x) => /param\[studentPlans/.test(x.body));
    const gens = w.filter((x) => formField(x.body, 'param[soloGen]') != null), mainReads = w.reads.filter((u) => u.includes('action=main'));
    const ok = q === 'Казанский марафон 2 мая станет главным стартом вместо Berlin, 20 дек' && r.d === '2027-05-02' && +r.main6 === 1 && taskUrls.length > 1 && taskUrls.every((u) => u.includes(`id=${ATH}&`))
      && plans.length > 0 && plans.every((x) => formField(x.body, 'id') === ATH && formField(x.body, `param[studentPlans${ATH}]`) != null)
      && gens.length === 1 && formField(gens[0].body, 'id') === COACH && mainReads.length && mainReads.every((u) => u.includes(`id=${ATH}`)) && FX.mainOf[ATH].main.d === '2027-05-02' && FX.main.main.d === '2026-12-06' && !p.errors.length;
    check('kazan, coach with ?id=: the question and writes use the athlete\'s id; soloGen stays the coach\'s', ok,
      `«${q}»; first ${JSON.stringify(r)}; task.php ×${taskUrls.length} ${[...new Set(taskUrls)].join(' ')}; mains ${FX.mainOf[ATH].main.d}/${FX.main.main.d}; plans ${plans.map((x) => formField(x.body, 'id')).join()}; soloGen ${gens.map((x) => `${x.url} id=${formField(x.body, 'id')}`).join()}; main read ${mainReads.join(' ')}; ${p.errors.join('; ')}`);
    await p.close(); }

  // 9. stored versions (Task 6): the release build at /solo/kazan and /solo/plan in one browser context (one localStorage,
  // as one athlete's browser); the stand-in keeps what is written
  const ID = String(JSON.parse(BASE_FX).me.id);
  const newCtx = () => browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxOpen = async (ctx, FX, where = '/solo/kazan', q = '?tab=plan') => {
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (x) => p.errors.push(x.message));
    const w = await site(p, FX); await p.goto(`${RBASE}${where}${q}`);
    await p.waitForFunction(() => document.querySelector('#s10-week .w-tabbar'), null, { timeout: 20000 }).catch(() => {}); await wait(300); return [p, w];
  };
  const planHead = (p) => p.$eval('#w-plan2-h', (x) => x.innerText).catch(() => '');
  const planMeta = (p) => p.$eval('.w-pmeta', (x) => x.innerText).catch(() => '');
  const kzVs = (FX) => FX.versions.filter((v) => v.kind === 'kazan');
  const lsAll = (p) => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().filter((k) => k.startsWith('s10week.')).map((k) => [k, localStorage.getItem(k)])));
  const longOf = async (p, n) => {
    const get = () => p.$$eval('.w-wk', (l, n) => { const li = l.find((x) => x.querySelector(`[data-w="${n}"]`)); const d = li && [...li.querySelectorAll('.w-wdays > li')].find((x) => x.querySelector('.w-name')?.innerText.trim() === 'Длительная'); return d ? d.innerText.replace(/\s+/g, ' ').trim() : ''; }, n);
    let t = await get(); if (!t) { await p.click(`[data-act=wopen][data-w="${n}"]`).catch(() => {}); await wait(250); t = await get(); } return t; };
  const VAL = 'mvfez7g2s8tvcd';
  { const FX = NOV((x) => { x.versions[0].active = true; return x; }), ctx = await newCtx();
    const [p, w] = await ctxOpen(ctx, FX);
    const hk = await planHead(p), mk = await planMeta(p), opened = w.length;
    const [q] = await ctxOpen(ctx, FX, '/solo/plan'); const hs = await planHead(q); await q.close();
    check('kazan with active Valencia version: kazan shows its own plan; /solo/plan still Valencia', /Мастер-план «Казань 3:30»/.test(hk) && /ещё не в профиле/.test(mk) && /Мастер-план «valencia · 7 нед\.»/.test(hs) && !opened && FX.versions.find((v) => v.active)?.id === VAL && !p.errors.length,
      `kazan «${hk}» (${mk}); solo «${hs}»; writes on opening ${opened}; active ${FX.versions.find((v) => v.active)?.id}`);
    await kFill(p, w);
    const vs = kzVs(FX), v = vs[0] || {}, act = FX.versions.filter((x) => x.active);
    check('kazan fill stores a version kind kazan, kazanGoal 3:30:00, active', vs.length === 1 && v.active && v.name === 'Казань 3:30' && v.student?.kazanGoal === '3:30:00' && Number.isInteger(v.student?.kazanStart) && act.length === 1 && act[0].id === v.id,
      JSON.stringify(FX.versions.map((x) => ({ id: x.id, name: x.name, kind: x.kind, active: x.active, goal: x.student?.kazanGoal, start: x.student?.kazanStart }))));
    check('kazan version: no student.volume unless the athlete typed one', vs.length === 1 && !('volume' in (v.student || {})), `volume ${v.student?.volume}`);
    const [q2] = await ctxOpen(ctx, FX, '/solo/plan'); const hs2 = await planHead(q2);
    check('after a kazan fill, /solo/plan opens «Казань 3:30»', /Мастер-план «Казань 3:30»/.test(hs2) && !q2.errors.length, `${hs2}; ${q2.errors.join('; ')}`); await q2.close();
    await goal(p, '3:00:00'); await kFill(p, w);
    const vs2 = kzVs(FX);
    check('kazan: a goal switch and a fill update the one Kazan version in place, now «Казань 3:00»', vs2.length === 1 && vs2[0].id === v.id && vs2[0].name === 'Казань 3:00' && vs2[0].student?.kazanGoal === '3:00:00' && vs2[0].active && !p.errors.length,
      JSON.stringify(vs2.map((x) => ({ id: x.id, name: x.name, goal: x.student?.kazanGoal, active: x.active }))));
    await p.evaluate((id) => localStorage.setItem(`s10week.kazan.goal.${id}`, JSON.stringify('4:00:00')), ID); await p.close(); // another goal in this browser
    const [r, wr] = await ctxOpen(ctx, FX);
    const pressed = await r.$eval('[data-act=kgoal][aria-pressed=true]', (x) => x.dataset.g).catch(() => ''), hr = await planHead(r), mr = await planMeta(r);
    check('kazan reload: the stored Kazan version reopens, its goal 3:00 over the browser\'s 4:00; nothing written', pressed === '3:00:00' && /«Казань 3:00»/.test(hr) && /в вашем профиле/.test(mr) && !wr.length && !r.errors.length, `goal ${pressed}; «${hr}» (${mr}); writes ${wr.length}; ${r.errors.join('; ')}`);
    await r.close();
    FX.versions = FX.versions.map(({ active, ...x }) => (x.id === VAL ? { ...x, active: true } : x)); // Solo's version active again (another device)
    const [s, ws] = await ctxOpen(ctx, FX); const hs3 = await planHead(s);
    check('kazan: with Solo\'s version active, the latest Kazan version opens; opening keeps Solo\'s active', /«Казань 3:00»/.test(hs3) && !ws.length && FX.versions.find((x) => x.active)?.id === VAL && !s.errors.length, `«${hs3}»; writes ${ws.length}`);
    await s.close(); await ctx.close(); }
  // controller ruling 1: the plan's kind, not the page's mode, lays a Kazan plan (late start: the soft entry too)
  { const FX = fxAt('2027-03-01'), ctx = await newCtx(), ns = [-10, -9, -8, -7];
    const [p, w] = await ctxOpen(ctx, FX); await goal(p, '4:00:00'); await kFill(p, w);
    const tk = await totals(p, ns), lk = await longOf(p, -8); await p.close(); await ctx.close();
    const ctx2 = await newCtx(), [q] = await ctxOpen(ctx2, FX, '/solo/plan');
    const ts = await totals(q, ns), lq = await longOf(q, -8), hq = await planHead(q);
    check('kind, not mode: after a Kazan fill at 4:00, /solo/plan lays the same weeks −10…−7 and the same long run', /«Казань 4:00»/.test(hq) && tk.every(Number.isFinite) && tk.join() === ts.join() && !!lk && lk === lq && !q.errors.length,
      `«${hq}»; kazan ${tk} / solo ${ts}; long «${lk}» / «${lq}»; ${q.errors.join('; ')}`);
    await q.close(); await ctx2.close(); }
  // controller ruling 5: the Kazan mode keeps its own browser keys (kazan.…), Solo's stay as they were
  { const ctx = await newCtx(), FX = NOV(), OWN = { 5: '4:40', 10: '4:55', 21: '5:10', 42: '5:25' };
    const [s0] = await ctxOpen(ctx, FX, '/solo/plan');
    await s0.evaluate(([id, own]) => { localStorage.setItem(`s10week.paceSrc.${id}`, '"own"'); localStorage.setItem(`s10week.paceOwn.${id}`, JSON.stringify(own)); }, [ID, OWN]); await s0.close();
    const [k] = await ctxOpen(ctx, FX, '/solo/kazan', '?tab=paces');
    await k.selectOption('select[data-p=pacesrc]', 'own').catch(() => {}); await wait(200); await k.selectOption('select[data-p=pacesrc]', 'goal').catch(() => {}); await wait(200);
    const kSrc = await k.$eval('select[data-p=pacesrc]', (x) => x.value).catch(() => ''); await k.close();
    const [s] = await ctxOpen(ctx, FX, '/solo/plan', '?tab=paces');
    const src = await s.$eval('select[data-p=pacesrc]', (x) => x.value).catch(() => ''), v42 = await s.inputValue('input[data-k="42"]').catch(() => '');
    check('Solo own paces survive a Kazan visit that picks «От цели»', kSrc === 'goal' && src === 'own' && v42 === '5:25' && !s.errors.length, `kazan ${kSrc}; solo ${src}, T42 ${v42}`);
    await s.close(); await ctx.close(); }
  { const ctx = await newCtx(), FX = NOV((x) => { x.main = { main: null }; x.versions = []; x.results = []; return x; });
    const [s0] = await ctxOpen(ctx, FX, '/solo/plan');
    await s0.evaluate((id) => { localStorage.setItem(`s10week.paceSrc.${id}`, '"own"'); localStorage.setItem(`s10week.paceOwn.${id}`, JSON.stringify({ 5: '6:00', 10: '6:15', 21: '6:30', 42: '6:50', easy: '7:00-7:30' })); localStorage.setItem(`s10week.paceGuess.${id}`, 'true'); }, ID); await s0.close();
    const [k] = await ctxOpen(ctx, FX, '/solo/kazan', '?tab=paces');
    const sel = await k.$eval('select[data-p=pacesrc]', (x) => [x.value, x.selectedOptions[0]?.text]).catch(() => []), v42 = await k.inputValue('input[data-k="42"]').catch(() => '');
    check('a Solo newbie\'s start-window paces do not leak into Kazan: paces «от цели»', sel[0] === 'goal' && /от цели 3:30/i.test(sel[1] || '') && v42 && v42 !== '6:50' && !k.errors.length, `${sel.join(' / ')}; T42 ${v42}`);
    await k.close(); await ctx.close(); }
  { const ctx = await newCtx(), FX = NOV();
    const [s0] = await ctxOpen(ctx, FX, '/solo/plan');
    await s0.evaluate((id) => { localStorage.setItem(`s10week.plan.${id}`, JSON.stringify({ src: 'version', id: 'mvfb1nc2kau0dr' })); localStorage.setItem('s10week.layout', JSON.stringify(['easy', 'w1', 'easy', 'rest', 'w2', 'easy', 'long'])); localStorage.setItem('s10week.fillSpan', '"race"'); localStorage.setItem('s10week.tab', '"plan"'); }, ID);
    const before = await lsAll(s0); await s0.close();
    const [k, w] = await ctxOpen(ctx, FX);
    const role0 = await k.$eval('select[data-p=role][data-i="1"]', (x) => x.value).catch(() => '');
    await k.selectOption('select[data-p=role][data-i="0"]', 'rest').catch(() => {}); await wait(200);
    await k.click('[data-act=span][data-k=race]').catch(() => {}); await wait(150); await k.click('[data-act=span][data-k="2w"]').catch(() => {}); await wait(150);
    await k.click('[data-act=tab][data-k=paces]').catch(() => {}); await wait(150); await k.click('[data-act=tab][data-k=plan]').catch(() => {}); await wait(150);
    await kFill(k, w);
    const after = await lsAll(k); await k.close();
    const solo = Object.fromEntries(Object.entries(after).filter(([x]) => !x.startsWith('s10week.kazan.'))), kz = Object.keys(after).filter((x) => x.startsWith('s10week.kazan.'));
    check('kazan does not overwrite Solo localStorage keys (s10week.plan.<ID> не меняется)', JSON.stringify(solo) === JSON.stringify(before) && role0 === 'easy' && kz.includes(`s10week.kazan.plan.${ID}`) && kz.includes('s10week.kazan.layout') && kz.includes('s10week.kazan.fillSpan'),
      `Kazan's Tuesday ${role0}; Solo before ${JSON.stringify(before)}; after ${JSON.stringify(solo)}; kazan keys ${kz.join(' ')}`);
    await ctx.close(); }
  // carry-over 1: a re-plan that writes days before any fill freezes the start those days were laid with (−9 on 1 Mar)
  { const FX1 = fxAt('2027-03-01'); { const [p1, w1] = await kOpen(FX1); await kFill(p1, w1); await p1.close(); }
    // the fill's days in the diary, no Kazan version; the last 2 weeks planned (8 km a day) and not run, so the rules lower the next weeks
    const FX = fxAt('2027-03-01', (x) => { x.diary = JSON.parse(JSON.stringify(FX1.diary)); x.main = JSON.parse(JSON.stringify(FX1.main));
      for (let i = 1; i <= 14; i++) x.diary.diaryTasksInfo.push({ date: add('2027-03-01', -i), type: 1, comment: '8 км', target: 8, tracks: [] }); return x; });
    const [p, w] = await kOpen(FX); const n0 = w.length;
    await p.click('[data-act=rprules]').catch(() => {}); await wait(300); await p.click('[data-act=rpapply]').catch(() => {});
    await p.waitForFunction(() => document.querySelector('.w-flash'), null, { timeout: 20000 }).catch(() => {}); await wait(500);
    const n = tasksOf(w, n0).flat().length, v = kazanV(FX);
    check('kazan re-plan before any fill: written days freeze the provisional start (kazanStart −9)', n > 0 && v?.student?.kazanStart === -9 && !p.errors.length, `${n} days written; ${v?.name} kazanStart ${v?.student?.kazanStart}; ${p.errors.join('; ')}`);
    await p.close(); }
  // carry-over 2: while the race day is written (the question answered «Да»), the span buttons do nothing
  // (fix round 1: a real undo record first: a Kazan version with an undo, active, the main race Valencia again)
  { const FX0 = NOV(); { const [p0, w0] = await kOpen(FX0); await kFill(p0, w0); await p0.close(); }
    const FX = NOV((x) => { x.versions = JSON.parse(JSON.stringify(FX0.versions)); return x; }); const [p, w] = await kOpen(FX);
    const undoBefore = !!(await p.$('[data-act=undoask]'));
    await kAsk(p); const n0 = w.length; FX.slow = 1500;
    await p.click('[data-act=kmainyes]').catch(() => {}); await wait(300);
    const during = await p.evaluate(() => { const was = document.querySelector('[data-act=span][aria-checked=true]')?.dataset.k; document.querySelector('[data-act=span][data-k=race]')?.click(); const u = document.querySelector('[data-act=undoask]'); u?.click(); return { was, undoLink: !!u, undoAsked: !!document.querySelector('[data-act=undoyes]'), fill: document.querySelector('[data-act=fillask]')?.disabled ?? null }; });
    await wait(100); const now = await p.$eval('[data-act=span][aria-checked=true]', (x) => x.dataset.k).catch(() => '');
    FX.slow = 0; await filled(p);
    const ds = tasksOf(w, n0).flat().map((t) => t.d).filter((d) => d !== '2027-05-02').sort(); // the fill's days, the race day's own write left out
    check('kazan: while the race day is written, the span and «Вернуть как было» do nothing; the fill writes the confirmed «2 беговые недели»', undoBefore && during.undoLink && !during.undoAsked && during.was === '2w' && now === '2w' && during.fill === true && ds.length > 1 && last(ds) < '2027-01-01' && !p.errors.length,
      `${JSON.stringify(during)}, after ${now}; ${ds.length} days, to ${last(ds)}; ${p.errors.join('; ')}`);
    await p.close(); }

  // fix round 1, Important 1: before Kazan is the main race, a Kazan version is never made active (Solo would lay it to
  // Valencia) and the re-plan is not offered
  { const FX = NOV((x) => { x.versions[0].active = true; return x; }), ctx = await newCtx();
    const [p, w] = await ctxOpen(ctx, FX);
    const rpBtns = await p.$$eval('[data-act=rprules], [data-act=rpai]', (l) => l.length), rpNote = (await p.$eval('.w-rp', (x) => x.innerText).catch(() => '')).trim();
    check('kazan, main race Valencia: no re-plan buttons, «Перестроить можно, когда Казань станет главным стартом»', rpBtns === 0 && rpNote === 'Перестроить можно, когда Казань станет главным стартом', `${rpBtns} buttons; «${rpNote}»`);
    await p.click('[data-act=pversion]').catch(() => {}); await p.waitForFunction(() => document.querySelector('.w-flash'), null, { timeout: 10000 }).catch(() => {}); await wait(300);
    const vs = kzVs(FX), val = FX.versions.find((x) => x.id === VAL);
    const [q] = await ctxOpen(ctx, FX, '/solo/plan'); const hs = await planHead(q); await q.close();
    check('kazan save with main race Valencia: the Kazan version is stored with no active, /solo/plan still opens Valencia', vs.length === 1 && !('active' in vs[0]) && vs[0].name === 'Казань 3:30' && val?.active === true && /«valencia · 7 нед\.»/.test(hs) && !w.some((x) => x.url.includes('task.php')) && !p.errors.length,
      `${JSON.stringify(FX.versions.map((x) => ({ name: x.name, kind: x.kind, active: x.active })))}; solo «${hs}»`);
    await p.close(); await ctx.close(); }
  // fix round 1, also: with Solo's version active (and its undo), the Kazan page offers no «Вернуть как было»
  { const FX = NOV((x) => { x.versions[0].active = true; x.versions[0].undo = { at: '2026-11-20T10:00:00Z', prevFilled: null, days: [['2026-11-27', null, 0, '', '', '', 1, 8, 'x']] }; return x; });
    const [p] = await kOpen(FX); const kz = !!(await p.$('[data-act=undoask]')); await p.close();
    const ctx = await newCtx(), [q] = await ctxOpen(ctx, FX, '/solo/plan');
    const solo = !!(await q.$('[data-act=undoask]')); await ctx.close();
    check('kazan with Solo\'s version active: no «Вернуть как было» for Solo\'s fill (Solo still offers it)', !kz && solo, `kazan ${kz}, solo ${solo}`); }
  // final review, Minor 8: no active version (the fill was written, the profile save failed): the browser's undo copy
  { const ctx = await newCtx(), FX = NOV();
    const [p0] = await ctxOpen(ctx, FX);
    await p0.evaluate((id) => localStorage.setItem(`s10week.kazan.undo.${id}`, JSON.stringify({ at: '2026-11-24T10:00:00Z', prevFilled: null, days: [['2026-12-02', null, 0, '', '', '', 1, 8, 'x']] })), ID); await p0.close();
    const [p] = await ctxOpen(ctx, FX); const link = !!(await p.$('[data-act=undoask]'));
    check('kazan with no active version: the browser\'s undo copy is offered («Вернуть как было»)', link && !FX.versions.some((v) => v.active) && !p.errors.length, `link ${link}`);
    await p.close(); await ctx.close(); }
  // final review, Important 2: own paces set in the Kazan mode follow the athlete to another browser and a fill there keeps them
  { const FX = NOV(), ctx = await newCtx();
    const [p, w] = await ctxOpen(ctx, FX, '/solo/kazan', '?tab=paces');
    await p.fill('input[data-k="42"]', '4:50'); await p.press('input[data-k="42"]', 'Tab'); await wait(300);
    await p.click('[data-act=tab][data-k=plan]'); await wait(200); await kFill(p, w); await p.close(); await ctx.close();
    const v1 = kazanV(FX)?.student?.t42;
    const ctx2 = await newCtx(), [q, wq] = await ctxOpen(ctx2, FX, '/solo/kazan', '?tab=paces');
    const src = await q.$eval('select[data-p=pacesrc]', (x) => x.value).catch(() => ''), t42 = await q.inputValue('input[data-k="42"]').catch(() => '');
    await q.click('[data-act=tab][data-k=plan]'); await wait(200); const ds = await kFill(q, wq);
    const v2 = kazanV(FX)?.student?.t42;
    check('kazan: own paces stored with the Kazan version open as «Свои» in a fresh browser; a fill there keeps them', v1 === '4:50' && src === 'own' && t42 === '4:50' && ds.length > 0 && v2 === '4:50' && !q.errors.length,
      `stored ${v1}; fresh browser ${src} T42 ${t42}; ${ds.length} days; stored after ${v2}; ${q.errors.join('; ')}`);
    await q.close(); await ctx2.close(); }
  // final review, Minor 9: a goal tap after a fill is the browser's until the next save: a reload keeps it, another browser
  // opens the version's goal
  { const FX = NOV(), ctx = await newCtx();
    const [p, w] = await ctxOpen(ctx, FX); await kFill(p, w); await goal(p, '3:00:00'); await p.close();
    const [q, wq] = await ctxOpen(ctx, FX); const same = await pressedGoal(q); await q.close(); await ctx.close();
    const ctx2 = await newCtx(), [r] = await ctxOpen(ctx2, FX); const other = await pressedGoal(r); await r.close(); await ctx2.close();
    check('kazan: goal 3:30 → 3:00 after a fill: a reload in the same browser opens 3:00, a fresh browser the version\'s 3:30; nothing written', same === '3:00:00' && other === '3:30:00' && kazanV(FX)?.student?.kazanGoal === '3:30:00' && !wq.length, `same ${same}; fresh ${other}; version ${kazanV(FX)?.student?.kazanGoal}; writes on reopening ${wq.length}`); }
  // fix round 1, Important 2: a Kazan re-plan updates the one Kazan version in place; undo puts its weeks and name back
  { const FX = NOV(); const [p, w] = await kOpen(FX); await kFill(p, w);
    const v0 = JSON.parse(JSON.stringify(kzVs(FX)[0] || {})), km = (v) => (v?.plan?.weeks || []).map((x) => x.km).join();
    await p.click('[data-act=rpai]').catch(() => {}); await p.waitForSelector('[data-act=rpapply]', { timeout: 20000 }).catch(() => {}); await wait(300);
    await p.click('[data-act=rpapply]').catch(() => {}); await p.waitForFunction(() => /перестроен/.test(document.querySelector('.w-flash')?.innerText || ''), null, { timeout: 20000 }).catch(() => {}); await wait(500);
    const vs1 = kzVs(FX), v1 = vs1[0] || {};
    check('kazan re-plan: still exactly one kind kazan version, the same one, with the re-planned weeks, «Казань 3:30 · перестроен …»', vs1.length === 1 && v1.id === v0.id && km(v1) !== km(v0) && /^Казань 3:30 · перестроен \d+\s\S+$/.test(v1.name) && v1.active && !!v1.undo?.prevVersion,
      JSON.stringify(vs1.map((x) => ({ id: x.id, name: x.name, active: x.active, same: km(x) === km(v0) }))));
    await p.click('[data-act=undoask]').catch(() => {}); await wait(200); await p.click('[data-act=undoyes]').catch(() => {});
    await p.waitForFunction(() => /как было/.test(document.querySelector('.w-flash')?.innerText || ''), null, { timeout: 20000 }).catch(() => {}); await wait(500);
    const vs2 = kzVs(FX), v2 = vs2[0] || {}, head = await planHead(p);
    check('kazan re-plan undo: the same version back with its old weeks and name', vs2.length === 1 && v2.id === v0.id && km(v2) === km(v0) && v2.name === v0.name && v2.active && !v2.undo && v2.student?.kazanStart === v0.student?.kazanStart && /«Казань 3:30»/.test(head) && !p.errors.length,
      `${JSON.stringify(vs2.map((x) => ({ id: x.id, name: x.name, active: x.active, undo: !!x.undo, same: km(x) === km(v0) })))}; «${head}»; ${p.errors.join('; ')}`);
    await p.close(); }

  // final review, Minor 4: the race date is written once, in KAZAN (the plan text and comments aside)
  if (DEMO) { const src = fs.readFileSync(path.join(ROOT, 'solo.js'), 'utf8').replace(/const KAZAN_PLAN_MD = `[\s\S]*?`;/, '').split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, ''));
    const dated = src.map((l, i) => [i + 1, l]).filter(([, l]) => /(?<!\d)2027(?!\d)|(?<![\d.])(30|1|2) (мая|апреля)|04-30|05-0[12]/.test(l) && !/^\s*const KAZAN = \{/.test(l)).map(([i, l]) => `${i}: ${l.trim().slice(0, 80)}`);
    check('kazan: the race date only in KAZAN.d (no other 2027 / «2 мая» / 04-30 in the code)', !dated.length, dated.join(' | ')); }

  if (DEMO) { const p = await open(''); // the Solo page stays as it was
    const h1 = await p.$eval('h1', (x) => x.innerText).catch(() => '');
    check('solo: /demo/ without ?kazan unchanged (no goal picker, «Моя неделя»)', h1.startsWith('Моя неделя') && !(await p.$('[data-act=kgoal]')) && !!(await p.$('[data-act=goaladd]')), h1);
    await p.close(); }

  // 10. logged out (Task 7): the Kazan block instead of «войдите в S10»; the only request is self/info
  { const p = await browser.newPage({ viewport: { width: 1280, height: 900 } }); p.errors = []; p.on('pageerror', (x) => p.errors.push(x.message));
    const FX = JSON.parse(BASE_FX); FX.me = null; const w = await site(p, FX);
    await p.goto(`${RBASE}/solo/kazan?id=7`); await p.waitForSelector('main h1', { timeout: 20000 }).catch(() => {}); await wait(500);
    const body = await p.innerText('body'), href = await p.$eval('main a', (a) => a.getAttribute('href')).catch(() => ''), btn = await p.$eval('main a', (a) => a.innerText).catch(() => '');
    const back = decodeURIComponent((href.match(/^\/login\?back=(.*)$/) || [])[1] || '');
    check('kazan logged out: the block (heading, lines, «Premium S10»), no «войдите в S10»',
      body.includes('Подготовка к Казанскому марафону') && /2 мая 2027 · (до старта \d+ (неделя|недели|недель)|старт на этой неделе|старт сегодня)/.test(body) && body.includes('Цель на выбор: 3:00, 3:30 или 4:00') && body.includes('План с вашими темпами — сразу в календаре S10') && body.includes('Premium S10') && !body.includes('войдите в S10'), body.replace(/\s+/g, ' ').slice(0, 300));
    check('kazan logged out: «Войти и начать» goes to /login?back= with the full /solo/kazan address; the only request is self/info',
      btn.trim() === 'Войти и начать' && back === `${RBASE}/solo/kazan?id=7` && w.reads.length === 1 && w.reads[0].includes('/student/self/info') && w.length === 0 && p.errors.length === 0, `${btn} ${back} ${JSON.stringify(w.reads)} ${p.errors.join(';')}`);
    await p.close(); }
  { const p = await browser.newPage(); const FX = JSON.parse(BASE_FX); FX.me = null; await site(p, FX); await p.goto(`${RBASE}/solo/plan`); await p.waitForSelector('main h1', { timeout: 20000 }).catch(() => {}); await wait(400);
    const b = await p.innerText('body'); check('solo logged out: «войдите в S10» as before', b.includes('войдите в S10') && !b.includes('Казан')); await p.close(); }
  if (DEMO) { const p = await open('?kazan');
    const r = await p.evaluate(() => { const T = window.S10_TEST; if (!T?.weeksWord) return null; const ms = (d) => Date.parse(d + 'Z');
      return { w: [1, 2, 5, 11, 12, 21, 22, 25].map((n) => T.weeksWord(n)), n: [T.kazanCountdown(ms('2026-11-17T12:00:00')), T.kazanCountdown(ms('2027-04-24T22:00:00')), T.kazanCountdown(ms('2027-04-25T12:00:00')), T.kazanCountdown(ms('2027-04-29T12:00:00')), T.kazanCountdown(ms('2027-05-02T05:00:00')), T.kazanCountdown(ms('2027-05-03T05:00:00')), T.kazanCountdown(ms('2027-05-02T22:00:00'))] }; });
    check('kazan countdown: Russian plural, Moscow date, round up, race week, race day, past',
      r && r.w.join() === '1 неделя,2 недели,5 недель,11 недель,12 недель,21 неделя,22 недели,25 недель' && r.n.join('|') === 'до старта 24 недели|до старта 1 неделя|до старта 1 неделя|старт на этой неделе|старт сегодня||', r && JSON.stringify(r)); await p.close(); }

  if (REACT) { // 11. <SoloKazan /> in a React app: mounts the Kazan mode, unmount leaves nothing, a second mount draws it once
    const [p] = await kOpen(NOV());
    const h1 = await p.$eval('#s10-week h1', (x) => x.innerText.replace(/\s+/g, ' ')).catch(() => ''), picker = !!(await p.$('[data-act=kgoal]'));
    await p.evaluate(() => window.__s10.unmount()); await wait(200);
    const gone = await p.evaluate(() => ({ pages: document.querySelectorAll('#s10-week').length, overflow: document.documentElement.style.overflow, bg: document.documentElement.style.background, host: document.getElementById('app').innerHTML }));
    await p.evaluate(() => window.__s10.mount()); await p.waitForFunction(() => document.querySelector('#s10-week .w-tabbar'), null, { timeout: 20000 }).catch(() => {}); await wait(400);
    const h1b = await p.$eval('#s10-week h1', (x) => x.innerText.replace(/\s+/g, ' ')).catch(() => ''), n = (await p.$$('#s10-week')).length;
    check('react: <SoloKazan /> mounts Kazan, unmount leaves nothing, remount once',
      h1.startsWith('Казанский марафон') && picker && !gone.pages && !gone.overflow && !gone.bg && !gone.host && n === 1 && h1b === h1 && !!(await p.$('[data-act=kgoal]')) && !p.errors.length,
      `«${h1}» picker ${picker}; after unmount ${JSON.stringify(gone)}; again ${n} «${h1b}»; ${p.errors.join('; ')}`);
    await p.close(); }

  await browser.close();
  if (srv) srv.close();
  rsrv.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nkazan: ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
