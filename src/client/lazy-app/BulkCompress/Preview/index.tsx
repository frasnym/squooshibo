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
