import { describe, it, expect } from 'vitest';
import { SHAPE_DEFINITIONS, findDefinitionByShape, findDefinitionByMermaidName } from './shapeRegistry';
import type { NodeShape } from './types';

describe('Centralized Shape Registry', () => {
  it('should have exactly one definition for every NodeShape value', () => {
    // Assert all 46 shapes exist in the registry
    const allShapes: NodeShape[] = [
      'process', 'rounded', 'stadium', 'decision', 'event', 'endEvent', 'database', 'file',
      'subroutine', 'hexagon', 'parallelogram', 'parallelogramAlt', 'trapezoid', 'trapezoidAlt',
      'asymmetric', 'documents', 'bang', 'card', 'cloud', 'collate', 'comLink', 'comment',
      'commentRight', 'commentBoth', 'dataStore', 'delay', 'directAccessStorage', 'diskStorage',
      'display', 'dividedProcess', 'extract', 'forkJoin', 'internalStorage', 'junction',
      'linedDocument', 'loopLimit', 'manualFile', 'manualInput', 'multiProcess', 'paperTape',
      'storedData', 'summary', 'taggedDocument', 'taggedProcess', 'textBlock', 'odd'
    ];

    expect(SHAPE_DEFINITIONS.length).toBe(allShapes.length);

    for (const shape of allShapes) {
      const def = findDefinitionByShape(shape);
      expect(def).toBeDefined();
      expect(def?.nodeShape).toBe(shape);
    }
  });

  it('should have unique canonical Mermaid shape names', () => {
    const names = new Set<string>();
    for (const def of SHAPE_DEFINITIONS) {
      expect(names.has(def.mermaidShape)).toBe(false);
      names.add(def.mermaidShape);
    }
  });

  it('should resolve definitions by Mermaid shape name or alias correctly', () => {
    // Canonical name resolution
    const notchRectDef = findDefinitionByMermaidName('notch-rect');
    expect(notchRectDef?.nodeShape).toBe('card');

    // Alias resolution
    const cardAliasDef = findDefinitionByMermaidName('card');
    expect(cardAliasDef?.nodeShape).toBe('card');

    const documentAliasDef = findDefinitionByMermaidName('document');
    expect(documentAliasDef?.nodeShape).toBe('file');

    const databaseAliasDef = findDefinitionByMermaidName('database');
    expect(databaseAliasDef?.nodeShape).toBe('database');

    // Case insensitivity & spacing tolerance
    const uppercaseDef = findDefinitionByMermaidName(' NOTCH-rect ');
    expect(uppercaseDef?.nodeShape).toBe('card');
  });

  it('should return undefined for unknown Mermaid shape names', () => {
    const unknown = findDefinitionByMermaidName('nonexistent-shape');
    expect(unknown).toBeUndefined();
  });
});
