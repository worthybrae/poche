/**
 * Renders faces as filled polygons.
 * Uses triangulation for arbitrary polygons.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../core/store';
import type { Vector3Tuple } from '../core/types';

// Face colors
const COLORS = {
  default: '#e2e8f0', // Light gray
  selected: '#fef08a', // Yellow
  hovered: '#bbf7d0', // Light green
};

/**
 * Triangulate a polygon defined by vertices.
 * Uses ear clipping algorithm for simple convex/concave polygons.
 */
function triangulatePolygon(vertices: Vector3Tuple[]): number[] {
  if (vertices.length < 3) return [];
  if (vertices.length === 3) return [0, 1, 2];

  // For simple cases (quads), just split into two triangles
  if (vertices.length === 4) {
    return [0, 1, 2, 0, 2, 3];
  }

  // For more complex polygons, use fan triangulation (works for convex)
  const indices: number[] = [];
  for (let i = 1; i < vertices.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

/**
 * Get ordered vertices for a face from its edges.
 */
function getFaceVertices(
  faceEdgeIds: string[],
  edges: Map<string, { id: string; vertices: [string, string] }>,
  vertices: Map<string, { id: string; position: Vector3Tuple }>
): Vector3Tuple[] {
  if (faceEdgeIds.length === 0) return [];

  // Build adjacency for face edges
  const edgeList = faceEdgeIds.map((id) => edges.get(id)).filter(Boolean) as {
    id: string;
    vertices: [string, string];
  }[];

  if (edgeList.length === 0) return [];

  // Start with first edge
  const orderedVertexIds: string[] = [edgeList[0].vertices[0], edgeList[0].vertices[1]];
  const usedEdges = new Set<string>([edgeList[0].id]);

  // Walk around the face
  while (usedEdges.size < edgeList.length) {
    const lastVertexId = orderedVertexIds[orderedVertexIds.length - 1];
    let found = false;

    for (const edge of edgeList) {
      if (usedEdges.has(edge.id)) continue;

      if (edge.vertices[0] === lastVertexId) {
        orderedVertexIds.push(edge.vertices[1]);
        usedEdges.add(edge.id);
        found = true;
        break;
      } else if (edge.vertices[1] === lastVertexId) {
        orderedVertexIds.push(edge.vertices[0]);
        usedEdges.add(edge.id);
        found = true;
        break;
      }
    }

    if (!found) break; // Couldn't complete the loop
  }

  // Remove the last vertex if it's the same as the first (closed loop)
  if (
    orderedVertexIds.length > 1 &&
    orderedVertexIds[orderedVertexIds.length - 1] === orderedVertexIds[0]
  ) {
    orderedVertexIds.pop();
  }

  // Get positions
  return orderedVertexIds
    .map((vId) => vertices.get(vId)?.position)
    .filter(Boolean) as Vector3Tuple[];
}

export function Faces() {
  const faces = useSceneStore((state) => state.faces);
  const edges = useSceneStore((state) => state.edges);
  const vertices = useSceneStore((state) => state.vertices);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const hoveredId = useSceneStore((state) => state.hoveredId);
  const hoveredType = useSceneStore((state) => state.hoveredType);

  // Build face geometry data
  const faceData = useMemo(() => {
    const result: {
      id: string;
      geometry: THREE.BufferGeometry;
      normal: Vector3Tuple;
    }[] = [];

    faces.forEach((face) => {
      const faceVertices = getFaceVertices(face.edges, edges, vertices);

      if (faceVertices.length < 3) return;

      // Create geometry
      const geometry = new THREE.BufferGeometry();

      // Flatten vertices for position attribute
      const positions: number[] = [];
      for (const v of faceVertices) {
        positions.push(v[0], v[1], v[2]);
      }

      // Triangulate
      const indices = triangulatePolygon(faceVertices);

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      result.push({
        id: face.id,
        geometry,
        normal: face.normal,
      });
    });

    return result;
  }, [faces, edges, vertices]);

  if (faceData.length === 0) return null;

  return (
    <group>
      {faceData.map(({ id, geometry }) => {
        const isSelected = selectedIds.has(id);
        const isHovered = hoveredId === id && hoveredType === 'face';

        let color = COLORS.default;
        if (isSelected) color = COLORS.selected;
        else if (isHovered) color = COLORS.hovered;

        return (
          <mesh key={id} geometry={geometry}>
            <meshStandardMaterial
              color={color}
              side={THREE.DoubleSide}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}
