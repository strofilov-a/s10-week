/* The S10 Solo promo page's script: the inline script of landing-v2/index.html ported to a module. The algorithms,
   numbers and texts are the same; what changed is only where things live: the page's root instead of document and
   <html>, GSAP/Lenis/the stage as imports, and every listener, observer, timer and tween is recorded so the cleanup
   returned by mountSoloStart() removes all of them (a second mount starts clean). */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStage, SceneMaker } from './stage';

type El = HTMLElement;

export function mountSoloStart(page: El): () => void {
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

  // the standalone page marks <html class="js"> in its <head>; here the root carries it (start.css: .s10-solo-start.js …)
  page.classList.add('js');
  // html { scroll-behavior: smooth } of the standalone page (auto with reduced motion, and while Lenis runs)
  const html = document.documentElement, htmlScroll = html.style.scrollBehavior;
  if (!reduced) html.style.scrollBehavior = 'smooth';
  const stage = createStage(page);
  const gctx = gsap.context(() => undefined, page);

  /* the plan: 12 weeks, 14 Sep – 6 Dec 2026; a steady build, an easier week every fourth, the taper */
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const VOL = [50, 54, 58, 54, 60, 64, 68, 62, 70, 72, 62, 40];
  const span = (w: number) => {
    const a = new Date(2026, 8, 14 + w * 7), b = new Date(2026, 8, 20 + w * 7);
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  };
  const weeksHtml = VOL.map((v, w) => `<div class="wk${w === 11 ? ' race' : ''}"><span>${span(w)}</span><i style="width:${Math.round(v / 80 * 100)}%"></i><span>${v} км</span></div>`).join('');
  $('#how-weeks').innerHTML = weeksHtml;
  $('#show-weeks').innerHTML = weeksHtml;

  /* the calendar */
  const grid = $('#cal-grid'), days: Array<{ el: El; run: boolean }> = [];
  grid.insertAdjacentHTML('beforeend', '<span></span>' + ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="wd">${d}</span>`).join('') + '<span class="wd">км</span>');
  let shownMonth = -1;
  for (let w = 0; w < 12; w++) {
    const m = new Date(2026, 8, 14 + w * 7).getMonth(), endM = new Date(2026, 8, 20 + w * 7).getMonth();
    const label = m !== shownMonth ? MONTHS[m] : endM !== shownMonth && endM !== m ? MONTHS[endM] : '';
    if (label) shownMonth = label === MONTHS[m] ? m : endM;
    grid.insertAdjacentHTML('beforeend', `<span class="mo">${label}</span>`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 8, 14 + w * 7 + i), race = w === 11 && i === 6;
      // Mon rest; Wed interval and Fri development (work), Sun long; race week: Tue easy, Wed short work, Thu–Sat rest
      const run = race || (w < 11 ? i !== 0 : i === 1 || i === 2);
      const work = run && (w < 11 ? i === 2 || i === 4 : i === 2), long = w < 11 && i === 6;
      const el = document.createElement('span');
      el.className = 'd' + (race ? ' race' : long ? ' long' : work ? ' work' : run ? ' run' : '');
      el.textContent = String(d.getDate());
      if (race) el.setAttribute('aria-label', '6 декабря, старт');
      grid.appendChild(el);
      days.push({ el, run: run && !race });
    }
    grid.insertAdjacentHTML('beforeend', `<span class="wk-km">${VOL[w]}</span>`);
  }
  const wkKm = $$('.wk-km', grid), runs = days.filter((d) => d.run);
  const kmEl = $('#cal-km'), wkEl = $('#cal-wk'), nEl = $('#cal-n');
  const showUpTo = (n: number) => {
    days.forEach((d, i) => d.el.classList.toggle('on', i < n && d.run));
    wkKm.forEach((el, w) => el.classList.toggle('on', n >= w * 7 + 7));
    const w = Math.min(11, Math.max(0, Math.ceil(n / 7) - 1));
    kmEl.textContent = VOL[w] + ' км';
    wkEl.textContent = 'объём недели, ' + span(w);
    nEl.textContent = String(runs.filter((d) => d.el.classList.contains('on')).length);
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
    let S = { x: 0, y: 0, d: 1 }, T = { x: 0, y: 0, d: 1 }, calTop = 1;
    // S: the orb's centre and size in the hero (page coordinates); T: the race circle's centre and size when the calendar is pinned (viewport)
    const measure = () => {
      orb.classList.remove('flying', 'gone'); orb.style.cssText = '';
      const r = orb.getBoundingClientRect();
      S = { x: r.left + r.width / 2, y: r.top + scrollY + r.height / 2, d: r.width };
      const sr = $('.cal-stage').getBoundingClientRect(), cr = raceCell.getBoundingClientRect(), cs = getComputedStyle(raceCell, '::before');
      T = { x: cr.left + cr.width / 2, y: cr.top - sr.top + parseFloat(cs.top), d: parseFloat(cs.width) };
      calTop = calSec.getBoundingClientRect().top + scrollY;
      orb.classList.add('flying');
      orb.style.left = (S.x - S.d / 2) + 'px'; orb.style.top = '0px';
    };
    const place = () => {
      const p = Math.min(1, Math.max(0, scrollY / calTop)), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const cx = S.x + (T.x - S.x) * e, cy = (S.y - scrollY) + (T.y - (S.y - scrollY)) * e, s = 1 - (1 - T.d / S.d) * e;
      orb.style.transform = `translate(${cx - S.x}px, ${cy - S.d / 2}px) scale(${s})`;
      const landed = p >= 1;
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
    'Открыли Solo — и сразу видно, что бежать сегодня, сколько осталось за неделю и сколько дней до старта.',
    'Рядом с заданием — факт: сколько пробежали, в каком темпе, быстрее или медленнее, чем нужно.',
    'Каждая тренировка написана в минутах на километр из ваших T5, T10, T21 и T42. Никаких «T21+8» в дневнике.',
    'Все недели до старта с объёмом: ровный рост, лёгкая неделя каждую четвёртую и подводка к гонке.',
  ];
  const DISC = ['--accent', '--light', '--mid', '--ink'];
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
  const CLAUSES = ['Сначала вы пишете цель', 'Потом Solo собирает план', 'Дальше вы ставите дни', 'И календарь заполнен'];
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

  /* paces from a goal: Riegel k = 1.06, easy runs from marathon pace (the same formulas as Solo itself) */
  const RANGE: { [d: string]: [number, number, number, number] } = { '42.195': [9000, 19800, 60, 12000], '21.0975': [4200, 9600, 30, 5700], '10': [1800, 4500, 15, 2580], '5': [900, 2400, 5, 1260] };
  const form = $<HTMLFormElement>('#pc-form'), tIn = $<HTMLInputElement>('#pc-t'), tOut = $('#pc-v'), main = $('#pc-main'), rest = $$('#pc-rest li');
  const dField = () => (form.elements.namedItem('d') as RadioNodeList | HTMLInputElement | null);
  const calc = () => {
    const D = +(dField() ? dField()!.value : 0), sec = +tIn.value;
    const at = (d: number) => sec * Math.pow(d / D, 1.06) / d, t42 = at(42.195);
    const L = Math.min(1, Math.max(0, (t42 - 285) / (410 - 285))), lo = t42 + 55 - 45 * L, hi = lo + 20 + 10 * L, r5 = (x: number) => Math.round(x / 5) * 5;
    tOut.textContent = hms(sec); tIn.setAttribute('aria-valuetext', hms(sec));
    main.textContent = fmt(at(D));
    const others = ([[5, '5 км'], [10, '10 км'], [21.0975, 'Полумарафон'], [42.195, 'Марафон']] as Array<[number, string]>).filter(([d]) => d !== D);
    others.forEach(([d, n], i) => { rest[i].innerHTML = `<span>${n}</span><b>${fmt(at(d))}</b>`; });
    rest[3].innerHTML = `<span>Лёгкий бег</span><b>${fmt(r5(lo))}–${fmt(r5(hi))}</b>`;
  };
  listen(form, 'change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name !== 'd') return;
    const [mn, mx, stp, def] = RANGE[t.value];
    tIn.min = String(mn); tIn.max = String(mx); tIn.step = String(stp); tIn.value = String(def);
    calc();
  });
  listen(tIn, 'input', calc);
  calc();

  /* entrances */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io!.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' }) : null;
  if (io) off.push(() => io.disconnect());
  $$('[data-rise]').forEach((el) => (io && !reduced ? io.observe(el) : el.classList.add('in')));

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
