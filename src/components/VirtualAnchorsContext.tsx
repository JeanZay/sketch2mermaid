import { createContext, useContext } from 'react';
import type { VirtualEdgeAnchor } from '../core/virtualEdgeAnchors';

/**
 * Context for virtual edge anchor coordinates.
 *
 * Provides computed per-edge anchor positions to CustomEdge components
 * without prop-drilling through React Flow's internal edge instantiation.
 *
 * Default value is an empty record — edges fall back to React Flow
 * centered coordinates when no provider is present.
 */
export const VirtualAnchorsContext = createContext<Record<string, VirtualEdgeAnchor>>({});

/** Consume virtual anchor data from the nearest provider. */
export function useVirtualAnchors(): Record<string, VirtualEdgeAnchor> {
  return useContext(VirtualAnchorsContext);
}
