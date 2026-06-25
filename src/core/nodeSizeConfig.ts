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
