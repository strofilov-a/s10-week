# S10 «Моя неделя»

Everything on one page. At the top a card holds today's workout, the week's volume against the plan (one long scale),
the long run and the days to the race; under it three tabs (Неделя / План до старта / Мои темпа):
- **Неделя**: each day with plan and fact; «Запланировать неделю» runs calc3's flow (two key workouts from the chosen plan →
  schedule computed by the S10 server → edit or move any day → «Поставить задачи»).
- **План до старта**: choose the master plan (versions saved by the coach in calc5, the user's own calc4 library when it is not empty, or a new one
  generated from a prompt with calc4's generator), see every week to the race laid over the dates with your paces, set the first-week
  volume and which day holds which workout, then «Заполнить календарь» writes two running weeks (S10's week starts, from
  calc.php `dselect`, usually Wednesday) or everything to the race, keeping days that already have a task. The plan used,
  with the first-week volume, the day layout, the paces and the filled range, is stored in the athlete's profile
  (`studentPlans<ID>`, the list calc5 keeps; marked `active`), so every device opens the same plan. «Вернуть как было»
  undoes the last fill, leaving days that were changed after it.
- **Мои темпа**: T5/T10/T21/T42 from the chosen plan, the S10 forecast, or your own; every workout on the page uses them.
  The four paces are edited at the top; below, the time per 1 km and per 400 m lap for each zone and the easy-run range.
- Each day shows the fact next to the plan: distance and average pace from the diary tracks, and for pace-only tasks
  whether the run was faster, slower or within the task. Diary texts are shown as Разминка / работа / Заминка lines
  (display only; nothing written to the diary changes).
- The tab and the week are in the address (`?tab=plan`, `?week=2026-10-19`), so links open the same view and «назад» works.

Colours: palette №3 «Лист, синяя и красная ручка» is the fixed default. Grey page with white cards; blue #1a4be0 marks the wordmark, the tabs, today, links and the volume scale; red #d62b1f is the main buttons and the load bars next to each workout. Add `?colors` to the URL to bring back the picker with all 20 three-colour schemes.

## Files
| File | What it is |
|---|---|
| `solo.js` | The whole page (no build step, no dependencies). Live data on s10.run, demo mode anywhere else. |
| `index.html` | GitHub Pages root: redirects to the demo outside s10.run. |
| `landing/` | Promo page for S10 Solo: https://strofilov-a.github.io/s10-week/landing/ (`?p=1`, `3` or `4` picks a palette). |
| `landing-v2/` | The same page redesigned after a taste review: https://strofilov-a.github.io/s10-week/landing-v2/ |
| `deploy/solo.html`, `deploy/ЗАДАНИЕ.md` | The page shell for s10.run and the one-page brief for the S10 developer. |
| `deploy/build.cjs`, `release/` | `npm run build` makes `release/`, the folder for the S10 developer: production `solo.js` without the demo, `solo.html`, the brief. |
| `tests/check.cjs` | Browser checks against the demo (`tests/README.md`). |
| `CLAUDE.md` | Context, decisions and rules for Claude Code. |
| `demo/index.html`, `demo/fixtures.js` | Demo with an anonymised snapshot of real data (31.10.2026; no name, email or GPS). Live demo: https://strofilov-a.github.io/s10-week/demo/. For GitHub Pages or any static host. Nothing is sent anywhere. `?open=plan` opens the planner with a computed schedule. |

## Going live on s10.run (for the developer)
1. Put `solo.js` at `/t5/solo/solo.js`.
2. Serve `deploy/solo.html` at `https://s10.run/solo/plan`, the way `/calc3` is served (not `index.html`: that one only
   redirects to the demo on GitHub Pages). Today every `/solo/…` path goes to the S10 Solo club page (`/solo/plan`
   answers 500), so the route has to come before the club's; `/solo` itself stays the club page.
3. Open it logged in. A coach can view an athlete with `?id=<athlete id>`.
4. Add «Моя неделя» to the site menu.

For each new release: replace `/t5/solo/solo.js` and bump `?v=` in `solo.html`. It must be served from s10.run itself:
it uses the logged-in session cookie for the API. The same steps in Russian: `deploy/ЗАДАНИЕ.md`.

## API used (all existing endpoints, same calls calc3/calc5 make)
Reads:
- `GET /apiweb/student/self/info/` (user, Moscow time)
- `GET /student?user_id=ID&last_date=TS&limit=60` (planned days + activities)
- `GET /apiweb/task.php?action=main&id=ID` (main race)
- `GET /apiweb/userparam.php?action=get&id=ID&param[]=studentMainStart` + `GET /apiweb/planresults.php?action=list&id=ID&limit=31` (paces)
- `GET /apiweb/calc.php?id=ID` (limits, phase, start days)
- `GET /apiweb/tasktemplates.php`, `GET /apiweb/userparam.php?action=get&param[]=studentPlans<ID>` (templates, master plans)
- `GET /apiweb/calc.php?id=ID&dselect=N&step=2&<limits>&phaset&phased&typtrain1&task1&prekm1&typtrain2&task2&prekm2` (schedule)

Writes (only on a button press, each with its own confirmation where it touches the diary):
- `POST /apiweb/userparam.php` FormData `action=set`, `id`, `param[studentPlans<ID>]` = JSON list (save version, same storage as calc5)
- `POST https://s10.run/t7/plan-templates/public/api/generate.php` JSON `{distance, weeks, prompt}` (calc4's generator, streamed text)
- `POST /apiweb/task.php?id=ID&action=update` (the diary), FormData `tasks` = JSON
  `[{d, task, prekm, typtrain, main6:0, location, prediction}]` (the exact payload calc3's «Поставить задачи» sends;
  premium required, as in calc3). `main6` is 1 only for the main race day, and «Заполнить календарь» never rewrites the
  main race day.

Not logged in (`student/self/info` answers `null`): the page shows «войдите в S10» with a link to `/login`.

"Done" counts runs only (track type `run`); hikes and rides are listed under the day.
Not ported from calc3: the optional chat message to the coach after saving.

## Demo and checks
- Demo: https://strofilov-a.github.io/s10-week/demo/ (GitHub Pages from `main`, root folder; updates about a minute
  after a push). It shows an anonymised snapshot from 31.10.2026 and never sends anything; live data only on s10.run.
  `?newbie` opens it as someone who has just signed up (start window, no plans, empty diary), afresh on every visit;
  `?newbie&free` also without premium.
- Checks: `npm ci && npx playwright install chromium` once, then `npm test` (`tests/README.md`). GitHub Actions runs
  them on every push.
