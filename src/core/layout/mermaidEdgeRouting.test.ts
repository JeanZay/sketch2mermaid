import { describe, expect, it } from 'vitest';
import { importMermaidFlowchart } from '../mermaidImport';
import { generateImportedEdgePath } from '../../utils/importedEdgeRouting';
import { SCORE_CONCURRENTIEL_MERMAID_FIXTURE } from './fixtures/scoreConcurrentiel';

describe('Mermaid imported edge geometry regression', () => {
  it('preserves distinct Dagre routes for nodes converging on Score concurrentiel', () => {
    const { diagram } = importMermaidFlowchart(SCORE_CONCURRENTIEL_MERMAID_FIXTURE);
    const score = diagram.nodes.find((node) => node.label === 'Score concurrentiel');
    expect(score).toBeDefined();

    const incoming = diagram.edges.filter(
      (edge) => edge.to.kind === 'connected' && edge.to.nodeId === score?.id,
    );
    expect(incoming).toHaveLength(4);
    expect(incoming.every((edge) => edge.data?.points && edge.data.points.length >= 3)).toBe(true);
    expect(incoming.every((edge) => edge.data?.curve === 'basis')).toBe(true);

    const targetIntersections = incoming.map((edge) => edge.data!.points.at(-1)!);
    expect(new Set(targetIntersections.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)).size)
      .toBeGreaterThan(1);

    const renderedPaths = incoming.map((edge) => generateImportedEdgePath(edge.data!.points, edge.data!.curve));
    expect(new Set(renderedPaths).size).toBe(incoming.length);
  });

  it('preserves Dagre edge label coordinates on imported edge data', () => {
    const { diagram } = importMermaidFlowchart(`flowchart LR
      A[Alpha] -->|weighted| B[Beta]`);
    const edge = diagram.edges[0];

    expect(edge.data?.labelPosition?.x).toEqual(expect.any(Number));
    expect(edge.data?.labelPosition?.y).toEqual(expect.any(Number));
  });

  it('honors a supported Mermaid flowchart curve setting', () => {
    const { diagram } = importMermaidFlowchart(`%%{init: {"flowchart": {"curve": "linear"}}}%%
      flowchart TD
      A --> B`);

    expect(diagram.edges[0].data?.curve).toBe('linear');
  });
});
