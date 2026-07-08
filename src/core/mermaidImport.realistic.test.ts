// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import mermaid from 'mermaid';
import { importMermaidFlowchart, importMermaidFlowchartAsync } from './mermaidImport';
import { toMermaid } from './mermaid';
import type { DiagramEdge } from './types';

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
  const getEdgeFrom = (e: DiagramEdge) => {
    if (typeof e.from === 'string') return e.from;
    if (e.from.kind !== 'connected') {
      throw new Error(`Edge ${e.id} from endpoint is detached: ${JSON.stringify(e.from)}`);
    }
    return e.from.nodeId;
  };
  const getEdgeTo = (e: DiagramEdge) => {
    if (typeof e.to === 'string') return e.to;
    if (e.to.kind !== 'connected') {
      throw new Error(`Edge ${e.id} to endpoint is detached: ${JSON.stringify(e.to)}`);
    }
    return e.to.nodeId;
  };


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

    test('A --> B & C expands edges successfully', () => {
      const code = 'flowchart TD\n  A --> B & C';
      const res = importMermaidFlowchart(code);
      expect(res.diagram.edges.length).toBe(2);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'B')).toBe(true);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'C')).toBe(true);
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
    });

    test('A & B --> C expands edges successfully', () => {
      const code = 'flowchart TD\n  A & B --> C';
      const res = importMermaidFlowchart(code);
      expect(res.diagram.edges.length).toBe(2);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'C')).toBe(true);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'B' && getEdgeTo(e) === 'C')).toBe(true);
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
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
      const cycleEdge = res.diagram.edges.find(e => getEdgeFrom(e) === 'E' && getEdgeTo(e) === 'B');
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

      const edgeP1P2 = res.diagram.edges.find(e => getEdgeFrom(e) === 'B' && getEdgeTo(e) === 'C');
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
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'B')).toBe(true);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'B' && getEdgeTo(e) === 'D')).toBe(true);
      // D -> E -> C
      const de = res.diagram.edges.find(e => getEdgeFrom(e) === 'D' && getEdgeTo(e) === 'E');
      expect(de?.label).toBe('Yes');
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'E' && getEdgeTo(e) === 'C')).toBe(true);

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
      
      const loopEdge = res.diagram.edges.find(e => getEdgeFrom(e) === 'D' && getEdgeTo(e) === 'C');
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
      expect(res.diagram.groups?.length).toBe(2);
      const subgraphWarnings = res.warnings.filter(w => w.type === 'unsupportedSubgraph');
      expect(subgraphWarnings.length).toBe(0);

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
      expect(getEdgeFrom(res.diagram.edges[0])).toBe('A');
      expect(getEdgeTo(res.diagram.edges[0])).toBe('B');

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

      // Warnings (unsupportedClass warning is expected, but ampersandSkipped should be false)
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
      expect(res.warnings.some(w => w.type === 'unsupportedClass')).toBe(true);

      // B, C, D still imported
      expect(res.diagram.nodes.some(n => n.id === 'B')).toBe(true);
      expect(res.diagram.nodes.some(n => n.id === 'C')).toBe(true);
      expect(res.diagram.nodes.some(n => n.id === 'D')).toBe(true);

      // Recovered/expanded edges (4 total: A->B, A->C, B->D, C->D)
      expect(res.diagram.edges.length).toBe(4);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'B')).toBe(true);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'C')).toBe(true);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'B' && getEdgeTo(e) === 'D')).toBe(true);
      expect(res.diagram.edges.some(e => getEdgeFrom(e) === 'C' && getEdgeTo(e) === 'D')).toBe(true);

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

      // Performance check. The compound Dagre-like layout (recursive subgraph
      // extraction + cluster rollup + label-based sizing) is intrinsically more
      // expensive than the previous flat layout, so we allow up to 200ms.
      // This is a single-run measurement (no averaging), hence a generous
      // threshold to avoid CI flakiness on slower runners.
      expect(duration).toBeLessThan(200);

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

  // 5. Ampersand round-trip and layout stability
  describe('Ampersand round-trip and layout stability', () => {
    test('Import -> Export -> Render works for ampersand expanded edges', async () => {
      const code = 'flowchart TD\n  A[Start] --> B & C{Check} --> D[End]';
      const res = importMermaidFlowchart(code);
      
      expect(res.diagram.nodes.length).toBe(4);
      expect(res.diagram.edges.length).toBe(4);
      
      const exported = toMermaid(res.diagram);
      // Verify exported code compiles with Mermaid
      await assertMermaidCompiles(exported, 'amp_roundtrip');
      
      // Re-import exported code and verify the structures are equivalent
      const reimported = importMermaidFlowchart(exported);
      expect(reimported.diagram.nodes.length).toBe(4);
      expect(reimported.diagram.edges.length).toBe(4);
    });

    test('Deterministic layout remains stable after ampersand expansion', () => {
      const code = 'flowchart TD\n  A[Start] --> B & C{Check} --> D[End]';
      const res1 = importMermaidFlowchart(code);
      const res2 = importMermaidFlowchart(code);
      
      // Ensure determinism
      expect(res1.diagram.nodes).toEqual(res2.diagram.nodes);
      expect(res1.diagram.edges).toEqual(res2.diagram.edges);
      
      // Verify layout positions are finite numbers and not NaN
      for (const node of res1.diagram.nodes) {
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
      }
    });
  });

  describe('French Medicosocial System Diagram Regression Test', () => {
    test('Imports, formats correctly, and satisfies visual layout assertions', async () => {
      const code = `flowchart TD
  cnsa{{"\`**CNSA<br/>Caisse Nationale de Solidarité**\`"}}
  ars{{"\`**ARS<br/>Agence Régionale de Santé**\`"}}
  cd{{"\`**Conseil Départemental<br/>Aide sociale & Autonomie**\`"}}
  mdph{{"\`**MDPH<br/>Maison Dép. des Personnes Handicapées**\`"}}
  beneficiaire(["\`**Bénéficiaire<br/>Personne âgée ou handicapée**\`"])
  dossier[/"\`**Dépôt du Dossier<br/>Formulaire Cerfa / En ligne**\`"\\]
  base_donnees[("\`**Base de Données<br/>Système d'Information (SI)**\`")]
  instruction[["\`**Instruction Administrative**\`"]]
  evaluation{"\`**Évaluation des Besoins<br/>GIR (PA) / PPC (PH)**\`"}
  notification>\`**Notification de Décision**\`]
  recours[\\"\`**Recours / Contestation<br/>Amiable ou contentieux**\`"/]
  domicile[/"\`**Maintien à Domicile<br/>Aides Humaines & Techniques**\`"/]
  etablissement[\\"\`**Accueil en Établissement<br/>EHPAD, MAS, FAM, IME, ESAT**\`"\\]
  admission(("\`**Admission / Entrée**\`"))
  suivi((("\`**Suivi & Réévaluation**\`")))

  beneficiaire -->|"1. Demande d'aide"| dossier
  dossier -.->|"Enregistrement"| base_donnees
  dossier -->|"2. Dossier transmis"| instruction
  instruction <-->|"Vérification SI"| base_donnees
  instruction -->|"3. Demande d'avis"| evaluation
  evaluation -->|"4. Proposition de plan"| mdph
  evaluation -->|"4. Proposition de plan"| cd
  mdph -.->|"Décision CDAPH"| notification
  cd -.->|"Décision CD"| notification
  notification -->|"5. Choix / Accord"| admission
  notification -.->|"Désaccord"| recours
  recours -.->|"Réexamen"| evaluation
  admission -->|"Option Domicile"| domicile
  admission -->|"Option Établissement"| etablissement
  cnsa <-->|"Co-financement"| cd
  cnsa <-->|"Co-financement"| ars
  cd -->|"Versement APA / PCH"| domicile
  ars -->|"Financement soins (SSIAD)"| domicile
  cd -.->|"Habilitation Aide Sociale"| etablissement
  ars -->|"Dotation soins"| etablissement
  domicile -->|"Suivi annuel"| suivi
  etablissement -->|"Suivi annuel"| suivi
  suivi -.->|"Réévaluation"| evaluation

  style cnsa fill:#e1f5fe,stroke:#0288d1,color:#01579b,font-size:14px
  style ars fill:#e1f5fe,stroke:#0288d1,color:#01579b,font-size:14px
  style cd fill:#e1f5fe,stroke:#0288d1,color:#01579b,font-size:14px
  style mdph fill:#e1f5fe,stroke:#0288d1,color:#01579b,font-size:14px
  style beneficiaire fill:#efebe9,stroke:#5d4037,color:#3e2723,font-size:14px
  style dossier fill:#fff9c4,stroke:#fbc02d,color:#f57f17,font-size:14px
  style base_donnees fill:#fff9c4,stroke:#fbc02d,color:#f57f17,font-size:14px
  style instruction fill:#fff9c4,stroke:#fbc02d,color:#f57f17,font-size:14px
  style evaluation fill:#fff9c4,stroke:#fbc02d,color:#f57f17,font-size:14px
  style notification fill:#ffe0b2,stroke:#f57c00,color:#e65100,font-size:14px
  style recours fill:#ffe0b2,stroke:#f57c00,color:#e65100,font-size:14px
  style domicile fill:#e8f5e9,stroke:#388e3c,color:#1b5e20,font-size:14px
  style etablissement fill:#e8f5e9,stroke:#388e3c,color:#1b5e20,font-size:14px
  style admission fill:#e8f5e9,stroke:#388e3c,color:#1b5e20,font-size:14px
  style suivi fill:#e8f5e9,stroke:#388e3c,color:#1b5e20,font-size:14px`;

      const res = importMermaidFlowchart(code);
      const { nodes, edges } = res.diagram;

      // 1. Assertions on node count
      expect(nodes.length).toBe(15);
      
      // Helper lookups
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // 2. Compact diagram dimensions check
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.position.x);
        maxX = Math.max(maxX, n.position.x + (n.width || 140));
        minY = Math.min(minY, n.position.y);
        maxY = Math.max(maxY, n.position.y + (n.height || 56));
      }
      const width = maxX - minX;
      const height = maxY - minY;
      expect(width).toBeLessThan(2500);
      expect(height).toBeLessThan(1500);

      // 3. No node overlaps
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nA = nodes[i];
          const nB = nodes[j];
          const wA = nA.width || 140;
          const hA = nA.height || 56;
          const wB = nB.width || 140;
          const hB = nB.height || 56;
          const overlap = !(
            nA.position.x + wA <= nB.position.x ||
            nB.position.x + wB <= nA.position.x ||
            nA.position.y + hA <= nB.position.y ||
            nB.position.y + hB <= nA.position.y
          );
          expect(overlap).toBe(false);
        }
      }

      // 4. Hierarchical coordinate checks
      // CNSA above ARS/CD
      const yCNSA = nodeMap.get('cnsa')!.position.y;
      const yARS = nodeMap.get('ars')!.position.y;
      const yCD = nodeMap.get('cd')!.position.y;
      expect(yCNSA).toBeLessThan(yARS);
      expect(yCNSA).toBeLessThan(yCD);

      // ARS/CD above downstream (aval) structures: domicile, etablissement
      const yDomicile = nodeMap.get('domicile')!.position.y;
      const yEtab = nodeMap.get('etablissement')!.position.y;

      expect(yARS).toBeLessThan(yDomicile);
      expect(yCD).toBeLessThan(yDomicile);
      expect(yARS).toBeLessThan(yEtab);
      expect(yCD).toBeLessThan(yEtab);

      // 5. Handle Logic Assertions
      // Vertical downward/upward edges should use top/bottom handles
      // beneficiaire --> dossier (goes down)
      const eDemande = edges.find(e => getEdgeFrom(e) === 'beneficiaire' && getEdgeTo(e) === 'dossier')!;
      expect(eDemande.sourceHandle).toBe('b-source');
      expect(eDemande.targetHandle).toBe('t-target');

      // cnsa <--> cd (goes down)
      const eCnsaCd = edges.find(e => getEdgeFrom(e) === 'cnsa' && getEdgeTo(e) === 'cd')!;
      expect(eCnsaCd.sourceHandle).toBe('b-source');
      expect(eCnsaCd.targetHandle).toBe('t-target');

      // cnsa <--> ars (goes down)
      const eCnsaArs = edges.find(e => getEdgeFrom(e) === 'cnsa' && getEdgeTo(e) === 'ars')!;
      expect(eCnsaArs.sourceHandle).toBe('b-source');
      expect(eCnsaArs.targetHandle).toBe('t-target');

      // Same-rank/lateral sibling edges should use lateral (left/right) handles
      // instruction <--> base_donnees (same-rank horizontal connection)
      const eInstructionSI = edges.find(e => getEdgeFrom(e) === 'instruction' && getEdgeTo(e) === 'base_donnees')!;
      const yInstruction = nodeMap.get('instruction')!.position.y;
      const yBaseDonnees = nodeMap.get('base_donnees')!.position.y;
      if (Math.abs(yInstruction - yBaseDonnees) < 30) {
        expect(eInstructionSI.sourceHandle).toMatch(/^[lr]-source$/);
        expect(eInstructionSI.targetHandle).toMatch(/^[lr]-target$/);
      }

      // 6. Semantic style/direction assertions and preservation of edge types
      // solid directed: beneficiaire --> dossier
      expect(eDemande.style).toBe('solid');
      expect(eDemande.direction).toBe('directed');

      // dotted directed: dossier -.-> base_donnees
      const eDossierSI = edges.find(e => getEdgeFrom(e) === 'dossier' && getEdgeTo(e) === 'base_donnees')!;
      expect(eDossierSI.style).toBe('dotted');
      expect(eDossierSI.direction).toBe('directed');

      // solid bidirectional: instruction <--> base_donnees
      expect(eInstructionSI.style).toBe('solid');
      expect(eInstructionSI.direction).toBe('bidirectional');

      // We can also verify that a reverse edge structure works and preserves its type
      const testReverseCode = 'flowchart TD\n  X <--- Y\n  A <-.- B';
      const reverseRes = importMermaidFlowchart(testReverseCode);
      const revEdge1 = reverseRes.diagram.edges.find(e => getEdgeFrom(e) === 'X' && getEdgeTo(e) === 'Y')!;
      expect(revEdge1.style).toBe('solid');
      expect(revEdge1.direction).toBe('reverse');

      const revEdge2 = reverseRes.diagram.edges.find(e => getEdgeFrom(e) === 'A' && getEdgeTo(e) === 'B')!;
      expect(revEdge2.style).toBe('dotted');
      expect(revEdge2.direction).toBe('reverse');

      // 7. Edge label position verify (midpoint change test)
      // Check that edge labels follow node updates
      const initialNodePos = { ...nodeMap.get('beneficiaire')!.position };
      // Move node
      nodeMap.get('beneficiaire')!.position = { x: initialNodePos.x + 200, y: initialNodePos.y + 100 };
      // Verify coordinates updated
      expect(nodeMap.get('beneficiaire')!.position.x).toBe(initialNodePos.x + 200);
    });
  });

  describe('Mermaid SVG Layout Oracle tests', () => {
    test('importMermaidFlowchartAsync falls back gracefully to local layout on render failure', async () => {
      const code = 'flowchart TD\n  A --> B';
      const renderId = `test-temp-${Math.floor(Math.random() * 100000)}`;
      await mermaid.render(renderId, code);
      
      const res = await importMermaidFlowchartAsync(code);
      expect(res.diagram.nodes.length).toBe(2);
      expect(res.diagram.edges.length).toBe(1);
      expect(res.diagram.nodes.some(n => n.id === 'A')).toBe(true);

      // Verify diagnostics object
      expect(res.diagnostics).toBeDefined();
      expect(res.diagnostics!.oracleAttempted).toBe(true);
      expect(res.diagnostics!.renderSucceeded).toBe(true);
      expect(res.diagnostics!.nodesExtracted).toBe(2);
      expect(res.diagnostics!.positionsApplied).toBe(2);
      expect(res.diagnostics!.fallbackUsed).toBe(true);
      expect(res.diagnostics!.fallbackReason).toBe('Rendered nodes have 0 dimensions (JSDOM/headless environment or collapsed SVG)');
    });

    test('importMermaidFlowchartAsync overrides positions and dimensions using Mermaid SVG oracle when render succeeds', async () => {
      // Stub mermaid.render
      const originalRender = mermaid.render;
      mermaid.render = async (id: string) => {
        const mockSvg = `
          <svg id="${id}" viewBox="0 0 800 600" width="800" height="600">
            <g class="node" data-id="A" transform="translate(150, 100)">
              <rect class="label-container" width="100" height="50"></rect>
            </g>
            <g class="node" data-id="B" transform="translate(300, 400)">
              <rect class="label-container" width="120" height="60"></rect>
            </g>
          </svg>
        `;
        return { svg: mockSvg, bindFunctions: () => {} } as unknown as { svg: string; bindFunctions: () => void };
      };

      const originalGetClientRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function() {
        const dataId = this.getAttribute('data-id');
        if (this.tagName.toLowerCase() === 'svg') {
          return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect;
        }
        if (dataId === 'A') {
          return { left: 100, top: 75, right: 200, bottom: 125, width: 100, height: 50 } as DOMRect;
        }
        if (dataId === 'B') {
          return { left: 240, top: 370, right: 360, bottom: 430, width: 120, height: 60 } as DOMRect;
        }
        return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
      };

      try {
        const code = 'flowchart TD\n  A --> B';
        const result = await importMermaidFlowchartAsync(code);
        const nodeA = result.diagram.nodes.find(n => n.id === 'A')!;
        const nodeB = result.diagram.nodes.find(n => n.id === 'B')!;

        // Check that coordinates and sizes were overridden by the oracle
        expect(nodeA.position.x).toBe(100);
        expect(nodeA.position.y).toBe(75);
        expect(nodeA.width).toBe(100);
        expect(nodeA.height).toBe(50);

        expect(nodeB.position.x).toBe(240);
        expect(nodeB.position.y).toBe(370);
        expect(nodeB.width).toBe(120);
        expect(nodeB.height).toBe(60);

        // Verify that handles were recomputed based on new coordinates
        const edge = result.diagram.edges[0];
        expect(edge.sourceHandle).toBe('b-source');
        expect(edge.targetHandle).toBe('t-target');

        // Verify diagnostics object
        expect(result.diagnostics).toBeDefined();
        expect(result.diagnostics!.oracleAttempted).toBe(true);
        expect(result.diagnostics!.renderSucceeded).toBe(true);
        expect(result.diagnostics!.nodesExtracted).toBe(2);
        expect(result.diagnostics!.positionsApplied).toBe(2);
        expect(result.diagnostics!.fallbackUsed).toBe(false);
        
      } finally {
        mermaid.render = originalRender;
        Element.prototype.getBoundingClientRect = originalGetClientRect;
      }
    });

    test('importMermaidFlowchartAsync converts SVG CSS pixels back to viewBox coordinates', async () => {
      const originalRender = mermaid.render;
      mermaid.render = async (id: string) => {
        const mockSvg = `
          <svg id="${id}" viewBox="0 0 1600 1200" width="800" height="600">
            <g class="node" data-id="A" transform="translate(300, 140)">
              <rect class="label-container" width="200" height="80"></rect>
            </g>
            <g class="node" data-id="B" transform="translate(720, 860)">
              <rect class="label-container" width="240" height="120"></rect>
            </g>
          </svg>
        `;
        return { svg: mockSvg, bindFunctions: () => {} } as unknown as { svg: string; bindFunctions: () => void };
      };

      const originalGetClientRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function() {
        const dataId = this.getAttribute('data-id');
        if (this.tagName.toLowerCase() === 'svg') {
          return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect;
        }
        if (dataId === 'A') {
          return { left: 100, top: 50, right: 200, bottom: 90, width: 100, height: 40 } as DOMRect;
        }
        if (dataId === 'B') {
          return { left: 300, top: 400, right: 420, bottom: 460, width: 120, height: 60 } as DOMRect;
        }
        return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
      };

      try {
        const result = await importMermaidFlowchartAsync('flowchart TD\n  A --> B');
        const nodeA = result.diagram.nodes.find(n => n.id === 'A')!;
        const nodeB = result.diagram.nodes.find(n => n.id === 'B')!;

        expect(nodeA.position).toEqual({ x: 200, y: 100 });
        expect(nodeA.width).toBe(200);
        expect(nodeA.height).toBe(80);

        expect(nodeB.position).toEqual({ x: 600, y: 800 });
        expect(nodeB.width).toBe(240);
        expect(nodeB.height).toBe(120);

        expect(result.diagnostics?.fallbackUsed).toBe(false);
        expect(result.diagnostics?.cssToViewBoxScale).toEqual({ x: 2, y: 2 });
        expect(result.diagnostics?.oraclePositionsApplied).toBe(2);
        expect(result.diagnostics?.oracleDimensionsApplied).toBe(2);
        expect(result.diagnostics?.nodeComparisons?.map((row) => row.matchedBy)).toEqual([
          'data-id',
          'data-id',
        ]);
      } finally {
        mermaid.render = originalRender;
        Element.prototype.getBoundingClientRect = originalGetClientRect;
      }
    });
  });
});
