/**
 * Scene content component that renders all geometry and handles interactions.
 * Supports SketchUp-style 3D drawing with axis inference and colored lines.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../core/store';
import { computeSnap } from '../core/utils';
import { Vertices } from './Vertices';
import { Edges, PreviewLine, RectanglePreview, CirclePreview, ArcPreview } from './Edges';
import { Faces } from './Faces';
import { HoverIndicator } from './HoverIndicator';
import type { Vector3Tuple } from '../core/types';

function InteractionPlane() {
  const { camera } = useThree();

  // Use refs for current state to avoid stale closures
  // Note: Rectangle-specific state (rectangleStartPoint) is read directly from the store
  // to avoid timing issues with the subscription
  const stateRef = useRef({
    activeTool: useSceneStore.getState().activeTool,
    isDrawing: useSceneStore.getState().isDrawing,
    drawStartVertexId: useSceneStore.getState().drawStartVertexId,
    gridSize: useSceneStore.getState().gridSize,
    snapEnabled: useSceneStore.getState().snapEnabled,
  });

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = useSceneStore.subscribe((state) => {
      stateRef.current = {
        activeTool: state.activeTool,
        isDrawing: state.isDrawing,
        drawStartVertexId: state.drawStartVertexId,
        gridSize: state.gridSize,
        snapEnabled: state.snapEnabled,
      };
    });
    return unsubscribe;
  }, []);

  // Get start vertex position for axis inference
  const getStartPosition = useCallback((): Vector3Tuple | null => {
    const { drawStartVertexId } = stateRef.current;
    if (!drawStartVertexId) return null;
    const vertex = useSceneStore.getState().vertices.get(drawStartVertexId);
    return vertex ? vertex.position : null;
  }, []);

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const { activeTool, isDrawing, drawStartVertexId, snapEnabled, gridSize } = stateRef.current;
      if (activeTool !== 'line' && activeTool !== 'rectangle' && activeTool !== 'circle' && activeTool !== 'arc') return;

      const store = useSceneStore.getState();

      if (activeTool === 'rectangle') {
        // For rectangle, snap to grid on the ground plane
        const snapResult = computeSnap(
          event.ray,
          camera,
          store.vertices,
          null, // No axis inference for rectangle
          null,
          gridSize,
          snapEnabled
        );

        // Read rectangle state directly from store to avoid stale closure issues
        const rectStartPoint = store.rectangleStartPoint;
        const rectIsDrawing = store.isDrawing;
        const isShiftHeld = store.isShiftHeld;

        if (rectStartPoint && rectIsDrawing) {
          // Calculate height for vertical wall only if Shift is held
          let height = 0;

          if (isShiftHeld) {
            // Create a vertical plane through the start point, facing the camera
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            // Use only horizontal component for plane normal (project to XZ plane)
            const planeNormal = new THREE.Vector3(cameraDir.x, 0, cameraDir.z).normalize();

            if (planeNormal.length() > 0.01) {
              const verticalPlane = new THREE.Plane();
              verticalPlane.setFromNormalAndCoplanarPoint(
                planeNormal,
                new THREE.Vector3(rectStartPoint[0], rectStartPoint[1], rectStartPoint[2])
              );

              const verticalIntersection = new THREE.Vector3();
              if (event.ray.intersectPlane(verticalPlane, verticalIntersection)) {
                // Height is the Y difference from start point
                height = verticalIntersection.y - rectStartPoint[1];
                // Snap height to grid if enabled
                if (snapEnabled) {
                  height = Math.round(height / gridSize) * gridSize;
                }
              }
            }
          }

          // Update rectangle preview with height (only used if isShiftHeld)
          store.updateRectanglePreview(snapResult.point, height, isShiftHeld);
        } else {
          // Just update hover preview
          store.updatePreview(snapResult.point, snapResult.color);
        }
        return;
      }

      if (activeTool === 'circle') {
        // For circle, snap to grid on the ground plane
        const snapResult = computeSnap(
          event.ray,
          camera,
          store.vertices,
          null,
          null,
          gridSize,
          snapEnabled
        );

        // Read circle state directly from store
        const circleCenter = store.circleCenter;
        const circleIsDrawing = store.isDrawing;

        if (circleCenter && circleIsDrawing) {
          // Update circle preview
          store.updateCirclePreview(snapResult.point);
        } else {
          // Just update hover preview
          store.updatePreview(snapResult.point, snapResult.color);
        }
        return;
      }

      if (activeTool === 'arc') {
        // For arc, snap to grid on the ground plane
        const snapResult = computeSnap(
          event.ray,
          camera,
          store.vertices,
          null,
          null,
          gridSize,
          snapEnabled
        );

        // Read arc state directly from store
        const arcCenter = store.arcCenter;
        const arcIsDrawing = store.isDrawing;

        if (arcCenter && arcIsDrawing) {
          // Calculate angle from center to current point
          const dx = snapResult.point[0] - arcCenter[0];
          const dz = snapResult.point[2] - arcCenter[2];
          const currentAngle = Math.atan2(dz, dx);

          // Use the starting angle (from first click after center) and sweep to current
          const startAngle = store.arcStartAngle ?? currentAngle;
          let endAngle = currentAngle;

          // Ensure we're sweeping in the positive direction (counter-clockwise)
          if (endAngle < startAngle) {
            endAngle += Math.PI * 2;
          }

          store.updateArcPreview(snapResult.point, startAngle, endAngle);
        } else {
          // Just update hover preview
          store.updatePreview(snapResult.point, snapResult.color);
        }
        return;
      }

      // Line tool handling
      const startPos = getStartPosition();

      // Use comprehensive snapping with proper priority:
      // 1. Vertex snap (highest)
      // 2. Axis constraint (if drawing) - uses ray-based inference
      // 3. Grid snap (lowest)
      const snapResult = computeSnap(
        event.ray,
        camera,
        store.vertices,
        isDrawing ? startPos : null,
        drawStartVertexId,
        gridSize,
        snapEnabled
      );

      store.updatePreview(snapResult.point, snapResult.color);
    },
    [camera, getStartPosition]
  );

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const { activeTool } = stateRef.current;
      // Stop propagation for drawing tools to prevent OrbitControls from activating
      if ((activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'arc') && event.button === 0) {
        event.stopPropagation();
      }
    },
    []
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const { activeTool, isDrawing, drawStartVertexId, snapEnabled, gridSize } =
        stateRef.current;

      if (activeTool !== 'line' && activeTool !== 'rectangle' && activeTool !== 'circle' && activeTool !== 'arc') return;

      // Stop the event from propagating
      event.stopPropagation();

      const store = useSceneStore.getState();

      // Handle rectangle tool
      if (activeTool === 'rectangle') {
        // Read rectangle state directly from store
        const rectStartPoint = store.rectangleStartPoint;

        if (!rectStartPoint) {
          // First click - use RAW point (not snapped) to ensure rectangle has area
          // This prevents both corners from snapping to the same position
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersection = new THREE.Vector3();
          if (event.ray.intersectPlane(groundPlane, intersection)) {
            store.startRectangle([intersection.x, intersection.y, intersection.z]);
          }
        } else {
          // Second click - finish rectangle (uses snapped preview corners)
          store.finishRectangle();
        }
        return;
      }

      // Handle circle tool
      if (activeTool === 'circle') {
        // Read circle state directly from store
        const circleCenter = store.circleCenter;

        if (!circleCenter) {
          // First click - use RAW point for center
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersection = new THREE.Vector3();
          if (event.ray.intersectPlane(groundPlane, intersection)) {
            store.startCircle([intersection.x, intersection.y, intersection.z]);
          }
        } else {
          // Second click - finish circle
          store.finishCircle();
        }
        return;
      }

      // Handle arc tool
      if (activeTool === 'arc') {
        const arcCenter = store.arcCenter;

        if (!arcCenter) {
          // First click - set center
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersection = new THREE.Vector3();
          if (event.ray.intersectPlane(groundPlane, intersection)) {
            store.startArc([intersection.x, intersection.y, intersection.z]);
          }
        } else if (store.arcStartAngle === null) {
          // Second click - set start angle and radius
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersection = new THREE.Vector3();
          if (event.ray.intersectPlane(groundPlane, intersection)) {
            const dx = intersection.x - arcCenter[0];
            const dz = intersection.z - arcCenter[2];
            const startAngle = Math.atan2(dz, dx);
            // Set initial arc (zero sweep, will grow as mouse moves)
            store.updateArcPreview([intersection.x, intersection.y, intersection.z], startAngle, startAngle);
          }
        } else {
          // Third click - finish arc
          store.finishArc();
        }
        return;
      }

      // Handle line tool
      const startPos = getStartPosition();

      // Use comprehensive snapping with proper priority
      const snapResult = computeSnap(
        event.ray,
        camera,
        store.vertices,
        isDrawing ? startPos : null,
        drawStartVertexId, // Exclude start vertex
        gridSize,
        snapEnabled
      );

      if (!isDrawing) {
        // Start a new line
        if (snapResult.snapType === 'vertex' && snapResult.vertexId) {
          // Snapped to existing vertex - start from there
          store.startDrawing(snapResult.vertexId);
        } else {
          // Create new vertex at snapped position
          const vertexId = store.addVertex(snapResult.point);
          store.startDrawing(vertexId);
        }
      } else if (drawStartVertexId) {
        // Continue drawing
        if (snapResult.snapType === 'vertex' && snapResult.vertexId) {
          // Snapped to existing vertex - connect to it
          if (snapResult.vertexId !== drawStartVertexId) {
            store.addEdge(drawStartVertexId, snapResult.vertexId);
            store.startDrawing(snapResult.vertexId);
          }
          // If same as start vertex, do nothing
        } else {
          // Create new vertex at snapped position (axis or grid)
          const endVertexId = store.addVertex(snapResult.point);
          store.addEdge(drawStartVertexId, endVertexId);
          store.startDrawing(endVertexId);
        }
      }
    },
    [camera, getStartPosition]
  );

  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const { activeTool, isDrawing } = stateRef.current;
      const store = useSceneStore.getState();
      if (activeTool === 'line' && isDrawing) {
        event.nativeEvent.preventDefault();
        store.finishDrawing();
      } else if (activeTool === 'rectangle' && store.rectangleStartPoint) {
        event.nativeEvent.preventDefault();
        store.cancelRectangle();
      } else if (activeTool === 'circle' && store.circleCenter) {
        event.nativeEvent.preventDefault();
        store.cancelCircle();
      } else if (activeTool === 'arc' && store.arcCenter) {
        event.nativeEvent.preventDefault();
        store.cancelArc();
      }
    },
    []
  );

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { activeTool, isDrawing } = stateRef.current;
      const store = useSceneStore.getState();
      if (event.key === 'Escape') {
        if (activeTool === 'line' && isDrawing) {
          store.finishDrawing();
        } else if (activeTool === 'rectangle' && store.rectangleStartPoint) {
          store.cancelRectangle();
        } else if (activeTool === 'circle' && store.circleCenter) {
          store.cancelCircle();
        } else if (activeTool === 'arc' && store.arcCenter) {
          store.cancelArc();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.001, 0]}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
    </mesh>
  );
}

export function SceneContent() {
  return (
    <group>
      {/* Invisible interaction plane */}
      <InteractionPlane />

      {/* Geometry rendering - faces first (behind), then edges, then vertices */}
      <Faces />
      <Edges />
      <Vertices />
      <PreviewLine />
      <RectanglePreview />
      <CirclePreview />
      <ArcPreview />
      <HoverIndicator />
    </group>
  );
}
