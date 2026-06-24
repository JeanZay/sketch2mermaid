import { describe, test, expect } from 'vitest';
import { importMermaidFlowchart } from './mermaidImport';
import { toMermaid } from './mermaid';
import { normalizeDiagram } from '../store/diagramStore';
import type { DiagramEdge, ConnectedEdgeEndpoint } from './types';

const hasEdge = (edges: DiagramEdge[], from: string, to: string) =>
  edges.some(
    (e) =>
      (typeof e.from === 'string' ? e.from : e.from.nodeId) === from &&
      (typeof e.to === 'string' ? e.to : e.to.nodeId) === to
  );

describe('Mermaid Flowchart Import Tests', () => {
  // 1. graph TD parses with direction TD
  test('1. graph TD parses with direction TD', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B');
    expect(res.diagram.direction).toBe('TD');
  });

  // 2. flowchart LR parses with direction LR
  test('2. flowchart LR parses with direction LR', () => {
    const res = importMermaidFlowchart('flowchart LR\n  A --> B');
    expect(res.diagram.direction).toBe('LR');
  });

  // 3. graph TB normalizes to TD
  test('3. graph TB normalizes to TD', () => {
    const res = importMermaidFlowchart('graph TB\n  A --> B');
    expect(res.diagram.direction).toBe('TD');
  });

  // 4. sequenceDiagram throws exact unsupported message
  test('4. sequenceDiagram throws exact unsupported message', () => {
    expect(() => importMermaidFlowchart('sequenceDiagram\n  Alice->>Bob: Hello')).toThrow(
      'Only Mermaid flowcharts are supported for import in this version.'
    );
  });

  // 5. empty input throws exact empty message
  test('5. empty input throws exact empty message', () => {
    expect(() => importMermaidFlowchart('')).toThrow('Le diagramme est vide.');
    expect(() => importMermaidFlowchart('   \n  \t ')).toThrow('Le diagramme est vide.');
  });

  // 6. input over 100 KB throws exact size message
  test('6. input over 100 KB throws exact size message', () => {
    const largeInput = 'graph TD\n' + '  A --> B\n'.repeat(15000); // Exceeds 100 KB
    expect(() => importMermaidFlowchart(largeInput)).toThrow(
      'Le diagramme dépasse la taille maximale (100 KB).'
    );
  });

  // 7. all classic shapes import correctly
  test('7. all classic shapes import correctly', () => {
    const code = `graph TD
      n1[Process]
      n2(Rounded)
      n3([Stadium])
      n4{Decision}
      n5((Event))
      n6(((EndEvent)))
      n7[(Database)]
      n8[[Subroutine]]
      n9{{Hexagon}}
      n10[/Parallelogram/]
      n11[\\ParallelogramAlt\\]
      n12[/Trapezoid\\]
      n13[\\TrapezoidAlt/]
      n14>Asymmetric]
    `;
    const { diagram } = importMermaidFlowchart(code);
    const nodes = diagram.nodes;
    
    expect(nodes.find(n => n.id === 'n1')?.shape).toBe('process');
    expect(nodes.find(n => n.id === 'n2')?.shape).toBe('rounded');
    expect(nodes.find(n => n.id === 'n3')?.shape).toBe('stadium');
    expect(nodes.find(n => n.id === 'n4')?.shape).toBe('decision');
    expect(nodes.find(n => n.id === 'n5')?.shape).toBe('event');
    expect(nodes.find(n => n.id === 'n6')?.shape).toBe('endEvent');
    expect(nodes.find(n => n.id === 'n7')?.shape).toBe('database');
    expect(nodes.find(n => n.id === 'n8')?.shape).toBe('subroutine');
    expect(nodes.find(n => n.id === 'n9')?.shape).toBe('hexagon');
    expect(nodes.find(n => n.id === 'n10')?.shape).toBe('parallelogram');
    expect(nodes.find(n => n.id === 'n11')?.shape).toBe('parallelogramAlt');
    expect(nodes.find(n => n.id === 'n12')?.shape).toBe('trapezoid');
    expect(nodes.find(n => n.id === 'n13')?.shape).toBe('trapezoidAlt');
    expect(nodes.find(n => n.id === 'n14')?.shape).toBe('asymmetric');
  });

  // 8. @{ shape: doc } imports as file
  test('8. @{ shape: doc } imports as file', () => {
    const res = importMermaidFlowchart('graph TD\n  A@{ shape: doc, label: "Document" }');
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.shape).toBe('file');
    expect(node?.label).toBe('Document');
  });

  // 9. @{ shape: docs } imports as documents
  test('9. @{ shape: docs } imports as documents', () => {
    const res = importMermaidFlowchart('graph TD\n  A@{ shape: docs, label: "Documents" }');
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.shape).toBe('documents');
    expect(node?.label).toBe('Documents');
  });

  // 10. unknown @{ shape: nonexistent-shape } imports as process with unsupportedShape
  test('10. unknown @{ shape: nonexistent-shape } imports as process with unsupportedShape', () => {
    const res = importMermaidFlowchart('graph TD\n  A@{ shape: nonexistent-shape }');
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.shape).toBe('process');
    expect(res.warnings.some(w => w.type === 'unsupportedShape')).toBe(true);
  });

  // 11. implicit node from edge gets label=id and shape process
  test('11. implicit node from edge gets label=id and shape process', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B');
    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    const nodeB = res.diagram.nodes.find(n => n.id === 'B');
    expect(nodeA?.label).toBe('A');
    expect(nodeA?.shape).toBe('process');
    expect(nodeB?.label).toBe('B');
    expect(nodeB?.shape).toBe('process');
  });

  // 12. duplicate explicit node definition uses last-wins and emits duplicateId
  test('12. duplicate explicit node definition uses last-wins and emits duplicateId', () => {
    const res = importMermaidFlowchart('graph TD\n  A[First]\n  A[Second]');
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.label).toBe('Second');
    expect(res.warnings.some(w => w.type === 'duplicateId')).toBe(true);
  });

  // 13. edge labels via -- text --> and -->|text|
  test('13. edge labels via -- text --> and -->|text|', () => {
    const res = importMermaidFlowchart('graph TD\n  A -- Label 1 --> B\n  B -->|Label 2| C');
    expect(res.diagram.edges[0].label).toBe('Label 1');
    expect(res.diagram.edges[1].label).toBe('Label 2');
  });

  // 14. dotted edge imports as dotted
  test('14. dotted edge imports as dotted', () => {
    const res = importMermaidFlowchart('graph TD\n  A -.-> B\n  B -. Label .-> C');
    expect(res.diagram.edges[0].style).toBe('dotted');
    expect(res.diagram.edges[1].style).toBe('dotted');
    expect(res.diagram.edges[1].label).toBe('Label');
  });

  // 15. thick edge fallback warning
  test('15. thick edge fallback warning', () => {
    const res = importMermaidFlowchart('graph TD\n  A ==> B\n  B == Label ==> C');
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.diagram.edges[1].style).toBe('solid');
    expect(res.diagram.edges[1].label).toBe('Label');
    expect(res.warnings.filter(w => w.type === 'unsupportedEdge').length).toBe(2);
  });

  // 16. open link is fully supported
  test('16. open link is fully supported', () => {
    const res = importMermaidFlowchart('graph TD\n  A --- B');
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.diagram.edges[0].direction).toBe('undirected');
    expect(res.warnings.some(w => w.type === 'unsupportedEdge')).toBe(false);
  });

  // 17. bidirectional is fully supported
  test('17. bidirectional is fully supported', () => {
    const res = importMermaidFlowchart('graph TD\n  A <--> B');
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.diagram.edges[0].direction).toBe('bidirectional');
    expect(res.warnings.some(w => w.type === 'unsupportedEdge')).toBe(false);
  });

  // 18. quoted label containing --> is not split
  test('18. quoted label containing --> is not split', () => {
    const res = importMermaidFlowchart('graph TD\n  A["Text --> inside"] --> B');
    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    expect(nodeA?.label).toBe('Text --> inside');
    expect(res.diagram.edges.length).toBe(1);
  });

  // 19. quoted label containing | is not split
  test('19. quoted label containing | is not split', () => {
    const res = importMermaidFlowchart('graph TD\n  A["Text | pipe | inside"] --> B');
    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    expect(nodeA?.label).toBe('Text | pipe | inside');
  });

  // 20. Unicode labels are preserved
  test('20. Unicode labels are preserved', () => {
    const res = importMermaidFlowchart('graph TD\n  A["Unicode éàç中文"]');
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.label).toBe('Unicode éàç中文');
  });

  // 21. chained edge A --> B --> C creates two edges
  test('21. chained edge A --> B --> C creates two edges', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B --> C');
    expect(res.diagram.edges.length).toBe(2);
    expect((res.diagram.edges[0].from as ConnectedEdgeEndpoint).nodeId).toBe('A');
    expect((res.diagram.edges[0].to as ConnectedEdgeEndpoint).nodeId).toBe('B');
    expect((res.diagram.edges[1].from as ConnectedEdgeEndpoint).nodeId).toBe('B');
    expect((res.diagram.edges[1].to as ConnectedEdgeEndpoint).nodeId).toBe('C');
  });

  // 22. ampersand syntax parses and expands edges
  test('22. ampersand syntax parses and expands edges', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(hasEdge(res.diagram.edges, 'A', 'B')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'A', 'C')).toBe(true);
    expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
  });

  // 22a. ampersand syntax with multiple sources
  test('22a. ampersand syntax with multiple sources', () => {
    const res = importMermaidFlowchart('graph TD\n  A & B --> C');
    expect(res.diagram.edges.length).toBe(2);
    expect(hasEdge(res.diagram.edges, 'A', 'C')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'B', 'C')).toBe(true);
  });

  // 22b. ampersand syntax with multiple sources and targets
  test('22b. ampersand syntax with multiple sources and targets', () => {
    const res = importMermaidFlowchart('graph TD\n  A & B --> C & D');
    expect(res.diagram.edges.length).toBe(4);
    expect(hasEdge(res.diagram.edges, 'A', 'C')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'A', 'D')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'B', 'C')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'B', 'D')).toBe(true);
  });

  // 22c. inline node definitions in groups
  test('22c. inline node definitions in groups', () => {
    const res = importMermaidFlowchart('graph TD\n  A[Start] --> B[Step B] & C{Decision}');
    expect(res.diagram.edges.length).toBe(2);
    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    const nodeB = res.diagram.nodes.find(n => n.id === 'B');
    const nodeC = res.diagram.nodes.find(n => n.id === 'C');
    expect(nodeA?.label).toBe('Start');
    expect(nodeA?.shape).toBe('process');
    expect(nodeB?.label).toBe('Step B');
    expect(nodeB?.shape).toBe('process');
    expect(nodeC?.label).toBe('Decision');
    expect(nodeC?.shape).toBe('decision');
  });

  // 22d. inline node definitions in source group
  test('22d. inline node definitions in source group', () => {
    const res = importMermaidFlowchart('graph TD\n  A[Left] & B[Right] --> C[Merge]');
    expect(res.diagram.edges.length).toBe(2);
    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    const nodeB = res.diagram.nodes.find(n => n.id === 'B');
    const nodeC = res.diagram.nodes.find(n => n.id === 'C');
    expect(nodeA?.label).toBe('Left');
    expect(nodeB?.label).toBe('Right');
    expect(nodeC?.label).toBe('Merge');
  });

  // 22e. ampersands inside node labels do not split
  test('22e. ampersands inside node labels do not split', () => {
    const res = importMermaidFlowchart('graph TD\n  A[Research & Development] & B[Sales & Marketing] --> C[Decision]');
    expect(res.diagram.edges.length).toBe(2);
    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    const nodeB = res.diagram.nodes.find(n => n.id === 'B');
    expect(nodeA?.label).toBe('Research & Development');
    expect(nodeB?.label).toBe('Sales & Marketing');
    expect(hasEdge(res.diagram.edges, 'A', 'C')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'B', 'C')).toBe(true);
  });

  // 22f. labelled pipe edge with multiple targets
  test('22f. labelled pipe edge with multiple targets', () => {
    const res = importMermaidFlowchart('graph TD\n  A -->|Yes| B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].label).toBe('Yes');
    expect(res.diagram.edges[1].label).toBe('Yes');
  });

  // 22g. labelled text edge with multiple targets
  test('22g. labelled text edge with multiple targets', () => {
    const res = importMermaidFlowchart('graph TD\n  A -- approved --> B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].label).toBe('approved');
    expect(res.diagram.edges[1].label).toBe('approved');
  });

  // 22h. dotted edge with multiple targets
  test('22h. dotted edge with multiple targets', () => {
    const res = importMermaidFlowchart('graph TD\n  A -.-> B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].style).toBe('dotted');
    expect(res.diagram.edges[1].style).toBe('dotted');
  });

  // 22i. dotted labelled edge with multiple targets
  test('22i. dotted labelled edge with multiple targets', () => {
    const res = importMermaidFlowchart('graph TD\n  A -. optional .-> B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].style).toBe('dotted');
    expect(res.diagram.edges[0].label).toBe('optional');
    expect(res.diagram.edges[1].style).toBe('dotted');
    expect(res.diagram.edges[1].label).toBe('optional');
  });

  // 22j. thick edge fallback with ampersand
  test('22j. thick edge fallback with ampersand', () => {
    const res = importMermaidFlowchart('graph TD\n  A ==> B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.diagram.edges[1].style).toBe('solid');
    // Only one warning for unsupported edge on this line
    expect(res.warnings.filter(w => w.type === 'unsupportedEdge').length).toBe(1);
  });

  // 22k. open link fallback with ampersand
  test('22k. open link fallback with ampersand', () => {
    const res = importMermaidFlowchart('graph TD\n  A --- B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.diagram.edges[0].direction).toBe('undirected');
    expect(res.diagram.edges[1].style).toBe('solid');
    expect(res.diagram.edges[1].direction).toBe('undirected');
    expect(res.warnings.filter(w => w.type === 'unsupportedEdge').length).toBe(0);
  });

  // 22l. bidirectional fallback with ampersand
  test('22l. bidirectional fallback with ampersand', () => {
    const res = importMermaidFlowchart('graph TD\n  A <--> B & C');
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.diagram.edges[0].direction).toBe('bidirectional');
    expect(res.diagram.edges[1].style).toBe('solid');
    expect(res.diagram.edges[1].direction).toBe('bidirectional');
    expect(res.warnings.filter(w => w.type === 'unsupportedEdge').length).toBe(0);
  });

  // 22m. ampersand inside edge label does not expand
  test('22m. ampersand inside edge label does not expand', () => {
    const res = importMermaidFlowchart('graph TD\n  A -->|Sales & Marketing| B');
    expect(res.diagram.edges.length).toBe(1);
    expect(res.diagram.edges[0].label).toBe('Sales & Marketing');
    expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(false);
  });

  // 22n. malformed ampersand lines emit ampersandSkipped
  test('22n. malformed ampersand lines emit ampersandSkipped', () => {
    const cases = [
      'graph TD\n  A --> &',
      'graph TD\n  & --> B',
      'graph TD\n  A & --> B',
      'graph TD\n  A --> B &',
      'graph TD\n  A && B --> C'
    ];
    for (const c of cases) {
      const res = importMermaidFlowchart(c);
      expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(true);
    }
  });

  // 22o. chained ampersand edges
  test('22o. chained ampersand edges', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B & C --> D');
    expect(res.diagram.edges.length).toBe(4);
    expect(hasEdge(res.diagram.edges, 'A', 'B')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'A', 'C')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'B', 'D')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'C', 'D')).toBe(true);
  });

  // 23. comments are ignored
  test('23. comments are ignored', () => {
    const res = importMermaidFlowchart('graph TD\n  %% this is a comment\n  A --> B');
    expect(res.diagram.nodes.length).toBe(2);
  });

  // 24. YAML frontmatter is ignored
  test('24. YAML frontmatter is ignored', () => {
    const code = `---\ntitle: Simple diagram\n---\ngraph TD\n  A --> B`;
    const res = importMermaidFlowchart(code);
    expect(res.diagram.nodes.length).toBe(2);
  });

  // 25. subgraph imports contents flat and emits unsupportedSubgraph
  test('25. subgraph imports contents flat and emits unsupportedSubgraph', () => {
    const code = `graph TD\n  subgraph "Group A"\n    A --> B\n  end`;
    const res = importMermaidFlowchart(code);
    expect(res.diagram.nodes.length).toBe(2);
    expect(res.warnings.some(w => w.type === 'unsupportedSubgraph')).toBe(true);
  });

  // 26. end only closes subgraph when in subgraph
  test('26. end only closes subgraph when in subgraph', () => {
    const code = `graph TD\n  end[Node Named End]\n  subgraph GroupA\n    A --> B\n  end`;
    const res = importMermaidFlowchart(code);
    const nodeEnd = res.diagram.nodes.find(n => n.id === 'end');
    expect(nodeEnd).toBeDefined();
    expect(nodeEnd?.label).toBe('Node Named End');
  });

  // 27. classDef / class emit unsupportedClass
  test('27. classDef / class emit unsupportedClass', () => {
    const code = `graph TD\n  A --> B\n  classDef highlight fill:#f96\n  class A highlight`;
    const res = importMermaidFlowchart(code);
    expect(res.warnings.filter(w => w.type === 'unsupportedClass').length).toBe(2);
  });

  // 28. malformed line emits lineSkipped and does not crash
  test('28. malformed line emits lineSkipped and does not crash', () => {
    const code = `graph TD\n  A --> B\n  some malformed junk here\n  C --> D`;
    const res = importMermaidFlowchart(code);
    expect(res.diagram.nodes.length).toBe(4);
    expect(res.warnings.some(w => w.type === 'lineSkipped')).toBe(true);
  });

  // 29. positions are deterministic
  test('29. positions are deterministic', () => {
    const code = `graph TD\n  A --> B\n  A --> C\n  B --> D`;
    const res1 = importMermaidFlowchart(code);
    const res2 = importMermaidFlowchart(code);
    expect(res1.diagram.nodes).toEqual(res2.diagram.nodes);
  });

  // 30. imported diagram matches expected structure
  test('30. imported diagram matches expected structure', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B');
    expect(res.diagram.schemaVersion).toBe(1);
    expect(res.diagram.diagramType).toBe('flowchart');
    expect(res.diagram.nodes.length).toBe(2);
    expect(res.diagram.edges.length).toBe(1);
  });

  // 31. manual verification diagram case
  test('31. manual verification diagram case', () => {
    const code = `flowchart TD
  A[Start] --> B & C
  B --> D[End]
  C --> D`;
    const res = importMermaidFlowchart(code);
    expect(res.warnings.length).toBe(0);
    expect(res.diagram.nodes.length).toBe(4);
    expect(res.diagram.edges.length).toBe(4);
    expect(hasEdge(res.diagram.edges, 'A', 'B')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'A', 'C')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'B', 'D')).toBe(true);
    expect(hasEdge(res.diagram.edges, 'C', 'D')).toBe(true);
  });

  // 32. imports direction-specific operators correctly
  test('32. imports direction-specific operators correctly', () => {
    const code = `flowchart TD
      A --- B
      A <--> B
      A -.- B
      A <-.-> B
      A ---|"L1"| B
      A <-->|"L2"| B
      A -.-|"L3"| B
      A <-.->|"L4"| B
    `;
    const res = importMermaidFlowchart(code);
    expect(res.warnings.filter(w => w.type !== 'labelSanitized').length).toBe(0);
    const edges = res.diagram.edges;
    expect(edges.length).toBe(8);

    expect(edges[0]).toMatchObject({ style: 'solid', direction: 'undirected', label: '' });
    expect(edges[1]).toMatchObject({ style: 'solid', direction: 'bidirectional', label: '' });
    expect(edges[2]).toMatchObject({ style: 'dotted', direction: 'undirected', label: '' });
    expect(edges[3]).toMatchObject({ style: 'dotted', direction: 'bidirectional', label: '' });
    expect(edges[4]).toMatchObject({ style: 'solid', direction: 'undirected', label: 'L1' });
    expect(edges[5]).toMatchObject({ style: 'solid', direction: 'bidirectional', label: 'L2' });
    expect(edges[6]).toMatchObject({ style: 'dotted', direction: 'undirected', label: 'L3' });
    expect(edges[7]).toMatchObject({ style: 'dotted', direction: 'bidirectional', label: 'L4' });
  });

  // 33. thick edges fallback
  test('33. thick edges fallback', () => {
    const code = `flowchart TD
      A === B
      A ===|"Label"| B
    `;
    const res = importMermaidFlowchart(code);
    expect(res.diagram.edges.length).toBe(2);
    expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'directed' });
    expect(res.diagram.edges[1]).toMatchObject({ style: 'solid', direction: 'directed', label: 'Label' });
    expect(res.warnings.filter(w => w.type === 'unsupportedEdge').length).toBe(2);
  });

  // 34. import -> export round-trip preserves directions
  test('34. import -> export round-trip preserves directions', () => {
    const code = [
      'flowchart TD',
      '  A --- B',
      '  A ---|"L1"| B',
      '  A <--> B',
      '  A <-->|"L2"| B',
      '  A -.- B',
      '  A -.-|"L3"| B',
      '  A <-.-> B',
      '  A <-.->|"L4"| B'
    ].join('\n');
    const imported = importMermaidFlowchart(code);
    const exported = toMermaid(imported.diagram);
    expect(exported).toContain('A --- B');
    expect(exported).toContain('A ---|"L1"| B');
    expect(exported).toContain('A <--> B');
    expect(exported).toContain('A <-->|"L2"| B');
    expect(exported).toContain('A -.- B');
    expect(exported).toContain('A -.-|"L3"| B');
    expect(exported).toContain('A <-.-> B');
    expect(exported).toContain('A <-.->|"L4"| B');
  });

  // 35. Targeted parser tests for each edge direction+style combination
  describe('35. edge direction parser — individual operator tests', () => {
    test('solid directed: -->', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A --> B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'directed', label: '' });
    });

    test('solid undirected: ---', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A --- B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'undirected', label: '' });
    });

    test('solid bidirectional: <-->', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <--> B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'bidirectional', label: '' });
    });

    test('dotted directed: -.->', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A -.-> B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'dotted', direction: 'directed', label: '' });
    });

    test('dotted undirected: -.-', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A -.- B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'dotted', direction: 'undirected', label: '' });
    });

    test('dotted bidirectional: <-.->', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <-.-> B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'dotted', direction: 'bidirectional', label: '' });
    });

    test('reverse solid canonical: A <--- B', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <--- B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'reverse', label: '' });
    });

    test('reverse dotted canonical: A <-.- B', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <-.- B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'dotted', direction: 'reverse', label: '' });
    });

    test('reverse solid backup alias: A <-- B', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <-- B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'reverse', label: '' });
    });

    test('reverse dotted backup alias: A <-. B', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <-. B');
      expect(res.diagram.edges).toHaveLength(1);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'dotted', direction: 'reverse', label: '' });
    });

    test('precedence: bidirectional edges are not misparsed as reverse', () => {
      const res = importMermaidFlowchart('flowchart TD\n  A <--> B\n  C <-.-> D');
      expect(res.diagram.edges).toHaveLength(2);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'bidirectional' });
      expect(res.diagram.edges[1]).toMatchObject({ style: 'dotted', direction: 'bidirectional' });
    });

    test('all 8 operators with pipe labels', () => {
      const res = importMermaidFlowchart([
        'flowchart TD',
        '  A1 -->|"L1"| B1',
        '  A2 ---|"L2"| B2',
        '  A3 <-->|"L3"| B3',
        '  A4 -.->|"L4"| B4',
        '  A5 -.-|"L5"| B5',
        '  A6 <-.->|"L6"| B6',
        '  A7 <---|"L7"| B7',
        '  A8 <-.-|"L8"| B8',
      ].join('\n'));
      expect(res.diagram.edges).toHaveLength(8);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'directed', label: 'L1' });
      expect(res.diagram.edges[1]).toMatchObject({ style: 'solid', direction: 'undirected', label: 'L2' });
      expect(res.diagram.edges[2]).toMatchObject({ style: 'solid', direction: 'bidirectional', label: 'L3' });
      expect(res.diagram.edges[3]).toMatchObject({ style: 'dotted', direction: 'directed', label: 'L4' });
      expect(res.diagram.edges[4]).toMatchObject({ style: 'dotted', direction: 'undirected', label: 'L5' });
      expect(res.diagram.edges[5]).toMatchObject({ style: 'dotted', direction: 'bidirectional', label: 'L6' });
      expect(res.diagram.edges[6]).toMatchObject({ style: 'solid', direction: 'reverse', label: 'L7' });
      expect(res.diagram.edges[7]).toMatchObject({ style: 'dotted', direction: 'reverse', label: 'L8' });
    });

    test('inline text labels preserve direction', () => {
      const res = importMermaidFlowchart([
        'flowchart TD',
        '  A -- solid label --> B',
        '  C -. dotted label .-> D',
      ].join('\n'));
      expect(res.diagram.edges).toHaveLength(2);
      expect(res.diagram.edges[0]).toMatchObject({ style: 'solid', direction: 'directed', label: 'solid label' });
      expect(res.diagram.edges[1]).toMatchObject({ style: 'dotted', direction: 'directed', label: 'dotted label' });
    });
  });

  // 36. Full chain: import → normalizeDiagram → export round-trip
  test('36. full chain import → normalizeDiagram → export preserves all directions', () => {
    const code = [
      'flowchart TD',
      '  A --- B',
      '  C <--> D',
      '  E -.- F',
      '  G <-.-> H',
      '  I <--- J',
      '  K <-.- L',
      '  M <--|"Tolerant solid"| N',
      '  O <-.|"Tolerant dotted"| P',
    ].join('\n');

    const imported = importMermaidFlowchart(code);

    // Simulate loadDiagram path: normalizeDiagram
    const normalized = normalizeDiagram(imported.diagram);

    // Verify direction survived normalization
    const edges = normalized.edges;
    expect(edges).toHaveLength(8);
    expect(edges[0]).toMatchObject({ from: { kind: 'connected', nodeId: 'A' }, to: { kind: 'connected', nodeId: 'B' }, style: 'solid', direction: 'undirected' });
    expect(edges[1]).toMatchObject({ from: { kind: 'connected', nodeId: 'C' }, to: { kind: 'connected', nodeId: 'D' }, style: 'solid', direction: 'bidirectional' });
    expect(edges[2]).toMatchObject({ from: { kind: 'connected', nodeId: 'E' }, to: { kind: 'connected', nodeId: 'F' }, style: 'dotted', direction: 'undirected' });
    expect(edges[3]).toMatchObject({ from: { kind: 'connected', nodeId: 'G' }, to: { kind: 'connected', nodeId: 'H' }, style: 'dotted', direction: 'bidirectional' });
    expect(edges[4]).toMatchObject({ from: { kind: 'connected', nodeId: 'I' }, to: { kind: 'connected', nodeId: 'J' }, style: 'solid', direction: 'reverse' });
    expect(edges[5]).toMatchObject({ from: { kind: 'connected', nodeId: 'K' }, to: { kind: 'connected', nodeId: 'L' }, style: 'dotted', direction: 'reverse' });
    expect(edges[6]).toMatchObject({ from: { kind: 'connected', nodeId: 'M' }, to: { kind: 'connected', nodeId: 'N' }, style: 'solid', direction: 'reverse', label: 'Tolerant solid' });
    expect(edges[7]).toMatchObject({ from: { kind: 'connected', nodeId: 'O' }, to: { kind: 'connected', nodeId: 'P' }, style: 'dotted', direction: 'reverse', label: 'Tolerant dotted' });

    // Verify export round-trip and backup alias canonicalization
    const exported = toMermaid(normalized);
    expect(exported).toContain('A --- B');
    expect(exported).toContain('C <--> D');
    expect(exported).toContain('E -.- F');
    expect(exported).toContain('G <-.-> H');
    expect(exported).toContain('I <--- J');
    expect(exported).toContain('K <-.- L');
    // Aliases <-- and <-. must be canonicalized to <--- and <-.- respectively:
    expect(exported).toContain('M <---|Trimmed Label| N'.replace('Trimmed Label', '"Tolerant solid"'));
    expect(exported).toContain('O <-.-|Trimmed Label| P'.replace('Trimmed Label', '"Tolerant dotted"'));
  });

  test('Shape precedence rules', () => {
    // 1. Metadata shape wins over classic syntax shape
    const res1 = importMermaidFlowchart('graph TD\n  A[Classic]@{ shape: doc, label: "Meta" }');
    const node1 = res1.diagram.nodes.find(n => n.id === 'A');
    expect(node1?.shape).toBe('file');
    expect(node1?.label).toBe('Meta');

    // 2. Metadata label wins over classic syntax label
    const res2 = importMermaidFlowchart('graph TD\n  A[Classic]@{ shape: doc, label: "Meta" }');
    const node2 = res2.diagram.nodes.find(n => n.id === 'A');
    expect(node2?.label).toBe('Meta');

    // 3. Metadata shape without metadata label preserves the classic shorthand label
    const res3 = importMermaidFlowchart('graph TD\n  A[Classic]@{ shape: doc }');
    const node3 = res3.diagram.nodes.find(n => n.id === 'A');
    expect(node3?.shape).toBe('file');
    expect(node3?.label).toBe('Classic');

    // 4. Fall back to node ID if no classic/metadata label is available
    const res4 = importMermaidFlowchart('graph TD\n  A@{ shape: doc }');
    const node4 = res4.diagram.nodes.find(n => n.id === 'A');
    expect(node4?.label).toBe('A');
  });

  test('Alias resolution on import', () => {
    const res = importMermaidFlowchart(`graph TD
      A@{ shape: card }
      B@{ shape: document }
      C@{ shape: database }
      D@{ shape: manual-input }
      E@{ shape: sloped-rectangle }
      F@{ shape: stacked-document }
      G@{ shape: stacked-rectangle }
      H@{ shape: processes }
    `);
    const nodes = res.diagram.nodes;
    expect(nodes.find(n => n.id === 'A')?.shape).toBe('card');
    expect(nodes.find(n => n.id === 'B')?.shape).toBe('file');
    expect(nodes.find(n => n.id === 'C')?.shape).toBe('database');
    expect(nodes.find(n => n.id === 'D')?.shape).toBe('manualInput');
    expect(nodes.find(n => n.id === 'E')?.shape).toBe('manualInput');
    expect(nodes.find(n => n.id === 'F')?.shape).toBe('documents');
    expect(nodes.find(n => n.id === 'G')?.shape).toBe('multiProcess');
    expect(nodes.find(n => n.id === 'H')?.shape).toBe('multiProcess');
  });

  test('Escaping and delimiters in metadata labels', () => {
    const res = importMermaidFlowchart(`graph TD
      A@{ shape: doc, label: "Apostrophe's and double \\"quotes\\", colons: , commas, brackets [] braces {}" }
      B@{ shape: cloud, label: "Unicode: éàçü" }
    `);
    const nodes = res.diagram.nodes;
    expect(nodes.find(n => n.id === 'A')?.label).toBe('Apostrophe\'s and double "quotes", colons: , commas, brackets [] braces {}');
    expect(nodes.find(n => n.id === 'B')?.label).toBe('Unicode: éàçü');
  });

  test('paper-tape imports as paperTape shape', () => {
    const res = importMermaidFlowchart(`graph TD
      A@{ shape: paper-tape, label: "Tape" }
    `);
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.shape).toBe('paperTape');
    expect(node?.label).toBe('Tape');
  });

  test('Space between node ID and @{ is accepted (whitespace tolerance)', () => {
    // Our parser skips whitespace between node ID and classic/metadata delimiters.
    // This matches Mermaid's own tolerance for whitespace before brackets.
    const res = importMermaidFlowchart(`graph TD
      A @{ shape: doc, label: "Spaced" }
    `);
    const node = res.diagram.nodes.find(n => n.id === 'A');
    expect(node?.shape).toBe('file');
    expect(node?.label).toBe('Spaced');
  });

  test('Labels with parentheses, slashes, and backslashes in metadata', () => {
    const res = importMermaidFlowchart(`graph TD
      A@{ shape: doc, label: "Path (C:\\\\Users\\\\test) / home/user" }
      B@{ shape: cloud, label: "Func(a, b) => [result]" }
    `);
    const nodes = res.diagram.nodes;
    expect(nodes.find(n => n.id === 'A')?.label).toBe('Path (C:\\Users\\test) / home/user');
    expect(nodes.find(n => n.id === 'B')?.label).toBe('Func(a, b) => [result]');
  });

  test('Generic shape export→import round-trip preserves shape and label', () => {
    const res1 = importMermaidFlowchart(`graph TD
      A@{ shape: paper-tape, label: "Wavy Tape" }
      B@{ shape: doc, label: "Document" }
      C@{ shape: cloud, label: "Cloud" }
      D@{ shape: notch-rect, label: "Card" }
    `);
    // Verify import
    const nodes = res1.diagram.nodes;
    expect(nodes.find(n => n.id === 'A')?.shape).toBe('paperTape');
    expect(nodes.find(n => n.id === 'B')?.shape).toBe('file');
    expect(nodes.find(n => n.id === 'C')?.shape).toBe('cloud');
    expect(nodes.find(n => n.id === 'D')?.shape).toBe('card');

    // Re-export and verify generic syntax
    const exported = toMermaid(res1.diagram);
    expect(exported).toContain('@{ shape: paper-tape, label: "Wavy Tape" }');
    expect(exported).toContain('@{ shape: doc, label: "Document" }');
    expect(exported).toContain('@{ shape: cloud, label: "Cloud" }');
    expect(exported).toContain('@{ shape: notch-rect, label: "Card" }');
  });
});

