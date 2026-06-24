import { useState } from 'react';
import { useTelemetry } from '../hooks/TelemetryContext';

export default function DispatchPane() {
  const { dispatch } = useTelemetry();
  const [activeTab, setActiveTab] = useState('ACTIVE');

  return (
    <section className="bg-[#0d1117] flex flex-col overflow-hidden relative group">
      <header className="h-8 bg-surface-container-highest flex items-center justify-between px-4 border-b border-[#00ff41]/10">
        <span className="label-sm font-bold tracking-widest text-[#00ff41]/70 uppercase">01 // DISPATCH</span>
        <div className="flex gap-2">
          {['PENDING', 'ACTIVE', 'RESOLVED'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] px-2 py-0.5 transition-colors duration-200 ${
                activeTab === tab 
                  ? 'bg-[#00ff41]/20 text-[#00ff41] border border-[#00ff41]/50' 
                  : 'text-[#dfe2eb]/30 hover:text-[#dfe2eb]/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Kanban Column: Pending */}
        {activeTab === 'PENDING' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-[#dfe2eb]/40 border-b border-[#dfe2eb]/10 pb-2 flex justify-between">
              PENDING <span className="text-[#00ff41]">0{dispatch.pending}</span>
            </h3>
            <div className="bg-surface-container-low p-3 border-l-2 border-[#dfe2eb]/20 space-y-2 cursor-pointer hover:bg-surface-container transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#00ff41]">OP_XRAY_4</span>
                <span className="bg-error/20 text-error text-[8px] px-1 font-bold">HIGH</span>
              </div>
              <p className="text-[10px] text-[#dfe2eb]/60">SATELLITE DOWNLINK RECALIBRATION</p>
              <div className="text-[9px] text-[#dfe2eb]/30 font-mono">T-MINUS: 00:42:10</div>
            </div>
            <div className="bg-surface-container-low p-3 border-l-2 border-[#dfe2eb]/20 space-y-2 opacity-50 cursor-pointer hover:opacity-100 hover:bg-surface-container transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#00ff41]">OP_NEON_9</span>
                <span className="bg-primary-container/10 text-primary-container text-[8px] px-1 font-bold">LOW</span>
              </div>
              <p className="text-[10px] text-[#dfe2eb]/60">ENCRYPTION HANDSHAKE TEST</p>
            </div>
          </div>
        )}

        {/* Kanban Column: Active */}
        {activeTab === 'ACTIVE' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-[#dfe2eb]/40 border-b border-[#dfe2eb]/10 pb-2 flex justify-between">
              ACTIVE <span className="text-[#00ff41]">0{dispatch.active}</span>
            </h3>
            <div className="bg-surface-container-high p-3 border-l-2 border-[#00ff41] space-y-2 relative overflow-hidden cursor-pointer hover:brightness-125 transition-all">
              <div className="absolute top-0 right-0 w-8 h-8 bg-[#00ff41]/5 rotate-45 translate-x-4 -translate-y-4"></div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#00ff41]">OP_GHOST_RUN</span>
                <span className="bg-primary-container/20 text-primary-container text-[8px] px-1 font-bold">URGENT</span>
              </div>
              <div className="w-full bg-[#00ff41]/10 h-1">
                <div className="bg-[#00ff41] h-full w-[65%]"></div>
              </div>
              <p className="text-[10px] text-white">RECOVERING ASSET: BRAVO-6</p>
            </div>
          </div>
        )}

        {/* Kanban Column: Resolved */}
        {activeTab === 'RESOLVED' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-[#dfe2eb]/40 border-b border-[#dfe2eb]/10 pb-2 flex justify-between">
              RESOLVED <span className="text-[#00ff41]">{dispatch.resolved}</span>
            </h3>
            <div className="bg-surface-container-lowest p-3 border-l-2 border-[#00ff41]/20 space-y-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity">
              <span className="text-[9px] font-bold text-[#dfe2eb]/50">OP_STATIC_V</span>
              <p className="text-[9px] text-[#dfe2eb]/40">COMPLETED - 12:04:11</p>
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00ff41]/20 to-transparent"></div>
    </section>
  );
}
