import { describe, test, expect } from 'vitest';
import { importMermaidFlowchart } from './mermaidImport';

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

  // 10. unknown @{ shape: hourglass } imports as process with unsupportedShape
  test('10. unknown @{ shape: hourglass } imports as process with unsupportedShape', () => {
    const res = importMermaidFlowchart('graph TD\n  A@{ shape: hourglass }');
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

  // 16. open link fallback warning (undirected --- imports as solid with warning)
  test('16. open link fallback warning', () => {
    const res = importMermaidFlowchart('graph TD\n  A --- B');
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.warnings.some(w => w.type === 'unsupportedEdge')).toBe(true);
  });

  // 17. bidirectional fallback warning
  test('17. bidirectional fallback warning', () => {
    const res = importMermaidFlowchart('graph TD\n  A <--> B');
    expect(res.diagram.edges[0].style).toBe('solid');
    expect(res.warnings.some(w => w.type === 'unsupportedEdge')).toBe(true);
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
    expect(res.diagram.edges[0].from).toBe('A');
    expect(res.diagram.edges[0].to).toBe('B');
    expect(res.diagram.edges[1].from).toBe('B');
    expect(res.diagram.edges[1].to).toBe('C');
  });

  // 22. ampersand syntax emits ampersandSkipped
  test('22. ampersand syntax emits ampersandSkipped', () => {
    const res = importMermaidFlowchart('graph TD\n  A --> B & C');
    expect(res.diagram.edges.length).toBe(0);
    expect(res.warnings.some(w => w.type === 'ampersandSkipped')).toBe(true);
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
});
