import type { CanonicalDiagram, MermaidExportFormat, DiagramNode, EdgeStyle, EdgeDirection } from './types';

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
 * 
 * DESIGN DECISION & RENDERING PROOF:
 * Mermaid under securityLevel: 'strict' scans for the `#...;` sequence for escaping.
 * Double quotes must be escaped as `#quot;` and hashes as `#35;`.
 * Standard HTML entities like `&#35;` are corrupted because Mermaid's post-parser
 * will see the `#35;` inside `&#35;` and replace it with `#`, yielding `&#` (rendering error).
 * Hence, Mermaid-native `#quot;` and `#35;` escapes are mandatory.
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

export function getMermaidEdgeOperator(style: EdgeStyle, direction: EdgeDirection): string {
  if (style === 'dotted') {
    if (direction === 'undirected') return '-.-';
    if (direction === 'bidirectional') return '<-.->';
    return '-.->';
  }
  if (direction === 'undirected') return '---';
  if (direction === 'bidirectional') return '<-->';
  return '-->';
}

/**
 * Serializes the canonical JSON diagram model to deterministic Mermaid markup.
 * Order of nodes and edges is guaranteed to be stable (sorted by ID).
 */
export function toMermaid(diagram: CanonicalDiagram): string {
  const lines: string[] = [];
  lines.push(`flowchart ${diagram.direction}`);

  // Sort nodes by ID ascending (numerically on the numeric suffix)
  const sortedNodes = [...diagram.nodes].sort((a, b) => sortById(a.id, b.id));

  for (const node of sortedNodes) {
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

    if (node.shape === 'file' || node.shape === 'documents') {
      const shapeName = node.shape === 'file' ? 'doc' : 'docs';
      lines.push(`  ${node.id}@{ shape: ${shapeName}, label: "${finalLabel}" }`);
    } else {
      let open = '[';
      let close = ']';
      switch (node.shape) {
        case 'process':
          open = '['; close = ']'; break;
        case 'rounded':
          open = '('; close = ')'; break;
        case 'stadium':
          open = '(['; close = '])'; break;
        case 'decision':
          open = '{'; close = '}'; break;
        case 'event':
          open = '(('; close = '))'; break;
        case 'endEvent':
          open = '((('; close = ')))'; break;
        case 'database':
          open = '[('; close = ')]'; break;
        case 'subroutine':
          open = '[['; close = ']]'; break;
        case 'hexagon':
          open = '{{'; close = '}}'; break;
        case 'parallelogram':
          open = '[/'; close = '/]'; break;
        case 'parallelogramAlt':
          open = '[\\'; close = '\\' + ']'; break;
        case 'trapezoid':
          open = '[/'; close = '\\' + ']'; break;
        case 'trapezoidAlt':
          open = '[\\'; close = '/]'; break;
        case 'asymmetric':
          open = '>'; close = ']'; break;
      }
      lines.push(`  ${node.id}${open}"${finalLabel}"${close}`);
    }
  }

  // Sort edges by ID ascending (numerically on the numeric suffix)
  const sortedEdges = [...diagram.edges].sort((a, b) => sortById(a.id, b.id));

  for (const edge of sortedEdges) {
    const connector = getMermaidEdgeOperator(edge.style, edge.direction || 'directed');
    if (edge.label) {
      const escaped = escapeLabel(edge.label);
      lines.push(`  ${edge.from} ${connector}|"${escaped}"| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} ${connector} ${edge.to}`);
    }
  }

  // Append style declarations
  const styleLines: string[] = [];
  for (const node of sortedNodes) {
    const styleLine = getMermaidNodeStyleLine(node);
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


