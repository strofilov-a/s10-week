// The Kazan blocks on top of landing-kazan (deploy/kazan-intro.cjs) made self-contained: their stylesheet
// (intro/intro.css, linked inside the shadow root's template) becomes a <style>, their pictures (intro/img/*.webp)
// data: URLs, one size each. Used by build.cjs (release/kazan-start.html) and react-src.cjs (react-src/kazan-start/markup.ts).
// A page without intro/ comes back as it was.
const fs = require('fs'), path = require('path');
function inlineIntro(html, dir) {
  if (!/href="intro\/intro\.css"/.test(html)) return html;
  const css = fs.readFileSync(path.join(dir, 'intro', 'intro.css'), 'utf8').replace(/<\/style/gi, '<\\/style');
  return html
    .replace('<link rel="stylesheet" href="intro/intro.css">', () => `<style>\n${css}</style>`)
    // one picture each (src: the hero at 1200, the portrait at 800): a srcset would put every size in the file
    .replace(/ srcset="[^"]*intro\/img\/[^"]*"/g, '').replace(/ sizes="[^"]*"(?=[^>]*data:image|[^>]*intro\/img)/g, '')
    .replace(/intro\/img\/([\w-]+\.webp)/g, (m, f) => `data:image/webp;base64,${fs.readFileSync(path.join(dir, 'intro', 'img', f)).toString('base64')}`);
}
module.exports = { inlineIntro };
