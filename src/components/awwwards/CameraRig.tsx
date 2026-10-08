import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraRigProps {
  progress: React.MutableRefObject<number>;
  isMobile?: boolean;
}

export function CameraRig({ progress, isMobile = false }: CameraRigProps) {
  const { camera } = useThree();
  const target = new THREE.Vector3(0, 0.2, 0);
  const baseRadius = isMobile ? 5.7 : 6;

  useFrame(() => {
    const p = progress.current;

    const angle = (p - 0.5) * 1.2;
    const radius = baseRadius - p * 0.8;
    const desiredX = Math.sin(angle) * radius;
    const desiredZ = Math.cos(angle) * radius;
    const desiredY = 1.6 + p * 1.2;

    camera.position.x += (desiredX - camera.position.x) * 0.08;
    camera.position.y += (desiredY - camera.position.y) * 0.08;
    camera.position.z += (desiredZ - camera.position.z) * 0.08;

    camera.lookAt(target);
  });

  return null;
}
