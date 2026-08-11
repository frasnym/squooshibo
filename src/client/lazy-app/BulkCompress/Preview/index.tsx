import { h, Component } from 'preact';
import './custom-els/TwoUp';

import * as style from './style.css';
import 'add-css:./style.css';
import prettyBytes from '../../util/pretty-bytes';
import { sizeChange } from '../util';
import type { ResultItem } from '../FileList';

interface Props {
  result?: ResultItem;
}

interface State {
  beforeErrored: boolean;
  afterErrored: boolean;
}

const statusLabels: Record<ResultItem['status'], string> = {
  queued: 'Not compressed yet',
  processing: 'Compressing…',
  done: '',
  error: '',
};

function getAfterUrl(result?: ResultItem): string | undefined {
  if (!result) return undefined;
  return result.status === 'done' && result.downloadUrl
    ? result.downloadUrl
    : result.previewUrl;
}

export default class Preview extends Component<Props, State> {
  state: State = {
    beforeErrored: false,
    afterErrored: false,
  };

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.result?.id !== this.props.result?.id) {
      this.setState({ beforeErrored: false, afterErrored: false });
      return;
    }
    if (getAfterUrl(prevProps.result) !== getAfterUrl(this.props.result)) {
      this.setState({ afterErrored: false });
    }
  }

  private onBeforeError = (): void => {
    this.setState({ beforeErrored: true });
  };

  private onAfterError = (): void => {
    this.setState({ afterErrored: true });
  };

  render({ result }: Props, { beforeErrored, afterErrored }: State) {
    if (!result) return <div class={style.preview} />;

    const afterUrl = getAfterUrl(result);
    const previewErrored = beforeErrored || afterErrored;

    const statusLabel =
      result.status === 'error'
        ? result.errorMessage || 'Failed'
        : previewErrored
        ? 'Preview unavailable for this format'
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
            <img
              class={style.image}
              src={result.previewUrl}
              alt="Original"
              onError={this.onBeforeError}
            />
            <img
              class={style.image}
              src={afterUrl}
              alt="Compressed"
              onError={this.onAfterError}
            />
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
  }
}
