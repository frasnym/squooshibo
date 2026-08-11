# Bulk Compress Delete File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-file delete control to Bulk Compress's `FileList`, and disable "Compress all" when the batch is empty, per `docs/superpowers/specs/2026-08-10-bulk-compress-delete-file-design.md`.

**Architecture:** `FileList` gains a small "×" button per row plus a `removeDisabled` prop, calling a new `onRemove` prop. `BulkCompress/index.tsx` implements `onRemoveFile` (revoke URLs, filter the file out, reassign selection if needed) and, as a prerequisite, decouples `id` from array position throughout the file (`updateResult`, `processFile`, `onAddFiles`) so removing from the middle of the list can't desync ids from positions.

**Tech Stack:** Preact class components, CSS Modules (kebab-case in `.css` → camelCase in JS, always paired with `import 'add-css:./style.css'`), no test framework — verification is `npm run build`.

## Global Constraints

- The delete control is disabled once "Compress all" has been clicked (`started` is `true`) — same as "Add more images". No support for deleting mid-batch or after finishing.
- Deleting the file that seeded the resize panel's reference dimensions does NOT recompute anything — resize keeps using whichever dimensions were loaded at mount, even after that file is gone.
- No new empty-state messaging — only the two buttons' disabled conditions change.
- `id` must stop being treated as an array index anywhere in `BulkCompress/index.tsx` — `updateResult`, `processFile`, and `onAddFiles` all switch to finding/assigning by stable `id`, never by `results.length` or `results[id]`.

---

### Task 1: Delete control and id/position decoupling

**Files:**

- Modify: `src/client/lazy-app/BulkCompress/FileList/index.tsx`
- Modify: `src/client/lazy-app/BulkCompress/FileList/style.css`
- Modify: `src/client/lazy-app/BulkCompress/index.tsx`

**Interfaces:**

- Consumes: `ResultItem` (existing, unchanged shape).
- Produces: `FileList`'s `Props` gains `removeDisabled: boolean` and `onRemove: (id: number) => void`. `BulkCompress` gains `private onRemoveFile = (id: number): void => {...}` and a `private nextId` counter field — nothing later depends on these beyond this task.

- [ ] **Step 1: Replace FileList/index.tsx**

Replace the full contents of `src/client/lazy-app/BulkCompress/FileList/index.tsx` with:

```tsx
import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import { DownloadIcon } from 'client/lazy-app/icons';
import { formatSizeChange } from '../util';
import { linkRef } from 'shared/prerendered-app/util';

export interface ResultItem {
  id: number;
  sourceFile: File;
  previewUrl: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  outputFile?: File;
  outputWidth?: number;
  outputHeight?: number;
  downloadUrl?: string;
  errorMessage?: string;
}

interface Props {
  results: ResultItem[];
  selectedId: number;
  addDisabled: boolean;
  removeDisabled: boolean;
  onSelect: (id: number) => void;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: number) => void;
}

const statusDotClass: Record<ResultItem['status'], string> = {
  queued: style.dotQueued,
  processing: style.dotProcessing,
  done: style.dotDone,
  error: style.dotError,
};

export default class FileList extends Component<Props> {
  private addInput?: HTMLInputElement;

  private onAddClick = (): void => {
    this.addInput!.click();
  };

  private onAddInputChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;
    this.props.onAddFiles(files);
  };

  render({
    results,
    selectedId,
    addDisabled,
    removeDisabled,
    onSelect,
    onRemove,
  }: Props) {
    return (
      <div class={style.wrap}>
        <ul class={style.list}>
          {results.map((result) => (
            <li
              class={
                style.row +
                (result.id === selectedId ? ` ${style.rowSelected}` : '')
              }
              key={result.id}
            >
              <button
                class={style.selectButton}
                onClick={() => onSelect(result.id)}
              >
                <img class={style.thumb} src={result.previewUrl} alt="" />
                <span class={style.info}>
                  <span class={style.name}>{result.sourceFile.name}</span>
                  <span class={style.status}>
                    <span
                      class={`${style.dot} ${statusDotClass[result.status]}`}
                    />
                    {result.status === 'queued' && 'Queued'}
                    {result.status === 'processing' && 'Compressing…'}
                    {result.status === 'error' &&
                      (result.errorMessage || 'Failed')}
                    {result.status === 'done' &&
                      result.outputFile &&
                      formatSizeChange(
                        result.sourceFile.size,
                        result.outputFile.size,
                      )}
                  </span>
                </span>
              </button>
              <span class={style.rowActions}>
                {result.status === 'done' &&
                  result.downloadUrl &&
                  result.outputFile && (
                    <a
                      class={style.download}
                      href={result.downloadUrl}
                      download={result.outputFile.name}
                    >
                      <DownloadIcon />
                    </a>
                  )}
                <button
                  class={style.removeButton}
                  onClick={() => onRemove(result.id)}
                  disabled={removeDisabled}
                  title="Remove image"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        <input
          class={style.hide}
          ref={linkRef(this, 'addInput')}
          type="file"
          multiple
          onChange={this.onAddInputChange}
        />
        <button
          class={style.addButton}
          onClick={this.onAddClick}
          disabled={addDisabled}
        >
          + Add more images
        </button>
      </div>
    );
  }
}
```

- [ ] **Step 2: Add row-actions and remove-button styles**

In `src/client/lazy-app/BulkCompress/FileList/style.css`, add these rules (placement doesn't matter — e.g. right after the existing `.download svg` rule at the end of the file):

```css
.row-actions {
  display: flex;
  align-items: center;
}

.remove-button {
  composes: unbutton from global;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0 0.75rem 0 0;
  color: var(--less-light-gray);
  font-size: 1.1rem;
  line-height: 1;
  border-radius: 4px;
}

.remove-button:hover:not(:disabled) {
  color: var(--white);
  background: rgba(255, 255, 255, 0.08);
}

.remove-button:disabled {
  opacity: 0.4;
  cursor: default;
}
```

Every other rule in the file is unchanged.

- [ ] **Step 3: Decouple id from array position, and add onRemoveFile, in BulkCompress/index.tsx**

In `src/client/lazy-app/BulkCompress/index.tsx`:

1. Remove the now-unused import (nothing else in this file uses `cleanMerge` after this task):

Replace:

```tsx
import { drawableToImageData } from '../util/canvas';
import { cleanMerge } from '../util/clean-modify';
import WorkerBridge from '../worker-bridge';
```

with:

```tsx
import { drawableToImageData } from '../util/canvas';
import WorkerBridge from '../worker-bridge';
```

2. Add a `private nextId` counter field, initialized from the mount-time file count, right after the existing `private batchSettings` field:

Replace:

```tsx
  private abortController = new AbortController();
  private batchSettings: {
    encoderState: EncoderState;
    resizeEnabled: boolean;
    resizeOptions: ProcessorOptions['resize'];
  } | null = null;
  private workerBridges = Array.from(
```

with:

```tsx
  private abortController = new AbortController();
  private batchSettings: {
    encoderState: EncoderState;
    resizeEnabled: boolean;
    resizeOptions: ProcessorOptions['resize'];
  } | null = null;
  private nextId = this.props.files.length;
  private workerBridges = Array.from(
```

3. Replace `onAddFiles` (it no longer needs the functional-updater-derived `startId`, since `this.nextId` is a synchronous instance counter) — replace:

```tsx
  private onAddFiles = (files: File[]): void => {
    if (this.state.started) return;
    this.setState((state) => {
      const startId = state.results.length;
      const newResults: ResultItem[] = files.map((file, index) => ({
        id: startId + index,
        sourceFile: file,
        status: 'queued' as const,
        previewUrl: URL.createObjectURL(file),
      }));
      return { results: [...state.results, ...newResults] };
    });
  };
```

with:

```tsx
  private onAddFiles = (files: File[]): void => {
    if (this.state.started) return;
    const newResults: ResultItem[] = files.map((file) => ({
      id: this.nextId++,
      sourceFile: file,
      status: 'queued' as const,
      previewUrl: URL.createObjectURL(file),
    }));
    this.setState((state) => ({
      results: [...state.results, ...newResults],
    }));
  };

  private onRemoveFile = (id: number): void => {
    if (this.state.started) return;
    const removed = this.state.results.find((r) => r.id === id);
    if (!removed) return;
    URL.revokeObjectURL(removed.previewUrl);
    if (removed.downloadUrl) URL.revokeObjectURL(removed.downloadUrl);

    this.setState((state) => {
      const results = state.results.filter((r) => r.id !== id);
      return {
        results,
        selectedId:
          state.selectedId === id && results.length > 0
            ? results[0].id
            : state.selectedId,
      };
    });
  };
```

4. Replace `updateResult` to find-by-id instead of indexing by position — replace:

```tsx
  private updateResult = (id: number, patch: Partial<ResultItem>): void => {
    this.setState((state) => ({
      results: cleanMerge(state.results, id, patch),
    }));
  };
```

with:

```tsx
  private updateResult = (id: number, patch: Partial<ResultItem>): void => {
    this.setState((state) => ({
      results: state.results.map((result) =>
        result.id === id ? { ...result, ...patch } : result,
      ),
    }));
  };
```

5. In `processFile`, replace the array-index lookup — replace:

```tsx
const signal = this.abortController.signal;
const { sourceFile } = this.state.results[id];
```

with:

```tsx
const signal = this.abortController.signal;
// Deletion is disabled once the batch starts (see onRemoveFile), so
// every id queued in onCompressAllClick is guaranteed to still be
// present here.
const { sourceFile } = this.state.results.find((r) => r.id === id)!;
```

6. In `render`, disable "Compress all" when the batch is empty too — replace:

```tsx
<button
  class={style.compressAllBtn}
  onClick={this.onCompressAllClick}
  disabled={started}
>
  Compress all
</button>
```

with:

```tsx
<button
  class={style.compressAllBtn}
  onClick={this.onCompressAllClick}
  disabled={started || results.length === 0}
>
  Compress all
</button>
```

7. Still in `render`, pass the new props to `FileList` — replace:

```tsx
<FileList
  results={results}
  selectedId={selectedId}
  addDisabled={started}
  onSelect={this.onSelectFile}
  onAddFiles={this.onAddFiles}
/>
```

with:

```tsx
<FileList
  results={results}
  selectedId={selectedId}
  addDisabled={started}
  removeDisabled={started}
  onSelect={this.onSelectFile}
  onAddFiles={this.onAddFiles}
  onRemove={this.onRemoveFile}
/>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev` (only if your human partner has approved running it) and check:

- Delete a file from the middle of the list — it disappears, remaining rows keep their correct thumbnails/status, and no other row's data shifts incorrectly.
- Delete the currently-selected file — the preview switches to another remaining file instead of going blank.
- Delete every file — "Compress all" and "Download ZIP" both become disabled, and the file list shows just the "+ Add more images" button.
- Add files back after deleting some, then click "Compress all" — every remaining/added file processes correctly (confirms no id collisions).
- After clicking "Compress all", every row's "×" button is visibly disabled.

- [ ] **Step 6: Commit**

```bash
git add src/client/lazy-app/BulkCompress/FileList/index.tsx src/client/lazy-app/BulkCompress/FileList/style.css src/client/lazy-app/BulkCompress/index.tsx
git commit -m "feat(bulk-compress): add per-file delete and disable compress-all when empty"
```
