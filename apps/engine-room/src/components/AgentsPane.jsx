import { useTelemetry } from '../hooks/TelemetryContext';

export default function AgentsPane() {
  const { agents } = useTelemetry();
  return (
    <section className="bg-[#0d1117] flex flex-col overflow-hidden relative">
      <header className="h-8 bg-surface-container-highest flex items-center justify-between px-4 border-b border-[#00ff41]/10">
        <span className="label-sm font-bold tracking-widest text-[#00ff41]/70 uppercase">02 // AGENTS</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ff41]"></span>
          <span className="text-[10px] text-[#00ff41]">ALL SYSTEMS NOMINAL</span>
        </div>
      </header>
      <div className="flex-1 p-4 overflow-y-auto space-y-px bg-[#00ff41]/5">
        {agents && agents.map((agent) => (
          <div key={agent.id} className="bg-[#10141a] p-4 flex items-center justify-between hover:bg-[#181c22] transition-colors border-b border-[#00ff41]/10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img className={`w-10 h-10 grayscale border ${agent.isActive ? 'border-[#00ff41]/30' : 'border-[#00ff41]/30 opacity-50'}`} alt={agent.name} src={agent.avatar}/>
                <span className={`absolute bottom-0 right-0 w-2 h-2 border border-[#10141a] ${agent.isActive ? 'bg-[#00ff41]' : 'bg-[#dfe2eb]/20'}`}></span>
              </div>
              <div>
                <div className={`text-xs font-black ${agent.isActive ? 'text-[#00ff41]' : 'text-[#dfe2eb]/40'}`}>{agent.name}</div>
                <div className="text-[9px] text-[#dfe2eb]/40 font-mono tracking-tighter">{agent.status}</div>
              </div>
            </div>
            <div className={`grid grid-cols-3 gap-6 text-right ${agent.isActive ? '' : 'opacity-30'}`}>
              <div>
                <div className="text-[8px] text-[#dfe2eb]/30 uppercase">CPU</div>
                <div className={`text-xs font-mono ${agent.isActive ? 'text-[#00ff41]' : ''}`}>{agent.cpu}%</div>
              </div>
              <div>
                <div className="text-[8px] text-[#dfe2eb]/30 uppercase">GPU</div>
                <div className={`text-xs font-mono ${agent.isActive ? 'text-[#00ff41]' : ''}`}>{agent.gpu}%</div>
              </div>
              <div>
                <div className="text-[8px] text-[#dfe2eb]/30 uppercase">UPTIME</div>
                <div className={`text-xs font-mono ${agent.isActive ? 'text-[#00ff41]' : ''}`}>{agent.uptime}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
