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
  // the tablet and the phone are touch screens (pointer: coarse), as people hold them: no Lenis, the orb rides with the page
  for (const [w, h, name, touch] of [[1440, 900, 'desktop', false], [768, 1024, 'tablet', true], [390, 844, 'phone', true]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
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

    // with a mouse the race circle flies into 6 December as the calendar pins; on touch nothing follows the scroll: the
    // circle stays in the hero and 6 December pops in on a timer as the calendar comes into view (owner, 09.11.2026)
    await page.evaluate(() => scrollTo(0, document.getElementById('plan').getBoundingClientRect().top + scrollY));
    await page.waitForTimeout(1200);
    const landed = await page.evaluate(() => {
      const orb = document.getElementById('orb'), cal = document.getElementById('plan'), cell = document.querySelector('.d.race');
      return { flying: orb.classList.contains('flying'), orbGone: orb.classList.contains('gone'), pop: cal.classList.contains('pop'), cellShown: getComputedStyle(cell).visibility === 'visible' };
    });
    check(`${name}: 6 December ${touch ? 'pops in, the circle stays in the hero' : 'gets the flying circle'}`, landed.cellShown && (touch ? !landed.flying && landed.pop : landed.orbGone), JSON.stringify(landed));
    if (!touch) { // the flight closes in on 6 December steadily
      const path = [];
      for (let i = 0; i <= 10; i++) {
        await page.evaluate((f) => scrollTo(0, document.getElementById('plan').offsetTop * f), i / 10);
        await page.waitForTimeout(120);
        path.push(await page.evaluate(() => { const o = document.getElementById('orb').getBoundingClientRect(), c = document.querySelector('.d.race').getBoundingClientRect(); return Math.hypot(o.left + o.width / 2 - (c.left + c.width / 2), o.top + o.height / 2 - (c.top + c.height / 2)); }));
      }
      check(`${name}: the circle closes in on 6 December steadily`, path.slice(0, -1).every((d, i) => path[i + 1] <= d + 2), path.map((d) => Math.round(d)).join(' '));
    } else if (w < 768) { // a phone: the whole circle on the first screen, the 6 in its middle
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
      const o = await page.evaluate(() => { const c = document.getElementById('orb').getBoundingClientRect(), d = document.querySelector('#orb span').getBoundingClientRect(); return { inside: c.left >= 0 && c.right <= innerWidth, dx: Math.round(Math.abs(c.left + c.width / 2 - (d.left + d.width / 2))) }; });
      check(`${name}: the whole circle on screen, the 6 in its middle`, o.inside && o.dx <= 2, JSON.stringify(o));
    }
    // the pinned calendar fits under the top bar and above the screen's bottom
    await page.evaluate(() => scrollTo(0, document.getElementById('plan').offsetTop + innerHeight)); await page.waitForTimeout(400);
    const fit = await page.evaluate(() => { const R = (s) => document.querySelector(s).getBoundingClientRect(); return { bar: Math.round(R('.rail').bottom), head: Math.round(R('.cal-text h2').top), key: Math.round(R('.cal-key').bottom), h: innerHeight }; });
    check(`${name}: the pinned calendar fits between the top bar and the bottom`, fit.head >= fit.bar && fit.key <= fit.h, JSON.stringify(fit));

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

    // a phone widens its layout viewport to fit anything past the edge, so innerWidth is checked against the screen too
    const over = await page.evaluate((w) => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, innerWidth - w), w);
    check(`${name}: nothing runs off the side`, over <= 0, `${over}px`);
    check(`${name}: no script errors`, !errors.length, errors.join('; '));
    await page.close();
  }
  await browser.close(); srv.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} landing checks passed`);
  process.exit(failed ? 1 : 0);
})();
