import { Environment, Sky, ContactShadows } from '@react-three/drei';

export function EnvironmentStaging() {
  return (
    <>
      <Environment preset="city" />
      <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
      <ambientLight intensity={0.2} />
      <directionalLight 
        castShadow 
        position={[10, 20, 5]} 
        intensity={1.5} 
        shadow-mapSize={[2048, 2048]} 
      />
      <ContactShadows
        resolution={1024}
        scale={20}
        blur={2}
        opacity={0.5}
        far={10}
        color="#000000"
      />
    </>
  );
}
