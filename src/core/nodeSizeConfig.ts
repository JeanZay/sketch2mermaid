import type { NodeShape } from './types';

export interface NodeSizeConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

// ---------------------------------------------------------------------------
// Deterministic label-based node sizing (Mermaid import only)
// ---------------------------------------------------------------------------
// Mermaid sizes flowchart nodes from the rendered label bounding box plus
// 2 × flowchart padding (default 15). We cannot measure text (must remain
// pure/deterministic in jsdom and browser alike), so we estimate with a
// conservative character width, the same pattern used for edge-label proxies
// in the layout engine.
//
//   - NODE_LABEL_CHAR_WIDTH  = 8 px/char — ~16px sans-serif average advance
//     (~7.5px) plus a safety margin for wide glyphs.
//   - NODE_LABEL_LINE_HEIGHT = 22 px — single line at ~16px font.
//   - NODE_PADDING           = 15 px per side — Mermaid flowchart `padding`.
// ---------------------------------------------------------------------------
export const NODE_LABEL_CHAR_WIDTH = 8;
export const NODE_LABEL_LINE_HEIGHT = 22;
export const NODE_PADDING = 15;
/** Upper bound to keep pathological labels from producing huge nodes. */
export const NODE_MAX_ESTIMATED_WIDTH = 480;

/**
 * Estimates the rendered size of a node from its label, mirroring how
 * Mermaid derives node dimensions from the measured label plus padding.
 *
 * Pure and deterministic: no DOM, no font measurement. Fixed-size shapes
 * must be handled by the caller (via shapeRegistry capabilities) — this
 * helper only covers content-sized shapes.
 *
 * The estimate is clamped to the shape's default minimums so short labels
 * keep the familiar canvas look, and to NODE_MAX_ESTIMATED_WIDTH above.
 * Sizes are canvas-only metadata and are never exported to Mermaid.
 */
export function estimateNodeSize(shape: NodeShape, label: string): { width: number; height: number } {
  const defaults = NODE_SIZE_DEFAULTS[shape] ?? NODE_SIZE_DEFAULTS.process;
  const lines = (label || '').split('\n');
  const maxLineLen = Math.max(0, ...lines.map((l) => l.length));
  const textW = maxLineLen * NODE_LABEL_CHAR_WIDTH;
  const textH = lines.length * NODE_LABEL_LINE_HEIGHT;

  const clampW = (w: number) =>
    Math.min(NODE_MAX_ESTIMATED_WIDTH, Math.max(defaults.minWidth, Math.round(w)));
  const clampH = (h: number) => Math.max(defaults.minHeight, Math.round(h));

  switch (shape) {
    case 'decision': {
      // Mermaid `question` shape: s ≈ 0.9 × (labelW + labelH + 4×padding),
      // rendered as an s×s diamond.
      const side = 0.9 * (textW + textH + 4 * NODE_PADDING);
      const w = clampW(Math.max(defaults.width, side));
      return { width: w, height: clampH(Math.max(defaults.height, side * 0.75)) };
    }
    case 'event':
    case 'endEvent': {
      // Circles: diameter driven by the widest dimension of the label.
      const d = Math.max(textW, textH) + 2 * NODE_PADDING;
      const side = clampW(Math.max(defaults.minWidth, d));
      return { width: side, height: side };
    }
    case 'hexagon': {
      // Mermaid hexagon adds ~h/2 chevrons on each side.
      const h = clampH(textH + 2 * NODE_PADDING);
      return { width: clampW(textW + 2 * NODE_PADDING + h), height: h };
    }
    case 'parallelogram':
    case 'parallelogramAlt':
    case 'trapezoid':
    case 'trapezoidAlt': {
      // Slanted sides consume extra horizontal room.
      const h = clampH(textH + 2 * NODE_PADDING);
      return { width: clampW(textW + 2 * NODE_PADDING + h * 0.8), height: h };
    }
    default: {
      return {
        width: clampW(textW + 2 * NODE_PADDING),
        height: clampH(textH + 2 * NODE_PADDING),
      };
    }
  }
}

/**
 * Centralized default and minimum sizes for each node shape on the canvas.
 * These dimensions are canvas-only visual metadata and must never be exported to Mermaid.
 */
export const NODE_SIZE_DEFAULTS: Record<NodeShape, NodeSizeConfig> = {
  // Existing shapes:
  process:          { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  rounded:          { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  stadium:          { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  decision:         { width: 120, height: 90, minWidth: 90, minHeight: 70 },
  event:            { width: 88, height: 88, minWidth: 64, minHeight: 64 },
  endEvent:         { width: 88, height: 88, minWidth: 64, minHeight: 64 },
  database:         { width: 150, height: 76, minWidth: 110, minHeight: 64 },
  file:             { width: 90, height: 115, minWidth: 64, minHeight: 80 },
  subroutine:       { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  hexagon:          { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  parallelogram:    { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  parallelogramAlt: { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  trapezoid:        { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  trapezoidAlt:     { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  asymmetric:       { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  documents:        { width: 150, height: 76, minWidth: 110, minHeight: 64 },

  // New shapes:
  bang:                 { width: 88, height: 88, minWidth: 64, minHeight: 64 },
  card:                 { width: 80, height: 60, minWidth: 50, minHeight: 44 },
  cloud:                { width: 150, height: 76, minWidth: 110, minHeight: 64 },
  collate:              { width: 120, height: 90, minWidth: 90, minHeight: 70 },
  comLink:              { width: 120, height: 90, minWidth: 90, minHeight: 70 },
  comment:              { width: 150, height: 56, minWidth: 90, minHeight: 44 },
  commentRight:         { width: 150, height: 56, minWidth: 90, minHeight: 44 },
  commentBoth:          { width: 150, height: 56, minWidth: 90, minHeight: 44 },
  dataStore:            { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  delay:                { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  directAccessStorage:  { width: 190, height: 50, minWidth: 110, minHeight: 44 },
  diskStorage:          { width: 150, height: 76, minWidth: 110, minHeight: 64 },
  display:              { width: 150, height: 112, minWidth: 100, minHeight: 88 },
  dividedProcess:       { width: 180, height: 56, minWidth: 90, minHeight: 44 },
  extract:              { width: 120, height: 90, minWidth: 90, minHeight: 70 },
  forkJoin:             { width: 96, height: 16, minWidth: 44, minHeight: 8 },
  internalStorage:      { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  junction:             { width: 64, height: 64, minWidth: 44, minHeight: 44 },
  linedDocument:        { width: 150, height: 90, minWidth: 110, minHeight: 76 },
  loopLimit:            { width: 140, height: 70, minWidth: 90, minHeight: 52 },
  manualFile:           { width: 150, height: 140, minWidth: 100, minHeight: 100 },
  manualInput:          { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  multiProcess:         { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  paperTape:            { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  storedData:           { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  summary:              { width: 64, height: 64, minWidth: 44, minHeight: 44 },
  taggedDocument:       { width: 150, height: 76, minWidth: 110, minHeight: 64 },
  taggedProcess:        { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  textBlock:            { width: 150, height: 56, minWidth: 90, minHeight: 44 },
  odd:                  { width: 90, height: 56, minWidth: 64, minHeight: 44 },
};
