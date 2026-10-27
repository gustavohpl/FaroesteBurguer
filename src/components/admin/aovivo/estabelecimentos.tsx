import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Bloco, GEO, Instancias, type Item } from './pecas';
type Linha = { texto: string; tamanho: number; cor: string; fonte?: string };
function useLetreiro(linhas: Linha[], fundo: string) {
  const chave = JSON.stringify([linhas, fundo]);
  const textura = useMemo(() => {
    const tela = document.createElement('canvas');
    tela.width = 1024;
    tela.height = 320;
    const ctx = tela.getContext('2d')!;
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const total = linhas.reduce((soma, l) => soma + l.tamanho * 1.15, 0);
    let y = (tela.height - total) / 2;
    for (const l of linhas) {
      let tamanho = l.tamanho;
      ctx.font = `${l.fonte ?? '900'} ${tamanho}px Arial, sans-serif`;
      while (ctx.measureText(l.texto).width > 960 && tamanho > 20) {
        tamanho -= 4;
        ctx.font = `${l.fonte ?? '900'} ${tamanho}px Arial, sans-serif`;
      }
      ctx.fillStyle = l.cor;
      ctx.fillText(l.texto, 512, y + (l.tamanho * 1.15) / 2);
      y += l.tamanho * 1.15;
    }
    const nova = new THREE.CanvasTexture(tela);
    nova.colorSpace = THREE.SRGBColorSpace;
    nova.anisotropy = 4;
    return nova;
  }, [chave]);
  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}
const TIJOLO = '#b5653d';
const GRAFITE = '#3b3b3d';
const PRETO = '#1b1b1c';
function montarMesas() {
  const tampos: Item[] = [];
  const pes: Item[] = [];
  const cadeiras: Item[] = [];
  for (const z of [3.2, 4.5]) {
    for (let x = -5; x <= 5; x += 1.3) {
      if (x > 0.6 && x < 3.4 && z < 4) continue;
      tampos.push({ p: [x, 0.55, z], e: [0.55, 0.05, 0.55] });
      pes.push({ p: [x, 0.28, z], e: [0.06, 0.52, 0.06] });
      for (const lado of [-1, 1]) {
        cadeiras.push({ p: [x + lado * 0.42, 0.3, z], e: [0.3, 0.05, 0.3] });
        cadeiras.push({ p: [x + lado * 0.58, 0.48, z], e: [0.05, 0.38, 0.3] });
      }
    }
  }
  return { tampos, pes, cadeiras };
}
const MESAS = montarMesas();
export function BananeirasBurger() {
  const letreiro = useLetreiro([{ texto: "BANANEIRA'S", tamanho: 150, cor: '#ffffff' }, { texto: 'BURGER & GRILL', tamanho: 70, cor: '#ffffff', fonte: '600' }], '#111111');
  const faixa = useLetreiro([{ texto: "BANANEIRA'S", tamanho: 190, cor: '#ffffff' }], '#1e1e1f');
  const brahma = useLetreiro([{ texto: 'BRAHMA', tamanho: 120, cor: '#ffffff' }], '#c8102e');
  return (
    <group>
      <Bloco p={[0, 0.06, 3.9]} e={[11.2, 0.12, 3]} cor="#cfc6b8" sombra={false} />
      <Bloco p={[0, 1.3, -0.6]} e={[11, 2.6, 6]} cor={GRAFITE} />
      <Bloco p={[-3, 3.9, -1.2]} e={[5, 2.6, 4.8]} cor="#2e2e30" />
      <Bloco p={[3.6, 3.9, -1.8]} e={[3.8, 2.6, 3.6]} cor="#d8cbb3" />
      <Bloco p={[-0.8, 3, 1.9]} e={[2, 6, 1.2]} cor={TIJOLO} />
      {[-1.25, -0.35].map((x, i) => (
        <mesh key={x} position={[x, 4.9 - i * 0.05, 2.53]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.05, 20]} />
          <meshStandardMaterial color="#c8102e" map={i === 1 ? brahma : undefined} />
        </mesh>
      ))}
      <Bloco p={[-3.6, 2.35, 3.2]} e={[4.4, 0.12, 1.8]} cor="#1e1e1f" />
      <Bloco p={[-3.6, 2.6, 4.12]} e={[4.4, 0.45, 0.06]} cor="#ffffff" mapa={faixa} sombra={false} />
      <Bloco p={[-3.6, 1.1, 2.42]} e={[3.6, 1.9, 0.05]} cor="#4a3a30" sombra={false} />
      <Bloco p={[-4.4, 3.9, 1.3]} e={[3, 0.95, 0.12]} cor="#ffffff" mapa={letreiro} />
      {([[-4.4, 4.78, 0.45], [-4.9, 4.62, 0.32], [-3.9, 4.62, 0.32]] as const).map(([x, y, r]) => (
        <mesh key={x} position={[x, y, 1.3]} castShadow>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
      ))}
      {[1, 5.1].map((x) => <Bloco key={x} p={[x, 1.3, 2.3]} e={[0.5, 2.6, 0.5]} cor={TIJOLO} />)}
      <Bloco p={[3.05, 1.25, 2.42]} e={[3.4, 1.9, 0.05]} cor="#6f8f9a" sombra={false} />
      <Bloco p={[3.4, 2.68, 0.9]} e={[4.4, 0.15, 3.2]} cor="#8d8d8d" />
      <Bloco p={[3.4, 3.15, 2.42]} e={[4.4, 0.8, 0.06]} cor="#bfe3e6" sombra={false} />
      <Bloco p={[3.4, 5.1, 0.9]} e={[4.6, 0.12, 3.2]} cor="#2a2a2a" />
      {[1.3, 5.5].map((x) => <Bloco key={x} p={[x, 3.9, 2.3]} e={[0.12, 2.4, 0.12]} cor={PRETO} />)}
      {[3.6, 4.6].map((x) => <Bloco key={x} p={[x, 3.4, 0.1]} e={[0.8, 0.6, 0.5]} cor="#f1f1f1" />)}
      <mesh position={[2, 1.35, 2.75]} rotation={[0, 0, 0.75]} castShadow>
        <boxGeometry args={[3.8, 0.1, 0.9]} />
        <meshStandardMaterial color={PRETO} roughness={0.7} />
      </mesh>
      {[2.3, 3.2].map((z) => (
        <mesh key={z} position={[2, 1.85, z]} rotation={[0, 0, 0.75]}>
          <boxGeometry args={[3.8, 0.05, 0.05]} />
          <meshStandardMaterial color={PRETO} />
        </mesh>
      ))}
      <Bloco p={[3.4, 1.3, 2.75]} e={[0.1, 2.6, 0.1]} cor={PRETO} />
      <Instancias itens={MESAS.tampos} geometria={GEO.caixa} cor={PRETO} />
      <Instancias itens={MESAS.pes} geometria={GEO.caixa} cor={PRETO} sombra={false} />
      <Instancias itens={MESAS.cadeiras} geometria={GEO.caixa} cor="#222326" sombra={false} />
      {([[-2.2, 4], [0.4, 3.8]] as const).map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <Bloco p={[0, 0.9, 0]} e={[0.06, 1.8, 0.06]} cor="#555555" sombra={false} />
          <mesh position={[0, 1.85, 0]} castShadow>
            <coneGeometry args={[0.95, 0.4, 10]} />
            <meshStandardMaterial color="#5b5f66" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export const MODELOS_PROPRIOS: Array<{ nome: RegExp; Modelo: () => React.ReactElement; raio: number }> = [
  { nome: /bananeira'?s burger/i, Modelo: BananeirasBurger, raio: 7.5 },
];
export function modeloProprio(nome: string) {
  return MODELOS_PROPRIOS.find((m) => m.nome.test(nome)) ?? null;
}
