/**
 * Zustand store for the CAD engine.
 * Manages geometry, selection, tools, and camera state.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import {
  Vertex,
  Edge,
  Face,
  Group,
  Material,
  Vector3Tuple,
  ToolType,
  EntityType,
  SnapResult,
  generateId,
} from './types';
import { calculateFaceNormal, areVerticesCoplanar, distance, lineSegmentIntersection } from './utils';

// Enable Map and Set support in Immer
enableMapSet();

/**
 * Find ALL minimal cycles that would be created by adding an edge between v1 and v2.
 * Uses modified BFS to find multiple paths.
 * Returns array of cycles (each cycle is array of vertex IDs).
 */
function findAllCycles(
  vertices: Map<string, Vertex>,
  edges: Map<string, Edge>,
  v1Id: string,
  v2Id: string,
  newEdgeId: string
): string[][] {
  const cycles: string[][] = [];
  const maxCycleLength = 8;

  // DFS to find all simple paths from v1 to v2
  function dfs(
    currentId: string,
    path: string[],
    visitedInPath: Set<string>
  ): void {
    if (path.length > maxCycleLength) return;

    const vertex = vertices.get(currentId);
    if (!vertex) return;

    for (const edgeId of vertex.edges) {
      if (edgeId === newEdgeId) continue; // Skip the new edge

      const edge = edges.get(edgeId);
      if (!edge) continue;

      const neighborId = edge.vertices[0] === currentId ? edge.vertices[1] : edge.vertices[0];

      // Found the target - we have a cycle!
      if (neighborId === v2Id && path.length >= 2) {
        cycles.push([...path]);
        continue;
      }

      // Continue DFS if not visited in current path
      if (!visitedInPath.has(neighborId)) {
        visitedInPath.add(neighborId);
        path.push(neighborId);
        dfs(neighborId, path, visitedInPath);
        path.pop();
        visitedInPath.delete(neighborId);
      }
    }
  }

  const initialVisited = new Set<string>([v1Id]);
  dfs(v1Id, [v1Id], initialVisited);

  // Filter to keep only minimal cycles (no shortcuts)
  // A cycle is minimal if no subset of its vertices also forms a cycle
  const minimalCycles = cycles.filter((cycle) => {
    // Check if this cycle has any "chord" edges (edges between non-adjacent cycle vertices)
    for (let i = 0; i < cycle.length; i++) {
      for (let j = i + 2; j < cycle.length; j++) {
        // Skip adjacent vertices (including wrap-around)
        if (i === 0 && j === cycle.length - 1) continue;

        const vi = cycle[i];
        const vj = cycle[j];

        // Check if there's an edge between vi and vj (that's not part of the cycle path)
        const vertexI = vertices.get(vi);
        if (!vertexI) continue;

        for (const edgeId of vertexI.edges) {
          if (edgeId === newEdgeId) continue;
          const edge = edges.get(edgeId);
          if (!edge) continue;

          const otherId = edge.vertices[0] === vi ? edge.vertices[1] : edge.vertices[0];
          if (otherId === vj) {
            // Found a chord - this cycle is not minimal
            return false;
          }
        }
      }
    }
    return true;
  });

  return minimalCycles;
}

/**
 * Helper function to detect and create faces for a given edge.
 * Used both for normal edge addition and after intersection splitting.
 */
function detectAndCreateFaces(
  state: {
    vertices: Map<string, Vertex>;
    edges: Map<string, Edge>;
    faces: Map<string, Face>;
  },
  v1Id: string,
  v2Id: string,
  edgeId: string
): void {
  // Find all minimal cycles containing this edge
  const cyclePaths = findAllCycles(state.vertices, state.edges, v1Id, v2Id, edgeId);

  for (const cyclePath of cyclePaths) {
    if (cyclePath.length < 2) continue;

    const cycle = [...cyclePath, v2Id];

    // Get vertex positions
    const vertexPositions = cycle.map((vId) => {
      const v = state.vertices.get(vId);
      return v ? v.position : [0, 0, 0] as Vector3Tuple;
    });

    // Only create face if vertices are coplanar
    if (!areVerticesCoplanar(vertexPositions)) continue;

    // Find edges that form this cycle
    const faceEdges: string[] = [];
    for (let i = 0; i < cycle.length; i++) {
      const currVId = cycle[i];
      const nextVId = cycle[(i + 1) % cycle.length];

      // Find edge between these vertices
      const edge = Array.from(state.edges.values()).find(
        (e) =>
          (e.vertices[0] === currVId && e.vertices[1] === nextVId) ||
          (e.vertices[0] === nextVId && e.vertices[1] === currVId)
      );
      if (edge) {
        faceEdges.push(edge.id);
      }
    }

    if (faceEdges.length === cycle.length) {
      // Check if this exact face already exists
      const faceEdgeSet = new Set(faceEdges);
      const existingFace = Array.from(state.faces.values()).find((f) => {
        if (f.edges.length !== faceEdges.length) return false;
        return f.edges.every((e) => faceEdgeSet.has(e));
      });

      if (!existingFace) {
        // Create the face
        const faceId = generateId();
        const normal = calculateFaceNormal(vertexPositions);

        state.faces.set(faceId, {
          id: faceId,
          edges: faceEdges,
          normal,
        });

        // Update edges to reference this face
        for (const faceEdgeId of faceEdges) {
          const edge = state.edges.get(faceEdgeId);
          if (edge) {
            edge.faces.push(faceId);
          }
        }
      }
    }
  }
}

interface SceneState {
  // Geometry
  vertices: Map<string, Vertex>;
  edges: Map<string, Edge>;
  faces: Map<string, Face>;
  groups: Map<string, Group>;
  materials: Map<string, Material>;

  // Selection
  selectedIds: Set<string>;
  selectedType: EntityType | null;
  hoveredId: string | null;
  hoveredType: EntityType | null;

  // Tool state
  activeTool: ToolType;
  isDrawing: boolean;
  drawStartVertexId: string | null;
  previewPoint: Vector3Tuple | null;
  previewColor: string; // Axis color for preview line
  previewAngle: number | null; // Angle in degrees from connected edge or horizontal

  // Rectangle tool state
  rectangleStartPoint: Vector3Tuple | null;
  rectanglePreviewCorners: Vector3Tuple[] | null; // 4 corners [start, corner2, opposite, corner4]
  rectangleIsVertical: boolean; // True if drawing a vertical wall, false for horizontal

  // Circle tool state
  circleCenter: Vector3Tuple | null;
  circlePreviewVertices: Vector3Tuple[] | null; // Polygon approximation vertices

  // Arc tool state
  arcCenter: Vector3Tuple | null;
  arcRadius: number;
  arcStartAngle: number | null;
  arcEndAngle: number | null;
  arcPreviewVertices: Vector3Tuple[] | null;

  // Modifier keys state (for hold-to-activate tools)
  isShiftHeld: boolean;
  isSpaceHeld: boolean;

  // Undo/Redo history
  history: Array<{
    vertices: Map<string, Vertex>;
    edges: Map<string, Edge>;
    faces: Map<string, Face>;
  }>;
  historyIndex: number;

  // Snap state
  activeSnap: SnapResult | null;
  gridSize: number;
  snapEnabled: boolean;

  // Camera
  cameraPosition: Vector3Tuple;
  cameraTarget: Vector3Tuple;
}

interface SceneActions {
  // Vertex operations
  addVertex: (position: Vector3Tuple) => string;
  findNearbyVertex: (position: Vector3Tuple, threshold?: number) => string | null;
  updateVertexPosition: (id: string, position: Vector3Tuple) => void;
  deleteVertex: (id: string) => void;

  // Edge operations
  addEdge: (v1Id: string, v2Id: string) => string;
  deleteEdge: (id: string) => void;

  // Face operations
  addFace: (vertexIds: string[]) => string | null;

  // Selection operations
  setSelection: (ids: string[], type: EntityType) => void;
  addToSelection: (id: string, type: EntityType) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  setHovered: (id: string | null, type: EntityType | null) => void;

  // Tool operations
  setActiveTool: (tool: ToolType) => void;
  startDrawing: (vertexId: string) => void;
  updatePreview: (point: Vector3Tuple | null, color?: string, angle?: number | null) => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;

  // Rectangle tool operations
  startRectangle: (point: Vector3Tuple) => void;
  updateRectanglePreview: (oppositePoint: Vector3Tuple, height: number, isVertical: boolean) => void;
  finishRectangle: () => void;
  cancelRectangle: () => void;

  // Circle tool operations
  startCircle: (center: Vector3Tuple) => void;
  updateCirclePreview: (edgePoint: Vector3Tuple) => void;
  finishCircle: () => void;
  cancelCircle: () => void;

  // Arc tool operations
  startArc: (center: Vector3Tuple) => void;
  updateArcPreview: (edgePoint: Vector3Tuple, startAngle: number, endAngle: number) => void;
  finishArc: () => void;
  cancelArc: () => void;

  // Modifier key operations
  setShiftHeld: (held: boolean) => void;
  setSpaceHeld: (held: boolean) => void;

  // History operations
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Snap operations
  setActiveSnap: (snap: SnapResult | null) => void;
  setGridSize: (size: number) => void;
  toggleSnap: () => void;

  // Camera operations
  setCameraPosition: (position: Vector3Tuple) => void;
  setCameraTarget: (target: Vector3Tuple) => void;

  // Scene operations
  clearScene: () => void;
  getVertexById: (id: string) => Vertex | undefined;
  getEdgeById: (id: string) => Edge | undefined;
  getConnectedEdges: (vertexId: string) => Edge[];
}

type SceneStore = SceneState & SceneActions;

export const useSceneStore = create<SceneStore>()(
  immer((set, get) => ({
    // Initial state
    vertices: new Map(),
    edges: new Map(),
    faces: new Map(),
    groups: new Map(),
    materials: new Map(),

    selectedIds: new Set(),
    selectedType: null,
    hoveredId: null,
    hoveredType: null,

    activeTool: 'select',
    isDrawing: false,
    drawStartVertexId: null,
    previewPoint: null,
    previewColor: '#a0aec0', // Default gray
    previewAngle: null,

    rectangleStartPoint: null,
    rectanglePreviewCorners: null,
    rectangleIsVertical: false,

    circleCenter: null,
    circlePreviewVertices: null,

    arcCenter: null,
    arcRadius: 0,
    arcStartAngle: null,
    arcEndAngle: null,
    arcPreviewVertices: null,

    isShiftHeld: false,
    isSpaceHeld: false,

    history: [],
    historyIndex: -1,

    activeSnap: null,
    gridSize: 1, // 1 inch default snap
    snapEnabled: true,

    cameraPosition: [10, 10, 10],
    cameraTarget: [0, 0, 0],

    // Vertex operations
    addVertex: (position: Vector3Tuple) => {
      const id = generateId();
      set((state) => {
        state.vertices.set(id, {
          id,
          position,
          edges: [],
        });
      });
      return id;
    },

    findNearbyVertex: (position: Vector3Tuple, threshold: number = 0.3) => {
      const state = get();
      let closestId: string | null = null;
      let closestDist = threshold;

      state.vertices.forEach((vertex) => {
        const dist = distance(position, vertex.position);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = vertex.id;
        }
      });

      return closestId;
    },

    updateVertexPosition: (id: string, position: Vector3Tuple) => {
      set((state) => {
        const vertex = state.vertices.get(id);
        if (vertex) {
          vertex.position = position;
        }
      });
    },

    deleteVertex: (id: string) => {
      set((state) => {
        const vertex = state.vertices.get(id);
        if (!vertex) return;

        // Delete connected edges first
        for (const edgeId of vertex.edges) {
          const edge = state.edges.get(edgeId);
          if (edge) {
            // Remove edge reference from other vertex
            const otherVertexId = edge.vertices[0] === id ? edge.vertices[1] : edge.vertices[0];
            const otherVertex = state.vertices.get(otherVertexId);
            if (otherVertex) {
              otherVertex.edges = otherVertex.edges.filter((e) => e !== edgeId);
            }
            state.edges.delete(edgeId);
          }
        }

        state.vertices.delete(id);
        state.selectedIds.delete(id);
      });
    },

    // Edge operations
    addEdge: (v1Id: string, v2Id: string) => {
      const id = generateId();
      set((state) => {
        const v1 = state.vertices.get(v1Id);
        const v2 = state.vertices.get(v2Id);
        if (!v1 || !v2) return;

        // Check if edge already exists
        const existingEdge = Array.from(state.edges.values()).find(
          (e) =>
            (e.vertices[0] === v1Id && e.vertices[1] === v2Id) ||
            (e.vertices[0] === v2Id && e.vertices[1] === v1Id)
        );
        if (existingEdge) return;

        // Check for intersections with existing edges
        const intersections: { point: Vector3Tuple; edgeId: string; t: number }[] = [];

        for (const [edgeId, edge] of state.edges) {
          const ev1 = state.vertices.get(edge.vertices[0]);
          const ev2 = state.vertices.get(edge.vertices[1]);
          if (!ev1 || !ev2) continue;

          const intersection = lineSegmentIntersection(
            v1.position,
            v2.position,
            ev1.position,
            ev2.position
          );

          if (intersection) {
            // Calculate t parameter (how far along the new edge)
            const dx = v2.position[0] - v1.position[0];
            const dy = v2.position[1] - v1.position[1];
            const dz = v2.position[2] - v1.position[2];
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const ix = intersection[0] - v1.position[0];
            const iy = intersection[1] - v1.position[1];
            const iz = intersection[2] - v1.position[2];
            const t = Math.sqrt(ix * ix + iy * iy + iz * iz) / len;

            intersections.push({ point: intersection, edgeId, t });
          }
        }

        // If there are intersections, handle them
        if (intersections.length > 0) {
          // Sort by t (distance from v1)
          intersections.sort((a, b) => a.t - b.t);

          // Create vertices at intersection points
          const intersectionVertexIds: string[] = [];
          for (const { point } of intersections) {
            const newVertexId = generateId();
            state.vertices.set(newVertexId, {
              id: newVertexId,
              position: point,
              edges: [],
            });
            intersectionVertexIds.push(newVertexId);
          }

          // Split existing edges at intersection points
          for (let i = 0; i < intersections.length; i++) {
            const { edgeId } = intersections[i];
            const intersectionVertexId = intersectionVertexIds[i];
            const edge = state.edges.get(edgeId);
            if (!edge) continue;

            const oldV1Id = edge.vertices[0];
            const oldV2Id = edge.vertices[1];
            const oldV1 = state.vertices.get(oldV1Id);
            const oldV2 = state.vertices.get(oldV2Id);
            if (!oldV1 || !oldV2) continue;

            // Remove old edge from vertices
            oldV1.edges = oldV1.edges.filter((e) => e !== edgeId);
            oldV2.edges = oldV2.edges.filter((e) => e !== edgeId);

            // Create two new edges
            const newEdge1Id = generateId();
            const newEdge2Id = generateId();

            state.edges.set(newEdge1Id, {
              id: newEdge1Id,
              vertices: [oldV1Id, intersectionVertexId],
              faces: [],
              isConstruction: edge.isConstruction,
            });

            state.edges.set(newEdge2Id, {
              id: newEdge2Id,
              vertices: [intersectionVertexId, oldV2Id],
              faces: [],
              isConstruction: edge.isConstruction,
            });

            // Update vertex edge references
            oldV1.edges.push(newEdge1Id);
            oldV2.edges.push(newEdge2Id);
            const intersectionVertex = state.vertices.get(intersectionVertexId)!;
            intersectionVertex.edges.push(newEdge1Id, newEdge2Id);

            // Remove old edge
            state.edges.delete(edgeId);
          }

          // Create edges along the new line (v1 -> intersections -> v2)
          const allVertexIds = [v1Id, ...intersectionVertexIds, v2Id];
          const newEdgeIds: string[] = [];

          for (let i = 0; i < allVertexIds.length - 1; i++) {
            const segV1Id = allVertexIds[i];
            const segV2Id = allVertexIds[i + 1];
            const segV1 = state.vertices.get(segV1Id)!;
            const segV2 = state.vertices.get(segV2Id)!;

            const newEdgeId = generateId();
            state.edges.set(newEdgeId, {
              id: newEdgeId,
              vertices: [segV1Id, segV2Id],
              faces: [],
              isConstruction: false,
            });

            segV1.edges.push(newEdgeId);
            segV2.edges.push(newEdgeId);
            newEdgeIds.push(newEdgeId);
          }

          // Run face detection for each new edge
          for (const newEdgeId of newEdgeIds) {
            const newEdge = state.edges.get(newEdgeId);
            if (!newEdge) continue;

            const [nv1Id, nv2Id] = newEdge.vertices;
            detectAndCreateFaces(state, nv1Id, nv2Id, newEdgeId);
          }

          return; // Exit early - we handled everything
        }

        // No intersections - add edge normally
        state.edges.set(id, {
          id,
          vertices: [v1Id, v2Id],
          faces: [],
          isConstruction: false,
        });

        v1.edges.push(id);
        v2.edges.push(id);

        // Check if this new edge subdivides any existing faces
        // A face is subdivided if the new edge connects two non-adjacent vertices of the face
        const facesToRemove: string[] = [];
        for (const [faceId, face] of state.faces) {
          // Get all vertices of this face
          const faceVertices: string[] = [];
          for (const edgeId of face.edges) {
            const edge = state.edges.get(edgeId);
            if (edge) {
              for (const vId of edge.vertices) {
                if (!faceVertices.includes(vId)) {
                  faceVertices.push(vId);
                }
              }
            }
          }

          // Check if both v1 and v2 are vertices of this face
          const v1InFace = faceVertices.includes(v1Id);
          const v2InFace = faceVertices.includes(v2Id);

          if (v1InFace && v2InFace) {
            // Check if v1 and v2 are adjacent in the face (share an edge)
            const areAdjacent = face.edges.some((edgeId) => {
              const edge = state.edges.get(edgeId);
              if (!edge) return false;
              return (
                (edge.vertices[0] === v1Id && edge.vertices[1] === v2Id) ||
                (edge.vertices[0] === v2Id && edge.vertices[1] === v1Id)
              );
            });

            if (!areAdjacent) {
              // The new edge is a chord - this face will be subdivided
              facesToRemove.push(faceId);
            }
          }
        }

        // Remove subdivided faces
        for (const faceId of facesToRemove) {
          const face = state.faces.get(faceId);
          if (face) {
            // Remove face reference from its edges
            for (const edgeId of face.edges) {
              const edge = state.edges.get(edgeId);
              if (edge) {
                edge.faces = edge.faces.filter((f) => f !== faceId);
              }
            }
            state.faces.delete(faceId);
          }
        }

        // Try to detect closed loops (faces) that include this new edge
        detectAndCreateFaces(state, v1Id, v2Id, id);
      });
      return id;
    },

    deleteEdge: (id: string) => {
      set((state) => {
        const edge = state.edges.get(id);
        if (!edge) return;

        // Remove edge reference from vertices
        for (const vertexId of edge.vertices) {
          const vertex = state.vertices.get(vertexId);
          if (vertex) {
            vertex.edges = vertex.edges.filter((e) => e !== id);
          }
        }

        state.edges.delete(id);
        state.selectedIds.delete(id);
      });
    },

    // Face operations - directly create a face from vertex IDs
    addFace: (vertexIds: string[]) => {
      if (vertexIds.length < 3) return null;

      const faceId = generateId();
      let created = false;

      set((state) => {
        // Get vertex positions
        const positions: Vector3Tuple[] = [];
        for (const vId of vertexIds) {
          const v = state.vertices.get(vId);
          if (!v) return;
          positions.push(v.position);
        }

        // Find or create edges between consecutive vertices
        const edgeIds: string[] = [];
        for (let i = 0; i < vertexIds.length; i++) {
          const v1Id = vertexIds[i];
          const v2Id = vertexIds[(i + 1) % vertexIds.length];

          // Find existing edge
          let edge = Array.from(state.edges.values()).find(
            (e) =>
              (e.vertices[0] === v1Id && e.vertices[1] === v2Id) ||
              (e.vertices[0] === v2Id && e.vertices[1] === v1Id)
          );

          if (!edge) {
            // Create new edge
            const newEdgeId = generateId();
            state.edges.set(newEdgeId, {
              id: newEdgeId,
              vertices: [v1Id, v2Id],
              faces: [],
            });
            // Update vertex edge lists
            const v1 = state.vertices.get(v1Id);
            const v2 = state.vertices.get(v2Id);
            if (v1) v1.edges.push(newEdgeId);
            if (v2) v2.edges.push(newEdgeId);
            edge = state.edges.get(newEdgeId)!;
          }

          edgeIds.push(edge.id);
        }

        // Calculate normal (cross product of first two edges)
        const p0 = positions[0];
        const p1 = positions[1];
        const p2 = positions[2];
        const v1: Vector3Tuple = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v2: Vector3Tuple = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const normal: Vector3Tuple = [
          v1[1] * v2[2] - v1[2] * v2[1],
          v1[2] * v2[0] - v1[0] * v2[2],
          v1[0] * v2[1] - v1[1] * v2[0],
        ];
        // Normalize
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        if (len > 0) {
          normal[0] /= len;
          normal[1] /= len;
          normal[2] /= len;
        }

        // Create the face
        state.faces.set(faceId, {
          id: faceId,
          edges: edgeIds,
          normal,
        });

        // Update edges to reference this face
        for (const edgeId of edgeIds) {
          const edge = state.edges.get(edgeId);
          if (edge && !edge.faces.includes(faceId)) {
            edge.faces.push(faceId);
          }
        }

        created = true;
      });

      return created ? faceId : null;
    },

    // Selection operations
    setSelection: (ids: string[], type: EntityType) => {
      set((state) => {
        state.selectedIds = new Set(ids);
        state.selectedType = ids.length > 0 ? type : null;
      });
    },

    addToSelection: (id: string, type: EntityType) => {
      set((state) => {
        if (state.selectedType && state.selectedType !== type) {
          // Clear selection if different type
          state.selectedIds.clear();
        }
        state.selectedIds.add(id);
        state.selectedType = type;
      });
    },

    removeFromSelection: (id: string) => {
      set((state) => {
        state.selectedIds.delete(id);
        if (state.selectedIds.size === 0) {
          state.selectedType = null;
        }
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedIds.clear();
        state.selectedType = null;
      });
    },

    setHovered: (id: string | null, type: EntityType | null) => {
      set((state) => {
        state.hoveredId = id;
        state.hoveredType = type;
      });
    },

    // Tool operations
    setActiveTool: (tool: ToolType) => {
      set((state) => {
        state.activeTool = tool;
        state.isDrawing = false;
        state.drawStartVertexId = null;
        state.previewPoint = null;
        state.rectangleStartPoint = null;
        state.rectanglePreviewCorners = null;
        state.rectangleIsVertical = false;
        state.circleCenter = null;
        state.circlePreviewVertices = null;
        state.arcCenter = null;
        state.arcRadius = 0;
        state.arcStartAngle = null;
        state.arcEndAngle = null;
        state.arcPreviewVertices = null;
      });
    },

    startDrawing: (vertexId: string) => {
      set((state) => {
        state.isDrawing = true;
        state.drawStartVertexId = vertexId;
      });
    },

    updatePreview: (point: Vector3Tuple | null, color?: string, angle?: number | null) => {
      set((state) => {
        state.previewPoint = point;
        if (color) {
          state.previewColor = color;
        }
        state.previewAngle = angle ?? null;
      });
    },

    finishDrawing: () => {
      set((state) => {
        state.isDrawing = false;
        state.drawStartVertexId = null;
        state.previewPoint = null;
      });
    },

    cancelDrawing: () => {
      set((state) => {
        state.isDrawing = false;
        state.drawStartVertexId = null;
        state.previewPoint = null;
      });
    },

    // Rectangle tool operations
    startRectangle: (point: Vector3Tuple) => {
      set((state) => {
        state.rectangleStartPoint = point;
        state.isDrawing = true;
      });
    },

    updateRectanglePreview: (oppositePoint: Vector3Tuple, height: number, isVertical: boolean) => {
      set((state) => {
        if (!state.rectangleStartPoint) return;
        const start = state.rectangleStartPoint;

        // Use explicit isVertical parameter (controlled by Shift key)
        state.rectangleIsVertical = isVertical;

        let corners: Vector3Tuple[];

        if (isVertical && Math.abs(height) > 0.01) {
          // Vertical wall rectangle
          // Base is along X or Z axis (whichever has more movement), height is Y
          const dx = Math.abs(oppositePoint[0] - start[0]);
          const dz = Math.abs(oppositePoint[2] - start[2]);

          if (dx >= dz) {
            // Wall extends along X axis
            corners = [
              start,
              [oppositePoint[0], start[1], start[2]], // Same Y and Z, different X
              [oppositePoint[0], start[1] + height, start[2]], // Top right
              [start[0], start[1] + height, start[2]], // Top left
            ];
          } else {
            // Wall extends along Z axis
            corners = [
              start,
              [start[0], start[1], oppositePoint[2]], // Same X and Y, different Z
              [start[0], start[1] + height, oppositePoint[2]], // Top far
              [start[0], start[1] + height, start[2]], // Top near
            ];
          }
        } else {
          // Horizontal floor rectangle (original behavior)
          corners = [
            start,
            [oppositePoint[0], start[1], start[2]], // Same Z as start
            oppositePoint,
            [start[0], start[1], oppositePoint[2]], // Same X as start
          ];
        }

        state.rectanglePreviewCorners = corners;
        state.previewPoint = oppositePoint;
      });
    },

    finishRectangle: () => {
      const state = get();
      if (!state.rectanglePreviewCorners || state.rectanglePreviewCorners.length !== 4) {
        set((s) => {
          s.rectangleStartPoint = null;
          s.rectanglePreviewCorners = null;
          s.rectangleIsVertical = false;
          s.isDrawing = false;
          s.previewPoint = null;
        });
        return;
      }

      const corners = state.rectanglePreviewCorners;
      const isVertical = state.rectangleIsVertical;

      // Check if rectangle has any area (not just a line or point)
      // For horizontal: check X and Z dimensions
      // For vertical: check width (X or Z) and height (Y)
      let dim1: number, dim2: number;
      if (isVertical) {
        // Vertical wall - check width and height
        const widthX = Math.abs(corners[0][0] - corners[1][0]);
        const widthZ = Math.abs(corners[0][2] - corners[1][2]);
        dim1 = Math.max(widthX, widthZ); // Width along ground
        dim2 = Math.abs(corners[0][1] - corners[2][1]); // Height
      } else {
        // Horizontal floor - check X and Z
        dim1 = Math.abs(corners[0][0] - corners[2][0]);
        dim2 = Math.abs(corners[0][2] - corners[2][2]);
      }

      if (dim1 < 0.01 || dim2 < 0.01) {
        set((s) => {
          s.rectangleStartPoint = null;
          s.rectanglePreviewCorners = null;
          s.rectangleIsVertical = false;
          s.isDrawing = false;
          s.previewPoint = null;
        });
        return;
      }

      // Create 4 vertices
      const vertexIds: string[] = [];
      for (const corner of corners) {
        const id = state.addVertex(corner);
        vertexIds.push(id);
      }

      // Create 4 edges connecting vertices in order
      for (let i = 0; i < 4; i++) {
        const v1 = vertexIds[i];
        const v2 = vertexIds[(i + 1) % 4];
        state.addEdge(v1, v2);
      }

      // Reset rectangle state
      set((s) => {
        s.rectangleStartPoint = null;
        s.rectanglePreviewCorners = null;
        s.rectangleIsVertical = false;
        s.isDrawing = false;
        s.previewPoint = null;
      });
    },

    cancelRectangle: () => {
      set((state) => {
        state.rectangleStartPoint = null;
        state.rectanglePreviewCorners = null;
        state.rectangleIsVertical = false;
        state.isDrawing = false;
        state.previewPoint = null;
      });
    },

    // Circle tool operations
    startCircle: (center: Vector3Tuple) => {
      set((state) => {
        state.circleCenter = center;
        state.isDrawing = true;
      });
    },

    updateCirclePreview: (edgePoint: Vector3Tuple) => {
      set((state) => {
        if (!state.circleCenter) return;
        const center = state.circleCenter;

        // Calculate radius
        const dx = edgePoint[0] - center[0];
        const dz = edgePoint[2] - center[2];
        const radius = Math.sqrt(dx * dx + dz * dz);

        if (radius < 0.01) {
          state.circlePreviewVertices = null;
          return;
        }

        // Create polygon approximation (24 segments)
        const segments = 24;
        const vertices: Vector3Tuple[] = [];
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          vertices.push([
            center[0] + Math.cos(angle) * radius,
            center[1],
            center[2] + Math.sin(angle) * radius,
          ]);
        }
        state.circlePreviewVertices = vertices;
        state.previewPoint = edgePoint;
      });
    },

    finishCircle: () => {
      const state = get();
      if (!state.circlePreviewVertices || state.circlePreviewVertices.length < 3) {
        set((s) => {
          s.circleCenter = null;
          s.circlePreviewVertices = null;
          s.isDrawing = false;
          s.previewPoint = null;
        });
        return;
      }

      const vertices = state.circlePreviewVertices;

      set((s) => {
        // Create vertices for each point on the circle
        const vertexIds: string[] = [];
        for (const pos of vertices) {
          const id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          s.vertices.set(id, {
            id,
            position: pos,
            edges: [],
          });
          vertexIds.push(id);
        }

        // Create edges connecting consecutive vertices (don't use addEdge to avoid cycle detection)
        const edgeIds: string[] = [];
        for (let i = 0; i < vertexIds.length; i++) {
          const v1Id = vertexIds[i];
          const v2Id = vertexIds[(i + 1) % vertexIds.length];
          const edgeId = `e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`;

          s.edges.set(edgeId, {
            id: edgeId,
            vertices: [v1Id, v2Id],
            faces: [],
            isConstruction: false,
          });

          // Update vertex edge references
          const v1 = s.vertices.get(v1Id);
          const v2 = s.vertices.get(v2Id);
          if (v1) v1.edges.push(edgeId);
          if (v2) v2.edges.push(edgeId);

          edgeIds.push(edgeId);
        }

        // Create the face manually (since the cycle is too long for auto-detection)
        const faceId = `f_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Calculate normal (assume Y-up for ground plane circle)
        const normal: Vector3Tuple = [0, 1, 0];

        s.faces.set(faceId, {
          id: faceId,
          edges: edgeIds,
          normal,
        });

        // Update edges with face reference
        for (const edgeId of edgeIds) {
          const edge = s.edges.get(edgeId);
          if (edge) {
            edge.faces.push(faceId);
          }
        }

        // Reset circle state
        s.circleCenter = null;
        s.circlePreviewVertices = null;
        s.isDrawing = false;
        s.previewPoint = null;
      });
    },

    cancelCircle: () => {
      set((state) => {
        state.circleCenter = null;
        state.circlePreviewVertices = null;
        state.isDrawing = false;
        state.previewPoint = null;
      });
    },

    // Arc tool operations
    startArc: (center: Vector3Tuple) => {
      set((state) => {
        state.arcCenter = center;
        state.arcRadius = 0;
        state.arcStartAngle = null;
        state.arcEndAngle = null;
        state.isDrawing = true;
      });
    },

    updateArcPreview: (edgePoint: Vector3Tuple, startAngle: number, endAngle: number) => {
      set((state) => {
        if (!state.arcCenter) return;
        const center = state.arcCenter;

        // Calculate radius
        const dx = edgePoint[0] - center[0];
        const dz = edgePoint[2] - center[2];
        const radius = Math.sqrt(dx * dx + dz * dz);

        if (radius < 0.01) {
          state.arcPreviewVertices = null;
          return;
        }

        state.arcRadius = radius;
        state.arcStartAngle = startAngle;
        state.arcEndAngle = endAngle;

        // Create arc preview vertices
        // Calculate number of segments based on arc length
        const angleDiff = Math.abs(endAngle - startAngle);
        const segments = Math.max(3, Math.round((angleDiff / (Math.PI * 2)) * 24));

        const vertices: Vector3Tuple[] = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = startAngle + t * (endAngle - startAngle);
          vertices.push([
            center[0] + Math.cos(angle) * radius,
            center[1],
            center[2] + Math.sin(angle) * radius,
          ]);
        }
        state.arcPreviewVertices = vertices;
        state.previewPoint = edgePoint;
      });
    },

    finishArc: () => {
      const state = get();
      if (!state.arcPreviewVertices || state.arcPreviewVertices.length < 2) {
        set((s) => {
          s.arcCenter = null;
          s.arcRadius = 0;
          s.arcStartAngle = null;
          s.arcEndAngle = null;
          s.arcPreviewVertices = null;
          s.isDrawing = false;
          s.previewPoint = null;
        });
        return;
      }

      const vertices = state.arcPreviewVertices;

      set((s) => {
        // Create vertices for each point on the arc
        const vertexIds: string[] = [];
        for (const pos of vertices) {
          const id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          s.vertices.set(id, {
            id,
            position: pos,
            edges: [],
          });
          vertexIds.push(id);
        }

        // Create edges connecting consecutive vertices (open curve, not closed)
        for (let i = 0; i < vertexIds.length - 1; i++) {
          const v1Id = vertexIds[i];
          const v2Id = vertexIds[i + 1];
          const edgeId = `e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`;

          s.edges.set(edgeId, {
            id: edgeId,
            vertices: [v1Id, v2Id],
            faces: [],
            isConstruction: false,
          });

          // Update vertex edge references
          const v1 = s.vertices.get(v1Id);
          const v2 = s.vertices.get(v2Id);
          if (v1) v1.edges.push(edgeId);
          if (v2) v2.edges.push(edgeId);
        }

        // Reset arc state
        s.arcCenter = null;
        s.arcRadius = 0;
        s.arcStartAngle = null;
        s.arcEndAngle = null;
        s.arcPreviewVertices = null;
        s.isDrawing = false;
        s.previewPoint = null;
      });
    },

    cancelArc: () => {
      set((state) => {
        state.arcCenter = null;
        state.arcRadius = 0;
        state.arcStartAngle = null;
        state.arcEndAngle = null;
        state.arcPreviewVertices = null;
        state.isDrawing = false;
        state.previewPoint = null;
      });
    },

    // Modifier key operations
    setShiftHeld: (held: boolean) => {
      set((state) => {
        state.isShiftHeld = held;
      });
    },

    setSpaceHeld: (held: boolean) => {
      set((state) => {
        state.isSpaceHeld = held;
      });
    },

    // History operations
    saveToHistory: () => {
      set((state) => {
        // Clone current geometry state
        const snapshot = {
          vertices: new Map(state.vertices),
          edges: new Map(state.edges),
          faces: new Map(state.faces),
        };

        // Deep clone each vertex, edge, face
        snapshot.vertices = new Map();
        state.vertices.forEach((v, k) => {
          snapshot.vertices.set(k, { ...v, edges: [...v.edges] });
        });
        snapshot.edges = new Map();
        state.edges.forEach((e, k) => {
          snapshot.edges.set(k, { ...e, vertices: [...e.vertices] as [string, string], faces: [...e.faces] });
        });
        snapshot.faces = new Map();
        state.faces.forEach((f, k) => {
          snapshot.faces.set(k, { ...f, edges: [...f.edges], normal: [...f.normal] as Vector3Tuple });
        });

        // Truncate history if we're not at the end
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(snapshot);

        // Keep max 50 history entries
        if (newHistory.length > 50) {
          newHistory.shift();
        }

        state.history = newHistory;
        state.historyIndex = newHistory.length - 1;
      });
    },

    undo: () => {
      const state = get();
      if (state.historyIndex < 0) return;

      set((s) => {
        // If we're at the current state, save it first
        if (s.historyIndex === s.history.length - 1) {
          const currentSnapshot = {
            vertices: new Map<string, Vertex>(),
            edges: new Map<string, Edge>(),
            faces: new Map<string, Face>(),
          };
          s.vertices.forEach((v, k) => {
            currentSnapshot.vertices.set(k, { ...v, edges: [...v.edges] });
          });
          s.edges.forEach((e, k) => {
            currentSnapshot.edges.set(k, { ...e, vertices: [...e.vertices] as [string, string], faces: [...e.faces] });
          });
          s.faces.forEach((f, k) => {
            currentSnapshot.faces.set(k, { ...f, edges: [...f.edges], normal: [...f.normal] as Vector3Tuple });
          });
          s.history.push(currentSnapshot);
        }

        if (s.historyIndex > 0) {
          s.historyIndex--;
          const snapshot = s.history[s.historyIndex];
          s.vertices = new Map(snapshot.vertices);
          s.edges = new Map(snapshot.edges);
          s.faces = new Map(snapshot.faces);
          s.selectedIds.clear();
        }
      });
    },

    redo: () => {
      const state = get();
      if (state.historyIndex >= state.history.length - 1) return;

      set((s) => {
        s.historyIndex++;
        const snapshot = s.history[s.historyIndex];
        s.vertices = new Map(snapshot.vertices);
        s.edges = new Map(snapshot.edges);
        s.faces = new Map(snapshot.faces);
        s.selectedIds.clear();
      });
    },

    // Snap operations
    setActiveSnap: (snap: SnapResult | null) => {
      set((state) => {
        state.activeSnap = snap;
      });
    },

    setGridSize: (size: number) => {
      set((state) => {
        state.gridSize = size;
      });
    },

    toggleSnap: () => {
      set((state) => {
        state.snapEnabled = !state.snapEnabled;
      });
    },

    // Camera operations
    setCameraPosition: (position: Vector3Tuple) => {
      set((state) => {
        state.cameraPosition = position;
      });
    },

    setCameraTarget: (target: Vector3Tuple) => {
      set((state) => {
        state.cameraTarget = target;
      });
    },

    // Scene operations
    clearScene: () => {
      set((state) => {
        state.vertices.clear();
        state.edges.clear();
        state.faces.clear();
        state.groups.clear();
        state.selectedIds.clear();
        state.selectedType = null;
        state.hoveredId = null;
        state.hoveredType = null;
        state.isDrawing = false;
        state.drawStartVertexId = null;
        state.previewPoint = null;
        state.rectangleStartPoint = null;
        state.rectanglePreviewCorners = null;
        state.rectangleIsVertical = false;
        state.circleCenter = null;
        state.circlePreviewVertices = null;
        state.arcCenter = null;
        state.arcRadius = 0;
        state.arcStartAngle = null;
        state.arcEndAngle = null;
        state.arcPreviewVertices = null;
        // Clear history on scene clear
        state.history = [];
        state.historyIndex = -1;
      });
    },

    getVertexById: (id: string) => {
      return get().vertices.get(id);
    },

    getEdgeById: (id: string) => {
      return get().edges.get(id);
    },

    getConnectedEdges: (vertexId: string) => {
      const vertex = get().vertices.get(vertexId);
      if (!vertex) return [];
      return vertex.edges
        .map((edgeId) => get().edges.get(edgeId))
        .filter((e): e is Edge => e !== undefined);
    },
  }))
);

// Selector hooks for common patterns
export const useVertices = () => useSceneStore((state) => state.vertices);
export const useEdges = () => useSceneStore((state) => state.edges);
export const useSelection = () =>
  useSceneStore((state) => ({
    selectedIds: state.selectedIds,
    selectedType: state.selectedType,
    hoveredId: state.hoveredId,
    hoveredType: state.hoveredType,
  }));
export const useActiveTool = () => useSceneStore((state) => state.activeTool);
export const useIsDrawing = () =>
  useSceneStore((state) => ({
    isDrawing: state.isDrawing,
    drawStartVertexId: state.drawStartVertexId,
    previewPoint: state.previewPoint,
  }));
export const useSnap = () =>
  useSceneStore((state) => ({
    activeSnap: state.activeSnap,
    gridSize: state.gridSize,
    snapEnabled: state.snapEnabled,
  }));
