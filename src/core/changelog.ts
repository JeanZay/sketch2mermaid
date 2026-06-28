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
