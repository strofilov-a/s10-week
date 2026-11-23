// `node deploy/kazan-og.cjs`: draws landing-kazan/og.png, the 1200×630 link preview (og:image, twitter:image) of the
// Kazan promo page (owner's SEO brief, 23.11.2026). The page's own look: the blocks on top (Roboto, S10 blue #004AAD,
// coral #FF6259, the pencil drawing of Kazan from intro/img/), no photographs of people, not the marathon's logo.
// Rendered from HTML by Playwright with the fonts inlined (deploy/fonts.cjs), so nothing is fetched. Run it again when
// the date, the price or the plan's length changes.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { FONTS, ROBOTO } = require('./fonts.cjs');
const DIR = path.resolve(__dirname, '..', 'landing-kazan');
const hero = 'data:image/webp;base64,' + fs.readFileSync(path.join(DIR, 'intro', 'img', 'hero-1200.webp')).toString('base64');

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
${FONTS}
${ROBOTO}
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #fff; }
body { display: grid; grid-template-columns: 640px 560px; font-family: 'Golos Text', sans-serif; color: #212121; }
.text { padding: 64px 0 56px 72px; display: flex; flex-direction: column; }
.race { align-self: flex-start; display: flex; align-items: center; gap: 12px; font: 600 24px/1 'Golos Text'; color: #004AAD; }
.race i { width: 14px; height: 14px; border-radius: 50%; background: #FF6259; }
h1 { margin-top: 36px; font: 700 84px/0.98 Roboto; letter-spacing: -0.02em; }
.goals { margin-top: 40px; display: flex; gap: 12px; }
.goals span { font: 700 30px/1 Roboto; padding: 14px 20px; border-radius: 12px; background: #E9E9FF; color: #004AAD; font-variant-numeric: tabular-nums; }
.goals span.any { background: #fff; border: 2px solid #004AAD; font: 600 24px/1 'Golos Text'; display: flex; align-items: center; }
.who { margin-top: auto; display: flex; justify-content: space-between; align-items: baseline; padding-right: 48px; font: 500 24px/1.2 'Golos Text'; }
.who b { font: 700 26px/1 Roboto; color: #004AAD; }
.pic { position: relative; background: url(${hero}) 58% 50% / cover no-repeat; }
.pic::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 10px; background: #004AAD; }
.days { position: absolute; right: 40px; bottom: 40px; width: 150px; height: 150px; border-radius: 50%; background: #FF6259; color: #212121;
  display: grid; place-content: center; text-align: center; }
.days b { font: 700 64px/0.9 Roboto; }
.days span { font: 600 20px/1.1 'Golos Text'; }
</style></head><body>
<div class="text">
  <p class="race"><i></i>Казанский марафон · 2 мая 2027</p>
  <h1>План на&nbsp;24&nbsp;недели</h1>
  <div class="goals"><span>3:00</span><span>3:30</span><span>4:00</span><span class="any">или ваша цель</span></div>
  <p class="who">Юрий Строфилов · S10 Solo <b>2 000 ₽</b></p>
</div>
<div class="pic"><div class="days"><b>2</b><span>мая</span></div></div>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.route(/^https?:/, (r) => r.abort());
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const fit = await p.evaluate(() => [...document.querySelectorAll('h1, .goals, .who, .race')].every((e) => e.scrollWidth <= e.clientWidth + 1));
  if (!fit) { console.error('kazan-og: a line runs over'); process.exit(1); }
  await p.screenshot({ path: path.join(DIR, 'og.png'), type: 'png' });
  await b.close();
  console.log('kazan-og: landing-kazan/og.png 1200×630');
})();
