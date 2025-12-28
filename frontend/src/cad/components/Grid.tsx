/**
 * Ground plane grid for the CAD viewport.
 * Uses feet and inches: minor ticks = inches, major ticks = feet.
 * 1 foot = 12 inches
 */

import { Grid } from '@react-three/drei';

// Grid constants (1 unit = 1 inch)
const INCHES_PER_FOOT = 12;
const CELL_SIZE = 1; // 1 inch
const SECTION_SIZE = INCHES_PER_FOOT; // 1 foot

export function CADGrid() {
  return (
    <>
      {/* Main infinite grid - inches and feet */}
      <Grid
        position={[0, 0, 0]}
        args={[200, 200]}
        cellSize={CELL_SIZE}
        cellThickness={0.3}
        cellColor="#3a4555"
        sectionSize={SECTION_SIZE}
        sectionThickness={1.2}
        sectionColor="#718096"
        fadeDistance={150}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Axis lines at origin */}
      <axesHelper args={[24]} />
    </>
  );
}
