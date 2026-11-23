// Copies the first four blocks of the owner's Kazan landing (github.com/Stro-812/kazan-marathon-landing: the hero with
// the drawing of Kazan, «Что входит в план подготовки», the curator «Личный рекорд на марафоне — 2:36 в 59 лет», and
// «Результаты учеников», its names and results made up as the owner asked, marked as examples) to the
// top of landing-kazan/ as they are (owner, 20.11.2026: «вытащить и залепить сверху буквально, за ними то, что мы
// оформили»).
//   node deploy/kazan-intro.cjs <that repo's dist/ after `npm run build`>
// Writes landing-kazan/intro/intro.css (their stylesheets, the ones their page links, in its order), intro/img/ (the
// two hero and two portrait sizes) and the markup between <!--kml--> and <!--/kml--> in landing-kazan/index.html. The
// blocks live in a shadow root (a declarative <template shadowrootmode>), so their CSS and ours never meet: their
// html/:root/body/main rules are mapped onto wrapper elements (.kml-root, .kml-body, .kml-main). Their scripts are not
// taken: without them the blocks show their final, static state (checked against their page, 20.11.2026). Changes to
// what they say: every button goes to the login with the way back to /solo/kazan. The hero's price («План сейчас стоит
// 2 000 ₽») stays (owner, 20.11.2026: «вернуть»): their price ladder goes to the host as data-ladder, and our script
// sets the price of the Moscow day, as their page does.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'landing-kazan');
const fail = (m) => { console.error('kazan-intro: ' + m); process.exit(1); };
const DIST = process.argv[2] ? path.resolve(process.argv[2]) : fail('usage: node deploy/kazan-intro.cjs <kazan-marathon-landing/dist>');
const LOGIN = 'https://s10.run/login?back=https%3A%2F%2Fs10.run%2Fsolo%2Fkazan';
const page = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

// ---- the three blocks
const sections = [...page.matchAll(/<section\b[\s\S]*?<\/section>/g)].map((m) => m[0]);
const pick = (re, name) => sections.find((s) => re.test(s.slice(0, 200))) || fail(`no ${name} block`);
const hero = pick(/class="hero hero--photo"/, 'hero'), includes = pick(/id="includes"/, 'includes'), coach = pick(/id="coach"/, 'coach');
if (!/hero__lead/.test(hero) || !/Что входит/.test(includes) || !/Личный рекорд/.test(coach)) fail('the blocks are not what they were');
// «Результаты учеников на марафонах»: their cards were a template; since 23.11.2026 the block is the owner's own with
// three real students (s10-student-results.zip): its markup is landing-kazan/intro/cases.html (photos in
// intro/students/, styles in intro/cases.css, the count-down in the page's script), taken as it is instead of theirs
const cases = fs.readFileSync(path.join(OUT, 'intro', 'cases.html'), 'utf8').trim();
if (!/^<section class="section" id="cases"/.test(cases) || /PHOTO_DIR/.test(cases)) fail('intro/cases.html is not the students block');
pick(/id="cases"/, 'cases'); // theirs is still there: the page keeps its place in the order
const IMG = {};
let html = [hero, includes, coach, cases].join('\n')
  .replace(/href="[^"]*"(?=[^>]*data-goal="buy_click")/g, `href="${LOGIN}"`)
  .replace(/\/img\/((?:hero|strofilov)-\d+\.webp)/g, (m, f) => { IMG[f] = true; return 'intro/img/' + f; })
  .replace(/ srcset="([^"]*)"/g, (m, s) => ` srcset="${s.split(/,\s*/).filter((x) => /(hero-(800|1200)|strofilov-(480|800))\.webp/.test(x)).join(', ')}"`)
  .replace(/ src="intro\/img\/hero-\d+\.webp"/, ' src="intro/img/hero-1200.webp"');
if (/s10\.run\/\.\.\./.test(html)) fail('a placeholder link left in the blocks');
if (!/data-price/.test(html)) fail('no price in the hero');
// The page's one h1 (owner's SEO brief, 23.11.2026): a shadow root's h1 is not in the document, so the hero gets a
// <slot name="h1"> in its place and H1 below goes into the host, where the hero shows it; the date moves to the lead
const H1 = 'План подготовки к\u00a0Казанскому марафону\u00a02027';
if (!/<h1[^>]*>[\s\S]*?<\/h1>/.test(hero)) fail('no h1 in the hero');
html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '<slot name="h1"></slot>')
  .replace(/(<section class="hero[^"]*"[^>]*?) aria-labelledby="[^"]*"/, `$1 aria-label="${H1.replace(/\u00a0/g, ' ')}"`)
  .replace(/(<p class="hero__lead">)/, '$1Старт 2 мая\u00a02027. ');
// their price ladder, from the config their own script carries ({from, price}: from that Monday, Moscow time)
const C = JSON.parse((page.match(/const C = (\{[\s\S]*?\});/) || [])[1] || fail('no price ladder in their page'));
if (!Array.isArray(C.ladder) || !C.ladder.length || C.ladder.some((x) => !/^\d{4}-\d\d-\d\d$/.test(x.from) || !(x.price > 0))) fail('the price ladder is not {from, price}');
// ---- the stylesheets, in the page's order, the head's inline <style> where it stands
const head = page.slice(0, page.indexOf('</head>'));
let css = '';
for (const m of head.matchAll(/<link rel="stylesheet" href="([^"]+)">|<style>([\s\S]*?)<\/style>/g)) {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ''); // their comments out: a selector is read as written
  if (m[1]) { if (/^https?:/.test(m[1])) continue; css += '\n' + strip(fs.readFileSync(path.join(DIST, m[1]), 'utf8')); }
  else css += '\n' + strip(m[2]);
}
// their document-level selectors onto the wrappers inside the shadow root
const TYPE = { html: '.kml-root', ':root': '.kml-root', body: '.kml-body', main: '.kml-main' };
const mapSel = (sel) => sel.replace(/(^|[\s>+~(,])(html|:root|body|main)(?![\w-])/g, (all, pre, t) => pre + TYPE[t]);
// only the rules that can match something in the three blocks: a selector needs every class and id it names (outside
// :not()) to be in their markup; one with :is(), :where() or :has() is kept as it is. Rules for the classes their
// scripts add (m-enter, mo-js…) go with the rest: the blocks are shown static
const CLASSES = new Set(['kml-root', 'kml-body', 'kml-main', ...[...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))]);
const IDS = new Set([...html.matchAll(/id="([^"]*)"/g)].map((m) => m[1]));
const topSplit = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const mayMatch = (sel) => topSplit(sel).some((one) => {
  const s = one.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '');
  if (/:(is|where|has)\(/.test(s)) return true;
  return [...s.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].every((m) => CLASSES.has(m[1])) && [...s.matchAll(/#([A-Za-z][\w-]*)/g)].every((m) => IDS.has(m[1]));
});
let i = 0, kept = 0, dropped = 0;
function block(stop) {
  let out = '';
  while (i < css.length) {
    if (css[i] === '}') { if (stop) { i++; return out + '}'; } fail('stray }'); }
    let j = i; while (j < css.length && css[j] !== '{' && css[j] !== '}') j++;
    if (css[j] !== '{') { out += css.slice(i, j); i = j; if (j >= css.length) break; continue; }
    const pre = css.slice(i, j), sel = pre.trim(), lead = pre.match(/^\s*/)[0];
    i = j + 1;
    if (/^@(-webkit-)?keyframes/.test(sel)) { let d = 1, k = i; while (d) { if (css[k] === '{') d++; if (css[k] === '}') d--; k++; } out += lead + sel + ' {' + css.slice(i, k); i = k; continue; }
    if (sel.startsWith('@')) { const inner = block(true); if (/\{/.test(inner)) out += lead + sel + ' {' + inner; continue; } // an empty @media goes
    if (/^@font-face/.test(sel)) fail('@font-face in their css');
    let d = 1, k = i; while (d) { if (css[k] === '{') d++; if (css[k] === '}') d--; k++; } // a rule's body, nested rules and all
    const mapped = sel.split(',').map(mapSel).join(',');
    if (mayMatch(mapped)) { out += lead + mapped + ' {' + css.slice(i, k); kept++; } else dropped++;
    i = k;
  }
  return out;
}
const scoped = `/* The first three blocks of github.com/Stro-812/kazan-marathon-landing, their own CSS. GENERATED by
   deploy/kazan-intro.cjs: html, :root, body and main map to .kml-root, .kml-body, .kml-main inside the shadow root. */
:host { all: initial; display: block; }
${block(false).replace(/\n{3,}/g, '\n\n').trim()}\n`;

const links = [...html.replace(cases, '').matchAll(/href="([^"]+)"/g)].map((m) => m[1]); // the students' cards link their profiles and videos
if (!links.length || links.some((h) => h !== LOGIN)) fail('a link that is not the login: ' + links.join(' '));
const imgs = [...html.matchAll(/intro\/img\/([\w-]+\.webp)/g)].map((m) => m[1]);
fs.mkdirSync(path.join(OUT, 'intro', 'img'), { recursive: true });
for (const f of new Set(imgs)) fs.copyFileSync(path.join(DIST, 'img', f), path.join(OUT, 'intro', 'img', f));
fs.writeFileSync(path.join(OUT, 'intro', 'intro.css'), scoped);

const ROOTATTR = (page.match(/<html lang="ru"([^>]*)>/) || [])[1] || fail('no <html> attributes');
const block3 = `<!--kml-->
<div class="kml" id="kml" data-ladder='${JSON.stringify(C.ladder.map((x) => [x.from, x.price]))}'><template shadowrootmode="open"><link rel="stylesheet" href="intro/intro.css"><link rel="stylesheet" href="intro/cases.css"><div class="kml-root"${ROOTATTR}><div class="kml-body"><div class="kml-main">
${html}
</div></div></div></template><h1 id="hero-h" slot="h1">${H1}</h1></div>
<!--/kml-->`;
const idx = path.join(OUT, 'index.html'), src = fs.readFileSync(idx, 'utf8');
if (!/<!--kml-->[\s\S]*?<!--\/kml-->/.test(src)) fail('landing-kazan/index.html: no <!--kml--> … <!--/kml--> place');
fs.writeFileSync(idx, src.replace(/<!--kml-->[\s\S]*?<!--\/kml-->/, () => block3));
console.log(`kazan-intro: 4 blocks (${(html.length / 1024).toFixed(0)} KB), intro.css ${(scoped.length / 1024).toFixed(0)} KB (${kept} rules kept, ${dropped} for other blocks left out), images ${[...new Set(imgs)].join(', ')}`);
