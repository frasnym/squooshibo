# Bulk Compress — Add More Images — Design

## Context

The Bulk Compress three-column relayout
(`docs/superpowers/specs/2026-08-10-bulk-compress-relayout-design.md`,
merged to `dev`) explicitly listed "add more files" as a non-goal for that
pass. The user now wants it: a button in the left `FileList` sidebar to
add more images to the current batch.

## Goal

A button at the bottom of `FileList` that opens the browser's file picker
and appends the selected images to the current batch, before compression
starts.

## Non-goals

- Adding files after "Compress all" has been clicked — the button is
  disabled once `started` is true, matching the existing one-shot
  processing model (per the user's explicit choice: "Disable it once
  started").
- Removing/clearing individual files from the batch — not requested.
- Any change to how resize's reference dimensions are computed (still the
  first file selected when `BulkCompress` mounted, unchanged).

## Design

**Reuse the existing pattern.** The Intro screen already has this exact
mechanism for its own bulk picker (`shared/prerendered-app/Intro/index.tsx`):
a hidden `<input type="file" multiple>`, triggered via a ref and `.click()`,
with the input's value reset to `''` after handling so the same file(s) can
be picked again later. `BulkCompress` reuses the identical shape — no new
UI pattern.

**State.** `BulkCompress.onAddFiles(files: File[])` appends new `ResultItem`s
to `state.results`: each gets `id = currentResults.length + index` (IDs
must keep matching array position, since `updateResult` locates entries by
array index via `cleanMerge`), a fresh `previewUrl` via
`URL.createObjectURL`, and `status: 'queued'`. Everything else — the top
bar's "N of M ready" text, "Compress all (M)", the worker pool's queue
building in `onCompressAllClick` — already reads `results`/`results.length`
directly, so no other state changes.

**Button placement and disabled state.** The button renders at the bottom
of `FileList`'s list (below the existing rows), disabled via the `disabled`
attribute once `started` is `true` — plain native disabled styling, no new
CSS pattern needed since it's a single button, not a whole panel.

## Testing

No test framework exists in this repo. Verification is `npm run build`,
plus a manual pass: add files before starting, confirm they appear with
correct thumbnails and get processed; confirm the button is disabled after
clicking "Compress all".
