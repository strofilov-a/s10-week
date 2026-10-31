# Checks

`check.cjs` opens the demo in Chromium and goes through the page the way an athlete would: the week view, calendar
clicks, filling two running weeks and the whole plan, saving to the profile, undo, a 20-week build, a server error,
no premium, logged out, own paces, the one-week planner, phone widths. It also measures that nothing moves on clicks.

```
npm i -D playwright && npx playwright install chromium   # once
python3 -m http.server 8766 --bind 127.0.0.1              # in the repo root, keep it running
node tests/check.cjs                                       # PASS/FAIL per check, exit code 1 on any failure
```

`BASE=https://strofilov-a.github.io/s10-week/demo/ node tests/check.cjs` runs the same checks against GitHub Pages.
Nothing is sent anywhere: the demo answers from `demo/fixtures.js`.
