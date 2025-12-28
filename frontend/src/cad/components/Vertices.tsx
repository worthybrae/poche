/**
 * Renders vertices - only visible when hovered or selected (like SketchUp).
 * Vertices exist in the data model but are normally invisible.
 */

import { useSceneStore } from '../core/store';

const VERTEX_RADIUS = 0.08;

export function Vertices() {
  const vertices = useSceneStore((state) => state.vertices);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const hoveredId = useSceneStore((state) => state.hoveredId);
  const hoveredType = useSceneStore((state) => state.hoveredType);

  // Convert Map to array for rendering
  const vertexArray = Array.from(vertices.values());

  return (
    <group>
      {vertexArray.map((vertex) => {
        const isSelected = selectedIds.has(vertex.id);
        const isHovered = hoveredId === vertex.id && hoveredType === 'vertex';

        // Only render vertex if it's selected or hovered
        if (!isSelected && !isHovered) return null;

        const color = isSelected ? '#fbbf24' : '#34d399'; // yellow if selected, green if hovered

        return (
          <mesh
            key={vertex.id}
            position={vertex.position}
          >
            <sphereGeometry args={[VERTEX_RADIUS, 12, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}
