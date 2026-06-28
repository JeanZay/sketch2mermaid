/**
 * Pure logic for .s2m file serialization, parsing, and validation.
 * No DOM/browser APIs — all side effects are delegated to callers or utilities.
 */
import type {
  CanonicalDiagram,
  S2mViewport,
  NodeShape,
  DiagramEdgeEndpoint,
} from './types';
import { isReservedCanvasId } from './types';
import { SHAPE_DEFINITIONS } from './shapeRegistry';
import { normalizeDiagram } from '../store/diagramStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const S2M_FILE_VERSION = 1 as const;
export const S2M_FILE_TYPE = 'sketch2mermaid' as const;
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/** App version embedded in every exported .s2m file */
export const APP_VERSION = '0.0.0';

export const VALID_NODE_SHAPES: ReadonlySet<NodeShape> = new Set<NodeShape>(
  SHAPE_DEFINITIONS.map((d) => d.nodeShape)
);

const VALID_DIRECTIONS = new Set(['TD', 'LR', 'BT', 'RL']);

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; diagram: CanonicalDiagram; viewport?: S2mViewport; warnings: string[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Builds and returns the JSON string for a .s2m file.
 * Pure function — no DOM side effects.
 */
export function serializeSketch2MermaidFile(
  diagram: CanonicalDiagram,
  viewport?: S2mViewport,
): string {
  const hasGroups = (diagram.groups && diagram.groups.length > 0) || diagram.nodes.some(n => n.parentGroupId);
  const fileVersion = hasGroups ? 2 : 1;

  let serializedDiagram: Record<string, unknown>;
  if (fileVersion === 2) {
    serializedDiagram = {
      diagramType: diagram.diagramType,
      direction: diagram.direction,
      nodes: diagram.nodes.map(n => ({
        id: n.id,
        label: n.label,
        shape: n.shape,
        position: n.position,
        width: n.width,
        height: n.height,
        style: n.style,
        parentGroupId: n.parentGroupId,
      })),
      edges: diagram.edges,
      textBoxes: diagram.textBoxes,
      groups: diagram.groups || [],
    };
  } else {
    serializedDiagram = {
      diagramType: diagram.diagramType,
      direction: diagram.direction,
      nodes: diagram.nodes.map(n => {
        const copy = { ...n };
        delete copy.parentGroupId;
        return copy;
      }),
      edges: diagram.edges,
      textBoxes: diagram.textBoxes,
      schemaVersion: 1,
    };
  }

  const file = {
    fileType: S2M_FILE_TYPE,
    fileVersion,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    diagram: serializedDiagram,
    ...(viewport ? { viewport } : {}),
  };
  return JSON.stringify(file, null, 2);
}

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

/** Returns e.g. `diagram-2026-06-23-1530.s2m` based on local time. */
export function generateS2mFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `diagram-${yyyy}-${mm}-${dd}-${hh}${min}.s2m`;
}

// ---------------------------------------------------------------------------
// Validation helpers (private)
// ---------------------------------------------------------------------------

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function validateViewport(v: unknown): { valid: true; viewport: S2mViewport } | { valid: false } {
  if (v == null || typeof v !== 'object') return { valid: false };
  const obj = v as Record<string, unknown>;
  if (!isFiniteNumber(obj.x) || !isFiniteNumber(obj.y) || !isFiniteNumber(obj.zoom)) {
    return { valid: false };
  }
  if (obj.zoom < MIN_ZOOM || obj.zoom > MAX_ZOOM) {
    return { valid: false };
  }
  return { valid: true, viewport: { x: obj.x, y: obj.y, zoom: obj.zoom } };
}

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/**
 * Parses and validates a raw JSON string as a .s2m file.
 * Returns the validated diagram (normalized) and optional viewport,
 * or an error message describing the first validation failure.
 *
 * Size check is also performed here as defense-in-depth
 * (callers should also check file.size on the UI side).
 */
export function parseSketch2MermaidFile(raw: string): ParseResult {
  // Size check (defense-in-depth, byte length)
  const byteLength = new TextEncoder().encode(raw).length;
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File is too large (${(byteLength / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 2 MB.` };
  }

  // JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON file.' };
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Invalid JSON file.' };
  }

  const file = parsed as Record<string, unknown>;

  // File type
  if (file.fileType !== S2M_FILE_TYPE) {
    return { ok: false, error: 'This is not a Sketch2Mermaid file.' };
  }

  // File version (supports both 1 and 2)
  if (file.fileVersion !== 1 && file.fileVersion !== 2) {
    return { ok: false, error: `Unsupported Sketch2Mermaid file version (got ${String(file.fileVersion)}, expected 1 or 2).` };
  }

  // Diagram presence
  if (file.diagram == null || typeof file.diagram !== 'object' || Array.isArray(file.diagram)) {
    return { ok: false, error: 'The diagram data is missing or invalid.' };
  }

  const diagram = file.diagram as Record<string, unknown>;

  // Diagram structural validation
  if (file.fileVersion === 1 && diagram.schemaVersion !== 1) {
    return { ok: false, error: `Unsupported diagram schema version (got ${String(diagram.schemaVersion)}, expected 1).` };
  }

  if (diagram.diagramType !== 'flowchart') {
    return { ok: false, error: `Unsupported diagram type (got "${String(diagram.diagramType)}", expected "flowchart").` };
  }

  if (!VALID_DIRECTIONS.has(diagram.direction as string)) {
    return { ok: false, error: `Invalid diagram direction "${String(diagram.direction)}".` };
  }

  if (!Array.isArray(diagram.nodes)) {
    return { ok: false, error: 'The diagram nodes array is missing or invalid.' };
  }

  if (!Array.isArray(diagram.edges)) {
    return { ok: false, error: 'The diagram edges array is missing or invalid.' };
  }

  // textBoxes is optional (may be absent in older files)
  const textBoxes = Array.isArray(diagram.textBoxes) ? diagram.textBoxes : [];

  // ---- Node validation ----
  const nodeIds = new Set<string>();
  for (let i = 0; i < diagram.nodes.length; i++) {
    // Guard: entry must be a non-null, non-array object
    if (diagram.nodes[i] == null || typeof diagram.nodes[i] !== 'object' || Array.isArray(diagram.nodes[i])) {
      return { ok: false, error: `Node at index ${i} is not a valid object.` };
    }
    const node = diagram.nodes[i] as Record<string, unknown>;
    if (!isNonEmptyString(node.id)) {
      return { ok: false, error: `Node at index ${i} has an invalid or missing ID.` };
    }
    if (isReservedCanvasId(node.id as string)) {
      return { ok: false, error: `Node "${node.id as string}" uses a reserved internal ID prefix and cannot be loaded.` };
    }
    if (nodeIds.has(node.id as string)) {
      return { ok: false, error: `Duplicate node ID "${node.id as string}".` };
    }
    nodeIds.add(node.id as string);

    if (!isNonEmptyString(node.shape) || !VALID_NODE_SHAPES.has(node.shape as NodeShape)) {
      return { ok: false, error: `Node "${node.id as string}" has an unsupported shape "${String(node.shape)}".` };
    }

    // Position validation
    const pos = node.position as Record<string, unknown> | null | undefined;
    if (pos == null || typeof pos !== 'object') {
      return { ok: false, error: `Node "${node.id as string}" has an invalid position.` };
    }
    if (!isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) {
      return { ok: false, error: `Node "${node.id as string}" has non-finite position coordinates.` };
    }

    // Optional width/height must be finite if present
    if (node.width !== undefined && !isFiniteNumber(node.width)) {
      return { ok: false, error: `Node "${node.id as string}" has a non-finite width.` };
    }
    if (node.height !== undefined && !isFiniteNumber(node.height)) {
      return { ok: false, error: `Node "${node.id as string}" has a non-finite height.` };
    }
  }

  // ---- Edge validation ----
  const edgeIds = new Set<string>();
  for (let i = 0; i < diagram.edges.length; i++) {
    // Guard: entry must be a non-null, non-array object
    if (diagram.edges[i] == null || typeof diagram.edges[i] !== 'object' || Array.isArray(diagram.edges[i])) {
      return { ok: false, error: `Edge at index ${i} is not a valid object.` };
    }
    const edge = diagram.edges[i] as Record<string, unknown>;
    if (!isNonEmptyString(edge.id)) {
      return { ok: false, error: `Edge at index ${i} has an invalid or missing ID.` };
    }
    if (edgeIds.has(edge.id as string)) {
      return { ok: false, error: `Duplicate edge ID "${edge.id as string}".` };
    }
    edgeIds.add(edge.id as string);

    const validateEndpoint = (ep: unknown): boolean => {
      if (typeof ep === 'string') {
        return ep.length > 0;
      }
      if (ep != null && typeof ep === 'object' && !Array.isArray(ep)) {
        const obj = ep as Record<string, unknown>;
        if (obj.kind === 'connected') {
          return typeof obj.nodeId === 'string' && obj.nodeId.length > 0;
        }
        if (obj.kind === 'detached') {
          const pt = obj.point as Record<string, unknown>;
          return pt != null && typeof pt === 'object' && typeof pt.x === 'number' && Number.isFinite(pt.x) && typeof pt.y === 'number' && Number.isFinite(pt.y);
        }
      }
      return false;
    };

    if (!validateEndpoint(edge.from)) {
      return { ok: false, error: `Edge "${edge.id as string}" has an invalid or missing source endpoint.` };
    }
    if (!validateEndpoint(edge.to)) {
      return { ok: false, error: `Edge "${edge.id as string}" has an invalid or missing target endpoint.` };
    }

    // Strict node presence validation for connected endpoints during file parse
    const getFromNodeId = (ep: unknown) => typeof ep === 'string' ? ep : (ep as DiagramEdgeEndpoint & { nodeId: string }).nodeId;
    const isFromConnected = typeof edge.from === 'string' || (edge.from && (edge.from as DiagramEdgeEndpoint).kind === 'connected');
    if (isFromConnected) {
      const fromNodeId = getFromNodeId(edge.from);
      if (isReservedCanvasId(fromNodeId)) {
        return { ok: false, error: `Edge "${edge.id as string}" source references reserved internal node ID "${fromNodeId}".` };
      }
      if (!nodeIds.has(fromNodeId)) {
        return { ok: false, error: `Edge "${edge.id as string}" references a missing source node "${String(fromNodeId)}".` };
      }
    }

    const getToNodeId = (ep: unknown) => typeof ep === 'string' ? ep : (ep as DiagramEdgeEndpoint & { nodeId: string }).nodeId;
    const isToConnected = typeof edge.to === 'string' || (edge.to && (edge.to as DiagramEdgeEndpoint).kind === 'connected');
    if (isToConnected) {
      const toNodeId = getToNodeId(edge.to);
      if (isReservedCanvasId(toNodeId)) {
        return { ok: false, error: `Edge "${edge.id as string}" target references reserved internal node ID "${toNodeId}".` };
      }
      if (!nodeIds.has(toNodeId)) {
        return { ok: false, error: `Edge "${edge.id as string}" references a missing target node "${String(toNodeId)}".` };
      }
    }

    if (edge.direction !== undefined && edge.direction !== 'directed' && edge.direction !== 'undirected' && edge.direction !== 'bidirectional' && edge.direction !== 'reverse') {
      return { ok: false, error: `Edge "${edge.id as string}" has an invalid direction "${String(edge.direction)}".` };
    }
  }

  // ---- TextBox validation ----
  const textBoxIds = new Set<string>();
  for (let i = 0; i < textBoxes.length; i++) {
    // Guard: entry must be a non-null, non-array object
    if (textBoxes[i] == null || typeof textBoxes[i] !== 'object' || Array.isArray(textBoxes[i])) {
      return { ok: false, error: `TextBox at index ${i} is not a valid object.` };
    }
    const tb = textBoxes[i] as Record<string, unknown>;
    if (!isNonEmptyString(tb.id)) {
      return { ok: false, error: `TextBox at index ${i} has an invalid or missing ID.` };
    }
    if (textBoxIds.has(tb.id as string)) {
      return { ok: false, error: `Duplicate text box ID "${tb.id as string}".` };
    }
    textBoxIds.add(tb.id as string);

    const pos = tb.position as Record<string, unknown> | null | undefined;
    if (pos == null || typeof pos !== 'object') {
      return { ok: false, error: `TextBox "${tb.id as string}" has an invalid position.` };
    }
    if (!isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) {
      return { ok: false, error: `TextBox "${tb.id as string}" has non-finite position coordinates.` };
    }
  }

  // ---- Groups validation (optional field, version 2 files) ----
  // groups may be absent (version 1 files) — that's fine, normalizeDiagram handles it.
  const groups = Array.isArray(diagram.groups) ? diagram.groups : [];
  const groupIds = new Set<string>();
  for (let i = 0; i < groups.length; i++) {
    // Guard: entry must be a non-null, non-array object
    if (groups[i] == null || typeof groups[i] !== 'object' || Array.isArray(groups[i])) {
      return { ok: false, error: `Group at index ${i} is not a valid object.` };
    }
    const group = groups[i] as Record<string, unknown>;
    if (!isNonEmptyString(group.id)) {
      return { ok: false, error: `Group at index ${i} has an invalid or missing ID.` };
    }
    if (isReservedCanvasId(group.id as string)) {
      return { ok: false, error: `Group "${group.id as string}" uses a reserved internal ID prefix and cannot be loaded.` };
    }
    if (groupIds.has(group.id as string)) {
      return { ok: false, error: `Duplicate group ID "${group.id as string}".` };
    }
    groupIds.add(group.id as string);
  }

  // ---- Viewport (non-blocking) ----
  const warnings: string[] = [];
  let viewport: S2mViewport | undefined;

  if (file.viewport !== undefined) {
    const vResult = validateViewport(file.viewport);
    if (vResult.valid) {
      viewport = vResult.viewport;
    } else {
      warnings.push('The viewport data is invalid and was ignored. The view will be reset.');
    }
  }

  // Build the validated CanonicalDiagram and normalize
  const diagramWithoutSchema = { ...diagram };
  // @ts-expect-error - schemaVersion is present in serialized file diagrams but not runtime
  delete diagramWithoutSchema.schemaVersion;
  const validatedDiagram = normalizeDiagram(diagramWithoutSchema as unknown as CanonicalDiagram);

  return {
    ok: true,
    diagram: validatedDiagram,
    viewport,
    warnings,
  };
}
