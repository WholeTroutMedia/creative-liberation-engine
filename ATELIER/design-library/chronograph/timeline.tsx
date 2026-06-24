import React, { useState, useMemo } from 'react';
import { TaskStatus, WorkflowNode, TimelineTrace, PerformanceBenchmark } from './types';
import { HUDIcons, MicroHUDButton, TaskStatusBadge, TerminalLine } from './controls';

// ==========================================
// 1. BEZIER CONNECTOR GRAPH (SVG RENDERER)
// ==========================================

interface NodePosition {
  id: string;
  x: number; // Percentage horizontal position (0-100)
  y: number; // Pixel vertical position
}

interface BezierConnectorsProps {
  nodes: WorkflowNode[];
  positions: Map<string, NodePosition>;
  selectedNodeId: string | null;
  criticalPath: string[];
}

export const BezierConnectors: React.FC<BezierConnectorsProps> = ({
  nodes,
  positions,
  selectedNodeId,
  criticalPath
}) => {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <defs>
        {/* Glow Filters */}
        <filter id="glow-primary" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-critical" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Arrow markers */}
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#57534E" />
        </marker>
        <marker id="arrow-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#F5F5F4" />
        </marker>
        <marker id="arrow-critical" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#F5F5F4" />
        </marker>
      </defs>

      {nodes.map((node) => {
        const targetPos = positions.get(node.id);
        if (!targetPos) return null;

        return node.dependencies.map((depId) => {
          const sourcePos = positions.get(depId);
          if (!sourcePos) return null;

          const isCritical = criticalPath.includes(node.id) && criticalPath.includes(depId);
          const isSelected = selectedNodeId === node.id || selectedNodeId === depId;

          // Compute smooth cubic Bezier control coordinates
          const startX = `${sourcePos.x}%`;
          const startY = sourcePos.y;
          const endX = `${targetPos.x}%`;
          const endY = targetPos.y;

          // String coordinates for Bezier formula
          const midX = `calc((${startX} + ${endX}) / 2)`;

          // Custom styling based on trace priority
          let strokeColor = 'rgba(87, 83, 78, 0.25)'; // Default stone gray line
          let strokeWidth = '1';
          let marker = 'url(#arrow)';
          let filter = '';
          let dashArray = '4 2';

          if (isCritical) {
            strokeColor = 'rgba(245, 245, 244, 0.45)'; // Slate-white high contrast
            strokeWidth = '1.75';
            marker = 'url(#arrow-critical)';
            dashArray = 'none';
          }

          if (isSelected) {
            strokeColor = '#F5F5F4'; // Solid Stark white glow
            strokeWidth = '2';
            marker = 'url(#arrow-selected)';
            filter = 'url(#glow-primary)';
            dashArray = 'none';
          }

          // Render path dynamically using parent container scale
          return (
            <g key={`${depId}-${node.id}`}>
              {/* Invisible thicker interaction hover zone */}
              <path
                d={`M ${sourcePos.x} ${startY} C ${(sourcePos.x + targetPos.x) / 2} ${startY}, ${(sourcePos.x + targetPos.x) / 2} ${endY}, ${targetPos.x} ${endY}`}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
                className="cursor-pointer"
                style={{
                  transform: 'scale(1)',
                }}
              />
              <path
                d={`M ${sourcePos.x}% ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${targetPos.x}% ${endY}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                markerEnd={marker}
                filter={filter}
                className="transition-all duration-300 ease-in-out"
              />
            </g>
          );
        });
      })}
    </svg>
  );
};

// ==========================================
// 2. MAIN TEMPORAL WORKFLOW PANEL & TIMELINE
// ==========================================

interface TemporalWorkflowTimelineProps {
  trace: TimelineTrace;
  benchmarks: PerformanceBenchmark[];
  onNodeSelect?: (node: WorkflowNode | null) => void;
  onRefreshTrace?: () => void;
}

export const TemporalWorkflowTimeline: React.FC<TemporalWorkflowTimelineProps> = ({
  trace,
  benchmarks,
  onNodeSelect,
  onRefreshTrace
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'METRICS' | 'LOGS' | 'BENCHMARKS'>('METRICS');

  // Compute timing ranges relative to trace startup
  const timelineTimes = useMemo(() => {
    const start = new Date(trace.startedAt).getTime();
    const end = trace.completedAt ? new Date(trace.completedAt).getTime() : Date.now();
    const totalDuration = end - start || 1000;

    // Parse specific coordinates for nodes
    const nodeCoords = new Map<string, NodePosition>();
    
    // Sort nodes to layout lanes neatly
    const maxLane = Math.max(...trace.nodes.map(n => n.laneIndex), 2);
    const laneHeight = 62; // vertical spacing pixel offset

    trace.nodes.forEach((node) => {
      const nodeStart = new Date(node.startedAt).getTime();
      const nodeEnd = node.completedAt ? new Date(node.completedAt).getTime() : end;
      
      // Calculate start and center point percentages
      const startPercent = Math.max(0, Math.min(100, ((nodeStart - start) / totalDuration) * 100));
      const endPercent = Math.max(0, Math.min(100, ((nodeEnd - start) / totalDuration) * 100));
      
      // Center position of node bubble along horizontal timeline
      const centerPercent = startPercent + (endPercent - startPercent) / 2;

      nodeCoords.set(node.id, {
        id: node.id,
        x: centerPercent,
        y: node.laneIndex * laneHeight + 40
      });
    });

    return {
      totalDuration,
      nodeCoords,
      laneHeight,
      maxLane
    };
  }, [trace]);

  // Selected node computational helper
  const selectedNode = useMemo(() => {
    return trace.nodes.find(n => n.id === selectedNodeId) || null;
  }, [trace.nodes, selectedNodeId]);

  const handleNodeClick = (node: WorkflowNode) => {
    const nextId = selectedNodeId === node.id ? null : node.id;
    setSelectedNodeId(nextId);
    if (onNodeSelect) {
      onNodeSelect(nextId ? node : null);
    }
  };

  // Convert node timestamps for readable delta
  const getNodeTimeDelta = (node: WorkflowNode) => {
    const nodeStart = new Date(node.startedAt).getTime();
    const traceStart = new Date(trace.startedAt).getTime();
    return `${((nodeStart - traceStart) / 1000).toFixed(2)}s`;
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full p-6 bg-[#121214] border border-stone-900 rounded-lg font-[var(--font-mono,monospace)] text-[var(--color-text-primary,#F5F5F4)] max-w-[1600px] mx-auto select-none shadow-2xl">
      
      {/* LEFT COLUMN: ACTIVE WORKFLOW GRAPH & GRID SCALES (70% width on XL) */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* Core HUD Header Row */}
        <div className="flex flex-wrap justify-between items-center gap-4 p-4 border border-stone-900/60 bg-stone-950/20 backdrop-blur rounded-sm">
          <div className="flex items-center gap-3">
            <HUDIcons.Activity className="w-5 h-5 text-[var(--color-primary,#F5F5F4)] animate-pulse" />
            <div className="flex flex-col">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-primary,#F5F5F4)] flex items-center gap-2">
                {trace.workflowName}
                <span className="text-[9px] font-normal text-stone-600">v{trace.version}</span>
              </h2>
              <span className="text-[8px] text-stone-500 uppercase tracking-wider mt-0.5">
                TRACE_ID // {trace.traceId} • CRITICAL_PATH ACTIVE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <TaskStatusBadge status={trace.status} />
            <div className="w-[1px] h-6 bg-stone-900" />
            <MicroHUDButton
              icon={isPlaying ? 'Pause' : 'Play'}
              variant="accent"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? 'PAUSE' : 'LIVE'}
            </MicroHUDButton>
            <MicroHUDButton
              icon="Sync"
              onClick={onRefreshTrace}
            >
              REFRESH
            </MicroHUDButton>
          </div>
        </div>

        {/* Dynamic High-Density Temporal Grid Box */}
        <div className="relative border border-stone-900 bg-stone-950/45 rounded-sm p-4 h-[340px] overflow-hidden">
          
          {/* Timeline Grid Rulers (Vertical line divisions) */}
          <div className="absolute inset-0 flex justify-between px-[5%] pointer-events-none select-none z-0">
            {Array.from({ length: 6 }).map((_, i) => {
              const fraction = i / 5;
              const durationLabel = ((timelineTimes.totalDuration * fraction) / 1000).toFixed(2);
              return (
                <div key={i} className="flex flex-col items-center h-full relative">
                  <div className="h-full border-l border-stone-900/50 border-dashed" />
                  <span className="absolute bottom-2 text-[8px] text-stone-600 font-bold select-none whitespace-nowrap bg-[#121214] px-1 py-0.5 rounded-sm border border-stone-900/10">
                    +{durationLabel}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Interactive Bezier Paths Layer */}
          <BezierConnectors
            nodes={trace.nodes}
            positions={timelineTimes.nodeCoords}
            selectedNodeId={selectedNodeId}
            criticalPath={trace.criticalPath}
          />

          {/* Nodes Container Overlay */}
          <div className="absolute inset-0 w-full h-full z-10">
            {trace.nodes.map((node) => {
              const coord = timelineTimes.nodeCoords.get(node.id);
              if (!coord) return null;

              const isSelected = selectedNodeId === node.id;
              const isCritical = trace.criticalPath.includes(node.id);

              // Position offset adjustments to center capsule
              const capsuleWidth = 140; // Approx pixel width
              const xPercentOffset = `calc(${coord.x}% - ${capsuleWidth / 2}px)`;

              let borderStyle = 'border-stone-900';
              let bgStyle = 'bg-[#121214]';
              let textGlow = '';

              if (node.status === TaskStatus.RUNNING) {
                borderStyle = 'border-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.15)]';
                bgStyle = 'bg-stone-950';
              } else if (node.status === TaskStatus.FAILED) {
                borderStyle = 'border-red-600';
                bgStyle = 'bg-red-950/10';
              } else if (isSelected) {
                borderStyle = 'border-[var(--color-primary,#F5F5F4)] shadow-[0_0_15px_rgba(245,245,244,0.2)]';
                bgStyle = 'bg-stone-900/80';
                textGlow = 'text-white';
              } else if (isCritical) {
                borderStyle = 'border-stone-700';
                bgStyle = 'bg-stone-950/60';
              }

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`
                    absolute flex flex-col p-2.5 w-[${capsuleWidth}px]
                    border rounded-sm cursor-pointer select-none
                    transform hover:-translate-y-0.5 hover:shadow-lg
                    transition-all duration-[var(--animation-interactive,200ms)] ease-out
                    ${borderStyle} ${bgStyle}
                  `}
                  style={{
                    left: xPercentOffset,
                    top: coord.y - 25,
                    width: `${capsuleWidth}px`
                  }}
                >
                  <div className="flex justify-between items-center gap-1 border-b border-stone-900/60 pb-1 mb-1.5">
                    <span className="text-[7.5px] text-stone-600 select-none font-bold uppercase tracking-wider">
                      L.{node.laneIndex} // {node.type}
                    </span>
                    <span className="text-[7.5px] text-stone-500 font-bold select-none">
                      {getNodeTimeDelta(node)}
                    </span>
                  </div>
                  <span className={`text-[9.5px] font-bold uppercase tracking-wider truncate mb-1 ${textGlow}`}>
                    {node.label}
                  </span>
                  <div className="flex justify-between items-center gap-1.5 mt-0.5">
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        node.status === TaskStatus.COMPLETED ? 'bg-stone-300' :
                        node.status === TaskStatus.RUNNING ? 'bg-white animate-[ping_1.5s_infinite]' :
                        node.status === TaskStatus.FAILED ? 'bg-red-500' : 'bg-stone-700'
                      }`} />
                      <span className="text-[7.5px] text-stone-500 font-bold uppercase">{node.status}</span>
                    </div>
                    {node.cost.financialCost > 0 && (
                      <span className="text-[7.5px] text-stone-400 font-semibold select-none">
                        ${node.cost.financialCost.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Subagent Execution Log Streams */}
        <div className="flex flex-col border border-stone-900 bg-stone-950/25 rounded-sm overflow-hidden">
          <div className="flex justify-between items-center px-4 py-2 border-b border-stone-900 bg-stone-950/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
              TEMPORAL LOG MONITOR // ACTIVE_STREAMS
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('METRICS')}
                className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 border rounded-sm transition-all duration-150 ${
                  activeTab === 'METRICS' ? 'border-stone-500 text-white bg-stone-900' : 'border-transparent text-stone-500'
                }`}
              >
                METRICS
              </button>
              <button
                onClick={() => setActiveTab('LOGS')}
                className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 border rounded-sm transition-all duration-150 ${
                  activeTab === 'LOGS' ? 'border-stone-500 text-white bg-stone-900' : 'border-transparent text-stone-500'
                }`}
              >
                LOGS
              </button>
              <button
                onClick={() => setActiveTab('BENCHMARKS')}
                className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 border rounded-sm transition-all duration-150 ${
                  activeTab === 'BENCHMARKS' ? 'border-stone-500 text-white bg-stone-900' : 'border-transparent text-stone-500'
                }`}
              >
                BENCHMARKS
              </button>
            </div>
          </div>

          <div className="max-h-[220px] overflow-y-auto p-1 bg-stone-950/80">
            {activeTab === 'LOGS' && (
              <div className="flex flex-col">
                <TerminalLine timestamp="12:24:02.1" coordinate="00.01" level="SYSTEM" label="BOOT" content="temporal kernel initialization verified" />
                <TerminalLine timestamp="12:24:02.4" coordinate="00.02" level="INFO" label="TRACE_START" content="workflow run triggered via operator terminal command" />
                {trace.nodes.map((n, idx) => (
                  <React.Fragment key={n.id}>
                    <TerminalLine
                      timestamp={new Date(n.startedAt).toLocaleTimeString()}
                      coordinate={`0${n.laneIndex}.${idx + 1}`}
                      level={n.status === TaskStatus.FAILED ? 'ERROR' : n.status === TaskStatus.COMPLETED ? 'SUCCESS' : 'INFO'}
                      label={n.label}
                      content={`step instance initialized as ${n.type} node`}
                      financialCost={n.cost.financialCost}
                      latencyMs={n.cost.latencyMs}
                    />
                    {n.metadata?.customLogs?.map((log, lIdx) => (
                      <TerminalLine
                        key={`${n.id}-log-${lIdx}`}
                        timestamp={new Date(n.startedAt).toLocaleTimeString()}
                        coordinate={`0${n.laneIndex}.${idx + 1}.${lIdx}`}
                        level="INFO"
                        label={`${n.label}_METADATA`}
                        content={log}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}

            {activeTab === 'METRICS' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                <div className="p-3 border border-stone-900 bg-stone-950/40 rounded-sm">
                  <span className="text-[8px] text-stone-500 uppercase tracking-widest">TOTAL WORKFLOW LATENCY</span>
                  <div className="text-lg font-bold text-white mt-1">{(trace.totalCost.latencyMs / 1000).toFixed(3)}s</div>
                  <div className="text-[8.5px] text-stone-600 mt-1 uppercase tracking-tight">target threshold: &lt; 5.00s</div>
                </div>
                <div className="p-3 border border-stone-900 bg-stone-950/40 rounded-sm">
                  <span className="text-[8px] text-stone-500 uppercase tracking-widest">AGGREGATE FINANCIAL COST</span>
                  <div className="text-lg font-bold text-white mt-1">${trace.totalCost.financialCost.toFixed(5)}</div>
                  <div className="text-[8.5px] text-stone-600 mt-1 uppercase tracking-tight">max allocation: $0.15000</div>
                </div>
                <div className="p-3 border border-stone-900 bg-stone-950/40 rounded-sm">
                  <span className="text-[8px] text-stone-500 uppercase tracking-widest">AI TOKENS CONSUMED</span>
                  <div className="text-lg font-bold text-white mt-1">{trace.totalCost.tokensUsed?.total || 0}</div>
                  <div className="text-[8.5px] text-stone-600 mt-1 uppercase tracking-tight">cached input: {trace.totalCost.tokensUsed?.prompt || 0}</div>
                </div>
              </div>
            )}

            {activeTab === 'BENCHMARKS' && (
              <div className="flex flex-col p-2">
                {benchmarks.map((bench, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 px-3 border-b border-stone-900/50 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        bench.status === 'OPTIMAL' ? 'bg-stone-300' :
                        bench.status === 'WARNING' ? 'bg-amber-400' : 'bg-red-500'
                      }`} />
                      <span className="text-stone-300 font-semibold">{bench.metricName}</span>
                    </div>
                    <div className="flex gap-4 font-bold">
                      <span className="text-stone-500">BASE: {bench.baselineValue}{bench.unit}</span>
                      <span className="text-white">CURR: {bench.currentValue}{bench.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: DETAIL NODE INSPECTOR & TELEMETRY (30% width on XL) */}
      <div className="w-full xl:w-[380px] flex flex-col gap-4 border-t xl:border-t-0 xl:border-l border-stone-900 pt-6 xl:pt-0 xl:pl-6">
        <div className="flex items-center justify-between border-b border-stone-900 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary,#F5F5F4)]">
            NODE TELEMETRY INSPECTOR
          </span>
          <HUDIcons.Settings className="w-4 h-4 text-stone-500" />
        </div>

        {selectedNode ? (
          <div className="flex flex-col gap-4">
            
            {/* Inspector Header */}
            <div className="p-3.5 border border-stone-900 bg-stone-950 rounded-sm">
              <div className="flex justify-between items-start gap-2 mb-1.5">
                <span className="text-[8px] text-stone-500 uppercase font-bold tracking-widest">
                  {selectedNode.type} NODE CONFIG
                </span>
                <span className="text-[8.5px] text-stone-600 font-bold select-all">{selectedNode.id}</span>
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {selectedNode.label}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-3.5">
                <TaskStatusBadge status={selectedNode.status} />
                <span className="text-[9px] font-bold text-stone-600 bg-[#121214] px-1.5 py-0.5 border border-stone-900 rounded-sm">
                  LANE {selectedNode.laneIndex}
                </span>
              </div>
            </div>

            {/* Micro Latency and cost stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 border border-stone-900/60 bg-stone-950/20 rounded-sm">
                <span className="text-[7.5px] text-stone-500 uppercase tracking-widest">NODE LATENCY</span>
                <div className="text-xs font-bold text-stone-300 mt-1">{selectedNode.cost.latencyMs}ms</div>
              </div>
              <div className="p-3 border border-stone-900/60 bg-stone-950/20 rounded-sm">
                <span className="text-[7.5px] text-stone-500 uppercase tracking-widest">FINANCIAL DEPLETE</span>
                <div className="text-xs font-bold text-stone-300 mt-1">${selectedNode.cost.financialCost.toFixed(5)}</div>
              </div>
            </div>

            {/* Deep Model Metadata details if present */}
            {selectedNode.metadata && (
              <div className="flex flex-col p-3 border border-stone-900 bg-stone-950/30 rounded-sm text-[9.5px]">
                <span className="text-[8px] text-stone-500 uppercase tracking-widest font-bold mb-2">EXECUTION METADATA</span>
                
                {selectedNode.metadata.modelName && (
                  <div className="flex justify-between py-1 border-b border-stone-900/40">
                    <span className="text-stone-600 font-bold">MODEL TARGET:</span>
                    <span className="text-stone-300 uppercase">{selectedNode.metadata.modelName}</span>
                  </div>
                )}
                {selectedNode.metadata.agentId && (
                  <div className="flex justify-between py-1 border-b border-stone-900/40">
                    <span className="text-stone-600 font-bold">AGENT_ID:</span>
                    <span className="text-stone-300 select-all font-bold">{selectedNode.metadata.agentId}</span>
                  </div>
                )}
                {selectedNode.metadata.allocatedMemoryMb && (
                  <div className="flex justify-between py-1 border-b border-stone-900/40">
                    <span className="text-stone-600 font-bold">ALLOCATED MEM:</span>
                    <span className="text-stone-300">{selectedNode.metadata.allocatedMemoryMb}MB</span>
                  </div>
                )}
                {selectedNode.metadata.retryCount !== undefined && (
                  <div className="flex justify-between py-1">
                    <span className="text-stone-600 font-bold">RETRY ATTEMPTS:</span>
                    <span className="text-stone-300 font-bold">{selectedNode.metadata.retryCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* Error stacktrace render if failed */}
            {selectedNode.status === TaskStatus.FAILED && selectedNode.errorDetails && (
              <div className="flex flex-col p-3 border border-red-950/30 bg-red-950/10 rounded-sm">
                <span className="text-[8px] text-red-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  ERROR_CODE // {selectedNode.errorDetails.code}
                </span>
                <p className="text-[10px] text-red-300 font-bold leading-normal mb-2">
                  {selectedNode.errorDetails.message}
                </p>
                {selectedNode.errorDetails.stackTrace && (
                  <div className="text-[8px] font-mono text-red-500 bg-black/40 p-2 rounded-sm max-h-[100px] overflow-y-auto whitespace-pre-wrap select-all">
                    {selectedNode.errorDetails.stackTrace}
                  </div>
                )}
              </div>
            )}

            {/* Upstream/Downstream dependency maps */}
            <div className="flex flex-col gap-1.5 text-[9.5px]">
              <span className="text-[8px] text-stone-500 uppercase tracking-widest font-bold">DEPENDENCY MAP</span>
              <div className="flex flex-wrap gap-1.5 py-1">
                {selectedNode.dependencies.length > 0 ? (
                  selectedNode.dependencies.map(depId => (
                    <span
                      key={depId}
                      onClick={() => setSelectedNodeId(depId)}
                      className="px-2 py-0.5 border border-stone-800 bg-stone-950 text-stone-400 hover:text-white hover:border-stone-500 cursor-pointer rounded-sm"
                    >
                      &lt;- {depId}
                    </span>
                  ))
                ) : (
                  <span className="text-stone-600 italic">No upstream dependencies</span>
                )}
              </div>
            </div>

            {/* De-select action buttons */}
            <MicroHUDButton
              variant="secondary"
              onClick={() => setSelectedNodeId(null)}
              className="w-full justify-center"
            >
              DESELECT NODE
            </MicroHUDButton>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[260px] border border-stone-900/60 bg-stone-950/10 rounded-sm border-dashed p-6 text-center">
            <HUDIcons.Clock className="w-8 h-8 text-stone-700 animate-pulse mb-3" />
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">
              INSPECTOR IDLE
            </span>
            <p className="text-[9px] text-stone-600 leading-normal max-w-[200px]">
              Select an individual temporal capsule inside the workflow graph above to visualize active telemetry data.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

// ==========================================
// 3. DEMO PORTFOLIO GRID SHOWCASE RENDERER
// ==========================================

export const ChronoGraphShowcase: React.FC = () => {
  // Pre-configured mock data for a perfect high-density temporal trace visualization
  const mockTrace: TimelineTrace = {
    traceId: "TR_88029A_V6_KNL",
    workflowName: "CHRONOGRAPH_AGENT_RECRUITMENT_ORCHESTRATION",
    version: "7.0.0",
    status: TaskStatus.RUNNING,
    startedAt: "2026-05-29T12:24:00.000Z",
    triggeredBy: {
      actor: "OPERATOR",
      userId: "jaharoni@127.0.0.1"
    },
    criticalPath: ["N1_PLAN", "N2_ROUTE", "N3_GEN_ASSETS", "N4_VERIFY_LOCK", "N5_HUMAN_SIGN", "N6_COMPILE"],
    totalCost: {
      financialCost: 0.04328,
      latencyMs: 3840,
      tokensUsed: {
        prompt: 16500,
        completion: 3400,
        total: 19900
      }
    },
    nodes: [
      {
        id: "N1_PLAN",
        label: "Synthesize Plan",
        type: "INFERENCE",
        status: TaskStatus.COMPLETED,
        laneIndex: 0,
        dependencies: [],
        startedAt: "2026-05-29T12:24:00.000Z",
        completedAt: "2026-05-29T12:24:00.800Z",
        cost: {
          financialCost: 0.0034,
          latencyMs: 800
        },
        metadata: {
          agentId: "planner-agent-01",
          modelName: "Claude 3.5 Sonnet",
          customLogs: [
            "Parsed system instructions perfectly",
            "Synthesized 6 dynamic chronological subtasks"
          ]
        }
      },
      {
        id: "N2_ROUTE",
        label: "Skill Intent Router",
        type: "ROUTING_GATE",
        status: TaskStatus.COMPLETED,
        laneIndex: 1,
        dependencies: ["N1_PLAN"],
        startedAt: "2026-05-29T12:24:00.850Z",
        completedAt: "2026-05-29T12:24:01.300Z",
        cost: {
          financialCost: 0.0012,
          latencyMs: 450
        },
        metadata: {
          agentId: "router-agent-02",
          customLogs: [
            "Matched 4 aliases successfully",
            "Dispatched subagent orchestration queues"
          ]
        }
      },
      {
        id: "N3_GEN_ASSETS",
        label: "Subagent Asset Generator",
        type: "SUBAGENT_CALL",
        status: TaskStatus.COMPLETED,
        laneIndex: 2,
        dependencies: ["N2_ROUTE"],
        startedAt: "2026-05-29T12:24:01.350Z",
        completedAt: "2026-05-29T12:24:02.750Z",
        cost: {
          financialCost: 0.0245,
          latencyMs: 1400
        },
        metadata: {
          agentId: "director-agent-03",
          modelName: "Midjourney / Fal-AI",
          customLogs: [
            "Loaded design system catalog",
            "Synthesized monochrome SVG asset"
          ]
        }
      },
      {
        id: "N3_BACKUP_STATE",
        label: "Failsafe Database Sync",
        type: "ACTION",
        status: TaskStatus.COMPLETED,
        laneIndex: 3,
        dependencies: ["N2_ROUTE"],
        startedAt: "2026-05-29T12:24:01.400Z",
        completedAt: "2026-05-29T12:24:02.100Z",
        cost: {
          financialCost: 0.00018,
          latencyMs: 700
        },
        metadata: {
          allocatedMemoryMb: 512,
          customLogs: [
            "Backed up transaction session snapshot to local registry index"
          ]
        }
      },
      {
        id: "N4_VERIFY_LOCK",
        label: "Drift Hardening Verification",
        type: "ACTION",
        status: TaskStatus.COMPLETED,
        laneIndex: 1,
        dependencies: ["N3_GEN_ASSETS", "N3_BACKUP_STATE"],
        startedAt: "2026-05-29T12:24:02.800Z",
        completedAt: "2026-05-29T12:24:03.300Z",
        cost: {
          financialCost: 0.0005,
          latencyMs: 500
        },
        metadata: {
          customLogs: [
            "Drift checking complete. Zero hardcoded colors scanned.",
            "Visual assets verified"
          ]
        }
      },
      {
        id: "N4_LINT_RETRY",
        label: "Automated Linter Run",
        type: "ACTION",
        status: TaskStatus.RETRIED,
        laneIndex: 0,
        dependencies: ["N3_GEN_ASSETS"],
        startedAt: "2026-05-29T12:24:02.850Z",
        completedAt: "2026-05-29T12:24:03.150Z",
        cost: {
          financialCost: 0.0003,
          latencyMs: 300
        },
        metadata: {
          retryCount: 2,
          customLogs: [
            "Lint warnings detected in controls.tsx",
            "Auto-resolved format tags on retry loop 2"
          ]
        }
      },
      {
        id: "N5_HUMAN_SIGN",
        label: "Operator Human Approval",
        type: "HUMAN_APPROVAL",
        status: TaskStatus.SUSPENDED,
        laneIndex: 2,
        dependencies: ["N4_VERIFY_LOCK"],
        startedAt: "2026-05-29T12:24:03.350Z",
        cost: {
          financialCost: 0.0,
          latencyMs: 490
        },
        metadata: {
          customLogs: [
            "Awaiting operator approval trigger...",
            "Prompt sent to chat window"
          ]
        }
      },
      {
        id: "N6_COMPILE",
        label: "Final Code Compiler",
        type: "ACTION",
        status: TaskStatus.IDLE,
        laneIndex: 1,
        dependencies: ["N5_HUMAN_SIGN", "N4_LINT_RETRY"],
        startedAt: "2026-05-29T12:24:03.840Z",
        cost: {
          financialCost: 0.0132,
          latencyMs: 0
        }
      }
    ]
  };

  const mockBenchmarks: PerformanceBenchmark[] = [
    {
      metricName: "Temporal Node Coordination Latency",
      currentValue: 2.14,
      baselineValue: 4.50,
      unit: "ms",
      status: "OPTIMAL"
    },
    {
      metricName: "Financial Depletion Velocity",
      currentValue: 0.043,
      baselineValue: 0.150,
      unit: "$",
      status: "OPTIMAL"
    },
    {
      metricName: "Subagent Hardened Drift Deviance",
      currentValue: 0.02,
      baselineValue: 0.05,
      unit: "px",
      status: "OPTIMAL"
    },
    {
      metricName: "Compute Unit Allocation Threshold",
      currentValue: 91,
      baselineValue: 80,
      unit: "%",
      status: "WARNING"
    }
  ];

  return (
    <div className="bg-[#121214] p-10 min-h-screen">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Core Showcase Brand Grid Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-900 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {/* Embedded Mini Logo SVG */}
            <div className="w-12 h-12 bg-stone-950 border border-stone-800 rounded-sm flex items-center justify-center p-1 shadow-inner">
              <svg viewBox="0 0 512 512" fill="none" className="w-full h-full text-white">
                <circle cx="256" cy="256" r="216" stroke="currentColor" strokeOpacity="0.2" strokeWidth="6" strokeDasharray="16 12" />
                <path d="M 120,320 L 176,220 L 256,220 L 296,140 L 392,140" stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="120" cy="320" r="30" fill="currentColor" />
                <circle cx="256" cy="220" r="35" fill="currentColor" stroke="#121214" strokeWidth="10" />
                <circle cx="392" cy="140" r="30" fill="currentColor" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold uppercase tracking-wider text-white">
                CHRONOGRAPH DESIGN PORTFOLIO
              </h1>
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mt-0.5">
                Version 7.0.0 Spec • Carbon Monochrome HUD Interactive Components
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-stone-600 bg-stone-950 px-2.5 py-1 border border-stone-900 rounded-sm">
              LIVE TELEMETRY ACTIVE
            </span>
          </div>
        </div>

        {/* COMPONENT 1: The Interactive Temporal Workflow panel */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">
            COMPONENT 1: HIGH-DENSITY TEMPORAL TIMELINE PANEL
          </h2>
          <TemporalWorkflowTimeline
            trace={mockTrace}
            benchmarks={mockBenchmarks}
            onRefreshTrace={() => alert("Simulating ChronoGraph telemetry synchronizer reload...")}
          />
        </div>

        {/* COMPONENT 2: Individual Badge States and micro control layout grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Badge and Micro Controls Card */}
          <div className="flex flex-col p-6 border border-stone-900 bg-stone-950/20 rounded-lg">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-900 pb-3 mb-4">
              COMPONENT 2: MICRO CONTROLS & DOTTED BADGES
            </h3>
            
            <div className="flex flex-col gap-6">
              {/* Badge State Grid */}
              <div className="flex flex-col gap-2">
                <span className="text-[8px] text-stone-600 uppercase font-bold tracking-widest mb-1.5">
                  Task Status Badge States
                </span>
                <div className="flex flex-wrap gap-2">
                  <TaskStatusBadge status={TaskStatus.IDLE} />
                  <TaskStatusBadge status={TaskStatus.QUEUED} />
                  <TaskStatusBadge status={TaskStatus.RUNNING} />
                  <TaskStatusBadge status={TaskStatus.COMPLETED} />
                  <TaskStatusBadge status={TaskStatus.FAILED} />
                  <TaskStatusBadge status={TaskStatus.SUSPENDED} />
                  <TaskStatusBadge status={TaskStatus.CANCELLED} />
                  <TaskStatusBadge status={TaskStatus.RETRIED} />
                </div>
              </div>

              {/* Micro Button grid */}
              <div className="flex flex-col gap-2">
                <span className="text-[8px] text-stone-600 uppercase font-bold tracking-widest mb-1.5">
                  Micro HUD Interactive Buttons
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <MicroHUDButton variant="primary" icon="Play">COMPILE WORKFLOW</MicroHUDButton>
                  <MicroHUDButton variant="secondary" icon="Sync">RESYNC TELEMETRY</MicroHUDButton>
                  <MicroHUDButton variant="accent" icon="Branch">DEPLOY BRANCH</MicroHUDButton>
                  <MicroHUDButton variant="destructive" icon="Lock">FORCE REBOOT</MicroHUDButton>
                  <MicroHUDButton variant="flat" icon="Settings" />
                </div>
              </div>
            </div>
          </div>

          {/* Terminal log wrapper card */}
          <div className="flex flex-col p-6 border border-stone-900 bg-stone-950/20 rounded-lg">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-900 pb-3 mb-4">
              COMPONENT 3: TERMINAL LOG LINE WRAPPERS
            </h3>
            
            <div className="flex flex-col bg-stone-950/80 p-1.5 border border-stone-900 rounded-sm">
              <TerminalLine
                timestamp="12:24:49.0"
                coordinate="00.01"
                level="SYSTEM"
                label="SYS_INITIALIZER"
                content="chronometer thread initialized successfully"
              />
              <TerminalLine
                timestamp="12:24:49.2"
                coordinate="01.12"
                level="INFO"
                label="SUBAGENT_SPAWN"
                content="allocated thread planner-agent-01 on core_0"
                latencyMs={140}
              />
              <TerminalLine
                timestamp="12:24:49.5"
                coordinate="02.04"
                level="WARN"
                label="HARDENING_DRIFT"
                content="carbon theme contrast warning: node border is close to baseline"
              />
              <TerminalLine
                timestamp="12:24:49.8"
                coordinate="03.02"
                level="ERROR"
                label="LINT_COMPILER"
                content="hardcoded color value scan failed on line 12: color hex #0EA5E9 detected"
                financialCost={0.00142}
                latencyMs={34}
              />
              <TerminalLine
                timestamp="12:24:50.0"
                coordinate="04.01"
                level="SUCCESS"
                label="INTEGRITY_SHIELD"
                content="compilation completed successfully with zero drift anomalies"
                financialCost={0.04186}
                latencyMs={810}
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
