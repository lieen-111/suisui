# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (PWA beta, live) + native iOS 17+ (source written, not yet built)

## Stack

Web: static HTML, CSS, JavaScript, Anime.js 4.5.0, Lucide; installable PWA with offline cache.
Native: SwiftUI, WidgetKit, ActivityKit, App Intents; XcodeGen project; GitHub Actions build and TestFlight upload. Shared JSON backup format between the two.

## Users

Confirmed: the requester uses an iPhone and wants a product for multiple supported iPhone models.

## Product Purpose

See pending tasks when the phone screen lights up. Complete a task with a satisfying shattering animation and see the remaining tasks.

## Capabilities and Constraints

- Add, edit, group, complete, restore, and delete tasks; daily repeat; history of finished items; import and export backups.
- Distribution without the App Store: web link (PWA) now; TestFlight public link for the native app (paid developer membership).
- User specifically requests a task to explode into fragments when completed.
- Completed items remain visible in the prototype card with a middle strike-through and half opacity. Completion animates this state and is reversible.
- The prototype card scrolls vertically through all tasks while its heading and footer remain fixed. Pending tasks come first with pinned tasks prioritized; completed tasks move to the end in completion order. Completion preserves scroll position, and restore returns an item to the pending group.
- Confirmed personalization: user can independently adjust checklist material, color, and transparency.
- User wants access to all tasks. The full list must be available in the app; a bounded lock-screen simulation must not suggest unlimited native lock-screen space.
- Native target proposed in this conversation: iOS 17 and later; not yet built or device-tested.
- Browser animation demonstrates intended feedback, not guaranteed native Live Activity behavior.
- Browser local storage is local to a device/browser and provides no cross-device sync.
- Web lock-screen presence is a notification refreshed when leaving the app; it cannot be checked off from the notification (iOS web notifications have no action buttons).
- Native lock-screen checking requires an authenticated device; Live Activities run 8 hours (restarted on app open or by a daily Shortcuts automation); Live Activity pages instead of scrolling.
- No Apple account, provisioning profile, native build environment, or device connection has been provided.

## Brand Commitments

Follow the user's supplied reference: wallpaper, prominent clock, translucent lock-screen checklist. Product name is undecided; "碎碎清单" is a provisional prototype name.

## Evidence on Hand

User screenshot of Xiaohongshu lock-screen to-do results, including PinLists and grouped task cards. Seed tasks are fictional editable examples.

## Product Principles

- Completing a task should be immediately visible and reversible.
- Keep the whole list accessible.
- Respect reduced motion.
- Separate browser demonstrations from native capabilities.
