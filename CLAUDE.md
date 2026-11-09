# S10 «Моя неделя» — context for Claude Code

A standalone page for s10.run (a running-coaching site) where an athlete fills their S10 calendar up to the main race in a
few minutes: take a master plan (a version the coach saved, or a new one from a prompt), check the first-week volume and
which weekday holds which workout, press «Заполнить календарь». The same page shows the week (plan vs fact), a small
calendar to the race, the paces, and the one-week planner from calc3.

The owner talks Russian; the UI is Russian. Code comments and docs are English.

## Who does what

- The S10 developer only embeds the page into the site once: `solo.html` served at `/solo/plan` the way `/calc3` is
  served, `solo.js` at `/t5/solo/solo.js`, a menu item. We hand him the `release/` folder as a zip (`npm run zip`): the
  production `t5/solo/solo.js` with the demo cut out, `solo.html` with a fresh `?v=`, `solo-start.html`, and the brief.
  For each release he replaces the files the brief marks as changed (overwriting all three is also safe). Everything
  else (logic, texts, design, checks) is ours. Brief for him: `deploy/ЗАДАНИЕ.md`. Owner's choice 06.11.2026: a zip by
  hand, no auto-update from GitHub; keep each release as little work for the developer as possible.
- Installed on s10.run 06.11.2026 (release `4a45d50219`): all three served as static files by Angie, byte for byte
  `release/`. `/t5/solo/solo.js` has `max-age=3600`; `/solo/plan` and `/solo/start` had no `Cache-Control` (the brief
  asks once for `no-cache`).

## Releasing

1. `npm run zip`: every check, the build, then `dist/solo_release_<id>.zip` (refuses when nothing differs from the live
   site). The README inside opens with a table of the three files, «изменился» / «без изменений» against
   `deploy/live.json`.
2. The owner sends the zip to the developer.
3. When he says it is up: `npm run live` (three read-only GETs of s10.run). If the site serves `release/` exactly, it
   records that in `deploy/live.json` and rebuilds; commit both. Otherwise it says which file is not there yet.
- No backend changes: the page uses only the site's existing endpoints with the session cookie, like calc3/calc4/calc5.

## Files

| Path | What |
|---|---|
| `solo.js` | The whole page: one file, no build, no dependencies. Live on s10.run (by hostname), demo anywhere else. |
| `demo/index.html`, `demo/fixtures.js` | Demo on an anonymised snapshot (31.10.2026). Published on GitHub Pages: https://strofilov-a.github.io/s10-week/demo/ (`?newbie`: as a just-signed-up athlete, afresh each visit; `&free`: no premium; `?free` alone: the usual athlete without premium; `?open=replan`: the plan tab with a rule-based re-plan proposal open) |
| `index.html` | GitHub Pages root: redirects to `demo/` outside s10.run. |
| `landing/` | Promo page for S10 Solo (traffic from Instagram/Threads): one `index.html` + `scenes/` (taste-skill scroll stage, GSAP/Lenis from jsdelivr). No photos (owner, 03.11.2026). Every button goes to `/login?back=…/solo/plan`. Three palettes (`?p=1`, `3`, `4`; the blue №2 removed by the owner 03.11.2026; picker until he chooses). https://strofilov-a.github.io/s10-week/landing/ |
| `landing-v2/` | Second take on the same page after a taste review (direction «one motif»: the race-day circle flies from the hero into 6 December; colour fields, «Что умеет Solo» as a held scene of six features, the paces slider, two plan fields). Jost + Golos Text. One palette: 1t, taste's correction of the owner's pacific · tomato · mustard (stone ground, deep teal ink; owner's choice 03.11.2026). Built into `release/solo-start.html` for `/solo/start`. On touch screens (owner, 09.11.2026: the flight shook on the phone, twice) nothing follows the scroll by script: the circle stays in the hero and goes up with the page, 6 December pops in on a timer when the calendar comes into view (IntersectionObserver, `.cal-sec.pop`), and the showcase/footer drifts are off; with a mouse the orb still flies, screen-fixed under Lenis. On phones the circle is whole (56vw) at the right under the hero text, the 6 in its middle (Golos Text's 6 sits .03em low). The hero clips its sides so a circle past the edge never widens a touch screen's page. The pinned calendar fits a phone screen under the top bar (heading on one line, shorter rows; on a short phone the week figures go). The closing «Начать» arch keeps its text a third of the radius in from the corners. https://strofilov-a.github.io/s10-week/landing-v2/ |
| `landing-v2-colors/` | Temporary: landing-v2 with the six-palette picker (owner's 1, 3, 4 and taste's 1t, 3t, 4t), to play with; not part of the release. Delete when done. https://strofilov-a.github.io/s10-week/landing-v2-colors/ |
| `landing-v2-violet/` | Temporary: landing-v2 in the owner's violet #C03EE0 · pink #E03EAF · raspberry #E03E5E on white (deep plum ink derived from the violet; inspector needs `--allow palette-purple`), to compare; not part of the release. https://strofilov-a.github.io/s10-week/landing-v2-violet/ |
| `pay/` | Draft of a new Premium payment page to replace `/money_stripe` (owner, 09.11.2026: «перерисуем … дорого красиво, как у Stripe»). One `index.html` + `fx/` (taste-skill's fx.js and orb-sphere, MIT) + `icons/`. Taste deal: software, palette white-link-blue, Onest, one effect (orb-sphere on the Premium card). The Premium card and the pay panel (€ Stripe / ₽ Т-Банк, period, autopay), then «Что входит в Premium» as feature cards with S10 UI fragments (owner removed the run stats, coach and history 09.11.2026). Live on s10.run it reads `/money_stripe` and `/money2` as HTML (paid-until, prices, autopay, email) and «Оплатить» sends the old pages' GET: `/money_stripe?paysite=1[&siterecur=1]`, `/money2?email=…&paysite=1[&recur=1][&paymonth12=1]`. Demo elsewhere (`?free`, `?cur=rub`). Not in the release yet; Onest still from Google Fonts. https://strofilov-a.github.io/s10-week/pay/ |
| `deploy/solo.html` | The page shell for s10.run (copied from the `/calc3` template: `/t5` Roboto fonts, icons, cookie consent). |
| `deploy/ЗАДАНИЕ.md` | The one-page brief for the S10 developer (copied into `release/` as `README.md`). |
| `deploy/build.cjs` | `npm run build`: cuts every demo-marked block (`/*<demo>*/…/*</demo>*/`) out of `solo.js` into `release/`, stamps `?v=` with a hash of the code, checks no demo is left and that it parses. Mark any new demo-only code so. Also builds `release/solo-start.html` from `landing-v2/` with its stage, GSAP and Lenis inlined from node_modules (no CDN: jsDelivr is unreliable from Russia). |
| `release/` | What goes to the S10 developer, committed; CI fails if it differs from a fresh build. |
| `deploy/live.json`, `deploy/live.cjs` | What s10.run serves (hash of each file, release id); `npm run live` checks the site and records a new release once it is up. |
| `deploy/zip.cjs`, `deploy/files.cjs` | `npm run zip` → `dist/solo_release_<id>.zip` (git-ignored); the file list, hashes and release id shared by build, live and zip. |
| `tests/release.cjs` | Runs the release build at `/solo/plan` against a stand-in of the site's API (the demo snapshot), writes recorded. |
| `tests/landing.cjs` | Runs `release/solo-start.html` at `/solo/start` with every outside request blocked: scenes live, the circle lands, actions go to the login, paces follow the goal. |
| `tests/check.cjs` | Browser checks against the demo (see Testing). |
| `.github/workflows/check.yml` | Runs `tests/check.cjs` on every push and pull request. |
| `README.md` | Feature and API overview (English). |

## How the page works

- `LIVE = /(^|\.)s10\.run$/.test(location.hostname)`. In demo mode `get`/`post` answer from `window.S10_FIXTURES` and
  imitate the server (the diary even pages like the real API). Nothing leaves the browser in demo mode.
- «Today» is the Moscow date from `student/self/info.nowmsk` (the site counts days in Moscow time).
- Rendering is plain template strings into one root (`#s10-week`); state lives in closures; `render()` redraws.

## Endpoints (all existing; `ID` = profile id, or `?id=` when a coach opens an athlete)

Reads:
- `GET /apiweb/student/self/info/` — profile, `isPremium`, `nowmsk`. Answers `null` when logged out → page shows «войдите в S10» (/login).
- `GET /apiweb/task.php?action=main&id=ID` — main race `{d, location, prekm, prediction}`.
- `GET /student?user_id=ID&last_date=TS&limit=60` — the diary, NEWEST FIRST, up to `limit` days with date <= last_date
  (Moscow day); `diaryTasksisMoreExist` = the `last_date` for the next page, 0 at the end. A long plan needs several pages:
  `loadRange(from, to)` follows the cursor; `loadedWeeks` caches covered weeks.
  Day: `{date, type, comment, target, main6, location, prediction, tracks:[{type:'run', km, …}]}`.
- `GET /apiweb/userparam.php?action=get&id=ID&param[]=studentMainStart` + `GET /apiweb/planresults.php?action=list&id=ID&limit=31` — S10 pace forecast.
- `GET /apiweb/userparam.php?action=get&param[]=studentPlans<ID>` — saved plan versions (the list calc5 keeps).
- `GET /apiweb/userparam.php?action=get&param[]=planTemplates` — the logged-in user's OWN calc4 library (empty for most athletes; tab hidden when empty).
- `GET /apiweb/calc.php?id=ID` — limits, phase, `dselect` = start days of S10 running weeks (Wednesday for the owner).
- `GET /apiweb/tasktemplates.php`; `GET /apiweb/calc.php?id=ID&dselect=N&step=2&…` — templates and the one-week schedule (calc3).

Writes (only on a button, the diary ones after a confirmation):
- `POST /apiweb/task.php?id=ID&action=update`, FormData `tasks` = JSON `[{d, task, prekm, typtrain, main6, location, prediction}]`
  (calc3's payload). Accepted 32 days in one request on the live site; we still send one Mon–Sun week per request.
  `main6` = 1 only for the main race day; the main race day is never rewritten by a fill. Ordinary days sent with
  `main6: 0` (as calc3 does) left the main race intact on the live site; what `main6: 0` would do to the race day itself
  is untested, which is why that day is never sent.
- `POST /apiweb/userparam.php` FormData `action=set`, `id`, `param[studentPlans<ID>]` = the whole JSON list. Re-read the
  list right before writing so a version the coach saved meanwhile survives.
- `POST https://s10.run/t7/plan-templates/public/api/generate.php` JSON `{distance, weeks, prompt}` — calc4's generator,
  streamed text, no auth (cost risk if opened to everyone).

typtrain: 0 none · 1 recovery · 2 development · 3 interval · 4 repeat · 5 long · 6 race.

## Rules the code keeps

- The plan is laid over the dates: week −1 is the race week, week −n starts n−1 weeks before. `T21+8` style paces are
  turned into numbers before writing.
- Fill = «2 беговые недели» (default; from the next S10 running-week start in `dselect`; after a fill it offers the next
  pair) or «До старта». Past days and today are never written; days with a task stay unless the athlete unticks
  «Не трогать…»; a day that already says exactly the same is not sent again.
- The plan used for a fill is stored in the profile as the `active` version in `studentPlans<ID>`, with
  `student.layout` (Mon..Sun roles), `student.volume`, paces `t5…t42`, `filled {at, from, to}` and `undo`.
  On load the active version wins over browser storage, so every device opens the same plan and settings.
- Undo («Вернуть как было»): `undo = {at, prevFilled, days: [[date, beforeType|null, beforeKm, beforeText, place, forecast,
  afterType, afterKm, afterTextHash]]}` (also mirrored in localStorage). A day changed after the fill is skipped; an
  empty-before day is cleared with `{typtrain:0, task:'', prekm:0}`.
- Without premium the write buttons are disabled with a note (calc3's rule).
- Chance to reach the goal («Вероятность достижения цели», owner 06.11.2026: not the plan's completion, S10 shows that on its tasks page,
  but whether the goal time is reachable on race day; moves with every workout; meant to be indicative, not precise).
  `chance()` with the numbers in `CH`: form now at the race distance = the latest race result of the last 12 weeks
  (`planresults` realhms, by Riegel k = 1.06), else the S10 forecast for this race, else the paces; pace-only key
  workouts move it by half their median difference from the task (at most 3%). `training()` scores the last 6 weeks of
  the diary (`READY`, the last 2 count twice): key workouts (typtrain 2–4) 35%, volume 25%, long runs 25%, regularity
  15%, done = 80% of the km. Race-day form = form now × (1 − rate × weeks left × (T − 30%)/70%), rate 0.5%/week for a
  4:00+ marathon level to 0.25% at 3:00, in all at most 10%…6% (under 30% the form drops). Spread 2% + 0.2%/week; chance
  = Φ((goal − race-day form)/(race-day form × spread)), 1…99%. Shown beside «До старта» and as a card on «План до
  старта»: form now (and from what), race-day form, the times with 50% and 80%, the training parts. Without a race or
  goal: no figure. Nothing is stored or written. Coefficients are guesses until calibrated on S10's prehms/realhms.
- Re-plan (stages 2 and 3, owner 06.11.2026), at the bottom of the readiness card, for the weeks from next Monday:
  «Перестроить по правилам» (`replanByRules`, numbers in `RP`): under 80% of the planned km run in the last 2 weeks,
  each next week = the 2-week average +10%, growing 10% a week, never under 40% of the plan nor over it, a lower plan
  week (taper) kept lower, long runs shortened with the volume (to 75% at least), key workouts unchanged; over 110%, up
  to 5% above the plan within `maxweek`; the race week stays as planned. A key workout missed in the last 3 days of this
  week goes to the first free or easy day left in it with no hard day either side. Three or more pace-only key workouts
  in 6 weeks, two thirds faster (slower) than the task by over 5 s/km: all paces shift by their median, 3–10 s/km. A
  forecast slower than the goal is only said. «Перестроить с ИИ» (`replanByAI`): calc4's generator rewrites the same
  weeks from a prompt with the race, paces, readiness parts, the last 2 weeks and the limits (its km are divided by the
  first-week scale). Either way the proposal shows week totals was → now with the key workouts and what will be written;
  options can be unticked. Writing (`applyReplan`) rewrites only days still exactly as the current plan laid them,
  plus moves; empty days are left to «Заполнить календарь», changed days stay. The plan is stored as a new active version
  «… · перестроен <date>»; the undo record carries `prevActive` and `prevPace`, so «Вернуть как было» restores the days,
  the previous version and the paces. Review fixes 09.11.2026: the first-week volume follows a re-planned first week so
  every week keeps its scale; running over 110% never lowers a week; a move only for a key workout not run at all, not
  one already copied later in the week, one per day, checked again against the diary when written; writing reloads the
  diary first; a re-plan always leaves an undo record (`replan`, `prevSel`, `prevActive`, `prevPace`, days possibly
  none) and undo restores the selection, the active version and the paces; a changed plan, volume, day role or pace drops
  an open proposal. Paces filled in the start window and not edited (`paceGuess`) are no form for the probability.
- Start window (new athletes only, own page only, never for a coach with `?id=`): shown when the site has no main race
  and the athlete has not chosen «Отсутствует», and/or when there are no complete paces. «Сохранить старт» writes the
  main race through `writeTasks` (`typtrain 6`, `main6: 1`, like calc3), asking once if that day already has a task;
  the goal reads as h:mm for a half/marathon and mm:ss for 10 km and shorter. «Отсутствует» (`noRace`, in localStorage
  and as `student.noRace` on the stored version): `race` stays null and `raceMon/raceEnd` anchor the plan to its own
  end, week −n in the week of the next S10 running week; the race slot is not laid, «До старта» reads «Весь план»,
  and «2 беговые недели» count from the plan's start. A new plan's length («Недель») is the weeks to the race, or 2
  without one (owner's call 01.11.2026). Distances offered: marathon, half, 10 km, 5 km (no parkrun).
- Paces: easy runs are T42 + 55…75 s unless the paces carry an explicit `easy` range. Without any paces the window
  offers a new athlete's defaults (owner's choice 01.11.2026: someone running 3×/week 5–7 km without a plan; 5 km in
  30:00, Riegel k = 1.06, rounded): T5 6:00, T10 6:15, T21 6:30, T42 6:50, easy 7:00–7:30 (the formula would give
  7:45–8:05). With a goal (typed in the window, or the site race's forecast) the paces follow it instead
  (`pacesFromGoal`): the goal's pace on its distance, the others by Riegel k = 1.06 (S10's forecast for 3:20 is
  4:11/4:20/4:33/4:44, ours 4:10/4:21/4:33/4:44), easy from T42 + 55…75 s at marathon pace 4:45 to T42 + 10…40 s at
  6:50, linear in between; a pace edited by hand stops the following. Saved as the athlete's own (`easy` too, also in
  `student.easy`). «Заполнить календарь» needs all four paces, so the diary never gets «T5+5» instead of minutes per km.

## Design decisions (from the owner; keep them)

- Header as on the site (owner, 06.11.2026): the menu button on the left opens the site's own menu over the page (the
  same links as the site's header: trainer, «Задачи», «Премиум» without premium, challenges, answers, payments, profile,
  logout; `role`, `currentTrainerId`, `isPremium` from `student/self/info`), the avatar on the right links to
  `/profile?ID` (`avatarUrl`; initials when there is none or it does not load).
- Every grid that holds text or a select has `grid-template-columns:minmax(0,1fr)`: an implicit `auto` column grows to
  a select's longest option (Safari sizes selects that way), which pushed the planner's work cards off the phone
  screen on s10.run (the site's template names are far longer than the demo's).
- taste-skill review (06.11.2026; taste 2.5 has no app mode, so its marketing-page checks were left out): muted text
  #595959 (7:1 on white; was #6b6b6b), past days in the plan in muted ink instead of a faded row, h1 32/24 px as the
  largest type with the «сегодня» figure 32/24, h2 17 everywhere, planner step titles 13 px caps, hover on every
  control, no line ending on one short word, and on screens ≥1200 px the open week of the plan as day cards (four in a
  row, Sunday across two). Judged false for an app screen and left: KPI figures larger than h2, the calendar's month
  column («stagger»), the calendar as the right column («off-grid»), day cards without pictures («card-visual»), and
  the findings behind the start window's backdrop.
- Summary card (owner, 09.11.2026): the race and its goal under today's workout, at the bottom of that column, 19 px
  medium («Valencia, 6 дек, 42 км, цель 3:19:59», each part kept whole on a line), «До старта 36 дней» small above it;
  on the right «Объём недели» and «Вероятность достижения цели», each across the column.
- Layout «A»: site header (blue #004aad, 48 px, the S10.run logo in the middle — simplified SVG in `LOGO`), h1
  «Моя неделя, dates», the summary card (today + «Объём недели» + «До старта») and the small calendar beside it, one
  height; tabs Неделя / План до старта / Мои темпа under them.
- Calendar: rows = weeks from last week to the race week (8 shown, «Все недели» for more), day numbers with a dot
  (grey planned, blue done), today ringed blue, race = red filled circle with a white number. Click opens that week.
- Palette №3 «Лист, синяя и красная ручка» (`?colors` shows the picker). Light theme only.
- Write «темпа», never «темпы». No ↑↓ arrows. Workout text must not be cramped.
- NOTHING may jump on click: the calendar, the week switch, the fill buttons when switching «2 беговые недели» /
  «До старта». `tests/check.cjs` measures positions — keep it green.
- Fill buttons sit at the bottom of their box; the hint under the count is two lines. «Сохранить версию» stands at the top
  right beside the «2 беговые недели / До старта» switch (on a phone above it), «Заполнить календарь» at the bottom
  (owner, 09.11.2026). «Заполнить календарь» saves the plan to the profile itself.
- Paywall (owner, 09.11.2026): without premium «Заполнить календарь» is replaced by «Оформить Premium» to `/money` (it
  saves a new or library plan to the profile first, so it is there after paying), with «750 ₽ в месяц или 9 €»; the other
  write buttons stay disabled with an «Оформить Premium» link. No free promise in Solo: the site gives Premium for the
  first 3 days, so the paywall is only seen once it is over (owner: no card binding, a paywall after 3 days).
- A saved version is named by the race and its goal, «Valencia 3:20» (`planName()`; the distance when the race has no
  name; a re-plan adds «· перестроен <date>»); a coach's version keeps its name.
- The goal field asks for a keyboard with punctuation (`inputmode="text"`), the easy-run range too (it needs «-»);
  a goal typed as digits reads «130» → 1:30 for a half/marathon, «2230» → 22:30 for 10 km and shorter, 5–6 digits h:mm:ss.
- Landing: «Попробовать 3 дня бесплатно» on both buttons, the 3 free days in the Premium card and the price answer. The
  Valencia example with its fixed dates stays as is (owner, 09.11.2026).
- Footer: a link to the Telegram chat for questions and feedback, https://t.me/+wP4aOZ4910I2MTk6 (owner, 01.11.2026).
- Plan generator: the «Расскажите о себе и цели» box comes first, 16/500 label in ink, 2px accent border and an accent
  hint under it (`aria-describedby`); it takes the focus with its text selected. Prefilled: «заполни как есть, там
  посмотрим» without a race, «Марафон 6 дек, Valencia, цель 3:20:00.» with one; typing makes it the athlete's
  (owner, 01.11.2026: the first time he pressed «Сгенерировать» without noticing the box).

## Testing

```
npm ci && npx playwright install chromium    # once
npm test                                     # demo checks (104), the release build and its checks (12), the promo page (35)
```

GitHub Actions (`.github/workflows/check.yml`) runs the same on every push and pull request, and fails if the committed
`release/` is not the build of the current source.

Live checks on s10.run (how to inject read-only, what has been verified on the owner's account): the `s10-live-check`
skill.

Never write to the owner's real diary or profile without his explicit yes in the chat.

## Open items

- Race week: with the race on Sunday the plan leaves Thu–Sat as rest (its volume already includes the marathon). Ask the
  owner whether easy runs should replace that.
- Ideas: a reminder on the week view when the filled weeks run out; a race-week sanity check; adapting volume to the
  fact; a coach view of athletes' plans; calendar export (ICS); analytics.
