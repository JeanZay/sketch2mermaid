import type { NodeShape } from './types';

/**
 * Ordered shape category definitions for UI rendering.
 * This is the single source of truth for category display order and labels.
 */
export const SHAPE_CATEGORIES = [
  { key: 'basic', label: 'Basic' },
  { key: 'data', label: 'Data / Storage' },
  { key: 'document', label: 'Documents' },
  { key: 'event', label: 'Events / Control' },
  { key: 'comment', label: 'Comments' },
  { key: 'advanced', label: 'Advanced' },
] as const;

export type ShapeCategory = 'basic' | 'data' | 'document' | 'event' | 'comment' | 'advanced';

export type ShapeIconKey =
  | 'process'
  | 'rounded'
  | 'stadium'
  | 'decision'
  | 'event'
  | 'endEvent'
  | 'database'
  | 'file'
  | 'subroutine'
  | 'hexagon'
  | 'parallelogram'
  | 'parallelogramAlt'
  | 'trapezoid'
  | 'trapezoidAlt'
  | 'asymmetric'
  | 'documents'
  | 'bang'
  | 'card'
  | 'cloud'
  | 'collate'
  | 'comLink'
  | 'comment'
  | 'commentRight'
  | 'commentBoth'
  | 'dataStore'
  | 'delay'
  | 'directAccessStorage'
  | 'diskStorage'
  | 'display'
  | 'dividedProcess'
  | 'extract'
  | 'forkJoin'
  | 'internalStorage'
  | 'junction'
  | 'linedDocument'
  | 'loopLimit'
  | 'manualFile'
  | 'manualInput'
  | 'multiProcess'
  | 'paperTape'
  | 'storedData'
  | 'summary'
  | 'taggedDocument'
  | 'taggedProcess'
  | 'textBlock'
  | 'odd';

export interface ShapeDefinition {
  nodeShape: NodeShape;
  uiLabel: string;
  mermaidShape: string;
  mermaidAliases: string[];
  category: ShapeCategory;
  iconKey: ShapeIconKey;
  legacySyntax?: {
    open: string;
    close: string;
  };
}

export const SHAPE_DEFINITIONS: ShapeDefinition[] = [
  // --- BASIC CATEGORY ---
  {
    nodeShape: 'process',
    uiLabel: 'Process',
    mermaidShape: 'rect',
    mermaidAliases: [],
    category: 'basic',
    iconKey: 'process',
    legacySyntax: { open: '[', close: ']' },
  },
  {
    nodeShape: 'rounded',
    uiLabel: 'Rounded',
    mermaidShape: 'rounded',
    mermaidAliases: [],
    category: 'basic',
    iconKey: 'rounded',
    legacySyntax: { open: '(', close: ')' },
  },
  {
    nodeShape: 'stadium',
    uiLabel: 'Start / End',
    mermaidShape: 'stadium',
    mermaidAliases: [],
    category: 'basic',
    iconKey: 'stadium',
    legacySyntax: { open: '([', close: '])' },
  },
  {
    nodeShape: 'decision',
    uiLabel: 'Decision',
    mermaidShape: 'decision',
    mermaidAliases: ['diamond'],
    category: 'basic',
    iconKey: 'decision',
    legacySyntax: { open: '{', close: '}' },
  },
  {
    nodeShape: 'hexagon',
    uiLabel: 'Hexagon',
    mermaidShape: 'hexagon',
    mermaidAliases: ['hex'],
    category: 'basic',
    iconKey: 'hexagon',
    legacySyntax: { open: '{{', close: '}}' },
  },
  {
    nodeShape: 'asymmetric',
    uiLabel: 'Asymmetric',
    mermaidShape: 'asymmetric',
    mermaidAliases: [],
    category: 'basic',
    iconKey: 'asymmetric',
    legacySyntax: { open: '>', close: ']' },
  },
  {
    nodeShape: 'subroutine',
    uiLabel: 'Subroutine',
    mermaidShape: 'subroutine',
    mermaidAliases: ['subproc', 'fr-rect'],
    category: 'basic',
    iconKey: 'subroutine',
    legacySyntax: { open: '[[', close: ']]' },
  },
  {
    nodeShape: 'trapezoid',
    uiLabel: 'Trapezoid',
    mermaidShape: 'trapezoid',
    mermaidAliases: ['trap-b'],
    category: 'basic',
    iconKey: 'trapezoid',
    legacySyntax: { open: '[/', close: '\\]' },
  },
  {
    nodeShape: 'trapezoidAlt',
    uiLabel: 'Trapezoid Alt',
    mermaidShape: 'trapezoidAlt',
    mermaidAliases: ['trap-t'],
    category: 'basic',
    iconKey: 'trapezoidAlt',
    legacySyntax: { open: '[\\', close: '/]' },
  },
  {
    nodeShape: 'dividedProcess',
    uiLabel: 'Divided Process',
    mermaidShape: 'div-rect',
    mermaidAliases: [],
    category: 'basic',
    iconKey: 'dividedProcess',
  },
  {
    nodeShape: 'multiProcess',
    uiLabel: 'Multi-Process',
    mermaidShape: 'st-rect',
    mermaidAliases: ['stacked-rectangle', 'processes'],
    category: 'basic',
    iconKey: 'multiProcess',
  },
  {
    nodeShape: 'taggedProcess',
    uiLabel: 'Tagged Process',
    mermaidShape: 'tag-rect',
    mermaidAliases: [],
    category: 'basic',
    iconKey: 'taggedProcess',
  },

  // --- DATA / STORAGE CATEGORY ---
  {
    nodeShape: 'database',
    uiLabel: 'Database',
    mermaidShape: 'cyl',
    mermaidAliases: ['database'],
    category: 'data',
    iconKey: 'database',
    legacySyntax: { open: '[(', close: ')]' },
  },
  {
    nodeShape: 'parallelogram',
    uiLabel: 'Parallelogram',
    mermaidShape: 'parallelogram',
    mermaidAliases: ['lean-r'],
    category: 'data',
    iconKey: 'parallelogram',
    legacySyntax: { open: '[/', close: '/]' },
  },
  {
    nodeShape: 'parallelogramAlt',
    uiLabel: 'Parallelogram Alt',
    mermaidShape: 'parallelogramAlt',
    mermaidAliases: ['lean-l'],
    category: 'data',
    iconKey: 'parallelogramAlt',
    legacySyntax: { open: '[\\', close: '\\]' },
  },
  {
    nodeShape: 'dataStore',
    uiLabel: 'Data Store',
    mermaidShape: 'datastore',
    mermaidAliases: [],
    category: 'data',
    iconKey: 'dataStore',
  },
  {
    nodeShape: 'directAccessStorage',
    uiLabel: 'Direct Access Storage',
    mermaidShape: 'h-cyl',
    mermaidAliases: [],
    category: 'data',
    iconKey: 'directAccessStorage',
  },
  {
    nodeShape: 'diskStorage',
    uiLabel: 'Disk Storage',
    mermaidShape: 'lin-cyl',
    mermaidAliases: [],
    category: 'data',
    iconKey: 'diskStorage',
  },
  {
    nodeShape: 'storedData',
    uiLabel: 'Stored Data',
    mermaidShape: 'bow-rect',
    mermaidAliases: [],
    category: 'data',
    iconKey: 'storedData',
  },
  {
    nodeShape: 'manualInput',
    uiLabel: 'Manual Input',
    mermaidShape: 'sl-rect',
    mermaidAliases: ['manual-input', 'sloped-rectangle'],
    category: 'data',
    iconKey: 'manualInput',
  },
  {
    nodeShape: 'display',
    uiLabel: 'Display',
    mermaidShape: 'curv-trap',
    mermaidAliases: [],
    category: 'data',
    iconKey: 'display',
  },
  {
    nodeShape: 'internalStorage',
    uiLabel: 'Internal Storage',
    mermaidShape: 'win-pane',
    mermaidAliases: [],
    category: 'data',
    iconKey: 'internalStorage',
  },

  // --- DOCUMENTS CATEGORY ---
  {
    nodeShape: 'file',
    uiLabel: 'File',
    mermaidShape: 'doc',
    mermaidAliases: ['document'],
    category: 'document',
    iconKey: 'file',
  },
  {
    nodeShape: 'documents',
    uiLabel: 'Documents',
    mermaidShape: 'docs',
    mermaidAliases: ['stacked-document'],
    category: 'document',
    iconKey: 'documents',
  },
  {
    nodeShape: 'linedDocument',
    uiLabel: 'Lined Document',
    mermaidShape: 'lin-doc',
    mermaidAliases: [],
    category: 'document',
    iconKey: 'linedDocument',
  },
  {
    nodeShape: 'taggedDocument',
    uiLabel: 'Tagged Document',
    mermaidShape: 'tag-doc',
    mermaidAliases: [],
    category: 'document',
    iconKey: 'taggedDocument',
  },
  {
    nodeShape: 'manualFile',
    uiLabel: 'Manual File',
    mermaidShape: 'flip-tri',
    mermaidAliases: [],
    category: 'document',
    iconKey: 'manualFile',
  },
  {
    nodeShape: 'paperTape',
    uiLabel: 'Paper Tape',
    mermaidShape: 'paper-tape',
    mermaidAliases: [],
    category: 'document',
    iconKey: 'paperTape',
  },

  // --- EVENTS / CONTROL CATEGORY ---
  {
    nodeShape: 'event',
    uiLabel: 'Event',
    mermaidShape: 'circle',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'event',
    legacySyntax: { open: '((', close: '))' },
  },
  {
    nodeShape: 'endEvent',
    uiLabel: 'End Event',
    mermaidShape: 'dbl-circ',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'endEvent',
    legacySyntax: { open: '(((', close: ')))' },
  },
  {
    nodeShape: 'bang',
    uiLabel: 'Bang',
    mermaidShape: 'bang',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'bang',
  },
  {
    nodeShape: 'delay',
    uiLabel: 'Delay',
    mermaidShape: 'delay',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'delay',
  },
  {
    nodeShape: 'forkJoin',
    uiLabel: 'Fork / Join',
    mermaidShape: 'fork',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'forkJoin',
  },
  {
    nodeShape: 'junction',
    uiLabel: 'Junction',
    mermaidShape: 'f-circ',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'junction',
  },
  {
    nodeShape: 'loopLimit',
    uiLabel: 'Loop Limit',
    mermaidShape: 'notch-pent',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'loopLimit',
  },
  {
    nodeShape: 'summary',
    uiLabel: 'Summary',
    mermaidShape: 'cross-circ',
    mermaidAliases: [],
    category: 'event',
    iconKey: 'summary',
  },

  // --- COMMENTS CATEGORY ---
  {
    nodeShape: 'comment',
    uiLabel: 'Comment',
    mermaidShape: 'brace',
    mermaidAliases: [],
    category: 'comment',
    iconKey: 'comment',
  },
  {
    nodeShape: 'commentRight',
    uiLabel: 'Comment Right',
    mermaidShape: 'brace-r',
    mermaidAliases: [],
    category: 'comment',
    iconKey: 'commentRight',
  },
  {
    nodeShape: 'commentBoth',
    uiLabel: 'Comment Both',
    mermaidShape: 'braces',
    mermaidAliases: [],
    category: 'comment',
    iconKey: 'commentBoth',
  },
  {
    nodeShape: 'textBlock',
    uiLabel: 'Text Block',
    mermaidShape: 'text',
    mermaidAliases: [],
    category: 'comment',
    iconKey: 'textBlock',
  },

  // --- ADVANCED CATEGORY ---
  {
    nodeShape: 'card',
    uiLabel: 'Card',
    mermaidShape: 'notch-rect',
    mermaidAliases: ['card'],
    category: 'advanced',
    iconKey: 'card',
  },
  {
    nodeShape: 'cloud',
    uiLabel: 'Cloud',
    mermaidShape: 'cloud',
    mermaidAliases: [],
    category: 'advanced',
    iconKey: 'cloud',
  },
  {
    nodeShape: 'collate',
    uiLabel: 'Collate',
    mermaidShape: 'hourglass',
    mermaidAliases: [],
    category: 'advanced',
    iconKey: 'collate',
  },
  {
    nodeShape: 'comLink',
    uiLabel: 'Communication Link',
    mermaidShape: 'bolt',
    mermaidAliases: [],
    category: 'advanced',
    iconKey: 'comLink',
  },
  {
    nodeShape: 'extract',
    uiLabel: 'Extract',
    mermaidShape: 'tri',
    mermaidAliases: [],
    category: 'advanced',
    iconKey: 'extract',
  },
  {
    nodeShape: 'odd',
    uiLabel: 'Odd',
    mermaidShape: 'odd',
    mermaidAliases: [],
    category: 'advanced',
    iconKey: 'odd',
  },
];

/**
 * Set of NodeShape values that have legacy bracket syntax (e.g. `[...]`, `{...}`).
 * Used by UI components to choose between legacy HTML/CSS rendering and new SVG rendering.
 * Derived from SHAPE_DEFINITIONS — this is the single source of truth.
 */
export const LEGACY_NODE_SHAPES: ReadonlySet<NodeShape> = new Set<NodeShape>(
  SHAPE_DEFINITIONS
    .filter((definition) => definition.legacySyntax)
    .map((definition) => definition.nodeShape)
);

export function findDefinitionByShape(shape: NodeShape): ShapeDefinition | undefined {
  return SHAPE_DEFINITIONS.find((def) => def.nodeShape === shape);
}

export function findDefinitionByMermaidName(name: string): ShapeDefinition | undefined {
  const normalized = name.toLowerCase().trim();
  return SHAPE_DEFINITIONS.find(
    (def) =>
      def.mermaidShape.toLowerCase() === normalized ||
      def.mermaidAliases.some((alias) => alias.toLowerCase() === normalized)
  );
}
