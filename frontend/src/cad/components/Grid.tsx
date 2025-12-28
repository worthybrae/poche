/**
 * Ground plane grid for the CAD viewport.
 * Architectural scale: 1 unit = 1 inch
 * Minor grid = 1 foot (12"), Major grid = 10 feet (120")
 * Designed for lot sizes up to 1+ acre (208' x 208')
 */

import { Grid, Line } from '@react-three/drei';
import type { Vector3Tuple } from 'three';

// Grid constants (1 unit = 1 inch)
const CELL_SIZE = 12; // 1 foot
const SECTION_SIZE = 120; // 10 feet
const AXIS_LENGTH = 120; // 10 feet

// Softer axis colors matching the view gizmo
const AXIS_COLORS = {
  x: '#e57373', // Soft red
  y: '#81c784', // Soft green
  z: '#64b5f6', // Soft blue
};

function CustomAxes() {
  const origin: Vector3Tuple = [0, 0, 0];

  return (
    <>
      {/* X axis - soft red */}
      <Line
        points={[origin, [AXIS_LENGTH, 0, 0]]}
        color={AXIS_COLORS.x}
        lineWidth={2}
      />
      {/* Y axis - soft green */}
      <Line
        points={[origin, [0, AXIS_LENGTH, 0]]}
        color={AXIS_COLORS.y}
        lineWidth={2}
      />
      {/* Z axis - soft blue */}
      <Line
        points={[origin, [0, 0, AXIS_LENGTH]]}
        color={AXIS_COLORS.z}
        lineWidth={2}
      />
    </>
  );
}

export function CADGrid() {
  return (
    <>
      {/* Architectural scale grid */}
      <Grid
        position={[0, 0, 0]}
        args={[5000, 5000]}
        cellSize={CELL_SIZE}
        cellThickness={0.4}
        cellColor="#2d3748"
        sectionSize={SECTION_SIZE}
        sectionThickness={1.5}
        sectionColor="#4a5568"
        fadeDistance={3000}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Custom axis lines with softer colors - 10 feet each direction */}
      <CustomAxes />
    </>
  );
}
