/**
 * Core geometry types for the SketchUp clone CAD engine.
 * Uses ID-based references for efficient undo/redo and serialization.
 */

// 3D position as tuple [x, y, z]
export type Vector3Tuple = [number, number, number];

/**
 * A point in 3D space. Vertices are the fundamental building blocks.
 */
export interface Vertex {
  id: string;
  position: Vector3Tuple;
  edges: string[]; // IDs of connected edges
}

/**
 * A line segment connecting two vertices.
 */
export interface Edge {
  id: string;
  vertices: [string, string]; // Two vertex IDs [start, end]
  faces: string[]; // Adjacent face IDs (max 2 for manifold geometry)
  isConstruction: boolean; // Construction/guide line vs real geometry
}

/**
 * A planar surface bounded by edges.
 */
export interface Face {
  id: string;
  edges: string[]; // Ordered edge IDs forming the boundary
  normal: Vector3Tuple;
  material?: string; // Material ID
}

/**
 * A collection of geometry that can be transformed as a unit.
 */
export interface Group {
  id: string;
  name: string;
  children: string[]; // IDs of vertices, edges, faces, or sub-groups
  transform: Transform;
  isComponent: boolean; // Component = reusable definition
  componentDefinitionId?: string; // If instance, points to definition
}

/**
 * 3D transformation (position, rotation, scale).
 */
export interface Transform {
  position: Vector3Tuple;
  rotation: Vector3Tuple; // Euler angles in radians
  scale: Vector3Tuple;
}

/**
 * Material properties for faces.
 */
export interface Material {
  id: string;
  name: string;
  color: string; // Hex color
  opacity: number;
  metalness: number;
  roughness: number;
}

/**
 * The complete scene containing all geometry.
 */
export interface Scene {
  id: string;
  name: string;
  vertices: Map<string, Vertex>;
  edges: Map<string, Edge>;
  faces: Map<string, Face>;
  groups: Map<string, Group>;
  materials: Map<string, Material>;
  rootGroups: string[]; // Top-level group IDs
}

/**
 * Selection state for the editor.
 */
export interface SelectionState {
  hoveredId: string | null;
  hoveredType: EntityType | null;
  selectedIds: Set<string>;
  selectedType: EntityType | null; // Type of currently selected entities
}

/**
 * Entity types for selection and tools.
 */
export type EntityType = 'vertex' | 'edge' | 'face' | 'group';

/**
 * Available tool types.
 */
export type ToolType =
  | 'select'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'pushpull'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'orbit'
  | 'pan'
  | 'eraser';

/**
 * Tool state for the active tool.
 */
export interface ToolState {
  activeTool: ToolType;
  isDrawing: boolean;
  startPoint: Vector3Tuple | null;
  previewPoints: Vector3Tuple[];
}

/**
 * Snap types for inference engine.
 */
export type SnapType =
  | 'grid'
  | 'vertex'
  | 'edge'
  | 'midpoint'
  | 'intersection'
  | 'perpendicular'
  | 'parallel'
  | 'axis';

/**
 * Result from snap/inference system.
 */
export interface SnapResult {
  point: Vector3Tuple;
  type: SnapType;
  referenceId?: string; // ID of entity snapped to
  constraint?: 'x' | 'y' | 'z'; // Axis constraint
}

/**
 * Camera view presets.
 */
export type ViewPreset =
  | 'perspective'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

/**
 * Serialized scene for persistence (JSON-friendly).
 */
export interface SerializedScene {
  version: number;
  id: string;
  name: string;
  vertices: Record<string, Vertex>;
  edges: Record<string, Edge>;
  faces: Record<string, Face>;
  groups: Record<string, Group>;
  materials: Record<string, Material>;
  rootGroups: string[];
}

// Helper to create default transform
export function createDefaultTransform(): Transform {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

// Helper to create empty scene
export function createEmptyScene(id: string, name: string): Scene {
  return {
    id,
    name,
    vertices: new Map(),
    edges: new Map(),
    faces: new Map(),
    groups: new Map(),
    materials: new Map(),
    rootGroups: [],
  };
}

// Generate unique ID (compatible with all browsers including headless)
export function generateId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
