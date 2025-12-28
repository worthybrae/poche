/**
 * Status bar component showing coordinates, tool hints, and scene info.
 */

import { useSceneStore } from '../core/store';
import type { ToolType } from '../core/types';
import { Grid3X3, MousePointer, Layers } from 'lucide-react';

const TOOL_HINTS: Record<ToolType, string> = {
  select: 'Click to select. Shift+click to add to selection.',
  line: 'Hold A to draw. Click to place points. Release A when done.',
  rectangle: 'Hold S to draw. Click corners. +Shift for vertical walls.',
  circle: 'Hold D to draw. Click center, then drag for radius.',
  arc: 'Hold D+Space. Click center, start, then end point.',
  pushpull: 'Click a face and drag to extrude.',
  move: 'Select geometry, then drag to move.',
  rotate: 'Select geometry, then drag to rotate.',
  scale: 'Select geometry, then drag to scale.',
  orbit: 'Hold Shift to orbit camera. Scroll to zoom.',
  pan: 'Drag to pan camera.',
  eraser: 'Click to delete geometry.',
};

export function StatusBar() {
  const activeTool = useSceneStore((state) => state.activeTool);
  const previewPoint = useSceneStore((state) => state.previewPoint);
  const vertices = useSceneStore((state) => state.vertices);
  const edges = useSceneStore((state) => state.edges);
  const faces = useSceneStore((state) => state.faces);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const gridSize = useSceneStore((state) => state.gridSize);
  const snapEnabled = useSceneStore((state) => state.snapEnabled);
  const toggleSnap = useSceneStore((state) => state.toggleSnap);
  const setGridSize = useSceneStore((state) => state.setGridSize);

  // Format coordinate as feet and inches (e.g., 2'-6" or 6")
  const formatCoord = (n: number) => {
    const totalInches = Math.abs(n);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    const sign = n < 0 ? '-' : '';

    if (feet === 0) {
      return `${sign}${inches.toFixed(1)}"`;
    }
    return `${sign}${feet}'-${inches.toFixed(1)}"`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-slate-800/95 backdrop-blur border-t border-slate-700 flex items-center px-4 text-sm text-slate-300">
      {/* Tool hint */}
      <div className="flex-1 truncate">
        {TOOL_HINTS[activeTool]}
      </div>

      {/* Coordinates */}
      {previewPoint && (
        <div className="flex items-center gap-2 px-4 border-l border-slate-600">
          <MousePointer size={14} className="text-slate-500" />
          <span className="font-mono">
            X: {formatCoord(previewPoint[0])} Y: {formatCoord(previewPoint[1])} Z:{' '}
            {formatCoord(previewPoint[2])}
          </span>
        </div>
      )}

      {/* Grid settings */}
      <div className="flex items-center gap-2 px-4 border-l border-slate-600">
        <button
          onClick={toggleSnap}
          className={`flex items-center gap-1 px-2 py-0.5 rounded ${
            snapEnabled ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle grid snap"
        >
          <Grid3X3 size={14} />
          <span>Snap</span>
        </button>
        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="bg-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs"
        >
          <option value={0.25}>1/4"</option>
          <option value={0.5}>1/2"</option>
          <option value={1}>1"</option>
          <option value={3}>3"</option>
          <option value={6}>6"</option>
          <option value={12}>1'</option>
        </select>
      </div>

      {/* Scene stats */}
      <div className="flex items-center gap-3 pl-4 border-l border-slate-600 text-slate-400">
        <Layers size={14} />
        <span>{vertices.size} vertices</span>
        <span>{edges.size} edges</span>
        <span>{faces.size} faces</span>
        {selectedIds.size > 0 && (
          <span className="text-blue-400">{selectedIds.size} selected</span>
        )}
      </div>
    </div>
  );
}
