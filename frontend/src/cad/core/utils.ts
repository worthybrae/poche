/**
 * Math utilities for the CAD engine.
 */

import * as THREE from 'three';
import type { Vector3Tuple } from './types';

/**
 * Convert tuple to Three.js Vector3.
 */
export function toVector3(tuple: Vector3Tuple): THREE.Vector3 {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

/**
 * Convert Three.js Vector3 to tuple.
 */
export function toTuple(vec: THREE.Vector3): Vector3Tuple {
  return [vec.x, vec.y, vec.z];
}

/**
 * Snap a value to grid.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a point to grid.
 */
export function snapPointToGrid(point: Vector3Tuple, gridSize: number): Vector3Tuple {
  return [
    snapToGrid(point[0], gridSize),
    snapToGrid(point[1], gridSize),
    snapToGrid(point[2], gridSize),
  ];
}

/**
 * Calculate distance between two points.
 */
export function distance(p1: Vector3Tuple, p2: Vector3Tuple): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get midpoint between two points.
 */
export function midpoint(p1: Vector3Tuple, p2: Vector3Tuple): Vector3Tuple {
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
}

/**
 * Check if two points are approximately equal.
 */
export function pointsEqual(
  p1: Vector3Tuple,
  p2: Vector3Tuple,
  tolerance: number = 0.001
): boolean {
  return distance(p1, p2) < tolerance;
}

/**
 * Project a screen point to a plane at y=0.
 */
export function projectToGroundPlane(
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  canvasWidth: number,
  canvasHeight: number
): Vector3Tuple | null {
  const mouse = new THREE.Vector2(
    (screenX / canvasWidth) * 2 - 1,
    -(screenY / canvasHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();

  if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
    return toTuple(intersection);
  }

  return null;
}

/**
 * Find the closest axis to a direction vector.
 */
export function closestAxis(direction: Vector3Tuple): 'x' | 'y' | 'z' {
  const abs = [Math.abs(direction[0]), Math.abs(direction[1]), Math.abs(direction[2])];
  const max = Math.max(...abs);
  if (abs[0] === max) return 'x';
  if (abs[1] === max) return 'y';
  return 'z';
}

/**
 * Constrain movement to an axis.
 */
export function constrainToAxis(
  point: Vector3Tuple,
  origin: Vector3Tuple,
  axis: 'x' | 'y' | 'z'
): Vector3Tuple {
  const result: Vector3Tuple = [...origin];
  if (axis === 'x') result[0] = point[0];
  if (axis === 'y') result[1] = point[1];
  if (axis === 'z') result[2] = point[2];
  return result;
}

/**
 * Linear interpolation between two points.
 */
export function lerp(p1: Vector3Tuple, p2: Vector3Tuple, t: number): Vector3Tuple {
  return [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t,
    p1[2] + (p2[2] - p1[2]) * t,
  ];
}

// SketchUp-style axis colors
export const AXIS_COLORS = {
  x: '#e74c3c', // Red
  y: '#2ecc71', // Green (up/down)
  z: '#3498db', // Blue
  none: '#a0aec0', // Gray (off-axis)
  vertex: '#22c55e', // Bright green for vertex snap
} as const;

export type InferredAxis = 'x' | 'y' | 'z' | 'none';
export type SnapType = 'vertex' | 'axis' | 'grid' | 'none';

export interface AxisInferenceResult {
  axis: InferredAxis;
  point: Vector3Tuple;
  color: string;
}

export interface SnapResultFull {
  point: Vector3Tuple;
  color: string;
  snapType: SnapType;
  vertexId?: string; // If snapped to a vertex
  axis?: InferredAxis; // If constrained to an axis
}

// Threshold angle (in radians) for axis lock - about 15 degrees
const AXIS_LOCK_THRESHOLD = Math.PI / 12;

/**
 * Infer which axis the user is drawing along based on direction from start point.
 * Returns the axis, constrained point, and color.
 */
export function inferAxis(
  startPoint: Vector3Tuple,
  rawEndPoint: Vector3Tuple,
  gridSize: number,
  snapEnabled: boolean
): AxisInferenceResult {
  // Calculate direction vector
  const dx = rawEndPoint[0] - startPoint[0];
  const dy = rawEndPoint[1] - startPoint[1];
  const dz = rawEndPoint[2] - startPoint[2];

  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // If too close to start, no inference
  if (length < 0.1) {
    return {
      axis: 'none',
      point: rawEndPoint,
      color: AXIS_COLORS.none,
    };
  }

  // Normalize direction
  const dirX = dx / length;
  const dirY = dy / length;
  const dirZ = dz / length;

  // Calculate angle from each axis
  const angleX = Math.acos(Math.abs(dirX));
  const angleY = Math.acos(Math.abs(dirY));
  const angleZ = Math.acos(Math.abs(dirZ));

  // Find the smallest angle (closest to an axis)
  const minAngle = Math.min(angleX, angleY, angleZ);

  // Only lock to axis if within threshold
  if (minAngle > AXIS_LOCK_THRESHOLD) {
    // Off-axis - allow free movement on ground plane
    let point = rawEndPoint;
    if (snapEnabled) {
      point = snapPointToGrid(rawEndPoint, gridSize);
    }
    return {
      axis: 'none',
      point,
      color: AXIS_COLORS.none,
    };
  }

  // Determine which axis and constrain
  let axis: InferredAxis;
  let constrainedPoint: Vector3Tuple;

  if (angleX === minAngle) {
    axis = 'x';
    // Constrain to X axis - keep Y and Z from start point
    const xValue = snapEnabled ? snapToGrid(rawEndPoint[0], gridSize) : rawEndPoint[0];
    constrainedPoint = [xValue, startPoint[1], startPoint[2]];
  } else if (angleY === minAngle) {
    axis = 'y';
    // Constrain to Y axis (vertical) - keep X and Z from start point
    const yValue = snapEnabled ? snapToGrid(rawEndPoint[1], gridSize) : rawEndPoint[1];
    constrainedPoint = [startPoint[0], yValue, startPoint[2]];
  } else {
    axis = 'z';
    // Constrain to Z axis - keep X and Y from start point
    const zValue = snapEnabled ? snapToGrid(rawEndPoint[2], gridSize) : rawEndPoint[2];
    constrainedPoint = [startPoint[0], startPoint[1], zValue];
  }

  return {
    axis,
    point: constrainedPoint,
    color: AXIS_COLORS[axis],
  };
}

/**
 * Calculate the normal vector for a face defined by vertices.
 * Uses Newell's method for robustness with non-planar polygons.
 */
export function calculateFaceNormal(vertices: Vector3Tuple[]): Vector3Tuple {
  let nx = 0, ny = 0, nz = 0;

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];

    nx += (current[1] - next[1]) * (current[2] + next[2]);
    ny += (current[2] - next[2]) * (current[0] + next[0]);
    nz += (current[0] - next[0]) * (current[1] + next[1]);
  }

  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length < 0.0001) return [0, 1, 0]; // Default to up if degenerate

  return [nx / length, ny / length, nz / length];
}

/**
 * Check if vertices are coplanar (all on the same plane).
 */
export function areVerticesCoplanar(vertices: Vector3Tuple[], tolerance: number = 0.01): boolean {
  if (vertices.length < 4) return true; // 3 or fewer points are always coplanar

  // Use first 3 points to define a plane
  const [p0, p1, p2] = vertices;
  const v1: Vector3Tuple = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v2: Vector3Tuple = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

  // Cross product gives normal
  const normal: Vector3Tuple = [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0],
  ];

  const normalLength = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
  if (normalLength < 0.0001) return true; // Degenerate case

  // Check all other points
  for (let i = 3; i < vertices.length; i++) {
    const v: Vector3Tuple = [
      vertices[i][0] - p0[0],
      vertices[i][1] - p0[1],
      vertices[i][2] - p0[2],
    ];
    // Dot product with normal should be ~0 for coplanar
    const dot = v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2];
    if (Math.abs(dot) / normalLength > tolerance) {
      return false;
    }
  }

  return true;
}

// Vertex snap threshold - larger than grid snap for easier targeting
const VERTEX_SNAP_THRESHOLD = 1.5; // 1.5 inches

/**
 * Find the intersection point between two line segments in 3D.
 * Returns null if they don't intersect or are parallel.
 * Only returns intersection if it's within both segments (not at endpoints).
 */
export function lineSegmentIntersection(
  p1: Vector3Tuple,
  p2: Vector3Tuple,
  p3: Vector3Tuple,
  p4: Vector3Tuple,
  tolerance: number = 0.01
): Vector3Tuple | null {
  // Direction vectors
  const d1: Vector3Tuple = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
  const d2: Vector3Tuple = [p4[0] - p3[0], p4[1] - p3[1], p4[2] - p3[2]];

  // Check if lines are roughly coplanar first
  const w: Vector3Tuple = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];

  // Cross product d1 x d2
  const cross: Vector3Tuple = [
    d1[1] * d2[2] - d1[2] * d2[1],
    d1[2] * d2[0] - d1[0] * d2[2],
    d1[0] * d2[1] - d1[1] * d2[0],
  ];

  const crossLen = Math.sqrt(cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2);

  // If cross product is near zero, lines are parallel
  if (crossLen < 0.0001) return null;

  // Check if lines are coplanar: w · (d1 x d2) should be ~0
  const coplanarCheck = Math.abs(w[0] * cross[0] + w[1] * cross[1] + w[2] * cross[2]);
  if (coplanarCheck > tolerance * crossLen) return null;

  // Find intersection using parametric form
  // p1 + t * d1 = p3 + s * d2
  // Solve for t and s

  // Using the formula for line-line intersection
  const d1Len2 = d1[0] ** 2 + d1[1] ** 2 + d1[2] ** 2;
  const d2Len2 = d2[0] ** 2 + d2[1] ** 2 + d2[2] ** 2;
  const d1d2 = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
  const wd1 = w[0] * d1[0] + w[1] * d1[1] + w[2] * d1[2];
  const wd2 = w[0] * d2[0] + w[1] * d2[1] + w[2] * d2[2];

  const denom = d1Len2 * d2Len2 - d1d2 * d1d2;
  if (Math.abs(denom) < 0.0001) return null;

  const t = (d1d2 * wd2 - d2Len2 * wd1) / denom;
  const s = (d1Len2 * wd2 - d1d2 * wd1) / denom;

  // Check if intersection is within both segments (excluding endpoints)
  const endpointMargin = 0.02; // Don't split very close to endpoints
  if (t <= endpointMargin || t >= 1 - endpointMargin) return null;
  if (s <= endpointMargin || s >= 1 - endpointMargin) return null;

  // Calculate intersection point
  const intersection: Vector3Tuple = [
    p1[0] + t * d1[0],
    p1[1] + t * d1[1],
    p1[2] + t * d1[2],
  ];

  // Verify the intersection point is close to both lines
  const point2: Vector3Tuple = [
    p3[0] + s * d2[0],
    p3[1] + s * d2[1],
    p3[2] + s * d2[2],
  ];

  const dist = Math.sqrt(
    (intersection[0] - point2[0]) ** 2 +
    (intersection[1] - point2[1]) ** 2 +
    (intersection[2] - point2[2]) ** 2
  );

  if (dist > tolerance) return null;

  return intersection;
}

/**
 * Calculate the angle between two vectors in degrees.
 * Returns angle in range [0, 180].
 */
export function angleBetweenVectors(v1: Vector3Tuple, v2: Vector3Tuple): number {
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const len1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const len2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);

  if (len1 < 0.0001 || len2 < 0.0001) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Calculate the angle for display when drawing a line.
 * If there's a connected edge at the start vertex, shows angle from that edge.
 * Otherwise shows angle from the horizontal plane (XZ).
 */
export function calculateDrawingAngle(
  startPoint: Vector3Tuple,
  endPoint: Vector3Tuple,
  connectedEdgeDirection: Vector3Tuple | null
): number {
  // Direction of the new line
  const newDir: Vector3Tuple = [
    endPoint[0] - startPoint[0],
    endPoint[1] - startPoint[1],
    endPoint[2] - startPoint[2],
  ];

  const length = Math.sqrt(newDir[0] ** 2 + newDir[1] ** 2 + newDir[2] ** 2);
  if (length < 0.01) return 0;

  if (connectedEdgeDirection) {
    // Calculate angle from the connected edge
    return angleBetweenVectors(newDir, connectedEdgeDirection);
  }

  // No connected edge - calculate angle from horizontal (XZ plane)
  // Project new direction onto XZ plane and calculate angle
  const horizontalDir: Vector3Tuple = [newDir[0], 0, newDir[2]];
  const horizLength = Math.sqrt(horizontalDir[0] ** 2 + horizontalDir[2] ** 2);

  if (horizLength < 0.01) {
    // Pointing straight up or down
    return 90;
  }

  // Angle from horizontal
  return angleBetweenVectors(newDir, horizontalDir);
}

/**
 * Comprehensive snapping with SketchUp-style priority:
 * 1. Vertex snap (highest) - snap to existing vertices
 * 2. Axis constraint (medium) - lock to axis if drawing and aligned
 * 3. Grid snap (lowest) - snap to grid
 *
 * @param ray - The mouse ray from camera
 * @param camera - The camera for axis inference
 * @param vertices - Map of all vertices in the scene
 * @param startPoint - Starting point if currently drawing (for axis inference)
 * @param excludeVertexId - Vertex ID to exclude from snapping (usually the start vertex)
 * @param gridSize - Grid size for snapping
 * @param snapEnabled - Whether grid snap is enabled
 */
export function computeSnap(
  ray: THREE.Ray,
  camera: THREE.Camera,
  vertices: Map<string, { id: string; position: Vector3Tuple }>,
  startPoint: Vector3Tuple | null,
  excludeVertexId: string | null,
  gridSize: number,
  snapEnabled: boolean
): SnapResultFull {
  // Priority 1: Check for nearby vertex
  // Project each vertex to screen and check distance to ray
  let closestVertexId: string | null = null;
  let closestVertexDist = VERTEX_SNAP_THRESHOLD;
  let closestVertexPos: Vector3Tuple | null = null;

  for (const [id, vertex] of vertices) {
    if (id === excludeVertexId) continue;

    // Calculate distance from vertex to ray (3D distance)
    const vertexVec = new THREE.Vector3(vertex.position[0], vertex.position[1], vertex.position[2]);
    const closestOnRay = new THREE.Vector3();
    ray.closestPointToPoint(vertexVec, closestOnRay);
    const dist = vertexVec.distanceTo(closestOnRay);

    if (dist < closestVertexDist) {
      closestVertexDist = dist;
      closestVertexId = id;
      closestVertexPos = vertex.position;
    }
  }

  // If we found a nearby vertex, snap to it (highest priority)
  if (closestVertexId && closestVertexPos) {
    return {
      point: closestVertexPos,
      color: AXIS_COLORS.vertex,
      snapType: 'vertex',
      vertexId: closestVertexId,
    };
  }

  // Priority 2: If drawing, try ray-based axis inference
  if (startPoint) {
    const axisResult = inferAxisFromRay(startPoint, ray, camera, gridSize, snapEnabled);
    return {
      point: axisResult.point,
      color: axisResult.color,
      snapType: axisResult.axis !== 'none' ? 'axis' : (snapEnabled ? 'grid' : 'none'),
      axis: axisResult.axis,
    };
  }

  // Priority 3: Not drawing - just project to ground and grid snap
  const rawPoint = getRaw3DPoint(ray, null, camera);
  if (!rawPoint) {
    return {
      point: [0, 0, 0],
      color: AXIS_COLORS.none,
      snapType: 'none',
    };
  }

  const finalPoint = snapEnabled ? snapPointToGrid(rawPoint, gridSize) : rawPoint;
  return {
    point: finalPoint,
    color: AXIS_COLORS.none,
    snapType: snapEnabled ? 'grid' : 'none',
  };
}

/**
 * Find the closest point on a line (defined by origin + direction) to a ray.
 * Returns the parameter t along the line, and the actual point.
 */
function closestPointOnLineToRay(
  lineOrigin: THREE.Vector3,
  lineDir: THREE.Vector3,
  ray: THREE.Ray
): { t: number; point: THREE.Vector3 } {
  // Algorithm: find t that minimizes distance between line point and ray
  const w0 = new THREE.Vector3().subVectors(lineOrigin, ray.origin);
  const a = lineDir.dot(lineDir);
  const b = lineDir.dot(ray.direction);
  const c = ray.direction.dot(ray.direction);
  const d = lineDir.dot(w0);
  const e = ray.direction.dot(w0);

  const denom = a * c - b * b;
  if (Math.abs(denom) < 0.0001) {
    // Lines are parallel
    return { t: 0, point: lineOrigin.clone() };
  }

  const t = (b * e - c * d) / denom;
  const point = new THREE.Vector3().addVectors(lineOrigin, lineDir.clone().multiplyScalar(t));
  return { t, point };
}

/**
 * SketchUp-style axis inference that works in screen space.
 * Detects which axis the user is drawing along based on screen direction,
 * then constrains the point TO that axis.
 */
export function inferAxisFromRay(
  startPoint: Vector3Tuple,
  ray: THREE.Ray,
  camera: THREE.Camera,
  gridSize: number,
  snapEnabled: boolean
): AxisInferenceResult {
  const startVec = new THREE.Vector3(startPoint[0], startPoint[1], startPoint[2]);

  // Define the three axis directions
  const axes = [
    { name: 'x' as const, dir: new THREE.Vector3(1, 0, 0), color: AXIS_COLORS.x },
    { name: 'y' as const, dir: new THREE.Vector3(0, 1, 0), color: AXIS_COLORS.y },
    { name: 'z' as const, dir: new THREE.Vector3(0, 0, 1), color: AXIS_COLORS.z },
  ];

  // For each axis, find the closest point on that axis line to the ray
  // and calculate how "close" the ray is to that axis
  let bestAxis: typeof axes[0] | null = null;
  let bestPoint: THREE.Vector3 | null = null;
  let bestDistance = Infinity;

  for (const axis of axes) {
    const result = closestPointOnLineToRay(startVec, axis.dir, ray);

    // Calculate distance from the ray to this point on the axis
    const closestOnRay = new THREE.Vector3();
    ray.closestPointToPoint(result.point, closestOnRay);
    const distToRay = result.point.distanceTo(closestOnRay);

    // Calculate how far along the axis we are (for threshold scaling)
    const axisDistance = result.point.distanceTo(startVec);

    // Scale threshold based on distance - further away = more forgiving
    // This mimics SketchUp's behavior where axis lock becomes easier at distance
    // Reduced for finer user control
    const threshold = Math.max(0.32, axisDistance * 0.1);

    if (distToRay < threshold && distToRay < bestDistance) {
      bestDistance = distToRay;
      bestAxis = axis;
      bestPoint = result.point;
    }
  }

  // If we found a good axis match, use it
  if (bestAxis && bestPoint) {
    let finalPoint: Vector3Tuple = toTuple(bestPoint);

    // Apply grid snap along the axis
    if (snapEnabled) {
      if (bestAxis.name === 'x') {
        finalPoint = [snapToGrid(bestPoint.x, gridSize), startPoint[1], startPoint[2]];
      } else if (bestAxis.name === 'y') {
        finalPoint = [startPoint[0], snapToGrid(bestPoint.y, gridSize), startPoint[2]];
      } else {
        finalPoint = [startPoint[0], startPoint[1], snapToGrid(bestPoint.z, gridSize)];
      }
    } else {
      // Ensure we stay exactly on axis even without grid snap
      if (bestAxis.name === 'x') {
        finalPoint = [bestPoint.x, startPoint[1], startPoint[2]];
      } else if (bestAxis.name === 'y') {
        finalPoint = [startPoint[0], bestPoint.y, startPoint[2]];
      } else {
        finalPoint = [startPoint[0], startPoint[1], bestPoint.z];
      }
    }

    return {
      axis: bestAxis.name,
      point: finalPoint,
      color: bestAxis.color,
    };
  }

  // No axis match - fall back to plane intersection
  const intersection = new THREE.Vector3();
  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);

  // Use horizontal plane at start height for off-axis drawing
  const horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -startPoint[1]);
  if (ray.intersectPlane(horizontalPlane, intersection)) {
    let point = toTuple(intersection);
    if (snapEnabled) {
      point = snapPointToGrid(point, gridSize);
    }
    return {
      axis: 'none',
      point,
      color: AXIS_COLORS.none,
    };
  }

  // Ultimate fallback
  return {
    axis: 'none',
    point: startPoint,
    color: AXIS_COLORS.none,
  };
}

/**
 * Get a raw 3D point from a ray for initial click (not drawing yet).
 * Projects onto ground plane at Y=0.
 */
export function getRaw3DPoint(
  ray: THREE.Ray,
  startPoint: Vector3Tuple | null,
  _camera: THREE.Camera
): Vector3Tuple | null {
  const intersection = new THREE.Vector3();

  // If we have a start point, project to horizontal plane at that height
  if (startPoint) {
    const horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -startPoint[1]);
    if (ray.intersectPlane(horizontalPlane, intersection)) {
      return toTuple(intersection);
    }
  }

  // Fallback: project to ground plane (Y=0)
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  if (ray.intersectPlane(groundPlane, intersection)) {
    return toTuple(intersection);
  }

  return null;
}
