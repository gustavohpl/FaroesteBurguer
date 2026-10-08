import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LightsProps {
  progress: React.MutableRefObject<number>;
}

export function Lights({ progress }: LightsProps) {
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const keyRef = useRef<THREE.SpotLight>(null);

  useFrame(() => {
    const p = progress.current;
    if (rimRef.current) {
      const angle = p * Math.PI * 2;
      rimRef.current.position.set(Math.sin(angle) * 5, 3, Math.cos(angle) * 5);
    }
    if (keyRef.current) {
      keyRef.current.intensity = 18 + Math.sin(p * Math.PI) * 6;
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />

      <spotLight
        ref={keyRef}
        position={[4, 6, 4]}
        angle={0.5}
        penumbra={1}
        intensity={18}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      <directionalLight position={[-5, 2, -2]} intensity={1.2} color="#cfe3ff" />

      <directionalLight ref={rimRef} position={[0, 3, -5]} intensity={2.5} color="#ffd9a0" />
    </>
  );
}
