# S10 Solo V4 — context for Claude Code

You are working in the S10 developers' React app, integrating the pages that a separate team (the S10 Solo owner and
his Claude) wrote and maintains: `/solo/plan` («S10 Solo / Моя неделя», an athlete's training cabinet), `/solo/kazan`
(the same cabinet in its Kazan marathon mode, new in V4) and `/solo/start` (the public S10 Solo promo page). This folder
is their hand-over, Solo V4 of 17.11.2026. Answer the developer in Russian unless he writes otherwise. The UI is
Russian; keep every text as it is.

Read `README.md` (Russian, the full brief) and `CHANGES.md` (what changed since Solo V3) before changing anything.

## The target stack (the developers' spec — do not leave it)

- React 17.0.1, ReactDOM 17.0.1 (`ReactDOM.render`). No `createRoot`, no React 18/19 APIs, no Next.js (`next/*`),
  no Server Components, no own router.
- TypeScript 4.9, `target: es5`, `strict`, `noImplicitAny`, `strictNullChecks`, `jsx: react`, `allowJs: false`.
  With es5 there is no iteration of Map/Set/NodeList with `for…of` or spread: use `Array.from(...)`.
- Webpack 5, `ts-loader`, plain CSS through `style-loader` + `css-loader`. No other loaders are needed: the promo
  fonts are `data:` URLs inside `fonts.css`.
- No new npm dependencies without the developers' agreement. Already needed: `gsap@3.15.0` (with `gsap/ScrollTrigger`)
  and `lenis@1.3.26`, both for `/solo/start` only. They ship their own types.
- `import './x.css'` needs `declare module '*.css';` somewhere in the project if it is not there yet.

## What is in here

```
solo-plan/   SoloPlan.tsx (root) → mountSoloPlan(host, opts) in engine.ts → cleanup
             SoloKazan.tsx (root of /solo/kazan) = <SoloPlan mode="kazan" />
             api.ts (every request), storage.ts (localStorage: «s10week.» keys, «s10week.kazan.» in the Kazan mode),
             urlState.ts (?id ?tab ?week, popstate)
             plan.css (all under .w-app)
solo-start/  SoloStart.tsx (root, renders markup.ts) → mountSoloStart(root) in start.ts (+ stage.ts) → cleanup
             start.css (all under .s10-solo-start), fonts.css (Jost, Golos Text)
```

Mount them where the router serves the three paths. Each is independent: importing mounts nothing, and `/solo/start`
makes no requests at all.

```tsx
import { SoloPlan } from './solo-plan/SoloPlan';
import { SoloKazan } from './solo-plan/SoloKazan';
import { SoloStart } from './solo-start/SoloStart';
{path === '/solo/plan' && <SoloPlan />}      // <SoloPlan overlay /> covers the window, as the standalone page did
{path === '/solo/kazan' && <SoloKazan />}    // the mode comes from the component, not from the address
{path === '/solo/start' && <SoloStart />}
```

## The Kazan mode (V4)

`<SoloKazan />` mounts the same engine with `mode: 'kazan'`. Its constants live in one line of `engine.ts`:
`KAZAN = { name: 'Казань', location: 'KAZAN', d: '2027-05-02', km: 42.2, goals: ['3:00:00', '3:30:00', '4:00:00'],
scale: { '3:00:00': 1, '3:30:00': 0.85, '4:00:00': 0.7 } }`, and the owner's 24-week plan is the `KAZAN_PLAN_MD` text.
Every date the page shows or checks comes from `d`. The race date is provisional (the organiser has not announced it):
when it changes, the owner sends a new `engine.ts`; do not edit the date locally.

- The race is fixed; instead of the plan choice and the generator the athlete picks the goal 3:00 / 3:30 / 4:00
  (the stored plan's goal, else the one picked in this browser, else the diary's Kazan goal, else 3:30). The goal sets
  the paces and scales easy runs and long runs; key workouts stay as in the plan; the race week has no easy runs; an
  athlete starting after week −21 gets two softer weeks (×0.75, ×0.9).
- Before a fill, unless the diary's main race is already Kazan (a marathon dated `d` or the two days before), the page
  asks «Казанский марафон 2 мая станет главным стартом вместо …»; «Да» writes the Kazan day as the main race
  (`typtrain 6`, `main6 1`) through the same `task.php` write as Solo's start window, then fills. Keep that question.
  A fill never writes over a race day already in the diary (the old main race stays an ordinary race).
- Its plan version is in the same `studentPlans<ID>` list with `kind: 'kazan'`, `student.kazanGoal`,
  `student.kazanStart`: one per athlete, active only while Kazan is the main race. `/solo/plan` lays an active Kazan
  version by its kind (its goal's volume), so both pages show the same plan.
- localStorage keys are «s10week.kazan.…» (`storeFor('kazan.')`), so Kazan never overwrites Solo's keys. If you
  replace `storage.ts`, keep the prefix by mode.
- Logged out: a Kazan block with «Войти и начать» → `/login?back=<the full address>`, no other request.

## How it is built — read before editing

This is a wrapper, not a React rewrite (the owner's choice «вариант Б»):

- **`engine.ts` is generated** by the owner's tooling from their plain-JS `solo.js`. It renders the cabinet as HTML
  template strings into one root and keeps its state in closures; events are delegated on the root (`data-act`
  attributes). Its types are mostly `any`; `!` and `as any` only silence strict mode and change no behaviour.
  The next version from the owner will replace this file whole. So: keep local edits to `engine.ts` minimal, mark
  each with a `// S10-LOCAL:` comment, and list them for the developer, so they can be sent to the owner and kept.
  Never reformat it or "clean it up".
- **`plan.css`, `markup.ts`, `start.css`, `fonts.css` are generated too** — same rule.
- **`api.ts`, `storage.ts`, `urlState.ts`, both `.tsx` roots, `start.ts`, `stage.ts` are hand-written** and meant to
  be adapted: swap `api.ts` to route requests elsewhere, `urlState.ts` if your router owns the address.
- Do not "convert" the cabinet to React components as part of integration. If the developers want that, it is a
  rewrite to agree with the owner first (his estimate: several days and a long behaviour comparison).

## Rules the integration must keep

- **APIs, storage formats, data-owner rules and access checks stay as they are.** The page calls only the site's
  existing endpoints with the session cookie (`credentials: 'include'`), same origin: `README.md` lists every one.
- **Who owns the data:** the athlete is `?id=` from the address, else the logged-in user
  (`GET /apiweb/student/self/info/` → `id`). Diary, race, forecast, writes and plan versions all go with `id=` of
  the athlete. The AI-generation counter `soloGen` belongs to the logged-in user (whoever presses the button).
  Plan versions are read WITH `&id=` since V3: a coach opening an athlete sees the versions saved to that athlete.
- **Premium:** without it nothing is stored in the profile; «Оформить Premium» and «Сохранить версию» go to `/money`.
- **AI generations:** 5 a Moscow day per logged-in user (`userparam` key `soloGen` = `{"d":"YYYY-MM-DD","n":3}`).
  This is a browser-side limit only: the generator endpoint itself is open. Mention it if asked about abuse.
- **Login:** every way to the login is `/login?back=<the full address of the page>`; the site's login returns only
  to a full `https://s10.run/…` address.
- **«Today»** is the Moscow date of `nowmsk` (plain unix time + 3 h). Do not replace it with the browser's date.
- **No NaN in workouts:** paces are used only as a full set of four (5, 10, 21, 42). Keep it so if you touch paces.
- **Never write to a real athlete's diary or profile while testing** — use a test account. Every diary write sends
  the athlete a Telegram message from the site.

## Global effects (and their cleanup)

- `/solo/plan` and `/solo/kazan`: sets `document.title`; while its menu is open, `overflow: hidden` on `<html>`; a
  palette colour on `<html>` background. Unmount restores `<html>` (not the title). `opts.overlay` makes it
  `position: fixed` over the app.
- `/solo/start`: while mounted, Lenis smooths the mouse wheel on the window and GSAP's ticker runs with
  `lagSmoothing(0)`; `<html>` gets `scroll-behavior`, `<body>` `overscroll-behavior: none` (with Lenis). Unmount
  reverts every ScrollTrigger, destroys Lenis, restores the ticker (`lagSmoothing(500, 33)`) and those styles.
  The page's own `body` styles (background `#EEF1EF`, fonts) sit on the `.s10-solo-start` root here.
- HTML shell: `/solo/plan` and `/solo/kazan` need the site's Roboto (400/500/900) from `/t5` like `/calc3`; `/solo/start` needs its
  meta tags in your shell (title «S10 Solo — план до старта», description, og:*, `theme-color #EEF1EF`,
  `viewport-fit=cover`) — React does not set them.

## How to check your integration

1. `tsc --noEmit` with the project's tsconfig: no errors (the owner verified TS 4.9.5 + @types/react 17.0.83).
2. The webpack build passes.
3. In a browser, under a TEST account:
   - `/solo/plan`: the week, «План до старта», «Мои темпа»; no `NaN` anywhere; logged out → «войдите в S10» with a
     full `back`; without Premium the write buttons lead to `/money`; the AI buttons say «Осталось N из 5».
   - `/solo/kazan`: «Казанский марафон, 2 мая 2027», the goal picker 3:00 / 3:30 / 4:00 changes paces and volume, no
     plan choice or generator; «Заполнить календарь» asks about the main race first (answer «Отмена» on a real
     account); logged out → the Kazan block with «Войти и начать» and a full `back`; opening `/solo/kazan` leaves the
     `s10week.…` keys of `/solo/plan` as they were.
   - `/solo/start` on desktop and a phone: three scroll scenes run, the big red circle lands on 6 December (with a
     mouse) or pops in (touch), every button goes to `/login?back=https%3A%2F%2Fs10.run%2Fsolo%2Fplan`, no
     horizontal scroll.
   - Navigate away and back to each page: no duplicated animations, listeners or content, no console errors.
4. Report to the developer what was checked and what was not; do not claim checks that did not run.

If something in these pages looks wrong or needs a change beyond integration, write it down for the owner rather than
rewriting it here: he keeps the source of truth and will send a new version.
