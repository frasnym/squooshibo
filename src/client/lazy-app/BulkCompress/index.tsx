import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import { EncoderState, encoderMap } from '../feature-meta';
import { decodeImage, compressImage, processSvg } from '../pipeline';
import { drawableToImageData } from '../util/canvas';
import { cleanMerge } from '../util/clean-modify';
import WorkerBridge from '../worker-bridge';
import Settings from './Settings';
import ResultsList, { ResultItem } from './ResultsList';
import { createZip } from './zip';

const POOL_SIZE = 4;

interface Props {
  files: File[];
  showSnack: SnackBarElement['showSnackbar'];
  onBack: () => void;
}

interface State {
  encoderState: EncoderState;
  results: ResultItem[];
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
    results: this.props.files.map((file, id) => ({
      id,
      sourceFile: file,
      status: 'queued',
    })),
    started: false,
    zipping: false,
  };

  private abortController = new AbortController();
  private workerBridges = Array.from(
    { length: Math.min(POOL_SIZE, this.props.files.length) },
    () => new WorkerBridge(),
  );

  componentWillUnmount(): void {
    this.abortController.abort();
    for (const result of this.state.results) {
      if (result.downloadUrl) URL.revokeObjectURL(result.downloadUrl);
    }
  }

  private onEncoderStateChange = (encoderState: EncoderState): void => {
    this.setState({ encoderState });
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
      const imageData = isSvg(sourceFile)
        ? drawableToImageData(await processSvg(signal, sourceFile))
        : await decodeImage(signal, sourceFile, workerBridge);

      const outputFile = await compressImage(
        signal,
        imageData,
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
    { encoderState, results, started, zipping }: State,
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
        {started && <ResultsList results={results} />}
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
