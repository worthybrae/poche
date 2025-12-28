/**
 * Hover indicator that shows a small green circle at the current snap position.
 * Only visible when line tool is active.
 */

import { useSceneStore } from '../core/store';

const INDICATOR_RADIUS = 0.04;
const INDICATOR_COLOR = '#22c55e'; // Green

export function HoverIndicator() {
  const activeTool = useSceneStore((state) => state.activeTool);
  const previewPoint = useSceneStore((state) => state.previewPoint);

  // Only show when line tool is active and we have a preview point
  if (activeTool !== 'line' || !previewPoint) return null;

  return (
    <mesh position={previewPoint}>
      <sphereGeometry args={[INDICATOR_RADIUS, 16, 16]} />
      <meshBasicMaterial color={INDICATOR_COLOR} transparent opacity={0.8} />
    </mesh>
  );
}
