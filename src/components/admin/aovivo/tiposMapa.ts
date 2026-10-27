export type MapaCidade = {
  origem: [number, number];
  escala: number;
  nomes: string[];
  tipos: string[];
  ruas: Array<[tipo: number, nome: number, rotatoria: 0 | 1, pontos: number[]]>;
  verdes: Array<[tipo: 'praca' | 'mata' | 'cemiterio', nome: number, anel: number[]]>;
  quadras: number[][];
  aguas: number[][];
  rios: number[][];
  rotatorias: Array<[x: number, z: number, raio: number]>;
  predios: Array<[altura: number, anel: number[]]>;
  casas: number[];
  arvores: number[];
  rotulos: Array<[tipo: string, x: number, z: number, nome: number]>;
};
export const URL_MAPA = '/mapa/goiatuba.json';
export const RUAS_DE_CARRO = ['trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'track'];
export function geoParaCena(mapa: MapaCidade, lat: number, lng: number): [number, number] {
  const [lat0, lng0] = mapa.origem;
  return [(lng - lng0) * Math.cos((lat0 * Math.PI) / 180) * 111320 * mapa.escala, -(lat - lat0) * 110540 * mapa.escala];
}
export function cenaParaGeo(mapa: MapaCidade, x: number, z: number): [number, number] {
  const [lat0, lng0] = mapa.origem;
  return [lat0 - z / (110540 * mapa.escala), lng0 + x / (Math.cos((lat0 * Math.PI) / 180) * 111320 * mapa.escala)];
}
