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
      edges: []
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
      ]
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
      edges: []
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
      edges: []
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
    expect(escapeLabel('\n')).toBe('<br/>');
    
    // Combined string, evaluating character-by-character to prevent double-escaping
    expect(escapeLabel('A & B < C > D "E" #F\nG')).toBe(
      'A &amp; B &lt; C &gt; D #quot;E#quot; #35;F<br/>G'
    );
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
      ]
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
      ]
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
      edges: []
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
      ]
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

