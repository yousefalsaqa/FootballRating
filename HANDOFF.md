# Session Handoff

_Last updated: 2026-07-27 (third session)_

## Third-session changes (all verified live)

- **Broken source links root-caused**: Bing entity-encodes (sometimes doubly) the `&`s in its redirect URLs; one decode pass left `&amp;`, making `searchParams.get('url')` see the key as `amp;url` → unwrap silently failed. Fixed in both `lib/links.ts normalizeSourceUrl` (loops `&amp;`→`&` before parsing — also repairs claims already stored with broken URLs, since ClaimDetail normalizes at press time) and worker `unwrapBingLink`. The deployed worker had also been running stale code — redeployed.
- **Duplicate claims fixed** (user's phone had many): auto-file's dedupe relied only on the persisted dismissed-ids store; if that resets, every wire draft re-files. Now the claims DB is the dedupe authority: `claimStoryKey` (journalist+player+destination+window) in claims/repository; `useIncomingClaims` filters drafts against filed stories (auto-file gated on that filter being loaded); `useDedupeClaims` (mounted in tabs layout) sweeps existing duplicates once per session, preferring resolved copies. Phone-vs-laptop content differing is expected — local-first, no sync.
- **IG post paste**: worker `GET /author?url=<ig post>` reads the post via crawler-UA og: tags (fallback: /embed/ page), returns `{username, name, postedAt, claim}` — caption is run through the same AI extractor, so a "here we go" post comes back as a fileable claim (cached 30d in KV as `author2:<shortcode>`). App: paste an IG post/reel link into front-page search → `usePostLookup` → fuzzy author match (`usernameMatchesJournalist` — IG @fabriziorom ≠ X @fabrizioromano, so prefix/name matching) → auto-jumps to the dossier, or shows a claim card with "File this claim" when the caption reports one. Pasted X/profile links also auto-navigate now.
- **Resolution loosened** (was: everything "unknown"): /resolve evidence now queries both `"player" club` AND `"player" transfer` (finds where the player actually went, enabling "false"), no evidence-age filter, up to 18 titles; prompt asks for a definitive verdict when evidence leans one way, and gets `reportedDaysAgo`. Client gates: min age 24h→3h, recheck 12h→6h. New **"Check outcomes now" button** (Reports → Pending) sweeps ALL pending claims in batches of 5, ignoring gates, with a summary line. Verified live: Tonali→true, stale Barcola-to-Spurs→false, day-old developing stories→unknown.
- Search on the front page verified working headlessly (name filter, IG paste, file-claim, outcomes button) via puppeteer-core + system Edge against the exported dist (serve with the `/FootballRating` baseUrl prefix stripped).

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
