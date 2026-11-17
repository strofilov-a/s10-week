// Checks the release build (release/t5/solo/solo.js, no demo) the way s10.run would run it: the page and the script are
// served at /solo/plan and /t5/solo/solo.js, and the site's endpoints answer from the demo snapshot; every write is
// recorded, nothing leaves the machine. Run after `npm run build`.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), REL = path.join(ROOT, 'release');
global.window = {}; require(path.join(ROOT, 'demo', 'fixtures.js')); const BASE_FX = JSON.stringify(window.S10_FIXTURES);

const REACT_SHELL = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#f4f4f4}</style></head><body><div id="app"></div><script src="/app.js"></script></body></html>';
const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  // REACT=1: the same checks on react-src/ as the developers' app would run it (tests/react: webpack, ReactDOM.render)
  if (process.env.REACT && p === '/solo/plan') { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end(REACT_SHELL); }
  if (process.env.REACT && p === '/app.js') { r.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); return r.end(fs.readFileSync(path.join(__dirname, 'react', 'dist', 'app.js'))); }
  const f = p === '/solo/plan' ? path.join(REL, 'solo.html') : p === '/t5/solo/solo.js' ? path.join(REL, 't5', 'solo', 'solo.js') : null;
  if (!f) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); r.end(fs.readFileSync(f));
});
// the site's API on the snapshot; `mod` changes the data first (a new athlete)
async function site(page, mod = (x) => x) {
  const FX = mod(JSON.parse(BASE_FX)), writes = [];
  // the later route wins in Playwright: first block everything outside (fonts, icons, the site's cookie banner), then
  // answer the site's API, the generator included
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/(apiweb|student\?|t7\/plan-templates)/, async (route) => {
    const req = route.request(), u = req.url();
    if (req.method() === 'POST') {
      if (u.includes('generate.php')) return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: FX.generated });
      const body = req.postData() || ''; writes.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), body });
      return json(route, u.includes('task.php') ? { message: {} } : { ok: true });
    }
    if (u.includes('/student/self/info')) return json(route, FX.me);
    if (u.includes('task.php?action=main')) return json(route, FX.main);
    if (u.includes('studentMainStart')) return json(route, FX.startParam);
    if (u.includes('planresults.php')) return json(route, FX.results);
    if (u.includes('/student?')) return json(route, { diaryTasksInfo: FX.diary.diaryTasksInfo, diaryTasksisMoreExist: 0 });
    if (u.includes('tasktemplates.php')) return json(route, FX.templates);
    if (u.includes('param[]=studentPlans')) { (writes.reads ||= []).push(u); return json(route, { param: { [`studentPlans${FX.me.id}`]: JSON.stringify(FX.versions) } }); }
    if (u.includes('param[]=planTemplates')) return json(route, { param: { planTemplates: JSON.stringify(FX.library) } });
    if (u.includes('param[]=soloGen')) return json(route, { param: { soloGen: FX.soloGen ? JSON.stringify(FX.soloGen) : null } });
    if (u.includes('calc.php')) return json(route, FX.base);
    return route.fulfill({ status: 404, body: '' });
  });
  return writes;
}
const NEWBIE = (x) => { x.main = { main: null }; x.versions = []; x.library = []; x.results = []; x.startParam = { param: {} }; x.diary.diaryTasksInfo = []; return x; };

srv.listen(0, '127.0.0.1', async () => {
  const URL0 = `http://127.0.0.1:${srv.address().port}/solo/plan`;
  const b = await chromium.launch();
  const open = async (mod, q = '') => { const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); const w = await site(p, mod); await p.goto(URL0 + q); await wait(1200); return [p, w]; };
  const src = fs.readFileSync(path.join(REL, 't5', 'solo', 'solo.js'), 'utf8');
  check('release: no demo code or words left', !/\b(LIVE|FX|S10_FIXTURES|demo\w*)\b|[Дд]емо/.test(src));

  { const [p, w0] = await open(); const t = (await p.innerText('body')).replace(/\s+/g, ' ');
    const withId = (w0.reads || []).length && w0.reads.every((u) => /[?&]id=\d+/.test(u));
    // react-src is built from release b82aba6586, as the developers asked, before the &id= fix: say so, do not count it
    if (process.env.REACT && !withId && /release b82aba6586/.test(fs.readFileSync(path.join(ROOT, 'react-src', 'solo-plan', 'engine.ts'), 'utf8').slice(0, 200))) console.log('KNOWN plan versions read without &id= (release b82aba6586, see react-src/README.md)');
    else check('plan versions are read from the profile they are written to (&id=, as a coach opening an athlete needs)', withId, (w0.reads || []).join(' '));
    check('athlete with data: page, race, no demo banner, Telegram link', t.includes('До старта') && t.includes('Valencia') && !/[Дд]емо/.test(t) && !!(await p.$('.w-foot a[href="https://t.me/+wP4aOZ4910I2MTk6"]')) && !(await p.$('.w-dlg')));
    check('links stay on the site (logo «/», calc3 relative)', (await p.$eval('.w-wm', (a) => a.getAttribute('href'))) === '/');
    check('no errors', !p.errs.length, p.errs.join('; '));
    if (process.env.REACT) { // unmount and mount again, as an app's router would
      await p.click('[data-act=menu]'); await wait(200);
      const menuMark = await p.evaluate(() => document.documentElement.style.overflow);
      await p.evaluate(() => window.__s10.unmount()); await wait(200);
      const gone = await p.evaluate(() => ({ pages: document.querySelectorAll('#s10-week').length, overflow: document.documentElement.style.overflow, bg: document.documentElement.style.background, host: document.getElementById('app').innerHTML }));
      check('react: unmount leaves nothing (the page, the menu mark and the colour on <html>)', menuMark === 'hidden' && !gone.pages && !gone.overflow && !gone.bg && !gone.host, JSON.stringify(gone));
      await p.evaluate(() => { history.pushState(null, '', '/solo/plan?tab=paces'); history.back(); }); await wait(600);
      check('react: back/forward after unmount draws nothing (popstate listener removed)', await p.evaluate(() => !document.querySelector('#s10-week')) && !p.errs.length, p.errs.join('; '));
      await p.evaluate(() => window.__s10.mount()); await wait(1200);
      const t2 = (await p.innerText('body')).replace(/\s+/g, ' ');
      check('react: mounted again: one page, the same content', (await p.$$('#s10-week')).length === 1 && t2.includes('До старта') && t2.includes('Valencia') && !p.errs.length);
    }
    await p.close(); }

  { const [p, writes] = await open(NEWBIE);
    check('new athlete: start window', !!(await p.$('.w-dlg')) && (await p.inputValue('[data-o=t42]')) === '6:50');
    await p.click('[data-act=onbnone]'); await wait(300);
    check('…«Отсутствует»: the about-you box filled and focused', (await p.inputValue('textarea[data-g=prompt]')) === 'заполни как есть, там посмотрим' && (await p.evaluate(() => document.activeElement?.dataset?.g)) === 'prompt');
    await p.click('[data-act=gen]'); await wait(1500);
    check('…generator answer parsed into a plan', (await p.innerText('body')).includes('План готов: 5'));
    await p.click('[data-act=fillask]'); await wait(300); await p.click('[data-act=fillyes]'); await wait(2500);
    const tasks = writes.filter((w) => w.url.includes('task.php')).flatMap((w) => decodeTasks(w.body));
    const prof = writes.filter((w) => w.url.includes('userparam.php'));
    check('…fill writes 14 diary days with paces in numbers and the plan to the profile', tasks.length === 14 && !tasks.some((x) => /T\s*(5|10|21|42)\b/.test(x.task)) && prof.length >= 1, `${tasks.length} days, ${prof.length} profile writes`);
    check('…flash says the calendar is filled (no demo words)', /Календарь заполнен: 14 дней/.test(await p.innerText('body')));
    check('…no errors', !p.errs.length, p.errs.join('; ')); await p.close(); }

  { const [p] = await open((x) => { NEWBIE(x); x.me.isPremium = false; return x; });
    await p.click('[data-act=onbnone]'); await wait(300); await p.click('[data-act=gen]'); await wait(1500);
    check('new athlete without premium: the Premium button to /money', !(await p.$('[data-act=fillask]')) && (await p.getAttribute('[data-act=buy]', 'href')) === '/money'); await p.close(); }

  { const p = await b.newPage(); await site(p, (x) => { x.me = null; return x; }); await p.goto(URL0); await wait(800);
    check('logged out: «войдите в S10»', (await p.innerText('body')).includes('войдите в S10')); await p.close(); }


  // ---- 11.11.2026 fixes ----
  const TODAY = (x) => new Date(((x.me.nowmsk || 0) + 3 * 3600) * 1000).toISOString().slice(0, 10);
  const noNaN = async (p) => { const out = []; for (const q of ['', '?tab=plan', '?tab=paces']) { await p.goto(URL0 + q); await wait(900); out.push((await p.innerText('body')).includes('NaN')); } return !out.some(Boolean); };
  { // planresults.t is {"err": "Нет данных…"} when the site cannot forecast: no paces from it
    const [p] = await open((x) => { x.versions = []; x.library = []; x.results = [{ i: 1, d: x.main.main ? x.main.main.d : '2026-12-06', distance: 42, prehms: null, realhms: null, t: { err: 'Нет данных для 42.2/0' } }]; x.startParam = { param: { studentMainStart: 1 } }; return x; });
    check('paces: a forecast the site could not count gives no NaN anywhere', await noNaN(p));
    check('paces: …and is not offered as «прогноз S10»', !(await p.innerText('body')).includes('Прогноз S10')); await p.close(); }
  { // a coach's version with only the marathon pace filled
    const [p] = await open((x) => { x.versions.forEach((v) => { v.student = { ...v.student, t5: '', t10: '', t21: '', t42: '4:40' }; }); x.results = []; return x; });
    check('paces: a plan version with one pace gives no NaN', await noNaN(p)); await p.close(); }
  { const [p] = await open((x) => { x.versions.forEach((v) => { v.student = { ...v.student, t5: '0:03:47', t10: '04:26', t21: '4.37', t42: '4:40' }; }); return x; });
    await p.goto(URL0 + '?tab=paces'); await wait(900);
    check('paces: 0:03:47, 04:26 and 4.37 are read as paces', await noNaN(p) && /3:47/.test(await p.innerText('body'))); await p.close(); }

  { const p = await b.newPage(); await site(p, (x) => { x.me = null; return x; }); await p.goto(URL0 + '?id=5'); await wait(800);
    const href = await p.getAttribute('a[href*="/login"]', 'href');
    const back = href ? new URL(href, 'http://x').searchParams.get('back') : '';
    check('logged out: «войдите» comes back to /solo/plan with its query (a full address, the login takes no other)', /^https?:\/\/[^/]+\/solo\/plan\?id=5$/.test(back || ''), href); await p.close(); }

  { const [p, w] = await open((x) => { x.me.isPremium = false; return x; });
    await p.click('[data-act=tab][data-t=plan], [role=tab]:has-text("План до старта")').catch(() => {}); await wait(500);
    const nav = p.waitForRequest((r) => r.isNavigationRequest() && /\/money$/.test(r.url()), { timeout: 4000 }).then(() => true).catch(() => false);
    await p.click('[data-act=buy]'); const went = await nav;
    check('no premium: «Оформить Premium» goes to /money and stores no plan', went && !w.some((x) => x.url.includes('userparam')), w.map((x) => x.url).join(' ')); await p.close(); }
  { const [p, w] = await open((x) => { x.me.isPremium = false; return x; });
    await p.goto(URL0 + '?tab=plan'); await wait(900);
    const nav = p.waitForRequest((r) => r.isNavigationRequest() && /\/money$/.test(r.url()), { timeout: 4000 }).then(() => true).catch(() => false);
    await p.click('[data-act=pversion]'); const went = await nav;
    check('no premium: «Сохранить версию» goes to /money and stores nothing', went && !w.some((x) => x.url.includes('userparam')), w.map((x) => x.url).join(' ')); await p.close(); }

  { const [p] = await open((x) => { x.soloGen = { d: TODAY(x), n: 5 }; return x; });
    await p.goto(URL0 + '?tab=plan'); await wait(900); await p.click('[data-act=pchoose]').catch(() => {}); await wait(300); await p.click('[data-act=ptab][data-k=new]').catch(() => {}); await wait(400);
    const g = await p.$('[data-act=gen]');
    check('generation limit: 5 used today → the button is off and says so', !!g && await g.isDisabled() && (await p.innerText('body')).includes('Лимит генераций на сегодня')); await p.close(); }
  { const [p, w] = await open((x) => { x.soloGen = { d: TODAY(x), n: 2 }; return x; });
    await p.goto(URL0 + '?tab=plan'); await wait(900); await p.click('[data-act=pchoose]').catch(() => {}); await wait(300); await p.click('[data-act=ptab][data-k=new]').catch(() => {}); await wait(400);
    const t = await p.innerText('body');
    check('generation limit: 2 used → «Осталось 3 из 5 на сегодня»', t.includes('Осталось 3 из 5 на сегодня'));
    if (await p.$('[data-act=gen]')) { await p.click('[data-act=gen]'); await wait(1500); }
    const put = w.find((x) => x.url.includes('userparam') && decodeURIComponent(x.body).includes('soloGen'));
    check('generation limit: a generation counts (soloGen n=3 in the profile)', !!put && /"n":3/.test(decodeURIComponent(put.body)), put ? decodeURIComponent(put.body).slice(0, 200) : w.map((x) => x.url).join(' ')); await p.close(); }

  { const [p, w] = await open();
    check('«Добавить цель» and «Сбросить» beside the main race', !!(await p.$('[data-act=goaladd]')) && !!(await p.$('[data-act=racereset]')));
    await p.click('[data-act=goaladd]', { timeout: 2000 }).catch(() => {}); await wait(400);
    check('«Добавить цель» opens the window «Главный старт и цель» with the race in it', !!(await p.$('.w-dlg')) && (await p.inputValue('.w-dlg [data-o=d]').catch(() => '')) !== '');
    await p.fill('.w-dlg [data-o=goal]', '3:10').catch(() => {}); await p.click('.w-dlg [data-act=onbok]').catch(() => {}); await wait(1200);
    const put = w.find((x) => x.url.includes('task.php') && /"prediction":"0?3:10/.test(decodeURIComponent(x.body)));
    const sent = put ? JSON.parse(decodeURIComponent(put.body).match(/name="tasks"\s*(\[[\s\S]*?\])\s*-/)[1])[0] : {};
    const was = JSON.parse(BASE_FX).main.main;
    check('…only the goal changes: the race day keeps its task, place and distance', sent.task === was.task && sent.location === was.location && String(sent.prekm) === String(was.prekm), JSON.stringify(sent));
    check("«Изменить цель» saves the new goal on the same race day, no question about the day", !!put && !(await p.$(".w-dlg")), put ? "" : w.map((x) => decodeURIComponent(x.body).replace(/[\r\n]+/g, " ").slice(-260)).join(" "));
    w.length = 0;
    await p.goto(URL0); await wait(900);
    await p.click('[data-act=racereset]', { timeout: 2000 }).catch(() => {}); await wait(300);
    const asks = (await p.innerText('body')).includes('Убрать главный старт');
    await p.click('[data-act=raceresetyes]', { timeout: 2000 }).catch(() => {}); await wait(1200);
    const del = w.find((x) => x.url.includes('task.php') && decodeURIComponent(x.body).includes('"task":""'));
    check('«Сбросить» asks, then deletes the race day from the diary and the plan goes on without a race', asks && !!del && !(await p.innerText('body')).includes('До старта'), del ? decodeURIComponent(del.body).slice(0, 160) : 'no delete'); await p.close(); }
  // Task 6, controller ruling 1: a stored Kazan version (kind 'kazan') is laid by the Kazan rules on /solo/plan too: the goal
  // 4:00 scales the volume (×0.7) and the long run with its text; the same weeks as an ordinary version lay at ×1
  { const wk = (kind) => (x) => { x.versions = [{ id: 'kz1', name: 'Казань 4:00', savedAt: '2026-10-30T10:00:00Z', active: true, ...(kind ? { kind } : {}), distance: 'Марафон · 42.2 км',
      plan: { weeks: [{ week: -2, period: 'База', km: 100, slots: [{ type: 'интервальная', desc: '3×2 км по T10', km: 10 }, { type: 'развивающая', desc: '10 км по T21', km: 10 }, { type: 'длительная', desc: '20 км. Первые 10 км по T42+45, последние 10 км по T42', km: 20 }] },
        { week: -1, period: 'Старт', km: 50, slots: [{ type: 'интервальная', desc: '5 км по T10', km: 5 }, { type: 'длительная', desc: 'Потрусите как пойдёт', km: 0 }, { type: 'соревнование', desc: 'Марафон', km: 42.2 }] }] },
      student: { t5: '4:50', t10: '5:00', t21: '5:15', t42: '5:41', layout: ['easy', 'easy', 'w1', 'rest', 'w2', 'easy', 'long'], kazanGoal: '4:00:00', kazanStart: -24 } }, ...x.versions]; return x; };
    const lay = async (kind) => { const [p] = await open(wk(kind), '?tab=plan'); const tot = await p.$eval('[data-act=wopen][data-w="-2"] .w-wkm', (x) => parseFloat(x.innerText.replace(/\s/g, '').replace(',', '.'))).catch(() => NaN);
      await p.click('[data-act=wopen][data-w="-2"]').catch(() => {}); await wait(300);
      const long = await p.$$eval('.w-wdays > li', (l) => l.map((d) => d.innerText.replace(/\s+/g, ' ')).find((t) => /Длительная/.test(t)) || '').catch(() => '');
      const head = await p.$eval('#w-plan2-h', (x) => x.innerText).catch(() => ''); await p.close(); return { tot, long, head }; };
    const K = await lay('kazan'), S = await lay(null);
    check('/solo/plan lays a stored Kazan version by its goal (4:00: week ×0.7, long run «14 км. Первые 7 км …»); an ordinary one at ×1',
      /«Казань 4:00»/.test(K.head) && Math.abs(K.tot - 70) <= 2 && /14 км\. Первые 7 км/.test(K.long) && Math.abs(S.tot - 100) <= 2 && /20 км\. Первые 10 км/.test(S.long), JSON.stringify({ K, S })); }
  await b.close(); srv.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\nrelease: ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
// FormData bodies arrive as multipart: take the JSON array that follows name="tasks"
function decodeTasks(body) { const m = body.match(/name="tasks"\r?\n\r?\n([\s\S]*?)\r?\n--/); return m ? JSON.parse(m[1]) : []; }
