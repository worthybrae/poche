/**
 * AI Command Bar - Floating chat interface for the CAD editor.
 * Sleek pill-shaped design with animated loading state.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, ChevronUp } from 'lucide-react';
import { api } from '../../api/client';
import { useSceneStore } from '../core/store';
import type { Vector3Tuple } from '../core/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
}

export function ChatPanel() {
  const [isFocused, setIsFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Get store actions
  const addVertex = useSceneStore((s) => s.addVertex);
  const addEdge = useSceneStore((s) => s.addEdge);
  const addFace = useSceneStore((s) => s.addFace);
  const clearScene = useSceneStore((s) => s.clearScene);
  const saveToHistory = useSceneStore((s) => s.saveToHistory);

  // Execute scene actions from AI tool calls
  const executeSceneAction = useCallback((action: string, params: Record<string, unknown>) => {
    saveToHistory();

    if (action === 'create_box') {
      const x = (params.x as number) || 0;
      const y = (params.y as number) || 0;
      const z = (params.z as number) || 0;
      const w = (params.width as number) || 24;
      const h = (params.height as number) || 24;
      const d = (params.depth as number) || 24;

      // Create 8 vertices for a box
      const halfW = w / 2;
      const halfD = d / 2;
      const corners: Vector3Tuple[] = [
        [x - halfW, y, z - halfD],     // 0: bottom front left
        [x + halfW, y, z - halfD],     // 1: bottom front right
        [x + halfW, y, z + halfD],     // 2: bottom back right
        [x - halfW, y, z + halfD],     // 3: bottom back left
        [x - halfW, y + h, z - halfD], // 4: top front left
        [x + halfW, y + h, z - halfD], // 5: top front right
        [x + halfW, y + h, z + halfD], // 6: top back right
        [x - halfW, y + h, z + halfD], // 7: top back left
      ];

      const vIds = corners.map((pos) => addVertex(pos));

      // Create 6 faces for a box (each face is a quad)
      const faces = [
        [0, 1, 2, 3], // bottom
        [4, 5, 6, 7], // top
        [0, 1, 5, 4], // front
        [2, 3, 7, 6], // back
        [0, 3, 7, 4], // left
        [1, 2, 6, 5], // right
      ];
      faces.forEach((f) => addFace(f.map((i) => vIds[i])));

    } else if (action === 'create_rectangle') {
      const x = (params.x as number) || 0;
      const z = (params.z as number) || 0;
      const w = (params.width as number) || 48;
      const d = (params.depth as number) || 48;

      const halfW = w / 2;
      const halfD = d / 2;
      const corners: Vector3Tuple[] = [
        [x - halfW, 0, z - halfD],
        [x + halfW, 0, z - halfD],
        [x + halfW, 0, z + halfD],
        [x - halfW, 0, z + halfD],
      ];

      const vIds = corners.map((pos) => addVertex(pos));
      addFace(vIds); // Creates edges and face

    } else if (action === 'create_terrain') {
      const widthFt = (params.width as number) || 208;
      const depthFt = (params.depth as number) || 208;
      const terrainType = (params.terrain_type as string) || 'sloped';
      const maxHeightFt = (params.max_height as number) || 30;
      const cliffSide = (params.cliff_side as string) || 'south';
      const resolution = Math.min((params.resolution as number) || 12, 20); // Cap at 20 for performance

      // Convert to inches
      const width = widthFt * 12;
      const depth = depthFt * 12;
      const maxHeight = maxHeightFt * 12;

      // Generate height map
      const getHeight = (nx: number, nz: number): number => {
        // nx, nz are 0-1 normalized coordinates
        let h = 0;

        if (terrainType === 'flat') {
          h = 0;
        } else if (terrainType === 'sloped') {
          // Gentle slope with cliff at one end
          const cliffPos = cliffSide === 'south' ? nz : cliffSide === 'north' ? (1 - nz) : cliffSide === 'east' ? nx : (1 - nx);
          if (cliffPos > 0.85) {
            h = maxHeight * (1 - (cliffPos - 0.85) * 6); // Sharp drop
          } else {
            h = maxHeight * (cliffPos / 0.85) * 0.7; // Gradual slope
          }
          // Add some noise
          h += Math.sin(nx * 12) * Math.cos(nz * 8) * maxHeight * 0.05;
        } else if (terrainType === 'hill') {
          const cx = nx - 0.5, cz = nz - 0.5;
          h = maxHeight * Math.max(0, 1 - Math.sqrt(cx * cx + cz * cz) * 2);
        } else if (terrainType === 'cliff') {
          const cliffPos = cliffSide === 'south' ? nz : cliffSide === 'north' ? (1 - nz) : cliffSide === 'east' ? nx : (1 - nx);
          h = cliffPos > 0.7 ? 0 : maxHeight;
        } else if (terrainType === 'valley') {
          const cx = Math.abs(nx - 0.5) * 2;
          h = maxHeight * cx;
        }

        return Math.max(0, h);
      };

      // Create grid of vertices
      const vertices: string[][] = [];
      const halfW = width / 2;
      const halfD = depth / 2;

      for (let zi = 0; zi <= resolution; zi++) {
        const row: string[] = [];
        for (let xi = 0; xi <= resolution; xi++) {
          const nx = xi / resolution;
          const nz = zi / resolution;
          const x = -halfW + nx * width;
          const z = -halfD + nz * depth;
          const y = getHeight(nx, nz);
          row.push(addVertex([x, y, z]));
        }
        vertices.push(row);
      }

      // Create faces for each grid cell (quad)
      for (let zi = 0; zi < resolution; zi++) {
        for (let xi = 0; xi < resolution; xi++) {
          // Create quad face from 4 corners
          addFace([
            vertices[zi][xi],
            vertices[zi][xi + 1],
            vertices[zi + 1][xi + 1],
            vertices[zi + 1][xi],
          ]);
        }
      }

    } else if (action === 'clear_scene') {
      clearScene();
    }
  }, [addVertex, addFace, clearScene, saveToHistory]);

  useEffect(() => {
    api.chat.status()
      .then((status) => setIsConfigured(status.configured))
      .catch(() => setIsConfigured(false));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isFocused && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && isFocused) {
        inputRef.current?.blur();
        setShowHistory(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused]);

  useEffect(() => {
    if (historyRef.current && showHistory) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, showHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setShowHistory(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await api.chat.send(userMessage, history);

      // Execute any scene actions from tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          const result = tc.result as Record<string, unknown>;
          if (result && result.action && typeof result.action === 'string') {
            executeSceneAction(result.action, (result.params as Record<string, unknown>) || {});
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          toolCalls: response.tool_calls.length > 0 ? response.tool_calls : undefined,
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Animated gradient keyframes */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }
        .loading-gradient {
          background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
          background-size: 300% 100%;
          animation: gradient-shift 2s ease infinite;
        }
        .loading-glow {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-3/4 max-w-3xl z-40">
        {/* Response Popup */}
        {showHistory && messages.length > 0 && (
          <div className="mb-2 relative">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute -top-2 right-2 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all z-10 shadow-lg"
            >
              <X size={14} />
            </button>

            <div
              ref={historyRef}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl max-h-48 overflow-y-auto"
            >
              <div className="p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className={`text-xs font-medium mt-0.5 ${
                      msg.role === 'user' ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {msg.role === 'user' ? 'You' : 'AI'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 leading-relaxed">{msg.content}</p>
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {msg.toolCalls.map((tc, j) => (
                            <span
                              key={j}
                              className="px-2 py-0.5 bg-slate-800 rounded-full text-[10px] text-slate-500"
                            >
                              {tc.tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Command Bar */}
        <div className="relative">
          {/* Loading gradient border */}
          {isLoading && (
            <div className="absolute -inset-[2px] rounded-full loading-gradient loading-glow" />
          )}

          <form
            onSubmit={handleSubmit}
            className={`
              relative bg-slate-900/95 backdrop-blur-xl rounded-full
              border transition-all duration-300
              ${isLoading ? 'border-transparent' : isFocused ? 'border-slate-600' : 'border-slate-700/50'}
              ${isFocused ? 'shadow-lg shadow-slate-900/50' : 'shadow-md'}
            `}
          >
            <div className="flex items-center gap-3 px-5 py-3">
              {/* Icon */}
              <div className={`transition-colors duration-200 ${isLoading ? 'text-blue-400' : isFocused ? 'text-slate-300' : 'text-slate-500'}`}>
                <Sparkles size={18} className={isLoading ? 'animate-pulse' : ''} />
              </div>

              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder={
                  isConfigured === false
                    ? 'API key not configured'
                    : isLoading
                    ? 'Thinking...'
                    : 'Ask AI anything... (press /)'
                }
                disabled={isLoading || isConfigured === false}
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Right side indicators */}
              <div className="flex items-center gap-2">
                {messages.length > 0 && !showHistory && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors rounded-full hover:bg-slate-800"
                  >
                    <ChevronUp size={14} />
                    <span>{messages.length}</span>
                  </button>
                )}

                {!isFocused && !isLoading && (
                  <kbd className="px-2 py-1 text-xs text-slate-600 bg-slate-800/80 rounded-md">/</kbd>
                )}

                {isFocused && input.trim() && !isLoading && (
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-full transition-colors"
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
