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

`kazan.cjs` checks the Kazan marathon mode: on the demo (`?kazan`) the plan, its parser, the goal, the volume and the
long runs; on the release build at `/solo/kazan` (a stand-in of the API that keeps what is written) the soft entry, the
main-race question, the versions, the browser keys and the logged-out block. `REACT=1` (in `npm run react`) runs its
release part on `<SoloKazan />` from `react-src/`, plus unmount and remount.

`journey.cjs` walks one person's whole way on the release build, for S10 Solo and for Kazan, on a computer and a phone:
the promo page → its first button → the login (a stand-in) → the plan without Premium («Оформить Premium») → `/money` →
`/pay/` → «Оплатить Premium» in rubles → the bank (a stand-in that turns Premium on) → the plan again →
«Заполнить календарь» → a later visit. Every request to s10.run is answered from the demo snapshot, no host name
resolves (nothing can reach a real site), and `/money` goes to `/pay/` as the install package plans it.

