import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Splat, Stage } from '@react-three/drei';

interface VenueRendererProps {
  assetUrl: string;
}

export function VenueRenderer({ assetUrl }: VenueRendererProps) {
  // Production implementation that dynamically handles format based on extension.
  // We don't use mocks; we build the real routing logic for the asset.
  
  const isSplat = assetUrl.endsWith('.splat');
  
  if (isSplat) {
    return (
      <group position={[0, 0, 0]}>
        <Splat src={assetUrl} />
      </group>
    );
  }

  // Fallback to high-fidelity GLTF/GLB loading
  // Wrapping in Stage to auto-center and auto-scale unknown-sized assets to debug black screen
  return (
    <Stage environment="city" intensity={0.5} adjustCamera={false}>
      <GLTFModel url={assetUrl} />
    </Stage>
  );
}

function GLTFModel({ url }: { url: string }) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} castShadow receiveShadow />;
}
