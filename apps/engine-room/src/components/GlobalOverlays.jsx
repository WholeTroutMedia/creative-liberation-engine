import { useTelemetry } from '../hooks/TelemetryContext';
import { useAudioFeedback } from '../hooks/useAudioFeedback';

export default function GlobalOverlays() {
  const telemetry = useTelemetry();
  useAudioFeedback(telemetry);

  return (
    <>
      <div className="scanline"></div>
      <div className="fixed bottom-0 left-0 w-full h-1 bg-[#00ff41]/10 z-50">
        <div className="h-full bg-[#00ff41] w-[35%] shadow-[0_0_10px_rgba(0,255,65,0.8)]"></div>
      </div>
      <div className="fixed top-20 right-6 pointer-events-none space-y-4 text-right z-50">
        <div className="bg-surface-container-lowest/80 border-r-2 border-[#00ff41] p-2 backdrop-blur-md">
          <div className="text-[8px] text-[#dfe2eb]/40 uppercase tracking-widest">Global Heat</div>
          <div className="text-lg font-black text-[#00ff41] glow-active">{telemetry.globalHeat.toFixed(1)}%</div>
        </div>
        <div className="bg-surface-container-lowest/80 border-r-2 border-[#00ff41] p-2 backdrop-blur-md">
          <div className="text-[8px] text-[#dfe2eb]/40 uppercase tracking-widest">Nodes Active</div>
          <div className="text-lg font-black text-[#00ff41] glow-active">{telemetry.nodesActive.toLocaleString()}</div>
        </div>
      </div>
    </>
  );
}
