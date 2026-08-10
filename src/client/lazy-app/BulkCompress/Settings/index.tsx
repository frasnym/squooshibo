import { h, Component } from 'preact';

import * as wrapStyle from './style.css';
import 'add-css:./style.css';
import * as style from 'client/lazy-app/Compress/Options/style.css';
import Select from 'client/lazy-app/Compress/Options/Select';
import Toggle from 'client/lazy-app/Compress/Options/Toggle';
import Expander from 'client/lazy-app/Compress/Options/Expander';
import { Options as ResizeOptionsComponent } from 'features/processors/resize/client';
import {
  EncoderState,
  EncoderOptions,
  EncoderType,
  ProcessorOptions,
  encoderMap,
} from 'client/lazy-app/feature-meta';
import {
  supportedEncoderMapP,
  PartialButNotUndefined,
} from 'client/lazy-app/util/supported-encoders';

export interface FirstFileInfo {
  width: number;
  height: number;
  isVector: boolean;
}

interface Props {
  encoderState: EncoderState;
  onEncoderStateChange(newState: EncoderState): void;
  resizeEnabled: boolean;
  resizeOptions: ProcessorOptions['resize'];
  firstFileInfo?: FirstFileInfo;
  onResizeEnabledChange(enabled: boolean): void;
  onResizeOptionsChange(newOptions: ProcessorOptions['resize']): void;
  disabled?: boolean;
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

  private onResizeEnabledChange = (event: Event) => {
    this.props.onResizeEnabledChange(
      (event.currentTarget as HTMLInputElement).checked,
    );
  };

  render(
    {
      encoderState,
      resizeEnabled,
      resizeOptions,
      firstFileInfo,
      onResizeOptionsChange,
      disabled,
    }: Props,
    { supportedEncoderMap }: State,
  ) {
    const encoder = encoderMap[encoderState.type];
    const EncoderOptionComponent =
      'Options' in encoder ? encoder.Options : undefined;

    return (
      <div
        class={
          wrapStyle.settingsWrap +
          (disabled ? ` ${wrapStyle.settingsDisabled}` : '')
        }
      >
        <div class={style.optionsScroller}>
          <label
            class={
              style.sectionEnabler +
              (firstFileInfo ? '' : ` ${wrapStyle.sectionEnablerDisabled}`)
            }
          >
            {firstFileInfo ? 'Resize' : 'Resize (reading dimensions…)'}
            <Toggle
              checked={resizeEnabled}
              disabled={!firstFileInfo}
              onChange={this.onResizeEnabledChange}
            />
          </label>
          <Expander>
            {resizeEnabled && firstFileInfo ? (
              <ResizeOptionsComponent
                isVector={firstFileInfo.isVector}
                inputWidth={firstFileInfo.width}
                inputHeight={firstFileInfo.height}
                options={resizeOptions}
                onChange={onResizeOptionsChange}
              />
            ) : null}
          </Expander>

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
