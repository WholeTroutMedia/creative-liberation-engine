import { Html } from '@react-three/drei';
import { useState } from 'react';

// Define some Points of Interest for the Hill Country digital twin
const POIS = [
  { id: 'poi-1', label: 'Main Residence', position: [0, 1.5, 0], lookAt: [0, 1.5, 0], cameraPos: [5, 3, 5] },
  { id: 'poi-2', label: 'The Overlook', position: [-8, 4, -5], lookAt: [-8, 4, -5], cameraPos: [-12, 6, -10] },
  { id: 'poi-3', label: 'Guest Cabins', position: [10, 0.5, -8], lookAt: [10, 0.5, -8], cameraPos: [15, 2, -12] },
  { id: 'poi-4', label: 'River Access', position: [2, -2, 12], lookAt: [2, -2, 12], cameraPos: [0, 0, 18] },
];

export function GuidedNavigation({ cameraControlsRef }: { cameraControlsRef: any }) {
  const [hoveredPoi, setHoveredPoi] = useState<string | null>(null);

  const handlePoiClick = (poi: typeof POIS[0]) => {
    if (cameraControlsRef.current) {
      // Smoothly animate the camera to the new position and lookAt target
      cameraControlsRef.current.setLookAt(
        poi.cameraPos[0], poi.cameraPos[1], poi.cameraPos[2],
        poi.lookAt[0], poi.lookAt[1], poi.lookAt[2],
        true // true for animation
      );
    }
  };

  return (
    <>
      {POIS.map((poi) => {
        const isHovered = hoveredPoi === poi.id;
        
        return (
          <Html
            key={poi.id}
            position={poi.position as [number, number, number]}
            transform
            occlude
            distanceFactor={10} // Scales the HTML so it feels naturally sized at distance
            zIndexRange={[100, 0]}
          >
            <div 
              className={`poi-marker glass-panel ${isHovered ? 'hovered' : ''}`}
              onPointerEnter={() => setHoveredPoi(poi.id)}
              onPointerLeave={() => setHoveredPoi(null)}
              onClick={() => handlePoiClick(poi)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                transform: isHovered ? 'scale(1.1) translateY(-5px)' : 'scale(1) translateY(0)',
                border: isHovered ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isHovered ? '0 10px 30px -10px rgba(0,0,0,0.5)' : 'none',
                userSelect: 'none',
              }}
            >
              <div 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: isHovered ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: isHovered ? '0 0 10px #fff' : 'none',
                  transition: 'all 0.3s ease'
                }} 
              />
              <span style={{ 
                fontSize: '14px', 
                fontWeight: isHovered ? 600 : 400,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                color: isHovered ? '#fff' : 'rgba(255,255,255,0.8)'
              }}>
                {poi.label}
              </span>
            </div>
            
            {/* Optional extra data panel that expands on hover */}
            {/* Expanded Telemetry Data Panel */}
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '12px',
                padding: '16px',
                width: '240px',
                opacity: isHovered ? 1 : 0,
                visibility: isHovered ? 'visible' : 'hidden',
                transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                transformOrigin: 'top center',
                scale: isHovered ? 1 : 0.95,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#4ade80', letterSpacing: '0.1em', fontWeight: 600 }}>Active Lock</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>ID: {poi.id.toUpperCase()}</span>
              </div>
              
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Coordinates</span>
                  <span style={{ fontFamily: 'monospace' }}>{poi.position.map(n => n.toFixed(2)).join(', ')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Elevation</span>
                  <span style={{ fontFamily: 'monospace' }}>{(poi.position[1] * 3.28084).toFixed(1)} ft</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Volume</span>
                  <span style={{ fontFamily: 'monospace' }}>1.2B Splats</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Latency</span>
                  <span style={{ fontFamily: 'monospace' }}>14ms (Local)</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Last Sync:</span>
                <span style={{ color: '#fff' }}>LIVE</span>
              </div>
            </div>
          </Html>
        );
      })}
    </>
  );
}
