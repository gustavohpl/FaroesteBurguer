export type Ponto = [number, number];
export type Casa = { indice: number; x: number; z: number; giro: number; parede: string; telhado: string; meioFio: Ponto };
export type Rota = { pontos: Ponto[]; acumulado: number[]; total: number };
export const RUAS_X = [-4, 12, 28];
export const LIMITE = { x0: -46, x1: 40, z0: -36, z1: 36 };
export const VAGAS: Ponto[] = [-21, -18.6, -16.2, -13.8, -11.4, -9].map((x) => [x, -6.2]);
export const LANCHONETE = { x: -27, z: -16, largura: 10, fundo: 10 };
export const COZINHA = { x: -17, z: -15 };
const PAREDES = ['#fde3c8', '#e2ecf7', '#f6d9d6', '#e1efe2', '#f3ead0', '#ece2f4'];
const TELHADOS = ['#c2693e', '#8a5a44', '#6b7f99', '#a04a3a', '#7a8b5b'];
export function sorteio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function hashTexto(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}
function montarCasas(): Casa[] {
  const lista: Omit<Casa, 'indice'>[] = [];
  const aleatorio = sorteio(7);
  const cor = (tons: string[]) => tons[Math.floor(aleatorio() * tons.length)];
  for (const rx of RUAS_X) {
    for (const lado of [-1, 1]) {
      for (const z of [-30, -22, -14, 10, 18, 26]) {
        const x = rx + lado * 5.4;
        if (x < -8 && z < 0) continue;
        lista.push({ x, z, giro: lado < 0 ? Math.PI / 2 : -Math.PI / 2, parede: cor(PAREDES), telhado: cor(TELHADOS), meioFio: [rx + lado * 1.4, z] });
      }
    }
  }
  for (const x of [-38, -30, -22, -14]) lista.push({ x, z: 10, giro: Math.PI, parede: cor(PAREDES), telhado: cor(TELHADOS), meioFio: [x, 1.6] });
  return lista.map((c, indice) => ({ ...c, indice }));
}
export const CASAS = montarCasas();
function dentroDeRua(x: number, z: number, folga: number) {
  if (Math.abs(z) < 3.6 + folga) return true;
  return RUAS_X.some((rx) => Math.abs(x - rx) < 3.2 + folga);
}
function montarArvores(): Ponto[] {
  const aleatorio = sorteio(21);
  const lista: Ponto[] = [];
  let tentativas = 0;
  while (lista.length < 46 && tentativas < 4000) {
    tentativas++;
    const x = LIMITE.x0 + 2 + aleatorio() * (LIMITE.x1 - LIMITE.x0 - 4);
    const z = LIMITE.z0 + 2 + aleatorio() * (LIMITE.z1 - LIMITE.z0 - 4);
    if (dentroDeRua(x, z, 0.6)) continue;
    if (x > -34 && x < -7 && z > -22 && z < -3) continue;
    if (CASAS.some((c) => Math.abs(c.x - x) < 3.4 && Math.abs(c.z - z) < 3.4)) continue;
    if (lista.some(([ax, az]) => Math.hypot(ax - x, az - z) < 3.2)) continue;
    lista.push([x, z]);
  }
  return lista;
}
export const ARVORES = montarArvores();
function semRepetidos(pontos: Ponto[]) {
  return pontos.filter((p, i) => i === 0 || Math.hypot(p[0] - pontos[i - 1][0], p[1] - pontos[i - 1][1]) > 0.01);
}
function deslocar(pontos: Ponto[], faixa: number): Ponto[] {
  const normais = pontos.slice(1).map((p, i) => {
    const dx = p[0] - pontos[i][0];
    const dz = p[1] - pontos[i][1];
    const tamanho = Math.hypot(dx, dz);
    return [-dz / tamanho, dx / tamanho] as Ponto;
  });
  return pontos.map((p, i) => {
    const a = normais[Math.max(0, i - 1)];
    const b = normais[Math.min(normais.length - 1, i)];
    const fator = faixa / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * fator, p[1] + (a[1] + b[1]) * fator];
  });
}
function medir(pontos: Ponto[]): Rota {
  const acumulado = [0];
  for (let i = 1; i < pontos.length; i++) acumulado.push(acumulado[i - 1] + Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]));
  return { pontos, acumulado, total: acumulado[acumulado.length - 1] };
}
const cacheRotas = new Map<string, { ida: Rota; volta: Rota }>();
export function rotaEntrega(vaga: number, casa: number) {
  const chave = `${vaga}:${casa}`;
  const pronta = cacheRotas.get(chave);
  if (pronta) return pronta;
  const [vx, vz] = VAGAS[vaga % VAGAS.length];
  const destino = CASAS[casa];
  const ruaX = RUAS_X.find((rx) => Math.abs(destino.meioFio[0] - rx) < 2);
  const centro: Ponto[] = ruaX === undefined
    ? [[vx, vz], [vx, 0], [destino.x, 0], destino.meioFio]
    : [[vx, vz], [vx, 0], [ruaX, 0], [ruaX, destino.z], destino.meioFio];
  const limpo = semRepetidos(centro);
  const rotas = { ida: medir(deslocar(limpo, 0.9)), volta: medir(deslocar([...limpo].reverse(), 0.9)) };
  cacheRotas.set(chave, rotas);
  return rotas;
}
export function amostrar(rota: Rota, progresso: number): { x: number; z: number; giro: number } {
  const alvo = Math.min(Math.max(progresso, 0), 1) * rota.total;
  let i = 1;
  while (i < rota.pontos.length - 1 && rota.acumulado[i] < alvo) i++;
  const a = rota.pontos[i - 1];
  const b = rota.pontos[i];
  const trecho = rota.acumulado[i] - rota.acumulado[i - 1] || 1;
  const t = (alvo - rota.acumulado[i - 1]) / trecho;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, giro: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
export const TRAJETOS_CARROS: Rota[] = [
  [[LIMITE.x0 - 2, 0], [LIMITE.x1 + 2, 0]],
  [[LIMITE.x1 + 2, 0], [LIMITE.x0 - 2, 0]],
  [[12, LIMITE.z1 + 2], [12, LIMITE.z0 - 2]],
  [[28, LIMITE.z0 - 2], [28, LIMITE.z1 + 2]],
].map((p) => medir(deslocar(p as Ponto[], 0.9)));
export function duracaoViagem(rota: Rota) {
  return Math.min(12, Math.max(4, rota.total * 0.12)) * 60000;
}
