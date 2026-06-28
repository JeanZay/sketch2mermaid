/**
 * Ghost Arrows — Mermaid Export Regression Matrix
 *
 * Tests every combination of:
 *   edge style (solid, dotted) × direction (directed, undirected, bidirectional, reverse) ×
 *   endpoint state (connected→connected, connected→detached, detached→connected, detached→detached)
 *
 * Expected invariants:
 *   - Only connected→connected edges are exported
 *   - All detached variants are omitted
 *   - Labels, styles, and directions are correct for exported edges
 */
import { describe, test, expect } from 'vitest';
import type { CanonicalDiagram, DiagramEdge, EdgeStyle, EdgeDirection } from './types';
import { toMermaid, getMermaidEdgeOperator } from './mermaid';
import { normalizeDiagram } from '../store/diagramStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEdge(
  id: string,
  fromKind: 'connected' | 'detached',
  toKind: 'connected' | 'detached',
  style: EdgeStyle,
  direction: EdgeDirection,
  label = '',
): DiagramEdge {
  const from =
    fromKind === 'connected'
      ? ({ kind: 'connected', nodeId: 'n1', handleId: null } as const)
      : ({ kind: 'detached', point: { x: 100, y: 100 } } as const);
  const to =
    toKind === 'connected'
      ? ({ kind: 'connected', nodeId: 'n2', handleId: null } as const)
      : ({ kind: 'detached', point: { x: 300, y: 300 } } as const);

  const connectionStatus = fromKind === 'connected' && toKind === 'connected' ? 'connected' as const : 'detached' as const;

  return {
    id,
    from,
    to,
    connectionStatus,
    exportMode: 'mermaid',
    label,
    style,
    direction,
  };
}

const STYLES: EdgeStyle[] = ['solid', 'dotted'];
const DIRECTIONS: EdgeDirection[] = ['directed', 'undirected', 'bidirectional', 'reverse'];
const ENDPOINT_VARIANTS = [
  ['connected', 'connected'],
  ['connected', 'detached'],
  ['detached', 'connected'],
  ['detached', 'detached'],
] as const;

const baseDiagram: CanonicalDiagram = {
  diagramType: 'flowchart',
  direction: 'TD',
  nodes: [
    { id: 'n1', label: 'Source', shape: 'process', position: { x: 0, y: 0 } },
    { id: 'n2', label: 'Target', shape: 'process', position: { x: 200, y: 0 } },
  ],
  edges: [],
  textBoxes: [],
};

// ---------------------------------------------------------------------------
// Matrix tests: each style × direction × endpoint combination
// ---------------------------------------------------------------------------

describe('Mermaid export regression matrix', () => {
  let edgeIdx = 0;

  for (const style of STYLES) {
    for (const direction of DIRECTIONS) {
      for (const [fromKind, toKind] of ENDPOINT_VARIANTS) {
        const edgeId = `e${++edgeIdx}`;
        const shouldExport = fromKind === 'connected' && toKind === 'connected';
        const desc = `${style} ${direction}: ${fromKind}→${toKind} → ${shouldExport ? 'exported' : 'omitted'}`;

        test(desc, () => {
          const edge = makeEdge(edgeId, fromKind, toKind, style, direction);
          const diagram = normalizeDiagram({ ...baseDiagram, edges: [edge] });
          const mermaid = toMermaid(diagram);

          if (shouldExport) {
            const op = getMermaidEdgeOperator(style, direction);
            expect(mermaid).toContain(`n1 ${op} n2`);
            // No detached coordinate values in exported Mermaid
            expect(mermaid).not.toMatch(/point/);
            expect(mermaid).not.toMatch(/detached/);
          } else {
            // Should not contain any edge operator
            const operators = [
              '-->', '---', '<-->', '<---', '-.->', '-.-', '<-.->','<-.-',
            ];
            for (const op of operators) {
              // Allow operator in legend comment, but not as an edge connection
              expect(mermaid).not.toContain(`n1 ${op} n2`);
            }
            // No ghost or draft IDs
            expect(mermaid).not.toContain('ghost');
            expect(mermaid).not.toContain('draft');
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Label correctness matrix
  // ---------------------------------------------------------------------------
  describe('label preservation for connected→connected edges', () => {
    const LABEL_CASES = [
      { label: 'Simple', expected: 'Simple' },
      { label: 'With & Entity', expected: 'With &amp; Entity' },
      { label: '', expected: null }, // no label → no pipe syntax
      { label: 'Multi\nLine', expected: 'Multi<br/>Line' },
    ];

    for (const { label, expected } of LABEL_CASES) {
      test(`label "${label.replace(/\n/g, '\\n')}" is preserved correctly`, () => {
        const edge = makeEdge('label-e', 'connected', 'connected', 'solid', 'directed', label);
        const diagram = normalizeDiagram({ ...baseDiagram, edges: [edge] });
        const mermaid = toMermaid(diagram);

        if (expected !== null) {
          expect(mermaid).toContain(`|"${expected}"|`);
        } else {
          // Empty label: no pipe syntax
          expect(mermaid).toContain('n1 --> n2');
          expect(mermaid).not.toContain('|');
        }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // canvasOnly exportMode: should NEVER appear in Mermaid output
  // ---------------------------------------------------------------------------
  describe('canvasOnly exportMode is always omitted', () => {
    for (const style of STYLES) {
      for (const direction of DIRECTIONS) {
        test(`canvasOnly ${style} ${direction} connected→connected is omitted`, () => {
          const edge: DiagramEdge = {
            id: 'co-e',
            from: { kind: 'connected', nodeId: 'n1', handleId: null },
            to: { kind: 'connected', nodeId: 'n2', handleId: null },
            connectionStatus: 'connected',
            exportMode: 'canvasOnly', // excluded from Mermaid
            label: 'should not appear',
            style,
            direction,
          };
          const diagram = normalizeDiagram({ ...baseDiagram, edges: [edge] });
          const mermaid = toMermaid(diagram);
          // Nodes ARE still exported as Mermaid nodes — only the edge is skipped
          expect(mermaid).toContain('n1');
          expect(mermaid).toContain('n2');
          // The label should not appear
          expect(mermaid).not.toContain('should not appear');
          // No edge operators between n1 and n2
          expect(mermaid).not.toContain(`n1 ${getMermaidEdgeOperator(style, direction)} n2`);
          expect(mermaid).not.toContain(`n1 ${getMermaidEdgeOperator(style, direction)}|`);
        });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Mixed batch: only connected→connected are exported
  // ---------------------------------------------------------------------------
  test('mixed batch: only connected edges appear in output', () => {
    const edges: DiagramEdge[] = [
      makeEdge('e_cc', 'connected', 'connected', 'solid', 'directed', 'cc'),
      makeEdge('e_cd', 'connected', 'detached', 'solid', 'directed', 'cd'),
      makeEdge('e_dc', 'detached', 'connected', 'solid', 'directed', 'dc'),
      makeEdge('e_dd', 'detached', 'detached', 'solid', 'directed', 'dd'),
    ];

    const diagram = normalizeDiagram({ ...baseDiagram, edges });
    const mermaid = toMermaid(diagram);

    // Only the connected→connected edge should appear
    expect(mermaid).toContain('"cc"');
    expect(mermaid).not.toContain('"cd"');
    expect(mermaid).not.toContain('"dc"');
    expect(mermaid).not.toContain('"dd"');

    // No temporary IDs
    expect(mermaid).not.toContain('ghostAnchor');
    expect(mermaid).not.toContain('draft');
    expect(mermaid).not.toContain('detached');
  });

  // ---------------------------------------------------------------------------
  // getMermaidEdgeOperator correctness table
  // ---------------------------------------------------------------------------
  describe('getMermaidEdgeOperator returns correct Mermaid syntax', () => {
    const cases: Array<[EdgeStyle, EdgeDirection, string]> = [
      ['solid', 'directed', '-->'],
      ['solid', 'undirected', '---'],
      ['solid', 'bidirectional', '<-->'],
      ['solid', 'reverse', '<---'],
      ['dotted', 'directed', '-.->'],
      ['dotted', 'undirected', '-.-'],
      ['dotted', 'bidirectional', '<-.->'],
      ['dotted', 'reverse', '<-.-'],
    ];

    for (const [style, dir, expected] of cases) {
      test(`${style} ${dir} → "${expected}"`, () => {
        expect(getMermaidEdgeOperator(style, dir)).toBe(expected);
      });
    }
  });
});
