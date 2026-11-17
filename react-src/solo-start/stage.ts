/* The scroll stage of the S10 Solo promo page: landing-v2/scenes/stage.js (taste-skill «scenes») ported to a module.
   A scene is a tall section whose stage sticks to the viewport while the page scrolls past it, with a GSAP timeline
   scrubbed by that scroll. The page scrolls natively; Lenis only weights the mouse wheel (off for touch and reduced
   motion). Differences from stage.js: GSAP and Lenis are imports, not globals; the scenes are passed to init() instead
   of a global window.Scenes; the classes stage.js put on <html> go on the page's root; Stage.split (unused by the
   page) is left out; and destroy() undoes everything: the media contexts with their ScrollTriggers, Lenis, the ticker
   callback, the lag smoothing, the marks on <html>/<body>. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

export interface SceneCtx {
  root: HTMLElement;
  stage: Element | null;
  phone: boolean;
  q: (sel: string) => HTMLElement[];
}
export interface ScenePlan {
  hold?: number;
  build?: (tl: gsap.core.Timeline, ctx: SceneCtx) => void;
}
export interface SceneOpts extends ScenePlan {
  /** true = locked to the scrollbar; a number = seconds of catch-up */
  scrub?: boolean | number;
  /** 'same' (default) | 'rest' (the phone gets the finished composition) | its own plan */
  phone?: 'same' | 'rest' | ScenePlan;
  rest?: (ctx: SceneCtx) => void;
  beats?: number;
}
export type SceneMaker = (root: HTMLElement, options: { hold?: number }) => unknown;

export interface Stage {
  readonly reduced: boolean;
  readonly phone: boolean;
  readonly touch: boolean;
  lenis: Lenis | null;
  smooth(o?: { lerp?: number }): Lenis | null;
  scene(root: HTMLElement | null, opts?: SceneOpts): gsap.MatchMedia | null;
  ready(): Promise<void>;
  init(scenes: { [id: string]: SceneMaker }): void;
  destroy(): void;
}

const mq = (q: string): boolean => window.matchMedia(q).matches;

export function createStage(page: HTMLElement): Stage {
  gsap.registerPlugin(ScrollTrigger);
  const html = document.documentElement, body = document.body;
  const before = { htmlScroll: html.style.scrollBehavior, bodyOverscroll: body.style.overscrollBehavior };
  const contexts: gsap.MatchMedia[] = [];
  const started: HTMLElement[] = [];
  let tick: ((time: number) => void) | null = null;
  let alive = true;

  const stage: Stage = {
    get reduced() { return mq('(prefers-reduced-motion: reduce)'); },
    get phone() { return mq('(max-width: 767px)'); },
    get touch() { return mq('(pointer: coarse)'); },
    lenis: null,

    // Weighted wheel scrolling (lerp 0.12); touch keeps the phone's own scrolling, reduced motion the browser's.
    smooth({ lerp = 0.12 } = {}) {
      if (stage.reduced || stage.touch || stage.lenis) return stage.lenis;
      const lenis = new Lenis({ lerp, smoothWheel: true, anchors: true, autoRaf: false });
      lenis.on('scroll', ScrollTrigger.update);
      tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      page.classList.add('is-smooth');
      html.style.scrollBehavior = 'auto';      // stage.css: html.is-smooth { scroll-behavior: auto }
      body.style.overscrollBehavior = 'none';  //            html.is-smooth body { overscroll-behavior: none }
      stage.lenis = lenis;
      return lenis;
    },

    // One scroll scene. Sets --p (0–1) and data-beat on root, so CSS and captions can follow the scene too.
    scene(root, opts = {}) {
      if (!root) return null;
      const { hold = 2, scrub = true, build, phone = 'same', rest, beats = 0 } = opts;
      const st = root.querySelector(':scope > .scene-stage') || root.firstElementChild;
      const q = (sel: string): HTMLElement[] => Array.prototype.slice.call(root.querySelectorAll(sel));
      const toRest = (ctx: SceneCtx) => { root.classList.remove('is-live'); root.classList.add('is-rest'); root.style.removeProperty('--hold'); if (rest) rest(ctx); };
      const mm = gsap.matchMedia();
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', phone: '(max-width: 767px)' }, (c: gsap.Context) => {
        const cond = (c.conditions || {}) as { motion?: boolean; phone?: boolean };
        const isPhone = !!cond.phone;
        const ctx: SceneCtx = { root, stage: st, phone: isPhone, q };
        const plan: ScenePlan | null = isPhone
          ? (phone === 'rest' ? null : phone === 'same' ? { hold, build } : { hold: phone.hold != null ? phone.hold : hold, build: phone.build || build })
          : { hold, build };
        if (!cond.motion || !plan || !plan.build) { toRest(ctx); return () => root.classList.remove('is-rest'); }
        root.classList.remove('is-rest');
        root.classList.add('is-live');
        root.style.setProperty('--hold', String(plan.hold));
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: root, start: 'top top', end: 'bottom bottom', scrub, invalidateOnRefresh: true,
            onUpdate: (self: ScrollTrigger) => {
              root.style.setProperty('--p', self.progress.toFixed(4));
              if (beats) root.dataset.beat = String(Math.min(beats - 1, Math.floor(self.progress * beats)));
            },
          },
        });
        plan.build(tl, ctx);
        // pad the timeline to exactly 1 so positions in build() read as fractions of the hold
        if (tl.duration() < 1) tl.to({}, { duration: 1 - tl.duration() }, tl.duration());
        return () => { root.classList.remove('is-live'); root.style.removeProperty('--hold'); root.style.removeProperty('--p'); };
      });
      contexts.push(mm);
      return mm;
    },

    // Fonts and the scenes' pictures decide every height a trigger measures; refresh once they are in.
    ready() {
      const imgs = Array.prototype.slice.call(page.querySelectorAll('.scene img')) as HTMLImageElement[];
      const waits: Array<Promise<unknown>> = imgs.filter((i) => !i.complete).map((i) => i.decode().catch(() => undefined));
      if (document.fonts) waits.push(document.fonts.ready);
      return Promise.all(waits).then(() => { if (alive) ScrollTrigger.refresh(); });
    },

    // Every <section class="scene" data-scene="<id>" data-options='{"hold":3}'> on the page, started by scenes[id].
    init(scenes) {
      const els = Array.prototype.slice.call(page.querySelectorAll('.scene[data-scene]')) as HTMLElement[];
      els.forEach((el) => {
        if (started.indexOf(el) >= 0) return;
        const make = scenes[el.dataset.scene || ''];
        if (!make) { console.warn('No scene for data-scene="' + el.dataset.scene + '"'); return; }
        let o: { hold?: number } = {};
        try { o = JSON.parse(el.dataset.options || '{}'); } catch (e) { /* keep the defaults */ }
        make(el, o);
        started.push(el);
      });
    },

    destroy() {
      alive = false;
      contexts.splice(0).forEach((mm) => mm.revert());
      if (tick) { gsap.ticker.remove(tick); tick = null; }
      if (stage.lenis) { stage.lenis.destroy(); stage.lenis = null; gsap.ticker.lagSmoothing(500, 33); }
      page.classList.remove('is-smooth');
      html.style.scrollBehavior = before.htmlScroll;
      body.style.overscrollBehavior = before.bodyOverscroll;
      started.length = 0;
    },
  };
  return stage;
}
