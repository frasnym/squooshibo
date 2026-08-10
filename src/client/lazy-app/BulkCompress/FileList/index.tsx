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
