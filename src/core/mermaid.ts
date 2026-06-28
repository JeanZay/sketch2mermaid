import type { CanonicalDiagram, MermaidExportFormat, DiagramNode, EdgeStyle, EdgeDirection, ConnectedEdgeEndpoint, DiagramGroup } from './types';
import { isExportableEdge } from './types';
import { findDefinitionByShape, shapeSupportsLabel } from './shapeRegistry';
import { USE_GROUPS_AND_SWIMLANES } from './config';

/**
 * Helper to sort IDs numerically by their numeric suffix (e.g., n1, n2, n10).
 * Falls back to standard localeCompare with numeric options if no digits found.
 */
export function sortById(a: string, b: string): number {
  const matchA = a.match(/\d+/);
  const matchB = b.match(/\d+/);
  if (matchA && matchB) {
    const numA = parseInt(matchA[0], 10);
    const numB = parseInt(matchB[0], 10);
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return a.localeCompare(b, 'en', { numeric: true });
}

/**
 * Escapes special characters character-by-character to prevent double-escaping,
 * returning a secure entity string for Mermaid compatibility.
 */
export function escapeLabel(label: string): string {
  let result = '';
  for (let i = 0; i < label.length; i++) {
    const char = label[i];
    switch (char) {
      case '&': result += '&amp;'; break;
      case '<': result += '&lt;'; break;
      case '>': result += '&gt;'; break;
      case '"': result += '#quot;'; break;
      case '#': result += '#35;'; break;
      case '\\': result += '\\\\'; break;
      case '\n': result += '<br/>'; break;
      default: result += char;
    }
  }
  return result;
}

function getMermaidNodeStyleLine(node: DiagramNode): string | null {
  const parts: string[] = [];
  const style = node.style;
  if (!style) return null;

  const isValidColor = (val: string | undefined): boolean => {
    if (!val) return false;
    return /^[#a-zA-Z0-9(),.\s-]+$/.test(val);
  };

  if (isValidColor(style.backgroundColor)) {
    parts.push(`fill:${style.backgroundColor}`);
  }
  if (isValidColor(style.borderColor)) {
    parts.push(`stroke:${style.borderColor}`);
  }
  if (style.text) {
    if (isValidColor(style.text.color)) {
      parts.push(`color:${style.text.color}`);
    }
    const fontSize = style.text.fontSize;
    if (typeof fontSize === 'number' && !isNaN(fontSize) && fontSize > 0 && fontSize < 100) {
      parts.push(`font-size:${Math.round(fontSize)}px`);
    }
  }

  if (parts.length > 0) {
    return `  style ${node.id} ${parts.join(',')}`;
  }
  return null;
}

function getMermaidGroupStyleLine(group: DiagramGroup): string | null {
  const parts: string[] = [];
  const style = group.style;
  if (!style) return null;

  const isValidColor = (val: string | undefined): boolean => {
    if (!val) return false;
    return /^[#a-zA-Z0-9(),.\s-]+$/.test(val);
  };

  if (isValidColor(style.backgroundColor)) {
    parts.push(`fill:${style.backgroundColor}`);
  }
  if (isValidColor(style.borderColor)) {
    parts.push(`stroke:${style.borderColor}`);
  }
  if (style.text) {
    if (isValidColor(style.text.color)) {
      parts.push(`color:${style.text.color}`);
    }
    const fontSize = style.text.fontSize;
    if (typeof fontSize === 'number' && !isNaN(fontSize) && fontSize > 0 && fontSize < 100) {
      parts.push(`font-size:${Math.round(fontSize)}px`);
    }
  }

  if (parts.length > 0) {
    return `  style ${group.id} ${parts.join(',')}`;
  }
  return null;
}

export function getMermaidEdgeOperator(style: EdgeStyle, direction: EdgeDirection): string {
  if (style === 'dotted') {
    if (direction === 'undirected') return '-.-';
    if (direction === 'bidirectional') return '<-.->';
    if (direction === 'reverse') return '<-.-';
    return '-.->';
  }
  if (direction === 'undirected') return '---';
  if (direction === 'bidirectional') return '<-->';
  if (direction === 'reverse') return '<---';
  return '-->';
}

function renderNodeLine(node: DiagramNode, indent: string): string {
  const definition = findDefinitionByShape(node.shape);
  const shapeName = definition?.mermaidShape || 'rect';
  const supportsLabel = shapeSupportsLabel(node.shape);

  if (!supportsLabel) {
    return `${indent}${node.id}@{ shape: ${shapeName} }`;
  }

  const escaped = escapeLabel(node.label);

  let finalLabel = escaped;
  if (node.style?.text?.bold || node.style?.text?.italic) {
    let markdownLabel = escaped;
    if (node.style.text.bold && node.style.text.italic) {
      markdownLabel = `**_${escaped}_**`;
    } else if (node.style.text.bold) {
      markdownLabel = `**${escaped}**`;
    } else if (node.style.text.italic) {
      markdownLabel = `_${escaped}_`;
    }
    finalLabel = `\`${markdownLabel}\``;
  }

  if (definition?.legacySyntax) {
    const { open, close } = definition.legacySyntax;
    return `${indent}${node.id}${open}"${finalLabel}"${close}`;
  } else {
    return `${indent}${node.id}@{ shape: ${shapeName}, label: "${finalLabel}" }`;
  }
}

/**
 * Serializes the canonical JSON diagram model to deterministic Mermaid markup.
 * Order of nodes and edges is guaranteed to be stable (sorted by ID).
 */
export function toMermaid(diagram: CanonicalDiagram): string {
  const lines: string[] = [];
  lines.push(`flowchart ${diagram.direction}`);

  const sortedNodes = [...diagram.nodes].sort((a, b) => sortById(a.id, b.id));
  const activeGroups = USE_GROUPS_AND_SWIMLANES && diagram.groups && diagram.groups.length > 0
    ? [...diagram.groups].sort((a, b) => sortById(a.id, b.id))
    : [];

  const groupedNodeIds = new Set<string>();

  // 1. Output Subgraphs / Groups
  if (activeGroups.length > 0) {
    const validGroupIds = new Set(activeGroups.map(g => g.id));
    const renderedGroupIds = new Set<string>();
    
    const renderGroup = (group: DiagramGroup, indent: string) => {
      if (renderedGroupIds.has(group.id)) return;
      renderedGroupIds.add(group.id);

      lines.push(`${indent}subgraph ${group.id}["${escapeLabel(group.label)}"]`);
      if (group.direction) {
        lines.push(`${indent}  direction ${group.direction}`);
      }

      // Output nested groups
      const nestedGroups = activeGroups.filter(g => g.parentGroupId === group.id);
      for (const nested of nestedGroups) {
        renderGroup(nested, indent + '  ');
      }

      // Output contained nodes
      const groupNodes = sortedNodes.filter(n => n.parentGroupId === group.id);
      for (const node of groupNodes) {
        lines.push(renderNodeLine(node, indent + '  '));
        groupedNodeIds.add(node.id);
      }

      lines.push(`${indent}end`);
    };

    // Render top-level groups first
    const topLevelGroups = activeGroups.filter(g => !g.parentGroupId || !validGroupIds.has(g.parentGroupId));
    for (const group of topLevelGroups) {
      renderGroup(group, '  ');
    }

    // Fallback for any unrendered groups
    for (const group of activeGroups) {
      if (!renderedGroupIds.has(group.id)) {
        renderGroup(group, '  ');
      }
    }
  }

  // 2. Output remaining ungrouped nodes
  for (const node of sortedNodes) {
    if (!groupedNodeIds.has(node.id)) {
      lines.push(renderNodeLine(node, '  '));
    }
  }

  // 3. Sort edges by ID ascending and output
  const sortedEdges = [...diagram.edges]
    .filter(isExportableEdge)
    .sort((a, b) => sortById(a.id, b.id));

  for (const edge of sortedEdges) {
    const connector = getMermaidEdgeOperator(edge.style, edge.direction || 'directed');
    const fromId = typeof edge.from === 'string' ? edge.from : (edge.from as ConnectedEdgeEndpoint).nodeId;
    const toId = typeof edge.to === 'string' ? edge.to : (edge.to as ConnectedEdgeEndpoint).nodeId;
    if (edge.label) {
      const escaped = escapeLabel(edge.label);
      lines.push(`  ${fromId} ${connector}|"${escaped}"| ${toId}`);
    } else {
      lines.push(`  ${fromId} ${connector} ${toId}`);
    }
  }

  // 4. Append style declarations
  const styleLines: string[] = [];
  for (const node of sortedNodes) {
    const styleLine = getMermaidNodeStyleLine(node);
    if (styleLine) {
      styleLines.push(styleLine);
    }
  }

  for (const group of activeGroups) {
    const styleLine = getMermaidGroupStyleLine(group);
    if (styleLine) {
      styleLines.push(styleLine);
    }
  }

  if (styleLines.length > 0) {
    lines.push('');
    lines.push(...styleLines);
  }

  return lines.join('\n');
}

/**
 * Formats the Mermaid code according to the chosen export format.
 */
export function formatMermaidExport(code: string, format: MermaidExportFormat): string {
  switch (format) {
    case 'markdown':
      return `\`\`\`mermaid\n${code}\n\`\`\``;
    case 'html': {
      const indented = code
        .split('\n')
        .map((line) => (line.trim() === '' ? '' : '    ' + line))
        .join('\n');
      return `<div class="mermaid">\n${indented}\n</div>`;
    }
    case 'raw':
    default:
      return code;
  }
}


