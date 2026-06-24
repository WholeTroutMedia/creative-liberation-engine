import { Suspense, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Preload } from '@react-three/drei';
import { EnvironmentStaging } from './components/EnvironmentStaging';
import { VenueRenderer } from './components/VenueRenderer';
import { GuidedNavigation } from './components/GuidedNavigation';
import { HudOverlay } from './ui/HudOverlay';
import './index.css';

export default function App() {
  const cameraControlsRef = useRef<any>(null);

  // In a real flow, this state is driven by the router or the engine's switchboard.
  // We load the high-fidelity GLTF mesh as the digital twin backbone while 
  // the Gaussian Splat processing pipeline is running in the background.
  const [targetVenue] = useState<string | null>('/models/hill-country.glb');

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 2, 5], fov: 45, near: 0.1, far: 1000 }}
        dpr={[1, 2]} // Support high-DPI displays
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#000000']} />
        
        <Suspense fallback={null}>
          <EnvironmentStaging />
          
          {targetVenue && (
            <VenueRenderer assetUrl={targetVenue} />
          )}

          {/* Interactive floating UI layers embedded in the 3D scene */}
          <GuidedNavigation cameraControlsRef={cameraControlsRef} />

          {/* Ensure heavy assets stay in memory when switching */}
          <Preload all />
        </Suspense>

        {/* Cinematic camera controls with damping for premium feel */}
        <CameraControls 
          ref={cameraControlsRef}
          makeDefault 
          dollyToCursor 
          smoothTime={0.4} 
          azimuthRotateSpeed={0.5} 
          polarRotateSpeed={0.5} 
        />
      </Canvas>

      <HudOverlay activeVenue={targetVenue ? 'Hill Country [Zero Day]' : 'Awaiting Ingestion Signal'} />
    </>
  );
}
