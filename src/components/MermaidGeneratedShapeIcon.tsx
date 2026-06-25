import React from 'react';
import type { NodeShape } from '../core/types';
import { MERMAID_GENERATED_SHAPE_ICONS } from '../assets/shape-icons/generated-icons-map';

interface MermaidGeneratedShapeIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  shapeId: NodeShape;
  width?: string | number;
  height?: string | number;
}

export const MermaidGeneratedShapeIcon: React.FC<MermaidGeneratedShapeIconProps> = ({
  shapeId,
  width = 24,
  height = 24,
  style,
  ...props
}) => {
  // Safe because SVG strings are generated at build/dev time from local Mermaid output,
  // committed to the repository, and never come from user input.
  const svgMarkup = MERMAID_GENERATED_SHAPE_ICONS[shapeId];
  if (!svgMarkup) {
    throw new Error(`Missing Mermaid generated shape icon for shape ID: "${shapeId}"`);
  }

  return (
    <span
      {...props}
      className={`mermaid-generated-shape-icon-container ${props.className || ''}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
