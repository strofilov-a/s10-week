# S10 «Моя неделя»

Everything on one page, in three tabs under "today + the week in four numbers":
- **Неделя**: each day with plan and fact; «Неделя в деталях» runs calc3's flow (two key workouts from the chosen plan →
  schedule computed by the S10 server → edit or move any day → «Поставить задачи»).
- **План до старта**: choose the master plan (your saved versions from calc5, the calc4 library, or a new one generated
  from a prompt with calc4's generator), see every week to the race laid over the dates with your paces, set the first-week
  volume and which day holds which workout, then «Заполнить календарь» writes the whole plan into the diary (optionally
  leaving days that already have a task). «Сохранить версию» saves it where calc5 sees it.
- **Мои темпы**: T5/T10/T21/T42 from the chosen plan, the S10 forecast, or your own; every workout on the page uses them.

Colours: palette №3 «Лист, синяя и красная ручка» is the fixed default — white/grey ground, blue accent #1a4be0 (tabs, today, links, progress), red #d62b1f (main buttons, workout-load bars). Add `?colors` to the URL to bring back the picker with all 20 three-colour schemes.

## Files
| File | What it is |
|---|---|
| `week.js` | The whole page (no build step, no dependencies). Live data on s10.run, demo mode anywhere else. |
| `index.html` | The live page shell for s10.run. Loads `/t5/week/week.js`. |
| `demo/index.html`, `demo/fixtures.js` | Demo with an anonymised snapshot of real data (31.10.2026; no name, email or GPS). Live demo: https://strofilov-a.github.io/s10-week/demo/. For GitHub Pages or any static host. Nothing is sent anywhere. `?open=plan` opens the planner with a computed schedule. |

## Going live on s10.run (for the developer)
1. Put `week.js` at `/t5/week/week.js`.
2. Serve `index.html` at `https://s10.run/week` (or add the route to the site's router).
3. Open it logged in. A coach can view an athlete with `?id=<athlete id>`.
4. Optional: add «Моя неделя» to the site menu.

It must be served from s10.run itself: it uses the logged-in session cookie for the API.

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
- the diary:
- `POST /apiweb/task.php?id=ID&action=update`, FormData `tasks` = JSON `[{d, task, prekm, typtrain, main6:0, location, prediction}]`
  (the exact payload calc3's «Поставить задачи» sends; premium required, as in calc3).

"Done" counts runs only (track type `run`); hikes and rides are listed under the day.
Not ported from calc3: the optional chat message to the coach after saving.

## Demo on GitHub Pages (no server access needed)
1. github.com → New repository → name `s10-week` → Public → Create.
2. «uploading an existing file» → drag in everything from this folder (`week.js`, `index.html`, `README.md`, the `demo` folder) → Commit.
3. Settings → Pages → Source: Deploy from a branch → Branch `main`, folder `/ (root)` → Save.
4. After about a minute the demo is at `https://<username>.github.io/s10-week/demo/`.
   It shows an anonymised snapshot from 31.10.2026 and never sends anything. Live data only works on s10.run itself.
