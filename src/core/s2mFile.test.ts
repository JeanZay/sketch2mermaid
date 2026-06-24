import { describe, it, expect } from 'vitest';
import {
  serializeSketch2MermaidFile,
  parseSketch2MermaidFile,
  generateS2mFilename,
  S2M_FILE_TYPE,
  S2M_FILE_VERSION,
  APP_VERSION,
  MAX_FILE_SIZE_BYTES,
} from './s2mFile';
import type { CanonicalDiagram, S2mViewport } from './types';
import { useDiagramStore } from '../store/diagramStore';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTestDiagram(): CanonicalDiagram {
  return {
    schemaVersion: 1,
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: [
      {
        id: 'n1',
        label: 'Start',
        shape: 'rounded',
        position: { x: 100, y: 50 },
        width: 140,
        height: 56,
      },
      {
        id: 'n2',
        label: 'Process',
        shape: 'process',
        position: { x: 100, y: 200 },
        width: 140,
        height: 56,
        style: {
          backgroundColor: '#ff0000',
          text: { bold: true, color: '#ffffff' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        from: 'n1',
        to: 'n2',
        label: 'Yes',
        style: 'solid',
        direction: 'directed',
      },
    ],
    textBoxes: [
      {
        id: 'tb1',
        text: 'Annotation',
        position: { x: 300, y: 100 },
        width: 150,
        height: 80,
        style: {
          fontSize: 14,
          bold: false,
          italic: false,
          textAlign: 'left',
          color: '#374151',
          backgroundColor: undefined,
          borderColor: undefined,
        },
      },
    ],
  };
}

const testViewport: S2mViewport = { x: 10, y: 20, zoom: 1.5 };

// ---------------------------------------------------------------------------
// serializeSketch2MermaidFile
// ---------------------------------------------------------------------------

describe('serializeSketch2MermaidFile', () => {
  it('produces valid JSON with correct wrapper fields', () => {
    const diagram = makeTestDiagram();
    const json = serializeSketch2MermaidFile(diagram, testViewport);
    const parsed = JSON.parse(json);

    expect(parsed.fileType).toBe(S2M_FILE_TYPE);
    expect(parsed.fileVersion).toBe(S2M_FILE_VERSION);
    expect(parsed.appVersion).toBe(APP_VERSION);
    expect(parsed.exportedAt).toBeTruthy();
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
    expect(parsed.diagram).toEqual(diagram);
    expect(parsed.viewport).toEqual(testViewport);
  });

  it('omits viewport when not provided', () => {
    const diagram = makeTestDiagram();
    const json = serializeSketch2MermaidFile(diagram);
    const parsed = JSON.parse(json);

    expect(parsed.viewport).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateS2mFilename
// ---------------------------------------------------------------------------

describe('generateS2mFilename', () => {
  it('returns a string matching the expected pattern', () => {
    const filename = generateS2mFilename();
    expect(filename).toMatch(/^diagram-\d{4}-\d{2}-\d{2}-\d{4}\.s2m$/);
  });
});

// ---------------------------------------------------------------------------
// parseSketch2MermaidFile — happy paths
// ---------------------------------------------------------------------------

describe('parseSketch2MermaidFile — valid files', () => {
  it('round-trip: parse(serialize(diagram)) preserves diagram after normalization', () => {
    const diagram = makeTestDiagram();
    const json = serializeSketch2MermaidFile(diagram, testViewport);
    const result = parseSketch2MermaidFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Compare after normalization: nodes, edges, textBoxes, direction, etc.
    expect(result.diagram.direction).toBe(diagram.direction);
    expect(result.diagram.nodes).toEqual(diagram.nodes);
    expect(result.diagram.edges).toEqual(diagram.edges);
    expect(result.diagram.textBoxes).toEqual(diagram.textBoxes);
    expect(result.viewport).toEqual(testViewport);
    expect(result.warnings).toEqual([]);
  });

  it('preserves viewport when valid', () => {
    const diagram = makeTestDiagram();
    const json = serializeSketch2MermaidFile(diagram, { x: -100, y: 500, zoom: 0.5 });
    const result = parseSketch2MermaidFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toEqual({ x: -100, y: 500, zoom: 0.5 });
  });

  it('handles missing textBoxes gracefully (normalizes to empty array)', () => {
    const diagram = makeTestDiagram();
    const json = serializeSketch2MermaidFile(diagram);
    // Remove textBoxes from the JSON
    const parsed = JSON.parse(json);
    delete parsed.diagram.textBoxes;
    const result = parseSketch2MermaidFile(JSON.stringify(parsed));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.textBoxes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseSketch2MermaidFile — invalid files
// ---------------------------------------------------------------------------

describe('parseSketch2MermaidFile — invalid files', () => {
  it('rejects invalid JSON', () => {
    const result = parseSketch2MermaidFile('not json at all {{{');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Invalid JSON file.');
  });

  it('rejects JSON that is not an object', () => {
    const result = parseSketch2MermaidFile('"just a string"');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Invalid JSON file.');
  });

  it('rejects JSON array', () => {
    const result = parseSketch2MermaidFile('[1, 2, 3]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Invalid JSON file.');
  });

  it('rejects missing fileType', () => {
    const result = parseSketch2MermaidFile(JSON.stringify({ fileVersion: 1, diagram: {} }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('This is not a Sketch2Mermaid file.');
  });

  it('rejects wrong fileType', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({ fileType: 'other_app', fileVersion: 1, diagram: {} }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('This is not a Sketch2Mermaid file.');
  });

  it('rejects unsupported fileVersion', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({ fileType: 'sketch2mermaid', fileVersion: 99, diagram: {} }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unsupported Sketch2Mermaid file version');
  });

  it('rejects missing diagram', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({ fileType: 'sketch2mermaid', fileVersion: 1 }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('The diagram data is missing or invalid.');
  });

  it('rejects diagram with wrong schemaVersion', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: { schemaVersion: 99, diagramType: 'flowchart', direction: 'TD', nodes: [], edges: [] },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unsupported diagram schema version');
  });

  it('rejects invalid direction', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: { schemaVersion: 1, diagramType: 'flowchart', direction: 'DIAGONAL', nodes: [], edges: [] },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Invalid diagram direction');
  });

  it('rejects node with unknown shape', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: {
          schemaVersion: 1,
          diagramType: 'flowchart',
          direction: 'TD',
          nodes: [{ id: 'n1', label: 'X', shape: 'unknown-shape-here', position: { x: 0, y: 0 } }],
          edges: [],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('unsupported shape');
  });

  it('rejects edge referencing missing source node', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: {
          schemaVersion: 1,
          diagramType: 'flowchart',
          direction: 'TD',
          nodes: [{ id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } }],
          edges: [{ id: 'e1', from: 'n999', to: 'n1', label: '', style: 'solid' }],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('missing source node');
  });

  it('rejects edge referencing missing target node', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: {
          schemaVersion: 1,
          diagramType: 'flowchart',
          direction: 'TD',
          nodes: [{ id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } }],
          edges: [{ id: 'e1', from: 'n1', to: 'n999', label: '', style: 'solid' }],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('missing target node');
  });

  // ---- Duplicate IDs ----
  it('rejects duplicate node IDs', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: {
          schemaVersion: 1,
          diagramType: 'flowchart',
          direction: 'TD',
          nodes: [
            { id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } },
            { id: 'n1', label: 'B', shape: 'process', position: { x: 100, y: 0 } },
          ],
          edges: [],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Duplicate node ID');
  });

  it('rejects duplicate edge IDs', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: {
          schemaVersion: 1,
          diagramType: 'flowchart',
          direction: 'TD',
          nodes: [
            { id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } },
            { id: 'n2', label: 'B', shape: 'process', position: { x: 100, y: 0 } },
          ],
          edges: [
            { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' },
            { id: 'e1', from: 'n2', to: 'n1', label: '', style: 'solid' },
          ],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Duplicate edge ID');
  });

  it('rejects duplicate text box IDs', () => {
    const result = parseSketch2MermaidFile(
      JSON.stringify({
        fileType: 'sketch2mermaid',
        fileVersion: 1,
        diagram: {
          schemaVersion: 1,
          diagramType: 'flowchart',
          direction: 'TD',
          nodes: [],
          edges: [],
          textBoxes: [
            { id: 'tb1', text: 'A', position: { x: 0, y: 0 }, style: {} },
            { id: 'tb1', text: 'B', position: { x: 100, y: 0 }, style: {} },
          ],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Duplicate text box ID');
  });

  // ---- Non-finite numbers ----
  it('rejects node with non-finite position coordinates (NaN)', () => {
    const json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      diagram: {
        schemaVersion: 1,
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [{ id: 'n1', label: 'A', shape: 'process', position: { x: NaN, y: 0 } }],
        edges: [],
      },
    });
    // NaN serializes to null in JSON, so position.x will be null
    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('non-finite');
  });

  it('rejects node with Infinity position', () => {
    // Infinity serializes to null in JSON
    const rawObj = {
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      diagram: {
        schemaVersion: 1,
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [{ id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: null } }],
        edges: [],
      },
    };
    const result = parseSketch2MermaidFile(JSON.stringify(rawObj));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('non-finite');
  });

  it('rejects node with non-finite width', () => {
    const rawObj = {
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      diagram: {
        schemaVersion: 1,
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [{ id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 }, width: null }],
        edges: [],
      },
    };
    const result = parseSketch2MermaidFile(JSON.stringify(rawObj));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('non-finite width');
  });

  // ---- File size ----
  it('rejects files exceeding 2 MB', () => {
    // Create a string that's over 2 MB
    const hugeString = 'x'.repeat(MAX_FILE_SIZE_BYTES + 100);
    const result = parseSketch2MermaidFile(hugeString);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('too large');
  });
});

// ---------------------------------------------------------------------------
// parseSketch2MermaidFile — viewport warnings (non-blocking)
// ---------------------------------------------------------------------------

describe('parseSketch2MermaidFile — viewport handling', () => {
  function makeValidFileJson(viewport?: unknown): string {
    const file = {
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        schemaVersion: 1,
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [{ id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } }],
        edges: [],
      },
      ...(viewport !== undefined ? { viewport } : {}),
    };
    return JSON.stringify(file);
  }

  it('ignores invalid viewport with a warning', () => {
    const result = parseSketch2MermaidFile(makeValidFileJson({ x: 'bad', y: 0, zoom: 1 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toBeUndefined();
    expect(result.warnings).toContain('The viewport data is invalid and was ignored. The view will be reset.');
  });

  it('ignores viewport with zoom out of bounds', () => {
    const result = parseSketch2MermaidFile(makeValidFileJson({ x: 0, y: 0, zoom: 100 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('ignores viewport with zoom = 0', () => {
    const result = parseSketch2MermaidFile(makeValidFileJson({ x: 0, y: 0, zoom: 0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toBeUndefined();
  });

  it('accepts viewport at boundary zoom (0.1)', () => {
    const result = parseSketch2MermaidFile(makeValidFileJson({ x: 0, y: 0, zoom: 0.1 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 0.1 });
    expect(result.warnings).toEqual([]);
  });

  it('accepts viewport at boundary zoom (10)', () => {
    const result = parseSketch2MermaidFile(makeValidFileJson({ x: 0, y: 0, zoom: 10 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 10 });
  });

  it('returns no viewport and no warning when viewport is absent', () => {
    const result = parseSketch2MermaidFile(makeValidFileJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.viewport).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration: store round-trip
// ---------------------------------------------------------------------------

describe('store integration — export/import round-trip', () => {
  it('restores the store to an equivalent state after export/import', () => {
    const store = useDiagramStore;

    // Build a non-trivial diagram in the store
    store.getState().resetDiagram();
    store.getState().addNode('rounded', 100, 50);
    store.getState().addNode('decision', 300, 200);
    store.getState().updateNodeLabel('n1', 'Start Here');
    store.getState().updateNodeStyle('n1', { backgroundColor: '#3b82f6' });
    store.getState().addEdge('n1', 'n2', 'dotted');
    store.getState().updateEdgeLabel('e1', 'Check');
    store.getState().addTextBox(400, 100);
    store.getState().updateTextBoxText('tb1', 'Note: important');

    const originalDiagram = structuredClone(store.getState().diagram);
    const viewport: S2mViewport = { x: -50, y: 120, zoom: 0.8 };

    // Export
    const json = serializeSketch2MermaidFile(originalDiagram, viewport);

    // Reset the store to a blank state
    store.getState().resetDiagram();
    expect(store.getState().diagram.nodes.length).toBe(0);

    // Import
    const result = parseSketch2MermaidFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    store.getState().loadDiagram(result.diagram, { resetHistory: true });

    // Verify equivalence
    const restoredDiagram = store.getState().diagram;
    expect(restoredDiagram.direction).toBe(originalDiagram.direction);
    expect(restoredDiagram.nodes).toEqual(originalDiagram.nodes);
    expect(restoredDiagram.edges).toEqual(originalDiagram.edges);
    expect(restoredDiagram.textBoxes).toEqual(originalDiagram.textBoxes);
    expect(result.viewport).toEqual(viewport);
  });

  it('consolidated round-trip for 8 new shapes verifies schema preservation', () => {
    const originalDiagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Subroutine Node', shape: 'subroutine', position: { x: 10, y: 20 }, width: 155, height: 57, style: { backgroundColor: '#f0f0f0', borderColor: '#ff0000', text: { bold: true } } },
        { id: 'n2', label: 'Hexagon Node', shape: 'hexagon', position: { x: 100, y: 120 }, width: 165, height: 58 },
        { id: 'n3', label: 'Parallelogram Node', shape: 'parallelogram', position: { x: 200, y: 220 }, width: 175, height: 59 },
        { id: 'n4', label: 'ParallelogramAlt Node', shape: 'parallelogramAlt', position: { x: 300, y: 320 }, width: 185, height: 60 },
        { id: 'n5', label: 'Trapezoid Node', shape: 'trapezoid', position: { x: 400, y: 420 }, width: 195, height: 61 },
        { id: 'n6', label: 'TrapezoidAlt Node', shape: 'trapezoidAlt', position: { x: 500, y: 520 }, width: 205, height: 62 },
        { id: 'n7', label: 'Asymmetric Node', shape: 'asymmetric', position: { x: 600, y: 620 }, width: 215, height: 63 },
        { id: 'n8', label: 'Documents Node', shape: 'documents', position: { x: 700, y: 720 }, width: 225, height: 64 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Link', style: 'solid', direction: 'directed' }
      ],
      textBoxes: []
    };

    const json = serializeSketch2MermaidFile(originalDiagram, testViewport);
    const result = parseSketch2MermaidFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.diagram.nodes.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      const orig = originalDiagram.nodes[i];
      const rest = result.diagram.nodes[i];
      expect(rest.id).toBe(orig.id);
      expect(rest.label).toBe(orig.label);
      expect(rest.shape).toBe(orig.shape);
      expect(rest.position).toEqual(orig.position);
      expect(rest.width).toBe(orig.width);
      expect(rest.height).toBe(orig.height);
      expect(rest.style).toEqual(orig.style);
    }
    expect(result.diagram.edges).toEqual(originalDiagram.edges);
    expect(result.viewport).toEqual(testViewport);
  });

  it('rejects edge with invalid direction', () => {
    const raw = {
      fileType: S2M_FILE_TYPE,
      fileVersion: S2M_FILE_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      diagram: {
        schemaVersion: 1,
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'n1', label: 'Start', shape: 'rounded', position: { x: 0, y: 0 } },
          { id: 'n2', label: 'End', shape: 'process', position: { x: 0, y: 100 } }
        ],
        edges: [
          { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'banana' }
        ],
        textBoxes: []
      }
    };
    const res = parseSketch2MermaidFile(JSON.stringify(raw));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('has an invalid direction "banana"');
    }
  });

  it('accepts legacy s2m files without direction', () => {
    const raw = {
      fileType: S2M_FILE_TYPE,
      fileVersion: S2M_FILE_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      diagram: {
        schemaVersion: 1,
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'n1', label: 'Start', shape: 'rounded', position: { x: 0, y: 0 } },
          { id: 'n2', label: 'End', shape: 'process', position: { x: 0, y: 100 } }
        ],
        edges: [
          { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' }
        ],
        textBoxes: []
      }
    };
    const res = parseSketch2MermaidFile(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.diagram.edges[0].direction).toBe('directed');
    }
  });
});
