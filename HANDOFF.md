# Session Handoff

_Last updated: 2026-07-27_

## Where the project stands

All of v1 is built, reviewed, and pushed to https://github.com/yousefalsaqa/FootballRating (branch `main`). Working state: **66 tests green, typecheck + lint clean, app runs in Expo Go**.

Done:
- **Phases 0–6 complete**: scaffold (Expo SDK 57, strict TS, React Compiler), design system (`src/ui`), drizzle/SQLite data layer (migrations 0000 + 0001), scoring engine, all screens (tabs, leaderboard, journalist detail, claims, 4-step wizard), football API layer (api-sports.io with SQLite cache + 100/day budget guard), polish (export/import, filters, icon/splash, haptics).
- **Adversarial review ran** (29-agent workflow): 6 confirmed bugs found and fixed (splash deadlock, leaderboard tier interleaving, HTTP-200 error bodies cached, failures cached as success, import tag-link drops, per-install seed ids). 3 claims refuted.
- **User-requested features shipped**: journalist search (name/outlet/handle) with explainable "Why this score" scorecard (X of Y correct, last 12 months, per-confidence breakdown), and paste-an-X-link lookup via handle matching (on-device only — user explicitly chose this over AI link analysis).

## Next steps (in order)

1. **Phase 7 — release hardening**: needs the user to run `npx eas login` (free Expo account), then `npx eas init`, then set `EXPO_PUBLIC_API_FOOTBALL_KEY` via `eas env:create`. Then preview builds (`eas build --profile preview`) for real-device QA. See RELEASING.md.
2. **Phase 8 — ship**: store metadata/screenshots, publish PRIVACY.md to a public URL, production builds, `eas submit`. Blockers only the user can clear: Apple Developer ($99/yr) and Google Play ($25) accounts.
3. Optional backlog discussed: AI-powered link analysis (rejected for v1 to keep "no data leaves device"), community ratings/backend (deferred from initial planning).

## How to run / test

- `npm start` in the project root; open in **Expo Go** on the same Wi-Fi (server URL form: `exp://<pc-lan-ip>:8081`). PC's Wi-Fi IP last session: 192.168.2.25.
- API key lives in `.env.local` (gitignored), copied from the LaLigaFantasy project's `.env` (`API_FOOTBALL_KEY` → renamed `EXPO_PUBLIC_API_FOOTBALL_KEY`).

## Session conventions (user-set)

- **No duplicate functions/components/constants anywhere** — hard rules in CLAUDE.md; follow them for every change.
- **No Co-Authored-By trailers in commits.**
- User wants to be told as soon as things are testable on their phone.
- Multi-agent supervisor reviews: user opted in; run the adversarial review workflow again after major feature batches (script cached at `.claude/.../workflows/scripts/adversarial-review-*.js`, pattern: finders → dedup → 2 refuters per finding).

## Gotchas for the next session

- Windows machine: no local iOS builds; better-sqlite3 doesn't compile — tests use `@libsql/client` in-memory with the real migrations.
- React Compiler is ON: no `Date.now()` in render (see `ScoringSnapshot.asOf` pattern), Reanimated values use `.get()/.set()`.
- After editing `src/db/schema.ts`: `npm run db:generate`, never hand-edit `src/db/migrations/`.
- The folder name has a space — scaffold-type tools may choke; package name is `journalist-rater`.
