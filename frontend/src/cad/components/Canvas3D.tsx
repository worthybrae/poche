/**
 * Main 3D canvas component using React Three Fiber.
 * Provides the 3D viewport with camera controls and scene rendering.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Stats } from '@react-three/drei';
import { Suspense } from 'react';
import { MOUSE } from 'three';
import { useSceneStore } from '../core/store';
import { CADGrid } from './Grid';
import { SceneContent } from './Scene';

interface Canvas3DProps {
  showStats?: boolean;
}

// Separate component to read store inside Canvas context
function CameraControls() {
  const activeTool = useSceneStore((state) => state.activeTool);

  // Only enable orbit when not using drawing tools
  const isOrbitEnabled = activeTool === 'orbit' || activeTool === 'select';

  return (
    <OrbitControls
      makeDefault
      enabled={isOrbitEnabled}
      enableDamping={true}
      dampingFactor={0.1}
      rotateSpeed={0.5}
      panSpeed={0.5}
      enableZoom={true}
      zoomSpeed={0.5}
      minDistance={10}
      maxDistance={10000}
      maxPolarAngle={Math.PI * 0.95}
      mouseButtons={{
        LEFT: isOrbitEnabled ? MOUSE.ROTATE : undefined as unknown as MOUSE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
    />
  );
}

export function Canvas3D({ showStats = false }: Canvas3DProps) {
  return (
    <div className="w-full h-full bg-gray-100">
      <Canvas
        camera={{
          position: [300, 250, 300],
          fov: 50,
          near: 1,
          far: 50000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          logarithmicDepthBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor('#f0f0f0');
        }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={0.8}
            castShadow
          />
          <directionalLight position={[-10, 10, -10]} intensity={0.3} />

          {/* Grid */}
          <CADGrid />

          {/* Scene content (vertices, edges, faces) */}
          <SceneContent />

          {/* Camera controls */}
          <CameraControls />

          {/* View cube / orientation gizmo in corner */}
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport
              axisColors={['#e57373', '#81c784', '#64b5f6']}
              labelColor="white"
              axisHeadScale={1}
              hideNegativeAxes={false}
              labels={['X', 'Y', 'Z']}
            />
          </GizmoHelper>

          {/* Performance stats */}
          {showStats && <Stats />}
        </Suspense>
      </Canvas>
    </div>
  );
}
