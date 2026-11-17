# Scene architecture

Status: proposal, following an audit of the current codebase. Nothing in this
document is implemented yet beyond the transport spike described at the end.

## 1. Audit of the current application

### Stack and shape

- Electron 32 (main process in `electron/main.cjs`), React 18 + TypeScript,
  Vite 5, Tailwind 3.4 with shadcn-style tokens.
- The renderer is a single React app (`src/App.tsx`, ~2300 lines) that owns all
  service state: songs, media, themes, playlist, live slide, countdown,
  emergency state, settings.
- Output windows are separate browser windows that load the same bundle with
  `?output=audience|stage|led|obs` and rehydrate state over a broadcast bus.

### Output management today

- `BroadcastService` (`src/services/broadcast.ts`, 650 lines) wraps a
  `BroadcastChannel` plus an Electron IPC bridge and a localStorage mirror. Its
  message types are fine-grained deltas: `LIVE_SLIDE_CHANGE`,
  `THEME_CHANGE`, `COUNTDOWN_TICK`, `LOWER_THIRD_TRIGGER`, `EMERGENCY_STATE_CHANGE`, …
- `electron/main.cjs` creates `audienceWindow`, `stageWindow`, `ledWindow`,
  positions them fullscreen on a display chosen by `resolveTargetDisplay()`, and
  exposes display/IPC plumbing.
- Each output is a bespoke component: `AudienceOutputWindow` (771 lines),
  `StageDisplayWindow` (346), `LedWallOutputWindow`, `ObsOutputWindow`. They
  interpret the same delta messages independently.

### Rendering today

- Slides are rendered twice, in two different technologies:
  - DOM/React inside `CenterWorkspace.SlideCanvas` for the operator preview and
    program monitor (container-query font sizing).
  - DOM/React again in `AudienceOutputWindow` for the projected output, with
    `useAutoFitFontSize`.
- There is no element model: a slide is text plus a background. Themes carry
  typography, scrim and colour. Lower thirds and tickers are single overlays
  with fixed markup, not composable elements.
- `SlideDesignerModal` (440 lines) edits `customElements` on a slide but is a
  text/shape list editor, not a canvas editor, and is not used by outputs.

### Streaming pipeline

Two implementations exist in the tree right now:

1. **Display capture** (the one that shipped until this week): `start-stream`
   in `electron/main.cjs` spawns ffmpeg with `gdigrab`/`x11grab`, captures the
   display holding the audience window, scales/pads to the chosen resolution and
   encodes CBR H.264 to RTMP.
2. **Scene capture spike** (uncommitted prototype): a 1920×1080 canvas is
   composed in the renderer, `canvas.captureStream(fps)` feeds a `MediaRecorder`,
   and WebM chunks are written to ffmpeg's stdin (`-f webm -i pipe:0`) for a CBR
   H.264 re-encode. Verified end-to-end to a local FLV; scene text fitting is
   still rough.

### Persistence and media

- `StorageService` (~1780 lines) persists app state to localStorage under
  `live_psalms_*` keys: playlist, songs, themes, settings, custom Bibles, quick
  pins, countdown titles.
- `MediaVaultService` stores large binary media in IndexedDB and hydrates URLs
  at startup; `MediaAsset` describes images, video, audio, logos and PDFs.
- There is no scene document, no versioning and no migration layer.

### Constraints this imposes

- State lives in one React tree; outputs are read-only replicas driven by
  deltas. A scene engine has to become a second source of truth and must not
  fight the existing slide bus.
- The DOM renderer (preview) and the canvas renderer (stream) already diverge;
  a scene system has to choose one authoritative renderer per surface.
- Output windows are cheap to add (same bundle, query param) but the bus is
  message-per-field, which will not scale to element-level edits.
- The streaming path is proven twice; scene streaming must reuse the spike's
  transport rather than inventing a third.

## 2. Target architecture

### 2.1 Scene document (versioned)

```
SceneDocument {
  version: 2
  id, name, description, thumbnail?
  canvas: { width, height, background: BackgroundLayer }
  elements: SceneElement[]        // z-ordered
  transition: { type, durationMs, easing }
  createdAt, updatedAt
}

SceneElement {
  id, type, name
  frame: { x, y, width, height, rotation, opacity }
  visible, locked, zIndex
  animations: { enter, exit, delayMs, durationMs, easing }
  type-specific properties:
    text        → content | binding, font, size, weight, colour, align,
                  lineHeight, letterSpacing, shadow, outline, padding, radius
    image/logo  → assetId | url, fit, crop, radius, shadow
    video       → assetId, loop, muted, fit
    shape       → kind (rect|rounded|circle|line|svg), fill, stroke
    capture     → source (display|window|device), fit, crop
    presentation→ source ('live'|'preview'), fit, crop, showBackground
    lowerThird  → templateId, content bindings
    clock/timer → format, mode (clock|countdown|stopwatch), target
    web         → url (opt-in, sandboxed)
}
```

Backgrounds are an element type as well (`solid`, `gradient`, `image`, `video`)
so the model has one compositing rule: paint elements in `zIndex` order over the
canvas.

### 2.2 Engine vs renderers

- **SceneEngine** (`src/scene/engine.ts`): owns `scenes`, `activeSceneId`,
  `previewSceneId`, live lower-third layer, bindings and transitions. Pure state
  + commands (`activate`, `cut`, `fade`, `updateElement`, `reorder`). No DOM.
- **Canvas compositor** (`src/scene/render.ts`): draws a scene document onto a
  2D canvas at output resolution. One draw function per element type, a cached
  background, and offscreen canvases for static text blocks so a clock or a
  camera does not force a full repaint.
- **Editor surface**: a React DOM overlay on top of the canvas preview for
  selection, handles, guides and snapping. The canvas is the renderer; the DOM
  supplies interaction only (no second visual implementation).
- **Preview vs live**: two scene instances of the same renderer. The monitor
  named *Programme* shows live; the *Broadcast* monitor shows preview. `Go live`
  swaps `previewSceneId → activeSceneId` with the chosen transition; the
  operator can compose preview without touching output.

### 2.3 Outputs

- `OutputConfiguration { id, name, type, resolution, fps, assignedSceneId,
  enabled }` stored with the scene library.
- Each output window (audience, stage, stream, preview) subscribes to the engine
  state via a single `SCENE_STATE` broadcast message (replacing per-field deltas
  for scene-driven surfaces). Existing slide deltas stay for the legacy
  audience/stage layouts until those are ported.
- The **stage** output keeps its own layout (lyrics + notes) and is treated as a
  special output renderer, not a scene, so we do not regress it.

### 2.4 Lower thirds

- A lower third is an element (`type: 'lowerThird'`) holding a `templateId` plus
  content. Templates are scene fragments (element arrays) with placeholder
  bindings, so the same editor and renderer draw them.
- Bindings: `{{speaker}}`, `{{slideTitle}}`, `{{scriptureRef}}`, `{{event}}`,
  `{{custom:text}}`. The engine resolves bindings at draw time from app state.
- The overlay layer is independent of the scene background, so it can sit over
  presentation, video, capture or a solid background and be shown/hidden with
  its own in/out animation (`LOWER_THIRD_SHOW/HIDE` command).

### 2.5 Capture as an element

- `capture` elements wrap `navigator.mediaDevices.getDisplayMedia` (display or
  window) or `getUserMedia` (camera) and draw the `HTMLVideoElement` into the
  composited canvas, with fit/crop. That preserves today's pixel capture as a
  source while allowing it to be scaled, cropped and layered.
- Presentation content is **not** taken from pixels: a `presentation` element
  draws the live slide through the same canvas text renderer, so lower thirds
  can be populated from real fields (`title`, `subtitle`, `bibleMeta`).
- Both modes coexist: full-screen capture (Mode A), lower-third from native
  content (Mode B), picture-in-picture (Mode C), and arbitrary composition
  (Mode D).

### 2.6 Streaming

- Keep the spike's transport: composited canvas → `captureStream` →
  `MediaRecorder` (VP8) → IPC chunks → ffmpeg stdin → CBR H.264 FLV.
- Display capture remains available as a scene element and as a fallback
  `mode: 'display'` in `start-stream`.
- Stream output renders the **live** scene, never preview, and is independent of
  the audience output.

### 2.7 Persistence

- `SceneDocument` JSON in localStorage under `live_psalms_scenes_v1`, with a
  version field and a migration function per version.
- Thumbnails: rendered to a 320×180 canvas and stored as a data URL (updated on
  save, not continuously).
- Media references point at `MediaAsset`/`MediaVault` ids, so blobs stay in
  IndexedDB.

## 3. Reuse, modify, replace

| Area | Decision |
| --- | --- |
| `BroadcastService` bus | **Reuse**, add `SCENE_STATE` / `SCENE_COMMAND` messages; keep existing delta messages for legacy outputs. |
| Output window creation (`main.cjs`) | **Reuse** as-is; add a `stream`/`preview` output if needed later. |
| `AudienceOutputWindow` renderer | **Keep** for the current audience layout in Phase 2; **port** to scene renderer in Phase 4–5 once parity is proven. |
| `StageDisplayWindow` | **Keep**, out of scope for scenes. |
| `SlideCanvas` / `useAutoFitFontSize` | **Extract** the text-fitting rules into the scene text renderer so canvas output matches the DOM preview. |
| `StorageService` | **Modify**: add scene document load/save/migrate alongside existing keys; no schema break for existing state. |
| `MediaVaultService` / `MediaAsset` | **Reuse** unchanged as the asset library behind image/video elements. |
| `LowerThirdTrigger` overlays | **Replace** with the scene lower-third element in Phase 4, keeping the existing trigger as a compatibility shim. |
| Display capture streaming | **Keep** as fallback; **replace** the default path with scene streaming. |
| `StreamingModal` | **Modify**: becomes the stream output settings (scene selection, quality, audio, destination). |
| `CenterWorkspace` monitors | **Modify**: Programme = live scene, Broadcast = preview scene; editor opens from here. |
| `SlideDesignerModal` | **Supersede** by the scene editor; keep until element parity exists, then remove. |
| Scene spike (`BroadcastScene.tsx`, `broadcastScene.ts`) | **Replace** the layout model; **reuse** the canvas drawing helpers and the WebM transport. |

## 4. Phases and verification

**Phase 2 — Scene engine**
Deliverables: `SceneDocument` types, store with create/duplicate/rename/reorder/
delete, JSON persistence + migration, canvas renderer for background + text +
image, live/preview state, Programme/Broadcast monitors driven by the engine.
Verify: reload restores scenes; duplicate/delete/reorder survive restart; a
scene renders identically at 720p and 1080p; `tsc` and a production build pass.

**Phase 3 — Editor**
Deliverables: canvas editor with selection, drag, resize, rotate, snap, guides,
keyboard nudges, layer list (lock/hide/duplicate), property panels, undo/redo,
zoom/fit.
Verify: edit → save → reload round-trips; undo/redo restores exact frames;
element hit-testing matches visual bounds at all zooms.

**Phase 4 — Lower thirds**
Deliverables: templates, dynamic bindings, independent overlay layer, in/out
animations, show/hide/preview controls.
Verify: overlay renders over each source type; bindings update live when the
slide changes; animations do not block the main render loop.

**Phase 5 — Live production**
Deliverables: transitions (cut/fade/crossfade/slide/zoom/wipe), output
configuration screen, production shortcuts, preview/live safety.
Verify: preview never appears on a live output; transitions complete in the
configured duration; stream continues across scene changes.

**Phase 6 — Hardening**
Deliverables: long-run stability, frame pacing, memory checks, error handling for
media failures, performance pass (dirty rendering, cached backgrounds).
Verify: 2-hour soak with a camera, video and clock; no frame stalls above a
threshold; memory flat; stream fps stable.

## 5. Risks and decisions

- **Text parity**: canvas text will never match DOM text exactly. Decision: the
  canvas renderer becomes authoritative for outputs and the editor preview; the
  DOM `SlideCanvas` remains only for legacy outputs until Phase 5.
- **Hit-testing and rotation**: selection uses inverse-transform hit-testing in
  the editor; store frame in canvas coordinates to avoid DPI drift.
- **Output sync**: one `SCENE_STATE` message per commit (not per mouse move), so
  outputs stay in step without flooding the bus.
- **Web content**: `<webview>` is powerful and risky; keep it opt-in, sandboxed,
  and last on the element list.
- **Fonts**: only bundled/installed fonts are usable in canvas; the font picker
  must reflect what is actually available.
- **Scope control**: the audience output is live in services today. Phases 2–3
  must leave it untouched and prove the new engine in parallel.

## 6. Seed work already in the tree

The uncommitted spike proves the transport and the compositing loop:

- `src/components/BroadcastScene.tsx` — canvas compositor (programme text,
  camera, split, picture-in-picture, lower third, countdown).
- `src/services/broadcastScene.ts` — layout settings + persistence.
- `src/services/sceneCanvas.ts` — registry so streaming keeps running when the
  setup dialog closes.
- `electron/main.cjs` — `mode: 'scene'` encoder reading WebM from stdin, plus
  `backgroundThrottling: false` so the canvas keeps painting when occluded.

It streamed a real 1920×1080 scene to a local FLV at CBR 2.5 Mbps. Its layout
model will be replaced by the document model above; its canvas helpers and
transport carry over.
