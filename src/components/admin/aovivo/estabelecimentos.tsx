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
function useLetreiroVertical(texto: string, fundo: string, cor: string) {
  const textura = useMemo(() => {
    const tela = document.createElement('canvas');
    tela.width = 256;
    tela.height = 1024;
    const ctx = tela.getContext('2d')!;
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.fillStyle = cor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 110px Georgia, serif';
    const letras = texto.split('');
    letras.forEach((letra, i) => ctx.fillText(letra, 128, 140 + i * (820 / letras.length)));
    const nova = new THREE.CanvasTexture(tela);
    nova.colorSpace = THREE.SRGBColorSpace;
    return nova;
  }, [texto, fundo, cor]);
  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}
function Palmeira({ x, z, altura = 2.6 }: { x: number; z: number; altura?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, altura / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, altura, 6]} />
        <meshStandardMaterial color="#8a7356" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 3) * 0.55, altura - 0.1, Math.cos((i * Math.PI) / 3) * 0.55]} rotation={[0.55 * Math.cos((i * Math.PI) / 3), (i * Math.PI) / 3, -0.55 * Math.sin((i * Math.PI) / 3)]} castShadow>
          <boxGeometry args={[0.28, 0.04, 1.2]} />
          <meshStandardMaterial color="#4f8f3a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
function montarJanelasHotel() {
  const janelas: Item[] = [];
  const aparelhos: Item[] = [];
  for (const y of [1.5, 3.7]) {
    for (let x = -19.8; x <= -7.5; x += 1.55) {
      janelas.push({ p: [x, y, 2.27], e: [0.55, 0.55, 0.06] });
      if (y > 3) aparelhos.push({ p: [x + 0.45, y - 0.55, 2.38], e: [0.4, 0.28, 0.24] });
    }
  }
  for (const x of [-5.6, -4.4]) janelas.push({ p: [x, 1.5, 2.27], e: [0.6, 0.6, 0.06] }, { p: [x, 3.7, 2.27], e: [0.6, 0.6, 0.06] });
  return { janelas, aparelhos };
}
const JANELAS_HOTEL = montarJanelasHotel();
export function HotelBaeza() {
  const totem = useLetreiroVertical('HOTEL BAEZA', '#9aa0a8', '#ffffff');
  const marquise = useLetreiro([{ texto: 'HOTEL BAEZA', tamanho: 150, cor: '#2f3640', fonte: '700' }], '#a3a8ae');
  return (
    <group>
      <Bloco p={[-8.5, 0.05, 3.3]} e={[24, 0.1, 2.4]} cor="#d9d4c8" sombra={false} />
      <Bloco p={[-8.5, 2.5, -0.9]} e={[24, 5, 6.2]} cor="#eadfb2" />
      <Bloco p={[-8.5, 5.12, -0.9]} e={[24.3, 0.35, 6.5]} cor="#b8bcd6" />
      {[-20.3, -13.2, -6.8, -2.4, 3.3].map((x) => <Bloco key={x} p={[x, 2.5, 2.3]} e={[0.4, 5, 0.16]} cor="#b8bcd6" sombra={false} />)}
      {[-3.4, 1.2].map((x) => <Bloco key={x} p={[x, 2.5, 2.28]} e={[1.6, 4.9, 0.12]} cor="#c98a6a" sombra={false} />)}
      <Bloco p={[-0.9, 3.8, 2.29]} e={[3.4, 1.4, 0.06]} cor="#1f2d3d" sombra={false} />
      <Instancias itens={JANELAS_HOTEL.janelas} geometria={GEO.caixa} cor="#2c3e50" sombra={false} />
      <Instancias itens={JANELAS_HOTEL.aparelhos} geometria={GEO.caixa} cor="#f2f2f2" sombra={false} />
      <Bloco p={[0.4, 1.1, 2.29]} e={[2.4, 2.1, 0.06]} cor="#5d7381" sombra={false} />
      <Bloco p={[0.4, 2.35, 3.2]} e={[4.2, 0.25, 2]} cor="#a3a8ae" />
      <Bloco p={[0.4, 2.35, 4.21]} e={[4.2, 0.25, 0.04]} cor="#ffffff" mapa={marquise} sombra={false} />
      {[-1.5, 2.3].map((x) => <Bloco key={x} p={[x, 1.1, 4.05]} e={[0.12, 2.2, 0.12]} cor="#8f949b" />)}
      <Bloco p={[3, 2.1, 4.4]} e={[0.9, 4.2, 0.25]} cor="#ffffff" mapa={totem} />
      {[2.53, 3.47].map((x) => <Bloco key={x} p={[x, 2.1, 4.4]} e={[0.07, 4.2, 0.28]} cor="#c0392b" sombra={false} />)}
      <Bloco p={[3, 4.38, 4.4]} e={[0.6, 0.35, 0.3]} cor="#c0392b" />
      <Bloco p={[-6.5, 0.12, 3.1]} e={[11, 0.14, 1.3]} cor="#7fb069" sombra={false} />
      {[-9.5, -7.4, -5.6, -4.2].map((x, i) => <Palmeira key={x} x={x} z={3.1} altura={2.4 + (i % 2) * 0.5} />)}
      <Bloco p={[-19, 0.6, 3.2]} e={[3, 1.2, 0.15]} cor="#f5f5f5" />
      <Bloco p={[-11, 0.04, -6]} e={[5.6, 0.08, 2.8]} cor="#eae4d8" sombra={false} />
      <Bloco p={[-11, 0.09, -6]} e={[4.8, 0.06, 2.1]} cor="#4fb3e6" sombra={false} />
    </group>
  );
}
export const MODELOS_PROPRIOS: Array<{ nome: RegExp; Modelo: () => React.ReactElement; livres: Array<[number, number, number]> }> = [
  { nome: /bananeira'?s burger/i, Modelo: BananeirasBurger, livres: [[0, 0.5, 7.5]] },
  { nome: /hotel baeza/i, Modelo: HotelBaeza, livres: [[-16.5, -1, 6.8], [-8.5, -1, 6.8], [-0.5, -1, 6.8], [-11, -5.5, 4]] },
];
export function modeloProprio(nome: string) {
  return MODELOS_PROPRIOS.find((m) => m.nome.test(nome)) ?? null;
}
