// One person's whole way, as it ships (release/), on a stand-in of s10.run: the promo page → «войти» → the plan without
// Premium → «Оформить Premium» → the payment page /pay/ → the bank → the plan again, now with Premium → «Заполнить
// календарь». Twice: S10 Solo (/solo/start → /solo/plan) and the Kazan marathon (/solo/kazan/start → /solo/kazan), on a
// computer and on a phone. Every request to s10.run (http or https) is answered here from the demo snapshot; the login
// and the bank are stand-ins (the site's own, not ours); /money goes to /pay/ as the package brief plans it. Nothing
// leaves the machine. Run after `npm run build`.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), REL = path.join(ROOT, 'release');
global.window = {}; require(path.join(ROOT, 'demo', 'fixtures.js')); const BASE_FX = JSON.stringify(window.S10_FIXTURES);

const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const formField = (body, name) => { const m = String(body).match(new RegExp(`name="${name.replace(/[[\]]/g, '\\$&')}"\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n--`)); return m ? m[1] : null; };
const decodeTasks = (body) => { const v = formField(body, 'tasks'); return v ? JSON.parse(v) : []; };
const TODAY = '2026-11-22';

// the site's /money2 and /money_stripe as pay/ reads them (a Russian athlete, no autopay, 750 ₽ / 9 €, see tests/pay.cjs)
const money2 = () => `<html><body><div class="row"><div class="col-xs-4"><h1>Платформа</h1><p><b>Стоимость сервисов 750 рублей в месяц</b><br>Сейчас оплачено до <span class="label label-success">19 ноября 2026 г.</span><br><b>Сейчас автоматический платеж не подключен</b><br></p>
  <form>Введите ваш емейл <input type="text" name="email" value="athlete@example.com" class="form-control"><h2>Сделать платеж</h2>
  <h3>Оплатить 12 месяцев -&nbsp;9000 рублей</h3><button type="submit" name="paymonth12" value="1">Оплатить 12 месяцев</button>
  <h3>Оплатить 1 месяц -&nbsp;750 рублей</h3><input type="hidden" name="paysite" value="1"><input type="checkbox" name="recur" value="1"><button type="submit">Оплатить</button></form></div></div></body></html>`;
const stripe = () => `<html><body><div class="col-md-4"><h1>Платформа</h1><p>Сейчас оплачено до <b>19 ноября 2026 г.</b><br><b>Стоимость сервисов 9.00 EUR в месяц</b><br></p><h2>Сделать платеж</h2><b>Сейчас автоматический платеж не подключен</b><br>
  <form><input type="hidden" name="paysite" value="1"><button type="submit">Оплатить 9.00 EUR</button><input type="checkbox" name="siterecur" value="1" checked></form></div></body></html>`;

// one person: logged in or not, Premium or not, and what the site keeps (diary, main race, plan versions)
function stand(kind) {
  const FX = JSON.parse(BASE_FX);
  FX.main = { main: null }; FX.versions = []; FX.library = []; FX.results = []; FX.startParam = { param: {} }; FX.diary.diaryTasksInfo = [];
  FX.me.nowmsk = Date.parse(`${TODAY}T09:00:00Z`) / 1000; FX.me.isPremium = false;
  const S = { kind, in: false, FX, writes: [], missing: [], outside: [], paid: null };
  S.handle = async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname;
    if (u.hostname !== 's10.run') { S.outside.push(u.hostname); return route.abort(); }
    const send = (status, type, body, headers = {}) => route.fulfill({ status, contentType: type, body, headers });
    const file = (f) => fs.existsSync(f) && fs.statSync(f).isFile() ? send(200, TYPES[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f)) : (S.missing.push(p), send(404, 'text/plain', ''));
    const json = (x) => send(200, 'application/json', JSON.stringify(x));
    // a redirect inside the page: a 302 from route.fulfill is followed by the browser past the routes, to the real site
    const go = (to) => send(200, TYPES['.html'], `<!doctype html><script>location.replace(${JSON.stringify(to)})</script>`);
    if (p === '/solo/start') return file(path.join(REL, 'solo-start.html'));
    if (p === '/solo/kazan/start') return file(path.join(REL, 'kazan-start.html'));
    if (p === '/solo/plan' || p === '/solo/kazan' || p === '/solo/kazan/') return file(path.join(REL, 'solo.html'));
    if (p === '/t5/solo/solo.js') return file(path.join(REL, 't5', 'solo', 'solo.js'));
    if (p.startsWith('/t5/')) return send(404, 'text/plain', ''); // the site's own shell files (Roboto, cookie banner): not ours
    if (p.startsWith('/pay/')) return file(path.join(REL, 'pay', p.slice(5) || 'index.html'));
    // the site's login: it returns only to a full https://s10.run/… address
    if (p === '/login') { const back = u.searchParams.get('back') || '';
      return send(200, TYPES['.html'], `<!doctype html><meta charset="utf-8"><h1>Вход в S10</h1><p id="back">${back}</p>${/^https:\/\/s10\.run\//.test(back) ? `<a id="enter" href="/login-ok?back=${encodeURIComponent(back)}">Войти</a>` : '<p id="bad">Неверный адрес возврата</p>'}`); }
    if (p === '/login-ok') { S.in = true; return go(u.searchParams.get('back')); }
    if (p === '/money') return go('/pay/'); // the install package: /money → /pay/ once the owner says so
    if (/^\/(money2|money_stripe)$/.test(p) && u.searchParams.get('paysite') === '1') { // the bank: the payment goes through
      S.paid = p + u.search; FX.me.isPremium = true;
      return send(200, TYPES['.html'], '<!doctype html><meta charset="utf-8"><h1>Оплата прошла</h1>'); }
    if (p === '/money2') return send(200, TYPES['.html'], money2());
    if (p === '/money_stripe') return send(200, TYPES['.html'], stripe());
    if (p === '/apiapp/me') return S.in ? json({ id: FX.me.id, subscriptionExpiredAt: Date.parse(`${FX.me.isPremium ? '2026-12-22' : '2026-11-19'}T00:00:00+03:00`) / 1000, email: 'athlete@example.com', role: 'STUDENT' }) : send(401, 'application/json', 'null');
    if (/^\/(apiweb|student$|t7\/plan-templates)/.test(p) || p === '/student') {
      const s = u.href;
      if (s.includes('/student/self/info')) return S.in ? json(FX.me) : send(200, 'application/json', 'null');
      if (!S.in) return send(401, 'application/json', 'null');
      if (req.method() === 'POST') {
        if (s.includes('generate.php')) return send(200, 'text/plain; charset=utf-8', FX.generated);
        const body = req.postData() || ''; S.writes.push({ url: p + u.search, body });
        if (s.includes('task.php')) for (const t of decodeTasks(body)) {
          const list = FX.diary.diaryTasksInfo, i = list.findIndex((x) => x.date === t.d);
          if (!t.task) { if (i >= 0) list.splice(i, 1); continue; }
          const row = { date: t.d, type: +t.typtrain, comment: t.task, target: +t.prekm, main6: +t.main6 || 0, location: t.location, prediction: t.prediction, tracks: [] };
          if (i >= 0) list[i] = row; else list.push(row);
          if (+t.main6 === 1) FX.main = { main: { d: t.d, task: t.task, prekm: t.prekm, typtrain: +t.typtrain, prediction: t.prediction, location: t.location } };
        }
        const pl = formField(body, `param[studentPlans${FX.me.id}]`); if (pl) FX.versions = JSON.parse(pl);
        return json(s.includes('task.php') ? { message: {} } : { ok: true });
      }
      if (s.includes('task.php?action=main')) return json(FX.main);
      if (s.includes('studentMainStart')) return json(FX.startParam);
      if (s.includes('planresults.php')) return json(FX.results);
      if (p === '/student') return json({ diaryTasksInfo: FX.diary.diaryTasksInfo, diaryTasksisMoreExist: 0 });
      if (s.includes('tasktemplates.php')) return json(FX.templates);
      if (s.includes('param[]=studentPlans')) return json({ param: { [`studentPlans${FX.me.id}`]: JSON.stringify(FX.versions) } });
      if (s.includes('param[]=planTemplates')) return json({ param: { planTemplates: JSON.stringify(FX.library) } });
      if (s.includes('param[]=soloGen')) return json({ param: { soloGen: null } });
      if (s.includes('calc.php')) return json(FX.base);
    }
    S.missing.push(p); return send(404, 'text/plain', '');
  };
  return S;
}

async function journey(browser, kind, device) {
  const KZ = kind === 'kazan', phone = device === 'phone', tag = `${KZ ? 'kazan' : 'solo'}, ${device}`;
  const S = stand(kind);
  const ctx = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', ...(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 900 } }) }); // a Russian athlete
  await ctx.route('**/*', S.handle);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(`${new URL(p.url()).pathname}: ${e.message}`));
  const PLAN = `https://s10.run/solo/${KZ ? 'kazan' : 'plan'}`;
  const body = async () => (await p.innerText('body')).replace(/\s+/g, ' ');

  // 1. the promo page, logged out: its first button goes to the login with the way back to the plan
  await p.goto(`https://s10.run/solo/${KZ ? 'kazan/' : ''}start`, { waitUntil: 'load' }); await wait(800);
  const cta = await p.evaluate(() => { // the first button a person sees: in the Kazan blocks' shadow root or on the page
    const all = [...(document.getElementById('kml')?.shadowRoot?.querySelectorAll('a') || []), ...document.querySelectorAll('a.btn, a.cta')].filter((a) => /\/login\?/.test(a.href));
    const a = all.find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!a) return null; a.dataset.journey = '1'; return { href: a.href, text: a.innerText.trim(), n: all.length };
  });
  check(`${tag}: promo page opens, its first button «${cta?.text}» goes to the login`, cta && new URL(cta.href).searchParams.get('back') === PLAN && !errs.length, `${cta?.href}; ${cta?.n} buttons; ${errs.join('; ')}`);
  const kml = await p.$('#kml');
  if (kml && await p.evaluate(() => !!document.querySelector('#kml')?.shadowRoot?.querySelector('[data-journey]'))) await p.locator('#kml a[data-journey]').click();
  else await p.click('[data-journey]');
  await p.waitForURL(/\/login\?/, { timeout: 8000 }).catch(() => {});
  check(`${tag}: the login opens with the way back to ${PLAN}`, (await p.textContent('#back').catch(() => '')) === PLAN && !!(await p.$('#enter')), p.url());

  // 2. logged in, no Premium: the plan opens, «Оформить Premium» instead of «Заполнить календарь»
  await p.click('#enter'); await p.waitForURL(PLAN, { timeout: 8000 }).catch(() => {});
  await p.waitForSelector('#s10-week', { timeout: 20000 }).catch(() => {}); await wait(1200);
  const first = await setUp(p, KZ);
  const buy = await p.$('[data-act=buy]');
  check(`${tag}: after the login, back on the plan; no Premium → «Оформить Premium», nothing written to the profile`, p.url().startsWith(PLAN) && !!buy && !(await p.$('[data-act=fillask]')) && !S.writes.some((w) => w.url.includes('task.php') || /studentPlans/.test(w.body)) && !errs.length,
    `${p.url()}; ${first}; ${(await body()).slice(0, 160)}; ${errs.join('; ')}`);

  // 3. the payment: «Оформить Premium» → /money → /pay/ → ₽, a month → the bank
  if (buy) { await buy.scrollIntoViewIfNeeded(); await buy.click(); }
  await p.waitForURL(/\/pay\/$/, { timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => document.documentElement.dataset.loaded, null, { timeout: 10000 }).catch(() => {}); await wait(200);
  const pay = await p.evaluate(() => ({ head: document.querySelector('#pay-h')?.textContent, state: document.querySelector('#paystate')?.textContent, form: !document.querySelector('#payform')?.hidden, sum: document.querySelector('#sum')?.textContent }));
  check(`${tag}: «Оформить Premium» opens the payment page: 750 ₽ or 9 €, the form`, /\/pay\/$/.test(p.url()) && pay.head === 'Месяц Premium за 750 ₽ или 9 €' && pay.form && !errs.length, `${p.url()}; ${JSON.stringify(pay)}; ${errs.join('; ')}`);
  await p.click('.pay__cur label:has(input[value=rub])').catch(() => {});
  const sub = p.locator('#payform button[type=submit]'); await sub.scrollIntoViewIfNeeded().catch(() => {}); await sub.click().catch(() => {});
  await p.waitForURL(/\/money2\?/, { timeout: 8000 }).catch(() => {});
  const paid = S.paid ? new URL(S.paid, 'https://s10.run') : null;
  check(`${tag}: «Оплатить Premium» goes to the bank: /money2?paysite=1 with the email`, paid && paid.pathname === '/money2' && paid.searchParams.get('email') === 'athlete@example.com' && /Оплата прошла/.test(await body()), S.paid);

  // 4. back on the plan, now with Premium: «Заполнить календарь» writes the diary
  await p.goto(PLAN); await p.waitForSelector('#s10-week', { timeout: 20000 }).catch(() => {}); await wait(1200);
  const second = await setUp(p, KZ);
  if (!KZ) check(`${tag}: after paying, the plan generated before is still there (kept in the browser, not generated again)`, !/generated/.test(second) && /Новый план/.test(await body()), second);
  const fill = await p.$('[data-act=fillask]');
  check(`${tag}: with Premium the plan offers «Заполнить календарь», no Premium button`, !!fill && !(await p.$('[data-act=buy]')) && !errs.length, `${second}; ${(await body()).slice(0, 160)}; ${errs.join('; ')}`);
  const n0 = S.writes.length;
  if (fill) { await fill.scrollIntoViewIfNeeded(); await fill.click(); await wait(300); await p.click('[data-act=fillyes]').catch(() => {}); await wait(300);
    if (await p.$('[data-act=kmainyes]')) await p.click('[data-act=kmainyes]'); }
  await p.waitForFunction(() => !document.querySelector('[data-act=fillyes], [data-act=kmainyes]') && document.querySelector('.w-flash'), null, { timeout: 20000 }).catch(() => {}); await wait(600);
  const tasks = S.writes.slice(n0).filter((w) => w.url.includes('task.php')).flatMap((w) => decodeTasks(w.body));
  const days = tasks.filter((t) => t.task && +t.main6 !== 1), race = tasks.find((t) => +t.main6 === 1);
  const flash = await p.$eval('.w-flash', (x) => x.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  const raceOk = KZ ? race && race.d === '2027-05-02' && race.location === 'Казань' && S.FX.main.main?.d === '2027-05-02' : !race; // Solo: «Отсутствует» in the start window, no race
  check(`${tag}: «Заполнить календарь» writes the days${KZ ? ', the race 2 May is the main race' : ' (no race: «Отсутствует»)'}, the page says so`, days.length >= 7 && days.every((t) => t.d > TODAY) && raceOk && /Календарь заполнен/.test(flash) && !errs.length,
    `${days.length} days ${days[0]?.d}…${days[days.length - 1]?.d}; race ${JSON.stringify(race || S.FX.main.main)}; «${flash}»; ${errs.join('; ')}`);

  // 5. a later visit: the diary shows what was written, nothing asks again
  await p.goto(PLAN); await p.waitForSelector('#s10-week', { timeout: 20000 }).catch(() => {}); await wait(1200);
  check(`${tag}: a later visit: no start window, the race on the page`, !(await p.$('.w-dlg')) && (KZ ? /Казан/.test(await body()) : true) && !errs.length, `${(await body()).slice(0, 160)}; ${errs.join('; ')}`);
  check(`${tag}: nothing missing on the site (no 404 of ours), nothing sent outside`, !S.missing.length && !S.outside.filter((h) => !/fonts\.(googleapis|gstatic)\.com|t\.me/.test(h)).length, `missing ${S.missing.join(' ')}; outside ${[...new Set(S.outside)].join(' ')}`);
  await ctx.close();
}

// what the page asks a new athlete first: Solo — the start window and the generator; Kazan — the goal (its own plan)
async function setUp(p, KZ) {
  const out = [];
  if (await p.$('.w-dlg [data-act=onbnone]')) { await p.click('[data-act=onbnone]'); await wait(300); out.push('start window'); }
  if (!(await p.$('[data-act=buy], [data-act=fillask]')) && await p.$('[data-act=tab][data-k=plan]')) { await p.click('[data-act=tab][data-k=plan]'); await wait(600); out.push('plan tab'); }
  if (!KZ && await p.$('[data-act=gen]')) { await p.click('[data-act=gen]'); await p.waitForSelector('[data-act=buy], [data-act=fillask]', { timeout: 8000 }).catch(() => {}); await wait(300); out.push('generated'); }
  if (KZ && await p.$('[data-act=kgoal]')) out.push(`goal ${await p.$eval('[data-act=kgoal][aria-pressed=true]', (x) => x.dataset.g).catch(() => '?')}`);
  return out.join(', ') || 'nothing asked';
}

module.exports = { stand, setUp, wait, chromium };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] }); // no name resolves: nothing can reach a real site
  for (const kind of ['solo', 'kazan']) for (const device of ['desktop', 'phone']) await journey(browser, kind, device);
  await browser.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\njourney: ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
