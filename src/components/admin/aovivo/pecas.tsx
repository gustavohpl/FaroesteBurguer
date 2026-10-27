import React, { useLayoutEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
export type Vetor = [number, number, number];
export type Item = { p: Vetor; e?: Vetor; g?: number; cor?: string };
export const GEO = {
  caixa: new THREE.BoxGeometry(1, 1, 1),
  telhado: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  copa: new THREE.IcosahedronGeometry(1, 1),
  tronco: new THREE.CylinderGeometry(0.16, 0.22, 1, 6),
};
export function cliqueValido(e: ThreeEvent<MouseEvent>) {
  if (e.delta > 6) return false;
  e.stopPropagation();
  return true;
}
export const apontar = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
  onPointerOut: () => { document.body.style.cursor = 'auto'; },
};
export function Instancias({ itens, geometria, sombra = true, cor = '#ffffff', emissiva, intensidade = 0 }: { itens: Item[]; geometria: THREE.BufferGeometry; sombra?: boolean; cor?: string; emissiva?: string; intensidade?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const malha = ref.current;
    if (!malha) return;
    const matriz = new THREE.Matrix4();
    const giro = new THREE.Quaternion();
    const eixo = new THREE.Vector3(0, 1, 0);
    const escala = new THREE.Vector3();
    const posicao = new THREE.Vector3();
    const tom = new THREE.Color();
    itens.forEach((item, i) => {
      giro.setFromAxisAngle(eixo, item.g ?? 0);
      matriz.compose(posicao.set(...item.p), giro, escala.set(...(item.e ?? [1, 1, 1])));
      malha.setMatrixAt(i, matriz);
      if (item.cor) malha.setColorAt(i, tom.set(item.cor));
    });
    malha.instanceMatrix.needsUpdate = true;
    if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
    malha.computeBoundingSphere();
  }, [itens]);
  if (!itens.length) return null;
  return (
    <instancedMesh ref={ref} args={[geometria, undefined, itens.length]} castShadow={sombra} receiveShadow>
      <meshStandardMaterial color={cor} roughness={0.85} emissive={emissiva ?? '#000000'} emissiveIntensity={intensidade} />
    </instancedMesh>
  );
}
export function Bloco({ p, e, cor, g = 0, sombra = true, emissiva, intensidade = 0, mapa }: { p: Vetor; e: Vetor; cor: string; g?: number; sombra?: boolean; emissiva?: string; intensidade?: number; mapa?: THREE.Texture }) {
  return (
    <mesh position={p} rotation={[0, g, 0]} scale={e} geometry={GEO.caixa} castShadow={sombra} receiveShadow>
      <meshStandardMaterial color={cor} roughness={0.85} emissive={emissiva ?? '#000000'} emissiveIntensity={intensidade} map={mapa} />
    </mesh>
  );
}
export function Etiqueta({ y, children }: { y: number; children: React.ReactNode }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[20, 0]} className="pointer-events-none select-none">
      <div className="whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold leading-tight text-gray-800 shadow-md ring-1 ring-black/5">{children}</div>
    </Html>
  );
}
