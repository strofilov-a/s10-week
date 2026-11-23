// Checks the release promo page (release/solo-start.html) the way s10.run would serve it at /solo/start, with every
// request outside this machine blocked (the fonts too): the scroll scenes must run from the inlined libraries alone,
// every action must lead to the login with the way back to /solo/plan, and the paces must follow the goal.
// `node tests/landing.cjs kazan`: the same for the Kazan promo page (release/kazan-start.html at /solo/kazan/start, back
// to /solo/kazan, the circle lands on 2 May, the goal picker instead of the paces slider).
// Run after `npm run build`.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const KZ = process.argv[2] === 'kazan';
const FILE = path.resolve(__dirname, '..', 'release', KZ ? 'kazan-start.html' : 'solo-start.html');
const ROUTE = KZ ? '/solo/kazan/start' : '/solo/start';
const LOGIN = 'https://s10.run/login?back=https%3A%2F%2Fs10.run%2Fsolo%2F' + (KZ ? 'kazan' : 'plan');
const RACE = KZ ? '2 May' : '6 December';

const results = []; const check = (n, ok, i = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? `  (${i})` : ''}`); };
const REACT = !!process.env.REACT; // the same checks on react-src/ as the developers' app would run it (tests/react)
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  if (REACT && p === '/app.js') { r.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); return r.end(fs.readFileSync(path.join(__dirname, 'react', 'dist', 'app.js'))); }
  if (REACT && p === ROUTE) { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end('<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0}</style></head><body><div id="app"></div><script src="/app.js"></script></body></html>'); }
  if (p !== ROUTE) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE));
});

(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}${ROUTE}`;
  const browser = await chromium.launch();
  // the tablet and the phone are touch screens (pointer: coarse), as people hold them: no Lenis, the orb rides with the page
  for (const [w, h, name, touch] of [[1440, 900, 'desktop', false], [768, 1024, 'tablet', true], [390, 844, 'phone', true]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(800);

    check(`${name}: the title`, KZ ? (await page.textContent('#h1')).trim() === 'Казанский марафон — план до старта' : (await page.textContent('h1')).trim() === 'S10 Solo — план до старта');
    if (KZ) { // the three Kazan blocks on top, in their shadow root: there, with their pictures, the page's one h1, the button to the login
      const kml = await page.evaluate(async (login) => {
        const r = document.getElementById('kml').shadowRoot; if (!r) return { root: false };
        const imgs = [...r.querySelectorAll('img')]; imgs.forEach((i) => { i.loading = 'eager'; }); await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
        return { root: true, blocks: [...r.querySelectorAll('section')].map((x) => x.id || x.className.split(' ')[0]).join(' '), h1: [...document.querySelectorAll('h1'), ...r.querySelectorAll('h1')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
          imgs: imgs.map((i) => i.naturalWidth), links: [...r.querySelectorAll('a')].filter((a) => !a.closest('#cases')).every((a) => a.href === login), /* the students' cards link their profiles and videos, checked below */ font: getComputedStyle(document.querySelector('h1')).fontFamily, h1doc: document.querySelectorAll('h1').length, h1in: (() => { const h = document.querySelector('h1'), q = h && h.getBoundingClientRect(), t = r.querySelector('.hero__text').getBoundingClientRect(); return !!q && q.height > 0 && q.top >= t.top && q.bottom <= t.bottom && h.assignedSlot && h.assignedSlot.name === 'h1'; })(), days: r.querySelector('[data-countdown]').textContent, price: r.querySelector('[data-price]').textContent,
          cases: [...r.querySelectorAll('#cases h3')].map((h) => h.textContent), note: (r.querySelector('#cases .section-head p') || {}).textContent, stub: /Имя Фамилия|Заглушка/.test(r.innerHTML) };
      }, LOGIN);
      check(`${name}: the students' block: the owner's three real students (23.11.2026), no «examples» note, no template left`, kml.cases && kml.cases.join(', ') === 'Михаил Хомич, Сергей Коченихин, Виталий Станкевич' && !kml.note && !kml.stub, `${kml.cases} | ${kml.note}`);
      { // owner, 23.11.2026: «Стало» counts down from the old time when the block comes into view, then the gain and the video link
        const cs = await page.evaluate(async () => {
          const r = document.getElementById('kml').shadowRoot, sec = r.getElementById('cases');
          sec.scrollIntoView({ block: 'start', behavior: 'instant' }); await new Promise((ok) => setTimeout(ok, 3400));
          const cards = [...sec.querySelectorAll('.case')];
          return { anim: sec.classList.contains('is-animated'), nums: cards.map((c) => c.querySelector('.case__num').textContent), done: cards.filter((c) => c.classList.contains('is-done')).length,
            seen: cards.every((c) => +getComputedStyle(c).opacity > 0.99 && +getComputedStyle(c.querySelector('.case__foot')).opacity > 0.99),
            photos: [...sec.querySelectorAll('.case__photo img')].map((i) => i.naturalWidth), out: [...sec.querySelectorAll('a')].every((a) => a.target === '_blank' && /noopener/.test(a.rel)),
            profiles: [...sec.querySelectorAll('.case__name a')].every((a) => /^https:\/\/s10\.run\/student\?\d+/.test(a.href)), videos: [...sec.querySelectorAll('.case__more')].every((a) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(a.href)) };
        });
        check(`${name}: the students' cards count down to 2:59, 2:57, 2:54, all done and shown; photos loaded; profiles and videos open in a new tab`, cs.anim && cs.nums.join(' ') === '2:59 2:57 2:54' && cs.done === 3 && cs.seen && cs.photos.length === 3 && cs.photos.every((w) => w > 0) && cs.out && cs.profiles && cs.videos, JSON.stringify(cs));
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(400);
      }
      check(`${name}: the Kazan blocks on top: hero, «Что входит», the curator, the students, their pictures and one h1, in the document, shown in their hero`, kml.root && kml.blocks === 'hero includes coach cases' && kml.h1.length === 1 && kml.h1[0] === 'План подготовки к Казанскому марафону 2027' && kml.h1doc === 1 && kml.h1in && kml.imgs.length === 5 && kml.imgs.every((w) => w > 0) && kml.links && /Roboto/.test(kml.font), JSON.stringify(kml));
      if (name === 'desktop' && !REACT) { // owner's SEO brief, 23.11.2026
        const raw = fs.readFileSync(FILE, 'utf8'), C = 'https://s10.run/solo/kazan/start';
        const meta = (k) => (raw.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1];
        const desc = meta('description') || '';
        check('SEO: without scripts the page has its h1, canonical, Open Graph, Twitter, icons, JSON-LD and the plan paragraph',
          /<h1 id="hero-h" slot="h1">План подготовки к\u00a0Казанскому марафону\u00a02027<\/h1>/.test(raw) && raw.includes(`<link rel="canonical" href="${C}">`)
          && meta('og:url') === C && meta('og:type') === 'website' && meta('og:locale') === 'ru_RU' && meta('og:site_name') === 'S10.run'
          && /^https:\/\/.+\/og\.png$/.test(meta('og:image') || '') && meta('og:image:width') === '1200' && meta('og:image:height') === '630' && !!meta('og:image:alt')
          && meta('twitter:card') === 'summary_large_image' && meta('twitter:image') === meta('og:image') && !!meta('twitter:title') && !!meta('twitter:description')
          && /rel="apple-touch-icon" sizes="180x180"/.test(raw) && /sizes="32x32"/.test(raw) && /application\/ld\+json/.test(raw) && /class="about-p"[^>]*>План рассчитан на 24/.test(raw),
          meta('og:image'));
        check('SEO: the description starts with the plan, is at most 155 characters, says 2 000 ₽ once and no 750 ₽ or free days', desc.startsWith('План подготовки к Казанскому марафону 2027') && desc.length <= 155 && /2 000 ₽ один раз/.test(desc) && !/750|9 €|бесплатн/.test(desc), `${desc.length}: ${desc}`);
        const ld = await page.evaluate(() => { try { return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch (e) { return { err: e.message }; } });
        const node = (t) => (ld['@graph'] || []).find((n) => n['@type'] === t) || {};
        const faqPage = await page.evaluate(() => [...document.querySelectorAll('#faq details')].map((d) => [d.querySelector('summary').textContent.trim(), d.querySelector('p').textContent.trim()]));
        const faqLd = (node('FAQPage').mainEntity || []).map((q) => [q.name, q.acceptedAnswer && q.acceptedAnswer.text]);
        check('SEO: JSON-LD parses: the page, its author, the plan at 2 000 ₽, the six questions word for word, no SportsEvent',
          !ld.err && node('WebPage').url === C && node('WebPage').inLanguage === 'ru' && node('Person').name === 'Юрий Строфилов'
          && node('Product').offers && node('Product').offers.price === '2000' && node('Product').offers.priceCurrency === 'RUB'
          && faqLd.length === 6 && JSON.stringify(faqLd) === JSON.stringify(faqPage) && !raw.includes('SportsEvent'), ld.err || JSON.stringify(faqLd).slice(0, 200));
        const rd = await page.evaluate(() => ({ grid: document.getElementById('cal-grid').getAttribute('aria-hidden'), sum: (document.getElementById('cal-sum') || {}).textContent || '', about: document.querySelector('.about-p').getBoundingClientRect().height }));
        check('SEO: the calendar grid is hidden from readers, one sentence says what it shows; the plan paragraph is on the page', rd.grid === 'true' && /^Календарь последних 12 недель/.test(rd.sum) && rd.about > 0, JSON.stringify(rd));
      }
      check(`${name}: their price is fixed, 2 000 ₽ (owner, 22.11.2026: no ladder)`, kml.price.replace(/\s/g, '') === '2000', kml.price);
      { // owner, 22.11.2026: the Kazan logo on top, no Premium / free price cards (they came from the Solo promo page), 2 000 ₽
        const top = await page.evaluate(() => { const i = document.querySelector('header.rail .mark img'); return { logo: !!i && i.naturalWidth > 0 && i.alt === 'S10 Казань', price: !!document.getElementById('price'), text: document.body.innerText }; });
        check(`${name}: the S10 Kazan logo in the top bar; no price cards, no 750 ₽, no 3 free days; «Сколько это стоит?» says 2 000 ₽`, top.logo && !top.price && !/750|9 €|3 дня бесплатно/.test(top.text) && /2 000 ₽ один раз/.test(await page.evaluate(() => document.getElementById('faq').textContent)), JSON.stringify({ ...top, text: (top.text.match(/.{0,40}(750|9 €|3 дня бесплатно).{0,40}/) || [''])[0] }));
      }
      check(`${name}: their countdown says what ours says`, kml.days === (await page.textContent('#days')).replace(/^ · до старта/, 'До старта'), `${kml.days} | ${await page.textContent('#days')}`);
      const over = await page.evaluate(async () => { const r = document.getElementById('kml').shadowRoot, ph = r.querySelector('#coach img'); ph.scrollIntoView({ block: 'center', behavior: 'instant' }); await new Promise((ok) => setTimeout(ok, 600)); const q = ph.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return hit && hit.id; });
      check(`${name}: nothing of ours covers the portrait`, over === 'kml', over);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(800);
    }
    if (KZ) { // days to go, by the Moscow date (the race is 2 May 2027)
      const left = Math.round((Date.UTC(2027, 4, 2) - Date.UTC(...new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10).split('-').map((v, i) => (i === 1 ? v - 1 : +v)))) / 864e5);
      const days = (await page.textContent('#days')).trim();
      check(`${name}: days to the race`, left > 0 ? new RegExp(`^· до старта ${left} (день|дня|дней)$`).test(days) : days === '', days);
      const cal = await page.evaluate(() => ({ days: document.querySelectorAll('#cal-grid .d').length, race: document.querySelector('#cal-grid .d.race').textContent, first: document.querySelector('#cal-grid .d').textContent, stages: document.querySelectorAll('#show-weeks .ph').length }));
      check(`${name}: the calendar is 8 Feb – 2 May, four stages`, cal.days === 84 && cal.race === '2' && cal.first === '8' && cal.stages === 4, JSON.stringify(cal));
    }
    check(`${name}: the scroll libraries run from the page itself`, REACT ? await page.evaluate((sel) => !!(window.__s10 && window.__s10.triggers() > 0 && document.querySelector(sel)), KZ ? '.s10-kazan-start.js' : '.s10-solo-start.js') : await page.evaluate(() => !!(window.gsap && window.ScrollTrigger && window.Stage && window.Stage.live)));
    const live = await page.evaluate(() => ['plan', 'how', 'feats'].map((id) => document.getElementById(id).classList.contains('is-live')));
    check(`${name}: the three scroll scenes are live`, live.every(Boolean), live.join(' '));
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a.btn, a.cta')].map((a) => a.href));
    check(`${name}: every action goes to the login and back to ${KZ ? '/solo/kazan' : '/solo/plan'}`, hrefs.length >= (KZ ? 4 : 5) && hrefs.every((x) => x === LOGIN), `${hrefs.length} actions`);

    // with a mouse the race circle flies into 6 December as the calendar pins; on touch nothing follows the scroll: the
    // circle stays in the hero and 6 December pops in on a timer as the calendar comes into view (owner, 09.11.2026)
    await page.evaluate(() => scrollTo(0, document.getElementById('plan').getBoundingClientRect().top + scrollY));
    await page.waitForTimeout(1200);
    const landed = await page.evaluate(() => {
      const orb = document.getElementById('orb'), cal = document.getElementById('plan'), cell = document.querySelector('.d.race');
      return { flying: orb.classList.contains('flying'), orbGone: orb.classList.contains('gone'), pop: cal.classList.contains('pop'), cellShown: getComputedStyle(cell).visibility === 'visible' };
    });
    check(`${name}: ${RACE} ${touch ? 'pops in, the circle stays in the hero' : 'gets the flying circle'}`, landed.cellShown && (touch ? !landed.flying && landed.pop : landed.orbGone), JSON.stringify(landed));
    if (!touch) { // the flight closes in on 6 December steadily
      const path = [];
      for (let i = 0; i <= 10; i++) {
        await page.evaluate((f) => scrollTo(0, document.getElementById('plan').offsetTop * f), i / 10);
        await page.waitForTimeout(120);
        path.push(await page.evaluate(() => { const o = document.getElementById('orb').getBoundingClientRect(), c = document.querySelector('.d.race').getBoundingClientRect(); return Math.hypot(o.left + o.width / 2 - (c.left + c.width / 2), o.top + o.height / 2 - (c.top + c.height / 2)); }));
      }
      check(`${name}: the circle closes in on ${RACE} steadily`, path.slice(0, -1).every((d, i) => path[i + 1] <= d + 2), path.map((d) => Math.round(d)).join(' '));
    } else if (w < 768) { // a phone: the whole circle on the first screen, the 6 in its middle
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
      const o = await page.evaluate(() => { const c = document.getElementById('orb').getBoundingClientRect(), d = document.querySelector('#orb span').getBoundingClientRect(); return { inside: c.left >= 0 && c.right <= innerWidth, dx: Math.round(Math.abs(c.left + c.width / 2 - (d.left + d.width / 2))) }; });
      check(`${name}: the whole circle on screen, the ${KZ ? 2 : 6} in its middle`, o.inside && o.dx <= 2, JSON.stringify(o));
    }
    // the pinned calendar fits under the top bar and above the screen's bottom
    await page.evaluate(() => scrollTo(0, document.getElementById('plan').offsetTop + innerHeight)); await page.waitForTimeout(400);
    const fit = await page.evaluate(() => { const R = (s) => document.querySelector(s).getBoundingClientRect(); return { bar: Math.round(R('.rail').bottom), head: Math.round(R('.cal-text h2').top), key: Math.round(R('.cal-key').bottom), h: innerHeight }; });
    check(`${name}: the pinned calendar fits between the top bar and the bottom`, fit.head >= fit.bar && fit.key <= fit.h, JSON.stringify(fit));

    if (KZ && w < 768) { // «Как это работает» on a phone: each stage's heading stays clear of the stage bar (its buttons a finger tall)
      const gaps = [];
      for (const f of [0.1, 0.4, 0.6, 0.9]) {
        await page.evaluate((f) => { const r = document.getElementById('how'); scrollTo({ top: r.getBoundingClientRect().top + scrollY + (r.offsetHeight - innerHeight) * f, behavior: 'instant' }); }, f); await page.waitForTimeout(600);
        gaps.push(await page.evaluate(() => Math.round(document.querySelector('.how-bar').getBoundingClientRect().top - document.getElementById('how-h').getBoundingClientRect().bottom)));
      }
      const tall = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.how-names button')].map((b) => b.getBoundingClientRect().height)));
      check(`${name}: «Как это работает»: every heading clear of the stage bar, its buttons 44px`, gaps.every((g) => g >= 0) && tall >= 44, `gaps ${gaps.join(' ')}, buttons ${tall}px`);
    }

    // the features scene steps through all six
    const steps = [];
    for (const f of [0.05, 0.5, 0.95]) {
      await page.evaluate((f) => { const r = document.getElementById('feats'); scrollTo(0, r.getBoundingClientRect().top + scrollY + (r.offsetHeight - innerHeight) * f); }, f);
      await page.waitForTimeout(700);
      steps.push(await page.textContent('#feat-count'));
    }
    check(`${name}: «Что умеет Solo» steps from the first feature to the sixth`, steps[0] === '1 из 6' && steps[2] === '6 из 6', steps.join(' → '));

    if (KZ) { // the goal picker: 3:30 by default; 3:00 gives 4:16, the 32 km long run and a 1:26 half; 4:00 gives 5:41
      const read = () => page.evaluate(() => [document.getElementById('pc-main').textContent, document.getElementById('g-half').textContent, ...[...document.querySelectorAll('#pc-rest b')].map((b) => b.textContent)].join(' '));
      const g0 = await read();
      await page.check('input[name="g"][value="10800"]', { force: true }); const g1 = await read();
      await page.check('input[name="g"][value="14400"]', { force: true }); const g2 = await read();
      check(`${name}: the goal sets the paces, the long run and the half`, g0 === '4:59 1:41 4:34 4:46 5:50–6:10 27 км' && g1 === '4:16 1:26 3:55 4:06 5:10–5:30 32 км' && g2 === '5:41 1:55 5:13 5:27 6:15–6:40 22 км', `${g0} | ${g1} | ${g2}`);
    } else { // paces follow the goal: 3:20 marathon gives 4:44, a 1:30 half its own pace
      const p0 = await page.textContent('#pc-main');
      await page.check('input[name="d"][value="21.0975"]', { force: true });
      await page.evaluate(() => { const r = document.getElementById('pc-t'); r.value = 5400; r.dispatchEvent(new Event('input', { bubbles: true })); });
      const p1 = await page.textContent('#pc-main');
      check(`${name}: paces follow the goal`, p0 === '4:44' && p1 === '4:16', `${p0}, then ${p1}`);
    }

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
    if (REACT) { // unmount and mount again: no triggers, observers or classes left, and no doubles after a second mount
      const n1 = await page.evaluate(() => window.__s10.triggers());
      await page.evaluate(() => window.__s10.unmount()); await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ t: window.__s10.triggers(), root: !!document.querySelector('.s10-solo-start, .s10-kazan-start'), sb: document.documentElement.style.scrollBehavior, ob: document.body.style.overscrollBehavior }));
      await page.evaluate(() => { scrollTo(0, 400); dispatchEvent(new Event('resize')); }); await page.waitForTimeout(400);
      check(`${name}: react: unmount removes every ScrollTrigger, Lenis marks and the page`, after.t === 0 && !after.root && !after.sb && !after.ob && !errors.length, JSON.stringify(after) + errors.join('; '));
      await page.evaluate(() => { scrollTo(0, 0); window.__s10.mount(); }); await page.waitForTimeout(1000);
      const again = await page.evaluate(() => ({ t: window.__s10.triggers(), live: ['plan', 'how', 'feats'].every((id) => document.getElementById(id).classList.contains('is-live')), weeks: document.querySelectorAll('#how-weeks .wk, #how-weeks .ph').length, days: document.querySelectorAll('#cal-grid .d').length }));
      check(`${name}: react: mounted again: the same triggers, scenes live, the calendar once`, again.t === n1 && again.live && again.weeks === (KZ ? 4 : 12) && again.days === 84 && !errors.length, JSON.stringify(again) + ` first ${n1}`);
    }
    await page.close();
  }
  if (KZ) { // reduced motion: the students' block stands as written at once, no count-down
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(600);
    const rm = await page.evaluate(() => { const sec = document.getElementById('kml').shadowRoot.getElementById('cases'); return { anim: sec.classList.contains('is-animated'), nums: [...sec.querySelectorAll('.case__num')].map((n) => n.textContent).join(' '), seen: [...sec.querySelectorAll('.case, .case__delta, .case__foot')].every((e) => +getComputedStyle(e).opacity > 0.99) }; });
    check('reduced motion: the students\' block is whole at once (2:59, 2:57, 2:54, gains and video links shown)', !rm.anim && rm.nums === '2:59 2:57 2:54' && rm.seen, JSON.stringify(rm));
    await page.close();
  }
  await browser.close(); srv.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} ${KZ ? 'Kazan ' : ''}landing checks passed`);
  process.exit(failed ? 1 : 0);
})();
