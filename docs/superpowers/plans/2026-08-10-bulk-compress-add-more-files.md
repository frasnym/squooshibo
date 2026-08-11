# Bulk Compress Add More Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Add more images" button to Bulk Compress's `FileList` sidebar, per `docs/superpowers/specs/2026-08-10-bulk-compress-add-more-files-design.md`.

**Architecture:** `FileList` converts from a stateless function component to a class component (needed to hold a ref to a hidden file input, matching the existing pattern already used by the Intro screen's own bulk file picker). It gains an "Add more images" button and hidden `<input type="file" multiple>`; picking files calls a new `onAddFiles` prop. `BulkCompress/index.tsx` implements `onAddFiles` by appending new `ResultItem`s to `state.results`, and disables the button once `started` is true.

**Tech Stack:** Preact class components, CSS Modules (kebab-case in `.css` → camelCase in JS, always paired with `import 'add-css:./style.css'`), no test framework — verification is `npm run build`.

## Global Constraints

- Adding files is only possible before "Compress all" is clicked — the button is disabled once `started` is `true`. No support for adding files mid-batch or after finishing (per the user's explicit choice).
- No file-removal/clear-queue UI — not requested.
- No change to how resize's reference dimensions are computed — still based on `props.files[0]` (the first file present at mount), unchanged.
- Reuse the existing hidden-input-plus-ref pattern from `shared/prerendered-app/Intro/index.tsx` (`onBulkFileChange`/`onBulkOpenClick`) — no new file-picking mechanism.
- New `ResultItem`s appended via this feature must get `id` values equal to their position in the resulting array (`existingResults.length + index`), since `updateResult` locates entries by array index via `cleanMerge`.
- The worker pool (`this.workerBridges`) is sized once at mount from the initial file count, capped at `POOL_SIZE = 4`, and is not resized when files are added later — files added after mount are still processed correctly, just by whatever pool size was already established (e.g. starting with 1 file gives a pool of 1, so files added afterward are still processed one at a time by that single worker). This is an accepted limitation, not a bug to fix in this task.

---

### Task 1: Add-more-images button in FileList

**Files:**

- Modify: `src/client/lazy-app/BulkCompress/FileList/index.tsx`
- Modify: `src/client/lazy-app/BulkCompress/FileList/style.css`
- Modify: `src/client/lazy-app/BulkCompress/index.tsx`

**Interfaces:**

- Consumes: `linkRef` from `shared/prerendered-app/util` (existing helper, used elsewhere for the same ref-to-hidden-input pattern). `ResultItem` (existing, unchanged shape).
- Produces: `FileList`'s `Props` gains `addDisabled: boolean` and `onAddFiles: (files: File[]) => void`. `BulkCompress` gains a `private onAddFiles = (files: File[]): void => {...}` method — nothing later depends on this beyond this task.

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
  onSelect: (id: number) => void;
  onAddFiles: (files: File[]) => void;
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

  render({ results, selectedId, addDisabled, onSelect }: Props) {
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

The component moves from a `FunctionComponent` to a `Component` class because it now needs `linkRef(this, 'addInput')` to reference the hidden file input — the same pattern `shared/prerendered-app/Intro/index.tsx` already uses for its own bulk file picker (`ref={linkRef(this, 'bulkFileInput')}`, `type="file" multiple`, resetting `input.value = ''` after reading `input.files` so the same file(s) can be re-picked later).

- [ ] **Step 2: Update FileList/style.css**

Replace the `.list` rule (currently the first rule in the file) with a new `.wrap` rule plus an updated `.list`:

Replace:

```css
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--white);
}
```

with:

```css
.wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  color: var(--white);
}

.hide {
  display: none;
}

.add-button {
  composes: unbutton from global;
  padding: 0.75rem 1rem;
  text-align: center;
  color: var(--white);
  background: rgba(255, 255, 255, 0.08);
}

.add-button:disabled {
  opacity: 0.5;
  cursor: default;
}
```

The `border-right` moves from `.list` to `.wrap` because `.wrap` (not `.list`) is now the component's root element and the direct child of `.columns` in `BulkCompress`'s grid — it needs to be the one that stretches to the column's full height (`min-height: 0` plus `display: flex; flex-direction: column`, with `.list` taking the remaining space via `flex: 1` and the add button sitting below it at its natural height), following the same flex-column-with-a-scrolling-flex-1-child pattern already used in `Preview/style.css`'s `.preview`/`.two-up-wrap`.

Every other rule in the file (`.row`, `.row-selected`, `.select-button`, `.thumb`, `.info`, `.name`, `.status`, `.dot*`, `.download*`) is unchanged.

- [ ] **Step 3: Wire onAddFiles into BulkCompress/index.tsx**

In `src/client/lazy-app/BulkCompress/index.tsx`, add a new method right after `onSelectFile`:

```tsx
  private onSelectFile = (id: number): void => {
    this.setState({ selectedId: id });
  };

  private onAddFiles = (files: File[]): void => {
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

Then update the `<FileList>` element in `render` — replace:

```tsx
<FileList
  results={results}
  selectedId={selectedId}
  onSelect={this.onSelectFile}
/>
```

with:

```tsx
<FileList
  results={results}
  selectedId={selectedId}
  addDisabled={started}
  onSelect={this.onSelectFile}
  onAddFiles={this.onAddFiles}
/>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev` (only if your human partner has approved running it) and check:

- Before clicking "Compress all", click "+ Add more images", pick one or more files — they appear at the bottom of the list with correct thumbnails and a "Queued" status.
- Newly added files' filenames/thumbnails render correctly (white text, visible thumbnail) matching the existing rows.
- Click "Compress all" — all files, including newly added ones, process and complete.
- After clicking "Compress all", "+ Add more images" is visibly disabled and does nothing when clicked.
- The top bar's "N of M ready" count and "Compress all (M)" reflect the larger total after files were added.

- [ ] **Step 6: Commit**

```bash
git add src/client/lazy-app/BulkCompress/FileList/index.tsx src/client/lazy-app/BulkCompress/FileList/style.css src/client/lazy-app/BulkCompress/index.tsx
git commit -m "feat(bulk-compress): add button to append more images to the batch"
```
