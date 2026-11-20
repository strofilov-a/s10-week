/* The Kazan marathon promo page's script (/solo/kazan/start): the inline script of landing-kazan/index.html ported to a
   module, as solo-start/start.ts is for /solo/start (and the stage is solo-start's). The algorithms, numbers and texts are
   the same as the page's; what changed is only where things live: the page's root instead of document and <html>,
   GSAP/Lenis/the stage as imports, and every listener, observer, timer and tween is recorded so the cleanup returned by
   mountKazanStart() removes all of them (a second mount starts clean). */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStage, SceneMaker } from '../solo-start/stage';

type El = HTMLElement;

export function mountKazanStart(page: El): () => void {
  const off: Array<() => void> = [];
  const timers: number[] = [];
  let alive = true;
  const listen = (t: EventTarget, type: string, fn: EventListenerOrEventListenerObject, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); off.push(() => t.removeEventListener(type, fn, o)); };
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); timers.push(id); return id; };

  const $ = <T extends Element = El>(s: string, r: ParentNode = page): T => r.querySelector(s) as T;
  const $$ = <T extends Element = El>(s: string, r: ParentNode = page): T[] => Array.prototype.slice.call(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches; // a finger scrolls: nothing may follow the scroll by script (see flight)
  const fmt = (s: number) => { const r = Math.round(s); return Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0'); };
  const hms = (s: number) => { const r = Math.round(s), h = Math.floor(r / 3600), m = Math.floor(r % 3600 / 60), x = r % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

  // the standalone page marks <html class="js"> in its <head>; here the root carries it (start.css: .s10-kazan-start.js …)
  page.classList.add('js');
  // html { scroll-behavior: smooth } of the standalone page (auto with reduced motion, and while Lenis runs)
  const html = document.documentElement, htmlScroll = html.style.scrollBehavior;
  if (!reduced) html.style.scrollBehavior = 'smooth';
  const stage = createStage(page);
  const gctx = gsap.context(() => undefined, page);

  /* the race: 2 May 2027 (engine.ts KAZAN.d, provisional); the plan's week −1 is 26 Apr – 2 May, week −n starts n−1 weeks
     before. Days to go by the Moscow date of the browser's clock, as the Kazan page counts them */
  const RACE = Date.UTC(2027, 4, 2);
  const plural = (n: number, a: string, b: string, c: string) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  const msk = new Date(Date.now() + 3 * 36e5), left = Math.round((RACE - Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate())) / 864e5);
  if (left > 0) $('#days').textContent = ` · до старта ${left} ${plural(left, 'день', 'дня', 'дней')}`;
  // the three Kazan blocks on top (deploy/kazan-intro.cjs) live in a shadow root, so their CSS and ours never meet. The
  // standalone page declares it in its markup (<template shadowrootmode>); markup set through innerHTML does not, so it
  // is attached here, once (a second mount gets a fresh host from React)
  const kml = $('#kml'), tpl = kml ? kml.querySelector('template') : null;
  if (kml && tpl && !kml.shadowRoot) { kml.attachShadow({ mode: 'open' }).appendChild(document.importNode((tpl as HTMLTemplateElement).content, true)); tpl.remove(); }
  const kmlDays = kml && kml.shadowRoot ? kml.shadowRoot.querySelector('[data-countdown]') : null;
  if (kmlDays) kmlDays.textContent = left > 0 ? `До старта ${left} ${plural(left, 'день', 'дня', 'дней')}` : left === 0 ? 'Старт сегодня' : 'Марафон прошёл';
  // its price, by their ladder (data-ladder: [from, price], from that Monday, Moscow time), as their own page sets it
  const kmlPrice = kml && kml.shadowRoot && kml.shadowRoot.querySelector('[data-price]');
  if (kmlPrice) { const day = msk.toISOString().slice(0, 10); let price = 0; try { (JSON.parse(kml.dataset.ladder || '[]') as Array<[string, number]>).forEach(([from, p]) => { if (!price || from <= day) price = p; }); } catch (e) { price = 0; } if (price) kmlPrice.textContent = price.toLocaleString('ru-RU').replace(/\s/g, '\u00a0'); }

  /* the plan's four stages (plans/kazan-2027.md: База −24…−18, ПАНО −17…−10, Race Specific −9…−4, Taper −3…−1) */
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const mon = (n: number, plus = 0) => new Date(2027, 3, 26 - (n - 1) * 7 + plus); // the Monday of plan week −n (+ days: by the calendar, so no clock change shifts a date)
  const dm = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const STAGES: Array<[string, number, number]> = [['База', 24, 18], ['Порог', 17, 10], ['Марафонская работа', 9, 4], ['Подводка', 3, 1]];
  $('#how-weeks').innerHTML = $('#show-weeks').innerHTML = STAGES.map(([name, a, b], k) => {
    const end = mon(b, 6), n = a - b + 1;
    return `<div class="ph${k === 3 ? ' race' : ''}"><b>${name}</b><span>${dm(mon(a))} – ${dm(end)} · ${n} ${plural(n, 'неделя', 'недели', 'недель')}</span><i style="width:${Math.round(n / 8 * 100)}%"></i></div>`;
  }).join('');

  /* the calendar: the plan's last 12 weeks, 8 Feb – 2 May 2027, with Solo's default days (works on Wednesday and Friday,
     the long run on Sunday); the race week holds one work and the race. The right column is that week's long run for
     3:30 (the plan's km × 0.85, as engine.ts's KAZAN.scale) */
  const LONG = [24, 21, 17, 24, 26, 26, 27, 22, 27, 20, 14, 0];
  const span = (w: number) => {
    const a = mon(12 - w), b = mon(12 - w, 6);
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${dm(a)} – ${dm(b)}`;
  };
  const grid = $('#cal-grid'), days: Array<{ el: El; run: boolean }> = [];
  grid.insertAdjacentHTML('beforeend', '<span></span>' + ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="wd">${d}</span>`).join('') + '<span class="wd">км</span>');
  let shownMonth = -1;
  for (let w = 0; w < 12; w++) {
    const a = mon(12 - w), m = a.getMonth(), endM = mon(12 - w, 6).getMonth();
    const label = m !== shownMonth ? MONTHS[m] : endM !== shownMonth && endM !== m ? MONTHS[endM] : '';
    if (label) shownMonth = label === MONTHS[m] ? m : endM;
    grid.insertAdjacentHTML('beforeend', `<span class="mo">${label}</span>`);
    for (let i = 0; i < 7; i++) {
      const d = mon(12 - w, i), race = w === 11 && i === 6;
      const work = w < 11 ? i === 2 || i === 4 : i === 2, long = w < 11 && i === 6;
      const el = document.createElement('span');
      el.className = 'd' + (race ? ' race' : long ? ' long' : work ? ' work' : '');
      el.textContent = String(d.getDate());
      if (race) el.setAttribute('aria-label', '2 мая, Казанский марафон');
      grid.appendChild(el);
      days.push({ el, run: work || long });
    }
    grid.insertAdjacentHTML('beforeend', `<span class="wk-km">${LONG[w] || '42'}</span>`);
  }
  const wkKm = $$('.wk-km', grid), runs = days.filter((d) => d.run);
  const kmEl = $('#cal-km'), wkEl = $('#cal-wk'), nEl = $('#cal-n');
  const showUpTo = (n: number) => {
    days.forEach((d, i) => d.el.classList.toggle('on', i < n && d.run));
    wkKm.forEach((el, w) => el.classList.toggle('on', n >= w * 7 + 7));
    const w = Math.min(10, Math.max(0, Math.ceil(n / 7) - 1)); // the race week has no long run: its figure stays on the week before
    kmEl.textContent = LONG[w] + ' км';
    wkEl.textContent = 'длительная, ' + span(w);
    const lit = runs.filter((d) => d.el.classList.contains('on')).length;
    nEl.textContent = String(lit);
    if (nEl.nextSibling) nEl.nextSibling.textContent = plural(lit, 'ключевая тренировка', 'ключевые тренировки', 'ключевых тренировок');
  };
  nEl.textContent = String(runs.length);

  const scenes: { [id: string]: SceneMaker } = {};
  scenes.calendar = (root, o) => stage.scene(root, {
    hold: o.hold != null ? o.hold : 3, beats: 4, scrub: stage.lenis ? true : 0.5,
    build(tl) {
      const st = { n: 0 };
      root.dataset.beat = '0';
      showUpTo(0);
      tl.to(st, { n: days.length, duration: 0.82, ease: 'none', onUpdate: () => showUpTo(Math.floor(st.n)) }, 0.1);
    },
    rest() { showUpTo(days.length); },
  });

  /* the orb: the hero's race circle shrinks and lands on 6 December as the calendar arrives (with a mouse) */
  const orb = $('#orb'), calSec = $('#plan'), raceCell = $('.d.race', grid);
  const flight = () => {
    if (reduced || !alive) return;
    // A touch screen scrolls the page on its own, ahead of any script, so whatever a script moves along with the scroll
    // shakes there however it is done (owner, 09.11.2026, twice). On touch nothing follows the scroll: the circle stays in
    // the hero and goes up with the page, and 6 December pops in by itself, on a timer, as the calendar comes into view.
    if (touch) {
      calSec.classList.add('waiting');
      const io = new IntersectionObserver((es) => { if (!es.some((e) => e.isIntersecting)) return; calSec.classList.remove('waiting'); calSec.classList.add('pop'); io.disconnect(); }, { threshold: 0.6 });
      io.observe(raceCell);
      off.push(() => io.disconnect());
      return;
    }
    let S = { x: 0, y: 0, d: 1 }, T = { x: 0, y: 0, d: 1 }, calTop = 1, heroTop = 0;
    // S: the orb's centre and size in the hero (page coordinates); T: the race circle's centre and size when the calendar is pinned (viewport)
    const measure = () => {
      orb.classList.remove('flying', 'gone'); orb.style.cssText = '';
      const r = orb.getBoundingClientRect();
      S = { x: r.left + r.width / 2, y: r.top + scrollY + r.height / 2, d: r.width };
      const sr = $('.cal-stage').getBoundingClientRect(), cr = raceCell.getBoundingClientRect(), cs = getComputedStyle(raceCell, '::before');
      T = { x: cr.left + cr.width / 2, y: cr.top - sr.top + parseFloat(cs.top), d: parseFloat(cs.width) };
      calTop = calSec.getBoundingClientRect().top + scrollY;
      heroTop = (orb.parentElement as El).getBoundingClientRect().top + scrollY - 64; // our hero under the top bar: the flight starts there
      orb.classList.add('flying');
      orb.style.left = (S.x - S.d / 2) + 'px'; orb.style.top = '0px';
    };
    const place = () => {
      const p = Math.min(1, Math.max(0, (scrollY - heroTop) / (calTop - heroTop))), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const cx = S.x + (T.x - S.x) * e, cy = (S.y - scrollY) + (T.y - (S.y - scrollY)) * e, s = 1 - (1 - T.d / S.d) * e;
      orb.style.transform = `translate(${cx - S.x}px, ${cy - S.d / 2}px) scale(${s})`;
      const landed = scrollY >= calTop - 1; // calTop can be fractional (the Kazan blocks above), scrollY is whole pixels
      orb.classList.toggle('gone', landed);
      calSec.classList.toggle('waiting', !landed);
    };
    measure(); place();
    listen(window, 'scroll', place, { passive: true });
    let rt = 0;
    listen(window, 'resize', () => { clearTimeout(rt); rt = later(() => { measure(); place(); }, 150); });
    const onRefresh = () => { measure(); place(); };
    ScrollTrigger.addEventListener('refresh', onRefresh);
    off.push(() => ScrollTrigger.removeEventListener('refresh', onRefresh));
  };

  /* showcase: the list picks the fragment and the disc's colour */
  const FACTS = [
    'Открыли Solo — и сразу видно, что бежать сегодня, какая это неделя плана и сколько дней до Казани.',
    'Каждое задание написано в минутах на километр, а рядом — что вы пробежали на самом деле.',
    'Темпа считаются от вашей цели: T5, T10, T21, T42 и лёгкий бег. Никаких «T21+8» в дневнике.',
    '24 недели в четыре этапа: база, порог, марафонская работа и подводка к старту.',
  ];
  const DISC = ['--f1', '--f2', '--f3', '--f4'];
  const disc = $('#show-disc'), frags = $$('.show-frag .ui'), picks = $$<HTMLButtonElement>('.show-list button'), fact = $('#show-fact');
  let item = 0;
  function showItem(k: number, force?: boolean) {
    if (k === item && !force) return;
    item = k;
    frags.forEach((f, i) => { f.hidden = i !== k; });
    picks.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
    fact.textContent = FACTS[k];
    disc.style.backgroundColor = getComputedStyle(page).getPropertyValue(DISC[k]).trim(); // the colours live on the root here
  }
  picks.forEach((b) => {
    listen(b, 'click', () => showItem(+(b.dataset.to || 0)));
    listen(b, 'mouseenter', () => { if (matchMedia('(hover: hover)').matches) showItem(+(b.dataset.to || 0)); });
    listen(b, 'focus', () => showItem(+(b.dataset.to || 0)));
  });
  showItem(0, true);

  /* how it works: the scroll moves the stages; the names jump to theirs */
  const CLAUSES = ['Сначала вы выбираете цель', 'План под вашу цель', 'Дальше вы ставите дни', 'И календарь заполнен'];
  const howRoot = $('#how'), hH = $('#how-h'), hfr = $$('.how-frag .ui'), names = $$<HTMLButtonElement>('.how-names button'), track = $('.how-track');
  let stageNo = 0;
  const setStage = (i: number, force?: boolean) => {
    if (i === stageNo && !force) return;
    stageNo = i;
    hH.style.opacity = '0';
    later(() => { hH.textContent = CLAUSES[i]; hH.style.opacity = '1'; }, reduced ? 0 : 200);
    hfr.forEach((f, k) => { f.hidden = k !== i; });
    names.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    if (!howRoot.classList.contains('is-live')) track.style.setProperty('--pos', ((i + 0.5) / 4 * 100) + '%');
  };
  const scrollToY = (y: number) => { if (stage.lenis) stage.lenis.scrollTo(y); else scrollTo({ top: y, behavior: 'smooth' }); };
  names.forEach((b) => listen(b, 'click', () => {
    const k = +(b.dataset.to || 0);
    if (!howRoot.classList.contains('is-live')) { setStage(k); return; }
    const top = howRoot.getBoundingClientRect().top + scrollY, run = howRoot.offsetHeight - innerHeight;
    scrollToY(top + run * (k + 0.5) / 4);
  }));
  scenes.how = (root, o) => stage.scene(root, {
    hold: o.hold != null ? o.hold : 3, scrub: stage.lenis ? true : 0.4,
    build(tl) {
      const st = { p: 0 };
      tl.to(st, { p: 1, duration: 1, ease: 'none', onUpdate: () => {
        track.style.setProperty('--pos', (st.p * 100) + '%');
        setStage(Math.min(3, Math.floor(st.p * 4)));
      } }, 0);
    },
    rest() { setStage(stageNo, true); },
  });

  /* features: the scroll steps through them; the dots jump to theirs */
  const featRoot = $('#feats'), feats = $$('.feat', featRoot), fdots = $$<HTMLButtonElement>('.feat-dots button'), fcount = $('#feat-count');
  let feat = -1;
  const setFeat = (k: number) => {
    if (k === feat) return;
    feat = k;
    feats.forEach((f, i) => f.classList.toggle('on', i === k));
    fdots.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
    fcount.textContent = (k + 1) + ' из ' + feats.length;
  };
  fdots.forEach((b, k) => listen(b, 'click', () => {
    const top = featRoot.getBoundingClientRect().top + scrollY, run = featRoot.offsetHeight - innerHeight;
    scrollToY(top + run * (k + 0.5) / feats.length);
  }));
  scenes.feats = (root, o) => stage.scene(root, {
    hold: o.hold != null ? o.hold : 5, scrub: stage.lenis ? true : 0.4,
    build(tl) {
      const st = { p: 0 };
      setFeat(0);
      tl.to(st, { p: 1, duration: 1, ease: 'none', onUpdate: () => setFeat(Math.min(feats.length - 1, Math.floor(st.p * feats.length))) }, 0);
    },
    rest() { feats.forEach((f) => f.classList.remove('on')); },
  });

  /* the goal picker: paces from the marathon goal by Riegel k = 1.06, easy runs from marathon pace (Solo's own formulas),
     the longest long run (the plan's 32 km × the goal's scale, engine.ts's KAZAN.scale), and the half marathon that goes
     with the goal (the same Riegel) */
  const SCALE: { [sec: string]: number } = { 10800: 1, 12600: 0.85, 14400: 0.7 };
  const form = $<HTMLFormElement>('#pc-form'), main = $('#pc-main'), rest = $$('#pc-rest li'), half = $('#g-half');
  const gField = () => (form.elements.namedItem('g') as RadioNodeList | HTMLInputElement | null);
  const calc = () => {
    const sec = +(gField() ? gField()!.value : 12600) || 12600;
    const at = (d: number) => sec * Math.pow(d / 42.195, 1.06) / d, t42 = at(42.195);
    const L = Math.min(1, Math.max(0, (t42 - 285) / (410 - 285))), lo = t42 + 55 - 45 * L, hi = lo + 20 + 10 * L, r5 = (x: number) => Math.round(x / 5) * 5;
    main.textContent = fmt(t42);
    rest[0].innerHTML = `<span>10 км</span><b>${fmt(at(10))}</b>`;
    rest[1].innerHTML = `<span>Полумарафон</span><b>${fmt(at(21.0975))}</b>`;
    rest[2].innerHTML = `<span>Лёгкий бег</span><b>${fmt(r5(lo))}–${fmt(r5(hi))}</b>`;
    rest[3].innerHTML = `<span>Длительная до</span><b>${Math.round(32 * SCALE[sec])} км</b>`;
    half.textContent = hms(Math.round(at(21.0975) * 21.0975 / 60) * 60).replace(/:00$/, '');
  };
  listen(form, 'change', calc);
  calc();

  /* entrances */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io!.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' }) : null;
  if (io) off.push(() => io.disconnect());
  $$('[data-rise]').forEach((el) => (io && !reduced ? io.observe(el) : el.classList.add('in')));
  // a part still waiting to rise shows at once when the keyboard reaches it (taste-skill focus-visible)
  listen(page, 'focusin', (e) => { const t = e.target as Element, r = t && t.closest ? t.closest('[data-rise]') : null; if (r) r.classList.add('in'); });

  /* the disc and its fragment settle as the section arrives */
  if (!reduced && !touch) { // the showcase and footer drift: not under a finger
    gctx.add(() => {
      gsap.fromTo('#show-disc', { scale: 0.6 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: page.querySelector('.show'), start: 'top bottom', end: 'top 20%', scrub: 0.4 } });
      gsap.fromTo('.show-frag', { yPercent: 18 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: page.querySelector('.show'), start: 'top bottom', end: 'top 20%', scrub: 0.4 } });
      gsap.fromTo('.foot-mark span', { yPercent: 40 }, { yPercent: 0, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: page.querySelector('.foot-mark'), start: 'top bottom', end: 'bottom bottom', scrub: 0.4 } });
    });
  }

  stage.smooth();
  stage.init(scenes);
  // stage.js refreshes the triggers on window «load»; in an app that has long fired, so once the fonts are in
  if (document.readyState === 'complete') stage.ready(); else listen(window, 'load', () => { stage.ready(); });
  if (document.fonts) document.fonts.ready.then(flight); else flight();

  return () => {
    alive = false;
    off.splice(0).forEach((f) => f());
    timers.splice(0).forEach((t) => clearTimeout(t));
    gctx.revert();
    stage.destroy();
    html.style.scrollBehavior = htmlScroll;
    page.classList.remove('js');
  };
}
