import { LARGURAS, type MapaCidade } from './tiposMapa';
import type { Ponto } from './trajetos';
export type Lote = { x: number; z: number; giro: number };
export const CENTRO_LOTE: Ponto = [-20, -12.65];
export const VAGAS_LOCAIS: Ponto[] = [-21, -18.6, -16.2, -13.8, -11.4, -9].map((x) => [x, -6.2]);
const MEIA_LARGURA = 12.5;
const MEIA_FUNDO = 8.85;
const TIPOS_DE_FRENTE = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
export function paraMundo(lote: Lote, [lx, lz]: Ponto): Ponto {
  const dx = lx - CENTRO_LOTE[0];
  const dz = lz - CENTRO_LOTE[1];
  const c = Math.cos(lote.giro);
  const s = Math.sin(lote.giro);
  return [lote.x + dx * c + dz * s, lote.z - dx * s + dz * c];
}
export function dentroDoLote(lote: Lote, px: number, pz: number, folga: number) {
  const dx = px - lote.x;
  const dz = pz - lote.z;
  const c = Math.cos(lote.giro);
  const s = Math.sin(lote.giro);
  return Math.abs(dx * c - dz * s) < MEIA_LARGURA + folga && Math.abs(dx * s + dz * c) < MEIA_FUNDO + folga;
}
export function vagasDoLote(lote: Lote) {
  return VAGAS_LOCAIS.map((v) => paraMundo(lote, v));
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
  const recuo = melhor.meia + 1.2 + MEIA_FUNDO;
  return { x: melhor.qx + nx * recuo, z: melhor.qz + nz * recuo, giro: Math.atan2(-nx, -nz) };
}
