# Live Psalms — interface specification

This document is the contract for the interface refresh. Every screen follows it.
It exists so the product reads as one deliberately designed desktop tool rather
than a collection of dashboard panels.

## 1. Character

Calm, quiet, professional. The operator is on stage in a dark room; the interface
must recede so the projected content is the brightest thing on screen.

- Surfaces are neutral graphite. There are no blue, purple or navy tints.
- One interactive emphasis: light ink (`primary`) on graphite. Buttons are neutral.
- Colour is **state only**: `live` (red), `preview` (steel blue), `success`,
  `warning`. Never use colour to decorate a feature or to make a button prettier.
- No gradients, glows, `backdrop-blur` glass panels, neon borders or shadows on
  flat surfaces. Shadows belong to floating layers (dialogs, menus, sheets).
- Borders are 1px hairlines (`border-border`). Group with borders and spacing, not
  with nested rounded cards.

## 2. Typography

| Use | Class |
| --- | --- |
| Panel title | `text-[12px] font-medium tracking-tight` or `.panel-title` |
| Body / row title | `text-xs font-medium` (12px) |
| Secondary row meta | `text-2xs text-muted-foreground` (11px) |
| Field label | `text-[11px] font-medium text-muted-foreground` (`Label`) |
| Timer / counts | `tabular font-mono` |
| Screen status | `.state-label` (10px semibold uppercase, only for persistent state) |

Rules:

- Sentence case everywhere. Uppercase is reserved for the four program-state
  labels (Preview, Program, Live) and tiny metadata groups in menus.
- No `font-black`, no `tracking-widest` on labels, no 9px text.
- Never use gradient text or drop shadows on type.

## 3. Icons

Icons are exceptional, not decorative.

- Allowed: chevron (expand), `MoreHorizontal` (row overflow), `X` (close),
  `Check` (menu selection), search glyph inside a command field.
- Everything else is a word. "Add", "Remove", "Edit", "Take live", "Clear",
  "Previous", "Next", "Options", "Settings".
- Do not put an icon next to a label that already names the action.
- Icon-only buttons need `aria-label` and a tooltip.

## 4. Layout and density

- 4px rhythm: 4 / 8 / 12 / 16 / 24.
- Toolbars are 36–44px tall (`h-9`, `h-11`).
- Panel headers use `.panel-header` (44px, hairline bottom border).
- Lists are flat rows with `border-t border-border/70` separators. A hovered row
  gets `bg-accent/60`; the selected row gets `bg-accent`.
- Hover-revealed row actions live behind one `MoreHorizontal` menu, not a row of
  coloured buttons.
- Empty states explain the next action in one sentence plus at most one button.

## 5. Components

Use the primitives in `src/components/ui` — do not hand-roll new ones:

`Button` (variant: default | secondary | outline | ghost | destructive | live,
size: xs | sm | default | lg | icon | icon-sm | icon-xs), `Input`, `Textarea`,
`Label`, `Field`, `FieldGroup`, `Select`, `Dialog` + `DialogHeader/Title/
Description/Footer`, `Sheet`, `Tabs` (segmented | underline), `DropdownMenu`,
`Popover`, `Switch`, `Slider`, `Badge`, `Separator`, `Kbd`, `EmptyState`,
`ListHeader`, `cn`.

- Primary action per screen: at most one `variant="default"` or `variant="live"`.
  Everything else is `secondary` or `ghost`.
- Destructive actions are text in an overflow menu, never a red button in a row.
- Dialogs: max width per content, `DialogHeader` with title + one-line
  description, body scrolls, `DialogFooter` with Cancel / primary.
- Selects replace native `<select>`; segmented `Tabs` replace ad-hoc button
  groups for view switching.

## 6. Copy

- Short, literal, operator language: "Service", "Add", "Take live", "Slide
  settings", "Speaker notes".
- No marketing adjectives, no "powerful", "seamless", "AI", no exclamation marks.
- Explain state, not implementation: "Loops behind every slide".
- Buttons use verbs; labels use nouns.

## 7. Known anti-patterns to remove

- Per-feature accent colours (indigo / emerald / amber / sky / purple / rose).
- Dual badges showing the same state (a label above a monitor *and* a badge
  inside it).
- `animate-pulse` on chrome. Motion is for projected content transitions only.
- Tiny chip rows for metadata that could be one muted sentence.
- Emoji in interface copy.
## 8. Projected surfaces

The audience, stage, LED and OBS windows are not operator screens; they are read
in a dark room from a distance.

- Near-black background, white text, hairline dividers. No glass, gradients or
  ambient glows.
- Typography carries everything: the live line is the largest element by a wide
  margin, the reference and translation sit in a quiet header, and secondary
  information (next slide, notes, time) is grouped below a single divider.
- Icons are absent. Labels are words ("Next", "Notes", "Cue", "Time left").
- Colour is reserved for urgency and override: red for overtime or a flashing
  cue, neutral for everything else.
- The stage confidence monitor keeps the same layout in both viewing modes; the
  far mode simply drops the secondary panels and enlarges the live text.
Stage type is set in `vh`, not pixels (`.stage-reference`, `.stage-clock`,
`.stage-cue-text`, `.stage-panel-text` in `src/index.css`), so a 720p monitor and
a 1080p wall both stay readable from the platform without per-device tuning.
Reference text starts at 3.4vh, the timer at 4.2vh, next-slide and notes at 3vh,
with a 1.4-1.8vh floor on labels.
