/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import type { CanonicalDiagram } from '../types';
import { autoLayoutDiagram } from './autoLayout';

const originalRender = mermaid.render;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const ORACLE_ROUTE = [{ x: 160, y: 120 }, { x: 220, y: 210 }, { x: 320, y: 300 }];

afterEach(() => {
  mermaid.render = originalRender;
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  document.body.innerHTML = '';
});

function diagram(withGroup = false): CanonicalDiagram {
  return {
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: [
      {
        id: 'A',
        label: 'Alpha',
        shape: 'process',
        position: { x: 500, y: 500 },
        width: 140,
        height: 56,
        style: { borderColor: '#123456' },
        parentGroupId: withGroup ? 'g1' : undefined,
      },
      {
        id: 'B',
        label: 'Beta',
        shape: 'comment',
        position: { x: 500, y: 700 },
        width: 150,
        height: 56,
        parentGroupId: withGroup ? 'g1' : undefined,
      },
    ],
    edges: [{
      id: 'original-edge-id',
      from: { kind: 'connected', nodeId: 'A', handleId: null },
      to: { kind: 'connected', nodeId: 'B', handleId: null },
      connectionStatus: 'connected',
      exportMode: 'mermaid',
      label: 'go',
      style: 'solid',
      direction: 'directed',
    }],
    textBoxes: [],
    groups: withGroup ? [{
      id: 'g1',
      kind: 'subgraph',
      label: 'Group',
      position: { x: 400, y: 400 },
      width: 400,
      height: 400,
    }] : [],
  };
}

function installOracleMock(invalidSecondNode = false): void {
  mermaid.render = async (id: string) => ({
    svg: `
      <svg id="${id}" viewBox="0 0 800 600" width="800" height="600">
        <path data-edge="true" data-id="L_A_B_0" data-points="${window.btoa(JSON.stringify(ORACLE_ROUTE))}"></path>
        <g class="node" data-id="A"></g>
        <g class="node" data-id="B"></g>
      </svg>
    `,
    bindFunctions: () => {},
  });

  Element.prototype.getBoundingClientRect = function() {
    const dataId = this.getAttribute('data-id');
    if (this.tagName.toLowerCase() === 'svg') {
      return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect;
    }
    if (dataId === 'A') {
      return { left: 100, top: 60, right: 220, bottom: 120, width: 120, height: 60 } as DOMRect;
    }
    if (dataId === 'B') {
      if (invalidSecondNode) {
        return { left: 300, top: 300, right: 300, bottom: 300, width: 0, height: 0 } as DOMRect;
      }
      return { left: 300, top: 300, right: 460, bottom: 370, width: 160, height: 70 } as DOMRect;
    }
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
  };
}

describe('auto-layout Mermaid SVG refinement', () => {
  it('merges oracle geometry without replacing canonical entities', async () => {
    installOracleMock();
    const result = await autoLayoutDiagram(diagram());

    expect(result.mode).toBe('mermaid-svg');
    expect(result.warnings).toEqual([]);
    expect(result.diagram.nodes[0].position).toEqual({ x: 100, y: 60 });
    expect(result.diagram.nodes[0].width).toBe(120);
    expect(result.diagram.nodes[0].style).toEqual({ borderColor: '#123456' });
    expect(result.diagram.nodes[1].shape).toBe('comment');
    expect(result.diagram.edges[0].id).toBe('original-edge-id');
    expect(result.diagram.edges[0].data?.points).toEqual(ORACLE_ROUTE);
    expect(result.diagnostics?.svgEdgeRoutesFound).toBe(1);
    expect(result.diagnostics?.svgEdgeRoutesApplied).toBe(1);
  });

  it('rebuilds subgraph bounds around oracle-refined children', async () => {
    installOracleMock();
    const result = await autoLayoutDiagram(diagram(true));
    const group = result.diagram.groups![0];

    for (const child of result.diagram.nodes) {
      expect(child.position.x).toBeGreaterThanOrEqual(group.position.x);
      expect(child.position.y).toBeGreaterThanOrEqual(group.position.y);
      expect(child.position.x + child.width!).toBeLessThanOrEqual(group.position.x + group.width);
      expect(child.position.y + child.height!).toBeLessThanOrEqual(group.position.y + group.height);
    }
  });

  it('rejects a partial oracle measurement and keeps the complete Dagre baseline', async () => {
    installOracleMock(true);
    const result = await autoLayoutDiagram(diagram());

    expect(result.mode).toBe('dagre-fallback');
    expect(result.diagnostics?.oraclePositionsExtracted).toBe(2);
    expect(result.diagnostics?.oracleDimensionsExtracted).toBe(1);
    expect(result.diagram.nodes[0].position).not.toEqual({ x: 100, y: 60 });
    expect(result.warnings[0]).toContain('local Dagre layout was used');
  });
});
