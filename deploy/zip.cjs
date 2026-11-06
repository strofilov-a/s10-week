// The archive for the S10 developer: release/ as one zip named by its release id, the brief inside lists what to replace.
//   npm run zip        (runs every check and the build first, see package.json)
// Refuses when every file is already on s10.run (deploy/live.json): there would be nothing to put up.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { FILES, hash, releaseId } = require('./files.cjs');
const ROOT = path.resolve(__dirname, '..'), REL = path.join(ROOT, 'release'), OUT = path.join(ROOT, 'dist');

const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'deploy', 'live.json'), 'utf8'));
const hashes = Object.fromEntries(FILES.map((f) => [f.file, hash(fs.readFileSync(path.join(REL, f.file)))]));
const changed = FILES.filter((f) => hashes[f.file] !== live.files[f.file]).map((f) => f.file);
if (!changed.length) { console.error(`zip: release/ is what s10.run already serves (${live.release}), nothing to send`); process.exit(1); }

const name = `solo_release_${releaseId(hashes)}.zip`, zip = path.join(OUT, name);
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(zip, { force: true });
// the same layout as every archive before: the files at the top, solo.js under t5/solo/; -X leaves out Mac extras
execFileSync('zip', ['-X', '-r', zip, 'README.md', 'solo.html', 'solo-start.html', 't5'], { cwd: REL, stdio: 'ignore' });
console.log(`dist/${name}\n  changed: ${changed.join(', ')}\n  after the developer puts it up: npm run live, then commit deploy/live.json and release/`);
