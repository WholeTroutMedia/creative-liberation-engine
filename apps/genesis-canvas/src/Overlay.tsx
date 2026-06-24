import React from "react";

export interface AgentActionSuggestion {
  id: string;
  agent: string;
  suggestion: string;
  severity: "info" | "warning" | "error";
}

export interface GenesisOverlayProps {
  suggestions: AgentActionSuggestion[];
  activeAgentStatus: string;
  onApplySuggestion?: (id: string) => void;
}

export const GenesisOverlay: React.FC<GenesisOverlayProps> = ({
  suggestions,
  activeAgentStatus,
  onApplySuggestion
}) => {
  return (
    <div className="genesis-hud-overlay absolute right-6 top-6 z-20 w-80 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <h3 className="text-sm font-semibold tracking-wide text-teal-300">
          Agent Suggestion HUD
        </h3>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
        </span>
      </div>

      <div className="mb-4">
        <span className="text-[10px] text-slate-400 font-mono block mb-1">
          Active Swarm Pipeline
        </span>
        <div className="text-xs font-mono font-medium text-teal-200 bg-black/40 px-2 py-1.5 rounded-lg border border-white/5 truncate">
          {activeAgentStatus}
        </div>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {suggestions.map(s => (
          <div
            key={s.id}
            className={`p-3 rounded-xl border text-xs transition-all hover:bg-white/5 ${
              s.severity === "error"
                ? "border-red-500/20 bg-red-500/5 text-red-200"
                : s.severity === "warning"
                ? "border-amber-500/20 bg-amber-500/5 text-amber-200"
                : "border-teal-500/20 bg-teal-500/5 text-teal-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold uppercase tracking-wider text-[9px] font-mono">
                {s.agent}
              </span>
              <span className="text-[9px] opacity-60">Just now</span>
            </div>
            <p className="mb-2 text-slate-300 leading-relaxed">
              {s.suggestion}
            </p>
            {onApplySuggestion && (
              <button
                onClick={() => onApplySuggestion(s.id)}
                className="w-full py-1 px-2.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-200 hover:text-slate-950 border border-teal-400/20 font-medium font-mono text-[9px] transition-all"
              >
                Apply suggestion
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
