# Journalist Rater

Football journalist reliability tracker. Log transfer claims, resolve them (true / partial / false), and journalists earn weighted reliability scores and tiers. Local-first (SQLite on device, no backend). React Native + Expo, ships to iOS + Android via EAS.

## Commands

- `npm run typecheck` / `npm run lint` / `npm test` — must all pass before any commit
- `npm start` — Expo dev server (test in Expo Go)
- `npm run db:generate` — regenerate drizzle migrations after editing `src/db/schema.ts` (never edit `src/db/migrations/` by hand)

## Architecture (where everything goes)

- `src/app/` — expo-router routes. **Thin re-exports only**; screens live in features.
- `src/features/<name>/` — one folder per domain: `repository.ts` (all DB queries), `hooks.ts` (TanStack Query wrappers), `components/`, `screens/`, `store.ts` (zustand, only for non-derived client state).
- `src/features/scoring/` — pure TS, no RN imports. The ONLY place scores are computed.
- `src/db/` — drizzle schema (single source of truth for types), client singleton, migrations, seed.
- `src/ui/` — design system: `tokens.ts` (every color/size/font), `theme.tsx`, shared components.
- `src/lib/` — cross-cutting utilities: query client + `queryKeys` factory, formatting, dates, ids.

## Hard rules (no duplication — user mandate)

1. Never write a function/component/constant that already exists — search first.
2. All DB access via a feature's `repository.ts`. No inline queries in hooks/components.
3. All score math in `features/scoring/engine.ts`. Screens never compute scores.
4. All visual values from `ui/tokens.ts` via `useTheme()`. No hard-coded colors/sizes.
5. Query keys only from `lib/query-client.ts` `queryKeys`. Claim mutations must invalidate `scores` too.
6. Cross-feature imports only from a feature's public surface: `hooks.ts` or `components/index.ts` — never repositories/stores/screens of another feature.
7. Text rendering only through `ui/components/Text` variants — no ad-hoc font sizes.

## Gotchas

- React Compiler is enabled: render must be pure. No `Date.now()`/`Math.random()` in render — capture time in queryFns (see `ScoringSnapshot.asOf`), event handlers, or lazy `useState` initializers. Reanimated shared values use `.get()`/`.set()`.
- Repository tests run against real SQL: in-memory libsql with the committed migrations (`src/db/__tests__`). better-sqlite3 does not build on this machine — use `@libsql/client`.
- expo-sqlite's kv-store (`Storage`) is used for lightweight prefs; the drizzle DB for domain data. Don't add AsyncStorage.
- Windows machine: iOS builds happen on EAS cloud, never locally.
