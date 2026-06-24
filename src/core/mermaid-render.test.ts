// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import mermaid from 'mermaid';

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

describe('Mermaid empirical SVG rendering verification under strict security', () => {
  // Scenario 1: Using Mermaid style escapes (#quot; and #35;)
  test('Renders correct glyphes using Mermaid #...; escapes', async () => {
    const code = [
      'flowchart TD',
      '  n1["Décision : #quot;valider#quot; (oui/non) ? #35;1 &lt;x&gt; &amp; co"]'
    ].join('\n');

    const renderId = 'mermaid-test-1';
    
    // We render the diagram to a container
    const { svg } = await mermaid.render(renderId, code);
    
    // Parse the SVG using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    
    // In Mermaid flowcharts, labels are rendered in SVG <text> elements or inside <foreignObject>
    // Let's get the text content of the node n1
    const textElements = doc.querySelectorAll('.node text, .node tspan, .node .nodeLabel');
    expect(textElements.length).toBeGreaterThan(0);
    
    // Join the texts
    const textContent = Array.from(textElements).map(el => el.textContent).join(' ');
    console.log('Mermaid escape result textContent:', textContent);
    
    // Assert that the rendered SVG text contains the correct character symbols, not entities
    // Wait: let's test if it contains the literal characters:
    // "valider", #1, <x>, &
    expect(textContent).toContain('"valider"');
    expect(textContent).toContain('#1');
    expect(textContent).toContain('<x>');
    expect(textContent).toContain('& co');
  });

  // Scenario 2: Using HTML style entities (&quot; and &#35;)
  test('Renders correct glyphes using standard HTML &...; entities', async () => {
    const code = [
      'flowchart TD',
      '  n2["Décision : &quot;valider&quot; (oui/non) ? &#35;1 &lt;x&gt; &amp; co"]'
    ].join('\n');

    const renderId = 'mermaid-test-2';
    
    // We render the diagram
    const { svg } = await mermaid.render(renderId, code);
    
    // Parse the SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    
    const textElements = doc.querySelectorAll('.node text, .node tspan, .node .nodeLabel');
    expect(textElements.length).toBeGreaterThan(0);
    
    const textContent = Array.from(textElements).map(el => el.textContent).join(' ');
    console.log('HTML entities result textContent:', textContent);
    
    // Check if it renders as literal glyphs
    expect(textContent).toContain('"valider"');
    expect(textContent).toContain('#1');
    expect(textContent).toContain('<x>');
    expect(textContent).toContain('& co');
  });

  // Test the 6 shapes SVG generation
  test.each([
    { shape: 'process', syntax: 'n["Label"]', expectedTag: 'rect' },
    { shape: 'rounded', syntax: 'n("Label")', expectedTag: 'rect' },
    { shape: 'stadium', syntax: 'n(["Label"])', expectedTag: 'rect' },
    { shape: 'decision', syntax: 'n{"Label"}', expectedTag: 'polygon' },
    { shape: 'event', syntax: 'n(("Label"))', expectedTag: 'circle' },
    { shape: 'endEvent', syntax: 'n((("Label")))', expectedTag: 'circle' },
  ])('Shape $shape renders the expected SVG element ($expectedTag)', async ({ syntax, expectedTag }) => {
    const code = `flowchart TD\n  ${syntax}`;
    const renderId = `shape-test-${Math.floor(Math.random() * 100000)}`;
    const { svg } = await mermaid.render(renderId, code);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    
    const element = doc.querySelector(`.node ${expectedTag}`);
    expect(element).not.toBeNull();
  });

  test('Compilation of Database and File shapes to non-empty SVG', async () => {
    const code = [
      'flowchart TD',
      '  db[(Base de données)]',
      '  file@{ shape: doc, label: "Fichier" }'
    ].join('\n');
    
    const renderId = `shapes-compile-test-${Math.floor(Math.random() * 100000)}`;
    const { svg } = await mermaid.render(renderId, code);
    
    expect(svg).toBeDefined();
    expect(svg.length).toBeGreaterThan(0);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    
    // Ensure there is no parsing/compilation error indicated in the SVG
    const errorNode = doc.querySelector('.error-icon, .error-text, #error-div');
    expect(errorNode).toBeNull();
  });

  test('Compilation of 8 new shapes to non-empty SVG', async () => {
    const code = [
      'flowchart TD',
      '  sub[["Subroutine"]]',
      '  hex{{"Hexagon"}}',
      '  para[/"Parallelogram"/]',
      '  paraAlt[\\"Parallelogram Alt"\\]',
      '  trap[/"Trapezoid"\\]',
      '  trapAlt[\\"Trapezoid Alt"/]',
      '  asym>"Asymmetric"]',
      '  docs@{ shape: docs, label: "Documents" }'
    ].join('\n');
    
    const renderId = `new-shapes-compile-test-${Math.floor(Math.random() * 100000)}`;
    const { svg } = await mermaid.render(renderId, code);
    
    expect(svg).toBeDefined();
    expect(svg.length).toBeGreaterThan(0);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    
    const errorNode = doc.querySelector('.error-icon, .error-text, #error-div');
    expect(errorNode).toBeNull();
  });

  test('Compilation of solid/dotted reverse edges with/without labels', async () => {
    const code = [
      'flowchart TD',
      '  A <--- B',
      '  C <---|Label 1| D',
      '  E <-.- F',
      '  G <-.-|Label 2| H',
    ].join('\n');
    
    const renderId = `reverse-edges-compile-test-${Math.floor(Math.random() * 100000)}`;
    const { svg } = await mermaid.render(renderId, code);
    
    expect(svg).toBeDefined();
    expect(svg.length).toBeGreaterThan(0);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    
    const errorNode = doc.querySelector('.error-icon, .error-text, #error-div');
    expect(errorNode).toBeNull();
  });
});



