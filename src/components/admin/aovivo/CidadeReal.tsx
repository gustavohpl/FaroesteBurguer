import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Building2, Church, Cross, Fuel, GraduationCap, Landmark, MapPin, Pill, Shield, ShoppingCart, Trees } from 'lucide-react';
import { GEO, Instancias, cliqueValido, type Item, type Vetor } from './pecas';
import { LARGURAS, type MapaCidade } from './tiposMapa';
import { dentroDoLote, type Lote } from './lote';
import { sorteio } from './trajetos';
const PAREDES = ['#fde3c8', '#e2ecf7', '#f6d9d6', '#e1efe2', '#f3ead0', '#ece2f4'];
const TELHADOS = ['#c2693e', '#8a5a44', '#6b7f99', '#a04a3a', '#7a8b5b'];
const TOLDOS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed'];
const FOLHAS = ['#8cc084', '#7bb26f', '#9fcd8a', '#6fa765'];
const PASSEIOS = new Set(['footway', 'path', 'cycleway', 'steps', 'pedestrian']);
const LADO_DO_BLOCO = 450;
const ICONES_ROTULO: Record<string, typeof MapPin> = { igreja: Church, escola: GraduationCap, hospital: Cross, saude: Cross, posto: Fuel, banco: Landmark, prefeitura: Building2, policia: Shield, mercado: ShoppingCart, farmacia: Pill, praca: Trees, bairro: MapPin };
function geometriaPlana(posicoes: number[]) {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
  const normais = new Float32Array(posicoes.length);
  for (let i = 1; i < normais.length; i += 3) normais[i] = 1;
  geometria.setAttribute('normal', new THREE.BufferAttribute(normais, 3));
  return geometria;
}
function circulo(saida: number[], x: number, z: number, raio: number, y: number, lados: number) {
  for (let k = 0; k < lados; k++) {
    const a0 = (k / lados) * Math.PI * 2;
    const a1 = ((k + 1) / lados) * Math.PI * 2;
    saida.push(x, y, z, x + Math.cos(a1) * raio, y, z + Math.sin(a1) * raio, x + Math.cos(a0) * raio, y, z + Math.sin(a0) * raio);
  }
}
function faixas(linhas: Array<{ pontos: number[]; largura: number }>, y: number) {
  const saida: number[] = [];
  for (const { pontos, largura } of linhas) {
    const meia = largura / 2;
    for (let i = 0; i + 1 < pontos.length; i += 2) {
      const x = pontos[i];
      const z = pontos[i + 1];
      circulo(saida, x, z, meia, y, 8);
      if (i + 3 >= pontos.length) continue;
      const x2 = pontos[i + 2];
      const z2 = pontos[i + 3];
      const tamanho = Math.hypot(x2 - x, z2 - z) || 1;
      const nx = (-(z2 - z) / tamanho) * meia;
      const nz = ((x2 - x) / tamanho) * meia;
      saida.push(x + nx, y, z + nz, x2 + nx, y, z2 + nz, x - nx, y, z - nz);
      saida.push(x - nx, y, z - nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz);
    }
  }
  return geometriaPlana(saida);
}
function poligonos(aneis: number[][], y: number) {
  const saida: number[] = [];
  for (const anel of aneis) {
    const contorno: THREE.Vector2[] = [];
    for (let i = 0; i + 1 < anel.length; i += 2) contorno.push(new THREE.Vector2(anel[i], anel[i + 1]));
    if (contorno.length > 3 && contorno[0].equals(contorno[contorno.length - 1])) contorno.pop();
    if (contorno.length < 3) continue;
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contorno, [])) {
      const [pa, pb, pc] = [contorno[a], contorno[b], contorno[c]];
      const cima = (pb.y - pa.y) * (pc.x - pa.x) - (pb.x - pa.x) * (pc.y - pa.y) > 0;
      const [p2, p3] = cima ? [pb, pc] : [pc, pb];
      saida.push(pa.x, y, pa.y, p2.x, y, p2.y, p3.x, y, p3.y);
    }
  }
  return geometriaPlana(saida);
}
function predios(lista: MapaCidade['predios']) {
  const pecas = lista.flatMap(([altura, anel]) => {
    const pontos: THREE.Vector2[] = [];
    for (let i = 0; i + 1 < anel.length; i += 2) pontos.push(new THREE.Vector2(anel[i], -anel[i + 1]));
    if (pontos.length > 3 && pontos[0].equals(pontos[pontos.length - 1])) pontos.pop();
    if (pontos.length < 3) return [];
    const forma = new THREE.ExtrudeGeometry(new THREE.Shape(pontos), { depth: altura, bevelEnabled: false });
    forma.rotateX(-Math.PI / 2);
    forma.deleteAttribute('uv');
    return [forma];
  });
  return pecas.length ? mergeGeometries(pecas) : null;
}
type Bloco = { caixas: Item[]; telhados: Item[]; troncos: Item[]; copas: Item[] };
function montarBlocos(mapa: MapaCidade, lote: Lote | null) {
  const blocos = new Map<string, Bloco>();
  const bloco = (x: number, z: number) => {
    const chave = `${Math.floor(x / LADO_DO_BLOCO)},${Math.floor(z / LADO_DO_BLOCO)}`;
    let atual = blocos.get(chave);
    if (!atual) {
      atual = { caixas: [], telhados: [], troncos: [], copas: [] };
      blocos.set(chave, atual);
    }
    return atual;
  };
  const c = mapa.casas;
  for (let i = 0; i + 5 < c.length; i += 6) {
    const [x, z, graus, estilo, tomParede, tomTelhado] = [c[i], c[i + 1], c[i + 2], c[i + 3], c[i + 4], c[i + 5]];
    if (lote && dentroDoLote(lote, x, z, 2.5)) continue;
    const g = (graus * Math.PI) / 180;
    const cos = Math.cos(g);
    const sin = Math.sin(g);
    const local = (ox: number, oy: number, oz: number): Vetor => [x + ox * cos + oz * sin, oy, z - ox * sin + oz * cos];
    const b = bloco(x, z);
    const parede = PAREDES[tomParede % PAREDES.length];
    if (estilo === 2) {
      b.caixas.push({ p: [x, 1.7, z], e: [4, 3.4, 3.6], g, cor: parede });
      b.caixas.push({ p: [x, 3.5, z], e: [4.3, 0.3, 3.9], g, cor: '#d9d4cc' });
      b.caixas.push({ p: local(0, 2.35, 2.15), e: [3.8, 0.12, 1], g, cor: TOLDOS[tomTelhado % TOLDOS.length] });
      b.caixas.push({ p: local(0, 1.1, 1.82), e: [3.2, 1.7, 0.06], g, cor: '#a9c9e6' });
      continue;
    }
    const alto = estilo === 1;
    b.caixas.push({ p: [x, alto ? 2.3 : 1.2, z], e: [3.6, alto ? 4.6 : 2.4, 3.2], g, cor: parede });
    b.telhados.push({ p: [x, alto ? 4.6 : 2.4, z], e: [2.9, alto ? 1.3 : 1.5, 2.6], g, cor: TELHADOS[tomTelhado % TELHADOS.length] });
    b.caixas.push({ p: local(0.75, 0.65, 1.62), e: [0.7, 1.3, 0.08], g, cor: '#8b5a3c' });
    b.caixas.push({ p: local(-0.75, 1.45, 1.62), e: [0.9, 0.7, 0.08], g, cor: '#bcd7f0' });
    if (alto) b.caixas.push({ p: local(0, 3.5, 1.62), e: [1.6, 0.8, 0.08], g, cor: '#bcd7f0' });
  }
  const aleatorio = sorteio(5);
  const a = mapa.arvores;
  for (let i = 0; i + 1 < a.length; i += 2) {
    const x = a[i];
    const z = a[i + 1];
    const r = 0.9 + aleatorio() * 0.5;
    const tom = FOLHAS[Math.floor(aleatorio() * FOLHAS.length)];
    if (lote && dentroDoLote(lote, x, z, 1.5)) continue;
    const b = bloco(x, z);
    b.troncos.push({ p: [x, 0.6, z], e: [1, 1.2, 1] });
    b.copas.push({ p: [x, 1.6 + r * 0.6, z], e: [r, r * 1.15, r], cor: tom });
  }
  return [...blocos.entries()];
}
function montarChao(mapa: MapaCidade) {
  const urbanas: Array<{ pontos: number[]; largura: number }> = [];
  const calcadas: Array<{ pontos: number[]; largura: number }> = [];
  const terra: Array<{ pontos: number[]; largura: number }> = [];
  const passeios: Array<{ pontos: number[]; largura: number }> = [];
  for (const [tipo, , , pontos] of mapa.ruas) {
    const nome = mapa.tipos[tipo];
    const largura = LARGURAS[nome] ?? 4;
    if (PASSEIOS.has(nome)) passeios.push({ pontos, largura });
    else if (nome === 'track') terra.push({ pontos, largura });
    else {
      urbanas.push({ pontos, largura });
      if (nome !== 'service') calcadas.push({ pontos, largura: largura + 2.4 });
    }
  }
  const ilhas: number[] = [];
  for (const [x, z, raio] of mapa.rotatorias) if (raio > 0.8) circulo(ilhas, x, z, raio, 0.12, 24);
  const verdes = (tipo: string) => mapa.verdes.filter(([t]) => t === tipo).map(([, , anel]) => anel);
  return {
    calcadas: faixas(calcadas, 0.04),
    asfalto: faixas(urbanas, 0.09),
    terra: faixas(terra, 0.085),
    passeios: faixas(passeios, 0.07),
    rios: faixas(mapa.rios.map((pontos) => ({ pontos, largura: 1.8 })), 0.05),
    pracas: poligonos(verdes('praca'), 0.03),
    matas: poligonos(verdes('mata'), 0.025),
    cemiterios: poligonos(verdes('cemiterio'), 0.03),
    quadras: poligonos(mapa.quadras, 0.1),
    aguas: poligonos(mapa.aguas, 0.06),
    ilhas: geometriaPlana(ilhas),
    predios: predios(mapa.predios),
  };
}
function Superficie({ geometria, cor }: { geometria: THREE.BufferGeometry; cor: string }) {
  return (
    <mesh geometry={geometria} receiveShadow>
      <meshStandardMaterial color={cor} roughness={1} />
    </mesh>
  );
}
export function CidadeReal({ mapa, lote, rotulos, aoClicarChao }: { mapa: MapaCidade; lote: Lote | null; rotulos: boolean; aoClicarChao: (x: number, z: number) => void }) {
  const chao = useMemo(() => montarChao(mapa), [mapa]);
  const blocos = useMemo(() => montarBlocos(mapa, lote), [mapa, lote]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={(e) => cliqueValido(e) && aoClicarChao(e.point.x, e.point.z)}>
        <planeGeometry args={[40000, 40000]} />
        <meshStandardMaterial color="#efeae1" roughness={1} />
      </mesh>
      <Superficie geometria={chao.matas} cor="#b7d39f" />
      <Superficie geometria={chao.pracas} cor="#cfe3b4" />
      <Superficie geometria={chao.cemiterios} cor="#dedad0" />
      <Superficie geometria={chao.calcadas} cor="#e7e2d9" />
      <Superficie geometria={chao.rios} cor="#9cc7e8" />
      <Superficie geometria={chao.aguas} cor="#9cc7e8" />
      <Superficie geometria={chao.passeios} cor="#eadfca" />
      <Superficie geometria={chao.terra} cor="#d9c6a2" />
      <Superficie geometria={chao.asfalto} cor="#cfd4dc" />
      <Superficie geometria={chao.quadras} cor="#9cc58a" />
      <Superficie geometria={chao.ilhas} cor="#b9d89e" />
      {chao.predios && (
        <mesh geometry={chao.predios} castShadow receiveShadow>
          <meshStandardMaterial color="#e4ded4" roughness={0.9} />
        </mesh>
      )}
      {blocos.map(([chave, b]) => (
        <group key={chave}>
          <Instancias itens={b.caixas} geometria={GEO.caixa} />
          <Instancias itens={b.telhados} geometria={GEO.telhado} />
          <Instancias itens={b.troncos} geometria={GEO.tronco} cor="#9b7653" />
          <Instancias itens={b.copas} geometria={GEO.copa} />
        </group>
      ))}
      {rotulos && mapa.rotulos.map(([tipo, x, z, nome], i) => {
        const Icone = ICONES_ROTULO[tipo] ?? MapPin;
        return (
          <Html key={i} position={[x, tipo === 'bairro' ? 2 : 6, z]} center zIndexRange={[15, 0]} className="pointer-events-none select-none">
            <div className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ring-1 ring-black/5 ${tipo === 'bairro' ? 'bg-gray-900/70 text-white' : 'bg-white/85 text-gray-700'}`}>
              <Icone className="h-3 w-3" />{mapa.nomes[nome]}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
