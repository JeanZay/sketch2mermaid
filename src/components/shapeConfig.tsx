import type { ShapeConfig } from './shapeConfig';
import { SHAPE_DEFINITIONS } from '../core/shapeRegistry';
import { SHAPE_ICONS } from './shapeIcons';
import type { NodeShape } from '../core/types';

export interface ShapeConfig {
  type: NodeShape;
  label: string;
  svg: React.ReactNode;
}

export const SHAPE_CONFIGS: ShapeConfig[] = SHAPE_DEFINITIONS.map((def) => ({
  type: def.nodeShape,
  label: def.uiLabel,
  svg: SHAPE_ICONS[def.iconKey],
}));
