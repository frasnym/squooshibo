# Bulk Compress Three-Column Relayout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relayout Bulk Compress into a persistent three-column view (file list, before/after preview, settings) with a top bar holding batch status and the primary actions, per
`docs/superpowers/specs/2026-08-10-bulk-compress-relayout-design.md`.

**Architecture:** `BulkCompress/index.tsx` keeps its existing state and processing logic (per-file worker pool, manual "Compress all" trigger, shared format/quality/resize settings) and gains a `selectedId` for which file is previewed. Its render tree is restructured into a top bar plus three always-visible columns: `FileList` (renamed from `ResultsList`, now with thumbnails and click-to-select), `Preview` (new, reuses the existing generic `<two-up>` custom element for the compare slider), and `Settings` (existing component, restyled as a sidebar).

**Tech Stack:** Preact class/function components, CSS Modules (kebab-case in `.css` → camelCase in JS, always paired with `import 'add-css:./style.css'`), no test framework — verification is `npm run build` (Rollup + TypeScript type-check).

## Global Constraints

- The single-image editor (`src/client/lazy-app/Compress/`) is not modified. "No need to handle single anymore" means this plan optimizes Bulk Compress only — it does not touch or degrade the single-image editor.
- No "add more files" or "clear queue" controls — not requested, not currently supported by the file-picking flow into `BulkCompress`.
- No drag-to-reorder of the file list.
- No per-file settings overrides — format/quality/resize stay one shared setting for the whole batch.
- No dedicated mobile JS layout branching — narrow viewports stack the three columns vertically via a CSS media query only.
- No change to the processing model — compression still runs only when "Compress all" is clicked. Once clicked, the button is disabled (not hidden) rather than re-enabled, matching the app's current one-shot behavior.
- No change to the resize UI — reuse the existing percentage-preset panel from the single-image editor via `features/processors/resize/client`, unchanged, just restyled to fit the sidebar.
- Reuse the existing generic `<two-up>` custom element (`src/client/lazy-app/Compress/Output/custom-els/TwoUp`) for the compare slider. Do not build a new slider.
- `FileList` rows show filename + status only, no per-file dimensions — decoding every file's dimensions up front (beyond the existing first-file-only probe used for resize) is out of scope.
- The ZIP-download button keeps its exact current enablement condition (all files finished AND at least one succeeded) — only its position moves to the top bar.

---

### Task 1: FileList — rename ResultsList, add thumbnails and selection

**Files:**

- Create: `src/client/lazy-app/BulkCompress/util.ts`
- Create: `src/client/lazy-app/BulkCompress/FileList/index.tsx`
- Create: `src/client/lazy-app/BulkCompress/FileList/style.css`
- Delete: `src/client/lazy-app/BulkCompress/ResultsList/index.tsx`
- Delete: `src/client/lazy-app/BulkCompress/ResultsList/style.css`
- Modify: `src/client/lazy-app/BulkCompress/index.tsx`

**Interfaces:**

- Consumes: `prettyBytes` from `src/client/lazy-app/util/pretty-bytes.ts` (existing, default export `(number) => { value: string; unit: string }`).
- Produces: `sizeChange(original: number, compressed: number): { arrow: string; percent: number }` and `formatSizeChange(original: number, compressed: number): string` from `BulkCompress/util.ts` — consumed by this task's `FileList` and by Task 2's `Preview`. `ResultItem` interface (moved from `ResultsList` to `FileList`) — consumed by `BulkCompress/index.tsx` and by Task 2's `Preview`:

  ```ts
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
  ```

  (`outputWidth`/`outputHeight` are defined here but only populated starting in Task 2.)

- [ ] **Step 1: Create the shared size-formatting util**

Create `src/client/lazy-app/BulkCompress/util.ts`:

```ts
import prettyBytes from '../util/pretty-bytes';

export function sizeChange(
  original: number,
  compressed: number,
): { arrow: string; percent: number } {
  const diff = compressed / original;
  const absolutePercent = Math.round(Math.abs(diff) * 100);
  const percent = diff > 1 ? absolutePercent - 100 : 100 - absolutePercent;
  return { arrow: diff < 1 ? '↓' : '↑', percent: Math.abs(percent) };
}

export function formatSizeChange(original: number, compressed: number): string {
  const from = prettyBytes(original);
  const to = prettyBytes(compressed);
  const { arrow, percent } = sizeChange(original, compressed);
  return `${from.value}${from.unit} → ${to.value}${to.unit} (${arrow}${percent}%)`;
}
```

This is the same `sizeChange` logic that lived inside `ResultsList/index.tsx` today, extracted so both `FileList` (this task) and `Preview` (Task 2) can use it without duplication.

- [ ] **Step 2: Create the FileList component**

Create `src/client/lazy-app/BulkCompress/FileList/index.tsx`:

```tsx
import { h, FunctionComponent } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import { DownloadIcon } from 'client/lazy-app/icons';
import { formatSizeChange } from '../util';

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
  onSelect: (id: number) => void;
}

const statusDotClass: Record<ResultItem['status'], string> = {
  queued: style.dotQueued,
  processing: style.dotProcessing,
  done: style.dotDone,
  error: style.dotError,
};

const FileList: FunctionComponent<Props> = ({
  results,
  selectedId,
  onSelect,
}) => (
  <ul class={style.list}>
    {results.map((result) => (
      <li
        class={
          style.row + (result.id === selectedId ? ` ${style.rowSelected}` : '')
        }
        key={result.id}
      >
        <button class={style.selectButton} onClick={() => onSelect(result.id)}>
          <img class={style.thumb} src={result.previewUrl} alt="" />
          <span class={style.info}>
            <span class={style.name}>{result.sourceFile.name}</span>
            <span class={style.status}>
              <span class={`${style.dot} ${statusDotClass[result.status]}`} />
              {result.status === 'queued' && 'Queued'}
              {result.status === 'processing' && 'Compressing…'}
              {result.status === 'error' && (result.errorMessage || 'Failed')}
              {result.status === 'done' &&
                result.outputFile &&
                formatSizeChange(
                  result.sourceFile.size,
                  result.outputFile.size,
                )}
            </span>
          </span>
        </button>
        {result.status === 'done' && result.downloadUrl && result.outputFile && (
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
);

export default FileList;
```

- [ ] **Step 3: Create the FileList stylesheet**

Create `src/client/lazy-app/BulkCompress/FileList/style.css`:

```css
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.row {
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  border-bottom: 1px solid var(--dim-text);
}

.row-selected {
  background: rgba(255, 255, 255, 0.08);
}

.select-button {
  composes: unbutton from global;
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  width: 100%;
  text-align: left;
  color: inherit;
}

.thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
  background: rgba(255, 255, 255, 0.08);
}

.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--dim-text);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-queued {
  background: var(--less-light-gray);
}

.dot-processing {
  background: var(--blue);
}

.dot-done {
  background: #2ecc71;
}

.dot-error {
  background: #e74c3c;
}

.download {
  display: flex;
  align-items: center;
  padding: 0 1rem;
}

.download svg {
  width: 19px;
  height: 19px;
  fill: currentColor;
  display: block;
}
```

- [ ] **Step 4: Remove the old ResultsList directory**

```bash
git rm src/client/lazy-app/BulkCompress/ResultsList/index.tsx src/client/lazy-app/BulkCompress/ResultsList/style.css
rmdir src/client/lazy-app/BulkCompress/ResultsList 2>/dev/null || true
```

- [ ] **Step 5: Update BulkCompress/index.tsx to use FileList, add previewUrl and selectedId**

Replace the full contents of `src/client/lazy-app/BulkCompress/index.tsx` with:

```tsx
import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import { EncoderState, ProcessorOptions, encoderMap } from '../feature-meta';
import { decodeImage, compressImage, processSvg } from '../pipeline';
import { resize } from 'features/processors/resize/client';
import { defaultOptions as defaultResizeOptions } from 'features/processors/resize/shared/meta';
import type { SourceImage } from '../Compress';
import { drawableToImageData } from '../util/canvas';
import { cleanMerge } from '../util/clean-modify';
import WorkerBridge from '../worker-bridge';
import Settings, { FirstFileInfo } from './Settings';
import FileList, { ResultItem } from './FileList';
import { createZip } from './zip';

const POOL_SIZE = 4;

interface Props {
  files: File[];
  showSnack: SnackBarElement['showSnackbar'];
  onBack: () => void;
}

interface State {
  encoderState: EncoderState;
  resizeEnabled: boolean;
  resizeOptions: ProcessorOptions['resize'];
  firstFileInfo?: FirstFileInfo;
  results: ResultItem[];
  selectedId: number;
  started: boolean;
  zipping: boolean;
}

function isSvg(file: File): boolean {
  return file.type.startsWith('image/svg+xml');
}

export default class BulkCompress extends Component<Props, State> {
  state: State = {
    encoderState: {
      type: 'mozJPEG',
      options: encoderMap.mozJPEG.meta.defaultOptions,
    },
    resizeEnabled: false,
    resizeOptions: defaultResizeOptions,
    firstFileInfo: undefined,
    results: this.props.files.map((file, id) => ({
      id,
      sourceFile: file,
      status: 'queued' as const,
      previewUrl: URL.createObjectURL(file),
    })),
    selectedId: 0,
    started: false,
    zipping: false,
  };

  private abortController = new AbortController();
  private workerBridges = Array.from(
    { length: Math.min(POOL_SIZE, this.props.files.length) },
    () => new WorkerBridge(),
  );

  componentDidMount(): void {
    this.loadFirstFileInfo();
  }

  componentWillUnmount(): void {
    this.abortController.abort();
    for (const result of this.state.results) {
      URL.revokeObjectURL(result.previewUrl);
      if (result.downloadUrl) URL.revokeObjectURL(result.downloadUrl);
    }
  }

  private loadFirstFileInfo = async (): Promise<void> => {
    const signal = this.abortController.signal;
    const firstFile = this.props.files[0];

    try {
      let width: number;
      let height: number;
      let isVector = false;

      if (isSvg(firstFile)) {
        const vectorImage = await processSvg(signal, firstFile);
        width = vectorImage.width;
        height = vectorImage.height;
        isVector = true;
      } else {
        const imageData = await decodeImage(
          signal,
          firstFile,
          this.workerBridges[0],
        );
        width = imageData.width;
        height = imageData.height;
      }

      this.setState((state) => {
        if (signal.aborted) return {};
        return {
          firstFileInfo: { width, height, isVector },
          resizeOptions: {
            ...state.resizeOptions,
            width,
            height,
            method: isVector ? 'vector' : state.resizeOptions.method,
          } as ProcessorOptions['resize'],
        };
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      this.props.showSnack(
        "Couldn't read image dimensions — resize is unavailable for this batch",
      );
    }
  };

  private onEncoderStateChange = (encoderState: EncoderState): void => {
    this.setState({ encoderState });
  };

  private onResizeEnabledChange = (resizeEnabled: boolean): void => {
    this.setState({ resizeEnabled });
  };

  private onResizeOptionsChange = (
    resizeOptions: ProcessorOptions['resize'],
  ): void => {
    this.setState({ resizeOptions });
  };

  private onSelectFile = (id: number): void => {
    this.setState({ selectedId: id });
  };

  private updateResult = (id: number, patch: Partial<ResultItem>): void => {
    this.setState((state) => ({
      results: cleanMerge(state.results, id, patch),
    }));
  };

  private processFile = async (
    id: number,
    workerBridge: WorkerBridge,
  ): Promise<void> => {
    const signal = this.abortController.signal;
    const { sourceFile } = this.state.results[id];

    this.updateResult(id, { status: 'processing' });

    try {
      let vectorImage: HTMLImageElement | undefined;
      let imageData: ImageData;

      if (isSvg(sourceFile)) {
        vectorImage = await processSvg(signal, sourceFile);
        imageData = drawableToImageData(vectorImage);
      } else {
        imageData = await decodeImage(signal, sourceFile, workerBridge);
      }

      let processedData = imageData;

      if (this.state.resizeEnabled) {
        const source: SourceImage = {
          file: sourceFile,
          decoded: imageData,
          preprocessed: imageData,
          vectorImage,
        };
        const resizeOptions = this.state.resizeOptions;
        const safeResizeOptions = (
          resizeOptions.method === 'vector' && !vectorImage
            ? { ...resizeOptions, method: defaultResizeOptions.method }
            : resizeOptions
        ) as ProcessorOptions['resize'];

        processedData = await resize(
          signal,
          source,
          safeResizeOptions,
          workerBridge,
        );
      }

      const outputFile = await compressImage(
        signal,
        processedData,
        this.state.encoderState,
        sourceFile.name,
        workerBridge,
      );

      this.updateResult(id, {
        status: 'done',
        outputFile,
        downloadUrl: URL.createObjectURL(outputFile),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      this.updateResult(id, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to compress',
      });
    }
  };

  private onCompressAllClick = async (): Promise<void> => {
    this.setState({ started: true });

    const queue = this.state.results.map((result) => result.id);

    await Promise.all(
      this.workerBridges.map(async (workerBridge) => {
        while (queue.length > 0) {
          const id = queue.shift();
          if (id === undefined) return;
          await this.processFile(id, workerBridge);
        }
      }),
    );
  };

  private onDownloadZipClick = async (): Promise<void> => {
    this.setState({ zipping: true });
    try {
      const entries = this.state.results
        .filter((result) => result.status === 'done' && result.outputFile)
        .map((result) => ({
          name: result.outputFile!.name,
          data: result.outputFile!,
        }));
      const zipBlob = await createZip(entries);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'compressed-images.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      this.props.showSnack('Failed to create ZIP');
    } finally {
      this.setState({ zipping: false });
    }
  };

  render(
    { onBack }: Props,
    {
      encoderState,
      resizeEnabled,
      resizeOptions,
      firstFileInfo,
      results,
      selectedId,
      started,
      zipping,
    }: State,
  ) {
    const allFinished =
      started &&
      results.every((r) => r.status === 'done' || r.status === 'error');
    const hasDoneResults = results.some((r) => r.status === 'done');

    return (
      <div class={style.bulkCompress}>
        <button class={style.back} onClick={onBack}>
          ← Back
        </button>
        {!started && (
          <Settings
            encoderState={encoderState}
            onEncoderStateChange={this.onEncoderStateChange}
            resizeEnabled={resizeEnabled}
            resizeOptions={resizeOptions}
            firstFileInfo={firstFileInfo}
            onResizeEnabledChange={this.onResizeEnabledChange}
            onResizeOptionsChange={this.onResizeOptionsChange}
          />
        )}
        {!started && (
          <button
            class={style.compressAllBtn}
            onClick={this.onCompressAllClick}
          >
            Compress all ({results.length})
          </button>
        )}
        <FileList
          results={results}
          selectedId={selectedId}
          onSelect={this.onSelectFile}
        />
        {allFinished && hasDoneResults && (
          <button
            class={style.zipBtn}
            onClick={this.onDownloadZipClick}
            disabled={zipping}
          >
            {zipping ? 'Zipping…' : 'Download all as ZIP'}
          </button>
        )}
      </div>
    );
  }
}
```

This step is intentionally not the final layout — it swaps `ResultsList` for `FileList` (now always rendered, with thumbnails and click-to-select) and adds the `previewUrl`/`selectedId` plumbing everything else needs. The top bar and three-column grid arrive in Task 3.

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. (There is no test suite in this repo — this is the verification step.)

- [ ] **Step 7: Commit**

```bash
git add src/client/lazy-app/BulkCompress/util.ts src/client/lazy-app/BulkCompress/FileList src/client/lazy-app/BulkCompress/index.tsx
git add -u src/client/lazy-app/BulkCompress/ResultsList
git commit -m "feat(bulk-compress): rename ResultsList to FileList with thumbnails and selection"
```

---

### Task 2: Preview — before/after slider for the selected file

**Files:**

- Create: `src/client/lazy-app/BulkCompress/Preview/index.tsx`
- Create: `src/client/lazy-app/BulkCompress/Preview/style.css`
- Modify: `src/client/lazy-app/BulkCompress/index.tsx`

**Interfaces:**

- Consumes: `ResultItem` from `../FileList` (Task 1). `sizeChange` from `../util` (Task 1). `prettyBytes` from `../../util/pretty-bytes` (existing). The generic `<two-up>` custom element registered by the side-effect import `client/lazy-app/Compress/Output/custom-els/TwoUp` (existing, unmodified) — first child renders as the left/before pane, second child as the right/after pane, already globally typed as a JSX intrinsic element via that module's `missing-types.d.ts`.
- Produces: `Preview` component, `Props: { result?: ResultItem }`, consumed by `BulkCompress/index.tsx` in this task.

- [ ] **Step 1: Create the Preview component**

Create `src/client/lazy-app/BulkCompress/Preview/index.tsx`:

```tsx
import { h, FunctionComponent } from 'preact';
import '../../Compress/Output/custom-els/TwoUp';

import * as style from './style.css';
import 'add-css:./style.css';
import prettyBytes from '../../util/pretty-bytes';
import { sizeChange } from '../util';
import type { ResultItem } from '../FileList';

interface Props {
  result?: ResultItem;
}

const statusLabels: Record<ResultItem['status'], string> = {
  queued: 'Not compressed yet',
  processing: 'Compressing…',
  done: '',
  error: '',
};

const Preview: FunctionComponent<Props> = ({ result }) => {
  if (!result) return <div class={style.preview} />;

  const afterUrl =
    result.status === 'done' && result.downloadUrl
      ? result.downloadUrl
      : result.previewUrl;

  const statusLabel =
    result.status === 'error'
      ? result.errorMessage || 'Failed'
      : statusLabels[result.status];

  return (
    <div class={style.preview}>
      <div class={style.header}>
        <span>Original</span>
        <span class={style.fileName}>{result.sourceFile.name}</span>
        <span>Compressed</span>
      </div>
      <div class={style.twoUpWrap}>
        <two-up class={style.twoUp}>
          <img class={style.image} src={result.previewUrl} alt="Original" />
          <img class={style.image} src={afterUrl} alt="Compressed" />
        </two-up>
        {statusLabel && <div class={style.statusOverlay}>{statusLabel}</div>}
      </div>
      {result.status === 'done' && result.outputFile && (
        <div class={style.stats}>
          <div class={style.stat}>
            <span class={style.statLabel}>Original size</span>
            <span class={style.statValue}>
              {(() => {
                const { value, unit } = prettyBytes(result.sourceFile.size);
                return `${value}${unit}`;
              })()}
            </span>
          </div>
          <div class={style.stat}>
            <span class={style.statLabel}>Output size</span>
            <span class={style.statValue}>
              {(() => {
                const { value, unit } = prettyBytes(result.outputFile!.size);
                return `${value}${unit}`;
              })()}
            </span>
          </div>
          <div class={style.stat}>
            <span class={style.statLabel}>Output dimensions</span>
            <span class={style.statValue}>
              {result.outputWidth && result.outputHeight
                ? `${result.outputWidth} × ${result.outputHeight}`
                : '—'}
            </span>
          </div>
          <div class={style.stat}>
            <span class={style.statLabel}>Space saved</span>
            <span class={style.statValue}>
              {(() => {
                const { arrow, percent } = sizeChange(
                  result.sourceFile.size,
                  result.outputFile!.size,
                );
                return `${arrow}${percent}%`;
              })()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Preview;
```

- [ ] **Step 2: Create the Preview stylesheet**

Create `src/client/lazy-app/BulkCompress/Preview/style.css`:

```css
.preview {
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--white);
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--less-light-gray);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  text-align: center;
}

.two-up-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.two-up {
  composes: abs-fill from global;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: var(--black);
}

.status-overlay {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.7);
  color: var(--white);
  font-size: 0.8rem;
  pointer-events: none;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  text-align: center;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--less-light-gray);
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Wire Preview into BulkCompress/index.tsx**

In `src/client/lazy-app/BulkCompress/index.tsx`:

1. Add the import, next to the `FileList` import:

```tsx
import FileList, { ResultItem } from './FileList';
import Preview from './Preview';
```

2. In `processFile`, capture the output dimensions when a file finishes — replace:

```tsx
this.updateResult(id, {
  status: 'done',
  outputFile,
  downloadUrl: URL.createObjectURL(outputFile),
});
```

with:

```tsx
this.updateResult(id, {
  status: 'done',
  outputFile,
  outputWidth: processedData.width,
  outputHeight: processedData.height,
  downloadUrl: URL.createObjectURL(outputFile),
});
```

3. In `render`, compute the selected result and render `Preview` next to `FileList` — replace:

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
          onSelect={this.onSelectFile}
        />
        <Preview result={results.find((r) => r.id === selectedId)} />
```

Like Task 1, this is not the final grid layout — `Preview` renders correctly and reacts to selection, but the top-bar/three-column CSS structure arrives in Task 3.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/lazy-app/BulkCompress/Preview src/client/lazy-app/BulkCompress/index.tsx
git commit -m "feat(bulk-compress): add before/after preview for the selected file"
```

---

### Task 3: Top bar and three-column grid layout

**Files:**

- Modify: `src/client/lazy-app/BulkCompress/index.tsx`
- Modify: `src/client/lazy-app/BulkCompress/style.css`
- Modify: `src/client/lazy-app/BulkCompress/Settings/style.css`

**Interfaces:**

- Consumes: `FileList` (Task 1), `Preview` (Task 2), `Settings` (existing) — no interface changes to any of them, this task only changes how `BulkCompress/index.tsx` arranges and styles them.
- Produces: final `BulkCompress` render tree and stylesheet — no later task depends on this.

- [ ] **Step 1: Replace the render method**

In `src/client/lazy-app/BulkCompress/index.tsx`, replace the entire `render(...)` method with:

```tsx
  render(
    { onBack }: Props,
    {
      encoderState,
      resizeEnabled,
      resizeOptions,
      firstFileInfo,
      results,
      selectedId,
      started,
      zipping,
    }: State,
  ) {
    const allFinished =
      started &&
      results.every((r) => r.status === 'done' || r.status === 'error');
    const hasDoneResults = results.some((r) => r.status === 'done');
    const doneCount = results.filter((r) => r.status === 'done').length;

    return (
      <div class={style.bulkCompress}>
        <div class={style.topBar}>
          <button class={style.back} onClick={onBack}>
            ← Back
          </button>
          <span class={style.status}>
            {doneCount} of {results.length} ready
          </span>
          <div class={style.actions}>
            <button
              class={style.compressAllBtn}
              onClick={this.onCompressAllClick}
              disabled={started}
            >
              Compress all
            </button>
            <button
              class={style.zipBtn}
              onClick={this.onDownloadZipClick}
              disabled={!allFinished || !hasDoneResults || zipping}
            >
              {zipping ? 'Zipping…' : 'Download ZIP'}
            </button>
          </div>
        </div>
        <div class={style.columns}>
          <FileList
            results={results}
            selectedId={selectedId}
            onSelect={this.onSelectFile}
          />
          <Preview result={results.find((r) => r.id === selectedId)} />
          <Settings
            encoderState={encoderState}
            onEncoderStateChange={this.onEncoderStateChange}
            resizeEnabled={resizeEnabled}
            resizeOptions={resizeOptions}
            firstFileInfo={firstFileInfo}
            onResizeEnabledChange={this.onResizeEnabledChange}
            onResizeOptionsChange={this.onResizeOptionsChange}
          />
        </div>
      </div>
    );
  }
```

The "Compress all" button is now always visible but disables permanently once `started` becomes `true` — this preserves the existing one-shot processing model (Global Constraints) while keeping the button in the persistent top bar. The ZIP button keeps its exact original enablement condition (`allFinished && hasDoneResults`), just always rendered (disabled until then) instead of conditionally mounted.

- [ ] **Step 2: Replace BulkCompress/style.css**

Replace the full contents of `src/client/lazy-app/BulkCompress/style.css` with:

```css
.bulk-compress {
  composes: abs-fill from global;
  display: grid;
  grid-template-rows: max-content 1fr;
  overflow: hidden;
  background: var(--off-black);
}

.top-bar {
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  color: var(--white);
}

.back {
  composes: unbutton from global;
  padding: 1rem 0;
  color: inherit;
  justify-self: start;
}

.status {
  justify-self: center;
  font-size: 0.9rem;
  color: var(--less-light-gray);
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-self: end;
}

.compress-all-btn,
.zip-btn {
  composes: unbutton from global;
  padding: 0.6rem 1.25rem;
  background: var(--hot-pink);
  color: var(--white);
  border-radius: 0.25rem;
}

.compress-all-btn:disabled,
.zip-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.columns {
  display: grid;
  grid-template-columns: 260px 1fr 320px;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 860px) {
  .columns {
    grid-template-columns: 1fr;
    grid-template-rows: max-content 1fr max-content;
    overflow-y: auto;
  }
}
```

- [ ] **Step 3: Widen the Settings sidebar separator**

In `src/client/lazy-app/BulkCompress/Settings/style.css`, replace the `.settings-wrap` block:

```css
.settings-wrap {
  --main-theme-color: var(--pink);
  --hot-theme-color: var(--hot-pink);
  --header-text-color: var(--white);
  --scroller-radius: 7px;
  color: #fff;
  font-size: 1.2rem;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
}
```

with:

```css
.settings-wrap {
  --main-theme-color: var(--pink);
  --hot-theme-color: var(--hot-pink);
  --header-text-color: var(--white);
  --scroller-radius: 7px;
  color: #fff;
  font-size: 1.2rem;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
  min-width: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}
```

(`.section-enabler-disabled`, below it in the same file, is unchanged.)

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev` (only if your human partner has approved running it) and check:

- Selecting different rows in the file list updates the preview.
- Before compressing, the preview shows the original on both sides of the slider with a "Not compressed yet" label.
- After clicking "Compress all", each row's status dot updates, the preview's right pane updates once that file is done, and the stats row shows correct sizes/dimensions/percent saved.
- A file that errors shows its error message in the preview instead of a diff.
- "Compress all" stays disabled after the batch starts; "Download ZIP" enables once every file is done or errored and at least one succeeded.
- Resizing the browser window below ~860px stacks the three columns vertically without any column becoming unreachable.

- [ ] **Step 6: Commit**

```bash
git add src/client/lazy-app/BulkCompress/index.tsx src/client/lazy-app/BulkCompress/style.css src/client/lazy-app/BulkCompress/Settings/style.css
git commit -m "feat(bulk-compress): add top bar and three-column grid layout"
```
