import { useTelemetry } from '../hooks/TelemetryContext';

export default function MemoryPane() {
  const { memoryLogs } = useTelemetry();

  const getColorClass = (type) => {
    switch(type) {
      case 'error': return 'text-error';
      case 'sys': return 'text-[#72ff70]';
      case 'agent': return 'text-[#00ff41]';
      default: return 'text-[#00ff41]';
    }
  };

  const getContainerClass = (type) => {
    return type === 'error' ? 'flex gap-4 bg-[#00ff41]/5' : 'flex gap-4';
  };
  return (
    <section className="bg-[#0a0e14] flex flex-col overflow-hidden border-t border-[#00ff41]/30">
      <header className="h-8 bg-surface-container-highest flex items-center justify-between px-4 border-b border-[#00ff41]/10">
        <span className="label-sm font-bold tracking-widest text-[#00ff41]/70 uppercase">03 // MEMORY_LOG</span>
        <span className="text-[10px] text-[#00ff41] font-mono animate-pulse">REC ●</span>
      </header>
      <div className="flex-1 p-4 font-mono text-[10px] overflow-hidden relative">
        <div className="space-y-1.5 overflow-y-auto max-h-full">
          {memoryLogs && memoryLogs.map(log => (
            <div key={log.id} className={getContainerClass(log.type)}>
              <span className="text-[#dfe2eb]/20 shrink-0">{log.time}</span>
              <span className={`shrink-0 ${getColorClass(log.type)}`}>{log.tag}</span>
              <span className={log.type === 'error' ? 'text-error/80' : 'text-[#dfe2eb]/70'}>{log.text}</span>
            </div>
          ))}
          <div className="text-[#00ff41] mt-2 animate-pulse">█</div>
        </div>
        {/* Glass overlay for terminal effect */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0a0e14] via-transparent to-transparent opacity-40"></div>
      </div>
    </section>
  );
}
