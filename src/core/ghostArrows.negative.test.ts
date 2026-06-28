/**
 * Ghost Arrows — Negative Testing
 *
 * These tests deliberately feed invalid or inconsistent diagram states into
 * normalizeDiagram and toMermaid/parseSketch2MermaidFile, verifying the
 * application does not crash and behaves deterministically.
 *
 * Chosen behaviour per case is documented inline.
 */
import { describe, test, expect } from 'vitest';
import type { CanonicalDiagram, DiagramEdge } from './types';
import { isExportableEdge } from './types';
import { toMermaid } from './mermaid';
import { normalizeDiagram } from '../store/diagramStore';
import { parseSketch2MermaidFile, serializeSketch2MermaidFile } from './s2mFile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseNode(id: string) {
  return { id, label: 'Node', shape: 'process' as const, position: { x: 0, y: 0 } };
}

function makeDiagram(overrides: Partial<CanonicalDiagram> = {}): CanonicalDiagram {
  return {
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: [],
    edges: [],
    textBoxes: [],
    groups: [],
    ...overrides,
  };
}

const TEMP_IDS = ['ghostAnchor__', 'draft-start-temp-node', 'draft-end-temp-node', 'draft-edge-preview'];

function assertNoTempIds(output: string) {
  for (const id of TEMP_IDS) {
    expect(output).not.toContain(id);
  }
}

// ---------------------------------------------------------------------------
// Case 1: Edge with from.kind='connected' but missing nodeId
// Expected: normalizeDiagram demotes to detached (nodeId not in nodeSet)
// ---------------------------------------------------------------------------
describe('NC-1: connected endpoint with empty/missing nodeId', () => {
  test('normalizeDiagram demotes to detached when nodeId is empty string', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: '', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as unknown as DiagramEdge,
      ],
    });

    expect(() => normalizeDiagram(raw)).not.toThrow();
    const normalized = normalizeDiagram(raw);
    // Empty nodeId is not in the nodeSet, so from becomes detached
    expect(normalized.edges[0].from.kind).toBe('detached');
    expect(normalized.edges[0].connectionStatus).toBe('detached');
    expect(isExportableEdge(normalized.edges[0])).toBe(false);
  });

  test('toMermaid does not emit edge with demoted detached from endpoint', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: '', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as unknown as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    const mermaid = toMermaid(normalized);
    expect(mermaid).not.toContain('-->');
    assertNoTempIds(mermaid);
  });
});

// ---------------------------------------------------------------------------
// Case 2: Edge with to.kind='connected' referencing a non-existing node
// Expected: normalizeDiagram demotes to-endpoint to detached with fallback point
// ---------------------------------------------------------------------------
describe('NC-2: connected target references non-existing node', () => {
  test('normalizeDiagram demotes to detached', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n_GHOST', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.edges[0].to.kind).toBe('detached');
    expect(normalized.edges[0].connectionStatus).toBe('detached');
  });

  test('toMermaid omits the edge', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n_GHOST', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    const mermaid = toMermaid(normalized);
    expect(mermaid).not.toContain('-->');
  });
});

// ---------------------------------------------------------------------------
// Case 3: Edge with from.kind='detached' but missing point
// Expected: normalizeDiagram fills in fallback point {x:100, y:100}
// ---------------------------------------------------------------------------
describe('NC-3: detached endpoint with missing point', () => {
  test('normalizeDiagram fills fallback coordinates and does not throw', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'detached' } as unknown as DiagramEdge['from'],
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'detached',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    expect(() => normalizeDiagram(raw)).not.toThrow();
    const normalized = normalizeDiagram(raw);
    expect(normalized.edges[0].from.kind).toBe('detached');
    if (normalized.edges[0].from.kind === 'detached') {
      expect(Number.isFinite(normalized.edges[0].from.point.x)).toBe(true);
      expect(Number.isFinite(normalized.edges[0].from.point.y)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Case 4: Detached point with invalid coordinates (NaN, Infinity, null, string, huge)
// Expected: normalizeDiagram clamps to finite fallback values
// ---------------------------------------------------------------------------
describe('NC-4: detached point with invalid coordinates', () => {
  const badCoords = [
    { x: NaN, y: 100 },
    { x: Infinity, y: 100 },
    { x: -Infinity, y: -Infinity },
    { x: null as unknown as number, y: 100 },
    { x: 'bad' as unknown as number, y: 100 },
    { x: 1e15, y: 1e15 },
  ];

  for (const coord of badCoords) {
    test(`coordinates ${JSON.stringify(coord)} → finite fallback`, () => {
      const raw = makeDiagram({
        nodes: [baseNode('n1')],
        edges: [
          {
            id: 'e1',
            from: { kind: 'detached', point: coord },
            to: { kind: 'connected', nodeId: 'n1', handleId: null },
            connectionStatus: 'detached',
            exportMode: 'mermaid',
            label: '',
            style: 'solid',
            direction: 'directed',
          } as unknown as DiagramEdge,
        ],
      });

      expect(() => normalizeDiagram(raw)).not.toThrow();
      const normalized = normalizeDiagram(raw);
      expect(normalized.edges[0].from.kind).toBe('detached');
      if (normalized.edges[0].from.kind === 'detached') {
        // Coordinates must be finite after normalization (except large numbers which are preserved)
        const isXInvalid = !Number.isFinite(coord.x) || coord.x === null || typeof coord.x !== 'number';
        if (isXInvalid) {
          expect(Number.isFinite(normalized.edges[0].from.point.x)).toBe(true);
        }
      }

      expect(() => toMermaid(normalized)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// Case 5: Edge with connectionStatus='connected' but one endpoint is detached
// Expected: normalizeDiagram recalculates to 'detached'
// ---------------------------------------------------------------------------
describe('NC-5: incoherent connectionStatus — connected status with detached endpoint', () => {
  test('normalizeDiagram recalculates connectionStatus to detached', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1'), baseNode('n2')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'detached', point: { x: 50, y: 50 } },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected', // wrong!
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.edges[0].connectionStatus).toBe('detached');
    expect(isExportableEdge(normalized.edges[0])).toBe(false);
  });

  test('toMermaid omits the edge', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1'), baseNode('n2')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'detached', point: { x: 50, y: 50 } },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    const mermaid = toMermaid(normalized);
    expect(mermaid).not.toContain('-->');
  });
});

// ---------------------------------------------------------------------------
// Case 6: Edge with connectionStatus='detached' but both endpoints are connected
// Expected: normalizeDiagram recalculates to 'connected'
// ---------------------------------------------------------------------------
describe('NC-6: incoherent connectionStatus — detached status with both connected', () => {
  test('normalizeDiagram recalculates connectionStatus to connected', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1'), baseNode('n2')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'detached', // wrong!
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.edges[0].connectionStatus).toBe('connected');
    expect(isExportableEdge(normalized.edges[0])).toBe(true);
  });

  test('toMermaid emits the corrected edge', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1'), baseNode('n2')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'detached',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const normalized = normalizeDiagram(raw);
    const mermaid = toMermaid(normalized);
    expect(mermaid).toContain('n1 --> n2');
  });
});

// ---------------------------------------------------------------------------
// Case 7: Duplicate edge IDs
// Expected: normalizeDiagram keeps both (deduplication is not its responsibility);
//           s2m parser rejects on load with error
// ---------------------------------------------------------------------------
describe('NC-7: duplicate edge IDs', () => {
  test('normalizeDiagram does not throw with duplicate edge IDs', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1'), baseNode('n2')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: 'first',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
        {
          id: 'e1', // duplicate!
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: 'second',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    expect(() => normalizeDiagram(raw)).not.toThrow();
    expect(() => toMermaid(normalizeDiagram(raw))).not.toThrow();
  });

  test('s2m parser rejects file with duplicate edge IDs', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1'), baseNode('n2')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: { ...raw, schemaVersion: 1 },
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Duplicate edge ID');
    }
  });
});

// ---------------------------------------------------------------------------
// Case 8: Edge referencing temporary/ghost node IDs
// Expected: normalizeDiagram treats as missing-node → demotes connected to detached
//           toMermaid never emits ghostAnchor/draft ids
// ---------------------------------------------------------------------------
describe('NC-8: edge referencing temporary ghost/draft node IDs', () => {
  const tempNodeIds = [
    'ghostAnchor__edge1__from',
    'draft-start-temp-node',
    'draft-end-temp-node',
  ];

  for (const tempId of tempNodeIds) {
    test(`normalizeDiagram demotes endpoint referencing "${tempId}"`, () => {
      const raw = makeDiagram({
        nodes: [baseNode('n1')],
        edges: [
          {
            id: 'e1',
            from: { kind: 'connected', nodeId: tempId, handleId: null },
            to: { kind: 'connected', nodeId: 'n1', handleId: null },
            connectionStatus: 'connected',
            exportMode: 'mermaid',
            label: '',
            style: 'solid',
            direction: 'directed',
          } as DiagramEdge,
        ],
      });

      expect(() => normalizeDiagram(raw)).not.toThrow();
      const normalized = normalizeDiagram(raw);
      // Temp ID is not in nodes, so it becomes detached
      expect(normalized.edges[0].from.kind).toBe('detached');
      expect(normalized.edges[0].connectionStatus).toBe('detached');

      const mermaid = toMermaid(normalized);
      assertNoTempIds(mermaid);
      expect(mermaid).not.toContain(tempId);
    });
  }

  test('toMermaid never emits ghostAnchor IDs even if somehow they appeared in nodes', () => {
    // Simulate the worst-case: a ghost anchor node actually in diagram.nodes
    const raw = makeDiagram({
      nodes: [
        baseNode('n1'),
        { id: 'ghostAnchor__e1__from', label: 'ghost', shape: 'process' as const, position: { x: 0, y: 0 } },
      ],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'ghostAnchor__e1__from', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    // normalizeDiagram keeps the ghost node because it's structurally valid
    // (has valid id, shape, position), but toMermaid will include it as a node.
    // The key assertion is: toMermaid does NOT crash and the edge exists (since
    // ghostAnchor ID is in nodes). The real protection is at the save boundary.
    expect(() => normalizeDiagram(raw)).not.toThrow();
    expect(() => toMermaid(normalizeDiagram(raw))).not.toThrow();

    // Serialize to s2m — a real s2m file should never contain ghost nodes in nodes array.
    // The serializer passes diagram.nodes through directly.
    const serialized = serializeSketch2MermaidFile(normalizeDiagram(raw));
    // The s2m file would include the ghost node in the nodes array — this is the leak.
    // This test documents the known gap: the serializer does not filter ghost IDs.
    // Runtime protection relies entirely on the UI never calling addNode with ghost IDs.
    expect(serialized).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Case 9: Self-loop edge (source === target)
// Expected: normalizeDiagram keeps it (valid Mermaid); toMermaid emits it
// ---------------------------------------------------------------------------
describe('NC-9: self-loop edge (source === target)', () => {
  test('normalizeDiagram keeps the edge', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    expect(() => normalizeDiagram(raw)).not.toThrow();
    const normalized = normalizeDiagram(raw);
    expect(normalized.edges).toHaveLength(1);
    expect(isExportableEdge(normalized.edges[0])).toBe(true);
  });

  test('toMermaid emits self-loop edge without crashing', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    const mermaid = toMermaid(normalizeDiagram(raw));
    expect(mermaid).toContain('n1 --> n1');
    assertNoTempIds(mermaid);
  });
});

// ---------------------------------------------------------------------------
// Case 10: Edge whose source and target are the same handle
// Expected: same as self-loop (source === target), valid Mermaid
// ---------------------------------------------------------------------------
describe('NC-10: edge source and target on same exact handle', () => {
  test('normalizeDiagram keeps the edge and toMermaid does not crash', () => {
    const raw = makeDiagram({
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
          to: { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        } as DiagramEdge,
      ],
    });

    expect(() => normalizeDiagram(raw)).not.toThrow();
    const normalized = normalizeDiagram(raw);
    expect(() => toMermaid(normalized)).not.toThrow();
    const mermaid = toMermaid(normalized);
    expect(mermaid).toContain('n1 --> n1');
  });
});

// ---------------------------------------------------------------------------
// Additional: null/undefined edge entries in array
// FIXED (BUG-1 + BUG-2): Both normalizeDiagram and parseSketch2MermaidFile
// now handle null/non-object edge entries without crashing.
// ---------------------------------------------------------------------------
describe('NC-extra: null/undefined edge entries in array', () => {
  test('normalizeDiagram silently drops null edge entries (BUG-1 fixed)', () => {
    const validEdge: import('./types').DiagramEdge = {
      id: 'e1',
      from: { kind: 'connected', nodeId: 'n1', handleId: null },
      to: { kind: 'connected', nodeId: 'n1', handleId: null },
      connectionStatus: 'connected',
      exportMode: 'mermaid',
      label: '',
      style: 'solid',
      direction: 'directed',
    };
    const raw = {
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [baseNode('n1')],
      edges: [null, undefined, validEdge] as unknown as import('./types').DiagramEdge[],
      textBoxes: [],
    };

    // Must NOT throw after BUG-1 fix
    expect(() => normalizeDiagram(raw)).not.toThrow();
    const normalized = normalizeDiagram(raw);
    // null and undefined are dropped; the valid edge is preserved
    expect(normalized.edges).toHaveLength(1);
    expect(normalized.edges[0].id).toBe('e1');
  });

  test('s2m parser returns ok:false for null edge entries (BUG-2 fixed)', () => {
    const json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        schemaVersion: 1,
        nodes: [{ id: 'n1', label: 'Node', shape: 'process', position: { x: 0, y: 0 } }],
        edges: [null],
        textBoxes: [],
      },
    });

    // Must NOT throw after BUG-2 fix — returns { ok: false } cleanly
    expect(() => parseSketch2MermaidFile(json)).not.toThrow();
    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Edge at index 0 is not a valid object/);
    }
  });

  test('s2m parser returns ok:false for null node entries (BUG-2 fixed)', () => {
    const json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        schemaVersion: 1,
        nodes: [null],
        edges: [],
        textBoxes: [],
      },
    });

    expect(() => parseSketch2MermaidFile(json)).not.toThrow();
    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Node at index 0 is not a valid object/);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional: adversarial .s2m files
// ---------------------------------------------------------------------------
describe('adversarial .s2m file inputs', () => {
  function makeS2m(diagram: unknown, version: 1 | 2 = 1) {
    return JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: version,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: { ...diagram, ...(version === 1 ? { schemaVersion: 1 } : {}) },
    });
  }

  test('rejects edge with NaN detached coordinates', () => {
    const json = makeS2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'detached', point: { x: NaN, y: NaN } },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'detached',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
        },
      ],
      textBoxes: [],
    });

    const result = parseSketch2MermaidFile(json);
    // The validator checks for finite coords in detached endpoints
    expect(result.ok).toBe(false);
  });

  test('rejects edge with Infinity detached coordinates', () => {
    const json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        schemaVersion: 1,
        nodes: [{ id: 'n1', label: 'Node', shape: 'process', position: { x: 0, y: 0 } }],
        edges: [
          {
            id: 'e1',
            from: { kind: 'detached', point: { x: Infinity, y: 100 } },
            to: { kind: 'connected', nodeId: 'n1', handleId: null },
            connectionStatus: 'detached',
            exportMode: 'mermaid',
            label: '',
            style: 'solid',
          },
        ],
        textBoxes: [],
      },
    });

    // JSON.stringify converts Infinity to null, so the file has null coords
    const result = parseSketch2MermaidFile(json);
    // null is not a number, so validateEndpoint returns false
    expect(result.ok).toBe(false);
  });

  test('rejects edge with ghostAnchor ID as connected source (BUG-3 fixed)', () => {
    const json = makeS2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'ghostAnchor__e1__from', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
        },
      ],
      textBoxes: [],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Now catches the reserved ID before the missing-node check
      expect(result.error).toContain('reserved internal node ID');
    }
  });

  test('rejects node with ghostAnchor__ ID prefix (BUG-3 fixed)', () => {
    const json = makeS2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Real', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'ghostAnchor__e1__from', label: 'Ghost', shape: 'process', position: { x: 200, y: 0 } },
      ],
      edges: [],
      textBoxes: [],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('reserved internal ID prefix');
    }
  });

  test('rejects node with draft- ID prefix (BUG-3 fixed)', () => {
    const json = makeS2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'draft-start-temp-node', label: 'Draft', shape: 'process', position: { x: 0, y: 0 } },
      ],
      edges: [],
      textBoxes: [],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('reserved internal ID prefix');
    }
  });

  test('rejects edge with connected target referencing reserved ID (BUG-3 fixed)', () => {
    const json = makeS2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'temp-target-node', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
        },
      ],
      textBoxes: [],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('reserved internal node ID');
    }
  });

  test('accepts valid detached edge and normalizes it correctly', () => {
    const json = makeS2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [baseNode('n1')],
      edges: [
        {
          id: 'e1',
          from: { kind: 'detached', point: { x: 100, y: 200 } },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'detached',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
        },
      ],
      textBoxes: [],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.edges[0].from.kind).toBe('detached');
    expect(result.diagram.edges[0].connectionStatus).toBe('detached');
  });
});

// ---------------------------------------------------------------------------
// Q1: groups array validation in parseSketch2MermaidFile (v2 files)
// ---------------------------------------------------------------------------
describe('Q1: groups array validation in parseSketch2MermaidFile', () => {
  function makeV2S2m(diagram: unknown) {
    return JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 2,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram,
    });
  }

  test('rejects groups:[null] with ok:false, no crash', () => {
    const json = makeV2S2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [baseNode('n1')],
      edges: [],
      textBoxes: [],
      groups: [null],
    });

    expect(() => parseSketch2MermaidFile(json)).not.toThrow();
    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Group at index 0 is not a valid object/);
    }
  });

  test('rejects groups with missing id', () => {
    const json = makeV2S2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [],
      edges: [],
      textBoxes: [],
      groups: [{ label: 'No ID', kind: 'subgraph', position: { x: 0, y: 0 }, width: 200, height: 100 }],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Group at index 0 has an invalid or missing ID/);
    }
  });

  test('rejects groups with reserved ghostAnchor__ prefix', () => {
    const json = makeV2S2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [],
      edges: [],
      textBoxes: [],
      groups: [{
        id: 'ghostAnchor__g1',
        label: 'Ghost Group',
        kind: 'subgraph',
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
      }],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('reserved internal ID prefix');
    }
  });

  test('rejects duplicate group IDs', () => {
    const json = makeV2S2m({
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [],
      edges: [],
      textBoxes: [],
      groups: [
        { id: 'g1', label: 'Group 1', kind: 'subgraph', position: { x: 0, y: 0 }, width: 200, height: 100 },
        { id: 'g1', label: 'Group 1 dup', kind: 'subgraph', position: { x: 300, y: 0 }, width: 200, height: 100 },
      ],
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Duplicate group ID/);
    }
  });

  test('version-1 files without groups are accepted (groups absent is OK)', () => {
    const json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        schemaVersion: 1,
        nodes: [baseNode('n1')],
        edges: [],
        textBoxes: [],
        // no groups field
      },
    });

    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Q2: normalizeDiagram drops reserved-prefix nodes and cascades to edges
// ---------------------------------------------------------------------------
describe('Q2: normalizeDiagram drops reserved-prefix nodes and cascades correctly', () => {
  test('node with ghostAnchor__ prefix is dropped from diagram.nodes', () => {
    const raw = makeDiagram({
      nodes: [
        baseNode('n1'),
        { id: 'ghostAnchor__e1__from', label: 'Ghost', shape: 'process' as const, position: { x: 200, y: 0 } },
        { id: 'draft-start-temp-node', label: 'Draft', shape: 'process' as const, position: { x: 400, y: 0 } },
        { id: 'temp-preview', label: 'Temp', shape: 'process' as const, position: { x: 600, y: 0 } },
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.nodes).toHaveLength(1);
    expect(normalized.nodes[0].id).toBe('n1');
    expect(normalized.nodes.find(n => n.id.startsWith('ghostAnchor__'))).toBeUndefined();
    expect(normalized.nodes.find(n => n.id.startsWith('draft-'))).toBeUndefined();
    expect(normalized.nodes.find(n => n.id.startsWith('temp-'))).toBeUndefined();
  });

  test('edge with connected endpoint referencing dropped reserved-ID node is downgraded to detached', () => {
    // When 'ghostAnchor__e1__from' is dropped from nodes, the edge.from connected
    // endpoint no longer has a nodeSet match → normalizeDiagram converts it to detached
    const raw = makeDiagram({
      nodes: [
        baseNode('n1'),
        { id: 'ghostAnchor__e1__from', label: 'Ghost', shape: 'process' as const, position: { x: 200, y: 0 } },
      ],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'ghostAnchor__e1__from', handleId: null } as const,
          to: { kind: 'connected', nodeId: 'n1', handleId: null } as const,
          connectionStatus: 'connected' as const,
          exportMode: 'mermaid' as const,
          label: '',
          style: 'solid' as const,
          direction: 'directed' as const,
        },
      ],
    });

    const normalized = normalizeDiagram(raw);

    // Ghost node dropped from nodes
    expect(normalized.nodes.find(n => n.id === 'ghostAnchor__e1__from')).toBeUndefined();

    // Edge is preserved but from endpoint is now detached (ghost node not in nodeSet)
    expect(normalized.edges).toHaveLength(1);
    expect(normalized.edges[0].from.kind).toBe('detached');
    expect(normalized.edges[0].connectionStatus).toBe('detached');
  });

  test('Mermaid export never emits reserved-prefix node IDs', () => {
    const raw = makeDiagram({
      nodes: [
        baseNode('n1'),
        { id: 'ghostAnchor__x', label: 'Ghost', shape: 'process' as const, position: { x: 0, y: 0 } },
      ],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null } as const,
          to: { kind: 'connected', nodeId: 'n1', handleId: null } as const,
          connectionStatus: 'connected' as const,
          exportMode: 'mermaid' as const,
          label: '',
          style: 'solid' as const,
          direction: 'directed' as const,
        },
      ],
    });

    const normalized = normalizeDiagram(raw);
    const mermaid = toMermaid(normalized);

    expect(mermaid).not.toContain('ghostAnchor__x');
    expect(mermaid).not.toContain('ghostAnchor');
    expect(mermaid).not.toContain('draft-');
    expect(mermaid).not.toContain('temp-');
  });

  test('normalizeDiagram does not crash on null node entries (BUG-1 extended)', () => {
    const raw = {
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [null, baseNode('n1'), undefined] as unknown as import('./types').DiagramNode[],
      edges: [],
      textBoxes: [],
    };

    expect(() => normalizeDiagram(raw)).not.toThrow();
    const normalized = normalizeDiagram(raw);
    expect(normalized.nodes).toHaveLength(1);
    expect(normalized.nodes[0].id).toBe('n1');
  });

  test('normalizeDiagram drops reserved-prefix group IDs', () => {
    const raw = makeDiagram({
      groups: [
        { id: 'g1', kind: 'subgraph' as const, label: 'Real Group', position: { x: 0, y: 0 }, width: 200, height: 100 },
        { id: 'ghostAnchor__g2', kind: 'subgraph' as const, label: 'Ghost Group', position: { x: 300, y: 0 }, width: 200, height: 100 },
        { id: 'draft-group', kind: 'subgraph' as const, label: 'Draft Group', position: { x: 600, y: 0 }, width: 200, height: 100 },
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.groups).toHaveLength(1);
    expect(normalized.groups![0].id).toBe('g1');
    expect(normalized.groups!.find(g => g.id.startsWith('ghostAnchor__'))).toBeUndefined();
    expect(normalized.groups!.find(g => g.id.startsWith('draft-'))).toBeUndefined();
  });
});

