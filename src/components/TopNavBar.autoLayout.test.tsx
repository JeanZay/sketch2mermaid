// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoLayoutResult } from '../core/layout/autoLayout';
import type { CanonicalDiagram } from '../core/types';
import { useDiagramStore } from '../store/diagramStore';
import { TopNavBar } from './TopNavBar';

const mocks = vi.hoisted(() => ({
  autoLayout: vi.fn(),
  fitView: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../core/layout/autoLayout', () => ({
  autoLayoutDiagram: mocks.autoLayout,
}));

vi.mock('./useToast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: vi.fn(),
    fitView: mocks.fitView,
  }),
}));

function makeDiagram(position = { x: 300, y: 300 }): CanonicalDiagram {
  return {
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: [{
      id: 'A',
      label: 'A',
      shape: 'process',
      position,
      width: 140,
      height: 56,
    }],
    edges: [],
    textBoxes: [],
    groups: [],
  };
}

describe('TopNavBar Auto-layout', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.autoLayout.mockReset();
    mocks.fitView.mockReset();
    mocks.showToast.mockReset();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    useDiagramStore.setState({
      diagram: { diagramType: 'flowchart', direction: 'TD', nodes: [], edges: [], textBoxes: [], groups: [] },
      past: [],
      future: [],
      checkpoint: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('is disabled when the canvas is empty', () => {
    act(() => root.render(<TopNavBar />));
    const button = container.querySelector('[aria-label="Auto-layout du canvas"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('applies the result once, clears selection, and fits the canvas', async () => {
    const source = makeDiagram();
    const laidOut = makeDiagram({ x: 8, y: 8 });
    const result: AutoLayoutResult = {
      diagram: laidOut,
      mode: 'mermaid-svg',
      warnings: [],
    };
    useDiagramStore.setState({ diagram: source, selectedNodeIds: ['A'] });
    mocks.autoLayout.mockResolvedValue(result);

    act(() => root.render(<TopNavBar />));
    const button = container.querySelector('[aria-label="Auto-layout du canvas"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(mocks.autoLayout).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 8, y: 8 });
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().selectedNodeIds).toEqual([]);
    expect(mocks.fitView).toHaveBeenCalledWith({ duration: 200 });
    expect(mocks.showToast).toHaveBeenCalledWith('Auto-layout appliqué.', 'success');
  });

  it('abandons a stale async result when the diagram changes', async () => {
    const source = makeDiagram();
    let resolveLayout!: (result: AutoLayoutResult) => void;
    mocks.autoLayout.mockReturnValue(new Promise<AutoLayoutResult>((resolve) => {
      resolveLayout = resolve;
    }));
    useDiagramStore.setState({ diagram: source });

    act(() => root.render(<TopNavBar />));
    const button = container.querySelector('[aria-label="Auto-layout du canvas"]') as HTMLButtonElement;
    act(() => button.click());
    useDiagramStore.setState({
      diagram: {
        ...source,
        nodes: [{ ...source.nodes[0], label: 'Changed while waiting' }],
      },
    });

    await act(async () => {
      resolveLayout({ diagram: makeDiagram({ x: 8, y: 8 }), mode: 'mermaid-svg', warnings: [] });
      await Promise.resolve();
    });

    expect(useDiagramStore.getState().diagram.nodes[0].label).toBe('Changed while waiting');
    expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 300, y: 300 });
    expect(mocks.fitView).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(
      'Le diagramme a changé pendant le calcul. Auto-layout annulé.',
      'warning',
    );
  });
});
