// Jost and Golos Text (the promo page's fonts), Cyrillic and Latin, from @fontsource as @font-face rules with data: URLs.
// Shared by build.cjs (inlined into release/solo-start.html) and react-src.cjs (react-src/solo-start/fonts.css).
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FONT_DIR = 'node_modules/@fontsource-variable';
const CY = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LA = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const FONTS = [['Jost', 'jost/files/jost', '600 700'], ['Golos Text', 'golos-text/files/golos-text', '400 600']].flatMap(([family, file, weight]) =>
  [['cyrillic', CY], ['latin', LA]].map(([sub, range]) => {
    const b64 = fs.readFileSync(path.join(ROOT, FONT_DIR, `${file}-${sub}-wght-normal.woff2`)).toString('base64');
    return `@font-face { font-family: '${family}'; font-style: normal; font-display: swap; font-weight: ${weight}; src: url(data:font/woff2;base64,${b64}) format('woff2'); unicode-range: ${range}; }`;
  })).join('\n');
module.exports = { FONTS };
