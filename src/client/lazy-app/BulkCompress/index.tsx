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
