---
name: 碎碎清单
description: Photographic lock-screen tasks beside a quiet white workspace.
colors:
  accent: "#13765b"
  accent-soft: "#e9f3ee"
  rose: "#b14c6b"
  rose-soft: "#f9edf1"
  blue: "#226a9a"
  blue-soft: "#eaf2f8"
  ink: "#222c28"
  muted: "#626f68"
  line: "#e7ece8"
  surface: "#f5f7f5"
  white: "#fff"
  canvas: "#fafbfa"
  preview: "#eef2ee"
  card-base: "#112b24"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "84px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "0"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0"
  title:
    fontSize: "19px"
    fontWeight: 650
    letterSpacing: "0"
  body:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  label:
    fontSize: "12px"
    fontWeight: 550
    letterSpacing: "0"
  meta:
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0"
rounded:
  label: "4px"
  control: "5px"
  icon: "6px"
  container: "8px"
  activity: "18px"
  phone: "32px"
  circle: "50%"
spacing:
  tight: "8px"
  control: "12px"
  form: "14px"
  inset: "16px"
  mobile: "22px"
  section: "28px"
  desktop: "44px"
  header: "46px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    typography: "{typography.label}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.icon}"
    padding: "9px 14px"
    height: "40px"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.icon}"
    size: "40px"
  input-task:
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "13px 14px 10px"
  nav-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.container}"
    width: "62px"
  filter-selected:
    textColor: "{colors.accent}"
    padding: "0 1px 14px"
  task-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  activity-card:
    textColor: "#f4fbf7"
    rounded: "{rounded.activity}"
    padding: "10px 12px 0"
    height: "160px"
  segmented:
    backgroundColor: "#edf1ee"
    rounded: "{rounded.icon}"
    padding: "3px"
  toast:
    backgroundColor: "#233b30"
    textColor: "{colors.white}"
    rounded: "{rounded.container}"
    padding: "9px 10px 9px 18px"
---

# Design System: 碎碎清单

## Overview

**Creative North Star: "Photo, Clock, Checklist"**

The implemented prototype follows the user's lock-screen reference: a real photograph, a prominent clock, and a translucent checklist. A quiet white task workspace makes the full list editable beside that preview on larger screens. The name remains provisional.

The interface is compact and practical. System Chinese typography, restrained green actions, rose life labels, fine dividers, and small icon controls support repeated task work. Completing an item breaks the task into fragments, then moves its crossed-out, half-opacity record to the end of the card list. This document records the web prototype in `outputs/locktodo`; it does not specify a built native iOS interface.

**Key Characteristics:**

- Photographic wallpaper with a large white clock.
- Translucent task box with independently adjustable material, color, transparency, and text tone.
- Light workspace with restrained color and fine dividers.
- Compact task rows with visible completion, edit, and pin controls.
- Reversible completion with optional shattering feedback.

## Colors

The default palette combines pine green actions, muted green neutrals, and rose life labels. Frontmatter values are the normative extracted palette.

### Primary

- **Pine Green** (`accent`): default actions, selected navigation, active filter underline, focus outline, work markers, and completion controls.
- **Pine Wash** (`accent-soft`): default selected navigation and completion hover fill.

### Secondary

- **Berry Rose** (`rose`) and **Berry Wash** (`rose-soft`): selectable accent pair; the life group marker retains Berry Rose.
- **Lake Blue** (`blue`) and **Lake Wash** (`blue-soft`): selectable accent pair.

### Neutral

- **Workspace Ink** (`ink`): main task and heading text.
- **Quiet Text** (`muted`): secondary copy, metadata, and inactive controls.
- **Divider** (`line`): row separators, panel borders, and filter track.
- **Soft Surface** (`surface`): icon hover surface.
- **White** (`white`): primary button text and active segmented surface.
- **Canvas** (`canvas`): application page background.
- **Preview Ground** (`preview`): desktop preview surround.
- **Checklist Pine** (`card-base`): default independently configurable checklist color.

**The Independent Appearance Rule.** Changing the application accent must not change the checklist material, base color, transparency, or text mode. These are separate settings in the implementation.

The sidecar's tonal strips are synthesized preview aids. They are not additional application tokens.

## Typography

The shared font stack uses Apple system fonts, Segoe UI, PingFang SC, Microsoft YaHei, and sans-serif fallbacks. There is no imported display font or separate monospace family.

- **Display:** the clock uses tabular numerals. Its desktop role is defined in frontmatter; mobile uses 86px, small screens below 350px use 76px, and short mobile screens use 66px.
- **Headline:** section headings use the frontmatter headline role; tablet uses 24px and mobile uses 26px.
- **Title:** the desktop wordmark uses the title role; mobile uses 17px.
- **Body:** task titles use the body role and wrap long content. Secondary copy uses 13px with the same 1.65 line height.
- **Label:** primary actions and settings controls use compact text. Desktop navigation uses 11px; mobile navigation uses 10px.
- **Metadata:** task group labels and preview support text use the meta role.

All elements set letter spacing to zero. The lock-screen task title is a single line with ellipsis; full task rows wrap.

## Layout

The desktop shell has an 88px navigation rail and a flexible workspace, capped at 1600px. A 92px header sits above two columns: the editor has a 360px minimum, and the preview has a 380px minimum. Editor padding is 45px vertically at the top and 44px horizontally. At 1400px and above, horizontal editor padding becomes 65px.

Between 761px and 1100px, the rail becomes 72px and editor padding becomes 32px by 25px. The content columns reduce to 320px and 310px minimums.

At 760px and below, navigation becomes a fixed bottom bar with safe-area padding, the header becomes 64px, and only the selected task, preview, or settings view is shown. The preview opens initially. Editor padding becomes 28px by 22px. At 350px and below, horizontal editor padding becomes 15px.

The desktop phone preview is at most 370px wide with a 370:720 aspect ratio. Mobile preview fills the available width, removes the phone frame radius, and uses viewport-relative height with a 400px minimum. Its clock and activity placement tighten on screens at most 700px tall.

The lock-screen activity has fixed height. Comfortable mode shows three rows per viewport; compact mode shows four. Its inner list scrolls all tasks, including retained completed rows, while the heading and footer remain fixed. Wheel, touch, and keyboard scrolling are supported, with vertical scroll containment. Pending tasks come first, and newly completed tasks append to the end in completion order. Scroll position stays stable on completion. This is browser-prototype behavior, not a verified native Live Activity capability.

## Elevation & Depth

The editor uses flat surfaces and dividers. Depth is concentrated in the photographic preview, translucent checklist, selected segmented control, temporary toast, and modal. A dark wallpaper gradient preserves the white clock's legibility.

The activity applies a configurable background alpha and backdrop filter. Runtime defaults are frosted material, Checklist Pine, 15% transparency, and automatic text tone. Frosted uses blur 24px and saturation .85; glass uses blur 7px and saturation 1.4; flat uses blur 0px and saturation 1. Transparency ranges from 0% to 90%, with alpha calculated as one minus the transparency fraction.

The phone preview uses `0 18px 38px -20px #152f2c66`; the active segmented control uses `0 1px 3px #183b2520`; the toast uses `0 8px 28px #152e2730`; the dialog uses `0 20px 60px #16302430`. These exact values also live in the sidecar.

## Shapes

Controls use small softened corners. The radius scale in frontmatter maps labels, inputs, icon controls, forms, toast, dialog, lock-screen activity, and the desktop phone frame. Completion marks and color swatches are circular. Task rows remain unframed and are separated by a single bottom divider.

The rounded phone silhouette belongs to the desktop preview. Mobile preview is edge to edge. The task box retains its activity radius in both layouts.

## Components

### Buttons

Primary buttons are compact green actions with white text, a small inline icon, and 32px minimum height. Secondary buttons use a fine border and 40px minimum height. Icon buttons are 40px square with a soft hover surface; task-row icons use smaller 30px-wide controls. Controls have a 3px accent focus outline with 4px offset, and disabled buttons reduce opacity to .5. General button hover reduces brightness to .95.

### Inputs / Fields

The new-task form uses a pale green surface, a fine border, and a leading plus icon. Focus within changes the form border to the accent. Its text field remains transparent and has no independent outline. Editing uses a bordered full-width field, group selector, and save, cancel, and delete commands. Task text is limited to 120 characters. Error copy is red and associated with the relevant form.

### Navigation

The desktop rail stacks icons above short labels; the selected destination uses accent text on a pale accent surface. Mobile navigation is fixed along the bottom with three destinations. Its active state uses accent color without the filled desktop tile. Filter tabs use a bottom underline, count, and optional group dot; they do not use filled pills.

### Task Rows

Pending rows expose a circular completion target, wrapping title, group metadata, pin, and edit actions. Pinned items sort before other pending items. Completed rows use struck-through text at .5 opacity plus restore and delete controls, inside a completed section that opens after completion. Restore and delete controls retain their opacity. Empty states replace the list body when appropriate.

### Lock-Screen Activity

The task box has a heading, completion count, fixed-height scrollable list, and full-list footer. Comfortable rows are 30px high at 12px type; compact rows are 24px high at 11px type. Long titles truncate only in this preview. Completed rows appear after all pending rows in completion order, use semantic struck-through text and .5 opacity, and restore to the pending group when clicked again. The list is keyboard-focusable and has a thin theme-colored scrollbar.

Material, base color, transparency, and text mode are independently configurable and update the preview immediately. The five color presets supplement a free color input. Text modes are auto, light, and dark. Auto compares the WCAG contrast ratios of the implemented light and dark text colors against the chosen base color and selects the higher-contrast option; it does not sample the photograph or its blend through transparency. Explicit text modes allow manual adjustment for unusual wallpapers, particularly at high transparency. Text, muted text, divider, and completion-circle colors change together.

### Beta Additions (2026-10-29)

- **Install banner:** pale accent surface, fine accent-tinted border, plus-square icon, compact primary action and dismiss icon. Shown only on iPhone Safari before installation (or when the browser offers an install prompt). On mobile preview it floats over the wallpaper top with a translucent white surface.
- **Settings notes:** 11px muted helper copy under each switch; settings groups ordered 锁屏提醒 → 每日整理 → 数据与备份 → appearance.
- **History:** a second disclosure under 已完成, rows struck through at .5 opacity with a muted archive icon, tabular date and a restore control.
- **Repeat flag:** task metadata shows a small repeat icon with 每天, styled like the pin flag.
- **Dialogs:** install steps use numbered accent-wash circles; import uses a summary paragraph, optional settings switch, and right-aligned secondary/primary actions.
- **Native card:** `ios/Shared/CardView.swift` reproduces the activity card tokens (card ink, muted, rule, check) from the same contrast rule. The Lock Screen material is supplied by iOS; base color and transparency tint it.

### Appearance Controls

Segmented controls select density and material. A white selected segment uses accent text and a small shadow. Color choices are circular swatches with a visible selection outline. Transparency uses a range from 0 to 90; text tone uses a select. Wallpaper choices are image thumbnails with an active outline, plus a photo-upload control. The animation toggle disables the intensity range when turned off.

### Completion Feedback

The current implementation divides a completed task into 60 triangular shards carrying matching text slices. Anime.js animates translation, rotation, shrinking, and fade. Motion strength has three levels. After shattering, the completed row moves to the end with a line drawn over 420ms and opacity settling to .5 over 460ms. Remaining rows move into place over 370ms; the preview retains its scroll position. Reduced-motion preference or the disabled animation setting skips shattering and strike motion; the final struck-through half-opacity state remains visible.

The toast exposes undo for completion and deletion and remains for eight seconds when undo is available. Other messages remain for 4.5 seconds. A brief completion note appears below the task box.

## Do's and Don'ts

### Do:

- **Do** preserve the photographic wallpaper, prominent clock, and translucent checklist reference.
- **Do** keep the complete editable task list accessible from the bounded preview.
- **Do** keep material, color, transparency, and text mode independent.
- **Do** retain visible focus treatments and reduced-motion behavior.
- **Do** keep completed tasks reversible through undo or restore.

### Don't:

- **Don't** replace the photograph with an abstract decorative background.
- **Don't** turn the task workspace into a marketing hero or a stack of decorative cards.
- **Don't** imply that the browser preview installs or modifies a native iPhone lock screen.
- **Don't** truncate the full editable task title just because preview rows truncate.
- **Don't** infer wallpaper-aware text contrast from the automatic base-color calculation.
