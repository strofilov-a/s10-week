// The files the S10 developer puts on the server, where each one is served, and how a release is identified.
// Used by build.cjs (which files changed against the live site) and live.cjs (what s10.run serves now).
const crypto = require('crypto');

const FILES = [
  { file: 't5/solo/solo.js', url: '/t5/solo/solo.js' },
  { file: 'solo.html', url: '/solo/plan' },
  { file: 'solo-start.html', url: '/solo/start' },
];
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
// one id for the three files together: the zip's name and the title of its README
const releaseId = (hashes) => crypto.createHash('sha256').update(FILES.map((f) => `${f.file}:${hashes[f.file]}`).join('\n')).digest('hex').slice(0, 10);

module.exports = { FILES, hash, releaseId };
