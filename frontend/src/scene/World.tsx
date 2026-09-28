import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

// Placeholder world: a ground plane and a grey box standing in for the café.
// Qi Jun replaces this with the real scene and player movement.
export function World() {
  return (
    <Canvas camera={{ position: [6, 5, 8], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#8fbf8f" />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[3, 2, 3]} />
        <meshStandardMaterial color="#b0b0b0" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
