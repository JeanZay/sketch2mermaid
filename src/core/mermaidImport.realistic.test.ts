// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import mermaid from 'mermaid';
import { importMermaidFlowchart } from './mermaidImport';
import { toMermaid } from './mermaid';

// Mock SVG getBBox for JSDOM
if (typeof window !== 'undefined' && !window.SVGElement.prototype.getBBox) {
  window.SVGElement.prototype.getBBox = function () {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      top: 0,
      left: 0,
      right: 100,
      bottom: 30,
      toJSON: () => {},
    };
  };
}

// Initialize mermaid with strict security level to simulate production environment
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
});

// Helper to verify that a mermaid string compiles/renders without throwing errors
async function assertMermaidCompiles(code: string, id: string) {
  try {
    const { svg } = await mermaid.render(`mermaid-render-${id}-${Math.floor(Math.random() * 100000)}`, code);
    expect(svg).toBeDefined();
    expect(svg.length).toBeGreaterThan(0);
  } catch (err) {
    console.error(`Mermaid compilation failed for test ${id}:`, err);
    throw err;
  }
}

describe('Mermaid Import Realistic & Hardening Tests', () => {

  // 1. Ampersand detection rules
  describe('Ampersand Detection hardening', () => {
    test('A[Notify manager & support lead] parses without ampersandSkipped', () => {
      const code = 'flowchart LR\n  A[Notify manager & support lead] --> B[Done]';
      const res = importMermaidFlowchart(code);
      const nodeA = res.diagram.nodes.find(n => n.id === 'A');
      expect(nodeA?.label).toBe('Notify manager & support lead');
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
    });

    test('A -->|Sales & Marketing| B parses without ampersandSkipped', () => {
      const code = 'flowchart LR\n  A -->|Sales & Marketing| B';
      const res = importMermaidFlowchart(code);
      const edge = res.diagram.edges[0];
      expect(edge.label).toBe('Sales & Marketing');
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
    });

    test('A["R&D / M&A review"] --> B parses without ampersandSkipped', () => {
      const code = 'flowchart LR\n  A["R&D / M&A review"] --> B';
      const res = importMermaidFlowchart(code);
      const nodeA = res.diagram.nodes.find(n => n.id === 'A');
      expect(nodeA?.label).toBe('R&D / M&A review');
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
    });

    test('A --> B & C emits ampersandSkipped warning and skips edge', () => {
      const code = 'flowchart TD\n  A --> B & C';
      const res = importMermaidFlowchart(code);
      expect(res.diagram.edges.length).toBe(0);
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(true);
    });

    test('A & B --> C emits ampersandSkipped warning and skips edge', () => {
      const code = 'flowchart TD\n  A & B --> C';
      const res = importMermaidFlowchart(code);
      expect(res.diagram.edges.length).toBe(0);
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(true);
    });
  });

  // 2. The 8 Realistic Diagrams
  describe('8 Realistic Diagrams Corpus', () => {

    test('Diagram 1 - Simple business process', async () => {
      const code = `flowchart TD
  A([Start]) --> B[Receive request]
  B --> C{Complete information?}
  C -->|Yes| D[Process request]
  C -->|No| E[Ask for missing info]
  E --> B
  D --> F(((End)))`;

      const res = importMermaidFlowchart(code);
      
      // Node assertions
      expect(res.diagram.nodes.length).toBe(6);
      expect(res.diagram.nodes.find(n => n.id === 'A')?.shape).toBe('stadium');
      expect(res.diagram.nodes.find(n => n.id === 'B')?.shape).toBe('process');
      expect(res.diagram.nodes.find(n => n.id === 'C')?.shape).toBe('decision');
      expect(res.diagram.nodes.find(n => n.id === 'F')?.shape).toBe('endEvent');

      // Edges & cycles
      expect(res.diagram.edges.length).toBe(6);
      const cycleEdge = res.diagram.edges.find(e => e.from === 'E' && e.to === 'B');
      expect(cycleEdge).toBeDefined();

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag1');
    });

    test('Diagram 2 - IT support workflow with labels containing punctuation', async () => {
      const code = `flowchart LR
  A[User opens ticket: "Cannot connect"] --> B{Priority?}
  B -->|P1/P2| C[Escalate to L2/L3]
  B -->|P3-P4| D[Standard queue]
  C --> E[Notify manager & support lead]
  D --> F[Resolve or request more info]
  F --> G([Closed])`;

      const res = importMermaidFlowchart(code);

      // Check labels (punctuation, ampersand, slashes preserved)
      const nodeA = res.diagram.nodes.find(n => n.id === 'A');
      expect(nodeA?.label).toBe('User opens ticket: "Cannot connect"');
      
      const nodeE = res.diagram.nodes.find(n => n.id === 'E');
      expect(nodeE?.label).toBe('Notify manager & support lead');

      const edgeP1P2 = res.diagram.edges.find(e => e.from === 'B' && e.to === 'C');
      expect(edgeP1P2?.label).toBe('P1/P2');

      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag2');
    });

    test('Diagram 3 - RPA process with documents and database', async () => {
      const code = `flowchart TD
  A@{ shape: doc, label: "Input Excel file" }
  B[/Read rows/]
  C[(Business database)]
  D{Record exists?}
  E[[Update CRM]]
  F@{ shape: docs, label: "Generated reports" }
  A --> B --> D
  D -->|Yes| E --> C
  D -->|No| F`;

      const res = importMermaidFlowchart(code);

      // Node shape validation
      expect(res.diagram.nodes.find(n => n.id === 'A')?.shape).toBe('file');
      expect(res.diagram.nodes.find(n => n.id === 'B')?.shape).toBe('parallelogram');
      expect(res.diagram.nodes.find(n => n.id === 'C')?.shape).toBe('database');
      expect(res.diagram.nodes.find(n => n.id === 'D')?.shape).toBe('decision');
      expect(res.diagram.nodes.find(n => n.id === 'E')?.shape).toBe('subroutine');
      expect(res.diagram.nodes.find(n => n.id === 'F')?.shape).toBe('documents');

      // Chained edges decomposition
      // A -> B -> D
      expect(res.diagram.edges.some(e => e.from === 'A' && e.to === 'B')).toBe(true);
      expect(res.diagram.edges.some(e => e.from === 'B' && e.to === 'D')).toBe(true);
      // D -> E -> C
      const de = res.diagram.edges.find(e => e.from === 'D' && e.to === 'E');
      expect(de?.label).toBe('Yes');
      expect(res.diagram.edges.some(e => e.from === 'E' && e.to === 'C')).toBe(true);

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag3');
    });

    test('Diagram 4 - BI data pipeline', async () => {
      const code = `flowchart LR
  A[(Snowflake)]
  B[/Extract data/]
  C[[Transform in Power Query]]
  D{{Validation}}
  E[(Power BI Dataset)]
  F[Dashboard]
  A --> B --> C --> D
  D -->|OK| E --> F
  D -->|KO: data quality issue| C`;

      const res = importMermaidFlowchart(code);

      expect(res.diagram.direction).toBe('LR');
      expect(res.diagram.nodes.find(n => n.id === 'D')?.shape).toBe('hexagon');
      
      const loopEdge = res.diagram.edges.find(e => e.from === 'D' && e.to === 'C');
      expect(loopEdge?.label).toBe('KO: data quality issue');

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag4');
    });

    test('Diagram 5 - Subgraph produced by AI', async () => {
      const code = `flowchart TD
  subgraph FrontOffice["Front Office"]
    A[Capture need] --> B{Validated?}
  end

  subgraph BackOffice["Back Office"]
    C[[Prepare contract]] --> D@{ shape: doc, label: "Contract document" }
  end

  B -->|Yes| C
  B -->|No| A
  D --> E(((Done)))`;

      const res = importMermaidFlowchart(code);

      // Flattened contents
      expect(res.diagram.nodes.length).toBe(5);
      expect(res.diagram.nodes.some(n => n.id === 'FrontOffice')).toBe(false);
      expect(res.diagram.nodes.some(n => n.id === 'BackOffice')).toBe(false);
      expect(res.diagram.nodes.some(n => n.id === 'end')).toBe(false);

      // Warnings check
      const subgraphWarnings = res.warnings.filter(w => w.type === 'unsupportedSubgraph');
      expect(subgraphWarnings.length).toBe(2);

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag5');
    });

    test('Diagram 6 - Mermaid with frontmatter and init directive', async () => {
      const code = `---
config:
  theme: base
---
%%{init: {"flowchart": {"curve": "basis"}}}%%
flowchart TD
  A[Start] --> B[Step with | pipe | in text]
  B --> C["Step with --> in quoted label"]
  C --> D[End]`;

      const res = importMermaidFlowchart(code);

      // Check node count (no frontmatter nodes parsed)
      expect(res.diagram.nodes.length).toBe(4);
      
      // Init directive warning
      expect(res.warnings.some(w => w.type === 'unsupportedDirective')).toBe(true);

      // Pipe and arrow preserved
      const nodeB = res.diagram.nodes.find(n => n.id === 'B');
      expect(nodeB?.label).toBe('Step with | pipe | in text');

      const nodeC = res.diagram.nodes.find(n => n.id === 'C');
      expect(nodeC?.label).toBe('Step with --> in quoted label');

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag6');
    });

    test('Diagram 7 - Duplicate node definitions', async () => {
      const code = `flowchart TD
  A[Initial label]
  A[Final label]
  A --> B[Next]`;

      const res = importMermaidFlowchart(code);

      // Last wins
      const nodeA = res.diagram.nodes.find(n => n.id === 'A');
      expect(nodeA?.label).toBe('Final label');

      // Warning deduplication check: only 1 duplicateId warning
      const duplicateWarnings = res.warnings.filter(w => w.type === 'duplicateId');
      expect(duplicateWarnings.length).toBe(1);

      // Edge validation
      expect(res.diagram.edges.length).toBe(1);
      expect(res.diagram.edges[0].from).toBe('A');
      expect(res.diagram.edges[0].to).toBe('B');

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag7');
    });

    test('Diagram 8 - Unsupported constructs but recoverable structure', async () => {
      const code = `flowchart TD
  A[Start] --> B & C
  classDef important fill:#f96,stroke:#333
  class B important
  B --> D[Recovered branch]
  C --> D`;

      const res = importMermaidFlowchart(code);

      // Warnings
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(true);
      expect(res.warnings.some(w => w.type === 'unsupportedClass')).toBe(true);

      // B, C, D still imported
      expect(res.diagram.nodes.some(n => n.id === 'B')).toBe(true);
      expect(res.diagram.nodes.some(n => n.id === 'C')).toBe(true);
      expect(res.diagram.nodes.some(n => n.id === 'D')).toBe(true);

      // Recovered edges
      expect(res.diagram.edges.some(e => e.from === 'B' && e.to === 'D')).toBe(true);
      expect(res.diagram.edges.some(e => e.from === 'C' && e.to === 'D')).toBe(true);

      // Export & render validation
      const exported = toMermaid(res.diagram);
      await assertMermaidCompiles(exported, 'diag8');
    });
  });

  // 3. Medium-Sized Stress Test
  describe('Medium-Sized Stress Test', () => {
    test('Stress test diagram parses quickly and deterministically', () => {
      // Programmatically build a medium-sized diagram:
      // 40 nodes: n1 to n40
      // 50 edges: n1->n2, n2->n3, etc., plus some cycles and cross-links
      // Mixed shapes
      const shapes = ['process', 'rounded', 'stadium', 'decision', 'event', 'database', 'subroutine', 'hexagon', 'parallelogram', 'file'];
      
      const lines = ['flowchart TD'];
      
      // Define 40 nodes
      for (let i = 1; i <= 40; i++) {
        const shapeType = shapes[i % shapes.length];
        let open = '[';
        let close = ']';
        if (shapeType === 'rounded') { open = '('; close = ')'; }
        else if (shapeType === 'stadium') { open = '(['; close = '])'; }
        else if (shapeType === 'decision') { open = '{'; close = '}'; }
        else if (shapeType === 'event') { open = '(('; close = '))'; }
        else if (shapeType === 'database') { open = '[('; close = ')]'; }
        else if (shapeType === 'subroutine') { open = '[['; close = ']]'; }
        else if (shapeType === 'hexagon') { open = '{{'; close = '}}'; }
        else if (shapeType === 'parallelogram') { open = '[/'; close = '/]'; }
        else if (shapeType === 'file') { open = '[@'; close = ']'; }
        
        if (shapeType === 'file') {
          lines.push(`  n${i}@{ shape: doc, label: "Stress Node ${i}" }`);
        } else {
          lines.push(`  n${i}${open}"Stress Node ${i}"${close}`);
        }
      }

      // Add 50 edges (40 nodes sequential = 39 edges, plus 11 cycles/cross-links)
      for (let i = 1; i < 40; i++) {
        lines.push(`  n${i} --> n${i+1}`);
      }
      
      // 11 cross links and cycles
      lines.push('  n40 --> n1'); // big cycle back
      lines.push('  n10 --> n5');  // cycle back
      lines.push('  n20 --> n15'); // cycle back
      lines.push('  n30 --> n25'); // cycle back
      lines.push('  n5 --> n15');
      lines.push('  n15 --> n25');
      lines.push('  n25 --> n35');
      lines.push('  n2 --> n12');
      lines.push('  n12 --> n22');
      lines.push('  n22 --> n32');
      lines.push('  n32 --> n40');

      const code = lines.join('\n');

      const start = Date.now();
      const res1 = importMermaidFlowchart(code);
      const duration = Date.now() - start;

      // Performance check (must be very fast, e.g., < 100ms)
      expect(duration).toBeLessThan(100);

      // Verify node and edge counts
      expect(res1.diagram.nodes.length).toBe(40);
      expect(res1.diagram.edges.length).toBe(50);

      // Determinism check
      const res2 = importMermaidFlowchart(code);
      expect(res1.diagram.nodes).toEqual(res2.diagram.nodes);
      expect(res1.diagram.edges).toEqual(res2.diagram.edges);
      
      // Ensure positions are valid numbers
      for (const node of res1.diagram.nodes) {
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
      }
    });
  });

  // 4. Pureness / Transaction safety
  describe('Transaction safety & purity', () => {
    test('importMermaidFlowchart is pure and does not mutate inputs', () => {
      const code = 'flowchart TD\n  A --> B';
      const originalCode = code;
      
      const res = importMermaidFlowchart(code);
      expect(code).toBe(originalCode);
      
      // Mutating the returned diagram doesn't affect subsequent calls
      res.diagram.nodes[0].label = 'Mutated';
      const res2 = importMermaidFlowchart(code);
      expect(res2.diagram.nodes[0].label).toBe('A');
    });
  });

});
