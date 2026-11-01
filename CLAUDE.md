# S10 «Моя неделя» — context for Claude Code

A standalone page for s10.run (a running-coaching site) where an athlete fills their S10 calendar up to the main race in a
few minutes: take a master plan (a version the coach saved, or a new one from a prompt), check the first-week volume and
which weekday holds which workout, press «Заполнить календарь». The same page shows the week (plan vs fact), a small
calendar to the race, the paces, and the one-week planner from calc3.

The owner talks Russian; the UI is Russian. Code comments and docs are English.

## Who does what

- The S10 developer only embeds the page into the site once: `deploy/solo.html` served at `/solo/plan` the way `/calc3`
  is served, `solo.js` at `/t5/solo/solo.js`, a menu item. For each release we hand over a new `solo.js` and he bumps
  `?v=` in `solo.html`. Everything else (logic, texts, design, checks) is ours. Brief for him: `deploy/ЗАДАНИЕ.md`.
- No backend changes: the page uses only the site's existing endpoints with the session cookie, like calc3/calc4/calc5.

## Files

| Path | What |
|---|---|
| `solo.js` | The whole page: one file, no build, no dependencies. Live on s10.run (by hostname), demo anywhere else. |
| `demo/index.html`, `demo/fixtures.js` | Demo on an anonymised snapshot (31.10.2026). Published on GitHub Pages: https://strofilov-a.github.io/s10-week/demo/ (`?newbie`: as a just-signed-up athlete, afresh each visit; `&free`: no premium) |
| `index.html` | GitHub Pages root: redirects to `demo/` outside s10.run. |
| `deploy/solo.html` | The page shell for s10.run (copied from the `/calc3` template: `/t5` Roboto fonts, icons, cookie consent). |
| `deploy/ЗАДАНИЕ.md` | The one-page brief for the S10 developer. |
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

- Layout «A»: site header (blue #004aad, 48 px, the S10.run logo in the middle — simplified SVG in `LOGO`), h1
  «Моя неделя, dates», the summary card (today + «Объём недели» + «До старта») and the small calendar beside it, one
  height; tabs Неделя / План до старта / Мои темпа under them.
- Calendar: rows = weeks from last week to the race week (8 shown, «Все недели» for more), day numbers with a dot
  (grey planned, blue done), today ringed blue, race = red filled circle with a white number. Click opens that week.
- Palette №3 «Лист, синяя и красная ручка» (`?colors` shows the picker). Light theme only.
- Write «темпа», never «темпы». No ↑↓ arrows. Workout text must not be cramped.
- NOTHING may jump on click: the calendar, the week switch, the fill buttons when switching «2 беговые недели» /
  «До старта». `tests/check.cjs` measures positions — keep it green.
- Fill buttons sit at the bottom of their box; the hint under the count is two lines.
- Plan generator: the «Расскажите о себе и цели» box comes first, 16/500 label in ink, 2px accent border and an accent
  hint under it (`aria-describedby`); it takes the focus with its text selected. Prefilled: «заполни как есть, там
  посмотрим» without a race, «Марафон 6 дек, Valencia, цель 3:20:00.» with one; typing makes it the athlete's
  (owner, 01.11.2026: the first time he pressed «Сгенерировать» without noticing the box).

## Testing

```
npm ci && npx playwright install chromium    # once
npm test                                     # serves the repo itself on 127.0.0.1; 66 checks, exit 1 on failure
```

GitHub Actions (`.github/workflows/check.yml`) runs the same checks on every push and pull request.

Live check on s10.run (read-only): in a browser where the owner is logged in to s10.run, open any s10.run page, block
POSTs and inject the committed file:

```js
const f = window.fetch; window.fetch = (u, o) => { if (o && o.method === 'POST') throw new Error('blocked'); return f(u, o); };
const t = await f('https://raw.githubusercontent.com/strofilov-a/s10-week/<commit>/solo.js').then((r) => r.text());
document.body.innerHTML = ''; const s = document.createElement('script');
s.src = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); document.body.appendChild(s);
```

Never write to the owner's real diary or profile without his explicit yes in the chat.

## Open items


- Live checks done on the owner's account (each restored afterwards, profile byte for byte):
  - 31.10.2026, profile write with the new fields: the server stores the `studentPlans<ID>` string unchanged (`active`,
    `student.layout/volume/t5…t42`, `filled`, `undo`, «», `\`, ё); the page (`dff8104`, then still `week.js`) reads it back (active version,
    layout, «в календаре по…», undo button).
  - 01.11.2026, diary: one task written to an empty future day and shown on the site; `{typtrain:0, task:'', prekm:0}`
    removes the day's row entirely (server: «Удалена задача»); the main race day untouched.
  - 01.11.2026, «Вернуть как было» on the live page (`6826798`): one diary write clearing the day + `patchVersion`;
    afterwards the day is empty and the version has `undo: null`, `filled: null`.
  - 01.11.2026, main race: the start window's payload (`typtrain 6`, `main6: 1`, `prekm '42.2'`) on 17.01.2027 made it
    the main race at once (`task.php?action=main`); the server keeps one main race: Valencia's day got `main6: 0`, its
    text/km/place/forecast intact. No new `planresults` row, `studentMainStart` unchanged. Restoring Valencia with
    `main6: 1` and clearing the test day gave a state identical to the snapshot taken before.
- Race week: with the race on Sunday the plan leaves Thu–Sat as rest (its volume already includes the marathon). Ask the
  owner whether easy runs should replace that.
- Where the site loads `solo.js` from: the S10 server (the developer copies each release) or this repo.
- Ideas: a reminder on the week view when the filled weeks run out; a race-week sanity check; adapting volume to the
  fact; a coach view of athletes' plans; calendar export (ICS); analytics.
