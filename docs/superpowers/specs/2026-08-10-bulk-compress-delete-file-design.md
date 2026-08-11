# Bulk Compress — Delete File — Design

## Context

Bulk Compress recently gained an "Add more images" button
(`docs/superpowers/specs/2026-08-10-bulk-compress-add-more-files-design.md`).
The user now wants the inverse: a per-file delete/remove control, and for
"Compress all"/"Download ZIP" to be disabled when the batch is empty.

This is the first of two related requests — the second (making Bulk
Compress the app's landing screen, so it can start with zero files) is
being designed separately, since it also touches routing and the
single-image editor and deserves its own focused pass. This spec only
covers removing files from an already-populated batch.

## Goal

A delete control on each `FileList` row that removes that file from the
batch. "Compress all" is disabled when the batch is empty (in addition to
its existing disabled-once-started behavior); "Download ZIP" already
disables correctly with an empty batch via its existing
`hasDoneResults` check.

## Non-goals

- Deleting while a batch is running or after it's finished — the delete
  control is disabled once `started` is `true`, matching "Add more
  images"'s existing behavior (per the user's explicit choice).
- Recomputing resize's reference dimensions when the first file is
  deleted — resize keeps using whichever file's dimensions were loaded at
  mount, even after that file is gone (per the user's explicit choice,
  consistent with the original resize feature's "batch is assumed
  same-ratio" philosophy).
- Any new empty-state messaging beyond disabling the two buttons — not
  requested.
- Undo — not requested.

## Design

**UI.** Each `FileList` row gets a small "×" text button (no new icon
asset — the codebase's existing icon set has nothing suited to "delete";
the codebase already uses plain unstyled buttons with a `title` attribute
for similar affordances elsewhere, e.g. `Output`'s rotate/toggle buttons),
with `title="Remove image"`. It renders next to the existing download
link, disabled (dimmed, matching the add button's disabled treatment) once
`started` is `true`.

**Removal.** `BulkCompress.onRemoveFile(id: number)`:

1. Finds the result with that `id`.
2. Revokes its `previewUrl` and (if present) `downloadUrl` immediately —
   not deferred to unmount, since the file may be removed long before the
   component unmounts.
3. Removes it from `state.results`.
4. If the removed file was the currently selected one (`selectedId`),
   selects another remaining file (the new first result, if any) so the
   preview pane doesn't go blank for no reason. If the batch is now empty,
   `selectedId` is left pointing at nothing — `Preview` already renders an
   empty state in that case (`result?: ResultItem` being `undefined`), so
   no new handling is needed there.

**Decoupling `id` from array position.** Today, `id` doubles as both a
stable identifier and the file's index into `state.results` —
`updateResult` merges via `state.results[id]` and `processFile` reads
`this.state.results[id]` directly. That assumption breaks the moment a
file is removed from the middle of the array (later files' positions
shift, but their `id` fields don't). This spec decouples them:

- `updateResult` finds the entry by `result.id === id` and replaces it,
  instead of indexing the array directly.
- `processFile` looks up its file the same way.
- New files from "Add more images" get their `id` from a persistent
  counter (incremented across the component's lifetime) instead of
  `results.length`, so ids stay unique even after files have been removed
  and re-added.

`id` becomes a plain stable identifier, never reused and never implying
position — the same shape "Add more images" already needed, just no
longer coupled to the array's current length or order.

**Disabling "Compress all" when empty.** Its `disabled` condition becomes
`started || results.length === 0`.

## Testing

No test framework exists in this repo. Verification is `npm run build`,
plus a manual pass: delete a file, confirm it disappears and its preview
updates if it was selected; delete every file and confirm "Compress all"
and "Download ZIP" are both disabled; delete a file, then use "Add more
images" and confirm no ID collisions or stale rows.
