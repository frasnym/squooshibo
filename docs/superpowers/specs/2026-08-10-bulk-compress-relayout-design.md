# Bulk Compress — Three-Column Relayout — Design

## Context

Bulk Compress (`docs/superpowers/specs/2026-08-10-bulk-compress-design.md`,
merged `f794f86`) and its shared resize setting
(`docs/superpowers/specs/2026-08-10-bulk-compress-resize-design.md`, merged
`96a1b35`) currently render as two screens: a Settings screen (format,
quality, resize) with a "Compress all" button, which is replaced entirely
by a `ResultsList` once compression starts.

The user provided a reference screenshot (a third-party bulk-compress tool)
showing a persistent three-column layout: a file queue on the left, a
before/after preview in the middle, and settings on the right, all visible
at once. This design adopts that layout for Bulk Compress only.

## Goal

Relayout Bulk Compress into a persistent three-column view:

- **Left:** file list with thumbnails and per-file status, click to select
  a file for preview.
- **Middle:** before/after slider preview of the selected file.
- **Right:** the existing settings panel (format, quality, resize),
  restyled as a fixed sidebar instead of a screen that disappears once
  compression starts.

A top bar holds navigation (Back), batch status, and the primary actions
(Compress all, Download ZIP).

## Non-goals

- The single-image editor (`Compress/`) is not touched or restyled. "No
  need to handle single anymore" means this pass optimizes only for Bulk;
  it does not mean removing or degrading the single-image editor.
- No "add more files" or "clear queue" controls — not requested, and not
  supported by the current file-picking flow into `BulkCompress`.
- No drag-to-reorder of the file list.
- No per-file settings overrides — format/quality/resize remain one shared
  setting for the whole batch, unchanged from the existing design.
- No dedicated mobile component layout. Narrow viewports stack the three
  columns vertically via CSS; no new `mobileView`-style JS branching.
- No change to the processing model: compression still runs only when
  "Compress all" is clicked (manual trigger, not live/auto-reprocess on
  every settings change).
- No change to the resize UI: the existing percentage-preset panel from the
  single-image editor stays as-is, just restyled to fit the sidebar.

## Design

### Layout

```
+------------------------------------------------------------------+
| ← Back        "3 of 5 ready"        [Compress all] [Download ZIP]|
+--------------+-------------------------------+-------------------+
| FileList     |  Preview                      |  Settings         |
| (thumbnails, |  (before/after <two-up>        |  (format/quality/ |
|  status,     |   slider for selected file,    |   resize, fixed   |
|  click to    |   stats bar below it)          |   sidebar)        |
|  select)     |                                |                   |
+--------------+-------------------------------+-------------------+
```

On narrow viewports, the grid collapses to a single stacked column via CSS
media query, in this order: top bar, FileList, Preview, Settings — no JS
layout branching.

### Components

**`BulkCompress/index.tsx` (modified)**

- Adds `selectedId: number` state, defaulting to the first file's `id`.
  Clicking a `FileList` row updates it.
- `ResultItem` (in `FileList`, formerly `ResultsList`) gains
  `outputWidth?: number` and `outputHeight?: number`, populated in
  `processFile` from the resized (or original, if resize disabled)
  `ImageData` dimensions right before encoding — this is data already
  computed in memory, not a new decode.
- Renders the top bar (Back, status text, Compress all, Download ZIP),
  then the three-column grid (`FileList`, `Preview`, `Settings`) — always
  together, never conditionally swapped.
- "Compress all" is disabled while a batch is already running or once all
  files have reached `done`/`error`. "Download ZIP" is enabled once at
  least one file is `done` (unchanged from current behavior).

**`BulkCompress/FileList/` (renamed from `ResultsList/`)**

- Same `ResultItem` shape and same per-row status/size-change text as
  today.
- Adds a thumbnail per row: `URL.createObjectURL(result.sourceFile)`,
  created once when results are initialized and revoked on unmount
  (mirrors how `downloadUrl` is already created/revoked for outputs).
- Adds a status dot (queued = gray, processing = blue, done = green,
  error = red) and a `selected` visual state.
- Rows become clickable (`onSelect(id)` prop) instead of purely
  informational.
- The existing per-row download link is kept.

**`BulkCompress/Preview/` (new)**

- Props: the selected `ResultItem`, plus a `previewUrl` for the source
  file (same object-URL approach as the thumbnail, reused rather than
  recreated).
- Renders a labeled header (original filename) and a `<two-up>` (imported
  as a side-effect from
  `client/lazy-app/Compress/Output/custom-els/TwoUp`, the same generic
  custom element the single-image editor uses — first child is the
  left/before pane, second is the right/after pane) containing two plain
  `<img>` elements: left = `previewUrl` (original), right = the result's
  `downloadUrl` once `status === 'done'`, otherwise the same `previewUrl`
  again with a "Not compressed yet" / "Compressing…" / error-message label
  overlaid depending on status.
- Below the slider, a stats row: original size, output size (once done),
  output dimensions (`outputWidth`x`outputHeight`, once done), percent
  saved — reusing the existing `prettyBytes` helper and the same
  arrow/percent formatting `FileList` already uses.
- No pinch-zoom, no rotate, no aliasing toggle — this is a simpler,
  read-only comparison view, unlike the single editor's interactive
  `Output` component.

**`BulkCompress/Settings/` (restyled, not restructured)**

- Same props and logic as today (`encoderState`, `resizeEnabled`,
  `resizeOptions`, `firstFileInfo`, and their change handlers).
- `Settings/style.css`'s `.settings-wrap` becomes the fixed right sidebar
  (explicit width instead of full-panel), otherwise unchanged.

### Error handling

Unchanged from the current implementation: per-file try/catch isolation in
`processFile` (one file's failure doesn't stop the batch), abort-signal
handling on unmount, and a snack message if the first-file dimension probe
fails (resize stays disabled for the batch in that case). The only new
surface is `Preview` showing a file's `errorMessage` in place of the
"after" pane when that file's status is `error`.

### Testing

No test framework exists in this repo (unchanged from prior bulk-compress
work). Verification is `npm run build` per task, plus a manual browser
pass at the end covering: selecting different files in the list before and
after compressing, a file that errors, and resizing the browser window to
confirm the narrow-viewport stacked layout.
