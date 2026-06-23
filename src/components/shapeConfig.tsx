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
  {
    type: 'subroutine',
    label: 'Subroutine',
    svg: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="1"></rect>
        <line x1="7" y1="6" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
        <line x1="17" y1="6" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  },
  {
    type: 'hexagon',
    label: 'Hexagon',
    svg: <polygon points="6 6 18 6 22 12 18 18 6 18 2 12" />,
  },
  {
    type: 'parallelogram',
    label: 'Parallelogram',
    svg: <polygon points="6 6 22 6 18 18 2 18" />,
  },
  {
    type: 'parallelogramAlt',
    label: 'Parallelogram Alt',
    svg: <polygon points="2 6 18 6 22 18 6 18" />,
  },
  {
    type: 'trapezoid',
    label: 'Trapezoid',
    svg: <polygon points="6 6 18 6 22 18 2 18" />,
  },
  {
    type: 'trapezoidAlt',
    label: 'Trapezoid Alt',
    svg: <polygon points="2 6 22 6 18 18 6 18" />,
  },
  {
    type: 'asymmetric',
    label: 'Asymmetric',
    svg: <polygon points="3 6 18 6 22 12 18 18 3 18" />,
  },
  {
    type: 'documents',
    label: 'Documents',
    svg: (
      <>
        <path d="M12 4H6a2 2 0 0 0-2 2v8" />
        <path d="M14 6H8a2 2 0 0 0-2 2v8" />
        <path d="M16 8H10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6z" />
        <polyline points="16 8 16 12 20 12" />
      </>
    ),
  },
];
