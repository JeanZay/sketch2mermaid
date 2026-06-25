import { describe, it, expect } from 'vitest';
import { SHAPE_DEFINITIONS, findDefinitionByShape, findDefinitionByMermaidName, LEGACY_NODE_SHAPES, SHAPE_CATEGORIES, getShapeCapabilities, shapeSupportsLabel, isFixedSizeShape, getShapeFixedSize } from './shapeRegistry';
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

  it('should resolve paper-tape to paperTape (not flag)', () => {
    const def = findDefinitionByMermaidName('paper-tape');
    expect(def?.nodeShape).toBe('paperTape');
    expect(def?.mermaidShape).toBe('paper-tape');

    // Verify 'flag' does NOT resolve to paperTape
    const flagDef = findDefinitionByMermaidName('flag');
    expect(flagDef).toBeUndefined();
  });

  it('should have no alias that collides with another definition canonical name', () => {
    const canonicalNames = new Map<string, string>();
    for (const def of SHAPE_DEFINITIONS) {
      canonicalNames.set(def.mermaidShape.toLowerCase(), def.nodeShape);
    }

    for (const def of SHAPE_DEFINITIONS) {
      for (const alias of def.mermaidAliases) {
        const normalizedAlias = alias.toLowerCase();
        if (canonicalNames.has(normalizedAlias)) {
          // An alias matching a canonical name is only valid if it points to the same shape
          expect(canonicalNames.get(normalizedAlias)).toBe(def.nodeShape);
        }
      }
    }
  });

  it('LEGACY_NODE_SHAPES should match exactly the shapes with legacySyntax', () => {
    const expected = SHAPE_DEFINITIONS
      .filter((d) => d.legacySyntax)
      .map((d) => d.nodeShape);
    expect(LEGACY_NODE_SHAPES.size).toBe(expected.length);
    for (const shape of expected) {
      expect(LEGACY_NODE_SHAPES.has(shape)).toBe(true);
    }
    // Spot-check known legacy shapes
    expect(LEGACY_NODE_SHAPES.has('process')).toBe(true);
    expect(LEGACY_NODE_SHAPES.has('decision')).toBe(true);
    expect(LEGACY_NODE_SHAPES.has('database')).toBe(true);
    // Spot-check known non-legacy shapes
    expect(LEGACY_NODE_SHAPES.has('cloud')).toBe(false);
    expect(LEGACY_NODE_SHAPES.has('paperTape')).toBe(false);
  });

  it('SHAPE_CATEGORIES should cover all categories in SHAPE_DEFINITIONS', () => {
    const categoryKeys = new Set(SHAPE_CATEGORIES.map((c) => c.key));
    for (const def of SHAPE_DEFINITIONS) {
      expect(categoryKeys.has(def.category)).toBe(true);
    }
    // Every category should have at least one shape
    for (const cat of SHAPE_CATEGORIES) {
      const shapes = SHAPE_DEFINITIONS.filter((d) => d.category === cat.key);
      expect(shapes.length).toBeGreaterThan(0);
    }
  });

  it('should map comment shapes and their aliases correctly', () => {
    // Comment / Left Brace
    const braceDef = findDefinitionByMermaidName('brace');
    const commentDef = findDefinitionByMermaidName('comment');
    const braceLDef = findDefinitionByMermaidName('brace-l');
    
    expect(braceDef?.nodeShape).toBe('comment');
    expect(commentDef?.nodeShape).toBe('comment');
    expect(braceLDef?.nodeShape).toBe('comment');

    // Comment Right / Right Brace
    const braceRDef = findDefinitionByMermaidName('brace-r');
    const commentRightDef = findDefinitionByMermaidName('comment right');
    const commentRightHyphenDef = findDefinitionByMermaidName('comment-right');
    
    expect(braceRDef?.nodeShape).toBe('commentRight');
    expect(commentRightDef?.nodeShape).toBe('commentRight');
    expect(commentRightHyphenDef?.nodeShape).toBe('commentRight');

    // Comment Both / Braces
    const bracesDef = findDefinitionByMermaidName('braces');
    const commentBothDef = findDefinitionByMermaidName('comment both');
    const commentBothHyphenDef = findDefinitionByMermaidName('comment-both');

    expect(bracesDef?.nodeShape).toBe('commentBoth');
    expect(commentBothDef?.nodeShape).toBe('commentBoth');
    expect(commentBothHyphenDef?.nodeShape).toBe('commentBoth');
  });

  describe('Shape Capabilities', () => {
    it('should configure junction as label-less and fixed-size 14x14', () => {
      const caps = getShapeCapabilities('junction');
      expect(caps.supportsLabel).toBe(false);
      expect(caps.sizingMode).toBe('fixed');
      expect(caps.fixedSize).toEqual({ width: 14, height: 14 });
      expect(shapeSupportsLabel('junction')).toBe(false);
      expect(isFixedSizeShape('junction')).toBe(true);
      expect(getShapeFixedSize('junction')).toEqual({ width: 14, height: 14 });
    });

    it('should configure forkJoin as label-less and fixed-size 70x8', () => {
      const caps = getShapeCapabilities('forkJoin');
      expect(caps.supportsLabel).toBe(false);
      expect(caps.sizingMode).toBe('fixed');
      expect(caps.fixedSize).toEqual({ width: 70, height: 8 });
      expect(shapeSupportsLabel('forkJoin')).toBe(false);
      expect(isFixedSizeShape('forkJoin')).toBe(true);
      expect(getShapeFixedSize('forkJoin')).toEqual({ width: 70, height: 8 });
    });

    it('should configure process (normal shape) as label-supporting and content-sized', () => {
      const caps = getShapeCapabilities('process');
      expect(caps.supportsLabel).toBe(true);
      expect(caps.sizingMode).toBe('content');
      expect(caps.fixedSize).toBeUndefined();
      expect(shapeSupportsLabel('process')).toBe(true);
      expect(isFixedSizeShape('process')).toBe(false);
      expect(getShapeFixedSize('process')).toBeUndefined();
    });
  });
});
