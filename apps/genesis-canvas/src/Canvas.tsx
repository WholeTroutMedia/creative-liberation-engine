import React, { useState } from "react";

export interface CanvasElement {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GenesisCanvasProps {
  initialElements: CanvasElement[];
  onElementMove?: (id: string, x: number, y: number) => void;
}

export const GenesisCanvas: React.FC<GenesisCanvasProps> = ({ initialElements, onElementMove }) => {
  const [elements, setElements] = useState<CanvasElement[]>(initialElements);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    setActiveDragId(id);
  };

  const handleDragEnd = () => {
    setActiveDragId(null);
  };

  const moveElement = (id: string, x: number, y: number) => {
    setElements(prev =>
      prev.map(el => (el.id === id ? { ...el, x, y } : el))
    );
    if (onElementMove) {
      onElementMove(id, x, y);
    }
  };

  return (
    <div className="genesis-workspace-canvas relative w-full h-[600px] bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] overflow-hidden border border-white/10 rounded-3xl">
      {/* Infinite Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="absolute top-4 left-4 z-10 font-mono text-xs text-teal-400 bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
        Workspace: 1024 x 768 | Active Elements: {elements.length}
      </div>

      {elements.map(el => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: `${el.x}px`,
            top: `${el.y}px`,
            width: `${el.width}px`,
            height: `${el.height}px`,
            cursor: activeDragId === el.id ? "grabbing" : "grab"
          }}
          className={`flex flex-col p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white shadow-2xl transition-all select-none hover:border-teal-400/40 ${
            activeDragId === el.id ? "border-teal-400 shadow-teal-500/20 scale-[1.02]" : ""
          }`}
          onMouseDown={() => handleDragStart(el.id)}
          onMouseUp={handleDragEnd}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
              {el.type}
            </span>
            <span className="text-[9px] font-mono text-teal-400">
              X:{el.x} Y:{el.y}
            </span>
          </div>
          <div className="flex-grow flex items-center justify-center font-medium text-sm text-center">
            {el.label}
          </div>
        </div>
      ))}
    </div>
  );
};
