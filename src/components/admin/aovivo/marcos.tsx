type V = [number, number, number];
const PAREDE = '#f3ead0';
const BRANCO = '#f6f6f4';
const TELHA = '#a0502f';
const MADEIRA = '#6b4a2f';
const VIDRO = '#3a5566';
const PORTA = '#4a3524';
function Caixa({ p, t, c, r = 0.85, giro = 0 }: { p: V; t: V; c: string; r?: number; giro?: number }) {
  return (
    <mesh position={p} rotation={[0, giro, 0]} castShadow receiveShadow>
      <boxGeometry args={t} />
      <meshStandardMaterial color={c} roughness={r} />
    </mesh>
  );
}
function Cil({ p, raioT, raioB, alt, c, r = 0.85, seg = 16, giro = 0 }: { p: V; raioT: number; raioB: number; alt: number; c: string; r?: number; seg?: number; giro?: number }) {
  return (
    <mesh position={p} rotation={[0, giro, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[raioT, raioB, alt, seg]} />
      <meshStandardMaterial color={c} roughness={r} />
    </mesh>
  );
}
function Telhado({ p, raio, alt, c = TELHA }: { p: V; raio: number; alt: number; c?: string }) {
  return (
    <mesh position={p} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[raio, alt, 4]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
function Cruz({ p, h = 1, c = '#efe9d8' }: { p: V; h?: number; c?: string }) {
  const b = h * 0.16;
  return (
    <group position={p}>
      <Caixa p={[0, 0, 0]} t={[b, h, b]} c={c} r={0.5} />
      <Caixa p={[0, h * 0.2, 0]} t={[h * 0.55, b, b]} c={c} r={0.5} />
    </group>
  );
}
function CruzParede({ p, tam, c, giro = 0 }: { p: V; tam: number; c: string; giro?: number }) {
  const e = tam * 0.3;
  return (
    <group position={p} rotation={[0, giro, 0]}>
      <mesh castShadow>
        <boxGeometry args={[e, tam, 0.12]} />
        <meshStandardMaterial color={c} roughness={0.5} emissive={c} emissiveIntensity={0.15} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[tam, e, 0.12]} />
        <meshStandardMaterial color={c} roughness={0.5} emissive={c} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}
function Janela({ p, l = 0.7, a = 0.8, giro = 0 }: { p: V; l?: number; a?: number; giro?: number }) {
  return (
    <mesh position={p} rotation={[0, giro, 0]} castShadow>
      <boxGeometry args={[l, a, 0.1]} />
      <meshStandardMaterial color={VIDRO} roughness={0.25} />
    </mesh>
  );
}
function Faixa({ p, l, c, a = 0.55, giro = 0 }: { p: V; l: number; c: string; a?: number; giro?: number }) {
  return (
    <mesh position={p} rotation={[0, giro, 0]} castShadow>
      <boxGeometry args={[l, a, 0.12]} />
      <meshStandardMaterial color={c} roughness={0.6} emissive={c} emissiveIntensity={0.1} />
    </mesh>
  );
}
function Poste({ p, alt, raio = 0.16, c = BRANCO }: { p: V; alt: number; raio?: number; c?: string }) {
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[raio, raio, alt, 12]} />
      <meshStandardMaterial color={c} roughness={0.7} />
    </mesh>
  );
}
function Igreja() {
  return (
    <>
      <Caixa p={[0, 1.3, 0]} t={[3.2, 2.6, 4.6]} c={PAREDE} />
      <Telhado p={[0, 3.35, 0]} raio={3.4} alt={1.5} />
      <Caixa p={[1, 2.5, 2.1]} t={[1.1, 5, 1.1]} c={PAREDE} />
      <Telhado p={[1, 5.6, 2.1]} raio={0.95} alt={1.2} />
      <Cruz p={[1, 6.6, 2.1]} h={1.1} />
      <Caixa p={[0, 0.9, 2.32]} t={[1, 1.8, 0.2]} c={PORTA} r={0.6} />
      <Janela p={[-1, 1.6, 2.32]} l={0.5} a={1} />
      <Janela p={[-1.3, 1.6, -2.32]} l={0.5} a={1} />
      <Janela p={[1.3, 1.6, -2.32]} l={0.5} a={1} />
    </>
  );
}
function Escola() {
  return (
    <>
      <Caixa p={[1, 1.5, 0]} t={[6, 3, 3]} c={PAREDE} />
      <Caixa p={[1, 3.08, 0]} t={[6.2, 0.16, 3.2]} c={TELHA} r={0.7} />
      <Faixa p={[1, 1.5, 1.52]} l={6} c={'#c0392b'} a={0.18} />
      <Janela p={[-1.2, 1.1, 1.52]} />
      <Janela p={[0, 1.1, 1.52]} />
      <Janela p={[1.2, 1.1, 1.52]} />
      <Janela p={[2.6, 1.1, 1.52]} />
      <Janela p={[-1.2, 2.1, 1.52]} />
      <Janela p={[0, 2.1, 1.52]} />
      <Janela p={[1.2, 2.1, 1.52]} />
      <Janela p={[2.6, 2.1, 1.52]} />
      <Caixa p={[1, 0.8, 1.55]} t={[1, 1.6, 0.2]} c={PORTA} r={0.6} />
      <mesh position={[-3.4, 0.05, 0]} receiveShadow>
        <boxGeometry args={[3, 0.1, 3]} />
        <meshStandardMaterial color={'#6f9a57'} roughness={0.95} />
      </mesh>
      <Caixa p={[-3.4, 0.12, 0]} t={[2.6, 0.04, 0.08]} c={'#eef3ec'} r={0.9} />
      <Caixa p={[-3.4, 0.12, 0]} t={[0.08, 0.04, 2.6]} c={'#eef3ec'} r={0.9} />
      <Poste p={[-4.6, 0.6, -0.9]} alt={1.2} raio={0.06} c={'#dddddd'} />
      <Poste p={[-4.6, 0.6, 0.9]} alt={1.2} raio={0.06} c={'#dddddd'} />
    </>
  );
}
function Prefeitura() {
  return (
    <>
      <Caixa p={[0, 0.2, 1.4]} t={[4.8, 0.4, 1.2]} c={'#cfc9ba'} r={0.9} />
      <Caixa p={[0, 1.7, -0.2]} t={[4.2, 3, 3]} c={PAREDE} />
      <Caixa p={[0, 3.35, -0.2]} t={[4.5, 0.3, 3.3]} c={TELHA} r={0.7} />
      <Poste p={[-1.5, 1.7, 1.5]} alt={2.6} raio={0.18} c={BRANCO} />
      <Poste p={[-0.5, 1.7, 1.5]} alt={2.6} raio={0.18} c={BRANCO} />
      <Poste p={[0.5, 1.7, 1.5]} alt={2.6} raio={0.18} c={BRANCO} />
      <Poste p={[1.5, 1.7, 1.5]} alt={2.6} raio={0.18} c={BRANCO} />
      <Caixa p={[0, 3.15, 1.5]} t={[4, 0.5, 0.6]} c={'#e9e2d2'} r={0.7} />
      <Caixa p={[0, 1.2, 1.3]} t={[1.1, 2, 0.2]} c={PORTA} r={0.6} />
      <Poste p={[1.9, 2.8, -1.4]} alt={3} raio={0.05} c={'#cccccc'} />
      <Caixa p={[2.25, 4, -1.4]} t={[0.7, 0.45, 0.04]} c={'#2e7d32'} r={0.6} />
    </>
  );
}
function Hospital() {
  return (
    <>
      <Caixa p={[0, 1.6, 0]} t={[4.4, 3.2, 3.4]} c={BRANCO} />
      <Caixa p={[0, 3.33, 0]} t={[4.5, 0.16, 3.5]} c={'#dfe3e6'} r={0.6} />
      <CruzParede p={[0, 2.3, 1.73]} tam={1.2} c={'#e23b3b'} />
      <Faixa p={[0, 0.9, 1.72]} l={4.4} c={'#c92a2a'} a={0.12} />
      <Caixa p={[0, 1.4, 1.95]} t={[2, 0.2, 0.9]} c={'#e9edf0'} r={0.6} />
      <Poste p={[-0.9, 0.7, 2]} alt={1.4} raio={0.08} c={'#bbbbbb'} />
      <Poste p={[0.9, 0.7, 2]} alt={1.4} raio={0.08} c={'#bbbbbb'} />
      <Caixa p={[0, 0.9, 1.78]} t={[1.1, 1.8, 0.14]} c={VIDRO} r={0.25} />
      <Janela p={[-1.4, 2.2, 1.72]} />
      <Janela p={[1.4, 2.2, 1.72]} />
    </>
  );
}
function Saude() {
  return (
    <>
      <Caixa p={[0, 1.1, 0]} t={[3.6, 2.2, 3]} c={BRANCO} />
      <Caixa p={[0, 2.28, 0]} t={[3.7, 0.16, 3.1]} c={'#dfe3e6'} r={0.6} />
      <CruzParede p={[0, 1.5, 1.53]} tam={0.9} c={'#16a34a'} />
      <Faixa p={[0, 0.55, 1.52]} l={3.6} c={'#15803d'} a={0.1} />
      <Caixa p={[0, 0.8, 1.55]} t={[1, 1.6, 0.16]} c={VIDRO} r={0.25} />
    </>
  );
}
function Posto() {
  return (
    <>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.06, 3.4]} />
        <meshStandardMaterial color={'#3a3f45'} roughness={0.95} />
      </mesh>
      <Poste p={[-1.8, 1.5, -1.3]} alt={3} />
      <Poste p={[1.8, 1.5, -1.3]} alt={3} />
      <Poste p={[-1.8, 1.5, 1.3]} alt={3} />
      <Poste p={[1.8, 1.5, 1.3]} alt={3} />
      <Caixa p={[0, 3.15, 0]} t={[4.6, 0.4, 3.4]} c={BRANCO} r={0.6} />
      <Faixa p={[0, 3.15, 1.72]} l={4.6} c={'#e11d48'} a={0.3} />
      <Faixa p={[0, 3.15, -1.72]} l={4.6} c={'#e11d48'} a={0.3} />
      <Caixa p={[-0.7, 0.75, 0]} t={[0.6, 1.5, 0.8]} c={'#d64550'} r={0.7} />
      <Caixa p={[0.7, 0.75, 0]} t={[0.6, 1.5, 0.8]} c={'#d64550'} r={0.7} />
      <Caixa p={[0, 1.2, -2.6]} t={[3, 2.4, 1.2]} c={PAREDE} />
      <Caixa p={[0, 2.5, -2.6]} t={[3.1, 0.14, 1.3]} c={TELHA} r={0.7} />
      <Caixa p={[0, 0.9, -1.98]} t={[1, 1.8, 0.14]} c={VIDRO} r={0.25} />
    </>
  );
}
function Banco() {
  return (
    <>
      <Caixa p={[0, 1.4, 0]} t={[4, 2.8, 3]} c={'#d7dbe0'} />
      <Caixa p={[0, 2.93, 0]} t={[4.1, 0.16, 3.1]} c={'#b9c0c8'} r={0.6} />
      <Caixa p={[0, 1.3, 1.52]} t={[3, 2, 0.1]} c={VIDRO} r={0.2} />
      <Faixa p={[0, 2.5, 1.55]} l={4} c={'#1d4ed8'} a={0.45} />
      <Poste p={[-1.7, 1.25, 1.55]} alt={2.5} raio={0.14} c={BRANCO} />
      <Poste p={[1.7, 1.25, 1.55]} alt={2.5} raio={0.14} c={BRANCO} />
      <Caixa p={[1.6, 0.7, 1.8]} t={[0.5, 1.4, 0.4]} c={'#33373c'} r={0.5} />
    </>
  );
}
function Mercado() {
  return (
    <>
      <mesh position={[0, 0.03, 3.6]} receiveShadow>
        <boxGeometry args={[6, 0.06, 2.4]} />
        <meshStandardMaterial color={'#44484d'} roughness={0.95} />
      </mesh>
      <Caixa p={[0, 1.2, 0]} t={[6, 2.4, 4]} c={'#ece0c0'} />
      <Caixa p={[0, 2.45, 0]} t={[6.1, 0.16, 4.1]} c={'#c9a24a'} r={0.6} />
      <Faixa p={[0, 2.1, 2.02]} l={6} c={'#f59e0b'} a={0.7} />
      <Caixa p={[0, 1, 2.02]} t={[3.2, 2, 0.1]} c={VIDRO} r={0.2} />
      <Caixa p={[-2.2, 0.9, 2.05]} t={[1.1, 1.8, 0.14]} c={PORTA} r={0.6} />
      <Caixa p={[2.2, 0.9, 2.05]} t={[1.1, 1.8, 0.14]} c={PORTA} r={0.6} />
    </>
  );
}
function Farmacia() {
  return (
    <>
      <Caixa p={[0, 1.2, 0]} t={[3.4, 2.4, 3]} c={BRANCO} />
      <Caixa p={[0, 2.45, 0]} t={[3.5, 0.16, 3.1]} c={'#dfe3e6'} r={0.6} />
      <Faixa p={[0, 2.05, 1.52]} l={3.4} c={'#16a34a'} a={0.5} />
      <CruzParede p={[1.1, 2.05, 1.56]} tam={0.6} c={'#ffffff'} />
      <Caixa p={[-0.5, 1, 1.52]} t={[1.6, 1.6, 0.1]} c={VIDRO} r={0.2} />
      <Caixa p={[0.9, 0.85, 1.55]} t={[0.9, 1.7, 0.14]} c={PORTA} r={0.6} />
    </>
  );
}
function Policia() {
  return (
    <>
      <Caixa p={[0, 1.4, 0]} t={[4, 2.8, 3]} c={'#59616e'} />
      <Caixa p={[0, 2.93, 0]} t={[4.1, 0.16, 3.1]} c={'#3f4651'} r={0.6} />
      <Faixa p={[0, 2.5, 1.52]} l={4} c={'#1e40af'} a={0.5} />
      <Caixa p={[0, 0.95, 1.52]} t={[1.1, 1.9, 0.14]} c={VIDRO} r={0.25} />
      <Janela p={[-1.3, 1.8, 1.52]} />
      <Janela p={[1.3, 1.8, 1.52]} />
      <Poste p={[1.8, 3.4, -1.3]} alt={1.2} raio={0.04} c={'#dddddd'} />
      <Caixa p={[1.95, 2.6, -1.3]} t={[0.04, 0.5, 0.7]} c={'#1e40af'} r={0.6} />
    </>
  );
}
export function Marco({ tipo, x, z, giro = 0 }: { tipo: 'igreja' | 'escola' | 'prefeitura' | 'hospital' | 'saude' | 'posto' | 'banco' | 'mercado' | 'farmacia' | 'policia'; x: number; z: number; giro?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, giro, 0]}>
      {tipo === 'igreja' ? <Igreja /> : tipo === 'escola' ? <Escola /> : tipo === 'prefeitura' ? <Prefeitura /> : tipo === 'hospital' ? <Hospital /> : tipo === 'saude' ? <Saude /> : tipo === 'posto' ? <Posto /> : tipo === 'banco' ? <Banco /> : tipo === 'mercado' ? <Mercado /> : tipo === 'farmacia' ? <Farmacia /> : <Policia />}
    </group>
  );
}
export function EnfeitePraca({ x, z, raio }: { x: number; z: number; raio: number }) {
  const r = Math.max(2, raio);
  const plat = Math.min(1.6, r * 0.4);
  const bancoR = r * 0.68;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[r, 40]} />
        <meshStandardMaterial color={'#6f9a57'} roughness={0.95} />
      </mesh>
      <Caixa p={[0, 0.06, 0]} t={[r * 1.7, 0.06, r * 0.45]} c={'#e2d2a8'} r={0.95} />
      <Caixa p={[0, 0.06, 0]} t={[r * 0.45, 0.06, r * 1.7]} c={'#e2d2a8'} r={0.95} />
      <Cil p={[0, 0.2, 0]} raioT={plat} raioB={plat} alt={0.4} c={'#cdbb95'} seg={6} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Poste key={i} p={[Math.cos(a) * (plat - 0.2), 1.2, Math.sin(a) * (plat - 0.2)]} alt={1.6} raio={0.08} c={'#efe4c8'} />;
      })}
      <mesh position={[0, 2.25, 0]} rotation={[0, Math.PI / 6, 0]} castShadow>
        <coneGeometry args={[plat + 0.35, 0.8, 6]} />
        <meshStandardMaterial color={TELHA} roughness={0.85} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return <Caixa key={i} p={[Math.cos(a) * bancoR, 0.28, Math.sin(a) * bancoR]} t={[1.1, 0.16, 0.35]} c={MADEIRA} r={0.8} giro={-a} />;
      })}
    </group>
  );
}
export function MonumentoRotatoria({ x, z, raio }: { x: number; z: number; raio: number }) {
  const r = Math.max(1.2, raio);
  const copa = Math.min(r * 0.7, 1.3);
  return (
    <group position={[x, 0, z]}>
      <Cil p={[0, 0.15, 0]} raioT={r} raioB={r} alt={0.3} c={'#b7a179'} seg={28} />
      <Cil p={[0, 0.22, 0]} raioT={r - 0.25} raioB={r - 0.25} alt={0.34} c={'#5f8a4f'} seg={28} />
      <Cil p={[0, 1, 0]} raioT={0.18} raioB={0.26} alt={1.4} c={MADEIRA} seg={8} />
      <mesh position={[0, 2, 0]} castShadow>
        <coneGeometry args={[copa, 1.6, 8]} />
        <meshStandardMaterial color={'#3f7d3a'} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <coneGeometry args={[copa * 0.75, 1.2, 8]} />
        <meshStandardMaterial color={'#4c9444'} roughness={0.9} />
      </mesh>
    </group>
  );
}
