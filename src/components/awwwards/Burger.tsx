import React, { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useConfig } from '../../ConfigContext';

const DEFAULT_MODEL_PATH = '/xbacon.glb';

interface BurgerProps {
  progress: React.MutableRefObject<number>;
}

function RotatingGroup({ progress, children }: BurgerProps & { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current) return;
    const p = progress.current;
    const targetY = p * Math.PI * 2;
    const targetX = Math.sin(p * Math.PI) * 0.18;
    const targetZ = Math.sin(p * Math.PI * 2) * 0.08;

    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.1;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.1;
    group.current.rotation.z += (targetZ - group.current.rotation.z) * 0.1;
  });

  return <group ref={group}>{children}</group>;
}

const MODEL_SIZE = 2.0;
const MODEL_CENTER_Y = 0.05;
const OPEN_SPREAD = 0.8;

function GLBModel({ path, progress }: { path: string; progress: React.MutableRefObject<number> }) {
  const { scene } = useGLTF(path);

  const layers = useRef<Array<{ obj: THREE.Object3D; baseY: number; order: number }>>([]);
  const fit = React.useMemo(() => {
    scene.updateMatrixWorld(true);
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    let root: THREE.Object3D = scene;
    while (root.children.length === 1 && !(root.children[0] as THREE.Mesh).isMesh) root = root.children[0];
    let pieces: THREE.Object3D[] = root.children.length >= 2 ? [...root.children] : [];
    if (pieces.length < 2) {
      pieces = [];
      scene.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) pieces.push(obj); });
    }
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6);

    const sorted = pieces
      .map((obj) => ({ obj, y: new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).y }))
      .sort((a, b) => a.y - b.y);
    const mid = (sorted.length - 1) / 2;
    layers.current = sorted.map((s, i) => ({ obj: s.obj, baseY: s.obj.position.y, order: i - mid }));
    return {
      scale,
      position: [-center.x * scale, -center.y * scale + MODEL_CENTER_Y, -center.z * scale] as [number, number, number],
      gap: sorted.length >= 2 ? (size.y * OPEN_SPREAD) / (sorted.length - 1) : 0,
    };
  }, [scene]);

  useFrame(() => {
    if (layers.current.length < 2) return;
    const p = progress.current;
    const open = Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI);
    for (const layer of layers.current) {
      const target = layer.baseY + layer.order * open * fit.gap;
      layer.obj.position.y += (target - layer.obj.position.y) * 0.12;
    }
  });

  return <primitive object={scene} scale={fit.scale} position={fit.position} />;
}

function PlaceholderBurger() {
  return (
    <group position={[0, -0.15, 0]} scale={1.2}>
      <mesh castShadow receiveShadow position={[0, -0.62, 0]}>
        <cylinderGeometry args={[1, 0.92, 0.34, 64]} />
        <meshStandardMaterial color="#d68a3c" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.32, 0]}>
        <cylinderGeometry args={[1.08, 1.08, 0.3, 64]} />
        <meshStandardMaterial color="#43281a" roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.12, 0]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[1.7, 0.07, 1.7]} />
        <meshStandardMaterial
          color="#f4b731"
          roughness={0.35}
          metalness={0.05}
          emissive="#e0821c"
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.96, 0.96, 0.08, 48]} />
        <meshStandardMaterial color="#cf3e2d" roughness={0.5} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <torusGeometry args={[1, 0.18, 14, 64]} />
        <meshStandardMaterial color="#6fae3f" roughness={0.8} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.44, 0]} scale={[1, 0.72, 1]}>
        <sphereGeometry args={[1.05, 64, 40, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#dc9134" roughness={0.5} metalness={0.05} />
      </mesh>
      {Array.from({ length: 18 }).map((_, i) => {
        const a = (i / 18) * Math.PI * 2 * 2.4;
        const t = i / 18;
        const r = 0.18 + t * 0.62;
        const h = 0.72 - t * t * 0.42;
        return (
          <mesh key={i} position={[Math.cos(a) * r, h, Math.sin(a) * r]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#f5e6c0" roughness={0.45} />
          </mesh>
        );
      })}
    </group>
  );
}

class ModelErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
  }
  render() {
    if (this.state.failed) return <>{this.props.fallback}</>;
    return <>{this.props.children}</>;
  }
}

export function Burger({ progress }: BurgerProps) {
  const { config } = useConfig();
  const modelPath = config.heroModelUrl && config.heroModelUrl.trim() !== ''
    ? config.heroModelUrl
    : DEFAULT_MODEL_PATH;

  return (
    <RotatingGroup progress={progress}>
      <ModelErrorBoundary key={modelPath} fallback={<PlaceholderBurger />}>
        <Suspense fallback={<PlaceholderBurger />}>
          <GLBModel path={modelPath} progress={progress} />
        </Suspense>
      </ModelErrorBoundary>
    </RotatingGroup>
  );
}
