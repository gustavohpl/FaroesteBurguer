import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { Bell, CheckCircle2, Flame, ShoppingBag } from 'lucide-react';
import { ARVORES, CASAS, COZINHA, LANCHONETE, LIMITE, RUAS_X, TRAJETOS_CARROS, VAGAS, amostrar, sorteio, type Rota } from './cidade';
export type Etapa = 'novo' | 'preparo' | 'pronto' | 'rua' | 'entregue';
export type PlanoMoto =
  | { modo: 'vaga' }
  | { modo: 'ida'; rota: Rota; inicio: number; duracao: number }
  | { modo: 'volta'; ida: Rota; volta: Rota; progressoIda: number; inicio: number };
export type MotoCena = { chave: string; nome: string; cor: string; vaga: number; plano: PlanoMoto; pedidoId?: string; rotulo?: string };
export type MarcaCasa = { casa: number; pedidoId: string; etapa: Etapa; titulo: string; legenda: string };
export type EstadoCozinha = { novos: number; preparando: number; prontos: number };
export type Foco = { tipo: 'moto'; chave: string } | { tipo: 'ponto'; x: number; z: number } | null;
export type Comando = { tipo: 'mais' | 'menos' | 'inicio'; n: number } | null;
const CORES_ETAPA: Record<Exclude<Etapa, 'rua'>, string> = { novo: '#f59e0b', preparo: '#f97316', pronto: '#3b82f6', entregue: '#22c55e' };
export function corDaEtapa(etapa: Etapa, cor: string) {
  return etapa === 'rua' ? cor : CORES_ETAPA[etapa];
}
type Vetor = [number, number, number];
type Item = { p: Vetor; e?: Vetor; g?: number; cor?: string };
const GEO = {
  caixa: new THREE.BoxGeometry(1, 1, 1),
  telhado: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  copa: new THREE.IcosahedronGeometry(1, 1),
  tronco: new THREE.CylinderGeometry(0.16, 0.22, 1, 6),
};
const CENTRO_INICIAL = new THREE.Vector3(-10, 0, -5);
const AFASTAMENTO = new THREE.Vector3(30, 34, 30);
export const CAMERA_INICIAL = CENTRO_INICIAL.clone().add(AFASTAMENTO).toArray();
function cliqueValido(e: ThreeEvent<MouseEvent>) {
  if (e.delta > 6) return false;
  e.stopPropagation();
  return true;
}
const apontar = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
  onPointerOut: () => { document.body.style.cursor = 'auto'; },
};
function Instancias({ itens, geometria, sombra = true, cor = '#ffffff', emissiva, intensidade = 0 }: { itens: Item[]; geometria: THREE.BufferGeometry; sombra?: boolean; cor?: string; emissiva?: string; intensidade?: number }) {
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
  }, [itens]);
  return (
    <instancedMesh ref={ref} args={[geometria, undefined, itens.length]} castShadow={sombra} receiveShadow frustumCulled={false}>
      <meshStandardMaterial color={cor} roughness={0.85} emissive={emissiva ?? '#000000'} emissiveIntensity={intensidade} />
    </instancedMesh>
  );
}
function Bloco({ p, e, cor, g = 0, sombra = true, emissiva, intensidade = 0, mapa }: { p: Vetor; e: Vetor; cor: string; g?: number; sombra?: boolean; emissiva?: string; intensidade?: number; mapa?: THREE.Texture }) {
  return (
    <mesh position={p} rotation={[0, g, 0]} scale={e} geometry={GEO.caixa} castShadow={sombra} receiveShadow>
      <meshStandardMaterial color={cor} roughness={0.85} emissive={emissiva ?? '#000000'} emissiveIntensity={intensidade} map={mapa} />
    </mesh>
  );
}
function Etiqueta({ y, children }: { y: number; children: React.ReactNode }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[20, 0]} className="pointer-events-none select-none">
      <div className="whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold leading-tight text-gray-800 shadow-md ring-1 ring-black/5">{children}</div>
    </Html>
  );
}
function localDaCasa(x: number, z: number, giro: number, ox: number, oy: number, oz: number): Vetor {
  return [x + ox * Math.cos(giro) + oz * Math.sin(giro), oy, z - ox * Math.sin(giro) + oz * Math.cos(giro)];
}
function montarItensCidade() {
  const largura = LIMITE.x1 - LIMITE.x0 + 10;
  const comprimento = LIMITE.z1 - LIMITE.z0 + 10;
  const meioX = (LIMITE.x0 + LIMITE.x1) / 2;
  const meioZ = (LIMITE.z0 + LIMITE.z1) / 2;
  const calcadas: Item[] = [{ p: [meioX, 0.0525, 0], e: [largura, 0.105, 7.6], cor: '#e7e2d9' }, ...RUAS_X.map((rx): Item => ({ p: [rx, 0.05, meioZ], e: [6.6, 0.1, comprimento], cor: '#e7e2d9' }))];
  const asfalto: Item[] = [{ p: [meioX, 0.0725, 0], e: [largura, 0.145, 5.2], cor: '#cfd4dc' }, ...RUAS_X.map((rx): Item => ({ p: [rx, 0.07, meioZ], e: [4.4, 0.14, comprimento], cor: '#cfd4dc' }))];
  const faixas: Item[] = [];
  for (let x = LIMITE.x0 - 4; x < LIMITE.x1 + 4; x += 3.2) if (!RUAS_X.some((rx) => Math.abs(x - rx) < 3.6)) faixas.push({ p: [x, 0.155, 0], e: [1.4, 0.02, 0.16] });
  for (const rx of RUAS_X) for (let z = LIMITE.z0 - 4; z < LIMITE.z1 + 4; z += 3.2) if (Math.abs(z) > 4) faixas.push({ p: [rx, 0.15, z], e: [0.16, 0.02, 1.4] });
  const gramados: Item[] = [];
  const paredes: Item[] = [];
  const telhados: Item[] = [];
  const portas: Item[] = [];
  const janelas: Item[] = [];
  for (const c of CASAS) {
    gramados.push({ p: localDaCasa(c.x, c.z, c.giro, 0, 0.03, -0.2), e: [6, 0.06, 4.6], g: c.giro, cor: '#dde8cf' });
    paredes.push({ p: [c.x, 1.2, c.z], e: [3.6, 2.4, 3.2], g: c.giro, cor: c.parede });
    telhados.push({ p: [c.x, 2.4, c.z], e: [2.9, 1.5, 2.6], g: c.giro, cor: c.telhado });
    portas.push({ p: localDaCasa(c.x, c.z, c.giro, 0.75, 0.65, 1.62), e: [0.7, 1.3, 0.08], g: c.giro });
    janelas.push({ p: localDaCasa(c.x, c.z, c.giro, -0.75, 1.45, 1.62), e: [0.9, 0.7, 0.08], g: c.giro });
  }
  const aleatorio = sorteio(5);
  const verdes = ['#8cc084', '#7bb26f', '#9fcd8a', '#6fa765'];
  const troncos: Item[] = ARVORES.map(([x, z]) => ({ p: [x, 0.6, z], e: [1, 1.2, 1] }));
  const copas: Item[] = ARVORES.map(([x, z]) => {
    const r = 0.9 + aleatorio() * 0.5;
    return { p: [x, 1.6 + r * 0.6, z], e: [r, r * 1.15, r], cor: verdes[Math.floor(aleatorio() * verdes.length)] };
  });
  return { calcadas, asfalto, faixas, gramados, paredes, telhados, portas, janelas, troncos, copas };
}
const CIDADE = montarItensCidade();
function Cidade({ aoClicarChao }: { aoClicarChao: () => void }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={(e) => cliqueValido(e) && aoClicarChao()}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#efeae1" roughness={1} />
      </mesh>
      <Instancias itens={CIDADE.calcadas} geometria={GEO.caixa} sombra={false} />
      <Instancias itens={CIDADE.asfalto} geometria={GEO.caixa} sombra={false} />
      <Instancias itens={CIDADE.faixas} geometria={GEO.caixa} sombra={false} />
      <Instancias itens={CIDADE.gramados} geometria={GEO.caixa} sombra={false} />
      <Instancias itens={CIDADE.paredes} geometria={GEO.caixa} />
      <Instancias itens={CIDADE.telhados} geometria={GEO.telhado} />
      <Instancias itens={CIDADE.portas} geometria={GEO.caixa} sombra={false} cor="#8b5a3c" />
      <Instancias itens={CIDADE.janelas} geometria={GEO.caixa} sombra={false} cor="#bcd7f0" emissiva="#bcd7f0" intensidade={0.15} />
      <Instancias itens={CIDADE.troncos} geometria={GEO.tronco} cor="#9b7653" />
      <Instancias itens={CIDADE.copas} geometria={GEO.copa} />
    </group>
  );
}
function useTexturaPlaca(texto: string, cor: string) {
  const textura = useMemo(() => {
    const tela = document.createElement('canvas');
    tela.width = 1024;
    tela.height = 256;
    const ctx = tela.getContext('2d')!;
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = cor;
    ctx.lineWidth = 16;
    ctx.strokeRect(12, 12, 1000, 232);
    let tamanho = 128;
    ctx.font = `bold ${tamanho}px Georgia, serif`;
    while (ctx.measureText(texto).width > 930 && tamanho > 36) {
      tamanho -= 6;
      ctx.font = `bold ${tamanho}px Georgia, serif`;
    }
    ctx.fillStyle = '#f8e7c4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, 512, 136);
    const nova = new THREE.CanvasTexture(tela);
    nova.colorSpace = THREE.SRGBColorSpace;
    nova.anisotropy = 4;
    return nova;
  }, [texto, cor]);
  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}
function Lanchonete({ cor, nome, novos }: { cor: string; nome: string; novos: number }) {
  const placa = useTexturaPlaca(nome.toUpperCase(), cor);
  const { x, z, largura, fundo } = LANCHONETE;
  const frente = z + fundo / 2;
  const sino = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (sino.current) sino.current.position.y = 10 + Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  return (
    <group>
      <Bloco p={[x, 2.3, z]} e={[largura, 4.6, fundo]} cor="#b8763e" />
      {[0.9, 1.8, 2.7, 3.6].map((y) => <Bloco key={`f${y}`} p={[x + largura / 2 + 0.03, y, z]} e={[0.06, 0.08, fundo]} cor="#9c6233" sombra={false} />)}
      <Bloco p={[x, 4.75, z]} e={[largura + 0.6, 0.35, fundo + 0.6]} cor="#6d4a33" />
      <Bloco p={[x, 3.7, frente + 0.25]} e={[largura + 1, 7.4, 0.5]} cor="#d49a5c" />
      <Bloco p={[x, 7.55, frente + 0.25]} e={[largura + 1.4, 0.45, 0.7]} cor={cor} />
      <Bloco p={[x, 5.85, frente + 0.56]} e={[8.2, 2, 0.12]} cor="#ffffff" mapa={placa} sombra={false} />
      {[1.1, 2.0, 2.9].map((y) => <Bloco key={`t${y}`} p={[x, y + 0.42, frente + 0.51]} e={[largura + 0.98, 0.06, 0.04]} cor="#b9824a" sombra={false} />)}
      <Bloco p={[x, 1.35, frente + 0.52]} e={[1.9, 2.7, 0.06]} cor="#2a1a10" sombra={false} />
      <Bloco p={[x - 0.48, 1.45, frente + 0.6]} e={[0.88, 1.4, 0.08]} cor="#8a5a36" sombra={false} />
      <Bloco p={[x + 0.48, 1.45, frente + 0.6]} e={[0.88, 1.4, 0.08]} cor="#8a5a36" sombra={false} />
      {[-3.2, 3.2].map((dx) => <Bloco key={`j${dx}`} p={[x + dx, 2.1, frente + 0.53]} e={[2.3, 1.6, 0.06]} cor="#33465a" emissiva="#ffcf8a" intensidade={0.35} sombra={false} />)}
      <mesh position={[x, 4.35, frente + 1.05]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[largura + 0.6, 0.12, 1.2]} />
        <meshStandardMaterial color={cor} roughness={0.7} />
      </mesh>
      <Bloco p={[x, 0.12, frente + 1.3]} e={[largura + 0.6, 0.24, 2.2]} cor="#8a5a36" sombra={false} />
      {[-4.6, -1.6, 1.6, 4.6].map((dx) => <Bloco key={`b${dx}`} p={[x + dx, 0.75, frente + 2.15]} e={[0.12, 1.1, 0.12]} cor="#6b4226" />)}
      {[-3.1, 3.1].map((dx) => <Bloco key={`c${dx}`} p={[x + dx, 1.3, frente + 2.15]} e={[3.2, 0.1, 0.12]} cor="#6b4226" />)}
      {novos > 0 && (
        <group ref={sino} position={[x, 10, frente]}>
          <Html center zIndexRange={[20, 0]} className="pointer-events-none select-none">
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg ring-4 ring-amber-300/50">
              <Bell className="h-3.5 w-3.5" />
              {novos === 1 ? '1 pedido novo' : `${novos} pedidos novos`}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
function Fumaca({ ativo, x, y, z }: { ativo: boolean; x: number; y: number; z: number }) {
  const bolhas = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bolhas.current.forEach((m, i) => {
      const f = (t * 0.45 + i / 10) % 1;
      m.visible = ativo;
      m.position.set(x + Math.sin(i * 7.3 + t) * 0.5 * f, y + f * 3.4, z + Math.cos(i * 3.1 + t) * 0.4 * f);
      m.scale.setScalar(0.22 + f * 0.6);
      (m.material as THREE.MeshStandardMaterial).opacity = (1 - f) * 0.55;
    });
  });
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} ref={(m) => { if (m) bolhas.current[i] = m; }}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#f5f5f5" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
function Pessoa({ camisa, chapeu, ativo, aceno }: { camisa: string; chapeu?: boolean; ativo: boolean; aceno?: boolean }) {
  const braco = useRef<THREE.Group>(null);
  const corpo = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (braco.current) braco.current.rotation.x = ativo ? (aceno ? -2.4 + Math.sin(t * 8) * 0.4 : -1.1 + Math.sin(t * 9) * 0.6) : -0.2;
    if (corpo.current) corpo.current.rotation.z = ativo ? Math.sin(t * 4.5) * 0.05 : 0;
  });
  return (
    <group ref={corpo}>
      <Bloco p={[0, 0.45, 0]} e={[0.5, 0.9, 0.34]} cor="#3f4652" />
      <Bloco p={[0, 1.3, 0]} e={[0.62, 0.85, 0.4]} cor={camisa} />
      <mesh position={[0, 1.98, 0]} castShadow>
        <sphereGeometry args={[0.27, 14, 12]} />
        <meshStandardMaterial color="#e8b98a" roughness={0.8} />
      </mesh>
      {chapeu && (
        <mesh position={[0, 2.33, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.2, 0.36, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
      )}
      <Bloco p={[-0.4, 1.3, 0]} e={[0.16, 0.7, 0.16]} cor={camisa} />
      <group ref={braco} position={[0.4, 1.65, 0]}>
        <Bloco p={[0, -0.32, 0]} e={[0.16, 0.7, 0.16]} cor={camisa} />
        {chapeu && <Bloco p={[0, -0.72, 0.12]} e={[0.08, 0.06, 0.5]} cor="#9aa3ad" sombra={false} />}
      </group>
    </group>
  );
}
function Sacola({ p, cor }: { p: Vetor; cor: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 6));
  });
  return (
    <group ref={ref} position={p} scale={0.01}>
      <Bloco p={[0, 0.36, 0]} e={[0.6, 0.72, 0.42]} cor="#d9b38c" />
      <Bloco p={[0, 0.42, 0]} e={[0.62, 0.16, 0.44]} cor={cor} sombra={false} />
    </group>
  );
}
function Cozinha({ cor, estado }: { cor: string; estado: EstadoCozinha }) {
  const { x, z } = COZINHA;
  const chapa = useRef<THREE.MeshStandardMaterial>(null);
  const carnes = useRef<THREE.Group>(null);
  const preparando = estado.preparando > 0;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (chapa.current) chapa.current.emissiveIntensity = preparando ? 0.45 + Math.sin(t * 6) * 0.15 : 0;
    carnes.current?.children.forEach((c, i) => { c.position.y = 1.2 + Math.abs(Math.sin(t * 7 + i)) * 0.04; });
  });
  const vigas = [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6];
  const totalCarnes = Math.min(estado.preparando * 2, 8);
  return (
    <group>
      <Bloco p={[x, 0.1, z]} e={[8, 0.2, 8]} cor="#ece7df" sombra={false} />
      {[[-3.85, -3.85], [3.85, -3.85], [-3.85, 3.85], [3.85, 3.85]].map(([dx, dz]) => <Bloco key={`${dx}${dz}`} p={[x + dx, 2.1, z + dz]} e={[0.24, 4, 0.24]} cor="#6b4226" />)}
      {vigas.map((dz) => <Bloco key={dz} p={[x, 4.15, z + dz]} e={[8.3, 0.18, 0.22]} cor="#7a4c2c" />)}
      {[-3.85, 3.85].map((dx) => <Bloco key={dx} p={[x + dx, 4.0, z]} e={[0.26, 0.26, 8.3]} cor="#6b4226" />)}
      <Bloco p={[x - 1.4, 0.6, z - 0.6]} e={[3.4, 1, 1.5]} cor="#5b6270" />
      <mesh position={[x - 1.4, 1.14, z - 0.6]} receiveShadow>
        <boxGeometry args={[3.2, 0.08, 1.3]} />
        <meshStandardMaterial ref={chapa} color="#2b2e33" emissive="#ff6a00" emissiveIntensity={0} roughness={0.5} />
      </mesh>
      <group ref={carnes}>
        {Array.from({ length: totalCarnes }, (_, i) => (
          <mesh key={i} position={[x - 2.6 + (i % 4) * 0.75, 1.2, z - 0.95 + Math.floor(i / 4) * 0.65]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.1, 14]} />
            <meshStandardMaterial color="#6b3b1f" roughness={0.9} />
          </mesh>
        ))}
      </group>
      <Fumaca ativo={preparando} x={x - 1.4} y={1.3} z={z - 0.6} />
      <Bloco p={[x + 1.9, 0.55, z - 0.7]} e={[1.5, 1.1, 1.3]} cor="#8d96a3" />
      <Bloco p={[x + 1.9, 1.11, z - 0.7]} e={[1.2, 0.04, 1]} cor="#f2c14e" emissiva="#f2a33a" intensidade={preparando ? 0.4 : 0.05} sombra={false} />
      <group position={[x - 1.4, 0.2, z - 2]}>
        <Pessoa camisa="#f4f4f4" chapeu ativo={preparando} />
      </group>
      <Bloco p={[x, 0.62, z + 3.3]} e={[6.6, 1.04, 0.85]} cor="#8a5a36" />
      <Bloco p={[x, 1.17, z + 3.3]} e={[6.8, 0.08, 1]} cor="#efe8dc" />
      <group position={[x + 2.2, 0.2, z + 2.1]}>
        <Pessoa camisa={cor} ativo={estado.prontos > 0} aceno />
      </group>
      {Array.from({ length: Math.min(estado.prontos, 6) }, (_, i) => <Sacola key={i} p={[x - 2.7 + i * 0.95, 1.21, z + 3.3]} cor={cor} />)}
      {preparando && (
        <group position={[x - 1.4, 6.2, z - 0.6]}>
          <Etiqueta y={0}><span className="flex items-center gap-1 text-orange-600"><Flame className="h-3.5 w-3.5" />{estado.preparando} na chapa</span></Etiqueta>
        </group>
      )}
      {estado.prontos > 0 && (
        <group position={[x - 1.2, 2.4, z + 4.6]}>
          <Etiqueta y={0}><span className="flex items-center gap-1 text-blue-600"><ShoppingBag className="h-3.5 w-3.5" />{estado.prontos} pronto{estado.prontos > 1 ? 's' : ''}</span></Etiqueta>
        </group>
      )}
    </group>
  );
}
function Estacionamento() {
  const meio = (VAGAS[0][0] + VAGAS[VAGAS.length - 1][0]) / 2;
  const largura = VAGAS[VAGAS.length - 1][0] - VAGAS[0][0] + 2.6;
  return (
    <group>
      <Bloco p={[meio, 0.04, VAGAS[0][1]]} e={[largura, 0.08, 4.4]} cor="#d5d9e0" sombra={false} />
      {VAGAS.map(([vx], i) => i > 0 && <Bloco key={vx} p={[vx - 1.2, 0.09, VAGAS[0][1]]} e={[0.08, 0.02, 3]} cor="#ffffff" sombra={false} />)}
    </group>
  );
}
function Moto({ moto, cor, selecionada, aoClicar, posicoes }: { moto: MotoCena; cor: string; selecionada: boolean; aoClicar: () => void; posicoes: Map<string, THREE.Vector3> }) {
  const grupo = useRef<THREE.Group>(null);
  const rodas = useRef<THREE.Mesh[]>([]);
  const piloto = useRef<THREE.Group>(null);
  const anel = useRef<THREE.Mesh>(null);
  const alvo = useMemo(() => new THREE.Vector3(), []);
  const iniciou = useRef(false);
  useFrame(({ clock }, dt) => {
    const g = grupo.current;
    if (!g) return;
    const agora = Date.now();
    const [vx, vz] = VAGAS[moto.vaga % VAGAS.length];
    let ponto = { x: vx, z: vz, giro: 0 };
    let andando = false;
    const plano = moto.plano;
    if (plano.modo === 'ida') {
      const progresso = (agora - plano.inicio) / plano.duracao;
      ponto = amostrar(plano.rota, progresso);
      andando = progresso < 1;
    } else if (plano.modo === 'volta') {
      const t = agora - plano.inicio;
      const restante = 2500 * (1 - plano.progressoIda);
      if (t < restante) {
        ponto = amostrar(plano.ida, plano.progressoIda + (1 - plano.progressoIda) * (t / restante));
        andando = true;
      } else if (t < restante + 1800) {
        ponto = amostrar(plano.ida, 1);
      } else if (t < restante + 10800) {
        ponto = amostrar(plano.volta, (t - restante - 1800) / 9000);
        andando = true;
      }
    }
    alvo.set(ponto.x, 0, ponto.z);
    if (!iniciou.current) {
      g.position.copy(alvo);
      g.rotation.y = ponto.giro;
      iniciou.current = true;
    }
    const passo = Math.min(1, dt * 8);
    g.position.lerp(alvo, passo);
    let diferenca = ponto.giro - g.rotation.y;
    diferenca = Math.atan2(Math.sin(diferenca), Math.cos(diferenca));
    g.rotation.y += diferenca * passo;
    if (andando) rodas.current.forEach((r) => { r.rotation.x += dt * 14; });
    if (piloto.current) piloto.current.position.y = andando ? Math.sin(clock.elapsedTime * 22) * 0.02 : 0;
    if (anel.current) {
      anel.current.visible = selecionada;
      anel.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.08);
    }
    posicoes.set(`moto:${moto.chave}`, g.position);
  });
  useEffect(() => () => { posicoes.delete(`moto:${moto.chave}`); }, [moto.chave, posicoes]);
  const emMovimento = moto.plano.modo !== 'vaga';
  return (
    <group ref={grupo} onClick={(e) => cliqueValido(e) && aoClicar()} {...apontar}>
      <mesh ref={anel} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[1.5, 1.85, 40]} />
        <meshBasicMaterial color={cor} transparent opacity={0.85} />
      </mesh>
      <group scale={1.5}>
        {[0.55, -0.55].map((rz, i) => (
          <mesh key={rz} ref={(m) => { if (m) rodas.current[i] = m; }} position={[0, 0.3, rz]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.16, 14]} />
            <meshStandardMaterial color="#1f2328" roughness={0.9} />
          </mesh>
        ))}
        <Bloco p={[0, 0.62, 0]} e={[0.34, 0.32, 1]} cor={moto.cor} />
        <Bloco p={[0, 0.85, 0.48]} e={[0.42, 0.5, 0.3]} cor={moto.cor} />
        <Bloco p={[0, 1.12, 0.45]} e={[0.75, 0.06, 0.06]} cor="#333333" sombra={false} />
        <mesh position={[0, 0.95, 0.65]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial color="#fff6d5" emissive="#fff3c4" emissiveIntensity={0.9} />
        </mesh>
        <Bloco p={[0, 0.83, -0.12]} e={[0.36, 0.1, 0.5]} cor="#222222" />
        <Bloco p={[0, 1.18, -0.52]} e={[0.62, 0.58, 0.58]} cor={cor} />
        <Bloco p={[0, 1.2, -0.21]} e={[0.5, 0.12, 0.02]} cor="#ffffff" sombra={false} />
        <group ref={piloto}>
          <Bloco p={[0, 0.92, 0.1]} e={[0.42, 0.2, 0.45]} cor="#2f3640" />
          <Bloco p={[0, 1.3, 0]} e={[0.44, 0.6, 0.3]} cor={moto.cor} />
          {[-0.25, 0.25].map((bx) => <Bloco key={bx} p={[bx, 1.3, 0.24]} e={[0.1, 0.1, 0.46]} cor={moto.cor} sombra={false} />)}
          <mesh position={[0, 1.78, 0.03]} castShadow>
            <sphereGeometry args={[0.25, 14, 12]} />
            <meshStandardMaterial color="#f4f4f4" roughness={0.4} />
          </mesh>
          <Bloco p={[0, 1.8, 0.24]} e={[0.32, 0.13, 0.06]} cor="#1c2430" sombra={false} />
        </group>
      </group>
      {(selecionada || emMovimento) && (
        <Etiqueta y={4}>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: moto.cor }} />
            {moto.nome}{moto.rotulo ? <span className="font-normal text-gray-500">· {moto.rotulo}</span> : null}
          </span>
        </Etiqueta>
      )}
    </group>
  );
}
function Carro({ rota, fase, cor }: { rota: Rota; fase: number; cor: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const progresso = ((clock.elapsedTime * 4.2 + fase * rota.total) % rota.total) / rota.total;
    const p = amostrar(rota, progresso);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.giro;
    g.scale.setScalar(Math.min(1, progresso / 0.03, (1 - progresso) / 0.03));
  });
  return (
    <group ref={ref}>
      <Bloco p={[0, 0.6, 0]} e={[1.7, 0.7, 3.4]} cor={cor} />
      <Bloco p={[0, 1.2, -0.2]} e={[1.45, 0.55, 1.7]} cor="#dfe7f1" emissiva="#cfe0f5" intensidade={0.1} />
      {[[-0.85, 1.1], [0.85, 1.1], [-0.85, -1.1], [0.85, -1.1]].map(([rx, rz]) => (
        <mesh key={`${rx}${rz}`} position={[rx, 0.32, rz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 12]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
      ))}
    </group>
  );
}
function Transito() {
  const cores = ['#3b82f6', '#f8fafc', '#ef4444', '#10b981', '#64748b', '#f59e0b', '#f8fafc', '#a855f7'];
  return (
    <>
      {TRAJETOS_CARROS.flatMap((rota, i) => [0, 0.5].map((fase, j) => <Carro key={`${i}-${j}`} rota={rota} fase={fase + i * 0.17} cor={cores[(i * 2 + j) % cores.length]} />))}
    </>
  );
}
function Pino({ marca, cor, selecionado, compacto, aoClicar }: { marca: MarcaCasa; cor: string; selecionado: boolean; compacto: boolean; aoClicar: () => void }) {
  const casa = CASAS[marca.casa];
  const pino = useRef<THREE.Group>(null);
  const onda = useRef<THREE.Mesh>(null);
  const corEtapa = corDaEtapa(marca.etapa, cor);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pino.current) {
      pino.current.position.y = 5 + Math.sin(t * 2.4 + marca.casa) * 0.25;
      pino.current.rotation.y = t * 0.8;
    }
    if (onda.current) {
      const f = (t * 0.8) % 1;
      onda.current.scale.setScalar(1 + f * 2.2);
      (onda.current.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.6;
    }
  });
  return (
    <group position={[casa.x, 0, casa.z]} onClick={(e) => cliqueValido(e) && aoClicar()} {...apontar}>
      <mesh ref={onda} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[2.1, 2.4, 48]} />
        <meshBasicMaterial color={corEtapa} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <group ref={pino} scale={selecionado ? 1.3 : 1}>
        <mesh castShadow>
          <sphereGeometry args={[0.6, 20, 16]} />
          <meshStandardMaterial color={corEtapa} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.75, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.46, 1.1, 20]} />
          <meshStandardMaterial color={corEtapa} roughness={0.4} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.28, 14, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0]} scale={[1.05, 1.05, 1.05]}>
          <sphereGeometry args={[0.6, 20, 16]} />
          <meshBasicMaterial color={corEtapa} transparent opacity={0.15} />
        </mesh>
      </group>
      {(!compacto || selecionado) && <Etiqueta y={7.2}>
        <span className="flex items-center gap-1.5">
          {marca.etapa === 'entregue' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <span className="h-2 w-2 rounded-full" style={{ background: corEtapa }} />}
          {marca.titulo}<span className="font-normal text-gray-500">· {marca.legenda}</span>
        </span>
      </Etiqueta>}
    </group>
  );
}
const pontosDasRotas = new WeakMap<Rota, Vetor[]>();
function pontosDaRota(rota: Rota) {
  let pontos = pontosDasRotas.get(rota);
  if (!pontos) {
    pontos = rota.pontos.map(([x, z]) => [x, 0.22, z] as Vetor);
    pontosDasRotas.set(rota, pontos);
  }
  return pontos;
}
function Rotas({ motos }: { motos: MotoCena[] }) {
  return (
    <>
      {motos.filter((m) => m.plano.modo === 'ida').map((m) => {
        const plano = m.plano as Extract<PlanoMoto, { modo: 'ida' }>;
        return <Line key={m.chave} points={pontosDaRota(plano.rota)} color={m.cor} lineWidth={3} dashed dashSize={0.7} gapSize={0.45} transparent opacity={0.75} />;
      })}
    </>
  );
}
function Camera({ foco, posicoes, comando }: { foco: Foco; posicoes: Map<string, THREE.Vector3>; comando: Comando }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const controles = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const largura = useThree((s) => s.size.width);
  const zoomInicial = Math.min(14, Math.max(6.5, largura / 100));
  const passo = useMemo(() => new THREE.Vector3(), []);
  const destino = useMemo(() => new THREE.Vector3(), []);
  const ajustou = useRef(false);
  useEffect(() => {
    if (ajustou.current) return;
    ajustou.current = true;
    camera.zoom = zoomInicial;
    camera.updateProjectionMatrix();
  }, [camera, zoomInicial]);
  useEffect(() => {
    if (!comando || !controles) return;
    if (comando.tipo === 'inicio') {
      controles.target.copy(CENTRO_INICIAL);
      camera.position.copy(CENTRO_INICIAL).add(AFASTAMENTO);
      camera.zoom = zoomInicial;
    } else {
      camera.zoom = Math.min(60, Math.max(4, camera.zoom * (comando.tipo === 'mais' ? 1.3 : 1 / 1.3)));
    }
    camera.updateProjectionMatrix();
    controles.update();
  }, [comando]);
  const chegada = useRef({ chave: '', feita: false });
  useFrame((_, dt) => {
    if (!foco || !controles) return;
    const chave = foco.tipo === 'moto' ? `m${foco.chave}` : `p${foco.x},${foco.z}`;
    if (chegada.current.chave !== chave) chegada.current = { chave, feita: false };
    if (chegada.current.feita) return;
    if (foco.tipo === 'moto') {
      const p = posicoes.get(`moto:${foco.chave}`);
      if (!p) return;
      destino.copy(p);
    } else destino.set(foco.x, 0, foco.z);
    passo.copy(destino).sub(controles.target);
    if (foco.tipo === 'ponto' && passo.lengthSq() < 0.01) chegada.current.feita = true;
    passo.multiplyScalar(Math.min(1, dt * 3.5));
    controles.target.add(passo);
    camera.position.add(passo);
    controles.update();
  });
  return null;
}
export function Cena({ cor, nome, motos, marcas, cozinha, selecionado, foco, comando, compacto, aoSelecionar }: { cor: string; nome: string; motos: MotoCena[]; marcas: MarcaCasa[]; cozinha: EstadoCozinha; selecionado: string | null; foco: Foco; comando: Comando; compacto: boolean; aoSelecionar: (id: string | null) => void }) {
  const posicoes = useMemo(() => new Map<string, THREE.Vector3>(), []);
  return (
    <>
      <color attach="background" args={['#efeae1']} />
      <hemisphereLight args={['#ffffff', '#d9d2c6', 1.1]} />
      <directionalLight position={[28, 46, 18]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} shadow-camera-far={160} shadow-bias={-0.0004} />
      <MapControls makeDefault target={CENTRO_INICIAL} enableDamping dampingFactor={0.12} minZoom={4} maxZoom={60} minPolarAngle={0.45} maxPolarAngle={1.15} />
      <Camera foco={foco} posicoes={posicoes} comando={comando} />
      <Cidade aoClicarChao={() => aoSelecionar(null)} />
      <Estacionamento />
      <Lanchonete cor={cor} nome={nome} novos={cozinha.novos} />
      <Cozinha cor={cor} estado={cozinha} />
      <Transito />
      <Rotas motos={motos} />
      {motos.map((m) => (
        <Moto key={m.chave} moto={m} cor={cor} posicoes={posicoes} selecionada={!!selecionado && (selecionado === m.pedidoId || selecionado === `moto:${m.chave}`)} aoClicar={() => aoSelecionar(m.pedidoId ?? `moto:${m.chave}`)} />
      ))}
      {marcas.map((m) => <Pino key={m.pedidoId} marca={m} cor={cor} selecionado={selecionado === m.pedidoId} compacto={compacto} aoClicar={() => aoSelecionar(m.pedidoId)} />)}
    </>
  );
}
