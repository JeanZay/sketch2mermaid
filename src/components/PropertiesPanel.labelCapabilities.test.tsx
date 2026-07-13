// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeShape } from '../core/types';
import { useDiagramStore } from '../store/diagramStore';
import { PropertiesPanel } from './PropertiesPanel';

const mocks = vi.hoisted(() => ({
  nodes: [] as Array<Record<string, unknown>>,
}));

vi.mock('@xyflow/react', () => ({
  useNodes: () => mocks.nodes,
  useEdges: () => [],
}));

vi.mock('../hooks/useVirtualEdgeAnchors', () => ({
  useVirtualEdgeAnchors: () => ({}),
}));

vi.mock('./ShapePaletteIcon', () => ({
  ShapePaletteIcon: () => <span data-testid="shape-icon" />,
}));

function selectNode(shape: NodeShape) {
  mocks.nodes = [{
    id: 'n1',
    type: 'customNode',
    selected: true,
    position: { x: 0, y: 0 },
    data: { shape, label: shape === 'process' ? 'Visible label' : '', width: 120, height: 90 },
  }];

  useDiagramStore.setState({
    diagram: {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [{
        id: 'n1',
        shape,
        label: shape === 'process' ? 'Visible label' : '',
        position: { x: 0, y: 0 },
        width: 120,
        height: 90,
      }],
      edges: [],
      textBoxes: [],
      groups: [],
    },
    selectedNodeIds: ['n1'],
    selectedEdgeIds: [],
  });
}

function propertyLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.property-label'))
    .map((element) => element.textContent?.trim() ?? '');
}

describe('PropertiesPanel label capabilities', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(['collate', 'comLink'] as const)('does not expose label controls for %s', (shape) => {
    selectNode(shape);
    act(() => root.render(<PropertiesPanel />));

    const labels = propertyLabels(container);
    expect(labels).not.toContain('Label');
    expect(labels).not.toContain('Font Size');
    expect(labels).not.toContain('Format');
    expect(labels).not.toContain('Alignment');
    expect(labels).not.toContain('Text Color');
  });

  it('keeps label controls available for a regular process node', () => {
    selectNode('process');
    act(() => root.render(<PropertiesPanel />));

    const labels = propertyLabels(container);
    expect(labels).toContain('Label');
    expect(labels).toContain('Font Size');
    expect(labels).toContain('Format');
    expect(labels).toContain('Alignment');
    expect(labels).toContain('Text Color');
  });
});
