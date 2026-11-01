# Checks

`check.cjs` opens the demo in Chromium and goes through the page the way an athlete would: the week view, calendar
clicks, filling two running weeks and the whole plan, saving to the profile, undo, a 20-week build, a server error,
no premium, logged out, own paces, the one-week planner, phone widths. It also measures that nothing moves on clicks.

```
npm ci && npx playwright install chromium   # once
npm test                                    # demo checks, then npm run build and the release checks
```

`npm test` serves the repo root itself on a free port of 127.0.0.1 and stops it at the end; no second terminal needed.
`BASE=https://strofilov-a.github.io/s10-week/demo/ npm test` runs the same checks against GitHub Pages.
Nothing is sent anywhere: the demo answers from `demo/fixtures.js`.

GitHub Actions (`.github/workflows/check.yml`) runs the same checks on every push and pull request.

`release.cjs` runs the production build (`release/`, no demo) at `/solo/plan` with the site's endpoints answered from the
demo snapshot: the new athlete's path to «Заполнить календарь», with every write recorded.
