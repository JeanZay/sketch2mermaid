import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Define directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'src', 'assets', 'shape-icons');
const mapFilePath = path.join(outputDir, 'generated-icons-map.ts');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Set up JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
  url: 'http://localhost',
});
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;

Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});

global.CSSStyleSheet = dom.window.CSSStyleSheet;

// Mock SVG getBBox
global.window.SVGElement.prototype.getBBox = function () {
  return {
    x: 0,
    y: 0,
    width: 60,
    height: 30,
    top: 0,
    left: 0,
    right: 60,
    bottom: 30,
    toJSON: () => {},
  };
};

// Import shape definitions
import { SHAPE_DEFINITIONS } from '../src/core/shapeRegistry.js';

async function generate() {
  console.log('Initializing Mermaid...');
  const { default: mermaid } = await import('mermaid');

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    flowchart: {
      htmlLabels: false, // JSDOM-safe, avoids foreignObject output
    },
  });

  const svgMap: Record<string, string> = {};

  console.log(`Starting generation of ${SHAPE_DEFINITIONS.length} shape icons...`);

  for (const def of SHAPE_DEFINITIONS) {
    const shapeId = def.nodeShape;
    console.log(`Generating icon for shape: ${shapeId} (${def.uiLabel})...`);

    // 1. Build the minimal diagram flowchart syntax
    const nodeSyntax = def.legacySyntax
      ? `A${def.legacySyntax.open}" "${def.legacySyntax.close}`
      : `A@{ shape: ${def.mermaidShape}, label: " " }`;
    const code = `flowchart TD\n  ${nodeSyntax}`;

    // 2. Render diagram SVG using Mermaid
    let svg = '';
    try {
      const renderResult = await mermaid.render(`s2m-shape-${shapeId}`, code);
      svg = renderResult.svg;
    } catch (renderError) {
      console.error(`Mermaid render failed for shape ${shapeId}:`, renderError);
      process.exit(1);
    }

    // 3. Parse SVG in DOM for post-processing
    const doc = new dom.window.DOMParser().parseFromString(svg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      console.error(`Could not parse generated SVG for shape ${shapeId}`);
      process.exit(1);
    }

    // 4. Remove unwanted blocks
    // Remove style blocks
    svgEl.querySelectorAll('style').forEach(el => el.remove());

    // Safely remove unused defs, keeping referenced ones
    const defsTags = svgEl.querySelectorAll('defs');
    defsTags.forEach(defsTag => {
      const children = Array.from(defsTag.children);
      children.forEach(child => {
        const id = child.getAttribute('id');
        if (id) {
          // Check if ID is referenced elsewhere in the SVG markup
          const isReferenced = svg.includes(`url(#${id})`) || svg.includes(`url('#${id}')`) || svg.includes(`href="#${id}"`);
          if (!isReferenced) {
            child.remove();
          }
        }
      });
      if (defsTag.children.length === 0) {
        defsTag.remove();
      }
    });

    // 5. Clean up the .node container group
    const nodeEl = svgEl.querySelector('.node');
    if (!nodeEl) {
      console.error(`No .node element found in rendered SVG for shape ${shapeId}`);
      process.exit(1);
    }
    nodeEl.removeAttribute('id');

    // Remove text/label containers
    nodeEl.querySelectorAll('.label, foreignObject, text').forEach(el => el.remove());

    // Post-process the shape geometry tags
    const shapes = nodeEl.querySelectorAll('path, polygon, rect, circle, ellipse, line, polyline');
    const isSolid = shapeId === 'junction' || shapeId === 'forkJoin';

    shapes.forEach(el => {
      if (isSolid) {
        // Set solid fills and strip stroke
        el.removeAttribute('style');
        el.removeAttribute('class');
        el.removeAttribute('stroke-dasharray');
        el.setAttribute('fill', 'currentColor');
        el.setAttribute('stroke', 'none');
      } else {
        const stroke = el.getAttribute('stroke');
        const strokeWidth = el.getAttribute('stroke-width');

        if (stroke === 'none' || strokeWidth === '0') {
          // Strip duplicate background fill shape
          el.remove();
        } else {
          // Map to standard outline style
          el.removeAttribute('style');
          el.removeAttribute('class');
          el.removeAttribute('stroke-dasharray');
          el.setAttribute('stroke', 'currentColor');
          el.setAttribute('fill', 'none');
          el.setAttribute('stroke-width', '2');
          el.setAttribute('vector-effect', 'non-scaling-stroke');
        }
      }
    });

    // 6. Serialize processed SVG back to string
    const xmlSerializer = new dom.window.XMLSerializer();
    const cleanSvg = xmlSerializer.serializeToString(svgEl);

    // Save individual SVG file (named after shape.id)
    const svgPath = path.join(outputDir, `${shapeId}.svg`);
    fs.writeFileSync(svgPath, cleanSvg, 'utf-8');

    // Add to map dictionary
    svgMap[shapeId] = cleanSvg;
  }

  // 7. Write the TypeScript map file containing all SVG strings
  console.log('Writing TypeScript map file...');
  const mapFileContent = [
    '// This file is auto-generated by scripts/generate-shape-icons.ts.',
    '// Do not edit this file manually.',
    '',
    `import type { NodeShape } from '../../core/types';`,
    '',
    'export const MERMAID_GENERATED_SHAPE_ICONS: Record<NodeShape, string> = {',
    ...Object.entries(svgMap).map(([key, val]) => `  ${key}: ${JSON.stringify(val)},`),
    '};',
    '',
  ].join('\n');

  fs.writeFileSync(mapFilePath, mapFileContent, 'utf-8');
  console.log('Generation completed successfully!');
}

generate().catch(err => {
  console.error('Unhandled generation error:', err);
  process.exit(1);
});
