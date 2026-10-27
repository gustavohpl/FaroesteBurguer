export type Ponto = [number, number];
export type Rota = { pontos: Ponto[]; acumulado: number[]; total: number };
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
function semRepetidos(pontos: Ponto[]) {
  return pontos.filter((p, i) => i === 0 || Math.hypot(p[0] - pontos[i - 1][0], p[1] - pontos[i - 1][1]) > 0.05);
}
function deslocar(pontos: Ponto[], faixa: number): Ponto[] {
  if (pontos.length < 2) return pontos;
  const normais = pontos.slice(1).map((p, i) => {
    const dx = p[0] - pontos[i][0];
    const dz = p[1] - pontos[i][1];
    const tamanho = Math.hypot(dx, dz) || 1;
    return [-dz / tamanho, dx / tamanho] as Ponto;
  });
  return pontos.map((p, i) => {
    const a = normais[Math.max(0, i - 1)];
    const b = normais[Math.min(normais.length - 1, i)];
    const fator = faixa / Math.max(0.25, 1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * fator, p[1] + (a[1] + b[1]) * fator];
  });
}
export function medir(pontos: Ponto[]): Rota {
  const acumulado = [0];
  for (let i = 1; i < pontos.length; i++) acumulado.push(acumulado[i - 1] + Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]));
  return { pontos, acumulado, total: acumulado[acumulado.length - 1] };
}
export function rotaDoCaminho(caminho: Ponto[], faixa = 0.9): Rota {
  const limpo = semRepetidos(caminho);
  return medir(limpo.length > 1 ? deslocar(limpo, faixa) : [limpo[0], limpo[0]]);
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
export function duracaoViagem(rota: Rota) {
  return Math.min(25 * 60000, Math.max(90000, (rota.total / 2.8) * 1000));
}
