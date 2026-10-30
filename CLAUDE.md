# Continue This Project

Read `先读我-最新交接.md` FIRST. It overrides historical notes. The public site is https://zingy-semifreddo-b3230a.netlify.app/ (the user uploads `app/` themselves). As of 2026-10-30 (1.0):

- The web app is a usable beta (import/export, daily rollover, repeat, history, lock-screen notification, install guidance). A web app CANNOT put checkable to-dos on the iOS Lock Screen; that is an Apple platform limit.
- The user asked to pursue the real goal. `ios/` holds a complete native SwiftUI + WidgetKit + ActivityKit + App Intents project (lock-screen widgets, Live Activity, direct checking). 2026-10-29: it COMPILES on GitHub Actions (Intel macOS runner) for simulator and device, and the 9 unit tests pass; the sideload IPA workflow succeeds. It has NOT run on a physical iPhone yet, so lock-screen behavior is unverified. Repo: github.com/lieen-111/suisui.
- Android (`android/`, added 2026-10-29): Kotlin shell that bundles `app/` in a WebView (WebViewAssetLoader, `SuiSuiAndroid` JS bridge) plus a native lock-screen notification card with per-task "✓" actions (`LockCard.kt`, `TodoStore.kt` mirrors the rollover/complete rules). Built by `.github/workflows/android-apk.yml` on ubuntu, signed with a private key from secrets `ANDROID_KEYSTORE_B64`/`ANDROID_KEYSTORE_PASSWORD` when set, else the committed TEST key `android/keystore/suisui-test.jks` (the proxy blocks writing secrets; the user adds them in the GitHub web UI), published to Releases; phone link: https://github.com/lieen-111/suisui/releases/latest/download/suisui.apk . First build succeeded; not yet tested on a device. `scripts/verify-android-bridge.cjs` simulates the bridge in Chromium.
- Distribution without the App Store = TestFlight (paid Apple Developer Program, no Mac required, GitHub Actions workflows provided). See `ios/README.md` and `落地路线.md`.

Read `README.md`, `HANDOFF.md`, `PRODUCT.md`, and `DESIGN.md` before changing behavior. The user communicates in Chinese. Work in the existing project, preserve unrelated changes, and implement requested changes through verification.

## What This Is

Two deliverables sharing one data format:

1. `app/`: static, Chinese-language PWA beta. Works in the browser and from the Home Screen; the in-app lock screen is a preview.
2. `ios/`: native iOS 17+ source (XcodeGen). Not yet built. No provisioning, Apple account or physical-device test has been supplied.

The PWA has Home Screen metadata, PNG icons, offline shell caching and opt-in updates. It remains a web app with a simulated lock screen preview; its real lock-screen presence is the optional notification. See PWA-iPhone-使用说明.md. HTTPS is needed on phones; an HTTP LAN preview does not test offline installation. A temporary tunnel URL is not permanent hosting and its origin must remain stable to retain access to that origin's local data.

## Start

- Windows: `START-WINDOWS.cmd`, includes portable Windows x64 Node.
- Any OS with Node 20+: `npm start`.
- All web dependencies are local; the app works without downloading an animation/icon library.
- Server defaults to port 8793 and tries the next port if occupied. Do not stop unrelated processes to reclaim a port.

## Source Map

- `app/index.html`: list-first task workspace, settings (mini live preview, themes, groups, privacy). The full lock card only renders in lock mode (`?mode=lock`, used by the Android LockActivity); there is no fake phone chrome.
- `app/styles.css`: responsive layout and all visual states.
- `app/app.js`: local state (schema 2), storage, task actions, sorting, animation, rollover, import/export, lock-screen notification, install banner. `window.suisui` exposes read-only helpers for tests.
- `app/manifest.webmanifest`, `app/pwa.js`, `app/sw.js`, `app/icons/`: PWA installation and offline support. Increment the worker VERSION on every cached-resource change. Keep waiting-worker activation opt-in and preserve localStorage.
- `app/vendor/anime.umd.min.js`: Anime.js 4.5.0.
- `app/vendor/lucide.min.js`: Lucide icons.
- `app/assets/lake.jpg`: local wallpaper with source record and metadata.
- `scripts/server.cjs`: dependency-free local server.
- `scripts/verify.cjs`: broad behavior verification.
- `scripts/verify-completion.cjs`: completion sorting, scrolling, animation, restore tests.
- `scripts/verify-pwa.cjs`: starts an isolated server, tests offline reload and completion, data persistence, update lifecycle, cache replacement, icons and mobile overflow. No public server needed.
- `scripts/verify-v1.cjs`: 1.0 review fixes: list-first phone layout (no fake phone chrome), dates/later/overdue, weekdays/weekly repeats, custom groups, theme presets, rapid completion, lock-screen privacy.
- `app/privacy.html`: privacy policy (linked from settings and About).
- `scripts/verify-beta.cjs`: import merge/replace/undo, backup round trip, new-day rollover (Playwright clock), daily repeat, history, iPhone install banner, notification content/refresh (permission stubbed), schema-1 upgrade.
- `scripts/check-swift-syntax.py`: tree-sitter syntax check of `ios/` (no Xcode needed; not a type check).
- `ios/Shared/`: model (`Models.swift`), rules (`TodoLogic.swift`, mirrors app.js), App Group storage (`TodoRepository.swift`), Live Activity payload + controller (`TodayActivity.swift`), card view (`CardView.swift`), App Intents (`Intents.swift`). Compiled into app, widget extension and tests.
- `ios/App/`: SwiftUI app, `TodoModel` (all mutations go through `TodoRepository.mutate`), shatter effect, Siri/Shortcuts.
- `ios/Widgets/Widgets.swift`: lock-screen widget, home widget, Live Activity + Dynamic Island.
- `.github/workflows/ios-build.yml` (unsigned simulator build + unit tests), `ios-sideload-ipa.yml` (device IPA with ad-hoc embedded entitlements for free-Apple-ID sideloading) and `ios-testflight.yml` (signed upload, secrets documented inside).
- `.impeccable/design.json`: extracted design metadata, not executable app state.

## Confirmed Requirements

1. Product should support multiple eligible iPhone models; do not design only for one test phone.
2. The web app is a usable beta; the native app targets iOS 17+ (interactive widgets and Live Activity intents) and is written but unverified.
3. Complete a task with visible text-shard animation, then a centered strike-through and half opacity.
4. Pending items always precede completed items. Pending pinned items come first. Completed items append in completion order, including completed pinned items.
5. Completing a task again after restoring it appends it to the end again.
6. Completed rows remain in the card and restore on click.
7. Card scrolls internally through all items while its heading/footer stay fixed. Keep scroll position on completion.
8. Material, background color and transparency are independently configurable. Also support text tone, wallpaper, accent and motion settings.
9. Respect reduced motion; keep final completion state even when animation is disabled.
10. Maintain undo, editing, grouping, pinning, JSON export and local persistence.
11. JSON import (merge or replace, undoable). Web and native read each other's backups (`app`, `version: 2`, `tasks`, `archive`, `settings`; key `repeat`).
12. New day: daily items reset to pending; finished one-offs completed before today move to history when auto-archive is on (default). Records without `day` count as today.
13. Native lock screen: rows are App Intent buttons; Live Activity pages instead of scrolling; no custom animation there. Keep the Live Activity payload under 4 KB (titles cut to 40 chars, one page only).

## Implementation Notes

- Storage key: `suisui-locktodo-v1` (kept for existing users); record carries `schema: 2` and `day`.
- `completedAt` is loaded, saved and used to order completed rows. Existing records without this field default to zero. Restore returns to the pending group. Recompletion assigns a new monotonic timestamp.
- Lock-card order is pending-before-done, then pinned-first for pending or ascending completion timestamp for done.
- Completed state is `.is-done`, semantic `<s>`, opacity `.5`, and an accessible restore button.
- The card remains 160px high. Comfortable viewport is 90px / three rows; compact is 96px / four 24px rows. All rows remain in DOM.
- Anime.js v4 API: `anime.animate(target, options)`, `ease`, not v3 `anime({ targets })`.
- Maintain `preventScroll` for focus after completion and preserve the scroll container's scrollTop.
- All user content must be escaped. Avoid writing raw task text into HTML.
- Imported image is limited to supported image types and 3 MB.
- Automatic text color compares light/dark text contrast to base RGB, not the actual wallpaper blend. Manual text tone remains useful at high transparency.
- Do not replace the photographic wallpaper with generic decorative graphics.

## Verify

Start the server before `npm test`, `npm run test:completion` and `npm run test:beta` (`test:pwa` starts its own). Point tests to a different port with `LOCKTODO_URL`. Windows defaults to Edge; elsewhere use installed Playwright Chromium or set `PLAYWRIGHT_CHANNEL`.

Screenshots and tests here are browser evidence, not physical-iPhone, Safari or native Live Activity verification. Do not claim those checks passed.

## Native Work

Builds and unit tests pass in CI; not yet device-tested. arm64 hosted macOS runners queued indefinitely on 2026-10-29, so workflows default to `macos-26-intel` (override with repo variable `MAC_RUNNER`). Artifact downloads are blocked from the Claude sandbox; the user downloads IPAs from the Actions page. Lock-screen buttons need an unlocked (authenticated) device; Live Activities last 8 hours; widgets/Live Activities cannot run the shatter animation. Change `BASE_BUNDLE_ID` in `ios/project.yml` (or the `BUNDLE_ID` repo variable) before signing.

## Handoff Limits

No user browser profile, credentials, or localStorage snapshot is bundled. Do not assume the copied folder contains the user's current personal tasks or settings. No deployment, subscription, developer enrollment, TestFlight or App Store submission, or paid service has been authorized; the user does all account steps.
