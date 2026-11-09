// Checks the release promo page (release/solo-start.html) the way s10.run would serve it at /solo/start, with every
// request outside this machine blocked (the fonts too): the scroll scenes must run from the inlined libraries alone,
// every action must lead to the login with the way back to /solo/plan, and the paces must follow the goal.
// Run after `npm run build`.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, '..', 'release', 'solo-start.html');
const LOGIN = 'https://s10.run/login?back=https%3A%2F%2Fs10.run%2Fsolo%2Fplan';

const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };
const srv = http.createServer((q, r) => {
  if (new URL(q.url, 'http://x').pathname !== '/solo/start') { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE));
});

(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/solo/start`;
  const browser = await chromium.launch();
  for (const [w, h, name] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'phone']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(800);

    check(`${name}: the title`, (await page.textContent('h1')).trim() === 'S10 Solo — план до старта');
    check(`${name}: the scroll libraries run from the page itself`, await page.evaluate(() => !!(window.gsap && window.ScrollTrigger && window.Stage && window.Stage.live)));
    const live = await page.evaluate(() => ['plan', 'how', 'feats'].map((id) => document.getElementById(id).classList.contains('is-live')));
    check(`${name}: the three scroll scenes are live`, live.every(Boolean), live.join(' '));
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a.btn, a.cta')].map((a) => a.href));
    check(`${name}: every action goes to the login and back to /solo/plan`, hrefs.length >= 5 && hrefs.every((x) => x === LOGIN), `${hrefs.length} actions`);

    // the race circle lands on 6 December when the calendar pins
    await page.evaluate(() => scrollTo(0, document.getElementById('plan').getBoundingClientRect().top + scrollY));
    await page.waitForTimeout(600);
    const landed = await page.evaluate(() => {
      const orb = document.getElementById('orb'), cell = document.querySelector('.d.race');
      return { orbGone: orb.classList.contains('gone'), cellShown: getComputedStyle(cell).visibility === 'visible' };
    });
    check(`${name}: the race circle lands on 6 December`, landed.orbGone && landed.cellShown, JSON.stringify(landed));

    // the features scene steps through all six
    const steps = [];
    for (const f of [0.05, 0.5, 0.95]) {
      await page.evaluate((f) => { const r = document.getElementById('feats'); scrollTo(0, r.getBoundingClientRect().top + scrollY + (r.offsetHeight - innerHeight) * f); }, f);
      await page.waitForTimeout(700);
      steps.push(await page.textContent('#feat-count'));
    }
    check(`${name}: «Что умеет Solo» steps from the first feature to the sixth`, steps[0] === '1 из 6' && steps[2] === '6 из 6', steps.join(' → '));

    // paces follow the goal: 3:20 marathon gives 4:44, a 1:30 half its own pace
    const p0 = await page.textContent('#pc-main');
    await page.check('input[name="d"][value="21.0975"]', { force: true });
    await page.evaluate(() => { const r = document.getElementById('pc-t'); r.value = 5400; r.dispatchEvent(new Event('input', { bubbles: true })); });
    const p1 = await page.textContent('#pc-main');
    check(`${name}: paces follow the goal`, p0 === '4:44' && p1 === '4:16', `${p0}, then ${p1}`);

    // the closing «Начать» block is an arch: its sentence and arrow stay inside the rounded corners (cut on phones and
    // tablets before 09.11.2026)
    await page.evaluate(() => document.querySelector('.cta').scrollIntoView({ block: 'end' })); await page.waitForTimeout(300);
    const cut = await page.evaluate(() => {
      const c = document.querySelector('.cta'), R = c.getBoundingClientRect(), r = parseFloat(getComputedStyle(c).borderTopLeftRadius);
      const outside = (x, y) => { const dy = r - (y - R.top); if (dy <= 0) return false; const dl = r - (x - R.left), dr = r - (R.right - x); return (dl > 0 && dl * dl + dy * dy > r * r) || (dr > 0 && dr * dr + dy * dy > r * r); };
      return [c.querySelector('.cta-sent'), c.querySelector('svg')].filter((e) => { const q = e.getBoundingClientRect(); return [[q.left, q.top], [q.right, q.top]].some(([x, y]) => outside(x, y)); }).map((e) => e.tagName);
    });
    check(`${name}: the closing sentence and arrow inside the arch`, !cut.length, cut.join(', '));

    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${name}: nothing runs off the side`, over <= 0, `${over}px`);
    check(`${name}: no script errors`, !errors.length, errors.join('; '));
    await page.close();
  }
  await browser.close(); srv.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} landing checks passed`);
  process.exit(failed ? 1 : 0);
})();
