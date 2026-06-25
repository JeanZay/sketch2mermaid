import React from 'react';

interface MarkerProps {
  id: string;
  color: string;
}

/**
 * Legacy/Default SVG arrow marker for edges.
 */
export const ArrowMarker = ({ id, color }: MarkerProps) => (
  <marker
    id={id}
    markerWidth="20"
    markerHeight="20"
    viewBox="-10 -10 20 20"
    markerUnits="strokeWidth"
    orient="auto-start-reverse"
    refX="0"
    refY="0"
  >
    <polyline
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1"
      fill={color}
      points="-5,-4 0,0 -5,4 -5,-4"
    />
  </marker>
);

/**
 * Mermaid-like SVG arrow marker for edges: smaller, cleaner, and less intrusive.
 */
export const MermaidArrowMarker = ({ id, color }: MarkerProps) => (
  <marker
    id={id}
    markerWidth="12"
    markerHeight="12"
    viewBox="-6 -6 12 12"
    markerUnits="strokeWidth"
    orient="auto-start-reverse"
    refX="0"
    refY="0"
  >
    <polyline
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1"
      fill={color}
      points="-4,-3 0,0 -4,3 -4,-3"
    />
  </marker>
);
