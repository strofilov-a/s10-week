// Builds the release for the S10 developer: one folder, no demo.
//   npm run build                    → release/  (t5/solo/solo.js for /t5/solo/, solo.html for /solo/plan,
//                                                 solo-start.html = the promo page for /solo/start,
//                                                 kazan-start.html = the Kazan promo page for /solo/kazan/start, pay/ = the Premium
//                                                 payment page for /pay/, README.md = the brief)
// Cuts every /*<demo>*/ … /*</demo>*/ out of solo.js (the demo mode, its fixtures and texts), then checks that nothing
// of the demo is left and that the result still parses. Exit code 1 if a check fails.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'release');
const fail = (m) => { console.error('build: ' + m); process.exit(1); };

const src = fs.readFileSync(path.join(ROOT, 'solo.js'), 'utf8');
const opens = (src.match(/\/\*<demo>\*\//g) || []).length, closes = (src.match(/\/\*<\/demo>\*\//g) || []).length;
if (!opens || opens !== closes) fail(`demo markers do not pair: ${opens} open, ${closes} close`);
let js = src.replace(/\/\*<demo>\*\/[\s\S]*?\/\*<\/demo>\*\//g, '').replace(/^[ \t]+\n/gm, ''); // a whole-line block leaves an empty line
const left = js.match(/.*\b(LIVE|FX|S10_FIXTURES|S10_FORCE_DEMO|demo\w*)\b.*|.*[Дд]емо.*/g);
if (left) fail('demo left in the release:\n' + left.slice(0, 10).join('\n'));

// the version mark is a hash of the code itself: the same source always builds the same release (CI compares them)
const stamp = require('crypto').createHash('sha256').update(js).digest('hex').slice(0, 10);
js = js.replace(/^\/\* S10 «Моя неделя»:/, `/* S10 «Моя неделя» · release ${stamp}:`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 't5', 'solo'), { recursive: true });
fs.writeFileSync(path.join(OUT, 't5', 'solo', 'solo.js'), js);
try { execFileSync(process.execPath, ['--check', path.join(OUT, 't5', 'solo', 'solo.js')]); } catch (e) { fail('release solo.js does not parse:\n' + e.stderr); }

const html = fs.readFileSync(path.join(ROOT, 'deploy', 'solo.html'), 'utf8').replace(/\/t5\/solo\/solo\.js\?v=[^"]*/, `/t5/solo/solo.js?v=${stamp}`);
if (!html.includes(`?v=${stamp}`)) fail('solo.html: no /t5/solo/solo.js?v= to stamp');
fs.writeFileSync(path.join(OUT, 'solo.html'), html);

// the promo page (landing-v2) as one file for /solo/start: its stage and the scroll libraries inlined from node_modules,
// so it depends on no CDN (jsDelivr is not reliably reachable from Russia); the fonts too (Google Fonts neither):
// Jost and Golos Text, Cyrillic and Latin, from @fontsource as data: URLs
const { FONTS, ROBOTO } = require('./fonts.cjs');
const { inlineIntro } = require('./kazan-intro-inline.cjs');
const inline = (f) => fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
const LIBS = {
  'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js': 'node_modules/gsap/dist/gsap.min.js',
  'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js',
  'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js': 'node_modules/lenis/dist/lenis.min.js',
};
// one promo page (dir/index.html) as one file: its stage (dir/scenes/, or landing-v2's that landing-kazan shares as
// ../landing-v2/scenes/), the libraries and the fonts inlined
function promo(dir, out, fonts = FONTS) {
  // the Kazan blocks on top (landing-kazan/intro/, a shadow root): their stylesheet and pictures inlined first
  const src = inlineIntro(fs.readFileSync(path.join(ROOT, dir, 'index.html'), 'utf8'), path.join(ROOT, dir)), at = (rel) => path.join(ROOT, dir, rel);
  const sheets = [...src.matchAll(/<link rel="stylesheet" href="(?!https:\/\/fonts\.googleapis)([^"]+)">/g)];
  // checked on the source: the inlined libraries carry such tags in their own comments
  if (sheets.length !== 1 || !/(^|\/)scenes\/stage\.css$/.test(sheets[0][1])) fail(`${dir}: a stylesheet besides scenes/stage.css and the fonts`);
  const GF = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Jost[^"]*" rel="stylesheet">/;
  if (!GF.test(src)) fail(`${dir}: the Google Fonts lines to replace are not there`);
  const html = src
    .replace(GF, () => `<style>\n${fonts}\n</style>`)
    .replace(sheets[0][0], () => `<style>\n${inline(at(sheets[0][1]))}</style>`)
    .replace(/<script src="([^"]+)"><\/script>/g, (m, s) => {
      const file = LIBS[s] ? path.join(ROOT, LIBS[s]) : /(^|\/)scenes\/stage\.js$/.test(s) ? at(s) : fail(`${dir}: no local copy for ${s}`);
      return `<script>\n${inline(file).replace(/\n\/\/# sourceMappingURL=.*$/m, '')}\n</script>`;
    });
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) fail(`${dir}: Google Fonts left in ${out}`);
  fs.writeFileSync(path.join(OUT, out), html);
}
promo('landing-v2', 'solo-start.html');
// the Kazan marathon promo page for /solo/kazan/start (owner, 20.11.2026)
promo('landing-kazan', 'kazan-start.html', FONTS + '\n' + ROBOTO);

// the Premium payment page for /pay/: the folder as it is (taste kit assets, fonts, icon, share picture), its script
// with the demo cut out, as solo.js
const PAY = path.join(ROOT, 'pay'), POUT = path.join(OUT, 'pay');
fs.cpSync(PAY, POUT, { recursive: true, filter: (f) => !/(^|\/)(\.DS_Store|\.taste-skill)(\/|$)/.test(f) });
const paySrc = fs.readFileSync(path.join(PAY, 'index.html'), 'utf8');
const po = (paySrc.match(/\/\*<demo>\*\//g) || []).length, pc = (paySrc.match(/\/\*<\/demo>\*\//g) || []).length;
if (!po || po !== pc) fail(`pay: demo markers do not pair: ${po} open, ${pc} close`);
const pay = paySrc.replace(/\/\*<demo>\*\/[\s\S]*?\/\*<\/demo>\*\//g, '').replace(/^[ \t]+\n/gm, '');
if (/loadDemo|[Дд]емо:/.test(pay)) fail('pay: demo left in the release');
if (/fonts\.(googleapis|gstatic)\.com/.test(pay)) fail('pay: Google Fonts in the release');
fs.writeFileSync(path.join(POUT, 'index.html'), pay);

// the brief opens with what to replace this time: each file against what s10.run serves (deploy/live.json, recorded
// by `npm run live` after the developer has put a release up)
const { FILES, hash, releaseId } = require('./files.cjs');
const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'deploy', 'live.json'), 'utf8'));
const hashes = Object.fromEntries(FILES.map((f) => [f.file, hash(fs.readFileSync(path.join(OUT, f.file)))]));
const changed = FILES.filter((f) => hashes[f.file] !== live.files?.[f.file]);
const rel = releaseId(hashes);
const table = changed.length
  ? `Заменить на сервере файлы из архива по адресам из таблицы:\n\n| Файл в архиве | Адрес на сайте | В этом релизе |\n|---|---|---|\n${FILES.map((f) => `| \`${f.file}\` | \`${f.url}\`${f.also ? ` и \`${f.also}\`` : ''} | ${changed.includes(f) ? '**изменился**' : 'без изменений'} |`).join('\n')}`
  : 'Все файлы такие же, как на сервере сейчас: выкладывать нечего.';
const brief = fs.readFileSync(path.join(ROOT, 'deploy', 'ЗАДАНИЕ.md'), 'utf8');
if (!brief.includes('{{release}}') || !brief.includes('{{files}}')) fail('deploy/ЗАДАНИЕ.md: no {{release}} or {{files}}');
fs.writeFileSync(path.join(OUT, 'README.md'), brief.replace('{{release}}', rel).replace('{{files}}', table)); // a Latin name survives any zip tool

const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
const mark = (f) => (changed.some((c) => c.file === f) ? 'changed' : 'as on s10.run');
console.log(`release ${rel} (solo.js ${stamp}; live on s10.run: ${live.release})\n  release/t5/solo/solo.js  ${kb('t5/solo/solo.js')} (source ${(Buffer.byteLength(src) / 1024).toFixed(0)} KB, ${opens} demo blocks cut), ${mark('t5/solo/solo.js')}\n  release/solo.html  ${mark('solo.html')}\n  release/solo-start.html  ${kb('solo-start.html')} (the promo page, scripts inlined), ${mark('solo-start.html')}\n  release/kazan-start.html  ${kb('kazan-start.html')} (the Kazan promo page), ${mark('kazan-start.html')}\n  release/pay/  the Premium payment page for /pay/ (${(fs.readdirSync(POUT, { recursive: true }).length)} files, demo cut)\n  release/README.md`);
