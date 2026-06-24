/**
 * Mission Control — Live Edge Node Sensor Mesh Dashboard
 *
 * Full-page view replacing SpatialCanvas when missionControlMode is active.
 * Shows all edge nodes as live pulsing indicators on a venue map underlay.
 * Real-time WebSocket feed from dispatch server.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePulseStore, type EdgeNode } from '../../store/usePulseStore';
import { VenueMap, type VenuePreset } from './VenueMap';
import './MissionControl.css';

// ─── Node Indicator ───────────────────────────────────────────────────────────

interface NodeIndicatorProps {
  node: EdgeNode;
  containerW: number;
  containerH: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

function NodeIndicator({ node, containerW, containerH, selected, onSelect }: NodeIndicatorProps) {
  const cx = node.x * containerW;
  const cy = node.y * containerH;

  const statusColor = {
    live: '#00E5FF',
    idle: '#FFB300',
    offline: '#555',
    error: '#FF2D2D',
  }[node.status];

  const isLive = node.status === 'live';
  const secsSinceHeartbeat = node.lastHeartbeat
    ? Math.floor((Date.now() - node.lastHeartbeat) / 1000)
    : null;

  return (
    <g
      className={`edge-node-indicator ${selected ? 'selected' : ''}`}
      transform={`translate(${cx},${cy})`}
      onClick={() => onSelect(node.id)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={`Edge node: ${node.label}`}
    >
      {/* Outer pulse ring — only when live */}
      {isLive && (
        <circle r={30} fill="none" stroke={statusColor} strokeWidth={1.5} opacity={0.3}
          className="pulse-ring" />
      )}
      {/* Mid ring */}
      <circle r={18} fill="rgba(8,8,8,0.85)" stroke={statusColor}
        strokeWidth={selected ? 2.5 : 1.5} opacity={0.9} />
      {/* Core dot */}
      <circle r={5} fill={statusColor} />
      {/* Label */}
      <text y={32} textAnchor="middle" fontSize={10}
        fill="rgba(220,228,245,0.8)" fontFamily="'JetBrains Mono', monospace"
        className="node-label">
        {node.label.slice(0, 20)}
      </text>
      {/* Stream health arc */}
      {isLive && (
        <circle r={18} fill="none" stroke={statusColor} strokeWidth={3}
          strokeDasharray={`${(node.streamHealth / 100) * 113} 113`}
          strokeDashoffset={28} opacity={0.5} transform="rotate(-90)" />
      )}
      {/* Queue depth badge */}
      {node.queueDepth > 0 && (
        <g transform="translate(14,-14)">
          <circle r={9} fill="#FFB300" />
          <text textAnchor="middle" y={4} fontSize={9} fill="#07090F"
            fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {node.queueDepth > 9 ? '9+' : node.queueDepth}
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Node Detail Popover ──────────────────────────────────────────────────────

function NodePopover({ node, onClose }: { node: EdgeNode; onClose: () => void }) {
  const secsSince = node.lastHeartbeat
    ? Math.floor((Date.now() - node.lastHeartbeat) / 1000)
    : null;

  return (
    <div className="node-popover" role="dialog" aria-label={`Node details: ${node.label}`}>
      <div className="popover-header">
        <span className={`status-dot status-${node.status}`} />
        <span className="popover-title">{node.label}</span>
        <button className="popover-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="popover-body">
        <div className="popover-row">
          <span className="popover-key">Venue</span>
          <span className="popover-val">{node.venue}</span>
        </div>
        <div className="popover-row">
          <span className="popover-key">Status</span>
          <span className={`popover-val status-text-${node.status}`}>{node.status.toUpperCase()}</span>
        </div>
        <div className="popover-row">
          <span className="popover-key">Stream Health</span>
          <span className="popover-val">{node.streamHealth}%</span>
        </div>
        {node.batteryPct !== null && (
          <div className="popover-row">
            <span className="popover-key">Battery</span>
            <span className="popover-val">{node.batteryPct}%</span>
          </div>
        )}
        {node.lteSignalDbm !== null && (
          <div className="popover-row">
            <span className="popover-key">LTE Signal</span>
            <span className="popover-val">{node.lteSignalDbm} dBm</span>
          </div>
        )}
        <div className="popover-row">
          <span className="popover-key">Queue</span>
          <span className="popover-val">{node.queueDepth} clips pending</span>
        </div>
        {secsSince !== null && (
          <div className="popover-row">
            <span className="popover-key">Last Heartbeat</span>
            <span className="popover-val">{secsSince}s ago</span>
          </div>
        )}
        {node.sessionId && (
          <div className="popover-row">
            <span className="popover-key">Session</span>
            <span className="popover-val font-mono">{node.sessionId}</span>
          </div>
        )}
        {node.currentMoment && (
          <div className="popover-moment">
            <span className="popover-key">Last AI Tag</span>
            <span className="popover-val">{node.currentMoment}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event Feed ───────────────────────────────────────────────────────────────

interface FeedEvent {
  id: string;
  nodeId: string;
  nodeLabel: string;
  timestamp: number;
  type: string;
  description: string;
  crowdEnergy?: number;
}

function EventFeed({ events }: { events: FeedEvent[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div className="event-feed" ref={feedRef} aria-label="Live event feed">
      <div className="feed-header font-mono">LIVE EVENTS</div>
      {events.length === 0 && (
        <div className="feed-empty font-mono">Monitoring... no moments detected yet</div>
      )}
      {events.map(ev => (
        <div key={ev.id} className={`feed-item ${ev.crowdEnergy && ev.crowdEnergy >= 8 ? 'feed-item--hot' : ''}`}>
          <div className="feed-meta font-mono">
            <span className="feed-node">{ev.nodeLabel.slice(0, 16)}</span>
            <span className="feed-time">{new Date(ev.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="feed-type">{ev.type}</div>
          <div className="feed-desc">{ev.description}</div>
          {ev.crowdEnergy !== undefined && (
            <div className="feed-energy">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`energy-bar ${i < ev.crowdEnergy! ? 'energy-bar--on' : ''}`} />
              ))}
              <span className="energy-val font-mono">{ev.crowdEnergy}/10</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Mission Control ─────────────────────────────────────────────────────

const VENUE_OPTIONS: { label: string; value: VenuePreset }[] = [
  { label: 'Hockey Rink', value: 'hockey-rink' },
  { label: 'Basketball Court', value: 'basketball-court' },
  { label: 'Baseball Diamond', value: 'baseball-diamond' },
  { label: 'Generic', value: 'generic' },
];

export function MissionControl() {
  const edgeNodes = usePulseStore(s => s.edgeNodes);
  const updateEdgeNode = usePulseStore(s => s.updateEdgeNode);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [venuePreset, setVenuePreset] = useState<VenuePreset>('hockey-rink');
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track container size
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => setSessionTimer(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // WebSocket — connect to dispatch server live feed
  useEffect(() => {
    const WS_URL = `ws://localhost:5050/ws/nodes`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('[MISSION-CONTROL] WebSocket connected to dispatch');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);

          if (msg.type === 'node_heartbeat') {
            updateEdgeNode(msg.nodeId, {
              status: msg.status ?? 'live',
              streamHealth: msg.streamHealth ?? 100,
              batteryPct: msg.batteryPct ?? null,
              lteSignalDbm: msg.lteSignalDbm ?? null,
              queueDepth: msg.queueDepth ?? 0,
              lastHeartbeat: Date.now(),
              currentMoment: msg.currentMoment ?? null,
            });
          }

          if (msg.type === 'key_moment') {
            setEvents(prev => [{
              id: `${msg.nodeId}-${Date.now()}`,
              nodeId: msg.nodeId,
              nodeLabel: edgeNodes.find(n => n.id === msg.nodeId)?.label ?? msg.nodeId,
              timestamp: Date.now(),
              type: msg.sceneType ?? 'moment',
              description: msg.description ?? '',
              crowdEnergy: msg.crowdEnergy,
            }, ...prev].slice(0, 50));
          }
        } catch { /* malformed message — ignore */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('[MISSION-CONTROL] WebSocket disconnected');
      };

      ws.onerror = () => setWsConnected(false);
    } catch {
      console.warn('[MISSION-CONTROL] WebSocket unavailable — running in local mode');
    }

    return () => { ws?.close(); };
  }, [updateEdgeNode]);

  // Handle background click to deselect
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('mc-canvas-svg')) {
      setSelectedNodeId(null);
    }
  }, []);

  const liveCount = edgeNodes.filter(n => n.status === 'live').length;
  const overallStatus = edgeNodes.length === 0 ? 'NO NODES' :
    liveCount === edgeNodes.length ? 'ALL LIVE' :
    liveCount > 0 ? 'PARTIAL' : 'OFFLINE';

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const selectedNode = edgeNodes.find(n => n.id === selectedNodeId) ?? null;

  return (
    <div className="mission-control" id="mission-control-root">
      {/* ── Status Bar ──────────────────────────────────────────────── */}
      <div className="mc-statusbar font-mono" role="status" aria-live="polite">
        <span className={`mc-overall ${overallStatus.toLowerCase().replace(' ', '-')}`}>
          {overallStatus}
        </span>
        <span className="mc-divider">|</span>
        <span className="mc-nodes">{liveCount}/{edgeNodes.length} NODES LIVE</span>
        <span className="mc-divider">|</span>
        <span className="mc-timer">{formatTimer(sessionTimer)}</span>
        <span className="mc-divider">|</span>
        <span className={`mc-ws ${wsConnected ? 'ws-connected' : 'ws-disconnected'}`}>
          {wsConnected ? '● DISPATCH CONNECTED' : '○ LOCAL MODE'}
        </span>
        <div className="mc-venue-select">
          <select
            value={venuePreset}
            onChange={e => setVenuePreset(e.target.value as VenuePreset)}
            className="venue-picker font-mono"
            aria-label="Select venue layout"
          >
            {VENUE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Canvas + Feed ───────────────────────────────────────── */}
      <div className="mc-body">
        {/* Canvas */}
        <div className="mc-canvas-wrap" ref={containerRef}>
          <VenueMap
            preset={venuePreset}
            width={containerSize.w}
            height={containerSize.h}
          />
          <svg
            className="mc-canvas-svg"
            width={containerSize.w}
            height={containerSize.h}
            onClick={handleCanvasClick}
            aria-label="Edge node mesh map"
          >
            {edgeNodes.map(node => (
              <NodeIndicator
                key={node.id}
                node={node}
                containerW={containerSize.w}
                containerH={containerSize.h}
                selected={selectedNodeId === node.id}
                onSelect={setSelectedNodeId}
              />
            ))}
          </svg>

          {/* Empty state */}
          {edgeNodes.length === 0 && (
            <div className="mc-empty font-mono">
              <div className="mc-empty-icon">◉</div>
              <div>NO EDGE NODES REGISTERED</div>
              <div className="mc-empty-sub">Nodes appear here when they heartbeat to the dispatch server</div>
              <div className="mc-empty-sub">or when added via the add-node panel</div>
            </div>
          )}

          {/* Node detail popover */}
          {selectedNode && (
            <div className="mc-popover-wrap">
              <NodePopover node={selectedNode} onClose={() => setSelectedNodeId(null)} />
            </div>
          )}
        </div>

        {/* Event feed sidebar */}
        <EventFeed events={events} />
      </div>
    </div>
  );
}
