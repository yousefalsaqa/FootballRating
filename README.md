# Journalist Rater

Track football journalists' transfer claims and find out who's actually reliable.

Log a claim ("Romano: Wirtz to Liverpool — here we go"), resolve it when the window shuts (came true / partially / false), and every journalist earns a 0–100 reliability score and an S–D tier. Wrong "here we go"s hurt three times more than wrong speculative links; old form fades with an 18-month half-life; small samples are smoothed so a lucky 2-for-2 can't outrank a proven 45-for-50.

- **Local-first** — everything lives in SQLite on your device; no account, no tracking
- **Real football data** — player/club autocomplete and transfer verification via api-sports.io, with a strict 100-requests/day budget guard and offline fallback
- **iOS + Android** from one Expo codebase

## Development

```bash
npm install
npm start          # Expo dev server — scan the QR with Expo Go
npm test           # scoring engine, repositories (real SQL), API cache/budget
npm run typecheck  # strict TS
npm run lint
```

Put your api-sports.io key in `.env.local`:

```
EXPO_PUBLIC_API_FOOTBALL_KEY=...
```

Architecture and contribution rules live in [CLAUDE.md](CLAUDE.md). Release process lives in [RELEASING.md](RELEASING.md).
