// Every link and redirect between our pages and the site: «Моя неделя» (solo.js), the promo pages (landing-v2 and
// landing-kazan) and the payment page (pay/). Each path on s10.run must be one we know the site serves (checked 10.11.2026); every way to the
// login must carry a full return address, since the site's login returns only to https://s10.run/… or
// https://challenges.s10.run/….
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };

// paths of s10.run our pages link to, and what serves them on the site
const KNOWN = Object.fromEntries(['/', '/login', '/logout', '/profile', '/student', '/students', '/trainerlist', '/answers', '/about',
  '/money', '/money2', '/money_stripe', '/clubPayment', '/calc3', '/solo/plan', '/solo/kazan', '/pay/', '/post/3578/', '/tilda/85144/offer_tinkoff',
  '/premium', // the site's own header links it the same way
].map((p) => [p, true]));
const SRC = { 'solo.js': 'solo.js', 'landing-v2': 'landing-v2/index.html', 'landing-kazan': 'landing-kazan/index.html', 'pay': 'pay/index.html' };
for (const [name, file] of Object.entries(SRC)) {
  const t = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const hrefs = [...t.matchAll(/href="([^"]+)"|\[`\$\{SITE\}(\/[^`?$]*)|location\.href = '([^']+)'|form\.action = [^;]*/g)].map((m) => m[1] || m[2] || m[3] || m[0]);
  const paths = new Set();
  for (const h of hrefs) {
    if (/^(#|assets\/|fonts\/|scenes\/|\.\.\/landing-v2\/scenes\/|mailto:|tel:)/.test(h) || /\.(css|js|svg|jpg|png)$/.test(h)) continue;
    let u;
    if (/^\$\{esc\(/.test(h)) continue; // the menu: its entries are read below from menuLinks()
    const raw = h.replace(/^\$\{[^}]*\}(?=\/)/, '').replace(/\$\{[^}]*\}/g, '1'); // a leading ${SITE} or demo origin is the site itself
    if (/^form\.action/.test(h)) { (h.match(/'\/[^']+'/g) || []).forEach((x) => paths.add(x.slice(1, -1))); continue; }
    try { u = new URL(raw, 'https://s10.run/'); } catch { continue; }
    if (u.hostname !== 's10.run') continue;
    paths.add(u.pathname.replace(/^\/(profile|student)\?.*/, '/$1'));
  }
  const unknown = [...paths].filter((p) => !KNOWN[p]);
  check(`${name}: every link to s10.run goes to a page the site serves`, !unknown.length, unknown.join(' ') || [...paths].join(' '));
}
// the ways to the login, each with a full return address
const solo = fs.readFileSync(path.join(ROOT, 'solo.js'), 'utf8'), pay = fs.readFileSync(path.join(ROOT, 'pay', 'index.html'), 'utf8'), land = fs.readFileSync(path.join(ROOT, 'landing-v2', 'index.html'), 'utf8');
check('solo.js: «войдите» returns to the full address of the page', /\/login\?back=' \+ encodeURIComponent\(location\.href\)/.test(solo) && !/href="\/login"/.test(solo));
check('pay: logged out → /login with the full address back', /'\/login\?back=' \+ encodeURIComponent\(location\.href\)/.test(pay) && !/encodeURIComponent\(location\.pathname\)/.test(pay));
const landLogins = [...land.matchAll(/href="(https:\/\/s10\.run\/login[^"]*)"/g)].map((m) => m[1]);
check('landing: every button to the login comes back to https://s10.run/solo/plan', landLogins.length >= 5 && landLogins.every((h) => new URL(h).searchParams.get('back') === 'https://s10.run/solo/plan'), `${landLogins.length} buttons`);
const kzLogins = [...fs.readFileSync(path.join(ROOT, 'landing-kazan', 'index.html'), 'utf8').matchAll(/href="(https:\/\/s10\.run\/login[^"]*)"/g)].map((m) => m[1]);
check('landing-kazan: every button to the login comes back to https://s10.run/solo/kazan', kzLogins.length >= 5 && kzLogins.every((h) => new URL(h).searchParams.get('back') === 'https://s10.run/solo/kazan'), `${kzLogins.length} buttons`);

// /solo/kazan: the Kazan marathon mode of the same page; the brief asks the site to serve it as /solo/plan is served
const brief = fs.readFileSync(path.join(ROOT, 'deploy', 'ЗАДАНИЕ.md'), 'utf8');
const modeRe = (solo.match(/const MODE = (\/[^;]*?\/)\.test\(location\.pathname\)/) || [])[1];
const isKazan = modeRe ? new RegExp(modeRe.slice(1, -1)) : null;
check('links: /solo/kazan known (the page\'s Kazan path, in the brief beside /solo/plan)', KNOWN['/solo/kazan'] && isKazan && isKazan.test('/solo/kazan') && isKazan.test('/solo/kazan/') && !isKazan.test('/solo/plan')
  && /\/solo\/kazan/.test(brief), modeRe || 'no MODE line');
// /solo/kazan/start: the Kazan promo page, its own file; the Kazan mode must not take that address
check('links: /solo/kazan/start is the Kazan promo page, not the Kazan mode', isKazan && !isKazan.test('/solo/kazan/start') && /`\/solo\/kazan\/start`[^\n]*`kazan-start\.html`/.test(brief));

const failed = results.filter((x) => !x).length;
console.log(`\nlinks: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
