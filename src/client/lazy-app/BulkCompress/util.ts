import prettyBytes from '../util/pretty-bytes';

export function sizeChange(
  original: number,
  compressed: number,
): { arrow: string; percent: number } {
  const diff = compressed / original;
  const absolutePercent = Math.round(Math.abs(diff) * 100);
  const percent = diff > 1 ? absolutePercent - 100 : 100 - absolutePercent;
  return { arrow: diff < 1 ? '↓' : '↑', percent: Math.abs(percent) };
}

export function formatSizeChange(original: number, compressed: number): string {
  const from = prettyBytes(original);
  const to = prettyBytes(compressed);
  const { arrow, percent } = sizeChange(original, compressed);
  return `${from.value}${from.unit} → ${to.value}${to.unit} (${arrow}${percent}%)`;
}
