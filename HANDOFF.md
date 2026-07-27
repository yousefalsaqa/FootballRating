# Session Handoff

_Last updated: 2026-07-27 (third session)_

## Third-session changes (all verified live)

- **Broken source links root-caused**: Bing entity-encodes (sometimes doubly) the `&`s in its redirect URLs; one decode pass left `&amp;`, making `searchParams.get('url')` see the key as `amp;url` → unwrap silently failed. Fixed in both `lib/links.ts normalizeSourceUrl` (loops `&amp;`→`&` before parsing — also repairs claims already stored with broken URLs, since ClaimDetail normalizes at press time) and worker `unwrapBingLink`. The deployed worker had also been running stale code — redeployed.
- **Duplicate claims fixed** (user's phone had many): auto-file's dedupe relied only on the persisted dismissed-ids store; if that resets, every wire draft re-files. Now the claims DB is the dedupe authority: `claimStoryKey` (journalist+player+destination+window) in claims/repository; `useIncomingClaims` filters drafts against filed stories (auto-file gated on that filter being loaded); `useDedupeClaims` (mounted in tabs layout) sweeps existing duplicates once per session, preferring resolved copies. Phone-vs-laptop content differing is expected — local-first, no sync.
- **IG post paste**: worker `GET /author?url=<ig post>` reads the post via crawler-UA og: tags (fallback: /embed/ page), returns `{username, name, postedAt, claim}` — caption is run through the same AI extractor, so a "here we go" post comes back as a fileable claim (cached 30d in KV as `author2:<shortcode>`). App: paste an IG post/reel link into front-page search → `usePostLookup` → fuzzy author match (`usernameMatchesJournalist` — IG @fabriziorom ≠ X @fabrizioromano, so prefix/name matching) → auto-jumps to the dossier, or shows a claim card with "File this claim" when the caption reports one. Pasted X/profile links also auto-navigate now.
- **Resolution loosened** (was: everything "unknown"): /resolve evidence now queries both `"player" club` AND `"player" transfer` (finds where the player actually went, enabling "false"), no evidence-age filter, up to 18 titles; prompt asks for a definitive verdict when evidence leans one way, and gets `reportedDaysAgo`. Client gates: min age 24h→3h, recheck 12h→6h. New **"Check outcomes now" button** (Reports → Pending) sweeps ALL pending claims in batches of 5, ignoring gates, with a summary line. Verified live: Tonali→true, stale Barcola-to-Spurs→false, day-old developing stories→unknown.
- Search on the front page verified working headlessly (name filter, IG paste, file-claim, outcomes button) via puppeteer-core + system Edge against the exported dist (serve with the `/FootballRating` baseUrl prefix stripped).
- **Cross-device sync (shared ledger)**: worker `GET/PUT /ledger` stores ONE snapshot in KV (`ledger:data`); the first passcode to PUT claims the ledger (`ledger:keyhash` = sha1) and every call must send it as `x-ledger-key`. App: Desk → "Sync across devices" — set the same passcode on each device; `settings/sync.ts syncLedger` runs pull → `importSnapshot` (now also propagates resolutions onto same-id pending claims) → `deleteDuplicateClaims` → push (skipped when a djb2 hash says nothing changed — KV free tier is 1000 writes/day, cron cursor already uses 288). Background cycle every 10 min via `useLedgerSync` (tabs layout); manual "Sync now" button. Union semantics: resolved beats pending, **deletions do not propagate**. Verified end-to-end with two isolated headless browser profiles converging to identical records. To reset a forgotten passcode: `npx wrangler kv key delete --namespace-id=a44d4381af1e4d018c75569217fb1841 --remote "ledger:keyhash"` (and `ledger:data` to wipe).
- Source links now open in a new tab on web (`lib/open-url.ts openExternal`), system browser/app on native.

## Editor/reader model (fourth pass, same day — THE current architecture)

- **The ledger is THE record; the site is a newspaper.** `GET /ledger` is public (no key) — every visitor mirrors it read-only on launch/focus/90s heartbeat. `PUT /ledger` needs the passcode (`x-ledger-key`; first writer claims it, sha1 in KV `ledger:keyhash`). A GET *with* a key validates it (staff sign-in check → `verifyLedgerKey`).
- **Editor mode** = passcode stored (`useEditorMode`, settings/hooks). Only the user's phone + laptop sign in (Desk tab is a "Staff only" sign-in door otherwise). Readers: no Desk content, no resolve/reopen/delete buttons, no Incoming tab, no quick-resolve, no add-journalist; wire polling and auto-file/auto-resolve are editor-only. Reset a forgotten passcode by deleting KV `ledger:keyhash`.
- **Reactive sync**: `lib/sync-signal.ts` — every claim mutation requests a debounced (2s) sync; AppState 'active' and a 90s heartbeat also fire cycles. Pushes remain hash-gated (KV write budget), pulls are cheap reads.
- **Reopen sticks**: `claims.reopenedAt` column. reopenClaim stamps it; auto-resolve/sweep skip reopened claims; importSnapshot same-id merge applies whichever side acted last (`max(resolvedAt, reopenedAt)`) — newer verdict overwrites, newer reopen un-resolves; dedupe also prefers latest editorial action. Manual re-resolve clears reopenedAt.
- **Verdict receipts**: `claims.resolutionNote` + `resolutionSourceUrl` (migrations 0002/0003). Worker /resolve returns `{reason, evidenceTitle, evidenceUrl}` (evidence now has per-item `daysAgo`, sorted newest-first; prompt weights recent coverage — fix for "actually true but ruled false"). Claim page shows "Why this verdict" + "Read the coverage that decided it →". Reopening clears the receipt.
- **Reader submissions**: `POST /submit` (public) — the extraction model vets the report; roster-matched + extractable → normal wire draft (auto-files); otherwise `needsReview: true` (auto-file skips; editor approves in Incoming, which maps missing journalistId by name). The wizard becomes "Submit for review" for readers; the IG-post claim card becomes "Submit this report".
- Back button: `HeaderBack` in root stack layout — always rendered; falls back to `router.replace('/')` when the stack is empty (refresh/deep-link).
- Headless reader validation script: scratchpad readertest.mjs pattern (public ledger → claim/<id> deep link).

## Fifth pass (same day): content + correctness

- **Deletions propagate**: `claims.deletedAt` tombstone (migration 0004). deleteClaim soft-deletes; every list/count/scoring query filters `isNull(deletedAt)`; getClaim hides tombstones; wire filedKeys INCLUDE tombstones (deleted stories never re-file); same-id sync merge applies the newest of verdict/reopen/deletion. Dedupe hard-delete is fine (deterministic on synced data, converges through push cycles).
- **Story identity normalized**: `claimStoryKey` now surname-based + accent/punctuation-insensitive ("Summerville"≡"Crysencio Summerville", "Al Hilal"≡"Al-Hilal", "Vinicius Jr"≡"Vinícius Júnior") — fixes duplicate stories per journalist.
- **Roster is 23** (added Balagué, Galetti, Konur, Longari, Longo, Tanzi, Ben Ayad, Percy — real reporters, real handles; Bechler rejected: zero coverage). Seed top-up is by fixed id, reaches existing installs. **SEED_CLAIMS_V4**: 41 real claims backfilled from a curated two-week Google News sweep (feeds fetched per reporter; Bing rate-limited local IPs — use `news.google.com/rss/search?q="<name>" transfer when:16d` with curl, NOT node fetch which gets an empty shell).
- **Resolver correctness**: extraction + /submit reject descriptive player names ("ex-Arsenal forward" — `isDescriptivePlayerName`); RESOLUTION_PROMPT now judges what the journalist ASSERTED — negative/hedged claims ("move unlikely") are true when the move dies; evidence items carry `daysAgo`, newest-first.
- **Ledger surgery done via wrangler KV** (pull `ledger:data`, patch JSON, put back): tombstoned test/garbage claims, reopened 12 wrong-or-premature false/true verdicts (reopened = permanently manual by design). CAUTION: stale clients strip unknown snapshot fields on push — patch the ledger only after the matching app bundle is deployed, and verify the patch survives a few minutes later.
- Front-page strip fixed for phones: no wrapping — action button (`File a claim`/`Submit`) never shrinks, middle links ellipsize; `Close ✕` uses a non-breaking space.
- The editor passcode is NOT in the code: user-chosen at first sign-in, stored per-device in kv `sync.passcode`, server holds only sha1 in KV `ledger:keyhash`. To change: sign out everywhere → delete `ledger:keyhash` → first sign-in claims the new passcode.

## What this is now

**THE TRANSFER LEDGER** — a football-newspaper-styled journalist reliability tracker with a fully automatic claim pipeline. Live web app: https://yousefalsaqa.github.io/FootballRating/ · Repo: https://github.com/yousefalsaqa/FootballRating (`main`, public). State: **74 tests green, typecheck + lint clean, web deploy verified via headless-browser screenshots.**

Two deployables:
1. **The app** (Expo SDK 57, React Native + web). Runs in Expo Go *only when Expo Go supports SDK 57* — the store version lagged, which is why the web deploy exists (see "Expo Go saga" below).
2. **The ingest worker** (`worker/`, Cloudflare Worker at `https://journalist-rater-ingest.yousefalsaqa.workers.dev`) — user's Cloudflare account (wrangler is logged in on this machine), KV namespace `a44d4381af1e4d018c75569217fb1841`, cron `*/5 * * * *`. **Runs entirely on free tier** (user explicitly refuses paid services — no Claude API, though the code auto-upgrades to Claude if `ANTHROPIC_API_KEY` secret is ever set).

## The pipeline (all free, all verified working)

- Worker cron: every 5 min, ONE journalist (KV cursor rotation — free-tier CPU can't sweep all 15) → Bing News RSS (`format=rss`; **Google News 503s Cloudflare IPs**, don't switch back; **do not add `qft=sortbydate` — it breaks the RSS**) → parse ≤120 items → unseen items <48h old → **Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`** extracts structured claims (the 3.1-8b model is deprecated; AI responses may be objects, not strings — coerced in `runModelWith`) → drafts in KV (72h TTL), deduped by journalist+player+destination. Bing redirect links are unwrapped to real article URLs (worker-side for new, `lib/links.ts normalizeSourceUrl` client-side for old).
- App polls `GET /claims` every 5 min → **auto-file** (default ON, Desk toggle) inserts drafts as pending claims; **auto-resolve** (default ON) POSTs ≤5 pending claims (>24h old, rechecked every 12h, tracked in kv `resolve.checkedAt`) to `POST /resolve` → worker searches coverage, AI rules `true|partial|false|unknown`; only conclusive verdicts are recorded. Model is deliberately conservative — user may ask to loosen it.
- Debug endpoints: `GET /debug` (feed status, AI check, KV counts), `GET /run` (manual cycle). Journalist roster shared app↔worker via `src/db/seed-journalists.json` (15 journalists, fixed `seed-*` ids).

## Design (user-supplied detailed brief — keep to it)

Newspaper system: Playfair Display 900 masthead, Barlow Condensed headlines/ranks/scores, Source Serif 4 body, Inter metadata; paper `#F1ECDF` / ink `#151411` palette in `ui/tokens.ts`; radii ≤5px; rules (`Divider weight=thin|medium|strong`) instead of cards; square monogram avatars (no circles); verdict stamps VERIFIED TRUE / PARTIALLY CONFIRMED / REPORT DISPROVED / DEVELOPING STORY; front page = edition bar → masthead → WHO ACTUALLY KNOWS? → lead story → 2nd/3rd → continuous Reliability Table (`X–Y–Z · A of B resolved`); `/methodology` page documents the real formula. Known gap: desktop still uses mobile composition (user hasn't pushed on it).

## Data integrity rules (user cares a lot)

- **Never invent claims.** v1 fake demo claims caused a complaint; they're purged by the v2 seeder (`V1_FAKE_HEADLINES`). Seeds must be real, sourced (claims carry `sourceUrl`), attributable reports. Current seeds: the 2026 summer window set incl. resolved Tonali→Spurs (Romano), Jiménez→Bournemouth (Di Marzio), Summerville→Al-Hilal (Ornstein), Brown→Bayern (Plettenberg).
- Ratings are always derived (scoring engine), never stored. Resolved-vs-filed distinction matters to the user — rows show both.
- Instagram/Snap/X profile links resolve journalists by handle; IG *post* links can't (no author in URL) — UI explains this.

## Next steps

1. **Watch auto-resolve quality** over a few days; loosen `RESOLUTION_PROMPT` if too timid (user wants ~80% auto-resolution).
2. **Phase 7 — TestFlight/EAS**: needs `npx eas login`, `eas init`, EAS env vars (`EXPO_PUBLIC_API_FOOTBALL_KEY`, `EXPO_PUBLIC_INGEST_URL`), Apple Developer $99 (user knows). See RELEASING.md.
3. Possible asks on deck: desktop multi-column layout, real journalist portraits, attribution accuracy of extracted drafts (aggregator headlines sometimes credit the wrong reporter).

## How to run / deploy

- Dev: `npm start` (+ Expo Go if SDK matches). Web deploy: `npm run deploy:web` (export + git-based gh-pages push with `.nojekyll`; the gh-pages npm package is NOT used — it silently dropped `assets/node_modules` fonts). Worker deploy: `cd worker && npx wrangler deploy`.
- `.env.local` (gitignored): `EXPO_PUBLIC_API_FOOTBALL_KEY` (from LaLigaFantasy), `EXPO_PUBLIC_INGEST_URL`.

## Gotchas (hard-won)

- Expo Go saga: user's iPhone Expo Go rejected both SDK 57 and a temporary SDK 56 downgrade ("out of date", no store update available — likely device-capped). Downgrade was reverted; **web is the primary test surface** until TestFlight.
- sql.js web driver: `db.query.findFirst` returns a truthy husk on empty tables — use `select().limit(1)` (see `seed.ts hasFlag`). Web DB = sql.js + IndexedDB persist loop (`db/client.web.ts`); native = expo-sqlite; platform-split via `.web.ts` files (`db/client`, `db/migrate`, `lib/kv`).
- React Compiler: no `Date.now()` in render (queryFn `asOf` pattern / lazy `useState`); no setState-in-effect sync; Reanimated `.get()/.set()`.
- Typed routes: `.expo/types/router.d.ts` regenerates only on `expo start` — after adding a route, stale types fail typecheck (delete the file or start once).
- Repo tests: in-memory libsql + committed migrations (better-sqlite3 won't build here). 74 tests must stay green: `npm run typecheck && npx expo lint && npm test` before commits.
- User prefs: no duplication (CLAUDE.md hard rules), no commit trailers, tell them promptly when something is testable, free-tier only, plain non-jargon explanations.
