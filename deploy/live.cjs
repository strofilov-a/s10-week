// What s10.run serves now, against release/ and deploy/live.json. Read-only: three plain GETs of public addresses.
//   npm run live
// When the site serves exactly release/ (the developer has put it up), deploy/live.json is updated to it and the release
// rebuilt, so the next brief lists only what changes after it. Commit both.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { FILES, hash, releaseId } = require('./files.cjs');
const ROOT = path.resolve(__dirname, '..'), REL = path.join(ROOT, 'release'), LIVE = path.join(ROOT, 'deploy', 'live.json');

(async () => {
  const live = JSON.parse(fs.readFileSync(LIVE, 'utf8'));
  const site = {}, built = {};
  for (const f of FILES) {
    const r = await fetch('https://s10.run' + f.url, { headers: { 'cache-control': 'no-cache' } });
    site[f.file] = r.ok ? hash(Buffer.from(await r.arrayBuffer())) : `HTTP ${r.status}`;
    built[f.file] = hash(fs.readFileSync(path.join(REL, f.file)));
  }
  for (const f of FILES) {
    const s = site[f.file];
    console.log(`${f.url.padEnd(18)} ${s === built[f.file] ? 'as release/' : s === live.files[f.file] ? `as recorded (${live.release}), not release/` : `unknown (${s})`}`);
  }
  if (FILES.every((f) => site[f.file] === built[f.file])) {
    const rel = releaseId(built);
    if (rel === live.release) return console.log(`s10.run serves release ${rel}, as recorded in deploy/live.json`);
    fs.writeFileSync(LIVE, JSON.stringify({ release: rel, checked: new Date().toISOString().slice(0, 10), files: built }, null, 2) + '\n');
    execFileSync(process.execPath, [path.join(__dirname, 'build.cjs')], { stdio: 'inherit' });
    return console.log(`s10.run serves release ${rel}: deploy/live.json updated, release/ rebuilt. Commit both.`);
  }
  console.log(`s10.run does not serve release/ yet; deploy/live.json left as is (${live.release})`);
  process.exitCode = 1;
})().catch((e) => { console.error('live: ' + e.message); process.exit(1); });
