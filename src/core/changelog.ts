export type ChangelogImportance = 'minor' | 'normal' | 'major';

export type ChangelogItemType =
  | 'feature'
  | 'improvement'
  | 'fix'
  | 'breaking'
  | 'security';

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  importance: ChangelogImportance;
  items: Array<{
    type: ChangelogItemType;
    text: string;
  }>;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.10.2',
    date: '2026-07-13',
    title: 'Mermaid Edge Curve Fidelity',
    importance: 'minor',
    items: [
      {
        type: 'fix',
        text: 'Imported and auto-laid-out edges now reuse Mermaid SVG routing points so their curve direction matches the rendered preview.',
      },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-07-13',
    title: 'Label-less Structural Shapes',
    importance: 'minor',
    items: [
      {
        type: 'fix',
        text: 'Collate and Communication Link nodes no longer expose, retain, or export labels.',
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-07-13',
    title: 'Mermaid-like Auto-layout',
    importance: 'normal',
    items: [
      {
        type: 'feature',
        text: 'Added a one-click Auto-layout action that rearranges the full canvas in the active Mermaid flow direction.',
      },
      {
        type: 'improvement',
        text: 'Text annotations and detached arrows now follow nearby diagram elements and avoid overlaps during Auto-layout.',
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-07-10',
    title: 'Mermaid-style Imported Edge Routing',
    importance: 'normal',
    items: [
      {
        type: 'improvement',
        text: 'Imported flowcharts now render Dagre-routed curved edges with distinct shape-boundary endpoints for converging connections.',
      },
      {
        type: 'fix',
        text: 'Imported edge labels now use Dagre label coordinates or the routed path midpoint instead of node-center midpoints.',
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-06-29',
    title: 'Selection and Duplication Offset Fix',
    importance: 'normal',
    items: [
      {
        type: 'fix',
        text: 'Fixed duplication button behavior to apply a sequential offset instead of stacking duplicates in the same position.',
      },
      {
        type: 'improvement',
        text: 'Centralized the canvas selection state in the Zustand store for cleaner architectural state management.',
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-06-29',
    title: 'Duplicate and Copy-Paste Refinements',
    importance: 'minor',
    items: [
      {
        type: 'fix',
        text: 'Prevented keyboard copy/paste shortcuts from hijacking events when focus is on text inputs or textareas.',
      },
      {
        type: 'fix',
        text: 'Ensured copy-paste commands do not clear the clipboard when nothing is selected.',
      },
      {
        type: 'improvement',
        text: 'Improved selection management architecture and replaced legacy JSON deep cloning with modern structuredClone.',
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-06-28',
    title: 'Duplicate and Copy-Paste',
    importance: 'major',
    items: [
      {
        type: 'feature',
        text: 'Added a Duplicate action in the properties panel to clone selected nodes, textboxes, and edges.',
      },
      {
        type: 'feature',
        text: 'Added support for Ctrl+C and Ctrl+V keyboard shortcuts to copy and paste canvas selections.',
      },
      {
        type: 'improvement',
        text: 'Implemented edge-only duplication creating detached ghost edges on the canvas.',
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-06-28',
    title: 'In-app update awareness',
    importance: 'normal',
    items: [
      {
        type: 'feature',
        text: 'Added a "What’s New" panel to review recent Sketch2Mermaid improvements.',
      },
      {
        type: 'improvement',
        text: 'Added version entry points from the toolbar and settings modal.',
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-06-20',
    title: 'Flexible Ghost Arrows System',
    importance: 'normal',
    items: [
      {
        type: 'feature',
        text: 'Implemented flexible ghost arrows allowing free-standing connections with snapping endpoints.',
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-06-10',
    title: 'Visual Containers & Swimlanes',
    importance: 'major',
    items: [
      {
        type: 'feature',
        text: 'Added BPMN-style Swimlanes and Subgraphs visual grouping system.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-30',
    title: 'Mermaid Import',
    importance: 'normal',
    items: [
      {
        type: 'feature',
        text: 'Beta import support for standard Mermaid flowchart syntax.',
      },
    ],
  },
];
