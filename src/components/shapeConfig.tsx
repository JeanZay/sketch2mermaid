import React from 'react';
import type { NodeShape } from '../core/types';

export interface ShapeConfig {
  type: NodeShape;
  label: string;
  svg: React.ReactNode;
}

export const SHAPE_CONFIGS: ShapeConfig[] = [
  {
    type: 'process',
    label: 'Process',
    svg: <rect x="3" y="6" width="18" height="12" rx="1"></rect>,
  },
  {
    type: 'rounded',
    label: 'Rounded',
    svg: <rect x="3" y="6" width="18" height="12" rx="4"></rect>,
  },
  {
    type: 'stadium',
    label: 'Start / End',
    svg: <rect x="3" y="8" width="18" height="8" rx="4"></rect>,
  },
  {
    type: 'decision',
    label: 'Decision',
    svg: <rect x="8" y="8" width="8" height="8" transform="rotate(45 12 12)"></rect>,
  },
  {
    type: 'event',
    label: 'Event',
    svg: <circle cx="12" cy="12" r="8"></circle>,
  },
  {
    type: 'endEvent',
    label: 'End Event',
    svg: (
      <>
        <circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="6"></circle>
      </>
    ),
  },
  {
    type: 'database',
    label: 'Database',
    svg: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5,6 v12 c0,1.66 3.13,3 7,3 s7,-1.34 7,-3 V6" />
        <path d="M5,12 c0,1.66 3.13,3 7,3 s7,-1.34 7,-3" />
      </>
    ),
  },
  {
    type: 'file',
    label: 'File',
    svg: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    ),
  },
];
