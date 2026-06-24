import { describe, test, expect } from 'vitest';
import { CanonicalDiagram } from './types';
import { toMermaid, escapeLabel, formatMermaidExport } from './mermaid';

describe('toMermaid pure serialization tests', () => {
  test('AC1 — Empty diagram returns flowchart TD', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [],
      edges: [],
      textBoxes: []
    };
    expect(toMermaid(diagram)).toBe('flowchart TD');
  });

  test('AC2 — Basic diagram snapshot matching', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Demande reçue', shape: 'stadium', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'Données suffisantes ?', shape: 'decision', position: { x: 0, y: 100 } }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' }
      ],
      textBoxes: []
    };
    const expected = [
      'flowchart TD',
      '  n1(["Demande reçue"])',
      '  n2{"Données suffisantes ?"}',
      '  n1 --> n2'
    ].join('\n');
    expect(toMermaid(diagram)).toBe(expected);
  });

  test('AC3 — Complex French labels and decision flows', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Décision : valider (oui/non) ?', shape: 'decision', position: { x: 0, y: 0 } }
      ],
      edges: [],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1{"Décision : valider (oui/non) ?"}');
  });

  test('AC4 — Reserved keyword "end" in lowercase', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'end', shape: 'process', position: { x: 0, y: 0 } }
      ],
      edges: [],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    // Should render: n1["end"]
    // Because the ID is synthetic (n1), it avoids conflict with keyword "end"
    expect(output).toContain('n1["end"]');
  });

  test('AC5 — Special character escaping matches requirement', () => {
    expect(escapeLabel('&')).toBe('&amp;');
    expect(escapeLabel('<')).toBe('&lt;');
    expect(escapeLabel('>')).toBe('&gt;');
    expect(escapeLabel('"')).toBe('#quot;');
    expect(escapeLabel('#')).toBe('#35;');
    expect(escapeLabel('\\')).toBe('\\\\');
    expect(escapeLabel('\n')).toBe('<br/>');
    
    // Combined string, evaluating character-by-character to prevent double-escaping
    expect(escapeLabel('A & B < C > D "E" #F\nG \\ H')).toBe(
      'A &amp; B &lt; C &gt; D #quot;E#quot; #35;F<br/>G \\\\ H'
    );
  });

  test('Serialization of Database and File shapes', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        { id: 'n1', label: 'DB Node', shape: 'database', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'File \\ Node', shape: 'file', position: { x: 0, y: 100 } }
      ],
      edges: [],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1[("DB Node")]');
    expect(output).toContain('n2@{ shape: doc, label: "File \\\\ Node" }');
  });

  test('Exact string match for all 16 shapes and special characters escaping', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Process', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'Rounded', shape: 'rounded', position: { x: 0, y: 100 } },
        { id: 'n3', label: 'Stadium', shape: 'stadium', position: { x: 0, y: 200 } },
        { id: 'n4', label: 'Decision', shape: 'decision', position: { x: 0, y: 300 } },
        { id: 'n5', label: 'Event', shape: 'event', position: { x: 0, y: 400 } },
        { id: 'n6', label: 'EndEvent', shape: 'endEvent', position: { x: 0, y: 500 } },
        { id: 'n7', label: 'Database', shape: 'database', position: { x: 0, y: 600 } },
        { id: 'n8', label: 'File', shape: 'file', position: { x: 0, y: 700 } },
        { id: 'n9', label: 'Subroutine', shape: 'subroutine', position: { x: 0, y: 800 } },
        { id: 'n10', label: 'Hexagon', shape: 'hexagon', position: { x: 0, y: 900 } },
        { id: 'n11', label: 'Parallelogram', shape: 'parallelogram', position: { x: 0, y: 1000 } },
        { id: 'n12', label: 'Parallelogram alt', shape: 'parallelogramAlt', position: { x: 0, y: 1100 } },
        { id: 'n13', label: 'Trapezoid', shape: 'trapezoid', position: { x: 0, y: 1200 } },
        { id: 'n14', label: 'Trapezoid alt', shape: 'trapezoidAlt', position: { x: 0, y: 1300 } },
        { id: 'n15', label: 'Asymmetric', shape: 'asymmetric', position: { x: 0, y: 1400 } },
        { id: 'n16', label: 'Documents', shape: 'documents', position: { x: 0, y: 1500 } },
        { id: 'n17', label: 'Special "Chars" \\ / [] {} |', shape: 'process', position: { x: 0, y: 1600 } }
      ],
      edges: [],
      textBoxes: []
    };

    const output = toMermaid(diagram);
    const expected = [
      'flowchart TD',
      '  n1["Process"]',
      '  n2("Rounded")',
      '  n3(["Stadium"])',
      '  n4{"Decision"}',
      '  n5(("Event"))',
      '  n6((("EndEvent")))',
      '  n7[("Database")]',
      '  n8@{ shape: doc, label: "File" }',
      '  n9[["Subroutine"]]',
      '  n10{{"Hexagon"}}',
      '  n11[/"Parallelogram"/]',
      '  n12[\\"Parallelogram alt"\\]',
      '  n13[/"Trapezoid"\\]',
      '  n14[\\"Trapezoid alt"/]',
      '  n15>"Asymmetric"]',
      '  n16@{ shape: docs, label: "Documents" }',
      '  n17["Special #quot;Chars#quot; \\\\ / [] {} |"]'
    ].join('\n');

    expect(output).toBe(expected);
  });

  test('AC6 — Node IDs starting with o and x do not conflict with shape edge types', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'o1', label: 'Starts with o', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'x1', label: 'Starts with x', shape: 'process', position: { x: 0, y: 0 } }
      ],
      edges: [
        { id: 'e1', from: 'o1', to: 'x1', label: '', style: 'solid' }
      ],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).toContain('o1["Starts with o"]');
    expect(output).toContain('x1["Starts with x"]');
    expect(output).toContain('o1 --> x1');
  });

  test('AC7 — Edges with special labels', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'B', shape: 'process', position: { x: 0, y: 0 } }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Yes & Ok!', style: 'solid' }
      ],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1 -->|"Yes &amp; Ok!"| n2');
  });

  test('AC9 — No x/y coordinates in output', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        { id: 'n1', label: 'Start', shape: 'process', position: { x: 999, y: 123 } }
      ],
      edges: [],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).not.toContain('999');
    expect(output).not.toContain('123');
  });

  test('AC12 — Determinism and ID sorting', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n10', label: 'Node 10', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'Node 2', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'n1', label: 'Node 1', shape: 'process', position: { x: 0, y: 0 } }
      ],
      edges: [
        { id: 'e2', from: 'n2', to: 'n10', label: '', style: 'solid' },
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' }
      ],
      textBoxes: []
    };

    const run1 = toMermaid(diagram);
    const run2 = toMermaid(diagram);
    expect(run1).toBe(run2);

    // Verify ordering
    const lines = run1.split('\n');
    expect(lines[1]).toContain('n1');
    expect(lines[2]).toContain('n2');
    expect(lines[3]).toContain('n10');
    expect(lines[4]).toBe('  n1 --> n2');
    expect(lines[5]).toBe('  n2 --> n10');
  });

  test('Non-regression — toMermaid ignores textBoxes entirely', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Start', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'End', shape: 'process', position: { x: 0, y: 100 } }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' }
      ],
      textBoxes: [
        {
          id: 'tb1',
          text: 'This is an annotation',
          position: { x: 50, y: 50 },
          width: 180,
          height: 90,
          style: {
            fontSize: 14,
            bold: false,
            italic: false,
            textAlign: 'left',
            color: '#374151',
            backgroundColor: '#ff0000',
            borderColor: '#00ff00'
          }
        },
        {
          id: 'tb2',
          text: 'Another note',
          position: { x: 200, y: 200 },
          width: 100,
          height: 50,
          style: {
            fontSize: 16,
            bold: true,
            italic: false,
            textAlign: 'center',
            color: '#000000',
            backgroundColor: '#ffffff'
          }
        }
      ]
    };
    const output = toMermaid(diagram);
    // Text boxes must not appear in the Mermaid output
    expect(output).not.toContain('tb1');
    expect(output).not.toContain('tb2');
    expect(output).not.toContain('annotation');
    expect(output).not.toContain('Another note');
    // Only the expected Mermaid content should be present
    const expected = [
      'flowchart TD',
      '  n1["Start"]',
      '  n2["End"]',
      '  n1 --> n2'
    ].join('\n');
    expect(output).toBe(expected);
  });
});

describe('formatMermaidExport formatting tests', () => {
  const codeSample = 'flowchart TD\n  n1["Début"]\n\n  n1 --> n2';

  test('markdown format wraps code in triple backticks with mermaid identifier', () => {
    const formatted = formatMermaidExport(codeSample, 'markdown');
    expect(formatted).toBe('```mermaid\nflowchart TD\n  n1["Début"]\n\n  n1 --> n2\n```');
  });

  test('html format wraps code in div and indents non-empty lines with 4 spaces', () => {
    const formatted = formatMermaidExport(codeSample, 'html');
    const expected = [
      '<div class="mermaid">',
      '    flowchart TD',
      '      n1["Début"]',
      '',
      '      n1 --> n2',
      '</div>'
    ].join('\n');
    expect(formatted).toBe(expected);
  });

  test('raw format returns code unmodified', () => {
    const formatted = formatMermaidExport(codeSample, 'raw');
    expect(formatted).toBe(codeSample);
  });
});

describe('Mermaid invariance — width/height must never appear in output', () => {
  test('node.width and node.height are ignored by toMermaid', () => {
    const diagramWithout: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Start', shape: 'stadium', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'Check?', shape: 'decision', position: { x: 0, y: 100 } },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' },
      ],
      textBoxes: [],
    };

    const diagramWith: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Start', shape: 'stadium', position: { x: 0, y: 0 }, width: 300, height: 200 },
        { id: 'n2', label: 'Check?', shape: 'decision', position: { x: 0, y: 100 }, width: 500, height: 400 },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' },
      ],
      textBoxes: [],
    };

    expect(toMermaid(diagramWith)).toBe(toMermaid(diagramWithout));
  });

  test('formatMermaidExport is unchanged with width/height on nodes', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        { id: 'n1', label: 'DB', shape: 'database', position: { x: 0, y: 0 }, width: 250, height: 150 },
      ],
      edges: [],
      textBoxes: [],
    };

    const code = toMermaid(diagram);
    expect(code).not.toContain('width');
    expect(code).not.toContain('height');
    expect(code).not.toContain('250');
    expect(code).not.toContain('150');

    const formatted = formatMermaidExport(code, 'markdown');
    expect(formatted).not.toContain('width');
    expect(formatted).not.toContain('height');
  });
});

describe('Mermaid Node Styling tests', () => {
  test('bold label exports using Mermaid Markdown String syntax', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        {
          id: 'n1',
          label: 'Bold Node',
          shape: 'process',
          position: { x: 0, y: 0 },
          style: { text: { bold: true } },
        },
      ],
      edges: [],
      textBoxes: [],
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1["`**Bold Node**`"]');
  });

  test('italic label exports using Mermaid Markdown String syntax', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        {
          id: 'n1',
          label: 'Italic Node',
          shape: 'process',
          position: { x: 0, y: 0 },
          style: { text: { italic: true } },
        },
      ],
      edges: [],
      textBoxes: [],
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1["`_Italic Node_`"]');
  });

  test('bold + italic label exports deterministically using nested Markdown String syntax', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        {
          id: 'n1',
          label: 'Bold & Italic Node',
          shape: 'process',
          position: { x: 0, y: 0 },
          style: { text: { bold: true, italic: true } },
        },
      ],
      edges: [],
      textBoxes: [],
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1["`**_Bold &amp; Italic Node_**`"]');
  });

  test('background, border, text color, and font size export combined in a single deterministic style directive', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        {
          id: 'n1',
          label: 'Styled Node',
          shape: 'process',
          position: { x: 0, y: 0 },
          style: {
            backgroundColor: '#ff0000',
            borderColor: '#00ff00',
            text: {
              color: '#0000ff',
              fontSize: 18,
            },
          },
        },
      ],
      edges: [],
      textBoxes: [],
    };
    const output = toMermaid(diagram);
    expect(output).toContain('style n1 fill:#ff0000,stroke:#00ff00,color:#0000ff,font-size:18px');
  });

  test('text alignment is not exported to Mermaid', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        {
          id: 'n1',
          label: 'Aligned Node',
          shape: 'process',
          position: { x: 0, y: 0 },
          style: { text: { textAlign: 'right' } },
        },
      ],
      edges: [],
      textBoxes: [],
    };
    const output = toMermaid(diagram);
    expect(output).not.toContain('text-align');
    expect(output).not.toContain('align');
    // It should not generate style block for alignment alone since it is canvas-only
    expect(output).not.toContain('style n1');
  });

  test('invalid or unsafe styling properties are sanitized and ignored', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        {
          id: 'n1',
          label: 'Unsafe Node',
          shape: 'process',
          position: { x: 0, y: 0 },
          style: {
            backgroundColor: '#fff; injection: true',
            borderColor: '#000',
            text: {
              color: 'red',
              fontSize: 15,
            },
          },
        },
      ],
      edges: [],
      textBoxes: [],
    };
    const output = toMermaid(diagram);
    // #fff; injection: true has a semicolon, should be skipped
    expect(output).not.toContain('fill:#fff; injection: true');
    // But other valid styles on the same node should still be emitted
    expect(output).toContain('style n1 stroke:#000,color:red,font-size:15px');
  });

  test('Edge Direction and Style Serialization - all combinations', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'B', shape: 'process', position: { x: 100, y: 0 } }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'directed' },
        { id: 'e2', from: 'n1', to: 'n2', label: 'Label', style: 'solid', direction: 'directed' },
        { id: 'e3', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'undirected' },
        { id: 'e4', from: 'n1', to: 'n2', label: 'Label', style: 'solid', direction: 'undirected' },
        { id: 'e5', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'bidirectional' },
        { id: 'e6', from: 'n1', to: 'n2', label: 'Label', style: 'solid', direction: 'bidirectional' },
        { id: 'e7', from: 'n1', to: 'n2', label: '', style: 'dotted', direction: 'directed' },
        { id: 'e8', from: 'n1', to: 'n2', label: 'Label', style: 'dotted', direction: 'directed' },
        { id: 'e9', from: 'n1', to: 'n2', label: '', style: 'dotted', direction: 'undirected' },
        { id: 'e10', from: 'n1', to: 'n2', label: 'Label', style: 'dotted', direction: 'undirected' },
        { id: 'e11', from: 'n1', to: 'n2', label: '', style: 'dotted', direction: 'bidirectional' },
        { id: 'e12', from: 'n1', to: 'n2', label: 'Label', style: 'dotted', direction: 'bidirectional' },
        { id: 'e13', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'reverse' },
        { id: 'e14', from: 'n1', to: 'n2', label: 'Label', style: 'solid', direction: 'reverse' },
        { id: 'e15', from: 'n1', to: 'n2', label: '', style: 'dotted', direction: 'reverse' },
        { id: 'e16', from: 'n1', to: 'n2', label: 'Label', style: 'dotted', direction: 'reverse' }
      ],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1 --> n2');
    expect(output).toContain('n1 -->|"Label"| n2');
    expect(output).toContain('n1 --- n2');
    expect(output).toContain('n1 ---|"Label"| n2');
    expect(output).toContain('n1 <--> n2');
    expect(output).toContain('n1 <-->|"Label"| n2');
    expect(output).toContain('n1 -.-> n2');
    expect(output).toContain('n1 -.->|"Label"| n2');
    expect(output).toContain('n1 -.- n2');
    expect(output).toContain('n1 -.-|"Label"| n2');
    expect(output).toContain('n1 <-.-> n2');
    expect(output).toContain('n1 <-.->|"Label"| n2');
    expect(output).toContain('n1 <--- n2');
    expect(output).toContain('n1 <---|Trimmed Label| n2'.replace('Trimmed Label', '"Label"'));
    expect(output).toContain('n1 <-.- n2');
    expect(output).toContain('n1 <-.-|Trimmed Label| n2'.replace('Trimmed Label', '"Label"'));
  });

  test('Export of all new generic shapes and label escaping', () => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Bang label', shape: 'bang', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'Card : "quoted" & commas , colons :', shape: 'card', position: { x: 0, y: 100 } },
        { id: 'n3', label: 'Cloud \\ slash / braces { }', shape: 'cloud', position: { x: 0, y: 200 } }
      ],
      edges: [],
      textBoxes: []
    };
    const output = toMermaid(diagram);
    expect(output).toContain('n1@{ shape: bang, label: "Bang label" }');
    expect(output).toContain('n2@{ shape: notch-rect, label: "Card : #quot;quoted#quot; &amp; commas , colons :" }');
    expect(output).toContain('n3@{ shape: cloud, label: "Cloud \\\\ slash / braces { }" }');
  });
});
