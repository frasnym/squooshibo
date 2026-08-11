# Bulk Compress As Main Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bulk Compress the app's only screen (no landing page, no single-image editor), per `docs/superpowers/specs/2026-08-10-bulk-compress-as-main-screen-design.md`.

**Architecture:** Two prep tasks extract the parts of `Compress/` that are actually shared infrastructure, not editor-specific (a component library, and the `SourceImage` type), so the rest of `Compress/` can be deleted safely. A third task rewrites `App/index.tsx` to always render `BulkCompress` (starting empty) and makes `BulkCompress` support that empty start. A fourth task deletes `Compress/` and `Intro/` outright and updates the two build-pipeline files that reference them by literal path.

**Tech Stack:** Preact class components, CSS Modules, the project's custom Rollup plugins (`entry-data:`, `client-bundle:`) for service-worker precaching — no test framework, verification is `npm run build`.

## Global Constraints

- `Compress/Options/` (the `Select`, `Toggle`, `Expander`, `Checkbox`, `Range`, `Revealer` controls and their shared `style.css`) is a generic component library used by every encoder/processor panel and `BulkCompress/Settings` — it is NOT single-editor-specific and must survive the deletion, relocated to `client/lazy-app/Options/`.
- `SourceImage` (currently defined in `Compress/index.tsx`) moves to `client/lazy-app/pipeline.ts`, which both of its external consumers (`BulkCompress/index.tsx`, `features/processors/resize/client/index.tsx`) already import from.
- `BulkCompress` exposes a public `addFiles(files: File[])` method (renamed from the existing private `onAddFiles`) — `App` calls it via a ref on the mounted instance, since `BulkCompress` is now mounted for the app's entire lifetime and needs to receive files from drag-and-drop/share-target after mount, not just at mount via props.
- `BulkCompress`'s worker pool (`workerBridges`) can no longer be sized once at mount from `props.files.length`, since that can now be `0`. It's created fresh inside `onCompressAllClick`, sized from `state.results.length` at click time.
- `BulkCompress`'s resize-reference-dimension probe (`loadFirstFileInfo`) runs against `props.files[0]` at mount only if `props.files.length > 0`; it also runs from `addFiles` the first time the batch gets a file and `firstFileInfo` is still unset — so whichever file becomes the batch's first file, whenever that happens, seeds the resize reference. Once set, it's never recomputed (unchanged from existing delete-file behavior).
- The single-image editor's palette reduction (quantize) and rotate capabilities are not ported to Bulk Compress — they go away entirely. This is accepted, not a gap to fix in this plan.
- No change to the PWA manifest's `share_target` configuration.

---

### Task 1: Relocate the shared Options component library

**Files:**

- Move: `src/client/lazy-app/Compress/Options/{Checkbox,Expander,Range,Revealer,Select,Toggle}/` → `src/client/lazy-app/Options/{Checkbox,Expander,Range,Revealer,Select,Toggle}/`
- Move: `src/client/lazy-app/Compress/Options/style.css` → `src/client/lazy-app/Options/style.css`
- Modify: `src/client/lazy-app/Options/Checkbox/index.tsx`, `src/client/lazy-app/Options/Expander/index.tsx`, `src/client/lazy-app/Options/Revealer/index.tsx` (relative import paths, see Step 2)
- Modify: `src/features/processors/quantize/client/index.tsx`, `src/features/encoders/jxl/client/index.tsx`, `src/features/encoders/wp2/client/index.tsx`, `src/features/encoders/webP/client/index.tsx`, `src/features/encoders/oxiPNG/client/index.tsx`, `src/features/encoders/avif/client/index.tsx`, `src/features/encoders/mozJPEG/client/index.tsx`, `src/features/client-utils/index.tsx`, `src/features/processors/resize/client/index.tsx`, `src/client/lazy-app/BulkCompress/Settings/index.tsx`

**Interfaces:**

- Produces: `client/lazy-app/Options/{Checkbox,Expander,Range,Revealer,Select,Toggle}` and `client/lazy-app/Options/style.css` as the new import paths for these components — every later task that touches these files uses the new path.

- [ ] **Step 1: Move the directories and stylesheet**

```bash
mkdir -p src/client/lazy-app/Options
git mv src/client/lazy-app/Compress/Options/Checkbox src/client/lazy-app/Options/Checkbox
git mv src/client/lazy-app/Compress/Options/Expander src/client/lazy-app/Options/Expander
git mv src/client/lazy-app/Compress/Options/Range src/client/lazy-app/Options/Range
git mv src/client/lazy-app/Compress/Options/Revealer src/client/lazy-app/Options/Revealer
git mv src/client/lazy-app/Compress/Options/Select src/client/lazy-app/Options/Select
git mv src/client/lazy-app/Compress/Options/Toggle src/client/lazy-app/Options/Toggle
git mv src/client/lazy-app/Compress/Options/style.css src/client/lazy-app/Options/style.css
```

(`Compress/Options/index.tsx` and `Compress/Options/style.css.d.ts` are NOT moved — the former is the single-image editor's own orchestrating panel, which stays in `Compress/` and is deleted in Task 4; the latter is a gitignored, auto-generated file that will regenerate at the new location on the next build.)

- [ ] **Step 2: Fix relative imports inside the moved files**

Three of the moved components import from outside their own directory using relative paths (`../../../icons`, `../../../util`) that assumed the old, one-level-deeper nesting under `Compress/`. Fix each:

In `src/client/lazy-app/Options/Checkbox/index.tsx`, replace:

```tsx
import { UncheckedIcon, CheckedIcon } from '../../../icons';
```

with:

```tsx
import { UncheckedIcon, CheckedIcon } from '../../icons';
```

In `src/client/lazy-app/Options/Expander/index.tsx`, replace:

```tsx
import { transitionHeight } from '../../../util';
```

with:

```tsx
import { transitionHeight } from '../../util';
```

In `src/client/lazy-app/Options/Revealer/index.tsx`, replace:

```tsx
import { Arrow } from '../../../icons';
```

with:

```tsx
import { Arrow } from '../../icons';
```

(`Select/index.tsx` and `Toggle/index.tsx` use the `client/lazy-app/icons` module-alias style or have no external relative imports — unaffected by the move. `Range/index.tsx` and its own `custom-els/RangeInput` are self-contained — unaffected.)

- [ ] **Step 3: Update every external import site**

In each file below, every occurrence of `client/lazy-app/Compress/Options` becomes `client/lazy-app/Options`. The exact current lines (verified against the actual files) are shown so you can find and replace them precisely — everything else in each file is unchanged.

`src/features/processors/quantize/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
```

and:

```tsx
import Expander from 'client/lazy-app/Compress/Options/Expander';
import Select from 'client/lazy-app/Compress/Options/Select';
import Range from 'client/lazy-app/Compress/Options/Range';
```

→

```tsx
import Expander from 'client/lazy-app/Options/Expander';
import Select from 'client/lazy-app/Options/Select';
import Range from 'client/lazy-app/Options/Range';
```

`src/features/encoders/jxl/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Range from 'client/lazy-app/Compress/Options/Range';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
import Expander from 'client/lazy-app/Compress/Options/Expander';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
import Range from 'client/lazy-app/Options/Range';
import Checkbox from 'client/lazy-app/Options/Checkbox';
import Expander from 'client/lazy-app/Options/Expander';
```

`src/features/encoders/wp2/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Range from 'client/lazy-app/Compress/Options/Range';
import Select from 'client/lazy-app/Compress/Options/Select';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
import Expander from 'client/lazy-app/Compress/Options/Expander';
```

and further down:

```tsx
import Revealer from 'client/lazy-app/Compress/Options/Revealer';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
import Range from 'client/lazy-app/Options/Range';
import Select from 'client/lazy-app/Options/Select';
import Checkbox from 'client/lazy-app/Options/Checkbox';
import Expander from 'client/lazy-app/Options/Expander';
```

and:

```tsx
import Revealer from 'client/lazy-app/Options/Revealer';
```

`src/features/encoders/webP/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
```

and:

```tsx
import Range from 'client/lazy-app/Compress/Options/Range';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
import Expander from 'client/lazy-app/Compress/Options/Expander';
import Select from 'client/lazy-app/Compress/Options/Select';
import Revealer from 'client/lazy-app/Compress/Options/Revealer';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
```

and:

```tsx
import Range from 'client/lazy-app/Options/Range';
import Checkbox from 'client/lazy-app/Options/Checkbox';
import Expander from 'client/lazy-app/Options/Expander';
import Select from 'client/lazy-app/Options/Select';
import Revealer from 'client/lazy-app/Options/Revealer';
```

`src/features/encoders/oxiPNG/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Range from 'client/lazy-app/Compress/Options/Range';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
import Range from 'client/lazy-app/Options/Range';
import Checkbox from 'client/lazy-app/Options/Checkbox';
```

`src/features/encoders/avif/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
import Expander from 'client/lazy-app/Compress/Options/Expander';
import Select from 'client/lazy-app/Compress/Options/Select';
import Range from 'client/lazy-app/Compress/Options/Range';
```

and further down:

```tsx
import Revealer from 'client/lazy-app/Compress/Options/Revealer';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
import Checkbox from 'client/lazy-app/Options/Checkbox';
import Expander from 'client/lazy-app/Options/Expander';
import Select from 'client/lazy-app/Options/Select';
import Range from 'client/lazy-app/Options/Range';
```

and:

```tsx
import Revealer from 'client/lazy-app/Options/Revealer';
```

`src/features/encoders/mozJPEG/client/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
```

and:

```tsx
import Range from 'client/lazy-app/Compress/Options/Range';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
import Expander from 'client/lazy-app/Compress/Options/Expander';
import Select from 'client/lazy-app/Compress/Options/Select';
import Revealer from 'client/lazy-app/Compress/Options/Revealer';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
```

and:

```tsx
import Range from 'client/lazy-app/Options/Range';
import Checkbox from 'client/lazy-app/Options/Checkbox';
import Expander from 'client/lazy-app/Options/Expander';
import Select from 'client/lazy-app/Options/Select';
import Revealer from 'client/lazy-app/Options/Revealer';
```

`src/features/client-utils/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Range from 'client/lazy-app/Compress/Options/Range';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
import Range from 'client/lazy-app/Options/Range';
```

`src/features/processors/resize/client/index.tsx` — only these lines (its `SourceImage` import, on a separate line in this same file, is handled in Task 2, not here):

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
```

and:

```tsx
import Select from 'client/lazy-app/Compress/Options/Select';
import Expander from 'client/lazy-app/Compress/Options/Expander';
import Checkbox from 'client/lazy-app/Compress/Options/Checkbox';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
```

and:

```tsx
import Select from 'client/lazy-app/Options/Select';
import Expander from 'client/lazy-app/Options/Expander';
import Checkbox from 'client/lazy-app/Options/Checkbox';
```

`src/client/lazy-app/BulkCompress/Settings/index.tsx`:

```tsx
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Select from 'client/lazy-app/Compress/Options/Select';
import Toggle from 'client/lazy-app/Compress/Options/Toggle';
import Expander from 'client/lazy-app/Compress/Options/Expander';
```

→

```tsx
import * as style from 'client/lazy-app/Options/style.css';
import Select from 'client/lazy-app/Options/Select';
import Toggle from 'client/lazy-app/Options/Toggle';
import Expander from 'client/lazy-app/Options/Expander';
```

- [ ] **Step 4: Fix Compress/Options/index.tsx's now-broken relative imports**

`Compress/Options/index.tsx` (the single-image editor's own orchestrating panel — it stays behind for now and is deleted whole in Task 4) imports its former sibling leaf components via relative paths like `./Select`, `./Toggle`, `./Checkbox`. Those no longer exist after Step 1's move, so this file — and transitively `Compress/index.tsx`, and transitively the whole build, since `npm run build`'s type-checker checks the entire `src/` tree regardless of what's reachable from an entry point — would fail to compile without this fix. Since `Compress/Options/index.tsx` is deleted in Task 4 anyway, this is a throwaway fix purely to keep the codebase compiling in the meantime.

In `src/client/lazy-app/Compress/Options/index.tsx`, replace:

```tsx
import Expander from './Expander';
import Toggle from './Toggle';
import Select from './Select';
```

with:

```tsx
import Expander from '../../Options/Expander';
import Toggle from '../../Options/Toggle';
import Select from '../../Options/Select';
```

(`import { Options as QuantOptionsComponent } from 'features/processors/quantize/client';` and the equivalent `resize/client` line, elsewhere in this same file, are unaffected — those two feature modules are updated in this same task's Step 3, so they already resolve correctly.) Also fix this file's own stylesheet import — it currently reads `Compress/Options/style.css`, which no longer exists there after Step 1's move. Replace:

```tsx
import * as style from './style.css';
import 'add-css:./style.css';
```

with:

```tsx
import * as style from '../../Options/style.css';
import 'add-css:../../Options/style.css';
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/client/lazy-app/Options src/client/lazy-app/Compress/Options src/features src/client/lazy-app/BulkCompress/Settings/index.tsx
git commit -m "refactor(client): relocate shared Options component library out of the single-image editor"
```

---

### Task 2: Move SourceImage into pipeline.ts

**Files:**

- Modify: `src/client/lazy-app/pipeline.ts`
- Modify: `src/client/lazy-app/Compress/index.tsx`
- Modify: `src/client/lazy-app/BulkCompress/index.tsx`
- Modify: `src/features/processors/resize/client/index.tsx`

**Interfaces:**

- Produces: `SourceImage` exported from `client/lazy-app/pipeline` — Task 3's full rewrite of `BulkCompress/index.tsx` assumes this import path already works.

- [ ] **Step 1: Add SourceImage to pipeline.ts**

In `src/client/lazy-app/pipeline.ts`, after the existing imports (after the `import type WorkerBridge from './worker-bridge';` line) and before `export async function decodeImage`, add:

```ts
export interface SourceImage {
  file: File;
  decoded: ImageData;
  preprocessed: ImageData;
  vectorImage?: HTMLImageElement;
}
```

- [ ] **Step 2: Remove the old definition from Compress/index.tsx and re-import it**

In `src/client/lazy-app/Compress/index.tsx`, replace:

```tsx
import { decodeImage, compressImage, processSvg } from '../pipeline';
```

with:

```tsx
import { decodeImage, compressImage, processSvg } from '../pipeline';
import type { SourceImage } from '../pipeline';
```

Then delete the now-duplicate local definition — replace:

```tsx
export type OutputType = EncoderType | 'identity';

export interface SourceImage {
  file: File;
  decoded: ImageData;
  preprocessed: ImageData;
  vectorImage?: HTMLImageElement;
}

interface SideSettings {
```

with:

```tsx
export type OutputType = EncoderType | 'identity';

interface SideSettings {
```

- [ ] **Step 3: Update BulkCompress/index.tsx's import**

In `src/client/lazy-app/BulkCompress/index.tsx`, replace:

```tsx
import type { SourceImage } from '../Compress';
```

with:

```tsx
import type { SourceImage } from '../pipeline';
```

- [ ] **Step 4: Update resize/client/index.tsx's import**

In `src/features/processors/resize/client/index.tsx`, replace:

```tsx
import type { SourceImage } from 'client/lazy-app/Compress';
```

with:

```tsx
import type { SourceImage } from 'client/lazy-app/pipeline';
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/client/lazy-app/pipeline.ts src/client/lazy-app/Compress/index.tsx src/client/lazy-app/BulkCompress/index.tsx src/features/processors/resize/client/index.tsx
git commit -m "refactor(client): move SourceImage type into pipeline.ts"
```

---

### Task 3: App always renders Bulk Compress, with empty-start support

**Files:**

- Modify: `src/client/initial-app/App/index.tsx`
- Modify: `src/client/lazy-app/BulkCompress/index.tsx`
- Modify: `src/client/lazy-app/BulkCompress/style.css`
- Modify: `src/sw/to-cache.ts`

**Interfaces:**

- Consumes: `SourceImage` from `client/lazy-app/pipeline` (Task 2).
- Produces: `BulkCompress`'s `Props` drops `onBack`; it gains a public `addFiles(files: File[]): void` method. `App` no longer has `onBack`/`back()`, `Intro`, `Compress`, `isEditorOpen`, or route-handling — nothing later depends on those.

**Note (discovered during implementation, not in the original plan):** `src/sw/to-cache.ts` uses the custom `entry-data:` Rollup plugin to look up build output for `client/lazy-app/Compress` and `shared/prerendered-app/Intro/blob-anim` by literal module path — this only resolves if those modules are still reachable from the client bundle's entry point. The moment `App/index.tsx` (this task) stops importing them, they drop out of the active build graph and `entry-data:` can no longer resolve them, breaking `npm run build` at the precache-manifest step even though the files still physically exist on disk. This is a plan-sequencing gap: the `to-cache.ts` update (originally planned as Task 4, Step 2) must land in THIS task instead, so Task 3's own build verification actually passes. Task 4 below has been adjusted accordingly — it no longer includes a `to-cache.ts` step.

- [ ] **Step 1: Replace BulkCompress/index.tsx**

Replace the full contents of `src/client/lazy-app/BulkCompress/index.tsx` with:

```tsx
import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import { EncoderState, ProcessorOptions, encoderMap } from '../feature-meta';
import { decodeImage, compressImage, processSvg } from '../pipeline';
import type { SourceImage } from '../pipeline';
import { resize } from 'features/processors/resize/client';
import { defaultOptions as defaultResizeOptions } from 'features/processors/resize/shared/meta';
import { drawableToImageData } from '../util/canvas';
import WorkerBridge from '../worker-bridge';
import Settings, { FirstFileInfo } from './Settings';
import FileList, { ResultItem } from './FileList';
import Preview from './Preview';
import { createZip } from './zip';

const POOL_SIZE = 4;

interface Props {
  files: File[];
  showSnack: SnackBarElement['showSnackbar'];
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
  private batchSettings: {
    encoderState: EncoderState;
    resizeEnabled: boolean;
    resizeOptions: ProcessorOptions['resize'];
  } | null = null;
  private nextId = this.props.files.length;

  componentDidMount(): void {
    if (this.props.files.length > 0) {
      this.loadFirstFileInfo(this.props.files[0]);
    }
  }

  componentWillUnmount(): void {
    this.abortController.abort();
    for (const result of this.state.results) {
      URL.revokeObjectURL(result.previewUrl);
      if (result.downloadUrl) URL.revokeObjectURL(result.downloadUrl);
    }
  }

  private loadFirstFileInfo = async (file: File): Promise<void> => {
    const signal = this.abortController.signal;

    try {
      let width: number;
      let height: number;
      let isVector = false;

      if (isSvg(file)) {
        const vectorImage = await processSvg(signal, file);
        width = vectorImage.width;
        height = vectorImage.height;
        isVector = true;
      } else {
        const imageData = await decodeImage(signal, file, new WorkerBridge());
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

  public addFiles = (files: File[]): void => {
    if (this.state.started || files.length === 0) return;
    if (!this.state.firstFileInfo) {
      this.loadFirstFileInfo(files[0]);
    }
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

  private updateResult = (id: number, patch: Partial<ResultItem>): void => {
    this.setState((state) => ({
      results: state.results.map((result) =>
        result.id === id ? { ...result, ...patch } : result,
      ),
    }));
  };

  private processFile = async (
    id: number,
    workerBridge: WorkerBridge,
  ): Promise<void> => {
    const signal = this.abortController.signal;
    // Deletion is disabled once the batch starts (see onRemoveFile), so
    // every id queued in onCompressAllClick is guaranteed to still be
    // present here.
    const { sourceFile } = this.state.results.find((r) => r.id === id)!;

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

      // Use the settings snapshot taken when the batch started, not live
      // state, so every file in one "Compress all" run shares the exact
      // same format/quality/resize settings even if the user edits the
      // sidebar mid-batch.
      const { encoderState, resizeEnabled, resizeOptions } =
        this.batchSettings!;

      if (resizeEnabled) {
        const source: SourceImage = {
          file: sourceFile,
          decoded: imageData,
          preprocessed: imageData,
          vectorImage,
        };
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
        encoderState,
        sourceFile.name,
        workerBridge,
      );

      this.updateResult(id, {
        status: 'done',
        outputFile,
        outputWidth: processedData.width,
        outputHeight: processedData.height,
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
    this.batchSettings = {
      encoderState: this.state.encoderState,
      resizeEnabled: this.state.resizeEnabled,
      resizeOptions: this.state.resizeOptions,
    };
    this.setState({ started: true });

    const queue = this.state.results.map((result) => result.id);
    const workerBridges = Array.from(
      { length: Math.min(POOL_SIZE, queue.length) },
      () => new WorkerBridge(),
    );

    await Promise.all(
      workerBridges.map(async (workerBridge) => {
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
    {}: Props,
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
          <span class={style.status}>
            {doneCount} of {results.length} ready
          </span>
          <div class={style.actions}>
            <button
              class={style.compressAllBtn}
              onClick={this.onCompressAllClick}
              disabled={started || results.length === 0}
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
            addDisabled={started}
            removeDisabled={started}
            onSelect={this.onSelectFile}
            onAddFiles={this.addFiles}
            onRemove={this.onRemoveFile}
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
            disabled={started}
          />
        </div>
      </div>
    );
  }
}
```

Key differences from the previous version: `Props` no longer has `onBack`; `workerBridges` is no longer a mount-time field (created locally inside `onCompressAllClick`, sized from the queue at click time); `loadFirstFileInfo` takes an explicit `file` argument and is called both from `componentDidMount` (guarded on a non-empty `props.files`) and from the renamed `addFiles` (guarded on `!firstFileInfo`, the first time the batch gets any file); `onAddFiles` is renamed to `public addFiles` and gains an empty-array guard since it's now a public API surface, not only an internal prop handler; the top bar's "← Back" button and its `onBack` wiring are removed.

- [ ] **Step 2: Update BulkCompress/style.css — remove the Back button styling, adjust the top bar grid**

Replace:

```css
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
```

with:

```css
.top-bar {
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  color: var(--white);
}

.status {
  justify-self: start;
  font-size: 0.9rem;
  color: var(--less-light-gray);
}
```

Every other rule in the file is unchanged.

- [ ] **Step 3: Replace App/index.tsx**

Replace the full contents of `src/client/initial-app/App/index.tsx` with:

```tsx
import type { FileDropEvent } from 'file-drop-element';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import type { SnackOptions } from 'shared/custom-els/snack-bar';

import { h, Component } from 'preact';

import { linkRef } from 'shared/prerendered-app/util';
import * as style from './style.css';
import 'add-css:./style.css';
import 'file-drop-element';
import 'shared/custom-els/snack-bar';
import 'shared/custom-els/loading-spinner';

const bulkCompressPromise = import('client/lazy-app/BulkCompress');
const swBridgePromise = import('client/lazy-app/sw-bridge');

type BulkCompressComponent = InstanceType<
  typeof import('client/lazy-app/BulkCompress').default
>;

interface Props {}

interface State {
  awaitingShareTarget: boolean;
  pendingFiles: File[];
  BulkCompress?: typeof import('client/lazy-app/BulkCompress').default;
}

export default class App extends Component<Props, State> {
  state: State = {
    awaitingShareTarget: new URL(location.href).searchParams.has(
      'share-target',
    ),
    pendingFiles: [],
    BulkCompress: undefined,
  };

  snackbar?: SnackBarElement;
  bulkCompress?: BulkCompressComponent;

  constructor() {
    super();

    bulkCompressPromise
      .then((module) => {
        this.setState({ BulkCompress: module.default });
      })
      .catch(() => {
        this.showSnack('Failed to load app');
      });

    swBridgePromise.then(async ({ offliner, getSharedImage }) => {
      offliner(this.showSnack);
      if (!this.state.awaitingShareTarget) return;
      const file = await getSharedImage();
      // Remove the ?share-target from the URL
      history.replaceState('', '', '/');
      this.setState({ awaitingShareTarget: false });
      this.addFiles([file]);
    });

    // Since iOS 10, Apple tries to prevent disabling pinch-zoom. This is great in theory, but
    // really breaks things on Squoosh, as you can easily end up zooming the UI when you mean to
    // zoom the image. Once you've done this, it's really difficult to undo. Anyway, this seems to
    // prevent it.
    document.body.addEventListener('gesturestart', (event: any) => {
      event.preventDefault();
    });
  }

  private addFiles = (files: File[]): void => {
    if (this.bulkCompress) {
      this.bulkCompress.addFiles(files);
      return;
    }
    // BulkCompress hasn't mounted yet (still loading, or awaiting a
    // share-target file) — buffer the files and hand them over as its
    // initial `files` prop once it does mount.
    this.setState((state) => ({
      pendingFiles: [...state.pendingFiles, ...files],
    }));
  };

  private onFileDrop = ({ files }: FileDropEvent) => {
    if (!files || files.length === 0) return;
    this.addFiles(files);
  };

  private showSnack = (
    message: string,
    options: SnackOptions = {},
  ): Promise<string> => {
    if (!this.snackbar) throw Error('Snackbar missing');
    return this.snackbar.showSnackbar(message, options);
  };

  render(
    {}: Props,
    { BulkCompress, awaitingShareTarget, pendingFiles }: State,
  ) {
    const showSpinner = awaitingShareTarget || !BulkCompress;

    return (
      <div class={style.app}>
        <file-drop onfiledrop={this.onFileDrop} class={style.drop}>
          {showSpinner ? (
            <loading-spinner class={style.appLoader} />
          ) : (
            BulkCompress && (
              <BulkCompress
                files={pendingFiles}
                showSnack={this.showSnack}
                ref={linkRef(this, 'bulkCompress')}
              />
            )
          )}
          <snack-bar ref={linkRef(this, 'snackbar')} />
        </file-drop>
      </div>
    );
  }
}
```

This drops `Intro`, `Compress`, `ROUTE_EDITOR`/`isEditorOpen`/`openEditor`/`onPopState`/`popstate` handling, and `onIntroPickFile`/`onIntroPickFiles` entirely — `App` now always renders `BulkCompress` once it's loaded (and any share-target wait is resolved), starting with whatever files were dropped or shared while it was still loading (`pendingFiles`), or empty otherwise. `back()`/`onBack` are gone since there's no other screen to return to.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. (`Compress/` and `Intro/` still exist on disk and still compile on their own at this point — nothing in this task deletes them, it only stops `App` from referencing them. That happens in Task 4.)

- [ ] **Step 5: Manual verification**

Run `npm run dev` (only if your human partner has approved running it) and check:

- Loading the app shows a brief spinner, then Bulk Compress with an empty file list, both top-bar buttons disabled.
- Dragging and dropping multiple files onto the page adds them all to the batch (not just one).
- Clicking "+ Add more images" still works as before.
- There is no "← Back" button anywhere.

- [ ] **Step 6: Commit**

```bash
git add src/client/initial-app/App/index.tsx src/client/lazy-app/BulkCompress/index.tsx src/client/lazy-app/BulkCompress/style.css src/sw/to-cache.ts
git commit -m "feat(app): always render Bulk Compress, starting empty"
```

---

### Task 4: Delete Compress/ and Intro/, update the build pipeline

**Files:**

- Delete: `src/client/lazy-app/Compress/` (entire remaining directory)
- Delete: `src/shared/prerendered-app/Intro/` (entire directory)
- Modify: `src/static-build/pages/index/index.tsx`
- Modify: `src/client/missing-types.d.ts`
- Modify: `src/static-build/missing-types.d.ts`

**Interfaces:**

- Consumes: Tasks 1–3 must be complete — this task assumes `Compress/`'s only remaining content is the single-image editor itself (Options/index.tsx and the leaf components already moved out in Task 1, `SourceImage` already moved out in Task 2), and that nothing under `App/` or elsewhere still imports from `Compress/` or `Intro/` (Task 3). `src/sw/to-cache.ts` was ALREADY updated in Task 3 (a plan-sequencing fix discovered during implementation — see Task 3's note) — do not touch it again here.

**Note (discovered during implementation, not in the original plan):** `src/client/lazy-app/BulkCompress/Preview/index.tsx` has a live import of `Compress/Output/custom-els/TwoUp` — the generic before/after split-view custom element, reused (by design, from the original bulk-compress relayout plan) rather than reimplemented. This was never relocated in Task 1 (Task 1 only covered `Compress/Options/`), so deleting `Compress/` wholesale breaks `BulkCompress/Preview`. `Compress/Output/custom-els/PinchZoom/` (`TwoUp`'s sibling) has no consumers outside `Compress/` and needs no relocation — confirmed via `grep -rln "custom-els/PinchZoom" src` excluding `Compress/` itself, zero results. Step 1 below has been adjusted to relocate `TwoUp` first.

- [ ] **Step 1: Relocate the TwoUp custom element, then delete both directories**

`TwoUp` has exactly one consumer (`BulkCompress/Preview`), so it moves directly under that consumer rather than to a generic shared location (unlike `Options`, which had 10+ consumers and genuinely needed a shared home):

```bash
mkdir -p src/client/lazy-app/BulkCompress/Preview/custom-els
git mv src/client/lazy-app/Compress/Output/custom-els/TwoUp src/client/lazy-app/BulkCompress/Preview/custom-els/TwoUp
```

In `src/client/lazy-app/BulkCompress/Preview/index.tsx`, replace:

```tsx
import '../../Compress/Output/custom-els/TwoUp';
```

with:

```tsx
import './custom-els/TwoUp';
```

`TwoUp/index.ts` and its sibling files (`styles.css`, `missing-types.d.ts`) have no relative imports reaching outside their own directory (unlike some of the `Options` leaf components in Task 1) — confirm this by reading them before assuming, but no path fixes inside `TwoUp/` itself are expected.

Then delete both remaining directories:

```bash
git rm -r src/client/lazy-app/Compress
git rm -r src/shared/prerendered-app/Intro
```

- [ ] **Step 2: Replace the prerendered static shell**

In `src/static-build/pages/index/index.tsx`, replace:

```tsx
import Intro from 'shared/prerendered-app/Intro';
```

with:

```tsx
import 'shared/custom-els/loading-spinner';
```

Then replace:

```tsx
      <div id="app">
        <Intro />
```

with:

```tsx
      <div id="app">
        <loading-spinner />
```

Nothing else in this file changes — the `<head>` metadata (title, OG tags, favicon, manifest link, canonical URL) is unrelated to `Intro` and stays exactly as-is. `Intro`'s prerendered markup was meaningful marketing content visible before JS loaded; `BulkCompress` needs client JS/WASM regardless of what's prerendered, so a minimal loading shell (the same custom element `App` itself shows while loading) replaces it.

- [ ] **Step 3: Remove the dangling Intro type references**

In `src/client/missing-types.d.ts`, replace:

```ts
/// <reference path="../../missing-types.d.ts" />
/// <reference path="../shared/prerendered-app/Intro/missing-types.d.ts" />
```

with:

```ts
/// <reference path="../../missing-types.d.ts" />
```

In `src/static-build/missing-types.d.ts`, replace:

```ts
/// <reference path="../../missing-types.d.ts" />
/// <reference path="../shared/prerendered-app/Intro/missing-types.d.ts" />
```

with:

```ts
/// <reference path="../../missing-types.d.ts" />
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors, and no reference anywhere to `client/lazy-app/Compress` or `shared/prerendered-app/Intro`. As a final check, run:

```bash
grep -rn "lazy-app/Compress'\|lazy-app/Compress\"\|prerendered-app/Intro" src
```

Expected: no output. This grep matches only whole-module-specifier references ending in a quote (so it won't false-positive on `client/lazy-app/Compress/Options`-style paths, which no longer exist after Task 1 anyway). If it matches anything, investigate and fix before proceeding.

- [ ] **Step 5: Manual verification**

Run `npm run dev` (only if your human partner has approved running it) and check:

- The app loads directly into Bulk Compress — no landing page.
- The full flow works end-to-end: add files, compress, preview, download ZIP.
- If testable in your environment, confirm no 404s or console errors related to missing chunks (the old `Compress`/`Intro` lazy-loaded bundles).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): remove the single-image editor and landing screen"
```
