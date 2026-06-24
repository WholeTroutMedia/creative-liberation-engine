import { useTelemetry } from '../hooks/TelemetryContext';

export default function TopAppBar() {
  const { latency } = useTelemetry();

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-[#10141a]/80 backdrop-blur-xl border-b border-[#00ff41]/15">
      <div className="flex items-center gap-4">
        <span className="text-xl font-black text-[#00ff41] tracking-tighter">NEXUS V6 // MISSION CONTROL</span>
        <div className="h-4 w-[1px] bg-[#00ff41]/30"></div>
        <span className="font-['Space_Grotesk'] tracking-[0.05em] uppercase text-sm font-bold text-[#00ff41] glow-active">SYSTEM: ACTIVE</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex gap-4">
          <button className="material-symbols-outlined text-[#dfe2eb]/60 hover:bg-[#00ff41]/10 hover:text-[#00ff41] transition-colors p-1" data-icon="sensors">sensors</button>
          <button className="material-symbols-outlined text-[#dfe2eb]/60 hover:bg-[#00ff41]/10 hover:text-[#00ff41] transition-colors p-1" data-icon="terminal">terminal</button>
          <button className="material-symbols-outlined text-[#dfe2eb]/60 hover:bg-[#00ff41]/10 hover:text-[#00ff41] transition-colors p-1" data-icon="settings_input_component">settings_input_component</button>
        </div>
        <div className="flex items-center gap-2 border-l border-[#00ff41]/15 pl-6">
          <span className="font-['Space_Grotesk'] tracking-[0.05em] uppercase text-[10px] text-[#dfe2eb]/40">LATENCY: {latency}MS</span>
          <span className="w-2 h-2 rounded-full bg-[#00ff41] animate-pulse"></span>
        </div>
      </div>
    </header>
  );
}
