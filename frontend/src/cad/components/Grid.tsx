/**
 * Ground plane grid for the CAD viewport.
 * Architectural scale: 1 unit = 1 inch
 * Minor grid = 1 foot (12"), Major grid = 10 feet (120")
 * Designed for lot sizes up to 1+ acre (208' x 208')
 */

import { Grid } from '@react-three/drei';

// Grid constants (1 unit = 1 inch)
const CELL_SIZE = 12; // 1 foot
const SECTION_SIZE = 120; // 10 feet

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

      {/* Axis lines - 10 feet each direction */}
      <axesHelper args={[120]} />
    </>
  );
}
