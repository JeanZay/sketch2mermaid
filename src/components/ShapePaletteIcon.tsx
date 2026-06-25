import React from 'react';
import type { NodeShape } from '../core/types';
import { LegacyShapeIcon } from './LegacyShapeIcon';
import { MermaidGeneratedShapeIcon } from './MermaidGeneratedShapeIcon';
import { USE_MERMAID_GENERATED_SHAPE_ICONS } from '../core/config';

interface ShapePaletteIconProps {
  shapeId: NodeShape;
  width?: string | number;
  height?: string | number;
  className?: string;
  mode?: 'generated' | 'legacy';
}

export const ShapePaletteIcon: React.FC<ShapePaletteIconProps> = ({
  shapeId,
  width,
  height,
  className,
  mode,
}) => {
  const activeMode = mode ?? (USE_MERMAID_GENERATED_SHAPE_ICONS ? 'generated' : 'legacy');

  return activeMode === 'generated' ? (
    <MermaidGeneratedShapeIcon
      shapeId={shapeId}
      width={width}
      height={height}
      className={className}
    />
  ) : (
    <LegacyShapeIcon
      shapeId={shapeId}
      width={width}
      height={height}
      className={className}
    />
  );
};
