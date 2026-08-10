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
