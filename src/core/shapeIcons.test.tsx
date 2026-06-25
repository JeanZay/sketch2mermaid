// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SHAPE_DEFINITIONS } from './shapeRegistry';
import { MERMAID_GENERATED_SHAPE_ICONS } from '../assets/shape-icons/generated-icons-map';
import { ShapePaletteIcon } from '../components/ShapePaletteIcon';
import type { NodeShape } from './types';

describe('Shape Palette Icons Integration', () => {
  it('should cover every registry shape in the generated SVG map 1-to-1', () => {
    const registryKeys = SHAPE_DEFINITIONS.map(def => def.nodeShape);
    const mapKeys = Object.keys(MERMAID_GENERATED_SHAPE_ICONS) as NodeShape[];

    expect(registryKeys.length).toBe(mapKeys.length);

    for (const key of registryKeys) {
      expect(MERMAID_GENERATED_SHAPE_ICONS[key]).toBeDefined();
      expect(typeof MERMAID_GENERATED_SHAPE_ICONS[key]).toBe('string');
      expect(MERMAID_GENERATED_SHAPE_ICONS[key].length).toBeGreaterThan(0);
    }
  });

  it('renders all legacy icons successfully without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    for (const def of SHAPE_DEFINITIONS) {
      act(() => {
        root.render(<ShapePaletteIcon shapeId={def.nodeShape} mode="legacy" />);
      });
      // Check that it rendered an SVG containing children
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.children.length).toBeGreaterThan(0);
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all generated icons successfully without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    for (const def of SHAPE_DEFINITIONS) {
      act(() => {
        root.render(<ShapePaletteIcon shapeId={def.nodeShape} mode="generated" />);
      });
      // Check that it rendered the span wrapping the generated SVG
      const span = container.querySelector('.mermaid-generated-shape-icon-container');
      expect(span).not.toBeNull();
      const svg = span?.querySelector('svg');
      expect(svg).not.toBeNull();
      // Ensure text/label containers are stripped
      expect(svg?.querySelector('.label')).toBeNull();
      expect(svg?.querySelector('foreignObject')).toBeNull();
      expect(svg?.querySelector('text')).toBeNull();
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('throws an error if a missing shape is rendered in generated mode', () => {
    // Suppress console.error output during throwing test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      const container = document.createElement('div');
      const root = createRoot(container);
      act(() => {
        root.render(<ShapePaletteIcon shapeId={'nonexistent' as unknown as NodeShape} mode="generated" />);
      });
    }).toThrow();

    consoleErrorSpy.mockRestore();
  });
});
