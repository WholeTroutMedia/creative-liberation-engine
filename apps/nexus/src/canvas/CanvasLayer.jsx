import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, PerspectiveCamera, CameraControls, Preload, Splat, Float, MeshTransmissionMaterial, Sparkles, Sphere, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GuidedNavigation } from './GuidedNavigation.jsx';
import { EnvironmentStaging } from './EnvironmentStaging.jsx';

const NODE_COUNT = 1200;
const GRID_SIZE = 40;
const SPACING = 1.6;
const COLORS = { cyan: '#00FFCC', pink: '#FF3366', active: '#2a4060', idle: '#0a0e14' };

function CityNodes({ dispatchState }) {
  const meshRef = useRef(null);
  const targetY = useMemo(() => new Float32Array(NODE_COUNT), []);
  const currentY = useMemo(() => new Float32Array(NODE_COUNT), []);
  const nodeColor = useMemo(() => Array(NODE_COUNT).fill('idle'), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < NODE_COUNT; i++) {
      const r = Math.floor(i / GRID_SIZE), c = i % GRID_SIZE;
      const h = Math.random() * 1.2 + 0.15;
      targetY[i] = h; currentY[i] = h;
      dummy.position.set((c - GRID_SIZE/2)*SPACING, h/2, (r - (NODE_COUNT/GRID_SIZE)/2)*SPACING);
      dummy.scale.set(1, h, 1); dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      col.set(COLORS.idle); meshRef.current.setColorAt(i, col);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, []);

  // React to dispatch events
  useEffect(() => {
    if (!meshRef.current) return;
    const { tasks, blockers, queueDepth } = dispatchState;
    if (tasks?.length) {
      const recent = tasks.slice(0, 3);
      recent.forEach((_, k) => {
        const idx = Math.floor(Math.random() * NODE_COUNT);
        targetY[idx] = 5 + Math.random() * 4;
        nodeColor[idx] = 'cyan';
      });
    }
    if (blockers?.length) {
      const idx = Math.floor(Math.random() * NODE_COUNT);
      targetY[idx] = 8 + Math.random() * 3;
      nodeColor[idx] = 'pink';
    }
    if (queueDepth > 0) {
      const count = Math.min(queueDepth, 8);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * NODE_COUNT);
        targetY[idx] = 3 + Math.random() * 2;
        nodeColor[idx] = 'active';
      }
    }
  }, [dispatchState.tasks?.length, dispatchState.blockers?.length, dispatchState.queueDepth]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    for (let i = 0; i < NODE_COUNT; i++) {
      if (targetY[i] > 1.2) { targetY[i] -= 0.035; if (targetY[i] <= 1.2) nodeColor[i] = 'idle'; }
      currentY[i] += (targetY[i] - currentY[i]) * 0.07;
      const h = Math.max(0.05, currentY[i] + Math.sin(time + i * 0.09) * 0.12);
      const r = Math.floor(i / GRID_SIZE), c = i % GRID_SIZE;
      dummy.position.set((c - GRID_SIZE/2)*SPACING, h/2, (r - (NODE_COUNT/GRID_SIZE)/2)*SPACING);
      dummy.scale.set(1, h, 1); dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      col.set(COLORS[nodeColor[i]] ?? COLORS.idle);
      meshRef.current.setColorAt(i, col);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NODE_COUNT]}>
      <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
      <meshStandardMaterial roughness={0.2} metalness={0.8} transparent opacity={0.85} />
    </instancedMesh>
  );
}

function GLTFModel({ url }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} castShadow receiveShadow />;
}

function DataParticles() {
  const count = 3000;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 8;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(Math.random() * 2 - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, [count]);

  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.03;
      ref.current.rotation.z = state.clock.elapsedTime * 0.015;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color="#00FFCC" size={0.03} sizeAttenuation={true} depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.6} />
    </Points>
  );
}

function GyroRings() {
  const groupRef = useRef();
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children[0].rotation.x += delta * 0.2;
      groupRef.current.children[0].rotation.y += delta * 0.1;
      
      groupRef.current.children[1].rotation.y += delta * 0.15;
      groupRef.current.children[1].rotation.z += delta * 0.25;
      
      groupRef.current.children[2].rotation.x -= delta * 0.1;
      groupRef.current.children[2].rotation.z -= delta * 0.15;
    }
  });

  const material = <meshStandardMaterial color="#0a1525" emissive="#00FFCC" emissiveIntensity={0.8} wireframe transparent opacity={0.3} />;

  return (
    <group ref={groupRef}>
      <mesh>
        <torusGeometry args={[3.8, 0.02, 16, 100]} />
        {material}
      </mesh>
      <mesh>
        <torusGeometry args={[4.0, 0.02, 16, 100]} />
        {material}
      </mesh>
      <mesh>
        <torusGeometry args={[4.2, 0.02, 16, 100]} />
        {material}
      </mesh>
    </group>
  );
}

function CognitiveCoreFallback() {
  const coreRef = useRef();
  
  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={1.5} position={[0, 0, 0]}>
      <group scale={1.2}>
        {/* Deep Inner Energy Core */}
        <Sphere args={[1.2, 64, 64]} ref={coreRef}>
          <MeshDistortMaterial 
            color="#00FFCC" 
            emissive="#00FFCC"
            emissiveIntensity={1.5}
            distort={0.4} 
            speed={4} 
            roughness={0.2}
          />
        </Sphere>

        {/* Clear Glass Envelope */}
        <Sphere args={[2.5, 64, 64]}>
          <MeshTransmissionMaterial 
            backside
            samples={6}
            thickness={2.5}
            chromaticAberration={0.15}
            anisotropy={0.8}
            roughness={0.05}
            ior={1.25}
            color="#ffffff"
            transmission={1}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </Sphere>
        
        {/* Outer Plasma Aura */}
        <Sphere args={[2.8, 64, 64]}>
          <MeshDistortMaterial 
            color="#FF3366" 
            emissive="#FF3366"
            emissiveIntensity={0.6}
            distort={0.5} 
            speed={2.5} 
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Sphere>

        <GyroRings />
        <DataParticles />
        
        <Sparkles count={800} scale={15} size={1.5} speed={0.3} opacity={0.4} color="#00FFCC" />
        <Sparkles count={400} scale={12} size={2.5} speed={0.5} opacity={0.6} color="#FF3366" />
      </group>
    </Float>
  );
}

export function VenueRenderer() {
  const [assetUrl, setAssetUrl] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:3901/api/assets/latest')
      .then(res => res.json())
      .then(data => setAssetUrl(data.assetUrl))
      .catch(err => console.error('[VenueRenderer] failed to fetch assetUrl:', err));
  }, []);

  const isSplat = assetUrl && assetUrl.endsWith('.splat');
  
  if (isSplat) {
    return (
      <group position={[0, 0, 0]}>
        <Splat src={assetUrl} />
      </group>
    );
  }

  if (assetUrl) {
    return <GLTFModel url={assetUrl} />;
  }
  
  // Premium Default Fallback
  return <CognitiveCoreFallback />;
}

export function CanvasLayer({ mode, dispatchState, cameraControlsRef }) {
  return (
    <div className="nexus-canvas-layer">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#000508']} />
        
        {mode === 'city' ? (
          <>
            <fog attach="fog" args={['#000508', 60, 180]} />
            <OrthographicCamera makeDefault position={[50, 50, 50]} zoom={12} near={-200} far={1000} />
            <OrbitControls enableRotate enablePan enableZoom maxPolarAngle={Math.PI / 2.2} autoRotate autoRotateSpeed={0.3} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[15, 30, 15]} intensity={2.5} color="#00FFCC" />
            <directionalLight position={[-15, 20, -15]} intensity={1.8} color="#FF3366" />
            <pointLight position={[0, 15, 0]} intensity={3} color="#4466ff" distance={80} />
            
            <CityNodes dispatchState={dispatchState} />
            <gridHelper args={[300, 300, '#0a1520', '#050a10']} position={[0, -0.05, 0]} />
          </>
        ) : (
          <Suspense fallback={null}>
            <EnvironmentStaging />
            <VenueRenderer />
            <GuidedNavigation cameraControlsRef={cameraControlsRef} />
            <Preload all />
            <CameraControls 
              ref={cameraControlsRef}
              makeDefault 
              dollyToCursor 
              smoothTime={0.4} 
              azimuthRotateSpeed={0.5} 
              polarRotateSpeed={0.5} 
            />
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}
