import { h, Component } from 'preact';

import * as wrapStyle from './style.css';
import 'add-css:./style.css';
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Select from 'client/lazy-app/Compress/Options/Select';
import {
  EncoderState,
  EncoderOptions,
  EncoderType,
  encoderMap,
} from 'client/lazy-app/feature-meta';
import {
  supportedEncoderMapP,
  PartialButNotUndefined,
} from 'client/lazy-app/util/supported-encoders';

interface Props {
  encoderState: EncoderState;
  onEncoderStateChange(newState: EncoderState): void;
}

interface State {
  supportedEncoderMap?: PartialButNotUndefined<typeof encoderMap>;
}

export default class Settings extends Component<Props, State> {
  state: State = {
    supportedEncoderMap: undefined,
  };

  constructor(props: Props) {
    super(props);
    supportedEncoderMapP.then((supportedEncoderMap) =>
      this.setState({ supportedEncoderMap }),
    );
  }

  private onEncoderTypeChange = (event: Event) => {
    const type = (event.currentTarget as HTMLSelectElement)
      .value as EncoderType;
    this.props.onEncoderStateChange({
      type,
      options: encoderMap[type].meta.defaultOptions,
    } as EncoderState);
  };

  private onEncoderOptionsChange = (newOptions: EncoderOptions) => {
    this.props.onEncoderStateChange({
      ...this.props.encoderState,
      options: newOptions,
    } as EncoderState);
  };

  render({ encoderState }: Props, { supportedEncoderMap }: State) {
    const encoder = encoderMap[encoderState.type];
    const EncoderOptionComponent =
      'Options' in encoder ? encoder.Options : undefined;

    return (
      <div class={wrapStyle.settingsWrap}>
        <div class={style.optionsScroller}>
          <h3 class={style.optionsTitle}>Compress</h3>
          <section class={`${style.optionOneCell} ${style.optionsSection}`}>
            {supportedEncoderMap ? (
              <Select
                value={encoderState.type}
                onChange={this.onEncoderTypeChange}
                large
              >
                {Object.entries(supportedEncoderMap).map(([type, enc]) => (
                  <option value={type}>{enc.meta.label}</option>
                ))}
              </Select>
            ) : (
              <Select large>
                <option>Loading…</option>
              </Select>
            )}
          </section>
          {EncoderOptionComponent && (
            <EncoderOptionComponent
              options={encoderState.options as any}
              onChange={this.onEncoderOptionsChange}
            />
          )}
        </div>
      </div>
    );
  }
}
