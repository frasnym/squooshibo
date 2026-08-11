# Bulk Compress As The Main Screen — Design

## Context

Squoosh currently shows a landing screen (`shared/prerendered-app/Intro`)
until the user picks one file (routing to the single-image editor,
`client/lazy-app/Compress`) or multiple files (routing to
`client/lazy-app/BulkCompress`). Following three rounds of work on Bulk
Compress (a three-column relayout, "add more images", and per-file
delete), the user wants Bulk Compress to become the app's only screen —
no landing page, no single-image editor. Opening the app loads Bulk
Compress directly, starting empty.

## Goal

`App` always renders `BulkCompress`, starting with zero files. The Intro
landing screen and the single-image editor are removed from the codebase.
Drag-and-drop and the PWA share-target flow both feed files into the
always-present Bulk Compress screen instead of opening a separate editor.

## Non-goals

- Feature parity with the single-image editor. It has palette reduction
  (quantize) and rotate; Bulk Compress has neither. Both capabilities are
  going away entirely, not being relocated. This is the direct, accepted
  consequence of removing the single-image editor's code — not a separate
  decision to revisit as part of this change. Adding them to Bulk Compress
  later is a candidate future feature, not part of this design.
- Any change to the PWA manifest's `share_target` configuration
  (`src/static-build/index.tsx`) — it already accepts image files; only
  how the received file is _routed_ changes (into Bulk Compress instead of
  the single-image editor).
- Per-file settings overrides, multi-select delete, or any other new
  batch-management feature — out of scope, unrelated to this change.

## Design

### App-level simplification

`App/index.tsx` currently distinguishes a landing state (`Intro`) from an
editor state (`Compress` or `BulkCompress`, chosen by whether one or many
files were picked), tracked via `isEditorOpen`, a pushed `/editor` route,
and `popstate` handling. All of that goes away. `App` always renders
`BulkCompress`, mounted once with `files: []`.

`BulkCompress` is now mounted for the app's entire lifetime, so `App`
needs a way to hand it files after mount — from drag-and-drop or a
share-target payload arriving post-mount. `BulkCompress` exposes a public
`addFiles(files: File[])` method (the same logic `onAddFiles` already
implements internally); `App` holds a ref to the mounted instance (the
`linkRef` pattern already used throughout this codebase, e.g.
`shared/prerendered-app/util.ts`) and calls `bulkCompress.addFiles(files)`
directly, rather than re-mounting with new props.

- **Drag-and-drop** (`onFileDrop`): today takes only `files[0]` and opens
  the single editor. It now passes every dropped file into
  `addFiles`.
- **Share-target**: today fetches one shared file and opens the single
  editor with it. It now calls `addFiles([file])`.

The top bar's "← Back" button is removed from `BulkCompress`, along with
the `onBack`/`back()` plumbing in both components — there is no other
screen to return to.

### Bulk Compress supporting an empty start

Two mount-time assumptions break when `props.files` can be empty, and
both are fixed:

- **Worker pool sizing.** `workerBridges` currently is created once at
  mount, sized `Math.min(POOL_SIZE, props.files.length)`. With zero
  initial files this creates zero bridges, permanently — later-added files
  would have no worker to run on. Bridge creation moves into
  `onCompressAllClick`, sized from `state.results.length` at the moment
  it's clicked (already guaranteed > 0, since the button is disabled while
  empty).
- **Resize reference dimensions.** `loadFirstFileInfo` currently runs once,
  in `componentDidMount`, against `props.files[0]`. It now also runs from
  `onAddFiles`, but only when `firstFileInfo` is still unset — so whichever
  file becomes the batch's first file, whether present at mount or added
  later, seeds the resize panel's reference dimensions. Once set, it is
  never recomputed (unchanged from the existing delete-file behavior,
  where deleting the reference file doesn't trigger a recompute either).

### Deletion scope

Deleted outright, not just made unreachable:

- `src/client/lazy-app/Compress/` — the single-image editor and its
  `Output/`, `Results/`, `custom-els/` subdirectories, and `index.tsx`
  itself. Two things it currently owns move elsewhere first, since they're
  not editor-specific:
  - `Compress/Options/` (the `Select`, `Toggle`, `Expander`, `Checkbox`,
    `Range`, `Revealer` controls and their shared `style.css`) is a
    generic form-control library — every encoder panel (mozJPEG, WebP,
    AVIF, JXL, WP2, OxiPNG), `quantize`, `resize`, `client-utils`, and
    `BulkCompress/Settings` itself all import from it. It moves to
    `src/client/lazy-app/Options/`, and every one of those import sites
    updates to the new path. Nothing about the components themselves
    changes.
  - The `SourceImage` interface (currently defined in `Compress/index.tsx`,
    used by `BulkCompress/index.tsx` and `features/processors/resize/client`)
    moves into `client/lazy-app/pipeline.ts`, which both of those files
    already import from for `decodeImage`/`compressImage`/`processSvg`.
- `src/shared/prerendered-app/Intro/` — the landing screen, its blob
  animation, demo images, and styles.
- Now-orphaned references in `App/index.tsx` (the `Compress` lazy import,
  `onIntroPickFile`/`onIntroPickFiles`, `isEditorOpen`/`ROUTE_EDITOR`/
  `popstate` handling), plus two build-pipeline files that reference both
  directories by literal path and would fail the build otherwise:
  - `src/sw/to-cache.ts` — decides what the service worker precaches for
    offline support, via `entry-data:` imports of `Compress` and
    `Intro/blob-anim`. These become an `entry-data:` import of
    `BulkCompress` instead, since it's no longer a secondary lazy path but
    the only path.
  - `src/static-build/pages/index/index.tsx` — the prerendered static HTML
    shell that server-renders `<Intro/>`'s marketing markup into `#app` at
    build time. `Intro`'s prerendered content is meaningful without JS;
    `BulkCompress` isn't (it needs client JS/WASM regardless), so this
    becomes a minimal static shell (the existing `<loading-spinner>`
    custom element already used elsewhere for the same "JS hasn't booted
    yet" case) instead of prerendered marketing content. The `<head>`
    metadata (SEO/OG tags, favicon, manifest, canonical URL) is unrelated
    and stays unchanged.
  - Two `missing-types.d.ts` files (`client/` and `static-build/`) each
    have a `/// <reference path=".../Intro/missing-types.d.ts" />` pointing
    at a file that lives inside `Intro/` — both references are removed.

## Testing

No test framework exists in this repo. Verification is `npm run build`
(which will surface any straggling reference to deleted code as a
TypeScript error), plus a manual pass: load the app fresh (empty batch,
both top-bar buttons disabled), drag-and-drop multiple files onto it,
verify a shared-file flow still lands in Bulk Compress (if testable
locally), and confirm there's no way to reach a 404/dead route where the
single-image editor used to live.
