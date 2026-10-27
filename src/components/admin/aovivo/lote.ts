import { LARGURAS, type MapaCidade } from './tiposMapa';
import type { Ponto } from './trajetos';
export type Lote = { x: number; z: number; giro: number; escala: number };
export const ESCALA_LANCHONETE = 0.4;
export const FILA_DE_VAGAS = [-5, -3, -1, 1, 3, 5];
const MEIA_LARGURA = 12.5;
const MEIA_FUNDO = 8.85;
const FAIXA_DAS_VAGAS = 3.6;
const TIPOS_DE_FRENTE = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
function girar(lote: Lote, lx: number, lz: number): Ponto {
  const c = Math.cos(lote.giro);
  const s = Math.sin(lote.giro);
  return [lote.x + lx * c + lz * s, lote.z - lx * s + lz * c];
}
export function frenteDasVagas(lote: Lote) {
  return MEIA_FUNDO * lote.escala + FAIXA_DAS_VAGAS / 2;
}
export function dentroDoLote(lote: Lote, px: number, pz: number, folga: number) {
  const dx = px - lote.x;
  const dz = pz - lote.z;
  const c = Math.cos(lote.giro);
  const s = Math.sin(lote.giro);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) < Math.max(MEIA_LARGURA * lote.escala, 6.2) + folga && lz > -MEIA_FUNDO * lote.escala - folga && lz < MEIA_FUNDO * lote.escala + FAIXA_DAS_VAGAS + folga;
}
export function vagasDoLote(lote: Lote) {
  return FILA_DE_VAGAS.map((dx) => girar(lote, dx, frenteDasVagas(lote)));
}
export function encaixarLote(mapa: MapaCidade, px: number, pz: number): Lote {
  let melhor = { d: Infinity, qx: px, qz: pz, meia: 2, nx: 0, nz: 1 };
  for (const [tipo, , , pontos] of mapa.ruas) {
    const nomeTipo = mapa.tipos[tipo];
    if (!TIPOS_DE_FRENTE.has(nomeTipo)) continue;
    for (let i = 0; i + 3 < pontos.length; i += 2) {
      const ax = pontos[i];
      const az = pontos[i + 1];
      const dx = pontos[i + 2] - ax;
      const dz = pontos[i + 3] - az;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
      const qx = ax + dx * t;
      const qz = az + dz * t;
      const d = Math.hypot(px - qx, pz - qz);
      if (d < melhor.d) {
        const tamanho = Math.hypot(dx, dz) || 1;
        melhor = { d, qx, qz, meia: (LARGURAS[nomeTipo] ?? 4) / 2, nx: -dz / tamanho, nz: dx / tamanho };
      }
    }
  }
  let nx = px - melhor.qx;
  let nz = pz - melhor.qz;
  const tamanho = Math.hypot(nx, nz);
  if (tamanho > 0.01) {
    nx /= tamanho;
    nz /= tamanho;
  } else {
    nx = melhor.nx;
    nz = melhor.nz;
  }
  const recuo = melhor.meia + 1 + FAIXA_DAS_VAGAS + MEIA_FUNDO * ESCALA_LANCHONETE;
  return { x: melhor.qx + nx * recuo, z: melhor.qz + nz * recuo, giro: Math.atan2(-nx, -nz), escala: ESCALA_LANCHONETE };
}
