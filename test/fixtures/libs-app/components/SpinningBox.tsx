"use client";
import { Canvas } from "@react-three/fiber";

/** A React Three Fiber scene: WebGL canvas, lights, one lit cube. */
export function SpinningBox({ color }: { color: string }) {
  return (
    <div style={{ width: 320, height: 240 }}>
      <Canvas camera={{ position: [2.5, 2, 3] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <mesh rotation={[0.4, 0.6, 0]}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </Canvas>
    </div>
  );
}
