/**
 * Mermaid layout contract tests.
 *
 * These tests verify that imported Mermaid flowcharts follow the structural
 * contract of Mermaid's own Dagre integration (compound clusters, recursive
 * subgraph extraction, direction handling, label spacing).
 *
 * Assertions are structural — rank ordering, containment, determinism —
 * never pixel-perfect coordinates, except for pure helper functions whose
 * outputs are stable by construction.
 */
import { describe, it, expect } from 'vitest';
import { importMermaidFlowchart } from '../mermaidImport';
import { toMermaid } from '../mermaid';
import { normalizeDiagram } from '../../store/diagramStore';
import {
  estimateNodeSize,
  NODE_SIZE_DEFAULTS,
  NODE_LABEL_CHAR_WIDTH,
  NODE_PADDING,
  NODE_MAX_ESTIMATED_WIDTH,
} from '../nodeSizeConfig';
import { MERMAID_LIKE_CLUSTER_PADDING } from '../config';
import type { CanonicalDiagram, DiagramNode, DiagramGroup } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeById(diagram: CanonicalDiagram, id: string): DiagramNode {
  const node = diagram.nodes.find((n) => n.id === id);
  expect(node, `node ${id} should exist`).toBeDefined();
  return node!;
}

function groupByLabel(diagram: CanonicalDiagram, label: string): DiagramGroup {
  const group = (diagram.groups ?? []).find((g) => g.label === label);
  expect(group, `group "${label}" should exist`).toBeDefined();
  return group!;
}

function centerOf(node: DiagramNode): { x: number; y: number } {
  return {
    x: node.position.x + (node.width ?? 140) / 2,
    y: node.position.y + (node.height ?? 56) / 2,
  };
}

function nodeRect(node: DiagramNode) {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + (node.width ?? 140),
    bottom: node.position.y + (node.height ?? 56),
  };
}

function groupRect(group: DiagramGroup) {
  return {
    left: group.position.x,
    top: group.position.y,
    right: group.position.x + group.width,
    bottom: group.position.y + group.height,
  };
}

function expectGroupContains(group: DiagramGroup, node: DiagramNode) {
  const g = groupRect(group);
  const n = nodeRect(node);
  expect(n.left, `${node.id} left inside ${group.label}`).toBeGreaterThanOrEqual(g.left);
  expect(n.top, `${node.id} top inside ${group.label}`).toBeGreaterThanOrEqual(g.top);
  expect(n.right, `${node.id} right inside ${group.label}`).toBeLessThanOrEqual(g.right);
  expect(n.bottom, `${node.id} bottom inside ${group.label}`).toBeLessThanOrEqual(g.bottom);
}

function rectsOverlap(a: ReturnType<typeof groupRect>, b: ReturnType<typeof groupRect>): boolean {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

const RESERVED_ID_PATTERN = /^(ghostAnchor__|draft-|temp-)/;

function expectNoReservedIds(diagram: CanonicalDiagram) {
  for (const n of diagram.nodes) expect(n.id).not.toMatch(RESERVED_ID_PATTERN);
  for (const e of diagram.edges) expect(e.id).not.toMatch(RESERVED_ID_PATTERN);
  for (const g of diagram.groups ?? []) expect(g.id).not.toMatch(RESERVED_ID_PATTERN);
}

function expectDeterministicImport(code: string) {
  const a = importMermaidFlowchart(code).diagram;
  const b = importMermaidFlowchart(code).diagram;
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
}

/** Import + assert the exported Mermaid re-imports without structural loss. */
function expectMermaidRoundTrip(diagram: CanonicalDiagram) {
  const exported = toMermaid(diagram);
  const reimported = importMermaidFlowchart(exported).diagram;
  expect(reimported.nodes.map((n) => n.id).sort()).toEqual(diagram.nodes.map((n) => n.id).sort());
  expect(reimported.edges.length).toBe(diagram.edges.length);
  expect((reimported.groups ?? []).length).toBe((diagram.groups ?? []).length);
}

// ---------------------------------------------------------------------------
// 1 & 2 & 3. Directionality — chains in all four directions
// ---------------------------------------------------------------------------

describe('contract — directionality', () => {
  it('TD chain: ranks increase downward', () => {
    const code = `graph TD
      A[Start] --> B[Process]
      B --> C[End]`;
    const { diagram } = importMermaidFlowchart(code);
    const [a, b, c] = [nodeById(diagram, 'A'), nodeById(diagram, 'B'), nodeById(diagram, 'C')];
    expect(centerOf(a).y).toBeLessThan(centerOf(b).y);
    expect(centerOf(b).y).toBeLessThan(centerOf(c).y);
    expectDeterministicImport(code);
    expectNoReservedIds(diagram);
    expectMermaidRoundTrip(diagram);
  });

  it('LR chain: ranks increase rightward', () => {
    const code = `graph LR
      A[Start] --> B[Process]
      B --> C[End]`;
    const { diagram } = importMermaidFlowchart(code);
    const [a, b, c] = [nodeById(diagram, 'A'), nodeById(diagram, 'B'), nodeById(diagram, 'C')];
    expect(centerOf(a).x).toBeLessThan(centerOf(b).x);
    expect(centerOf(b).x).toBeLessThan(centerOf(c).x);
    expectDeterministicImport(code);
    expectMermaidRoundTrip(diagram);
  });

  it('BT chain: ranks increase upward', () => {
    const code = `graph BT
      A --> B
      B --> C`;
    const { diagram } = importMermaidFlowchart(code);
    const [a, b, c] = [nodeById(diagram, 'A'), nodeById(diagram, 'B'), nodeById(diagram, 'C')];
    expect(centerOf(a).y).toBeGreaterThan(centerOf(b).y);
    expect(centerOf(b).y).toBeGreaterThan(centerOf(c).y);
    expectDeterministicImport(code);
  });

  it('RL chain: ranks increase leftward', () => {
    const code = `graph RL
      A --> B
      B --> C`;
    const { diagram } = importMermaidFlowchart(code);
    const [a, b, c] = [nodeById(diagram, 'A'), nodeById(diagram, 'B'), nodeById(diagram, 'C')];
    expect(centerOf(a).x).toBeGreaterThan(centerOf(b).x);
    expect(centerOf(b).x).toBeGreaterThan(centerOf(c).x);
    expectDeterministicImport(code);
  });
});

// ---------------------------------------------------------------------------
// 4. Decision diamond
// ---------------------------------------------------------------------------

describe('contract — decision diamond', () => {
  const code = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do it]
    B -->|No| D[Skip it]`;

  it('places branches on the rank below the decision, siblings side by side', () => {
    const { diagram } = importMermaidFlowchart(code);
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((id) => nodeById(diagram, id));
    expect(centerOf(a).y).toBeLessThan(centerOf(b).y);
    expect(centerOf(b).y).toBeLessThan(centerOf(c).y);
    expect(centerOf(b).y).toBeLessThan(centerOf(d).y);
    // Siblings share the rank (similar y) and do not overlap
    expect(Math.abs(centerOf(c).y - centerOf(d).y)).toBeLessThan(30);
    expect(rectsOverlap(nodeRect(c) as never, nodeRect(d) as never)).toBe(false);
  });

  it('sibling order is stable across imports', () => {
    const r1 = importMermaidFlowchart(code).diagram;
    const r2 = importMermaidFlowchart(code).diagram;
    const order = (d: CanonicalDiagram) =>
      ['C', 'D'].sort((x, y) => centerOf(nodeById(d, x)).x - centerOf(nodeById(d, y)).x).join(',');
    expect(order(r1)).toBe(order(r2));
  });
});

// ---------------------------------------------------------------------------
// 5. Edge labels
// ---------------------------------------------------------------------------

describe('contract — edge labels', () => {
  it('labeled edges do not collapse rank spacing', () => {
    const labeled = importMermaidFlowchart(`graph TD
      A -->|validated| B
      A -->|rejected| C`).diagram;
    const unlabeled = importMermaidFlowchart(`graph TD
      A --> B
      A --> C`).diagram;

    const gapLabeled = centerOf(nodeById(labeled, 'B')).y - centerOf(nodeById(labeled, 'A')).y;
    const gapUnlabeled = centerOf(nodeById(unlabeled, 'B')).y - centerOf(nodeById(unlabeled, 'A')).y;
    expect(gapLabeled).toBeGreaterThanOrEqual(gapUnlabeled);

    // Label proxy must keep sibling targets apart
    const b = nodeRect(nodeById(labeled, 'B'));
    const c = nodeRect(nodeById(labeled, 'C'));
    expect(rectsOverlap(b as never, c as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Single subgraph
// ---------------------------------------------------------------------------

describe('contract — subgraph', () => {
  const code = `graph TD
    subgraph Group 1
      A --> B
    end
    B --> C`;

  it('group contains its children with positive dimensions and padding', () => {
    const { diagram } = importMermaidFlowchart(code);
    const group = groupByLabel(diagram, 'Group 1');
    expect(group.width).toBeGreaterThan(0);
    expect(group.height).toBeGreaterThan(0);

    const a = nodeById(diagram, 'A');
    const b = nodeById(diagram, 'B');
    expectGroupContains(group, a);
    expectGroupContains(group, b);
    // Padding: children stay at least CLUSTER_PADDING away from the border
    const g = groupRect(group);
    for (const n of [a, b]) {
      const r = nodeRect(n);
      expect(r.left - g.left).toBeGreaterThanOrEqual(MERMAID_LIKE_CLUSTER_PADDING);
      expect(g.right - r.right).toBeGreaterThanOrEqual(MERMAID_LIKE_CLUSTER_PADDING);
    }

    // External node C stays outside the group, below B (flow direction)
    const c = nodeById(diagram, 'C');
    expect(rectsOverlap(groupRect(group), nodeRect(c))).toBe(false);
    expect(centerOf(c).y).toBeGreaterThan(centerOf(b).y);
    expectDeterministicImport(code);
    expectMermaidRoundTrip(diagram);
  });
});

// ---------------------------------------------------------------------------
// 7. Multiple adjacent subgraphs
// ---------------------------------------------------------------------------

describe('contract — adjacent subgraphs', () => {
  const code = `graph LR
    subgraph Left
      A --> B
    end
    subgraph Right
      C --> D
    end
    B --> C`;

  it('groups do not overlap and respect flow direction', () => {
    const { diagram } = importMermaidFlowchart(code);
    const left = groupByLabel(diagram, 'Left');
    const right = groupByLabel(diagram, 'Right');

    expect(rectsOverlap(groupRect(left), groupRect(right))).toBe(false);
    // LR flow: Left group before Right group along x
    const leftCenter = left.position.x + left.width / 2;
    const rightCenter = right.position.x + right.width / 2;
    expect(leftCenter).toBeLessThan(rightCenter);

    expectGroupContains(left, nodeById(diagram, 'A'));
    expectGroupContains(left, nodeById(diagram, 'B'));
    expectGroupContains(right, nodeById(diagram, 'C'));
    expectGroupContains(right, nodeById(diagram, 'D'));
    expectDeterministicImport(code);
    expectMermaidRoundTrip(diagram);
  });
});

// ---------------------------------------------------------------------------
// 8. Nested subgraphs
// ---------------------------------------------------------------------------

describe('contract — nested subgraphs', () => {
  const code = `graph TD
    subgraph Outer
      subgraph Inner
        A --> B
      end
    end
    B --> C`;

  it('outer contains inner, inner contains its nodes', () => {
    const { diagram } = importMermaidFlowchart(code);
    const outer = groupByLabel(diagram, 'Outer');
    const inner = groupByLabel(diagram, 'Inner');
    expect(inner.parentGroupId).toBe(outer.id);

    expect(outer.width).toBeGreaterThan(0);
    expect(outer.height).toBeGreaterThan(0);
    expect(inner.width).toBeGreaterThan(0);
    expect(inner.height).toBeGreaterThan(0);

    // Inner frame fully inside outer frame
    const o = groupRect(outer);
    const i = groupRect(inner);
    expect(i.left).toBeGreaterThanOrEqual(o.left);
    expect(i.top).toBeGreaterThanOrEqual(o.top);
    expect(i.right).toBeLessThanOrEqual(o.right);
    expect(i.bottom).toBeLessThanOrEqual(o.bottom);

    expectGroupContains(inner, nodeById(diagram, 'A'));
    expectGroupContains(inner, nodeById(diagram, 'B'));

    // C is external to both groups
    const c = nodeById(diagram, 'C');
    expect(rectsOverlap(groupRect(outer), nodeRect(c))).toBe(false);
    expectDeterministicImport(code);
    expectMermaidRoundTrip(diagram);
  });
});

// ---------------------------------------------------------------------------
// 9. Mixed node shapes
// ---------------------------------------------------------------------------

describe('contract — mixed shapes', () => {
  const code = `graph TD
    A([Start]) --> B[Process]
    B --> C{Decision}
    C --> D((End))`;

  it('keeps rank order and non-overlap across differently sized shapes', () => {
    const { diagram } = importMermaidFlowchart(code);
    const ids = ['A', 'B', 'C', 'D'];
    const nodes = ids.map((id) => nodeById(diagram, id));

    expect(nodes[0].shape).toBe('stadium');
    expect(nodes[1].shape).toBe('process');
    expect(nodes[2].shape).toBe('decision');
    expect(nodes[3].shape).toBe('event');

    for (let i = 0; i + 1 < nodes.length; i++) {
      expect(centerOf(nodes[i]).y).toBeLessThan(centerOf(nodes[i + 1]).y);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(rectsOverlap(nodeRect(nodes[i]) as never, nodeRect(nodes[j]) as never)).toBe(false);
      }
    }
    expectDeterministicImport(code);
    expectMermaidRoundTrip(diagram);
  });
});

// ---------------------------------------------------------------------------
// Per-subgraph direction (Mermaid `direction` keyword)
// ---------------------------------------------------------------------------

describe('contract — per-subgraph direction', () => {
  it('honors an explicit direction inside a subgraph', () => {
    const code = `graph TD
      subgraph S
        direction LR
        A --> B
      end
      B --> C`;
    const { diagram } = importMermaidFlowchart(code);
    const a = nodeById(diagram, 'A');
    const b = nodeById(diagram, 'B');
    // LR inside the subgraph: A left of B, roughly same rank
    expect(centerOf(a).x).toBeLessThan(centerOf(b).x);
    expect(Math.abs(centerOf(a).y - centerOf(b).y)).toBeLessThan(30);
  });
});

// ---------------------------------------------------------------------------
// Persistence / normalization safety
// ---------------------------------------------------------------------------

describe('contract — persisted state safety', () => {
  it('imported diagrams survive normalizeDiagram unchanged in structure', () => {
    const code = `graph LR
      subgraph Left
        A --> B
      end
      subgraph Right
        C --> D
      end
      B --> C`;
    const { diagram } = importMermaidFlowchart(code);
    const normalized = normalizeDiagram(diagram);
    expect(normalized.nodes.map((n) => n.id).sort()).toEqual(diagram.nodes.map((n) => n.id).sort());
    expect((normalized.groups ?? []).map((g) => g.id).sort()).toEqual(
      (diagram.groups ?? []).map((g) => g.id).sort(),
    );
    // Positions and sizes preserved through normalization
    for (const n of normalized.nodes) {
      const original = nodeById(diagram, n.id);
      expect(n.position).toEqual(original.position);
    }
    expectNoReservedIds(normalized);
  });
});

// ---------------------------------------------------------------------------
// estimateNodeSize — pure helper, exact assertions allowed
// ---------------------------------------------------------------------------

describe('estimateNodeSize', () => {
  it('grows width with label length for content-sized shapes', () => {
    const short = estimateNodeSize('process', 'Hi');
    const long = estimateNodeSize('process', 'A very long process label indeed');
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.width).toBe(
      Math.min(
        NODE_MAX_ESTIMATED_WIDTH,
        Math.max(
          NODE_SIZE_DEFAULTS.process.minWidth,
          Math.round('A very long process label indeed'.length * NODE_LABEL_CHAR_WIDTH + 2 * NODE_PADDING),
        ),
      ),
    );
  });

  it('never shrinks below shape minimums', () => {
    const size = estimateNodeSize('process', '');
    expect(size.width).toBeGreaterThanOrEqual(NODE_SIZE_DEFAULTS.process.minWidth);
    expect(size.height).toBeGreaterThanOrEqual(NODE_SIZE_DEFAULTS.process.minHeight);
  });

  it('caps pathological labels at NODE_MAX_ESTIMATED_WIDTH', () => {
    const size = estimateNodeSize('process', 'x'.repeat(500));
    expect(size.width).toBe(NODE_MAX_ESTIMATED_WIDTH);
  });

  it('keeps circles square', () => {
    const size = estimateNodeSize('event', 'Done');
    expect(size.width).toBe(size.height);
  });

  it('handles multi-line labels by max line and line count', () => {
    const oneLine = estimateNodeSize('process', 'Hello world');
    const twoLines = estimateNodeSize('process', 'Hello\nworld');
    expect(twoLines.width).toBeLessThanOrEqual(oneLine.width);
    expect(twoLines.height).toBeGreaterThanOrEqual(oneLine.height);
  });

  it('is deterministic', () => {
    expect(estimateNodeSize('decision', 'Choice?')).toEqual(estimateNodeSize('decision', 'Choice?'));
  });
});
