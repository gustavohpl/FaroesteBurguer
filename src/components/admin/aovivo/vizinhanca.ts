import type { MapaCidade } from './tiposMapa';
import { dentroDoLote, type Lote } from './lote';
import type { Ponto } from './trajetos';
const CELULA = 20;
export function indiceDeCasas(mapa: MapaCidade, lote: Lote) {
  const grade = new Map<string, Ponto[]>();
  const todas: Ponto[] = [];
  const c = mapa.casas;
  for (let i = 0; i + 5 < c.length; i += 6) {
    if (dentroDoLote(lote, c[i], c[i + 1], 2.5)) continue;
    const ponto: Ponto = [c[i], c[i + 1]];
    todas.push(ponto);
    const chave = `${Math.floor(ponto[0] / CELULA)},${Math.floor(ponto[1] / CELULA)}`;
    const lista = grade.get(chave);
    if (lista) lista.push(ponto);
    else grade.set(chave, [ponto]);
  }
  const vizinhas = todas.filter(([x, z]) => {
    const d = Math.hypot(x - lote.x, z - lote.z);
    return d > 60 && d < 420;
  });
  return {
    perto(x: number, z: number): Ponto | null {
      const gx = Math.floor(x / CELULA);
      const gz = Math.floor(z / CELULA);
      let melhor: Ponto | null = null;
      let distancia = Infinity;
      for (let raio = 0; raio <= 4 && !melhor; raio++) {
        for (let dx = -raio; dx <= raio; dx++) {
          for (let dz = -raio; dz <= raio; dz++) {
            for (const p of grade.get(`${gx + dx},${gz + dz}`) ?? []) {
              const d = Math.hypot(p[0] - x, p[1] - z);
              if (d < distancia) {
                distancia = d;
                melhor = p;
              }
            }
          }
        }
      }
      return melhor;
    },
    sortear(semente: number, limite = 420): Ponto {
      const dentro = vizinhas.filter(([x, z]) => Math.hypot(x - lote.x, z - lote.z) < limite);
      const lista = dentro.length ? dentro : vizinhas.length ? vizinhas : todas;
      return lista[semente % lista.length] ?? [lote.x, lote.z];
    },
  };
}
