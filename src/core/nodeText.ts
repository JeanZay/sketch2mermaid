/**
 * Lightweight deterministic font-size calculation for node labels.
 * No DOM measurement — purely mathematical, avoids infinite resize/measure loops.
 */
export function computeNodeFontSize(params: {
  label: string;
  width: number;
  height: number;
  min?: number;
  max?: number;
}): number {
  const { label, width, height, min = 10, max = 16 } = params;

  const normalizedLength = Math.max(label.trim().length, 1);

  // Approximate: each character occupies ~0.55em at the computed font size
  const widthBased = width / Math.max(normalizedLength * 0.55, 6);
  const heightBased = height * 0.32;

  const computed = Math.min(widthBased, heightBased, max);

  return Math.max(min, Math.round(computed));
}
