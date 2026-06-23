import type { NodeShape } from './types';

export interface NodeSizeConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

/**
 * Centralized default and minimum sizes for each node shape on the canvas.
 * These dimensions are canvas-only visual metadata and must never be exported to Mermaid.
 */
export const NODE_SIZE_DEFAULTS: Record<NodeShape, NodeSizeConfig> = {
  process:  { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  rounded:  { width: 140, height: 56, minWidth: 90, minHeight: 44 },
  stadium:  { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  decision: { width: 120, height: 90, minWidth: 90, minHeight: 70 },
  event:    { width: 88, height: 88, minWidth: 64, minHeight: 64 },
  endEvent: { width: 88, height: 88, minWidth: 64, minHeight: 64 },
  database: { width: 150, height: 76, minWidth: 110, minHeight: 64 },
  file:     { width: 150, height: 76, minWidth: 110, minHeight: 64 },
  subroutine:       { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  hexagon:          { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  parallelogram:    { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  parallelogramAlt: { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  trapezoid:        { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  trapezoidAlt:     { width: 160, height: 56, minWidth: 110, minHeight: 44 },
  asymmetric:       { width: 150, height: 56, minWidth: 100, minHeight: 44 },
  documents:        { width: 150, height: 76, minWidth: 110, minHeight: 64 },
};
