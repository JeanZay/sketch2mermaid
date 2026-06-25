import React from 'react';
import { SHAPE_ICONS } from './shapeIcons';
import type { NodeShape } from '../core/types';
import { findDefinitionByShape } from '../core/shapeRegistry';

interface LegacyShapeIconProps extends React.SVGProps<SVGSVGElement> {
  shapeId: NodeShape;
}

export const LegacyShapeIcon: React.FC<LegacyShapeIconProps> = ({ shapeId, ...props }) => {
  const def = findDefinitionByShape(shapeId);
  if (!def) return null;
  const icon = SHAPE_ICONS[def.iconKey];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      {icon}
    </svg>
  );
};
