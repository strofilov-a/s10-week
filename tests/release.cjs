// Checks the release build (release/t5/solo/solo.js, no demo) the way s10.run would run it: the page and the script are
// served at /solo/plan and /t5/solo/solo.js, and the site's endpoints answer from the demo snapshot; every write is
// recorded, nothing leaves the machine. Run after `npm run build`.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), REL = path.join(ROOT, 'release');
global.window = {}; require(path.join(ROOT, 'demo', 'fixtures.js')); const BASE_FX = JSON.stringify(window.S10_FIXTURES);

const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
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
    if (u.includes('param[]=studentPlans')) return json(route, { param: { [`studentPlans${FX.me.id}`]: JSON.stringify(FX.versions) } });
    if (u.includes('param[]=planTemplates')) return json(route, { param: { planTemplates: JSON.stringify(FX.library) } });
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

  { const [p] = await open(); const t = (await p.innerText('body')).replace(/\s+/g, ' ');
    check('athlete with data: page, race, no demo banner, Telegram link', t.includes('До старта') && t.includes('Valencia') && !/[Дд]емо/.test(t) && !!(await p.$('.w-foot a[href="https://t.me/+wP4aOZ4910I2MTk6"]')) && !(await p.$('.w-dlg')));
    check('links stay on the site (logo «/», calc3 relative)', (await p.$eval('.w-wm', (a) => a.getAttribute('href'))) === '/');
    check('no errors', !p.errs.length, p.errs.join('; ')); await p.close(); }

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
    check('new athlete without premium: fill disabled', await p.$eval('[data-act=fillask]', (x) => x.disabled)); await p.close(); }

  { const p = await b.newPage(); await site(p, (x) => { x.me = null; return x; }); await p.goto(URL0); await wait(800);
    check('logged out: «войдите в S10»', (await p.innerText('body')).includes('войдите в S10')); await p.close(); }

  await b.close(); srv.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\nrelease: ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
// FormData bodies arrive as multipart: take the JSON array that follows name="tasks"
function decodeTasks(body) { const m = body.match(/name="tasks"\r?\n\r?\n([\s\S]*?)\r?\n--/); return m ? JSON.parse(m[1]) : []; }
