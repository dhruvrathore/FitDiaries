# FitDiaries

A personal gym workout tracker (Expo / React Native, TypeScript). All data lives
**on your device** — no accounts, no server, fully offline.

## What it does

- **Log fast in the gym.** Pick a day template (Back / Chest / Leg / Arms / Leg 2 / Hyrox)
  and a phase (Strength / Hypertrophy / Endurance / Deload). It pre-loads that day's
  exercises + warm-up/cool-down; you tap in weight × reps per set. Add/remove/swap
  exercises on the fly.
- **Rotation aware.** The Today screen suggests the next day in your standard rotation,
  but you can pick any day when you switch it up.
- **Warm-up / cool-down checklist.** Tick items off; timed holds (e.g. the glute-bridge
  10s hold) show an inline countdown that auto-ticks when done.
- **Rest timer.** Auto-starts after each set from your default rest, plays a sound when it
  ends, and has +30 / +60 / +90s extend plus pause/skip.
- **Progressive overload.** Each exercise shows last session's sets, and flags **three PR
  types** — heaviest weight, best estimated 1RM (Epley), and most reps at a weight.
- **Progress.** Weekly volume trend, volume by muscle group, per-exercise progression, and
  a PR log.
- **Weekly photos.** A Monday-morning notification nudges you to add a progress photo;
  browse them week by week.
- **Backup & restore.** Export all data to a JSON file (share sheet) and import it on any
  device — Settings → Backup & restore. Progress-photo image files aren't embedded, only
  their references.

## Run it

```bash
npm install          # already done
npx expo start       # scan the QR with Expo Go, or press i / a
```

Camera and local notifications work in Expo Go; for the most reliable notifications use a
dev build (`npx expo run:ios` / `run:android` on a machine with the native toolchain).

## Tests & checks

```bash
npm test             # jest — metrics + week/deload logic
npx tsc --noEmit     # typecheck
```

## Layout

```
app/                       expo-router screens
  (tabs)/                  Today, History, Progress, Photos, Settings
  workout/new.tsx          start a session (template + phase)
  workout/[id].tsx         active session (sets, timers, PR badges)
  session/[id].tsx         read-only session detail
  exercises.tsx            manage exercises + muscle mapping
src/
  db/                      Drizzle schema, client, seed, queries, reactive useQuery
  lib/                     metrics (volume/1RM/PRs), week/deload math, progress, photos, notifications
  components/              UI kit, charts, timers, number field, pickers
  theme/                   colors, spacing, typography, phases
drizzle/                   generated SQLite migrations (bundled into the app)
```

## Editing the data model

Schema is in `src/db/schema.ts`. After changing it, regenerate the migration:

```bash
npm run db:generate
```

The seed (`src/db/seed.ts`) populates templates, exercises, the muscle map, and warm-up/
cool-down items on first launch; everything is editable in-app afterwards.

## TODO: shrink the APK (deferred)

The release APK is currently **~133 MB**. It's almost entirely native libraries built for four CPU
architectures, most of which a given phone never uses (a OnePlus 7 Pro / Snapdragon 855 is
`arm64-v8a` only):

| Section | Uncompressed |
|---|---|
| lib/x86 | 29.5 MB |
| lib/x86_64 | 28.8 MB |
| lib/arm64-v8a | 27.3 MB |
| lib/armeabi-v7a | 18.7 MB |
| assets (JS bundle + rest sound) | 4.5 MB |
| res | 2.3 MB |

Native libs are ~78% of the APK, so the size win comes almost entirely from dropping unused
architectures — **not** from code minification.

### Primary lever — build only for `arm64-v8a` (~133 MB → ~45–55 MB)

Controlled by the Gradle property `reactNativeArchitectures`, already present in
`android/gradle.properties` (default `armeabi-v7a,arm64-v8a,x86,x86_64`).

- **Quick one-off build:**
  ```bash
  cd android
  ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
  adb install -r app/build/outputs/apk/release/app-release.apk
  ```
- **Persistent** (survives `expo prebuild`): add a tiny local config plugin using
  `withGradleProperties` from `@expo/config-plugins` to set
  `reactNativeArchitectures=arm64-v8a`, and reference it from `app.json` → `plugins`.
  (`expo-build-properties` does **not** expose ABI filters, so this can't go through it.)
- If wider device support is ever needed instead of arm64-only, use **per-ABI splits** (a separate,
  smaller APK per architecture) rather than a single universal APK.

Trade-off: an arm64-only APK won't run on 32-bit-only phones or x86 emulators — fine for sideloading
to a modern personal phone.

### Secondary lever — R8 minify + resource shrink (~5–15 MB more; not enabled)

`android/app/build.gradle` already reads `android.enableProguardInReleaseBuilds` and
`android.enableShrinkResourcesInReleaseBuilds`. To turn these on persistently, install
`expo-build-properties` and add to `app.json` → `plugins`:

```json
["expo-build-properties", { "android": {
  "enableProguardInReleaseBuilds": true,
  "enableShrinkResourcesInReleaseBuilds": true
} }]
```

Deferred for now (small risk: R8 can strip reflection-used code). If enabled, smoke-test every screen
afterward, and add keep-rules via `extraProguardRules` if anything breaks. Hermes/JS (incl. Drizzle)
is unaffected by R8.
