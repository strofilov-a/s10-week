// Builds the release for the S10 developer: one folder, no demo.
//   npm run build                    → release/  (t5/solo/solo.js for /t5/solo/, solo.html for /solo/plan, ЗАДАНИЕ.md)
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
fs.copyFileSync(path.join(ROOT, 'deploy', 'ЗАДАНИЕ.md'), path.join(OUT, 'ЗАДАНИЕ.md'));
const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log(`release ${stamp}\n  release/t5/solo/solo.js  ${kb('t5/solo/solo.js')} (source ${(Buffer.byteLength(src) / 1024).toFixed(0)} KB, ${opens} demo blocks cut)\n  release/solo.html\n  release/ЗАДАНИЕ.md`);
