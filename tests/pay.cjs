// Checks the Premium payment page as it ships (release/pay, the demo cut out) live, as on s10.run: the page is opened at http://s10.run:<port>/pay/
// served by a local stand-in of the site, so LIVE is on. /money2 and /money_stripe answer with markup written after the site's
// templates (t/money2.twig, t/money_stripe.twig of the 10.11.2026 export), in Russian or English, with autopay on or
// off, a locked or zero price, no email; /money_stripe redirects Russian users to /money2 unless ?en=1, as
// money_stripe.php:15 does. Nothing leaves the machine.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const PAY = path.resolve(__dirname, '..', 'release', 'pay');   // what ships: run after `npm run build`

const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.json': 'application/json' };

const T = {
  ru: { cost: 'Стоимость сервисов', rubm: 'рублей в месяц', until: 'Сейчас оплачено до', off: 'Сейчас автоматический платеж не подключен', on: 'У Вас настроен сервис Автоматического платежа.', y: 'Оплатить 12 месяцев', m: 'Оплатить 1 месяц', rub: 'рублей', eurm: 'в месяц', mail: 'Для оплаты необходимо заполнить поле email в профиле', date: '10 декабря 2026 г.' },
  en: { cost: 'Cost of services', rubm: 'rubles per month', until: 'Paid until', off: 'Automatic payment is not connected', on: 'You have automatic payment set up.', y: 'Pay for 12 months', m: 'Pay for 1 month', rub: 'rubles', eurm: 'per month', mail: 'To pay, please fill in the email field in your profile', date: 'December 10, 2026' },
};
// the coach block both pages carry for some athletes: its own «not connected» line and a paytrainer form must not be read as the site's
const coachBlock = (t) => `<div class="col-xs-4"><h1>Тренер</h1>${t.until} <b>1 ноября 2026 г.</b><br><b>${t.off}</b><br><form><input type="hidden" name="paytrainer" value="1"><button>Оплатить</button></form></div>`;
function money2(o) {
  const t = T[o.lang], P = o.price;
  const form = o.recur ? `<h3>${t.y} -&nbsp;${P * 12} ${t.rub}</h3><button type="submit" class="btn btn-primary btn-lg disabled">${t.y}</button>
      <h3>${t.on}</h3>Стоимость 1 месяца подписки ${P} ${t.rub}<br><a href="?paysiterecur=off" class="btn btn-warning btn-lg active">Отключить</a>`
    : `<form>Введите ваш емейл <input type="text" name="email" value="${o.email}" class="form-control"><h2>Сделать платеж</h2><b>${t.off}</b><br><img src="/i/tinkoff.png"><br>
      ${o.lock ? '' : `<h3>${t.y} -&nbsp;${P * 12} ${t.rub}</h3><button type="submit" name="paymonth12" value="1">${t.y}</button>
      <h3>${t.m} -&nbsp;${P} ${t.rub}</h3><input type="hidden" name="paysite" value="1"><input type="checkbox" name="recur" value="1"><button type="submit">Оплатить</button></form>`}`;
  return `<html><body><header><a href="/profile?1000000001">Профиль</a></header><div class="row"><div class="col-xs-4"><h1>Платформа</h1>
    <p><b>${t.cost} ${P} ${t.rubm}</b><br>${t.until} <span class="label label-success">${t.date}</span><br>${o.recur ? '' : `<b>${t.off}</b><br>`}</p>
    ${P ? form : `<h2>Сделать платеж</h2><img src="/i/tinkoff.png">`}</div>${coachBlock(t)}</div></body></html>`;
}
function stripe(o) {
  const t = T[o.lang], E = o.eur.toFixed(2);
  const body = o.recur ? `<h3>${t.on}</h3><a href="/money_stripe?siterecuroff=off" class="btn btn-warning">Отключить</a>`
    : !E || o.lock ? '' : `<h2>Сделать платеж</h2><b>${t.off}</b><br>${o.email ? `<form><input type="hidden" name="paysite" value="1"><button type="submit">Оплатить ${E} EUR</button><input type="checkbox" name="siterecur" value="1" checked></form>` : `<a href="/profile?1000000001">${t.mail}</a>`}`;
  return `<html><body><header><a href="/profile?1000000001">Профиль</a></header><div class="col-md-4"><h1>Платформа</h1>
    <p>${t.until} <b>${t.date}</b><br><b>${t.cost} ${E} EUR ${t.eurm}</b><br></p>${body}</div>${coachBlock(t)}</body></html>`;
}

// One local server plays s10.run: Chromium resolves s10.run to 127.0.0.1 (LIVE checks only the hostname), so the
// site's redirects are real and nothing can reach the real site; every other host is blocked.
let O = {}, HITS = [];
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://s10.run'), pth = u.pathname, o = O;
  const send = (code, type, body, h = {}) => { r.writeHead(code, { 'Content-Type': type, ...h }); r.end(body); };
  const html = (body) => send(200, TYPES['.html'], body);
  if (/^\/(money2|money_stripe|clubPayment)/.test(pth)) HITS.push(pth + u.search);
  if (pth.startsWith('/pay/')) {
    const f = path.join(PAY, pth.slice(5) || 'index.html');
    return fs.existsSync(f) && fs.statSync(f).isFile() ? send(200, TYPES[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f)) : send(404, 'text/plain', '');
  }
  if (pth === '/apiweb/student/self/info/') return send(200, 'application/json', JSON.stringify({ id: 1000000001, firstName: 'Атлет', role: o.role, isPremium: true, nowmsk: Date.parse('2026-11-11T09:00:00Z') / 1000 }));
  if (pth === '/apiapp/me') {
    const ts = o.paysite ? Date.parse(o.paysite + 'T00:00:00+03:00') / 1000 : null;
    const json = JSON.stringify({ id: 1000000001, subscriptionExpiredAt: ts, email: o.email, role: 'STUDENT' });
    return send(200, 'application/json', (o.notice ? '<br />\n<b>Deprecated</b>: strtotime(): Passing null to parameter #1 in <b>/apiapp/me.php</b> on line <b>39</b><br />\n' : '') + json);
  }
  if (pth === '/money2' && o.club) return send(302, 'text/plain', '', { Location: '/clubPayment' });
  if (pth === '/money_stripe' && o.ru && !u.searchParams.get('en')) return send(302, 'text/plain', '', { Location: '/money2' });
  if (pth === '/money2') return html(money2(o));
  if (pth === '/money_stripe') return html(stripe(o));
  if (pth === '/clubPayment') return html('<html><body>Клуб</body></html>');
  send(404, 'text/plain', '');
});
let BASE = '';

async function open(b, o = {}) {
  O = { lang: 'ru', ru: true, price: 750, eur: 9, recur: false, lock: false, email: 'athlete@example.com', paysite: '2026-12-10', role: 'student', club: false, notice: false, q: '', ...o };
  HITS = [];
  const hits = HITS;
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.route((url) => url.hostname !== 's10.run', (route) => route.abort());
  await p.goto(BASE + '/pay/' + O.q);
  await p.waitForFunction(() => document.documentElement.dataset.loaded, null, { timeout: 8000 });
  await wait(100);
  const s = await p.evaluate(() => ({
    head: document.querySelector('#pay-h').textContent, state: document.querySelector('#paystate').textContent,
    form: !document.querySelector('#payform').hidden, alt: !document.querySelector('#payalt').hidden,
    altText: document.querySelector('#payalt-label').textContent, altHref: document.querySelector('#payalt-link').getAttribute('href'),
    rub: !document.querySelector('input[name=cur][value=rub]').disabled, eur: !document.querySelector('input[name=cur][value=eur]').disabled,
    year: !document.querySelector('input[name=period][value="12"]').disabled, p12: document.querySelector('#p12').textContent,
    email: document.querySelector('#email').value, sum: document.querySelector('#sum').textContent,
  }));
  return { p, s, hits };
}
// press «Оплатить Premium» and catch the page it opens
async function pay(p, cur, { year = false, mail } = {}) {
  await p.click(`.pay__cur label:has(input[value=${cur}])`);
  if (year) await p.click('.pay__plan:has(input[value="12"])');
  if (mail !== undefined) await p.fill('#email', mail);
  const nav = p.waitForRequest((r) => r.isNavigationRequest() && /\/money(2|_stripe)\?.*paysite=1/.test(r.url()), { timeout: 4000 }).catch(() => null);
  await p.click('#payform button[type=submit]');
  const r = await nav; return r ? new URL(r.url()) : null;
}

srv.listen(0, '127.0.0.1', async () => {
  BASE = `http://s10.run:${srv.address().port}`;
  const src = fs.readFileSync(path.join(PAY, 'index.html'), 'utf8');
  check('no Google Fonts: IBM Plex from pay/fonts, every file there', !/fonts\.(googleapis|gstatic)\.com/.test(src) && [...src.matchAll(/url\((fonts\/[^)]+)\)/g)].every((m) => fs.existsSync(path.join(PAY, m[1]))));
  const b = await chromium.launch({ args: ['--host-resolver-rules=MAP s10.run 127.0.0.1'] });
  { const { p, s, hits } = await open(b);
    check('ru athlete: paid-until from /apiapp/me, both prices from the pages', s.state.startsWith('Ваш Premium оплачен до 10 декабря 2026.') && s.head === 'Месяц Premium за 750 ₽ или 9 €', `${s.state} | ${s.head}`);
    check('ru athlete: euro page read with en=1 (no redirect to /money2), rubles from /money2', hits.includes('/money_stripe?en=1') && hits.includes('/money2') && s.eur && s.rub, hits.join(' '));
    check('coach block on the pages is not read as the site (autopay off, form on)', s.form && !s.alt);
    check('email comes from the profile', s.email === 'athlete@example.com');
    const u = await pay(p, 'rub', { year: true });
    check('₽ 12 months: GET /money2?paysite=1&paymonth12=1&email=…, no recur, no en', u && u.pathname === '/money2' && u.searchParams.get('paymonth12') === '1' && u.searchParams.get('email') === 'athlete@example.com' && !u.searchParams.has('recur') && !u.searchParams.has('en'), u && u.search);
    check('no errors', !p.errs.length, p.errs.join('; ')); await p.close(); }

  { const { p } = await open(b);
    const u = await pay(p, 'eur');
    check('€: GET /money_stripe?paysite=1&en=1 (a Russian user is not sent back to /money2)', u && u.pathname === '/money_stripe' && u.searchParams.get('en') === '1' && !u.searchParams.has('paymonth12'), u && u.search);
    await p.close(); }

  { const { s } = await open(b, { lang: 'en', ru: false });
    check('English site language: same date, prices and form', s.state.startsWith('Ваш Premium оплачен до 10 декабря 2026.') && s.head === 'Месяц Premium за 750 ₽ или 9 €' && s.form, `${s.state} | ${s.head}`); }

  { const { s } = await open(b, { notice: true });
    check('/apiapp/me with a PHP notice before the JSON still gives the date', s.state.startsWith('Ваш Premium оплачен до 10 декабря 2026.'), s.state); }

  { const { s } = await open(b, { recur: true });
    check('autopay on (₽): no form, says so, link to manage it on /money2', !s.form && s.alt && /Автоплатёж подключён/.test(s.state) && s.altHref === '/money2', `${s.state} | ${s.altHref}`); }

  { const { s } = await open(b, { recur: true, lang: 'en' });
    check('autopay on, English pages: still found by the switch-off link', !s.form && s.alt && /Автоплатёж подключён/.test(s.state)); }

  { const { s, hits } = await open(b, { paysite: null });
    check('no paysite yet: only the page the site routes to is opened, once (one trial, as /money gives)', hits.filter((h) => h.startsWith('/money')).length === 2 && hits[0] === '/money_stripe' && hits[1] === '/money2', hits.join(' '));
    check('no paysite yet: rubles only, «Premium сейчас не оплачен»', s.form && s.rub && !s.eur && s.state.startsWith('Premium сейчас не оплачен.'), s.state); }

  { const { s, hits } = await open(b, { role: 'trainer' });
    check('coach: no money page opened, says Premium is on, link to «Платежи»', !s.form && s.alt && /тренеров Premium включён/.test(s.state) && s.altHref === '/money2' && !hits.length, s.state); }

  { const { s } = await open(b, { club: true });
    check('club: link to the club payment', !s.form && s.alt && s.altHref === '/clubPayment'); }

  { const { s } = await open(b, { lock: true });
    check('payment locked on both pages: no form, link to /money', !s.form && s.alt && s.altHref === '/money', s.state); }

  { const { s } = await open(b, { price: 0, eur: 0 });
    check('zero price: no 750/9 made up, link to /money', !s.form && s.alt && s.altHref === '/money'); }

  { const { s } = await open(b, { price: 500, q: '?cur=rub' });
    check('group price 500 ₽: shown as is, 12 months off (money2.php charges 750 × 12)', s.head.startsWith('Месяц Premium за 500 ₽') && !s.year && s.p12 === 'Только помесячно', `${s.head} | ${s.p12}`); }

  { const { p, s, hits } = await open(b, { email: '' });
    check('no email: € still offered, asks for the email', s.eur && s.email === '');
    const u = await pay(p, 'eur', { mail: 'new@example.com' });
    check('no email, €: saves it via /money2?email= first, then /money_stripe?paysite=1&en=1', hits.includes('/money2?email=new%40example.com') && u && u.pathname === '/money_stripe' && u.searchParams.get('en') === '1', hits.join(' '));
    await p.close(); }

  { const { p } = await open(b, { email: '' });
    await p.click('.pay__cur label:has(input[value=rub])'); await p.click('#payform button[type=submit]'); await wait(200);
    check('₽ without email: stays, shows the error', !(await p.isHidden('#email-err')) && new URL(p.url()).pathname === '/pay/');
    await p.close(); }

  await b.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\npay: ${results.length - failed} passed, ${failed} failed`);
  srv.close();
  process.exit(failed ? 1 : 0);
});
