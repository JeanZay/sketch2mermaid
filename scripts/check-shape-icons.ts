import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Define directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'src', 'assets', 'shape-icons');

// Import shape definitions, type, & generated map
import { SHAPE_DEFINITIONS } from '../src/core/shapeRegistry.js';
import type { NodeShape } from '../src/core/types.js';
import { MERMAID_GENERATED_SHAPE_ICONS } from '../src/assets/shape-icons/generated-icons-map.js';

function check() {
  console.log('Running shape icons integrity check...');
  let hasErrors = false;

  const registryShapeIds = new Set(SHAPE_DEFINITIONS.map(def => def.nodeShape));
  const mapShapeIds = new Set(Object.keys(MERMAID_GENERATED_SHAPE_ICONS));

  // 1. Check if map matches registry 1-to-1
  console.log('Verifying TypeScript map entries...');
  for (const shapeId of registryShapeIds) {
    if (!mapShapeIds.has(shapeId)) {
      console.error(`Error: Registry shape "${shapeId}" is missing from generated-icons-map.ts`);
      hasErrors = true;
    } else {
      const svgString = MERMAID_GENERATED_SHAPE_ICONS[shapeId as NodeShape];
      if (!svgString || typeof svgString !== 'string' || svgString.trim().length === 0) {
        console.error(`Error: Shape "${shapeId}" map entry is empty or invalid`);
        hasErrors = true;
      }
    }
  }

  for (const mapId of mapShapeIds) {
    if (!registryShapeIds.has(mapId as NodeShape)) {
      console.error(`Error: Generated map contains extra shape "${mapId}" not found in shapeRegistry`);
      hasErrors = true;
    }
  }

  // 2. Check individual SVG files on disk
  console.log('Verifying individual SVG files on disk...');
  if (!fs.existsSync(outputDir)) {
    console.error(`Error: Output directory "${outputDir}" does not exist`);
    process.exit(1);
  }

  const files = fs.readdirSync(outputDir);
  const svgFiles = files.filter(f => f.endsWith('.svg'));

  for (const shapeId of registryShapeIds) {
    const filename = `${shapeId}.svg`;
    const filePath = path.join(outputDir, filename);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: SVG file "${filename}" is missing from disk`);
      hasErrors = true;
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.trim().startsWith('<svg') || !content.trim().endsWith('</svg>')) {
        console.error(`Error: SVG file "${filename}" content is invalid`);
        hasErrors = true;
      }
    }
  }

  for (const filename of svgFiles) {
    const shapeName = filename.slice(0, -4);
    if (!registryShapeIds.has(shapeName as NodeShape)) {
      console.error(`Error: Extra SVG file "${filename}" found on disk (not in shapeRegistry)`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('Integrity check FAILED!');
    process.exit(1);
  } else {
    console.log('Integrity check PASSED successfully! All files and map entries are in sync.');
    process.exit(0);
  }
}

check();
