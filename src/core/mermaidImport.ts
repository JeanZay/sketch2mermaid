import type { CanonicalDiagram, DiagramNode, DiagramEdge, NodeShape, EdgeStyle, EdgeDirection, DiagramDirection, NodeStyle, DiagramGroup, ImportedEdgeCurve } from './types';
import { NODE_SIZE_DEFAULTS, estimateNodeSize } from './nodeSizeConfig';
import { findDefinitionByMermaidName, getShapeCapabilities } from './shapeRegistry';
import { layoutImportedDiagram, selectHandlesDirectionAware } from './layout/mermaidLayout';
import { DEBUG_MERMAID_IMPORT_LAYOUT, USE_MERMAID_LIKE_IMPORTED_LAYOUT } from './config';
import { rebaseImportedEdgeData } from '../utils/importedEdgeRouting';
import mermaid from 'mermaid';

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

export interface LayoutOracleDiagnostics {
  asyncImportUsed?: boolean;
  oracleAttempted: boolean;
  mermaidRenderSucceeded?: boolean;
  renderSucceeded: boolean;
  svgMounted?: boolean;
  svgNodeElementsFound?: number;
  svgNodesMatchedToInternalIds?: number;
  svgNodesUnmatched?: string[];
  internalNodesWithoutSvgMatch?: string[];
  oraclePositionsExtracted?: number;
  oracleDimensionsExtracted?: number;
  oraclePositionsApplied?: number;
  oracleDimensionsApplied?: number;
  nodesExtracted: number;
  positionsApplied: number;
  finalNodeCount?: number;
  finalEdgeCount?: number;
  svgRect?: { x: number; y: number; width: number; height: number };
  svgViewBox?: { x: number; y: number; width: number; height: number };
  cssToViewBoxScale?: { x: number; y: number };
  nodeComparisons?: LayoutOracleNodeComparison[];
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface LayoutOracleNodeComparison {
  nodeId: string;
  dagreX: number;
  dagreY: number;
  dagreW: number;
  dagreH: number;
  oracleX?: number;
  oracleY?: number;
  oracleW?: number;
  oracleH?: number;
  finalX: number;
  finalY: number;
  finalW: number;
  finalH: number;
  matchedBy?: string;
}

declare global {
  interface Window {
    __S2M_DEBUG_MERMAID_IMPORT_LAYOUT__?: boolean;
    __S2M_LAST_MERMAID_IMPORT_DIAGNOSTICS__?: LayoutOracleDiagnostics;
  }
}

export interface MermaidImportResult {
  diagram: CanonicalDiagram;
  warnings: MermaidImportWarning[];
  diagnostics?: LayoutOracleDiagnostics;
}

export interface MermaidLayoutRefinementResult {
  diagram: CanonicalDiagram;
  diagnostics: LayoutOracleDiagnostics;
}

interface ParsedNode {
  id: string;
  shape?: NodeShape;
  label?: string;
  style?: NodeStyle;
  line?: number;
  parentGroupId?: string;
}

function getConfiguredImportedEdgeCurve(code: string): ImportedEdgeCurve {
  const match = code.match(/["']?curve["']?\s*:\s*["']?(basis|linear|natural|rounded)["']?/i);
  const curve = match?.[1]?.toLowerCase();
  return curve === 'linear' || curve === 'natural' || curve === 'rounded' ? curve : 'basis';
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

function parseSubgraphHeader(rest: string, generatedCount: number): { id: string; label: string } {
  const trimmed = rest.trim();
  if (trimmed === '') {
    return { id: `g_imported_${generatedCount}`, label: `Group ${generatedCount}` };
  }

  // Quoted label only, e.g. subgraph "My Group"
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const label = trimmed.slice(1, -1);
    return { id: `g_imported_${generatedCount}`, label };
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const label = trimmed.slice(1, -1);
    return { id: `g_imported_${generatedCount}`, label };
  }

  // Check for id["Label"] or id[Label] or id("Label") or id(Label)
  // E.g. lane_sales["Sales"] or Finance
  const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*(?:\[|\(|{)\s*["']?(.*?)["']?\s*(?:\]|\)|})\s*$/);
  if (match) {
    const id = match[1];
    const label = match[2];
    return { id, label };
  }

  // Just a single word, e.g. subgraph Sales
  // Use it for both ID and label
  return { id: trimmed, label: trimmed };
}

export function importMermaidFlowchart(code: string): MermaidImportResult {
  // Phase 1 - Size and Empty Checks
  if (code.length > 100 * 1024) {
    throw new Error('Le diagramme dépasse la taille maximale (100 KB).');
  }

  if (!code || code.trim() === '') {
    throw new Error('Le diagramme est vide.');
  }

  const warnings: MermaidImportWarning[] = [];
  const importedEdgeCurve = getConfiguredImportedEdgeCurve(code);
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
  
  const importedGroups: DiagramGroup[] = [];
  const subgraphStack: DiagramGroup[] = [];
  let generatedGroupCount = 1;

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
      const rest = subgraphMatch[1] || '';
      const parsed = parseSubgraphHeader(rest, generatedGroupCount++);
      
      const parentGroupId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1].id : undefined;
      
      if (subgraphStack.length > 0) {
        warnings.push({
          type: 'unsupportedSubgraph',
          line: lineObj.index,
          message: `Sketch2Mermaid préserve la hiérarchie des sous-graphes imbriqués dans le modèle, mais leur rendu visuel sur le canvas peut être simplifié.`,
          raw: text,
        });
      }

      const newGroup: DiagramGroup = {
        id: parsed.id,
        kind: 'subgraph',
        label: parsed.label,
        parentGroupId,
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
      };

      // Ensure group ID is unique
      let finalId = newGroup.id;
      let suffix = 1;
      while (importedGroups.some((g) => g.id === finalId)) {
        finalId = `${newGroup.id}_dup_${suffix++}`;
      }
      newGroup.id = finalId;

      importedGroups.push(newGroup);
      subgraphStack.push(newGroup);
      continue;
    }

    // End match (only closes subgraph if stack is not empty)
    if (text.toLowerCase() === 'end' && subgraphStack.length > 0) {
      subgraphStack.pop();
      continue;
    }

    const activeGroupId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1].id : undefined;

    // Direction match inside a subgraph
    const dirMatch = text.match(/^(?:direction|dir)\s+(TD|TB|LR|BT|RL)$/i);
    if (dirMatch && activeGroupId) {
      const groupInList = importedGroups.find((g) => g.id === activeGroupId);
      if (groupInList) {
        let dir = dirMatch[1].toUpperCase();
        if (dir === 'TB') dir = 'TD';
        groupInList.direction = dir as ('TB' | 'TD' | 'BT' | 'LR' | 'RL');
      }
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
          parentGroupId: activeGroupId,
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
          node.parentGroupId = activeGroupId;
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
      
      if (pNode.parentGroupId !== undefined) {
        existing.parentGroupId = pNode.parentGroupId;
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
        parentGroupId: pNode.parentGroupId,
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

  // Map final DiagramNodes and assign sizes.
  // Mermaid derives node dimensions from the rendered label plus padding;
  // we approximate that deterministically with estimateNodeSize so layout
  // spacing tracks label length like Mermaid Live. Fixed-size shapes keep
  // their registry-defined dimensions.
  const finalNodes: DiagramNode[] = Array.from(nodesMap.values()).map(node => {
    const capabilities = getShapeCapabilities(node.shape);
    const isFixed = capabilities.sizingMode === 'fixed' && capabilities.fixedSize;
    const size = isFixed ? capabilities.fixedSize! : estimateNodeSize(node.shape, node.label);
    return {
      id: node.id,
      label: node.label,
      shape: node.shape,
      position: node.position,
      width: size.width,
      height: size.height,
      style: node.style,
      parentGroupId: node.parentGroupId,
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
  const layoutResult = layoutImportedDiagram(finalNodes, finalEdges, direction, orderOfAppearance, importedGroups);

  // Apply positions
  for (const node of finalNodes) {
    const pos = layoutResult.positions.get(node.id);
    if (pos) {
      node.position = pos;
    }
  }

  // Apply positions and sizes to groups
  for (const group of importedGroups) {
    const pos = layoutResult.groupPositions?.get(group.id);
    if (pos) {
      group.position = pos;
    }
    const size = layoutResult.groupSizes?.get(group.id);
    if (size) {
      group.width = size.width;
      group.height = size.height;
    }
  }

  // Apply compatibility handles plus Dagre's canonical routed geometry.
  for (const edge of finalEdges) {
    const handlePair = layoutResult.handles.get(edge.id);
    if (handlePair) {
      edge.sourceHandle = handlePair.sourceHandle;
      edge.targetHandle = handlePair.targetHandle;
      if (USE_MERMAID_LIKE_IMPORTED_LAYOUT) {
        if (edge.from.kind === 'connected') {
          edge.from.handleId = handlePair.sourceHandle;
        }
        if (edge.to.kind === 'connected') {
          edge.to.handleId = handlePair.targetHandle;
        }
      }
    }
    const route = layoutResult.edgeRoutes?.get(edge.id);
    if (route) edge.data = { ...route, curve: importedEdgeCurve };
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
    diagramType: 'flowchart',
    direction,
    nodes: finalNodes,
    edges: finalEdges,
    textBoxes: [],
    groups: importedGroups,
  };

  return { diagram, warnings: uniqueWarnings };
}

function getNodeElementMatch(el: Element, nodeId: string, renderId: string): string | null {
  if (el.getAttribute('data-id') === nodeId) {
    return 'data-id';
  }
  const idAttr = el.getAttribute('id');
  if (!idAttr) return null;

  // Mermaid v10/v11 pattern: ${renderId}-flowchart-${nodeId}-${index}
  // Because nodeId could contain special characters, prefix match + numeric suffix is very reliable.
  const prefix = `${renderId}-flowchart-${nodeId}-`;
  if (idAttr.startsWith(prefix)) {
    const suffix = idAttr.substring(prefix.length);
    return /^\d+$/.test(suffix) ? 'id-prefix-flowchart' : null;
  }

  // Fallback pattern without flowchart class suffix: ${renderId}-${nodeId}-${index}
  const fallbackPrefix = `${renderId}-${nodeId}-`;
  if (idAttr.startsWith(fallbackPrefix)) {
    const suffix = idAttr.substring(fallbackPrefix.length);
    return /^\d+$/.test(suffix) ? 'id-prefix' : null;
  }

  return null;
}

function matchNodeElement(el: Element, nodeId: string, renderId: string): boolean {
  return getNodeElementMatch(el, nodeId, renderId) !== null;
}

function rectToPlain(rect: DOMRect | { x?: number; y?: number; left?: number; top?: number; width: number; height: number }) {
  return {
    x: Math.round((rect.x ?? rect.left ?? 0) * 100) / 100,
    y: Math.round((rect.y ?? rect.top ?? 0) * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
  };
}

function getSvgViewBox(svgElement: SVGSVGElement, svgRect: DOMRect) {
  const base = svgElement.viewBox?.baseVal;
  if (base && base.width > 0 && base.height > 0) {
    return {
      x: base.x,
      y: base.y,
      width: base.width,
      height: base.height,
    };
  }

  const attr = svgElement.getAttribute('viewBox');
  if (attr) {
    const parts = attr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  return {
    x: 0,
    y: 0,
    width: svgRect.width,
    height: svgRect.height,
  };
}

function clientRectToSvgViewBoxRect(
  rect: DOMRect,
  svgRect: DOMRect,
  svgViewBox: { x: number; y: number; width: number; height: number },
) {
  if (svgRect.width <= 0 || svgRect.height <= 0 || svgViewBox.width <= 0 || svgViewBox.height <= 0) {
    return {
      x: rect.left - svgRect.left,
      y: rect.top - svgRect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  const scaleX = svgViewBox.width / svgRect.width;
  const scaleY = svgViewBox.height / svgRect.height;

  return {
    x: svgViewBox.x + (rect.left - svgRect.left) * scaleX,
    y: svgViewBox.y + (rect.top - svgRect.top) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

function shouldDebugMermaidImportLayout(): boolean {
  if (DEBUG_MERMAID_IMPORT_LAYOUT) return true;
  if (typeof window === 'undefined') return false;
  if (window.__S2M_DEBUG_MERMAID_IMPORT_LAYOUT__) return true;
  if (window.location?.search.includes('debugMermaidImportLayout=1')) return true;
  try {
    return window.localStorage?.getItem('S2M_DEBUG_MERMAID_IMPORT_LAYOUT') === '1';
  } catch {
    return false;
  }
}

function publishLayoutDiagnostics(diagnostics: LayoutOracleDiagnostics) {
  if (typeof window !== 'undefined') {
    try {
      window.__S2M_LAST_MERMAID_IMPORT_DIAGNOSTICS__ = diagnostics;
    } catch {
      // Some browser automation sandboxes expose a non-extensible Window proxy.
    }
  }

  if (!shouldDebugMermaidImportLayout()) {
    return;
  }

  console.groupCollapsed('[Mermaid Import Layout Diagnostics]');
  console.log('[Mermaid Import Layout Diagnostics JSON]', JSON.stringify(diagnostics, null, 2));
  if (diagnostics.nodeComparisons?.length) {
    console.table(diagnostics.nodeComparisons);
  }
  console.groupEnd();
}

/**
 * Refines an already-laid-out canonical diagram with node bounds measured from
 * Mermaid's rendered SVG. The function never reparses or replaces canonical
 * entities: only node geometry, connected-edge handles, and transient routes
 * are updated. When SVG measurement is unavailable, the input Dagre geometry
 * is returned unchanged with fallback diagnostics.
 */
export async function refineMermaidLayoutWithSvg(
  code: string,
  diagram: CanonicalDiagram,
  options: { asyncImportUsed?: boolean } = {},
): Promise<MermaidLayoutRefinementResult> {
  const dagreBaseline = new Map(
    diagram.nodes.map((node) => [
      node.id,
      {
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? NODE_SIZE_DEFAULTS[node.shape]?.width ?? NODE_SIZE_DEFAULTS.process.width,
        height: node.height ?? NODE_SIZE_DEFAULTS[node.shape]?.height ?? NODE_SIZE_DEFAULTS.process.height,
      },
    ])
  );
  const proposedPositions = new Map<string, { position: { x: number; y: number }; width: number; height: number; matchedBy: string }>();

  const diagnostics: LayoutOracleDiagnostics = {
    asyncImportUsed: options.asyncImportUsed ?? false,
    oracleAttempted: false,
    mermaidRenderSucceeded: false,
    renderSucceeded: false,
    svgMounted: false,
    svgNodeElementsFound: 0,
    svgNodesMatchedToInternalIds: 0,
    svgNodesUnmatched: [],
    internalNodesWithoutSvgMatch: [],
    oraclePositionsExtracted: 0,
    oracleDimensionsExtracted: 0,
    oraclePositionsApplied: 0,
    oracleDimensionsApplied: 0,
    nodesExtracted: 0,
    positionsApplied: 0,
    finalNodeCount: diagram.nodes.length,
    finalEdgeCount: diagram.edges.length,
    nodeComparisons: [],
    fallbackUsed: false,
  };

  const finalize = () => {
    diagnostics.finalNodeCount = diagram.nodes.length;
    diagnostics.finalEdgeCount = diagram.edges.length;
    diagnostics.nodeComparisons = diagram.nodes.map((node) => {
      const baseline = dagreBaseline.get(node.id);
      const oracle = proposedPositions.get(node.id);
      return {
        nodeId: node.id,
        dagreX: baseline?.x ?? 0,
        dagreY: baseline?.y ?? 0,
        dagreW: baseline?.width ?? 0,
        dagreH: baseline?.height ?? 0,
        oracleX: oracle?.position.x,
        oracleY: oracle?.position.y,
        oracleW: oracle?.width,
        oracleH: oracle?.height,
        finalX: node.position.x,
        finalY: node.position.y,
        finalW: node.width ?? NODE_SIZE_DEFAULTS[node.shape]?.width ?? NODE_SIZE_DEFAULTS.process.width,
        finalH: node.height ?? NODE_SIZE_DEFAULTS[node.shape]?.height ?? NODE_SIZE_DEFAULTS.process.height,
        matchedBy: oracle?.matchedBy,
      };
    });
    publishLayoutDiagnostics(diagnostics);
    return { diagram, diagnostics };
  };

  // 2. Oracle Layout pass (only works in browser context)
  if (typeof window === 'undefined' || diagram.nodes.length === 0) {
    diagnostics.fallbackUsed = true;
    diagnostics.fallbackReason = typeof window === 'undefined'
      ? 'Non-browser context (window is undefined)'
      : 'Diagram has no nodes';
    return finalize();
  }

  diagnostics.oracleAttempted = true;

  try {
    // Unique ID for the render cycle
    const renderId = `mermaid-oracle-${Math.floor(Math.random() * 100000)}`;

    // Render the flowchart using Mermaid.js
    const { svg } = await mermaid.render(renderId, code);
    if (!svg) {
      diagnostics.fallbackUsed = true;
      diagnostics.fallbackReason = 'Mermaid render returned empty SVG';
      return finalize();
    }

    diagnostics.mermaidRenderSucceeded = true;
    diagnostics.renderSucceeded = true;

    // Mount SVG to offscreen container for client measurements
    const container = document.createElement('div');
    container.style.visibility = 'hidden';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.innerHTML = svg;
    document.body.appendChild(container);
    diagnostics.svgMounted = true;

    try {
      const svgElement = container.querySelector('svg');
      if (!svgElement) {
        diagnostics.fallbackUsed = true;
        diagnostics.fallbackReason = 'Could not find svg element in rendered container';
        return finalize();
      }

      const svgRect = svgElement.getBoundingClientRect();
      const svgViewBox = getSvgViewBox(svgElement as SVGSVGElement, svgRect);
      diagnostics.svgRect = rectToPlain(svgRect);
      diagnostics.svgViewBox = {
        x: Math.round(svgViewBox.x * 100) / 100,
        y: Math.round(svgViewBox.y * 100) / 100,
        width: Math.round(svgViewBox.width * 100) / 100,
        height: Math.round(svgViewBox.height * 100) / 100,
      };
      diagnostics.cssToViewBoxScale = {
        x: svgRect.width > 0 ? Math.round((svgViewBox.width / svgRect.width) * 1000) / 1000 : 0,
        y: svgRect.height > 0 ? Math.round((svgViewBox.height / svgRect.height) * 1000) / 1000 : 0,
      };

      // Extract positions and bounding boxes for each node
      const allNodeGroups = Array.from(svgElement.querySelectorAll('.node'));
      diagnostics.nodesExtracted = allNodeGroups.length;
      diagnostics.svgNodeElementsFound = allNodeGroups.length;

      let hasValidDimensions = false;
      let dimensionsExtracted = 0;

      for (const node of diagram.nodes) {
        const matched = allNodeGroups
          .map((el) => ({ el, matchedBy: getNodeElementMatch(el, node.id, renderId) }))
          .find((candidate) => candidate.matchedBy);
        const nodeElement = matched?.el as SVGGraphicsElement | null;

        if (nodeElement) {
          const nodeRect = nodeElement.getBoundingClientRect();
          const nodeSvgRect = clientRectToSvgViewBoxRect(nodeRect, svgRect, svgViewBox);
          const x = nodeSvgRect.x;
          const y = nodeSvgRect.y;
          const width = nodeSvgRect.width;
          const height = nodeSvgRect.height;

          if (width > 0 && height > 0) {
            hasValidDimensions = true;
            dimensionsExtracted++;
          }

          proposedPositions.set(node.id, {
            position: { x: Math.round(x), y: Math.round(y) },
            width: Math.round(width),
            height: Math.round(height),
            matchedBy: matched?.matchedBy ?? 'unknown',
          });
          diagnostics.positionsApplied++;
        }
      }
      diagnostics.svgNodesMatchedToInternalIds = proposedPositions.size;
      diagnostics.oraclePositionsExtracted = proposedPositions.size;
      diagnostics.oracleDimensionsExtracted = dimensionsExtracted;
      diagnostics.internalNodesWithoutSvgMatch = diagram.nodes
        .filter((node) => !proposedPositions.has(node.id))
        .map((node) => node.id);
      diagnostics.svgNodesUnmatched = allNodeGroups
        .filter((el) => !diagram.nodes.some((node) => matchNodeElement(el, node.id, renderId)))
        .map((el) => el.getAttribute('data-id') || el.getAttribute('id') || (el.textContent || '').trim().slice(0, 80));

      // Apply the oracle atomically: every canonical node must be matched and
      // measured. A partial measurement would mix incompatible coordinate
      // systems and can corrupt group containment or edge routes.
      if (
        diagnostics.positionsApplied === diagram.nodes.length
        && hasValidDimensions
        && dimensionsExtracted === diagram.nodes.length
      ) {
        // Apply positions
        for (const node of diagram.nodes) {
          const prop = proposedPositions.get(node.id);
          if (prop) {
            node.position = prop.position;
            node.width = prop.width;
            node.height = prop.height;
          }
        }
        diagnostics.oraclePositionsApplied = proposedPositions.size;
        diagnostics.oracleDimensionsApplied = proposedPositions.size;

        // Recompute handles based on new high-fidelity positions
        for (const edge of diagram.edges) {
          if (edge.from.kind === 'connected' && edge.to.kind === 'connected') {
            const sourceNode = diagram.nodes.find((n) => n.id === edge.from.nodeId);
            const targetNode = diagram.nodes.find((n) => n.id === edge.to.nodeId);
            if (sourceNode && targetNode) {
              const sourceCenter = {
                x: sourceNode.position.x + (sourceNode.width || 140) / 2,
                y: sourceNode.position.y + (sourceNode.height || 56) / 2,
              };
              const targetCenter = {
                x: targetNode.position.x + (targetNode.width || 140) / 2,
                y: targetNode.position.y + (targetNode.height || 56) / 2,
              };

              const handlePair = selectHandlesDirectionAware(
                sourceCenter,
                targetCenter,
                diagram.direction
              );

              edge.sourceHandle = handlePair.sourceHandle;
              edge.targetHandle = handlePair.targetHandle;
              edge.from.handleId = handlePair.sourceHandle;
              edge.to.handleId = handlePair.targetHandle;
              edge.data = rebaseImportedEdgeData(edge.data, sourceNode, targetNode);
            }
          }
        }
      } else {
        diagnostics.fallbackUsed = true;
        if (diagnostics.positionsApplied < diagram.nodes.length) {
          diagnostics.fallbackReason = `Not all nodes were matched in SVG (matched ${diagnostics.positionsApplied}/${diagram.nodes.length})`;
        } else {
          diagnostics.fallbackReason = 'Rendered nodes have 0 dimensions (JSDOM/headless environment or collapsed SVG)';
        }
      }
    } finally {
      // Clean up DOM container
      document.body.removeChild(container);
    }
  } catch (err) {
    diagnostics.fallbackUsed = true;
    diagnostics.fallbackReason = err instanceof Error ? err.message : String(err);
    if (shouldDebugMermaidImportLayout()) {
      console.warn('[mermaidImport] Mermaid layout oracle failed, falling back to local Dagre:', err);
    }
  }

  return finalize();
}

export async function importMermaidFlowchartAsync(code: string): Promise<MermaidImportResult> {
  // The synchronous parser remains the authoritative import boundary and the
  // deterministic Dagre fallback. The shared oracle only refines geometry.
  const result = importMermaidFlowchart(code);
  const refined = await refineMermaidLayoutWithSvg(code, result.diagram, { asyncImportUsed: true });
  return {
    diagram: refined.diagram,
    warnings: result.warnings,
    diagnostics: refined.diagnostics,
  };
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

function parseMetadataPayloadProperties(payload: string): { shape?: string; label?: string } {
  let shape: string | undefined;
  let label: string | undefined;

  let idx = 0;
  while (idx < payload.length) {
    while (idx < payload.length && (/\s/.test(payload[idx]) || payload[idx] === ',')) {
      idx++;
    }
    if (idx >= payload.length) break;

    let key = '';
    while (idx < payload.length && /[a-zA-Z0-9_-]/.test(payload[idx])) {
      key += payload[idx];
      idx++;
    }

    while (idx < payload.length && /\s/.test(payload[idx])) idx++;
    if (payload[idx] !== ':') {
      idx++;
      continue;
    }
    idx++;
    while (idx < payload.length && /\s/.test(payload[idx])) idx++;

    if (idx < payload.length && payload[idx] === '"') {
      idx++;
      let val = '';
      while (idx < payload.length && payload[idx] !== '"') {
        if (payload[idx] === '\\') {
          if (idx + 1 < payload.length) {
            val += payload[idx + 1];
            idx += 2;
          } else {
            val += '\\';
            idx++;
          }
        } else {
          val += payload[idx];
          idx++;
        }
      }
      if (idx < payload.length && payload[idx] === '"') {
        idx++;
      }
      if (key === 'label') {
        label = val;
      }
    } else {
      let val = '';
      while (idx < payload.length && /[a-zA-Z0-9_-]/.test(payload[idx])) {
        val += payload[idx];
        idx++;
      }
      if (key === 'shape') {
        shape = val;
      }
    }
  }

  return { shape, label };
}

function scanNodeRef(s: string, start: number, lineIndex: number, warnings: MermaidImportWarning[]): { node: ParsedNode; nextIndex: number } | null {
  let idx = start;
  
  let id = '';
  while (idx < s.length && /[a-zA-Z0-9_.-]/.test(s[idx])) {
    id += s[idx];
    idx++;
  }

  if (!id) return null;

  while (idx < s.length && /\s/.test(s[idx])) idx++;

  let classicShape: NodeShape | undefined;
  let classicLabel: string | undefined;

  for (const config of CLASSIC_BRACKETS) {
    const openLen = config.open.length;
    if (s.substring(idx, idx + openLen) === config.open) {
      idx += openLen;

      let label = '';
      let labelSanityCheckIndex = idx;
      
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
        let actualClose = config.close;
        if (config.open === '[/') {
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
          return null;
        }
        label = s.substring(idx, closeIdx);
        idx = closeIdx;
      }

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
        return null;
      }

      idx += actualClose.length;
      classicShape = finalShape;
      classicLabel = label;
      break;
    }
  }

  while (idx < s.length && /\s/.test(s[idx])) idx++;

  let metadataShapeName: string | undefined;
  let metadataLabel: string | undefined;
  let hasMetadata = false;

  if (idx < s.length - 1 && s[idx] === '@' && s[idx + 1] === '{') {
    idx += 2;
    hasMetadata = true;
    let payload = '';
    let inQuotes = false;
    while (idx < s.length) {
      const char = s[idx];
      if (char === '"') {
        inQuotes = !inQuotes;
        payload += char;
        idx++;
      } else if (char === '\\' && inQuotes) {
        payload += char;
        if (idx + 1 < s.length) {
          payload += s[idx + 1];
          idx += 2;
        } else {
          idx++;
        }
      } else if (char === '}' && !inQuotes) {
        idx++;
        break;
      } else {
        payload += char;
        idx++;
      }
    }

    const props = parseMetadataPayloadProperties(payload);
    metadataShapeName = props.shape;
    metadataLabel = props.label;
  }

  let finalShape: NodeShape;
  let finalLabel: string | undefined;

  if (hasMetadata) {
    let resolvedShape: NodeShape;
    if (metadataShapeName) {
      const def = findDefinitionByMermaidName(metadataShapeName);
      if (def) {
        resolvedShape = def.nodeShape;
      } else {
        warnings.push({
          type: 'unsupportedShape',
          line: lineIndex,
          message: `Forme non supportée "${metadataShapeName}" sur le nœud "${id}". Remplacée par "process".`,
          raw: metadataShapeName,
        });
        resolvedShape = 'process';
      }
    } else {
      resolvedShape = classicShape || 'process';
    }
    finalShape = resolvedShape;

    if (metadataLabel !== undefined) {
      finalLabel = metadataLabel;
    } else {
      finalLabel = classicLabel;
    }
  } else {
    if (classicShape) {
      finalShape = classicShape;
      finalLabel = classicLabel;
    } else {
      return {
        node: { id, line: lineIndex },
        nextIndex: idx
      };
    }
  }

  return {
    node: { id, shape: finalShape, label: finalLabel, line: lineIndex },
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
    { op: '<-.-', style: 'dotted', direction: 'reverse', unsupported: false },
    { op: '<---', style: 'solid', direction: 'reverse', unsupported: false },
    { op: '<-->', style: 'solid', direction: 'bidirectional', unsupported: false },
    { op: '-.->', style: 'dotted', direction: 'directed', unsupported: false },
    { op: '<-.', style: 'dotted', direction: 'reverse', unsupported: false }, // backup parser support
    { op: '<--', style: 'solid', direction: 'reverse', unsupported: false },   // backup parser support
    { op: '-.-', style: 'dotted', direction: 'undirected', unsupported: false },
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
