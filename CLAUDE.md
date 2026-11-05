# Continue This Project

Read `先读我-最新交接.md` FIRST. It overrides historical notes. The public site is https://zingy-semifreddo-b3230a.netlify.app/ (the user uploads `app/` themselves). As of 2026-11-05 (1.16.1: running timer pill on the lock card was white-on-white on light-text cards; now solid `--card-check` with `--card-on-check` text (set in app.js next to `--card-check`), checked by a contrast test in verify-v116; 1.16: backup state on 数据 (`settings.lastBackup`, `firstUse`, `backupNudged`; toast with 备份 after 14 days without a backup, at most weekly); add sheet: untouched default chips get `.is-default` (light), changed choices dark; idle timer pill is an outline; 外观 split into App / 锁屏卡片 tabs (`.look-section[data-look]`, `data-tab` on the page; tests see both unless the context passes `{ lookTabs: true }`, which sets no `SUISUI_LOOK_ALL`), 动效 switch moved to the App tab and now means all motion; one selected style (ring) on 外观; 分组 rows open one at a time into an editor (`editingGroup`); motion.js `capture()` called from render() makes rows glide (FLIP) and counts bump, details open/close with height; every Lucide icon used has its own animation (checked by `scripts/verify-v116.cjs`); pwa.js only shows the update prompt when an older version controls the page; 1.15: `app/motion.js` motion layer — every tappable presses in with a spring (CSS `scale`, `--press` by size; finger travel cancels), the tapped control's Lucide icon plays an icon-specific animation (gear turns, + rotates, bell rings, bin shakes, arrows nudge), newly selected chips/radios pop, sheets/toasts/tiles spring in; off with `html[data-motion=off]` (from settings.motion) or reduced motion; settings home redesigned = mini lock screen preview (clock + cards) + 2×2 tiles (外观/锁屏/分组/语言) + short list (数据/关于), new class `.settings-home` so legacy `.settings-index` rules no longer apply, one icon column; settings view no longer reserves 104px at the bottom; 1.14: smaller lock type, remaining line right under the cards, ✓/+ removed, Android settings previews draw the grouped lock view (`miniGroups()`); 1.13: new logo “极光玻璃” (frosted glass tile + check on a cyan→blue→violet gradient), sources in `design/logo/`; 1.12: group `icon` (Lucide line icon, `GROUP_ICONS`) replaces emoji on lock cards; lock view keeps the 今天的待办 heading, remaining/done footer and swipe hint; layout A (cards right under the clock) chosen by the user; 1.11: Android lock view = one frosted card per group (`lockGroups()`, subtasks `.lock-sub`, ✓/+ buttons, lunar date), group icon, cute fonts in `app/fonts-cute.css` loaded on demand, glass background pre-blurred in canvas (`glassWall()`); the 1.10 home-card change was reverted — the user wanted the lock screen, not the app home; 1.9: three interface styles `settings.uiStyle` glass/paper/night in `app/looks.css` + generated `app/night.css` (`python3 scripts/build-night-css.py` after editing dark rules), lock-card styles no longer change the app colour, stacked add rows again, settings home = wallpaper preview + grouped list, English UI via `app/i18n.js` (settings.lang; native Lang.kt / L.t follow it), Geist font bundled, `scripts/verify-v19.cjs`; 1.8: phone UI redesign — no tab bar (search/review/settings in the top bar via `placeChrome()`, floating add button, 完成 in settings), add sheet = input + 5-tool toolbar opening one option row, edit sheet = one line per setting opening its chips, rows show group as ring colour; tests use `openPanel`/`toTasks` from `scripts/test-environment.cjs`; 1.7: default palette is 墨黑 (neutral greys, accent ramp vars `--a-*` set from app.js; green/orange/indigo/berry selectable, old green settings migrate via `palette2`), repeat tag + lock-card ↻ + 「重复」 filter, date/time picker chips over native inputs, `scripts/verify-v17.cjs`; 1.6: the iPhone app shows the SAME web UI as Android — `ios/App/WebShell.swift` hosts the bundled `app/` in a WKWebView with the `SuiSuiIOS` bridge, native keeps widgets/Live Activity/Lock Screen intents, and native writes patch the stored JSON so web-only fields survive (`ios/Shared/RawJSON.swift`); reminders at a set time on web/Android/iPhone, drag to reorder, notes + subtasks, search, Android home-screen widget; 1.4: no sample tasks on first run, task durations with start/pause/stop countdown, weekly/monthly review with a 1080px poster export; 1.2: swipe right/left to complete/delete with haptics, dark mode, gesture tips; 1.1: bottom-bar add button + add/edit sheets, settings split into pages, Android shows the phone's own wallpaper behind previews and the lock view):

- The web app is a usable beta (import/export, daily rollover, repeat, history, lock-screen notification, install guidance). A web app CANNOT put checkable to-dos on the iOS Lock Screen; that is an Apple platform limit.
- The user asked to pursue the real goal. `ios/` holds a complete native SwiftUI + WidgetKit + ActivityKit + App Intents project (lock-screen widgets, Live Activity, direct checking). 2026-10-29: it COMPILES on GitHub Actions (Intel macOS runner) for simulator and device, and the 9 unit tests pass; the sideload IPA workflow succeeds. It has NOT run on a physical iPhone yet, so lock-screen behavior is unverified. Repo: github.com/lieen-111/suisui.
- Android (`android/`, added 2026-10-29): Kotlin shell that bundles `app/` in a WebView (WebViewAssetLoader, `SuiSuiAndroid` JS bridge) plus a native lock-screen notification card with per-task "✓" actions (`LockCard.kt`, `TodoStore.kt` mirrors the rollover/complete rules). Built by `.github/workflows/android-apk.yml` on ubuntu, signed with a private key from secrets `ANDROID_KEYSTORE_B64`/`ANDROID_KEYSTORE_PASSWORD` when set, else the committed TEST key `android/keystore/suisui-test.jks` (the proxy blocks writing secrets; the user adds them in the GitHub web UI), published to Releases; phone link: https://github.com/lieen-111/suisui/releases/latest/download/suisui.apk . First build succeeded; not yet tested on a device. `scripts/verify-android-bridge.cjs` simulates the bridge in Chromium.
- Distribution without the App Store = TestFlight (paid Apple Developer Program, no Mac required, GitHub Actions workflows provided). See `ios/README.md` and `落地路线.md`.

Read `README.md`, `HANDOFF.md`, `PRODUCT.md`, and `DESIGN.md` before changing behavior. The user communicates in Chinese. Work in the existing project, preserve unrelated changes, and implement requested changes through verification.

## What This Is

Two deliverables sharing one data format:

1. `app/`: static, Chinese-language PWA beta. Works in the browser and from the Home Screen; the in-app lock screen is a preview.
2. `ios/`: iOS 17+ shell (XcodeGen) around the same `app/` UI plus native widgets, Live Activity, App Intents and notifications. Built in CI; no physical-device test has been supplied.

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
- `scripts/verify-v2.cjs`: 1.4 empty first run, durations + timer, completion log, weekly/monthly review, poster. Tests get the six sample tasks via `window.SUISUI_DEMO`, injected by `scripts/test-environment.cjs`.
- `scripts/verify-v1.cjs`: 1.1 edit sheet / back button / phone-wallpaper hole, plus 1.0 review fixes: list-first phone layout (no fake phone chrome), dates/later/overdue, weekdays/weekly repeats, custom groups, theme presets, rapid completion, lock-screen privacy.
- `app/privacy.html`: privacy policy (linked from settings and About).
- `scripts/verify-ios-bridge.cjs`: runs the bridge script taken from `ios/App/WebShell.swift` in Chromium (boot from stored file, rev refusal, Lock Screen tick, Live Activity settings, timer, export).
- `scripts/verify-beta.cjs`: import merge/replace/undo, backup round trip, new-day rollover (Playwright clock), daily repeat, history, iPhone install banner, notification content/refresh (permission stubbed), schema-1 upgrade.
- `scripts/check-swift-syntax.py`: tree-sitter syntax check of `ios/` (no Xcode needed; not a type check).
- `ios/Shared/`: model (`Models.swift`), rules (`TodoLogic.swift`, mirrors app.js), App Group storage (`TodoRepository.swift`), Live Activity payload + controller (`TodayActivity.swift`), card view (`CardView.swift`), App Intents (`Intents.swift`). Compiled into app, widget extension and tests.
- `ios/App/`: `WebShell.swift` (WKWebView, `suisuiapp://` scheme handler serving the bundled `app/`, bridge), `SuiSuiApp.swift` (notification actions, Siri/Shortcuts). `ios/Shared/RawJSON.swift` + `TodoRepository.apply` patch only changed values into the stored JSON; `Reminders.swift` schedules local notifications.
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

Builds and unit tests pass in CI; not yet device-tested. arm64 hosted macOS runners queued indefinitely on 2026-10-29, workflows defaulted to `macos-26-intel`; on 2026-11-04 that type stopped being picked up ("not acquired by Runner of type hosted"), so the default became `macos-15`; on 2026-11-05 macos-15 (arm64) stopped being acquired and `macos-26-intel` worked again, so the default is back to `macos-26-intel` — run runner-check.yml to see which type starts (override with repo variable `MAC_RUNNER`). Artifact downloads are blocked from the Claude sandbox; the user downloads IPAs from the Actions page. Lock-screen buttons need an unlocked (authenticated) device; Live Activities last 8 hours; widgets/Live Activities cannot run the shatter animation. Change `BASE_BUNDLE_ID` in `ios/project.yml` (or the `BUNDLE_ID` repo variable) before signing.

## Handoff Limits

No user browser profile, credentials, or localStorage snapshot is bundled. Do not assume the copied folder contains the user's current personal tasks or settings. No deployment, subscription, developer enrollment, TestFlight or App Store submission, or paid service has been authorized; the user does all account steps.
