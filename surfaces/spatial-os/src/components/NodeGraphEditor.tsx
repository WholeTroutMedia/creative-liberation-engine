import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Preload } from '@react-three/drei';
import { Suspense } from 'react';
import { EnvironmentStaging } from './EnvironmentStaging';
import { VenueRenderer } from './VenueRenderer';
import { GuidedNavigation } from './GuidedNavigation';
import { Trash2, Zap, Database, Sliders, Smartphone, Eye, Sparkles } from './Icons';

export interface TelemetryBinding {
  id: string;
  sourceNodeId: string;
  sourceChannel: string;
  targetSegmentId: string;
  targetParameter: string;
  multiplier: number;
  offset: number;
  smoothing: number;
  expression: string;
  active: boolean;
}

export interface NodeGraphEditorProps {
  segments: string[];
  activeSegment: string | null;
  setActiveSegment: (name: string | null) => void;
  bindings: TelemetryBinding[];
  setBindings: (b: TelemetryBinding[] | ((prev: TelemetryBinding[]) => TelemetryBinding[])) => void;
  telemetry: any;
  isSam3dScanning: boolean;
  triggerSam3dScan: () => void;
  targetVenue: string | null;
  setTargetVenue: (venue: string | null) => void;
  setAvailableSegments: (names: string[]) => void;
  cameraControlsRef: any;
}

// 1. Custom Node: Scan Ingester
const ScanIngesterNode = React.memo(({ data }: { data: any }) => {
  return (
    <div
      className="glass-panel"
      style={{
        width: '240px',
        background: 'rgba(10, 10, 20, 0.9)',
        border: '1.5px solid #00bcff60',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        padding: '0',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'rgba(0, 188, 255, 0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderTopLeftRadius: '11px',
          borderTopRightRadius: '11px',
        }}
      >
        <Database size={14} style={{ color: '#00bcff' }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Volume Ingester
        </span>
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Active 3D Source</label>
          <select
            value={data.targetVenue || ''}
            onChange={(e) => data.setTargetVenue(e.target.value || null)}
            style={{
              padding: '6px 10px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#fff',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">[AWAITING INGESTION]</option>
            <option value="/models/hill-country.glb">Hill Country (GLTF Twin)</option>
            <option value="/models/canyon-outpost.splat">Splat (Gaussian Cloud)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: data.targetVenue ? '#4ade80' : '#ff4a4a' }} />
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
            {data.targetVenue ? 'Signal Materialized' : 'Idle / Standby'}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="venue-output"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#00bcff',
          border: '2px solid #000',
          right: '-6px',
        }}
      />
    </div>
  );
});

// 2. Custom Node: SAM3D Real-Time Segmenter
const Sam3dSegmenterNode = React.memo(({ data }: { data: any }) => {
  return (
    <div
      className="glass-panel"
      style={{
        width: '260px',
        background: 'rgba(10, 10, 20, 0.9)',
        border: '1.5px solid #00FFCC60',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        padding: '0',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="venue-input"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#00bcff',
          border: '2px solid #000',
          left: '-6px',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(0, 255, 204, 0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderTopLeftRadius: '11px',
          borderTopRightRadius: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} style={{ color: '#00FFCC' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            SAM3D Segmenter
          </span>
        </div>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={data.triggerSam3dScan}
          disabled={data.isSam3dScanning || !data.targetVenue}
          className={`glass-btn ${data.isSam3dScanning ? 'active-pulse' : ''}`}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: data.isSam3dScanning ? 'rgba(0, 255, 204, 0.15)' : 'rgba(255,255,255,0.04)',
            borderColor: data.isSam3dScanning ? '#00FFCC' : 'rgba(255,255,255,0.08)',
            color: data.isSam3dScanning ? '#00FFCC' : '#fff',
            cursor: data.targetVenue ? 'pointer' : 'not-allowed',
            opacity: data.targetVenue ? 1 : 0.5,
          }}
        >
          <Sparkles size={12} />
          <span>{data.isSam3dScanning ? 'SCANNING VOXELS...' : 'INITIALIZE SAM3D'}</span>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Discovered Segments</label>
          <div
            style={{
              maxHeight: '120px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {data.segments.length > 0 ? (
              data.segments.map((seg: string) => {
                const isActive = data.activeSegment === seg;
                return (
                  <div
                    key={seg}
                    onClick={() => data.setActiveSegment(isActive ? null : seg)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: isActive ? 'rgba(0, 255, 204, 0.15)' : 'transparent',
                      color: isActive ? '#00FFCC' : 'rgba(255,255,255,0.7)',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{seg.replace(/_/g, ' ')}</span>
                    <Eye size={10} style={{ opacity: isActive ? 1 : 0.3 }} />
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', padding: '10px', textAlign: 'center' }}>
                No active segment data. Run SAM3D scan.
              </div>
            )}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="segment-output"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#00FFCC',
          border: '2px solid #000',
          right: '-6px',
        }}
      />
    </div>
  );
});

// 3. Custom Node: Telemetry Source Nodes
const TelemetryInputNode = React.memo(({ data }: { data: any }) => {
  const Icon = data.icon;
  return (
    <div
      className="glass-panel"
      style={{
        width: '230px',
        background: 'rgba(10, 10, 20, 0.9)',
        border: `1.5px solid ${data.color}60`,
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        padding: '0',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: `${data.color}15`,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderTopLeftRadius: '11px',
          borderTopRightRadius: '11px',
        }}
      >
        <Icon size={14} style={{ color: data.color }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {data.name}
        </span>
      </div>

      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}>
        {data.channels.map((chan: any) => (
          <div
            key={chan.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 14px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.7)',
              height: '28px',
              position: 'relative',
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{chan.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={chan.key}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: data.color,
                border: '2px solid #000',
                right: '-6px',
                cursor: 'crosshair',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

// 4. Custom Node: Three.js Real-time Viewport Preview Node
const ThreeJsPreviewNode = React.memo(({ data }: { data: any }) => {
  return (
    <div
      className="glass-panel"
      style={{
        width: '520px',
        height: '420px',
        background: 'rgba(6, 6, 12, 0.95)',
        border: '1.5px solid #00FFCC50',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        padding: '0',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="three-render-input"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#00FFCC',
          border: '2px solid #000',
          left: '-6px',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(0, 255, 204, 0.12)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={12} style={{ color: '#00FFCC' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Digital Twin Viewport Monitor
          </span>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', background: '#020204' }}>
        {data.targetVenue ? (
          <Canvas
            shadows
            camera={{ position: [0, 5, 12], fov: 45, near: 0.1, far: 1000 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
            style={{ width: '100%', height: '100%' }}
          >
            <color attach="background" args={['#020204']} />
            <Suspense fallback={null}>
              <EnvironmentStaging />
              <VenueRenderer
                assetUrl={data.targetVenue}
                bindings={data.bindings}
                telemetry={data.telemetry}
                activeSegment={data.activeSegment}
                setActiveSegment={data.setActiveSegment}
                setAvailableSegments={data.setAvailableSegments}
                isSam3dScanning={data.isSam3dScanning}
              />
              <GuidedNavigation cameraControlsRef={data.cameraControlsRef} />
              <Preload all />
            </Suspense>
            <CameraControls 
              ref={data.cameraControlsRef}
              makeDefault 
              dollyToCursor 
              smoothTime={0.4} 
              azimuthRotateSpeed={0.5} 
              polarRotateSpeed={0.5} 
            />
          </Canvas>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'monospace' }}>
            <Database size={24} style={{ color: '#ff5c5c', opacity: 0.8 }} />
            <span>AWAITING INGSTED VOLUME SIGNAL...</span>
          </div>
        )}
      </div>
    </div>
  );
});

// Custom nodes mappings
const nodeTypes = {
  scanIngester: ScanIngesterNode,
  sam3dSegmenter: Sam3dSegmenterNode,
  telemetrySource: TelemetryInputNode,
  threeJsPreview: ThreeJsPreviewNode,
};

// Raw Spects for Telemetry inputs
const SOURCE_NODES_DATA = [
  {
    id: 'src-phone',
    name: 'ZIG SIM Handheld Pose',
    icon: Smartphone,
    color: '#00bcff',
    channels: [
      { key: 'gravity.x', label: 'Gravity X (Tilt X)' },
      { key: 'gravity.y', label: 'Gravity Y (Tilt Y)' },
      { key: 'gyro.x', label: 'Gyro Rotation X' },
      { key: 'gyro.y', label: 'Gyro Rotation Y' },
      { key: 'touch.x', label: 'Touch X' },
      { key: 'touch.y', label: 'Touch Y' },
      { key: 'accel.intensity', label: 'Drift / Shake' },
    ],
  },
  {
    id: 'src-midi',
    name: 'MIDI CC Controller',
    icon: Sliders,
    color: '#ec4899',
    channels: [
      { key: 'cc_74', label: 'Fader CC 74' },
      { key: 'cc_10', label: 'Pan CC 10' },
      { key: 'cc_1', label: 'Mod Wheel' },
    ],
  },
  {
    id: 'src-infra',
    name: 'Prometheus Node Status',
    icon: Database,
    color: '#10b981',
    channels: [
      { key: 'sys.cpu', label: 'NAS CPU Load' },
      { key: 'cortex.tokens', label: 'Cortex Speed' },
    ],
  },
];

export function NodeGraphEditor({
  segments,
  activeSegment,
  setActiveSegment,
  bindings,
  setBindings,
  telemetry,
  isSam3dScanning,
  triggerSam3dScan,
  targetVenue,
  setTargetVenue,
  setAvailableSegments,
  cameraControlsRef,
}: NodeGraphEditorProps) {
  // Map React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];

    // Node 1: Scan Ingester
    nodes.push({
      id: 'node-ingester',
      type: 'scanIngester',
      position: { x: 40, y: 40 },
      data: {
        targetVenue,
        setTargetVenue,
      },
    });

    // Node 2: SAM3D segmenter
    nodes.push({
      id: 'node-segmenter',
      type: 'sam3dSegmenter',
      position: { x: 330, y: 40 },
      data: {
        segments,
        activeSegment,
        setActiveSegment,
        triggerSam3dScan,
        isSam3dScanning,
        targetVenue,
      },
    });

    // Left Column Telemetry
    SOURCE_NODES_DATA.forEach((s, idx) => {
      nodes.push({
        id: s.id,
        type: 'telemetrySource',
        position: { x: 40, y: 260 + idx * 250 },
        data: {
          name: s.name,
          color: s.color,
          icon: s.icon,
          channels: s.channels,
        },
      });
    });

    // Node 3: 3D Twin monitor Viewport
    nodes.push({
      id: 'node-viewport',
      type: 'threeJsPreview',
      position: { x: 650, y: 40 },
      data: {
        targetVenue,
        bindings,
        telemetry,
        activeSegment,
        setActiveSegment,
        setAvailableSegments,
        isSam3dScanning,
        cameraControlsRef,
      },
    });

    return nodes;
  }, [
    targetVenue,
    setTargetVenue,
    segments,
    activeSegment,
    setActiveSegment,
    triggerSam3dScan,
    isSam3dScanning,
    bindings,
    telemetry,
    setAvailableSegments,
    cameraControlsRef,
  ]);

  const initialEdges: Edge[] = useMemo(() => {
    const eds: Edge[] = [];

    // Connection wire from Ingester to Segmenter
    if (targetVenue) {
      eds.push({
        id: 'wire-ingest-to-segment',
        source: 'node-ingester',
        sourceHandle: 'venue-output',
        target: 'node-segmenter',
        targetHandle: 'venue-input',
        animated: true,
        style: { stroke: '#00bcff', strokeWidth: 3 },
      });
    }

    // Connection from Segmenter to Viewport Twin
    if (segments.length > 0) {
      eds.push({
        id: 'wire-segment-to-render',
        source: 'node-segmenter',
        sourceHandle: 'segment-output',
        target: 'node-viewport',
        targetHandle: 'three-render-input',
        animated: true,
        style: { stroke: '#00FFCC', strokeWidth: 3 },
      });
    }

    // High frequency bindings edges
    bindings.forEach((b) => {
      const sourceColor = SOURCE_NODES_DATA.find((s) => s.id === b.sourceNodeId)?.color || '#00bcff';
      eds.push({
        id: b.id,
        source: b.sourceNodeId,
        sourceHandle: b.sourceChannel,
        target: 'node-viewport',
        targetHandle: 'three-render-input',
        animated: b.active,
        style: {
          stroke: sourceColor,
          strokeWidth: 2,
          filter: `drop-shadow(0 0 4px ${sourceColor}40)`,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: sourceColor,
        },
      });
    });

    return eds;
  }, [targetVenue, segments, bindings]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Keep Flow nodes synced with external React state from App level
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === 'node-ingester') {
          return { ...n, data: { ...n.data, targetVenue, setTargetVenue } };
        }
        if (n.id === 'node-segmenter') {
          return {
            ...n,
            data: {
              ...n.data,
              segments,
              activeSegment,
              setActiveSegment,
              triggerSam3dScan,
              isSam3dScanning,
              targetVenue,
            },
          };
        }
        if (n.id === 'node-viewport') {
          return {
            ...n,
            data: {
              ...n.data,
              targetVenue,
              bindings,
              telemetry,
              activeSegment,
              setActiveSegment,
              setAvailableSegments,
              isSam3dScanning,
              cameraControlsRef,
            },
          };
        }
        return n;
      })
    );
  }, [
    targetVenue,
    setTargetVenue,
    segments,
    activeSegment,
    setActiveSegment,
    triggerSam3dScan,
    isSam3dScanning,
    bindings,
    telemetry,
    setAvailableSegments,
    cameraControlsRef,
    setNodes,
  ]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Connect sockets
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;

      const sourceColor = SOURCE_NODES_DATA.find((s) => s.id === connection.source)?.color || '#00bcff';

      // Check if duplicate route exists
      const duplicate = bindings.some(
        (b) =>
          b.sourceNodeId === connection.source &&
          b.sourceChannel === connection.sourceHandle
      );

      if (duplicate) return;

      const newBinding: TelemetryBinding = {
        id: `bind_${Math.random().toString(36).substr(2, 9)}`,
        sourceNodeId: connection.source,
        sourceChannel: connection.sourceHandle,
        targetSegmentId: activeSegment || 'Residence_Main',
        targetParameter: 'transform.position.y', // Default parameter
        multiplier: 1.0,
        offset: 0.0,
        smoothing: 0.1,
        expression: '',
        active: true,
      };

      setBindings((prev) => [...prev, newBinding]);

      const newEdge: Edge = {
        id: newBinding.id,
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
        animated: true,
        style: {
          stroke: sourceColor,
          strokeWidth: 2.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: sourceColor,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setSelectedBindingId(newBinding.id);
    },
    [bindings, activeSegment, setBindings, setEdges]
  );

  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const activeBinding = bindings.find((b) => b.id === selectedBindingId);

  const deleteBinding = useCallback(
    (id: string) => {
      setBindings((prev) => prev.filter((b) => b.id !== id));
      setEdges((eds) => eds.filter((e) => e.id !== id));
      if (selectedBindingId === id) setSelectedBindingId(null);
    },
    [selectedBindingId, setBindings, setEdges]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#040409' }}>
      {/* React Flow Workspace Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(_, edge) => setSelectedBindingId(edge.id)}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Background color="#333" gap={24} size={1} />
        <Controls style={{ background: 'rgba(10,10,20,0.85)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'scanIngester') return '#00bcff';
            if (node.type === 'sam3dSegmenter') return '#00FFCC';
            if (node.type === 'telemetrySource') return '#b91c1c';
            if (node.type === 'threeJsPreview') return '#047857';
            return '#eee';
          }}
          maskColor="rgba(0, 0, 0, 0.75)"
          style={{ background: 'rgba(10,10,20,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
      </ReactFlow>

      {/* Floating Calibrator panel */}
      {activeBinding && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            right: '24px',
            padding: '12px 20px',
            borderRadius: '12px',
            background: 'rgba(10, 10, 16, 0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={12} style={{ color: '#00bcff' }} />
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Signal Route Calibrator
              </span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>
                ({activeBinding.sourceChannel} ──► {activeBinding.targetSegmentId}.{activeBinding.targetParameter.split('.').pop()})
              </span>
            </div>
            <button
              onClick={() => deleteBinding(activeBinding.id)}
              className="glass-btn"
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '9px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={10} style={{ marginRight: '4px' }} />
              Sever Route
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr', gap: '20px' }}>
            {/* Target parameter target selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Target Mesh element</span>
              <select
                value={activeBinding.targetSegmentId}
                onChange={(e) => {
                  const val = e.target.value;
                  setBindings((prev) => prev.map((b) => (b.id === activeBinding.id ? { ...b, targetSegmentId: val } : b)));
                }}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#fff',
                  outline: 'none',
                }}
              >
                {segments.length > 0 ? (
                  segments.map((seg) => <option key={seg} value={seg}>{seg.replace(/_/g, ' ')}</option>)
                ) : (
                  <>
                    <option value="Residence_Main">Residence Main</option>
                    <option value="Overlook_Tower">Overlook Tower</option>
                    <option value="Cabins_Guest">Cabins Guest</option>
                    <option value="River_Deck">River Deck</option>
                  </>
                )}
              </select>
            </div>

            {/* Target Property Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Target 3D Parameter</span>
              <select
                value={activeBinding.targetParameter}
                onChange={(e) => {
                  const val = e.target.value;
                  setBindings((prev) => prev.map((b) => (b.id === activeBinding.id ? { ...b, targetParameter: val } : b)));
                }}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#fff',
                  outline: 'none',
                }}
              >
                <option value="transform.position.x">Pos X (Horizontal)</option>
                <option value="transform.position.y">Pos Y (Elevation)</option>
                <option value="transform.position.z">Pos Z (Depth)</option>
                <option value="transform.rotation.x">Rot X</option>
                <option value="transform.rotation.y">Rot Y (Yaw)</option>
                <option value="transform.rotation.z">Rot Z</option>
                <option value="transform.scale.all">Scale</option>
                <option value="visual.opacity">Opacity</option>
                <option value="visual.color.r">RGB Red</option>
                <option value="visual.color.g">RGB Green</option>
                <option value="visual.color.b">RGB Blue</option>
              </select>
            </div>

            {/* Gain and calibration values */}
            <div style={{ display: 'flex', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Gain</span>
                  <span style={{ fontFamily: 'monospace', color: '#00bcff' }}>{activeBinding.multiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={activeBinding.multiplier}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBindings((prev) => prev.map((b) => (b.id === activeBinding.id ? { ...b, multiplier: val } : b)));
                  }}
                  style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Offset</span>
                  <span style={{ fontFamily: 'monospace', color: '#00bcff' }}>{activeBinding.offset.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.2"
                  value={activeBinding.offset}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBindings((prev) => prev.map((b) => (b.id === activeBinding.id ? { ...b, offset: val } : b)));
                  }}
                  style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Custom formula */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Custom Formula override</span>
              <input
                type="text"
                placeholder="e.g. value * Math.sin(t)"
                value={activeBinding.expression}
                onChange={(e) => {
                  const val = e.target.value;
                  setBindings((prev) => prev.map((b) => (b.id === activeBinding.id ? { ...b, expression: val } : b)));
                }}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  fontSize: '10px',
                  color: '#fff',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
