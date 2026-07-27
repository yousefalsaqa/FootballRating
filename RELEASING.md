# Releasing

All builds run on EAS cloud (this machine is Windows; iOS cannot build locally).

## One-time setup

1. Create an Expo account and run `npx eas login`.
2. `npx eas init` — links the project (writes `extra.eas.projectId` + `updates.url` into app.json).
3. Set the API key for cloud builds: `npx eas env:create --name EXPO_PUBLIC_API_FOOTBALL_KEY --scope project` (same value as `.env.local`).
4. Apple: enroll in the Apple Developer Program ($99/yr). Google: Play Console account ($25 once).

## Build & test

- `npx eas build --profile preview --platform android` → installable APK for any Android device.
- `npx eas build --profile preview --platform ios` → TestFlight-able build (needs Apple account).
- Local dev stays on `npm start` + Expo Go.

## Ship

1. `npm run typecheck && npm run lint && npm test` must be green.
2. `npx expo-doctor` must pass.
3. `npx eas build --profile production --platform all`
4. `npx eas submit --platform ios` / `npx eas submit --platform android`
5. Tag: `git tag v1.x.y && git push --tags`

## Updates after launch

- **JS-only changes** (screens, logic, styling): `npx eas update --channel production` — ships over-the-air, no store review.
- **Native changes** (new native package, SDK upgrade, app.json plugins/icons): require a new store build + submission.

## Store notes

- Apple privacy label: **Data Not Collected** (everything stays on-device; API calls send only search text).
- Google Play Data Safety: no data collected or shared.
- A public privacy-policy URL is required by both stores — publish `PRIVACY.md` (e.g. GitHub Pages) and paste the URL into both consoles.
