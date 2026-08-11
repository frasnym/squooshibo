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
