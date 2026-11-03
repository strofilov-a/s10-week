// Builds the release for the S10 developer: one folder, no demo.
//   npm run build                    → release/  (t5/solo/solo.js for /t5/solo/, solo.html for /solo/plan,
//                                                 solo-start.html = the promo page for /solo/start, README.md = the brief)
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
fs.copyFileSync(path.join(ROOT, 'deploy', 'ЗАДАНИЕ.md'), path.join(OUT, 'README.md')); // a Latin name survives any zip tool

// the promo page (landing-v2) as one file for /solo/start: its stage and the scroll libraries inlined from node_modules,
// so it depends on no CDN (jsDelivr is not reliably reachable from Russia); only the fonts still come from Google
const inline = (f) => fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
const LIBS = {
  'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js': 'node_modules/gsap/dist/gsap.min.js',
  'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js',
  'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js': 'node_modules/lenis/dist/lenis.min.js',
  'scenes/stage.js': 'landing-v2/scenes/stage.js',
};
const landSrc = fs.readFileSync(path.join(ROOT, 'landing-v2', 'index.html'), 'utf8');
// checked on the source: the inlined libraries carry such tags in their own comments
if ((landSrc.match(/<link rel="stylesheet" href="(?!https:\/\/fonts\.googleapis)/g) || []).length !== 1) fail('landing: a stylesheet besides scenes/stage.css and the fonts');
const land = landSrc
  .replace('<link rel="stylesheet" href="scenes/stage.css">', () => `<style>\n${inline(path.join(ROOT, 'landing-v2', 'scenes', 'stage.css'))}</style>`)
  .replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    if (!LIBS[src]) fail(`landing: no local copy for ${src}`);
    return `<script>\n${inline(path.join(ROOT, LIBS[src])).replace(/\n\/\/# sourceMappingURL=.*$/m, '')}\n</script>`;
  });
fs.writeFileSync(path.join(OUT, 'solo-start.html'), land);

const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log(`release ${stamp}\n  release/t5/solo/solo.js  ${kb('t5/solo/solo.js')} (source ${(Buffer.byteLength(src) / 1024).toFixed(0)} KB, ${opens} demo blocks cut)\n  release/solo.html\n  release/solo-start.html  ${kb('solo-start.html')} (the promo page, scripts inlined)\n  release/README.md`);
