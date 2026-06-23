/**
 * Pure logic for .s2m file serialization, parsing, and validation.
 * No DOM/browser APIs — all side effects are delegated to callers or utilities.
 */
import type {
  CanonicalDiagram,
  Sketch2MermaidFile,
  S2mViewport,
  NodeShape,
} from './types';
import { normalizeDiagram } from '../store/diagramStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const S2M_FILE_VERSION = 1 as const;
export const S2M_FILE_TYPE = 'sketch2mermaid' as const;
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/** App version embedded in every exported .s2m file */
export const APP_VERSION = '0.0.0';

export const VALID_NODE_SHAPES: ReadonlySet<NodeShape> = new Set<NodeShape>([
  'process',
  'rounded',
  'stadium',
  'decision',
  'event',
  'endEvent',
  'database',
  'file',
]);

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
  const file: Sketch2MermaidFile = {
    fileType: S2M_FILE_TYPE,
    fileVersion: S2M_FILE_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    diagram,
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

  // File version
  if (file.fileVersion !== S2M_FILE_VERSION) {
    return { ok: false, error: `Unsupported Sketch2Mermaid file version (got ${String(file.fileVersion)}, expected ${S2M_FILE_VERSION}).` };
  }

  // Diagram presence
  if (file.diagram == null || typeof file.diagram !== 'object' || Array.isArray(file.diagram)) {
    return { ok: false, error: 'The diagram data is missing or invalid.' };
  }

  const diagram = file.diagram as Record<string, unknown>;

  // Diagram structural validation
  if (diagram.schemaVersion !== 1) {
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
    const node = diagram.nodes[i] as Record<string, unknown>;
    if (!isNonEmptyString(node.id)) {
      return { ok: false, error: `Node at index ${i} has an invalid or missing ID.` };
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
    const edge = diagram.edges[i] as Record<string, unknown>;
    if (!isNonEmptyString(edge.id)) {
      return { ok: false, error: `Edge at index ${i} has an invalid or missing ID.` };
    }
    if (edgeIds.has(edge.id as string)) {
      return { ok: false, error: `Duplicate edge ID "${edge.id as string}".` };
    }
    edgeIds.add(edge.id as string);

    if (!isNonEmptyString(edge.from) || !nodeIds.has(edge.from as string)) {
      return { ok: false, error: `Edge "${edge.id as string}" references a missing source node "${String(edge.from)}".` };
    }
    if (!isNonEmptyString(edge.to) || !nodeIds.has(edge.to as string)) {
      return { ok: false, error: `Edge "${edge.id as string}" references a missing target node "${String(edge.to)}".` };
    }
  }

  // ---- TextBox validation ----
  const textBoxIds = new Set<string>();
  for (let i = 0; i < textBoxes.length; i++) {
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
  const validatedDiagram = normalizeDiagram(diagram as unknown as CanonicalDiagram);

  return {
    ok: true,
    diagram: validatedDiagram,
    viewport,
    warnings,
  };
}
