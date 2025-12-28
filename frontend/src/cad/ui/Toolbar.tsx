/**
 * Toolbar component for tool display.
 * Shows available tools with keyboard shortcut badges.
 * Tools are keyboard-only - no mouse clicking.
 *
 * Hold-to-activate tools:
 * - A = Line (hold to draw lines)
 * - S = Square/Rectangle (hold to draw rectangles, +Shift for vertical walls)
 * - D = Circle (hold to draw circles, +Space for arcs)
 * - Shift (alone) = Camera orbit/pan
 * - Cmd+Z = Undo
 * - Cmd+X = Redo
 * - Shift+C = Clear all (when not holding S or D)
 */

import { useEffect, useRef } from 'react';
import { useSceneStore } from '../core/store';
import type { ToolType } from '../core/types';
import {
  MousePointer,
  Minus,
  Square,
  Circle,
  Move,
  RotateCw,
  Maximize2,
  Orbit,
  Eraser,
  Trash2,
  CircleDot,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ToolButton {
  tool: ToolType;
  icon: LucideIcon;
  label: string;
  keyBadge?: string; // The key to show as badge
  shortcutHint?: string; // Full shortcut description for tooltip
  holdToActivate?: boolean;
}

const TOOLS: ToolButton[] = [
  { tool: 'select', icon: MousePointer, label: 'Select', keyBadge: 'V', shortcutHint: 'V or release tool key' },
  { tool: 'line', icon: Minus, label: 'Line', keyBadge: 'A', shortcutHint: 'Hold A', holdToActivate: true },
  { tool: 'rectangle', icon: Square, label: 'Rectangle', keyBadge: 'S', shortcutHint: 'Hold S (+⇧ vertical)', holdToActivate: true },
  { tool: 'circle', icon: Circle, label: 'Circle', keyBadge: 'D', shortcutHint: 'Hold D', holdToActivate: true },
  { tool: 'arc', icon: CircleDot, label: 'Arc', keyBadge: '␣', shortcutHint: 'Hold D + Space' },
  { tool: 'move', icon: Move, label: 'Move', keyBadge: 'M', shortcutHint: 'M' },
  { tool: 'rotate', icon: RotateCw, label: 'Rotate', keyBadge: 'Q', shortcutHint: 'Q' },
  { tool: 'scale', icon: Maximize2, label: 'Scale' },
  { tool: 'orbit', icon: Orbit, label: 'Orbit', keyBadge: '⇧', shortcutHint: 'Hold Shift' },
  { tool: 'eraser', icon: Eraser, label: 'Eraser', keyBadge: 'E', shortcutHint: 'E' },
];

export function Toolbar() {
  const activeTool = useSceneStore((state) => state.activeTool);

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-slate-800/90 backdrop-blur rounded-lg p-2 shadow-lg border border-slate-700">
      {TOOLS.map(({ tool, icon: Icon, label, keyBadge, shortcutHint, holdToActivate }) => (
        <div
          key={tool}
          className={`
            relative group flex items-center justify-center w-10 h-10 rounded-md transition-colors cursor-default
            ${
              activeTool === tool
                ? 'bg-blue-600 text-white'
                : 'text-slate-400'
            }
          `}
          title={`${label}${shortcutHint ? ` (${shortcutHint})` : ''}`}
        >
          <Icon size={20} />
          {/* Keyboard shortcut badge */}
          {keyBadge && (
            <span className={`
              absolute -bottom-0.5 -right-0.5
              min-w-[16px] h-4 px-1
              flex items-center justify-center
              text-[10px] font-bold rounded
              ${activeTool === tool
                ? 'bg-blue-400 text-blue-900'
                : 'bg-slate-600 text-slate-300'
              }
            `}>
              {keyBadge}
            </span>
          )}
          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {label}
            {shortcutHint && (
              <span className="ml-2 text-slate-400 text-xs">{shortcutHint}</span>
            )}
            {holdToActivate && (
              <span className="block text-yellow-400 text-xs mt-1">Hold key to activate</span>
            )}
          </div>
        </div>
      ))}

      {/* Divider */}
      <div className="h-px bg-slate-600 my-1" />

      {/* Undo indicator */}
      <div
        className="relative group flex items-center justify-center w-10 h-10 rounded-md text-slate-400 cursor-default"
        title="Undo (⌘Z)"
      >
        <Undo2 size={20} />
        <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded bg-slate-600 text-slate-300">
          ⌘Z
        </span>
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          Undo
          <span className="ml-2 text-slate-400 text-xs">⌘Z</span>
        </div>
      </div>

      {/* Redo indicator */}
      <div
        className="relative group flex items-center justify-center w-10 h-10 rounded-md text-slate-400 cursor-default"
        title="Redo (⌘X)"
      >
        <Redo2 size={20} />
        <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded bg-slate-600 text-slate-300">
          ⌘X
        </span>
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          Redo
          <span className="ml-2 text-slate-400 text-xs">⌘X</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-600 my-1" />

      {/* Clear scene indicator */}
      <div
        className="relative group flex items-center justify-center w-10 h-10 rounded-md text-red-400/60 cursor-default"
        title="Clear Scene (⇧C)"
      >
        <Trash2 size={20} />
        <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded bg-slate-600 text-slate-300">
          ⇧C
        </span>
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          Clear Scene
          <span className="ml-2 text-slate-400 text-xs">⇧C</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Global keyboard handler hook for hold-to-activate tools.
 * Must be used in a component that renders.
 */
export function useToolShortcuts() {
  const setActiveTool = useSceneStore((state) => state.setActiveTool);
  const setShiftHeld = useSceneStore((state) => state.setShiftHeld);
  const setSpaceHeld = useSceneStore((state) => state.setSpaceHeld);
  const clearScene = useSceneStore((state) => state.clearScene);
  const saveToHistory = useSceneStore((state) => state.saveToHistory);
  const undo = useSceneStore((state) => state.undo);
  const redo = useSceneStore((state) => state.redo);

  // Track which tool keys are currently held
  const heldKeysRef = useRef<Set<string>>(new Set());
  const previousToolRef = useRef<ToolType>('select');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // Handle Cmd/Ctrl shortcuts
      if (event.metaKey || event.ctrlKey) {
        if (key === 'z') {
          event.preventDefault();
          undo();
          return;
        }
        if (key === 'x') {
          event.preventDefault();
          redo();
          return;
        }
      }

      // Handle Shift+C for clear (only when not holding S or D)
      if (event.shiftKey && key === 'c') {
        if (!heldKeysRef.current.has('s') && !heldKeysRef.current.has('d')) {
          event.preventDefault();
          clearScene();
        }
        return;
      }

      // Handle Shift key for camera orbit and vertical mode
      if (event.key === 'Shift' && !event.repeat) {
        setShiftHeld(true);
        // Don't switch to orbit if we're holding a drawing tool
        if (!heldKeysRef.current.has('a') && !heldKeysRef.current.has('s') && !heldKeysRef.current.has('d')) {
          // Enable orbit mode (OrbitControls handles this automatically)
        }
        return;
      }

      // Handle Space key for arc mode (when holding D)
      if (key === ' ' && !event.repeat) {
        event.preventDefault();
        setSpaceHeld(true);
        if (heldKeysRef.current.has('d')) {
          // Switch from circle to arc
          setActiveTool('arc');
        }
        return;
      }

      // Prevent repeat events
      if (event.repeat) return;

      // Hold-to-activate tools: A = line, S = square, D = circle
      const holdTools: Record<string, ToolType> = {
        'a': 'line',
        's': 'rectangle',
        'd': 'circle',
      };

      if (holdTools[key] && !heldKeysRef.current.has(key)) {
        // Save current tool before switching
        if (heldKeysRef.current.size === 0) {
          previousToolRef.current = useSceneStore.getState().activeTool;
        }

        heldKeysRef.current.add(key);

        // Check if Space is held for arc mode
        if (key === 'd' && useSceneStore.getState().isSpaceHeld) {
          setActiveTool('arc');
        } else {
          setActiveTool(holdTools[key]);
        }

        // Save to history when starting a new drawing operation
        saveToHistory();
        return;
      }

      // Other toggle-style shortcuts (click once to activate)
      const toggleTools: Record<string, ToolType> = {
        'v': 'select',
        'm': 'move',
        'q': 'rotate',
        'e': 'eraser',
      };

      if (toggleTools[key]) {
        setActiveTool(toggleTools[key]);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Handle Shift key release
      if (event.key === 'Shift') {
        setShiftHeld(false);
        return;
      }

      // Handle Space key release
      if (key === ' ') {
        setSpaceHeld(false);
        // If we were in arc mode and D is still held, go back to circle
        if (heldKeysRef.current.has('d')) {
          setActiveTool('circle');
        }
        return;
      }

      // Release hold-to-activate tools
      const holdTools: Record<string, ToolType> = {
        'a': 'line',
        's': 'rectangle',
        'd': 'circle',
      };

      if (holdTools[key] && heldKeysRef.current.has(key)) {
        heldKeysRef.current.delete(key);

        // Cancel any in-progress drawing
        const store = useSceneStore.getState();
        if (store.isDrawing) {
          if (store.activeTool === 'line') {
            store.finishDrawing();
          } else if (store.activeTool === 'rectangle') {
            store.cancelRectangle();
          } else if (store.activeTool === 'circle') {
            store.cancelCircle();
          } else if (store.activeTool === 'arc') {
            store.cancelArc();
          }
        }

        // Return to previous tool or select
        if (heldKeysRef.current.size === 0) {
          setActiveTool('select');
        }
      }
    };

    // Handle window blur (user switches away from browser)
    const handleBlur = () => {
      // Release all held keys
      heldKeysRef.current.clear();
      setShiftHeld(false);
      setSpaceHeld(false);
      setActiveTool('select');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [setActiveTool, setShiftHeld, setSpaceHeld, clearScene, saveToHistory, undo, redo]);
}
