import React from 'react';
import type { ShapeIconKey } from '../core/shapeRegistry';

export const SHAPE_ICONS: Record<ShapeIconKey, React.ReactNode> = {
  process: <rect x="3" y="6" width="18" height="12" rx="1" />,
  rounded: <rect x="3" y="6" width="18" height="12" rx="4" />,
  stadium: <rect x="3" y="8" width="18" height="8" rx="4" />,
  decision: <rect x="8" y="8" width="8" height="8" transform="rotate(45 12 12)" />,
  event: <circle cx="12" cy="12" r="8" />,
  endEvent: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5,6 v12 c0,1.66 3.13,3 7,3 s7,-1.34 7,-3 V6" />
      <path d="M5,12 c0,1.66 3.13,3 7,3 s7,-1.34 7,-3" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  subroutine: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <line x1="7" y1="6" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="17" y1="6" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  hexagon: <polygon points="6 6 18 6 22 12 18 18 6 18 2 12" />,
  parallelogram: <polygon points="6 6 22 6 18 18 2 18" />,
  parallelogramAlt: <polygon points="2 6 18 6 22 18 6 18" />,
  trapezoid: <polygon points="6 6 18 6 22 18 2 18" />,
  trapezoidAlt: <polygon points="2 6 22 6 18 18 6 18" />,
  asymmetric: <polygon points="3 6 18 6 22 12 18 18 3 18" />,
  documents: (
    <>
      <path d="M12 4H6a2 2 0 0 0-2 2v8" />
      <path d="M14 6H8a2 2 0 0 0-2 2v8" />
      <path d="M16 8H10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6z" />
      <polyline points="16 8 16 12 20 12" />
    </>
  ),

  // New shapes:
  bang: (
    <polygon points="12 3 14 8 19 6 16 11 21 12 16 13 19 18 14 16 12 21 10 16 5 18 8 13 3 12 8 11 5 6 10 8" />
  ),
  card: (
    <path d="M3 6 h12 l4 4 v8 H3 Z" />
  ),
  cloud: (
    <path d="M18.4 12.6 A5.5 5.5 0 0 0 13.5 6 A5.5 5.5 0 0 0 8 10.5 A4.5 4.5 0 0 0 8.5 19.5 h10 a4.5 4.5 0 0 0 0 -6.9 Z" />
  ),
  collate: (
    <path d="M6 4h12l-6 8 6 8H6l6-8z" />
  ),
  comLink: (
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
  ),
  comment: (
    <path d="M16 4c-3 0-4 2-4 5v3c0 2-1 3-3 3 2 0 3 1 3 3v3c0 3 1 5 4 5" />
  ),
  commentRight: (
    <path d="M8 4c3 0 4 2 4 5v3c0 2 1 3 3 3-2 0-3 1-3 3v3c0 3-1 5-4 5" />
  ),
  commentBoth: (
    <>
      <path d="M7 4c-2 0-3 1.5-3 3.5v3c0 1.5-.5 2-1.5 2 1 0 1.5.5 1.5 2v3c0 2 1 3.5 3 3.5" />
      <path d="M17 4c2 0 3 1.5 3 3.5v3c0 1.5.5 2 1.5 2-1 0-1.5.5-1.5 2v3c0 2-1 3.5-3 3.5" />
    </>
  ),
  dataStore: (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3" y2="18" />
    </>
  ),
  delay: (
    <path d="M4 6h8a6 6 0 0 1 0 12H4Z" />
  ),
  directAccessStorage: (
    <>
      <path d="M4 6a3 6 0 0 0 0 12h14a3 6 0 0 0 0-12Z" />
      <path d="M18 6a3 6 0 0 1 0 12" />
    </>
  ),
  diskStorage: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v12c0 1.5 3.13 2.5 7 2.5s7-1 7-2.5V6" />
      <path d="M5 10c0 1.5 3.13 2.5 7 2.5s7-1 7-2.5" />
      <path d="M5 14c0 1.5 3.13 2.5 7 2.5s7-1 7-2.5" />
    </>
  ),
  display: (
    <path d="M3 12c1.5-4 3-6 5-6h11l-3 6 3 6H8c-2 0-3.5-2-5-6Z" />
  ),
  dividedProcess: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  extract: (
    <polygon points="12 4 21 18 3 18" />
  ),
  forkJoin: (
    <rect x="10" y="4" width="4" height="16" rx="1" fill="currentColor" />
  ),
  internalStorage: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <line x1="9" y1="6" x2="9" y2="18" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </>
  ),
  junction: (
    <circle cx="12" cy="12" r="6" fill="currentColor" />
  ),
  linedDocument: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="7" y1="12" x2="15" y2="12" />
      <line x1="7" y1="15" x2="17" y2="15" />
    </>
  ),
  loopLimit: (
    <polygon points="3 6 21 6 21 14 17 18 7 18 3 14" />
  ),
  manualFile: (
    <>
      <path d="M6 2H18a2 2 0 0 1 2 2V16l-6 6H6a2 2 0 0 1-2-2V4A2 2 0 0 1 6 2Z" />
      <polyline points="14 22 14 16 20 16" />
    </>
  ),
  manualInput: (
    <polygon points="3 10 21 6 21 18 3 18" />
  ),
  multiProcess: (
    <>
      <rect x="7" y="3" width="14" height="10" rx="1" />
      <rect x="5" y="6" width="14" height="10" rx="1" />
      <rect x="3" y="9" width="14" height="10" rx="1" />
    </>
  ),
  paperTape: (
    <path d="M3 6 C6 4, 12 8, 21 6 v10 C12 18, 6 14, 3 16 Z" />
  ),
  storedData: (
    <path d="M3 6h18c-2 3-2 9 0 12H3c2-3 2-9 0-12Z" />
  ),
  summary: (
    <>
      <circle cx="12" cy="12" r="8" />
      <line x1="6.3" y1="6.3" x2="17.7" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="6.3" y2="17.7" />
    </>
  ),
  taggedDocument: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <circle cx="9" cy="7" r="1.5" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  taggedProcess: (
    <>
      <path d="M3 6 h14 l4 4 v8 H3 Z" />
      <circle cx="7" cy="10" r="1.5" />
    </>
  ),
  textBlock: (
    <>
      <line x1="5" y1="7" x2="19" y2="7" />
      <line x1="5" y1="12" x2="15" y2="12" />
      <line x1="5" y1="17" x2="17" y2="17" />
    </>
  ),
  odd: (
    <polygon points="3 8 9 5 18 5 21 12 17 19 8 19 3 12" />
  ),
};
