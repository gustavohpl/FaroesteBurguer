import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GEO, Instancias, type Item } from './pecas';
import { dentroDoLote, type Lote } from './lote';
type P2 = [number, number];
const RAIO_BANCO = 1.1;
const ALTURA_PALMEIRA = 3.4;
const GEO_BANCO = new THREE.TorusGeometry(RAIO_BANCO, 0.11, 3, 14, 1.3).rotateZ(-0.65).rotateX(Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.2, 0);
const GEO_PE = new THREE.BoxGeometry(0.1, 0.2, 0.14).translate(0, 0.1, 0);
const GEO_CAULE = new THREE.CylinderGeometry(0.06, 0.09, 1, 6).translate(0, 0.5, 0);
const GEO_BASE_CAULE = new THREE.CylinderGeometry(0.095, 0.1, 1, 6).translate(0, 0.5, 0);
const GEO_POSTE = new THREE.CylinderGeometry(0.04, 0.06, 1, 6).translate(0, 0.5, 0);
const GEO_LUZ = new THREE.SphereGeometry(0.16, 8, 6);
const GEO_COPA_PALMEIRA = mergeGeometries(
  Array.from({ length: 11 }, (_, i) =>
    new THREE.BoxGeometry(1.5, 0.02, 0.2)
      .translate(0.75, 0, 0)
      .rotateZ(i % 2 ? -0.75 : -0.4)
      .rotateY((i * Math.PI * 2) / 11),
  ),
);
function girarY(x: number, z: number, g: number): P2 {
  return [x * Math.cos(g) + z * Math.sin(g), -x * Math.sin(g) + z * Math.cos(g)];
}
function dentroDoPoligono(anel: number[], x: number, z: number) {
  let dentro = false;
  for (let i = 0, j = anel.length - 2; i < anel.length; j = i, i += 2) {
    const [xi, zi, xj, zj] = [anel[i], anel[i + 1], anel[j], anel[j + 1]];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}
function useMosaico() {
  const textura = useMemo(() => {
    const tela = document.createElement('canvas');
    tela.width = 256;
    tela.height = 256;
    const ctx = tela.getContext('2d')!;
    ctx.fillStyle = '#9a6446';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#f2ece2';
    ctx.lineWidth = 14;
    for (let linha = 0; linha < 2; linha++) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const y = 64 + linha * 128 + Math.sin((x / 256) * Math.PI * 2) * 34;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const nova = new THREE.CanvasTexture(tela);
    nova.colorSpace = THREE.SRGBColorSpace;
    nova.wrapS = THREE.RepeatWrapping;
    nova.wrapT = THREE.RepeatWrapping;
    nova.anisotropy = 4;
    return nova;
  }, []);
  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}
function quadrilatero(pontos: P2[], y: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pontos.flatMap(([x, z]) => [x, y, z]), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(pontos.flatMap(([x, z]) => [x / 2.4, z / 2.4]), 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pontos.flatMap(() => [0, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo.toNonIndexed();
}
function faixa([ax, az]: P2, [bx, bz]: P2, largura: number, y: number) {
  const comp = Math.hypot(bx - ax, bz - az) || 1;
  const nx = (-(bz - az) / comp) * (largura / 2);
  const nz = ((bx - ax) / comp) * (largura / 2);
  return quadrilatero([[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]], y);
}
function disco([cx, cz]: P2, raio: number, y: number) {
  const geo = new THREE.CircleGeometry(raio, 28).rotateX(-Math.PI / 2).translate(cx, y, cz);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 2.4, pos.getZ(i) / 2.4);
  return geo.toNonIndexed();
}
function montarPraca(anel: number[], lote: Lote) {
  const [ax, az, bx, bz, cx, cz, dx, dz] = anel;
  const ponto = (u: number, v: number): P2 => [
    ax * (1 - u) * (1 - v) + dx * u * (1 - v) + cx * u * v + bx * (1 - u) * v,
    az * (1 - u) * (1 - v) + dz * u * (1 - v) + cz * u * v + bz * (1 - u) * v,
  ];
  const livre = ([x, z]: P2, folga = 1) => dentroDoPoligono(anel, x, z) && !dentroDoLote(lote, x, z, folga);
  const distancia = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const meio = ponto(0.5, 0.5);
  const grade: P2[] = [];
  for (let u = 0.2; u <= 0.8; u += 0.05) for (let v = 0.2; v <= 0.8; v += 0.05) grade.push(ponto(u, v));
  const fonte = grade.filter((p) => livre(p, 3.4)).sort((a, b) => distancia(a, meio) - distancia(b, meio))[0] ?? meio;
  const yGrama = 0.06;
  const yPiso = 0.075;
  const contorno = new THREE.Shape(Array.from({ length: anel.length / 2 }, (_, i) => new THREE.Vector2(anel[i * 2], -anel[i * 2 + 1])));
  const grama = new THREE.ShapeGeometry(contorno).rotateX(-Math.PI / 2).translate(0, yGrama, 0);
  const borda = (u0: number, v0: number, u1: number, v1: number) => quadrilatero([ponto(u0, v0), ponto(u1, v0), ponto(u1, v1), ponto(u0, v1)], yPiso);
  const piso = mergeGeometries([
    borda(0.06, 0.07, 0.94, 0.15),
    borda(0.06, 0.85, 0.94, 0.93),
    borda(0.06, 0.07, 0.12, 0.93),
    borda(0.88, 0.07, 0.94, 0.93),
    faixa(ponto(0.09, 0.11), ponto(0.91, 0.89), 1.3, yPiso),
    faixa(ponto(0.09, 0.89), ponto(0.91, 0.11), 1.3, yPiso),
    faixa(ponto(0.5, 0.1), fonte, 1.1, yPiso),
    faixa(ponto(0.5, 0.9), fonte, 1.1, yPiso),
    faixa(ponto(0.09, 0.5), fonte, 1.1, yPiso),
    disco(fonte, 3.1, yPiso + 0.002),
  ]);
  const bancos: Item[] = [];
  const pes: Item[] = [];
  const banco = (centro: P2, direcao: number) => {
    const ponta: P2 = [centro[0] + Math.cos(direcao) * RAIO_BANCO, centro[1] + Math.sin(direcao) * RAIO_BANCO];
    if (!livre(ponta) || !livre(centro, 0.4)) return;
    const g = Math.atan2(-Math.sin(direcao), Math.cos(direcao));
    bancos.push({ p: [centro[0], 0, centro[1]], g });
    for (const a of [-0.5, 0, 0.5]) {
      const [px, pz] = girarY(Math.cos(a) * RAIO_BANCO, Math.sin(a) * RAIO_BANCO, g);
      pes.push({ p: [centro[0] + px, 0, centro[1] + pz], g: g - a });
    }
  };
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    banco([fonte[0] + Math.cos(ang) * 3.5, fonte[1] + Math.sin(ang) * 3.5], ang + Math.PI);
  }
  const ilhas: P2[] = [[0.3, 0.5], [0.7, 0.5], [0.5, 0.27], [0.5, 0.73], [0.24, 0.3], [0.76, 0.7], [0.24, 0.7], [0.76, 0.3]];
  ilhas.forEach(([u, v], i) => {
    const c = ponto(u, v);
    banco(c, Math.atan2(c[1] - meio[1], c[0] - meio[0]) + (i % 2 ? 0.4 : -0.4));
  });
  const lugaresPalmeira: P2[] = [
    [0.03, 0.04], [0.35, 0.03], [0.65, 0.03], [0.97, 0.04], [0.03, 0.5], [0.97, 0.5],
    [0.03, 0.96], [0.35, 0.97], [0.65, 0.97], [0.97, 0.96], [0.36, 0.4], [0.64, 0.6], [0.36, 0.6], [0.64, 0.4],
    [0.03, 0.27], [0.03, 0.73], [0.2, 0.2], [0.2, 0.8], [0.8, 0.03], [0.8, 0.97],
  ];
  const palmeiras = lugaresPalmeira.map(([u, v]) => ponto(u, v)).filter((p) => livre(p, 0.6));
  const altura = (i: number) => ALTURA_PALMEIRA * (0.9 + (i % 3) * 0.08);
  const caules: Item[] = palmeiras.map(([x, z], i) => ({ p: [x, 0, z], e: [1, altura(i), 1] }));
  const bases: Item[] = palmeiras.map(([x, z]) => ({ p: [x, 0, z], e: [1, 0.75, 1] }));
  const copas: Item[] = palmeiras.map(([x, z], i) => ({ p: [x, altura(i), z], g: i * 1.3, e: [1.1, 1, 1.1] }));
  const arvore = ([[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9], [0.2, 0.5], [0.8, 0.5], [0.5, 0.15], [0.5, 0.85]] as P2[])
    .map(([u, v]) => ponto(u, v))
    .filter((p) => livre(p, 2.2))
    .sort((a, b) => distancia(a, [lote.x, lote.z]) - distancia(b, [lote.x, lote.z]))[0];
  const postes = [ponto(0.09, 0.3), ponto(0.91, 0.7), ponto(0.3, 0.89), ponto(0.7, 0.11)].filter((p) => livre(p)).slice(0, 2);
  return { grama, piso, fonte, bancos, pes, caules, bases, copas, arvore, postes };
}
export function PracaFaroeste({ anel, lote }: { anel: number[]; lote: Lote }) {
  const mosaico = useMosaico();
  const praca = useMemo(() => montarPraca(anel, lote), [anel, lote]);
  useEffect(() => () => { praca.grama.dispose(); praca.piso.dispose(); }, [praca]);
  const [fx, fz] = praca.fonte;
  return (
    <group>
      <mesh geometry={praca.grama} receiveShadow>
        <meshLambertMaterial color="#7fb069" />
      </mesh>
      <mesh geometry={praca.piso} receiveShadow>
        <meshLambertMaterial map={mosaico} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[fx, 0.15, fz]} castShadow receiveShadow>
        <cylinderGeometry args={[2.25, 2.3, 0.18, 32]} />
        <meshLambertMaterial color="#d9d4c8" />
      </mesh>
      <mesh position={[fx, 0.25, fz]}>
        <cylinderGeometry args={[2, 2, 0.02, 32]} />
        <meshStandardMaterial color="#3d4a52" roughness={0.15} metalness={0.2} />
      </mesh>
      <Instancias itens={praca.bancos} geometria={GEO_BANCO} cor="#a9c8e8" />
      <Instancias itens={praca.pes} geometria={GEO_PE} cor="#f4f4f0" />
      <Instancias itens={praca.caules} geometria={GEO_CAULE} cor="#857a6c" />
      <Instancias itens={praca.bases} geometria={GEO_BASE_CAULE} cor="#f6f6f2" />
      <Instancias itens={praca.copas} geometria={GEO_COPA_PALMEIRA} cor="#5f9a3f" />
      {praca.arvore && (
        <>
          <Instancias itens={[{ p: [praca.arvore[0], 1, praca.arvore[1]], e: [1.5, 2, 1.5] }]} geometria={GEO.tronco} cor="#6b5440" />
          <Instancias itens={[{ p: [praca.arvore[0], 3.1, praca.arvore[1]], e: [2.4, 1.6, 2.4] }]} geometria={GEO.copa} cor="#4e8a3a" />
        </>
      )}
      <Instancias itens={praca.postes.map(([x, z]) => ({ p: [x, 0, z], e: [1, 2.6, 1] }))} geometria={GEO_POSTE} cor="#4a4f55" />
      <Instancias itens={praca.postes.map(([x, z]) => ({ p: [x, 2.7, z] }))} geometria={GEO_LUZ} sombra={false} cor="#fff6d8" emissiva="#ffe9a8" intensidade={0.6} />
    </group>
  );
}
