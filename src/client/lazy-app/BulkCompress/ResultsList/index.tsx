import { h, FunctionComponent } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import { DownloadIcon } from 'client/lazy-app/icons';
import prettyBytes from '../../util/pretty-bytes';

export interface ResultItem {
  id: number;
  sourceFile: File;
  status: 'queued' | 'processing' | 'done' | 'error';
  outputFile?: File;
  downloadUrl?: string;
  errorMessage?: string;
}

function sizeChange(
  original: number,
  compressed: number,
): { arrow: string; percent: number } {
  const diff = compressed / original;
  const absolutePercent = Math.round(Math.abs(diff) * 100);
  const percent = diff > 1 ? absolutePercent - 100 : 100 - absolutePercent;
  return { arrow: diff < 1 ? '↓' : '↑', percent: Math.abs(percent) };
}

interface Props {
  results: ResultItem[];
}

const ResultsList: FunctionComponent<Props> = ({ results }) => (
  <ul class={style.list}>
    {results.map((result) => (
      <li class={style.row} key={result.id}>
        <span class={style.name}>{result.sourceFile.name}</span>
        <span class={style.status}>
          {result.status === 'queued' && 'Queued'}
          {result.status === 'processing' && 'Compressing…'}
          {result.status === 'error' && (result.errorMessage || 'Failed')}
          {result.status === 'done' &&
            result.outputFile &&
            (() => {
              const from = prettyBytes(result.sourceFile.size);
              const to = prettyBytes(result.outputFile.size);
              const { arrow, percent } = sizeChange(
                result.sourceFile.size,
                result.outputFile.size,
              );
              return `${from.value}${from.unit} → ${to.value}${to.unit} (${arrow}${percent}%)`;
            })()}
        </span>
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

export default ResultsList;
