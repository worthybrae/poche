/**
 * Renders edges as lines with axis-based colors.
 * Uses Line2 for thick lines with proper rendering.
 */

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useSceneStore } from '../core/store';
import { toVector3, AXIS_COLORS } from '../core/utils';
import type { Vector3Tuple } from '../core/types';

const COLORS = {
  selected: '#fbbf24', // yellow-400
  hovered: '#34d399', // green-400
  construction: '#9f7aea', // purple-400
};

// Threshold for axis detection (cosine of ~15 degrees)
const AXIS_THRESHOLD = 0.966;

/**
 * Get the axis color for an edge based on its direction.
 */
function getEdgeAxisColor(p1: Vector3Tuple, p2: Vector3Tuple): string {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (length < 0.001) return AXIS_COLORS.none;

  // Normalize and check alignment with each axis
  const absX = Math.abs(dx / length);
  const absY = Math.abs(dy / length);
  const absZ = Math.abs(dz / length);

  if (absX > AXIS_THRESHOLD) return AXIS_COLORS.x;
  if (absY > AXIS_THRESHOLD) return AXIS_COLORS.y;
  if (absZ > AXIS_THRESHOLD) return AXIS_COLORS.z;

  return AXIS_COLORS.none;
}

export function Edges() {
  const edges = useSceneStore((state) => state.edges);
  const vertices = useSceneStore((state) => state.vertices);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const hoveredId = useSceneStore((state) => state.hoveredId);
  const hoveredType = useSceneStore((state) => state.hoveredType);

  // Convert edges to line segments
  const edgeData = useMemo(() => {
    const result: Array<{
      id: string;
      points: Vector3Tuple[];
      isConstruction: boolean;
    }> = [];

    edges.forEach((edge) => {
      const v1 = vertices.get(edge.vertices[0]);
      const v2 = vertices.get(edge.vertices[1]);
      if (v1 && v2) {
        result.push({
          id: edge.id,
          points: [v1.position, v2.position],
          isConstruction: edge.isConstruction,
        });
      }
    });

    return result;
  }, [edges, vertices]);

  if (edgeData.length === 0) return null;

  return (
    <group>
      {edgeData.map(({ id, points, isConstruction }) => {
        // Get axis color based on edge direction
        const axisColor = getEdgeAxisColor(points[0], points[1]);
        let color = isConstruction ? COLORS.construction : axisColor;
        let lineWidth = 2;

        if (selectedIds.has(id)) {
          color = COLORS.selected;
          lineWidth = 3;
        } else if (hoveredId === id && hoveredType === 'edge') {
          color = COLORS.hovered;
          lineWidth = 3;
        }

        return (
          <Line
            key={id}
            points={points.map((p) => toVector3(p))}
            color={color}
            lineWidth={lineWidth}
            dashed={isConstruction}
            dashSize={0.1}
            gapSize={0.05}
          />
        );
      })}
    </group>
  );
}

/**
 * Preview line for drawing mode.
 * Uses axis-colored lines (red=X, green=Y, blue=Z, gray=off-axis).
 */
export function PreviewLine() {
  const isDrawing = useSceneStore((state) => state.isDrawing);
  const drawStartVertexId = useSceneStore((state) => state.drawStartVertexId);
  const previewPoint = useSceneStore((state) => state.previewPoint);
  const previewColor = useSceneStore((state) => state.previewColor);
  const vertices = useSceneStore((state) => state.vertices);
  const activeTool = useSceneStore((state) => state.activeTool);

  // Don't show preview line if rectangle tool is active
  if (activeTool === 'rectangle') return null;

  if (!isDrawing || !drawStartVertexId || !previewPoint) return null;

  const startVertex = vertices.get(drawStartVertexId);
  if (!startVertex) return null;

  return (
    <Line
      points={[toVector3(startVertex.position), toVector3(previewPoint)]}
      color={previewColor}
      lineWidth={2}
      dashed
      dashSize={0.1}
      gapSize={0.05}
    />
  );
}

/**
 * Preview rectangle for rectangle drawing mode.
 * Shows 4 dashed lines forming the rectangle being drawn.
 */
export function RectanglePreview() {
  const rectanglePreviewCorners = useSceneStore((state) => state.rectanglePreviewCorners);
  const activeTool = useSceneStore((state) => state.activeTool);

  if (activeTool !== 'rectangle' || !rectanglePreviewCorners || rectanglePreviewCorners.length !== 4) {
    return null;
  }

  // Create 4 edges connecting the corners
  const edges: [Vector3Tuple, Vector3Tuple][] = [];
  for (let i = 0; i < 4; i++) {
    const p1 = rectanglePreviewCorners[i];
    const p2 = rectanglePreviewCorners[(i + 1) % 4];
    edges.push([p1, p2]);
  }

  return (
    <group>
      {edges.map((edge, index) => {
        const color = getEdgeAxisColor(edge[0], edge[1]);
        return (
          <Line
            key={`rect-preview-${index}`}
            points={[toVector3(edge[0]), toVector3(edge[1])]}
            color={color}
            lineWidth={2}
            dashed
            dashSize={0.1}
            gapSize={0.05}
          />
        );
      })}
    </group>
  );
}

/**
 * Preview circle for circle drawing mode.
 * Shows dashed lines forming the circle being drawn.
 */
export function CirclePreview() {
  const circlePreviewVertices = useSceneStore((state) => state.circlePreviewVertices);
  const activeTool = useSceneStore((state) => state.activeTool);

  if (activeTool !== 'circle' || !circlePreviewVertices || circlePreviewVertices.length < 3) {
    return null;
  }

  // Create edges connecting consecutive vertices
  const edges: [Vector3Tuple, Vector3Tuple][] = [];
  for (let i = 0; i < circlePreviewVertices.length; i++) {
    const p1 = circlePreviewVertices[i];
    const p2 = circlePreviewVertices[(i + 1) % circlePreviewVertices.length];
    edges.push([p1, p2]);
  }

  return (
    <group>
      {edges.map((edge, index) => {
        const color = getEdgeAxisColor(edge[0], edge[1]);
        return (
          <Line
            key={`circle-preview-${index}`}
            points={[toVector3(edge[0]), toVector3(edge[1])]}
            color={color}
            lineWidth={2}
            dashed
            dashSize={0.1}
            gapSize={0.05}
          />
        );
      })}
    </group>
  );
}

/**
 * Preview arc for arc drawing mode.
 * Shows dashed lines forming the arc being drawn.
 */
export function ArcPreview() {
  const arcPreviewVertices = useSceneStore((state) => state.arcPreviewVertices);
  const activeTool = useSceneStore((state) => state.activeTool);

  if (activeTool !== 'arc' || !arcPreviewVertices || arcPreviewVertices.length < 2) {
    return null;
  }

  // Create edges connecting consecutive vertices (open curve)
  const edges: [Vector3Tuple, Vector3Tuple][] = [];
  for (let i = 0; i < arcPreviewVertices.length - 1; i++) {
    const p1 = arcPreviewVertices[i];
    const p2 = arcPreviewVertices[i + 1];
    edges.push([p1, p2]);
  }

  return (
    <group>
      {edges.map((edge, index) => {
        const color = getEdgeAxisColor(edge[0], edge[1]);
        return (
          <Line
            key={`arc-preview-${index}`}
            points={[toVector3(edge[0]), toVector3(edge[1])]}
            color={color}
            lineWidth={2}
            dashed
            dashSize={0.1}
            gapSize={0.05}
          />
        );
      })}
    </group>
  );
}
