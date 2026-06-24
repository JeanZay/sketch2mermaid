import type { CanonicalDiagram, DiagramNode, DiagramEdge, NodeShape, EdgeStyle, EdgeDirection, DiagramDirection, NodeStyle } from './types';
import { NODE_SIZE_DEFAULTS } from './nodeSizeConfig';
import { layoutImportedDiagram } from './layout/mermaidLayout';

export type MermaidImportWarningType =
  | 'unsupportedDiagramType'
  | 'unsupportedShape'
  | 'unsupportedEdge'
  | 'unsupportedDirective'
  | 'unsupportedStyle'
  | 'unsupportedClass'
  | 'unsupportedSubgraph'
  | 'lineSkipped'
  | 'labelSanitized'
  | 'duplicateId'
  | 'ampersandSkipped';

export interface MermaidImportWarning {
  type: MermaidImportWarningType;
  line?: number;
  message: string;
  raw?: string;
}

export interface MermaidImportResult {
  diagram: CanonicalDiagram;
  warnings: MermaidImportWarning[];
}

interface ParsedNode {
  id: string;
  shape?: NodeShape;
  label?: string;
  style?: NodeStyle;
  line?: number;
}

interface ParsedEdge {
  from: string;
  to: string;
  style: EdgeStyle;
  direction?: EdgeDirection;
  label: string;
  unsupported: boolean;
  rawOperator: string;
  line?: number;
}

// Helpers for unescaping & sanitization
function sanitizeAndUnescapeLabel(rawLabel: string): { label: string; sanitized: boolean; bold?: boolean; italic?: boolean } {
  let label = rawLabel;
  let bold = false;
  let italic = false;

  // Check backtick markdown wrappers (e.g. `**bold**`, `_italic_`, `**_bolditalic_**`)
  if (label.startsWith('`') && label.endsWith('`')) {
    label = label.slice(1, -1);
    
    // We try to unwrap bold-italic, bold, or italic
    // Case 1: **_text_** or __*text*__
    const boldItalicMatch = label.match(/^(\*\*|__)([*_])(.*)\2\1$/) || label.match(/^([*_])(\*\*|__)(.*)\2\1$/);
    if (boldItalicMatch) {
      bold = true;
      italic = true;
      label = boldItalicMatch[3];
    } else {
      // Case 2: **text** or __text__
      const boldMatch = label.match(/^(\*\*|__)(.*)\1$/);
      if (boldMatch) {
        bold = true;
        label = boldMatch[2];
      } else {
        // Case 3: *text* or _text_
        const italicMatch = label.match(/^([*_])(.*)\1$/);
        if (italicMatch) {
          italic = true;
          label = italicMatch[2];
        }
      }
    }
  }

  const beforeUnescape = label;
  
  // Unescape standard Mermaid/HTML entities
  label = label.replace(/&amp;/g, '&');
  label = label.replace(/&lt;/g, '<');
  label = label.replace(/&gt;/g, '>');
  label = label.replace(/#quot;/g, '"');
  label = label.replace(/&quot;/g, '"');
  label = label.replace(/#35;/g, '#');
  label = label.replace(/\\\\/g, '\\');
  label = label.replace(/<br\s*\/?>/gi, '\n');

  if (label.startsWith('"') && label.endsWith('"')) {
    label = label.slice(1, -1);
  }

  const sanitized = (label !== rawLabel) || (label !== beforeUnescape);

  return { label, sanitized, bold, italic };
}

// Helper to check if a line contains unquoted ampersands outside of node labels/shapes or edge labels
function hasUnquotedAmpersand(s: string): boolean {
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  let inBackticks = false;
  let bracketDepth = 0;
  let inPipe = false;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];

    // Handle escape char inside quotes
    if (char === '\\' && (inDoubleQuotes || inSingleQuotes || inBackticks) && i + 1 < s.length) {
      i++;
      continue;
    }

    if (inDoubleQuotes) {
      if (char === '"') inDoubleQuotes = false;
    } else if (inSingleQuotes) {
      if (char === "'") inSingleQuotes = false;
    } else if (inBackticks) {
      if (char === '`') inBackticks = false;
    } else {
      // Not in any quotes
      if (char === '"') {
        inDoubleQuotes = true;
      } else if (char === "'") {
        inSingleQuotes = true;
      } else if (char === '`') {
        inBackticks = true;
      } else if (char === '[' || char === '(' || char === '{') {
        bracketDepth++;
      } else if (char === ']' || char === ')' || char === '}') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (char === '|' && bracketDepth === 0) {
        inPipe = !inPipe;
      } else if (char === '&') {
        if (bracketDepth === 0 && !inPipe) {
          return true;
        }
      }
    }
  }
  return false;
}

// Helper to check for standard non-flowchart headers
const NON_FLOWCHART_TYPES = [
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'gantt',
  'journey',
  'stateDiagram-v2',
  'stateDiagram',
  'mindmap',
  'timeline',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
];

export function importMermaidFlowchart(code: string): MermaidImportResult {
  // Phase 1 - Size and Empty Checks
  if (code.length > 100 * 1024) {
    throw new Error('Le diagramme dépasse la taille maximale (100 KB).');
  }

  if (!code || code.trim() === '') {
    throw new Error('Le diagramme est vide.');
  }

  const warnings: MermaidImportWarning[] = [];
  const lines = code.split(/\r?\n/);
  
  // Track original 1-indexed lines
  let lineObjects = lines.map((text, idx) => ({ text, index: idx + 1 }));

  // Strip YAML Frontmatter
  const firstNonEmptyIdx = lineObjects.findIndex(line => line.text.trim() !== '');
  if (firstNonEmptyIdx !== -1 && lineObjects[firstNonEmptyIdx].text.trim() === '---') {
    const closingIdx = lineObjects.findIndex((line, idx) => idx > firstNonEmptyIdx && line.text.trim() === '---');
    if (closingIdx !== -1) {
      lineObjects = lineObjects.slice(closingIdx + 1);
    }
  }

  // Identify Header & Direction
  let direction: DiagramDirection = 'TD';
  let headerFound = false;

  for (let i = 0; i < lineObjects.length; i++) {
    const lineObj = lineObjects[i];
    const trimmed = lineObj.text.trim();

    if (trimmed === '' || trimmed.startsWith('%%')) {
      // Check if this is an init directive
      if (trimmed.startsWith('%%{') && trimmed.includes('init')) {
        warnings.push({
          type: 'unsupportedDirective',
          line: lineObj.index,
          message: `Directive d'initialisation ignorée: "${trimmed}"`,
          raw: trimmed,
        });
      }
      continue;
    }

    // Check if it's a non-flowchart diagram type first
    const cleanWord = trimmed.split(/[\s(]/)[0];
    if (NON_FLOWCHART_TYPES.includes(cleanWord)) {
      throw new Error('Only Mermaid flowcharts are supported for import in this version.');
    }

    // Match flowchart/graph header
    // Allow graph TD, flowchart LR, etc.
    const headerMatch = trimmed.match(/^\s*(graph|flowchart)\s+(TD|TB|LR|BT|RL)\s*$/i);
    if (headerMatch) {
      headerFound = true;
      const dir = headerMatch[2].toUpperCase();
      if (dir === 'TB') {
        direction = 'TD';
      } else {
        direction = dir as DiagramDirection;
      }
      // Remove header line from parsing loop
      lineObjects = lineObjects.slice(i + 1);
      break;
    } else {
      // If we hit any non-empty non-comment line before a valid header, or it's just invalid
      throw new Error('Only Mermaid flowcharts are supported for import in this version.');
    }
  }

  if (!headerFound) {
    throw new Error('Only Mermaid flowcharts are supported for import in this version.');
  }

  // Intermediate parsing structures
  const parsedNodes: ParsedNode[] = [];
  const parsedEdges: ParsedEdge[] = [];
  
  const subgraphStack: string[] = [];

  // Phase 2 - Line-by-line Parsing
  for (const lineObj of lineObjects) {
    const text = lineObj.text.trim();
    if (text === '' || text.startsWith('%%')) {
      if (text.startsWith('%%{') && text.includes('init')) {
        warnings.push({
          type: 'unsupportedDirective',
          line: lineObj.index,
          message: `Directive d'initialisation ignorée: "${text}"`,
          raw: text,
        });
      }
      continue;
    }


    // Subgraph match
    const subgraphMatch = text.match(/^subgraph\b\s*(.*)$/i);
    if (subgraphMatch) {
      subgraphStack.push(subgraphMatch[1] || 'subgraph');
      warnings.push({
        type: 'unsupportedSubgraph',
        line: lineObj.index,
        message: `Le regroupement visuel des sous-graphes n'est pas supporté. Son contenu sera importé à plat.`,
        raw: text,
      });
      continue;
    }

    // End match (only closes subgraph if stack is not empty)
    if (text.toLowerCase() === 'end' && subgraphStack.length > 0) {
      subgraphStack.pop();
      continue;
    }

    // ClassDef & Class ignore
    if (text.startsWith('classDef ') || text.startsWith('class ')) {
      warnings.push({
        type: 'unsupportedClass',
        line: lineObj.index,
        message: `Déclaration de classe ignorée: "${text}"`,
        raw: text,
      });
      continue;
    }

    // Click ignore
    if (text.startsWith('click ')) {
      // Ignored silently for security
      continue;
    }

    // Style parsing (best effort)
    if (text.startsWith('style ')) {
      const parts = text.substring(6).trim().split(/\s+/);
      const nodeId = parts[0];
      const stylePayload = parts.slice(1).join(' ');
      
      const nodeStyle: NodeStyle = {};
      let hasStyles = false;
      let hasUnsupportedStyles = false;

      // Extract styles like fill:#fff,stroke:#333
      const stylePairs = stylePayload.split(/[\s,]+/);
      for (const pair of stylePairs) {
        if (!pair) continue;
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
          hasStyles = true;
          if (key === 'fill') {
            nodeStyle.backgroundColor = value;
          } else if (key === 'stroke') {
            nodeStyle.borderColor = value;
          } else if (key === 'color') {
            nodeStyle.text = { ...nodeStyle.text, color: value };
          } else if (key === 'font-size') {
            const num = parseInt(value, 10);
            if (!isNaN(num)) {
              nodeStyle.text = { ...nodeStyle.text, fontSize: num };
            }
          } else if (key === 'font-weight' && value === 'bold') {
            nodeStyle.text = { ...nodeStyle.text, bold: true };
          } else {
            hasUnsupportedStyles = true;
          }
        }
      }

      if (hasStyles) {
        parsedNodes.push({
          id: nodeId,
          style: nodeStyle,
          line: lineObj.index,
        });
      }
      
      if (hasUnsupportedStyles || !hasStyles) {
        warnings.push({
          type: 'unsupportedStyle',
          line: lineObj.index,
          message: `Styles partiellement non supportés sur "${nodeId}": "${stylePayload}"`,
          raw: text,
        });
      }
      continue;
    }

    // Parse general node and edge chains
    const chainElements = parseChain(text, lineObj.index, warnings);

    // Verify structure of the chain: must alternate nodeGroup and edge, starting and ending with nodeGroup
    let isValidChain = true;
    if (!chainElements || chainElements.length === 0) {
      isValidChain = false;
    } else if (chainElements.length % 2 === 0) {
      isValidChain = false;
    } else {
      for (let j = 0; j < chainElements.length; j++) {
        const isNodeIndex = j % 2 === 0;
        const item = chainElements[j];
        if (isNodeIndex && item.kind !== 'nodeGroup') {
          isValidChain = false;
          break;
        }
        if (!isNodeIndex && item.kind !== 'edge') {
          isValidChain = false;
          break;
        }
      }
    }

    if (!isValidChain) {
      if (hasUnquotedAmpersand(text)) {
        warnings.push({
          type: 'ampersandSkipped',
          line: lineObj.index,
          message: `Ligne ignorée car la syntaxe d'arête multiple '&' est malformée ou non supportée.`,
          raw: text,
        });
      } else {
        warnings.push({
          type: 'lineSkipped',
          line: lineObj.index,
          message: `Ligne ignorée car la structure de chaîne de diagramme est invalide.`,
          raw: text,
        });
      }
      continue;
    }

    // Add nodes and edges from valid chain
    for (let j = 0; j < chainElements.length; j++) {
      if (j % 2 === 0) {
        const nodeGroup = (chainElements[j] as { kind: 'nodeGroup'; nodes: ParsedNode[] }).nodes;
        for (const node of nodeGroup) {
          parsedNodes.push(node);
        }
      } else {
        const edgeTemplate = (chainElements[j] as { kind: 'edge'; edge: ParsedEdge }).edge;
        const sourceGroup = (chainElements[j - 1] as { kind: 'nodeGroup'; nodes: ParsedNode[] }).nodes;
        const targetGroup = (chainElements[j + 1] as { kind: 'nodeGroup'; nodes: ParsedNode[] }).nodes;

        // Expand edges: sourceGroup x targetGroup
        for (const srcNode of sourceGroup) {
          for (const tgtNode of targetGroup) {
            parsedEdges.push({
              ...edgeTemplate,
              from: srcNode.id,
              to: tgtNode.id,
            });
          }
        }
      }
    }
  }

  // Phase 3 - Post-processing & Overwrite resolution (Last wins)
  const nodesMap = new Map<string, DiagramNode & { isExplicit: boolean }>();
  const orderOfAppearance: string[] = [];

  for (const pNode of parsedNodes) {
    const { id, shape, label, style } = pNode;
    
    // Unescape & sanitize label if provided
    let finalLabel = label;
    let nodeStylePatch: NodeStyle | undefined = style;
    
    if (label !== undefined) {
      const res = sanitizeAndUnescapeLabel(label);
      finalLabel = res.label;
      if (res.sanitized) {
        warnings.push({
          type: 'labelSanitized',
          line: pNode.line,
          message: `Libellé du nœud "${id}" nettoyé/décodé.`,
          raw: label,
        });
      }
      if (res.bold || res.italic) {
        nodeStylePatch = {
          ...nodeStylePatch,
          text: {
            ...nodeStylePatch?.text,
            bold: res.bold || nodeStylePatch?.text?.bold,
            italic: res.italic || nodeStylePatch?.text?.italic,
          }
        };
      }
    }

    const isExplicitDefinition = (shape !== undefined || label !== undefined);

    if (nodesMap.has(id)) {
      const existing = nodesMap.get(id)!;
      if (isExplicitDefinition) {
        if (existing.isExplicit) {
          warnings.push({
            type: 'duplicateId',
            line: pNode.line,
            message: `Identifiant de nœud doublon "${id}". La dernière définition explicite écrase les précédentes.`,
            raw: id,
          });
        }
        
        // Overwrite properties
        existing.shape = shape || 'process';
        existing.label = finalLabel !== undefined ? finalLabel : id;
        existing.isExplicit = true;
      }
      
      // Merge styles
      if (nodeStylePatch) {
        existing.style = {
          ...existing.style,
          ...nodeStylePatch,
          text: {
            ...existing.style?.text,
            ...nodeStylePatch.text,
          }
        };
      }
    } else {
      orderOfAppearance.push(id);
      nodesMap.set(id, {
        id,
        label: finalLabel !== undefined ? finalLabel : id,
        shape: shape || 'process',
        position: { x: 0, y: 0 },
        isExplicit: isExplicitDefinition,
        style: nodeStylePatch,
      });
    }
  }

  // Create implicit nodes that are referenced in edges but never explicitly defined
  for (const edge of parsedEdges) {
    if (!nodesMap.has(edge.from)) {
      orderOfAppearance.push(edge.from);
      nodesMap.set(edge.from, {
        id: edge.from,
        label: edge.from,
        shape: 'process',
        position: { x: 0, y: 0 },
        isExplicit: false,
      });
    }
    if (!nodesMap.has(edge.to)) {
      orderOfAppearance.push(edge.to);
      nodesMap.set(edge.to, {
        id: edge.to,
        label: edge.to,
        shape: 'process',
        position: { x: 0, y: 0 },
        isExplicit: false,
      });
    }
  }

  // Map final DiagramNodes and assign default sizes
  const finalNodes: DiagramNode[] = Array.from(nodesMap.values()).map(node => {
    const size = NODE_SIZE_DEFAULTS[node.shape] || NODE_SIZE_DEFAULTS.process;
    return {
      id: node.id,
      label: node.label,
      shape: node.shape,
      position: node.position,
      width: size.width,
      height: size.height,
      style: node.style,
    };
  });

  // Convert parsed edges to final DiagramEdges
  let edgeCounter = 1;
  const finalEdges: DiagramEdge[] = [];
  const warnedUnsupportedEdges = new Set<string>();
  const seenEdges = new Set<string>();

  for (const edge of parsedEdges) {
    if (edge.unsupported) {
      const warnKey = `${edge.line}_${edge.rawOperator}`;
      if (!warnedUnsupportedEdges.has(warnKey)) {
        warnedUnsupportedEdges.add(warnKey);
        warnings.push({
          type: 'unsupportedEdge',
          line: edge.line,
          message: `L'opérateur d'arête "${edge.rawOperator}" n'est pas supporté. Remplacé par une arête standard.`,
          raw: edge.rawOperator,
        });
      }
    }

    let finalEdgeLabel = edge.label;
    if (edge.label) {
      const res = sanitizeAndUnescapeLabel(edge.label);
      finalEdgeLabel = res.label;
      if (res.sanitized) {
        warnings.push({
          type: 'labelSanitized',
          line: edge.line,
          message: `Libellé de la liaison de "${edge.from}" vers "${edge.to}" nettoyé.`,
          raw: edge.label,
        });
      }
    }

    const edgeKey = `${edge.from}->${edge.to}||${finalEdgeLabel}||${edge.style}||${edge.direction || 'directed'}`;
    if (seenEdges.has(edgeKey)) {
      continue;
    }
    seenEdges.add(edgeKey);

    finalEdges.push({
      id: `e${edgeCounter++}`,
      from: {
        kind: 'connected',
        nodeId: edge.from,
        handleId: null,
      },
      to: {
        kind: 'connected',
        nodeId: edge.to,
        handleId: null,
      },
      connectionStatus: 'connected',
      exportMode: 'mermaid',
      label: finalEdgeLabel,
      style: edge.style,
      direction: edge.direction || 'directed',
    });
  }

  // Layout Computation — Dagre (same engine as Mermaid.js)
  const layoutResult = layoutImportedDiagram(finalNodes, finalEdges, direction, orderOfAppearance);

  // Apply positions
  for (const node of finalNodes) {
    const pos = layoutResult.positions.get(node.id);
    if (pos) {
      node.position = pos;
    }
  }

  // Apply handles per edge (geometric, based on post-layout positions)
  // and apply Dagre's calculated label position if available.
  for (const edge of finalEdges) {
    const handlePair = layoutResult.handles.get(edge.id);
    if (handlePair) {
      edge.sourceHandle = handlePair.sourceHandle;
      edge.targetHandle = handlePair.targetHandle;
    }
  }

  // Deduplicate warnings by: type + line + raw + message
  const uniqueWarnings: MermaidImportWarning[] = [];
  const seenWarnings = new Set<string>();
  for (const w of warnings) {
    const key = `${w.type}:${w.line ?? ''}:${w.raw ?? ''}:${w.message}`;
    if (!seenWarnings.has(key)) {
      seenWarnings.add(key);
      uniqueWarnings.push(w);
    }
  }

  const diagram: CanonicalDiagram = {
    schemaVersion: 1,
    diagramType: 'flowchart',
    direction,
    nodes: finalNodes,
    edges: finalEdges,
    textBoxes: [],
  };

  return { diagram, warnings: uniqueWarnings };
}

// Phase 2 details: parses a single line for a chain of nodes and edges
type ParsedChainElement =
  | { kind: 'nodeGroup'; nodes: ParsedNode[] }
  | { kind: 'edge'; edge: ParsedEdge };

function scanNodeGroup(
  s: string,
  start: number,
  lineIndex: number,
  warnings: MermaidImportWarning[]
): { nodes: ParsedNode[]; nextIndex: number } | null {
  let idx = start;
  const nodes: ParsedNode[] = [];

  const firstNodeRes = scanNodeRef(s, idx, lineIndex, warnings);
  if (!firstNodeRes) return null;
  nodes.push(firstNodeRes.node);
  idx = firstNodeRes.nextIndex;

  while (idx < s.length) {
    let wsIdx = idx;
    while (wsIdx < s.length && /\s/.test(s[wsIdx])) wsIdx++;

    if (wsIdx < s.length && s[wsIdx] === '&') {
      idx = wsIdx + 1;
      while (idx < s.length && /\s/.test(s[idx])) idx++;

      const nextNodeRes = scanNodeRef(s, idx, lineIndex, warnings);
      if (!nextNodeRes) return null;
      nodes.push(nextNodeRes.node);
      idx = nextNodeRes.nextIndex;
    } else {
      break;
    }
  }

  return { nodes, nextIndex: idx };
}

function parseChain(lineText: string, lineIndex: number, warnings: MermaidImportWarning[]): ParsedChainElement[] | null {
  const result: ParsedChainElement[] = [];
  let i = 0;
  const s = lineText.trim();
  if (!s) return null;

  while (i < s.length) {
    // Skip whitespace
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    // 1. Scan Node Group
    const nodeRes = scanNodeGroup(s, i, lineIndex, warnings);
    if (!nodeRes) {
      return null; // parse failure
    }
    result.push({ kind: 'nodeGroup', nodes: nodeRes.nodes });
    i = nodeRes.nextIndex;

    // Skip whitespace
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    // 2. Scan Edge Reference
    const edgeRes = scanEdgeRef(s, i);
    if (!edgeRes) {
      return null;
    }
    edgeRes.edge.line = lineIndex;
    result.push({ kind: 'edge', edge: edgeRes.edge });
    i = edgeRes.nextIndex;
  }

  return result;
}

// Character-by-character scanner for node definitions
interface ClassicBracketConfig {
  open: string;
  close: string;
  shape: NodeShape;
}

const CLASSIC_BRACKETS: ClassicBracketConfig[] = [
  { open: '(((', close: ')))', shape: 'endEvent' },
  { open: '((', close: '))', shape: 'event' },
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[(', close: ')]', shape: 'database' },
  { open: '[[', close: ']]', shape: 'subroutine' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[/', close: '/]', shape: 'parallelogram' }, // parallelogram can also match [/ ... \] as trapezoid
  { open: '[\\', close: '\\\\]', shape: 'parallelogramAlt' }, // parallelogramAlt can also match [\ ... /] as trapezoidAlt
  { open: '[', close: ']', shape: 'process' },
  { open: '(', close: ')', shape: 'rounded' },
  { open: '{', close: '}', shape: 'decision' },
  { open: '>', close: ']', shape: 'asymmetric' },
];

function scanNodeRef(s: string, start: number, lineIndex: number, warnings: MermaidImportWarning[]): { node: ParsedNode; nextIndex: number } | null {
  let idx = start;
  
  // Consume ID: alphanumeric, underscore, hyphen, dot
  let id = '';
  while (idx < s.length && /[a-zA-Z0-9_.-]/.test(s[idx])) {
    id += s[idx];
    idx++;
  }

  if (!id) return null;

  // Skip spacing
  while (idx < s.length && /\s/.test(s[idx])) idx++;

  // Check 11.3+ shape syntax: @{ shape: hex, label: "Text" }
  if (idx < s.length - 1 && s[idx] === '@' && s[idx + 1] === '{') {
    idx += 2; // skip @{
    let payload = '';
    while (idx < s.length && s[idx] !== '}') {
      payload += s[idx];
      idx++;
    }
    if (idx < s.length && s[idx] === '}') {
      idx++; // skip }
    } else {
      return null; // unclosed @{}
    }

    // Parse shape: \w+
    const shapeMatch = payload.match(/shape\s*:\s*([a-zA-Z0-9_-]+)/);
    const labelMatch = payload.match(/label\s*:\s*"([^"]*)"/);

    const mShape = shapeMatch ? shapeMatch[1] : 'rect';
    const label = labelMatch ? labelMatch[1] : undefined;

    // Map 11.3+ shape
    let shape: NodeShape;
    let isUnsupported = false;

    switch (mShape) {
      case 'rect': shape = 'process'; break;
      case 'rounded': shape = 'rounded'; break;
      case 'stadium': shape = 'stadium'; break;
      case 'diamond': shape = 'decision'; break;
      case 'circle': shape = 'event'; break;
      case 'dbl-circ': shape = 'endEvent'; break;
      case 'cyl': shape = 'database'; break;
      case 'doc': shape = 'file'; break;
      case 'docs': shape = 'documents'; break;
      case 'subproc': shape = 'subroutine'; break;
      case 'hex': shape = 'hexagon'; break;
      case 'lean-r': shape = 'parallelogram'; break;
      case 'lean-l': shape = 'parallelogramAlt'; break;
      case 'trap-b': shape = 'trapezoid'; break;
      case 'trap-t': shape = 'trapezoidAlt'; break;
      default:
        shape = 'process';
        isUnsupported = true;
        break;
    }

    if (isUnsupported) {
      warnings.push({
        type: 'unsupportedShape',
        line: lineIndex,
        message: `Forme non supportée "${mShape}" sur le nœud "${id}". Remplacée par "process".`,
        raw: mShape,
      });
    }

    return {
      node: { id, shape, label, line: lineIndex },
      nextIndex: idx
    };
  }

  // Check classic shapes
  for (const config of CLASSIC_BRACKETS) {
    const openLen = config.open.length;
    if (s.substring(idx, idx + openLen) === config.open) {
      idx += openLen;

      // Scan label content
      let label = '';
      let labelSanityCheckIndex = idx;
      
      // If label starts with quote
      if (s[labelSanityCheckIndex] === '"') {
        labelSanityCheckIndex++;
        while (labelSanityCheckIndex < s.length && s[labelSanityCheckIndex] !== '"') {
          if (s[labelSanityCheckIndex] === '\\' && s[labelSanityCheckIndex + 1] === '"') {
            label += '"';
            labelSanityCheckIndex += 2;
          } else {
            label += s[labelSanityCheckIndex];
            labelSanityCheckIndex++;
          }
        }
        if (s[labelSanityCheckIndex] === '"') {
          labelSanityCheckIndex++;
        }
        idx = labelSanityCheckIndex;
      } else {
        // Unquoted: scan until closing bracket sequence
        // We need to look ahead for the exact closing sequence
        // For trapezoids, the closing sequences might differ
        let actualClose = config.close;
        if (config.open === '[/') {
          // Check if ending with \] or /]
          const slashEnd = s.indexOf('/]', idx);
          const backslashEnd = s.indexOf('\\]', idx);
          if (slashEnd !== -1 && (backslashEnd === -1 || slashEnd < backslashEnd)) {
            actualClose = '/]';
          } else if (backslashEnd !== -1) {
            actualClose = '\\]';
          }
        } else if (config.open === '[\\') {
          const slashEnd = s.indexOf('/]', idx);
          const backslashEnd = s.indexOf('\\]', idx);
          if (backslashEnd !== -1 && (slashEnd === -1 || backslashEnd < slashEnd)) {
            actualClose = '\\]';
          } else if (slashEnd !== -1) {
            actualClose = '/]';
          }
        }

        const closeIdx = s.indexOf(actualClose, idx);
        if (closeIdx === -1) {
          return null; // unclosed bracket
        }
        label = s.substring(idx, closeIdx);
        idx = closeIdx;
      }

      // Check closing bracket match
      let actualClose = config.close;
      let finalShape = config.shape;

      if (config.open === '[/') {
        if (s.substring(idx, idx + 2) === '/]') {
          actualClose = '/]';
          finalShape = 'parallelogram';
        } else if (s.substring(idx, idx + 2) === '\\]') {
          actualClose = '\\]';
          finalShape = 'trapezoid';
        }
      } else if (config.open === '[\\') {
        if (s.substring(idx, idx + 2) === '\\]') {
          actualClose = '\\]';
          finalShape = 'parallelogramAlt';
        } else if (s.substring(idx, idx + 2) === '/]') {
          actualClose = '/]';
          finalShape = 'trapezoidAlt';
        }
      }

      if (s.substring(idx, idx + actualClose.length) !== actualClose) {
        return null; // mismatch
      }

      idx += actualClose.length;

      return {
        node: { id, shape: finalShape, label, line: lineIndex },
        nextIndex: idx
      };
    }
  }

  // Node reference without shape definition
  return {
    node: { id, line: lineIndex },
    nextIndex: idx
  };
}

// Character-by-character scanner for edges
function scanEdgeRef(s: string, start: number): { edge: ParsedEdge; nextIndex: number } | null {
  const idx = start;

  const matchPrefix = (prefix: string): boolean => {
    return s.substring(idx, idx + prefix.length) === prefix;
  };

  // 1. Dotted arrow with inline label: -. label .->
  if (matchPrefix('-.') && idx + 2 < s.length && s[idx + 2] !== '-' && s[idx + 2] !== '>') {
    const startLabel = idx + 2;
    let labelStartIdx = startLabel;
    while (labelStartIdx < s.length && /\s/.test(s[labelStartIdx])) labelStartIdx++;
    const endIdx = s.indexOf('.->', labelStartIdx);
    if (endIdx !== -1) {
      const label = s.substring(labelStartIdx, endIdx).trim();
      return {
        edge: {
          from: '',
          to: '',
          style: 'dotted',
          direction: 'directed',
          label,
          unsupported: false,
          rawOperator: `-. ${label} .->`
        },
        nextIndex: endIdx + 3
      };
    }
  }

  // 2. Thick arrow with inline label: == label ==>
  if (matchPrefix('==') && idx + 2 < s.length && s[idx + 2] !== '>' && s[idx + 2] !== '=') {
    const startLabel = idx + 2;
    let labelStartIdx = startLabel;
    while (labelStartIdx < s.length && /\s/.test(s[labelStartIdx])) labelStartIdx++;
    const endIdx = s.indexOf('==>', labelStartIdx);
    if (endIdx !== -1) {
      const label = s.substring(labelStartIdx, endIdx).trim();
      return {
        edge: {
          from: '',
          to: '',
          style: 'solid',
          direction: 'directed',
          label,
          unsupported: true,
          rawOperator: `== ${label} ==>`
        },
        nextIndex: endIdx + 3
      };
    }
  }

  // 3. Solid arrow with inline label: -- label -->
  if (matchPrefix('--') && idx + 2 < s.length && s[idx + 2] !== '-' && s[idx + 2] !== '>') {
    const startLabel = idx + 2;
    let labelStartIdx = startLabel;
    while (labelStartIdx < s.length && /\s/.test(s[labelStartIdx])) labelStartIdx++;
    const endIdx = s.indexOf('-->', labelStartIdx);
    if (endIdx !== -1) {
      const label = s.substring(labelStartIdx, endIdx).trim();
      return {
        edge: {
          from: '',
          to: '',
          style: 'solid',
          direction: 'directed',
          label,
          unsupported: false,
          rawOperator: `-- ${label} -->`
        },
        nextIndex: endIdx + 3
      };
    }
  }

  // 4. Simple Operators (with optional pipe labels)
  const simpleOperators: { op: string; style: EdgeStyle; direction: EdgeDirection; unsupported: boolean }[] = [
    { op: '<-.->', style: 'dotted', direction: 'bidirectional', unsupported: false },
    { op: '-.->', style: 'dotted', direction: 'directed', unsupported: false },
    { op: '-.-', style: 'dotted', direction: 'undirected', unsupported: false },
    { op: '<-->', style: 'solid', direction: 'bidirectional', unsupported: false },
    { op: '==>', style: 'solid', direction: 'directed', unsupported: true },
    { op: '===', style: 'solid', direction: 'directed', unsupported: true },
    { op: '-->', style: 'solid', direction: 'directed', unsupported: false },
    { op: '---', style: 'solid', direction: 'undirected', unsupported: false },
  ];

  for (const item of simpleOperators) {
    if (matchPrefix(item.op)) {
      let label = '';
      let nextIndex = idx + item.op.length;
      let rawOperator = item.op;

      if (nextIndex < s.length && s[nextIndex] === '|') {
        const startPipe = nextIndex + 1;
        const endPipe = s.indexOf('|', startPipe);
        if (endPipe !== -1) {
          label = s.substring(startPipe, endPipe);
          nextIndex = endPipe + 1;
          rawOperator = `${item.op}|${label}|`;
        }
      }

      return {
        edge: {
          from: '',
          to: '',
          style: item.style,
          direction: item.direction,
          label,
          unsupported: item.unsupported,
          rawOperator
        },
        nextIndex
      };
    }
  }

  return null;
}

