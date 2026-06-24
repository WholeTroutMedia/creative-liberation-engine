import { useTelemetry } from '../hooks/TelemetryContext';

export default function InboxPane() {
  const { inbox } = useTelemetry();

  return (
    <section className="bg-[#0d1117] flex flex-col overflow-hidden border-t border-[#00ff41]/30 relative">
      <header className="h-8 bg-surface-container-highest flex items-center justify-between px-4 border-b border-[#00ff41]/10">
        <span className="label-sm font-bold tracking-widest text-[#00ff41]/70 uppercase">04 // INBOX</span>
        <span className="bg-error text-[8px] font-bold text-[#003907] px-2 py-0.5 animate-bounce">{inbox.newAlerts} NEW ALERTS</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        {inbox.items && inbox.items.map(item => (
          <div key={item.id} className={`p-4 border-b border-[#00ff41]/10 hover:bg-[#181c22] group transition-all ${item.priority === 'critical' ? 'bg-error/5 border-l-2 border-error' : ''}`}>
            <div className="flex justify-between mb-1">
              <span className={`text-[10px] font-bold tracking-tighter uppercase flex items-center gap-1 ${item.priority === 'critical' || item.priority === 'high' ? 'text-error' : 'text-[#00ff41]'}`}>
                <span className="material-symbols-outlined text-[12px]" data-icon={item.icon}>{item.icon}</span>
                {item.type}
              </span>
              <span className="text-[9px] text-[#dfe2eb]/30">{item.time}</span>
            </div>
            <h4 className={`text-xs font-bold mb-1 ${item.priority === 'critical' ? 'text-white' : 'text-[#dfe2eb]'}`}>{item.title}</h4>
            <p className={`text-[10px] leading-relaxed ${item.priority === 'critical' ? 'text-error-container/70' : 'text-[#dfe2eb]/50'}`}>{item.desc}</p>
          </div>
        ))}
      </div>
      {/* Contextual Dashboard Actions */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button className="bg-surface-container-high p-3 border border-[#00ff41]/20 hover:border-[#00ff41]/60 transition-all group">
          <span className="material-symbols-outlined text-[#00ff41]" data-icon="refresh">refresh</span>
        </button>
        <button className="bg-primary-container text-on-primary-container px-4 py-2 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
          INITIATE PURGE
          <span className="material-symbols-outlined text-sm" data-icon="delete_sweep">delete_sweep</span>
        </button>
      </div>
    </section>
  );
}
