---
name: s10-live-check
description: How to check solo.js on the real s10.run (read-only injection with POSTs blocked) and what has already been verified live on the owner's account. Use before any live check or write on s10.run.
---

# Live checks on s10.run

Never write to the owner's real diary or profile without his explicit yes in the chat. Back up first (snapshot the
values you will touch), restore afterwards, and compare with the snapshot.

## Read-only check

In a browser where the owner is logged in to s10.run, open any s10.run page, block POSTs and inject the committed file
(`solo.js` for the source with its demo mode, `release/t5/solo/solo.js` for the build the developer gets):

```js
const f = window.fetch; window.fetch = (u, o) => { if (o && o.method === 'POST') throw new Error('blocked'); return f(u, o); };
const t = await f('https://raw.githubusercontent.com/strofilov-a/s10-week/<commit>/solo.js').then((r) => r.text());
document.body.innerHTML = ''; const s = document.createElement('script');
s.src = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); document.body.appendChild(s);
```

To see the page as a new athlete on live data, also answer `task.php?action=main`, `studentMainStart`,
`planresults.php` and `/student?` from the patched `fetch` with empty results. Clean the `s10week.*` localStorage keys
afterwards.

## Verified live on the owner's account (each restored afterwards, profile byte for byte)

- 31.10.2026, profile write with the new fields: the server stores the `studentPlans<ID>` string unchanged (`active`,
  `student.layout/volume/t5…t42`, `filled`, `undo`, «», `\`, ё); the page (`dff8104`, then still `week.js`) reads it
  back (active version, layout, «в календаре по…», undo button).
- 01.11.2026, diary: one task written to an empty future day and shown on the site; `{typtrain:0, task:'', prekm:0}`
  removes the day's row entirely (server: «Удалена задача»); the main race day untouched.
- 01.11.2026, «Вернуть как было» on the live page (`6826798`): one diary write clearing the day + `patchVersion`;
  afterwards the day is empty and the version has `undo: null`, `filled: null`.
- 01.11.2026, main race: the start window's payload (`typtrain 6`, `main6: 1`, `prekm '42.2'`) on 17.01.2027 made it
  the main race at once (`task.php?action=main`); the server keeps one main race: Valencia's day got `main6: 0`, its
  text/km/place/forecast intact. No new `planresults` row, `studentMainStart` unchanged. Restoring Valencia with
  `main6: 1` and clearing the test day gave a state identical to the snapshot taken before.
- 01.11.2026, the calc4 generator from the page (`generate.php`, 10 km, 8 weeks, a new athlete's prompt): answered in
  ~28 s in the same format as the demo's saved answer; parsed into 8 weeks, paces turned into numbers.
- 01.11.2026, the release build (`release/`, `cab3757`) read-only on live data: no demo, Telegram link, no errors.
