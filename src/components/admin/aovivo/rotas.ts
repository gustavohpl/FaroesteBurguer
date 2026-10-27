import { RUAS_DE_CARRO, type MapaCidade } from './tiposMapa';
type Ponto = [number, number];
type Segmento = { a: number; b: number; rua: number };
type Encaixe = { segmento: Segmento; ponto: Ponto; distancia: number };
const CELULA = 25;
const CUSTO_POR_TIPO: Record<string, number> = { trunk: 0.8, primary: 0.85, secondary: 0.9, tertiary: 0.95, residential: 1, unclassified: 1, living_street: 1.2, service: 1.4, track: 1.8 };
const TIPOS_DE_VIA: Array<[RegExp, string]> = [[/^(r|rua)$/, 'rua'], [/^(av|ave|avenida)$/, 'avenida'], [/^(al|alameda)$/, 'alameda'], [/^(trav|tv|travessa)$/, 'travessa'], [/^(pca|pc|praca)$/, 'praca'], [/^(rod|rodovia)$/, 'rodovia'], [/^(estr|estrada)$/, 'estrada']];
const PALAVRAS_DE_TIPO = new Set(['rua', 'avenida', 'alameda', 'travessa', 'praca', 'rodovia', 'estrada', 'via']);
const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function palavras(texto: string) {
  return normalizar(texto).split(' ').filter(Boolean).map((p) => TIPOS_DE_VIA.find(([re]) => re.test(p))?.[1] ?? p);
}
function nucleo(lista: string[]) {
  return lista.filter((p) => !PALAVRAS_DE_TIPO.has(p) && !PALAVRAS_VAZIAS.has(p));
}
function edicao(a: string, b: string) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}
function parecidas(a: string, b: string) {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) <= 2) return b.startsWith(a) || a.startsWith(b) ? 0.8 : 0;
  return Math.max(0, 1 - edicao(a, b) / Math.max(a.length, b.length));
}
function semelhanca(procurado: string[], candidato: string[]) {
  if (!procurado.length || !candidato.length) return 0;
  let soma = 0;
  for (const p of procurado) soma += Math.max(...candidato.map((c) => parecidas(p, c)));
  const tamanho = Math.min(procurado.length, candidato.length) / Math.max(procurado.length, candidato.length);
  return (soma / procurado.length) * (0.75 + 0.25 * tamanho);
}
function hash(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}
class Fila {
  private nos: number[] = [];
  private prioridades: number[] = [];
  get tamanho() {
    return this.nos.length;
  }
  colocar(no: number, prioridade: number) {
    let i = this.nos.length;
    this.nos.push(no);
    this.prioridades.push(prioridade);
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (this.prioridades[pai] <= prioridade) break;
      this.nos[i] = this.nos[pai];
      this.prioridades[i] = this.prioridades[pai];
      i = pai;
    }
    this.nos[i] = no;
    this.prioridades[i] = prioridade;
  }
  tirar() {
    const topo = this.nos[0];
    const ultimoNo = this.nos.pop()!;
    const ultimaPrioridade = this.prioridades.pop()!;
    const n = this.nos.length;
    if (!n) return topo;
    let i = 0;
    while (true) {
      const esquerda = 2 * i + 1;
      const direita = esquerda + 1;
      let menor = i;
      let prioridadeMenor = ultimaPrioridade;
      if (esquerda < n && this.prioridades[esquerda] < prioridadeMenor) {
        menor = esquerda;
        prioridadeMenor = this.prioridades[esquerda];
      }
      if (direita < n && this.prioridades[direita] < prioridadeMenor) menor = direita;
      if (menor === i) break;
      this.nos[i] = this.nos[menor];
      this.prioridades[i] = this.prioridades[menor];
      i = menor;
    }
    this.nos[i] = ultimoNo;
    this.prioridades[i] = ultimaPrioridade;
    return topo;
  }
}
export function criarRoteador(mapa: MapaCidade) {
  const indice = new Map<string, number>();
  const xs: number[] = [];
  const zs: number[] = [];
  const ligacoes: Array<Array<[number, number]>> = [];
  const segmentos: Segmento[] = [];
  const grade = new Map<string, Segmento[]>();
  const ruasPorNome = new Map<number, number[]>();
  const no = (x: number, z: number) => {
    const chave = `${x},${z}`;
    let i = indice.get(chave);
    if (i === undefined) {
      i = xs.length;
      indice.set(chave, i);
      xs.push(x);
      zs.push(z);
      ligacoes.push([]);
    }
    return i;
  };
  mapa.ruas.forEach(([tipo, nome, , pontos], rua) => {
    const tipoNome = mapa.tipos[tipo];
    if (!RUAS_DE_CARRO.includes(tipoNome)) return;
    if (nome >= 0) {
      const lista = ruasPorNome.get(nome);
      if (lista) lista.push(rua);
      else ruasPorNome.set(nome, [rua]);
    }
    const fator = CUSTO_POR_TIPO[tipoNome] ?? 1;
    let anterior = no(pontos[0], pontos[1]);
    for (let i = 2; i + 1 < pontos.length; i += 2) {
      const atual = no(pontos[i], pontos[i + 1]);
      if (atual === anterior) continue;
      const peso = Math.hypot(xs[atual] - xs[anterior], zs[atual] - zs[anterior]) * fator;
      ligacoes[anterior].push([atual, peso]);
      ligacoes[atual].push([anterior, peso]);
      const segmento = { a: anterior, b: atual, rua };
      segmentos.push(segmento);
      const x0 = Math.floor(Math.min(xs[anterior], xs[atual]) / CELULA);
      const x1 = Math.floor(Math.max(xs[anterior], xs[atual]) / CELULA);
      const z0 = Math.floor(Math.min(zs[anterior], zs[atual]) / CELULA);
      const z1 = Math.floor(Math.max(zs[anterior], zs[atual]) / CELULA);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const chave = `${gx},${gz}`;
          const lista = grade.get(chave);
          if (lista) lista.push(segmento);
          else grade.set(chave, [segmento]);
        }
      }
      anterior = atual;
    }
  });
  const projetar = (segmento: Segmento, x: number, z: number): Encaixe => {
    const ax = xs[segmento.a];
    const az = zs[segmento.a];
    const dx = xs[segmento.b] - ax;
    const dz = zs[segmento.b] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const ponto: Ponto = [ax + dx * t, az + dz * t];
    return { segmento, ponto, distancia: Math.hypot(ponto[0] - x, ponto[1] - z) };
  };
  const encaixar = (x: number, z: number): Encaixe | null => {
    const gx = Math.floor(x / CELULA);
    const gz = Math.floor(z / CELULA);
    let melhor: Encaixe | null = null;
    for (let raio = 0; raio <= 40; raio++) {
      for (let dx = -raio; dx <= raio; dx++) {
        for (let dz = -raio; dz <= raio; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== raio) continue;
          for (const segmento of grade.get(`${gx + dx},${gz + dz}`) ?? []) {
            const encaixe = projetar(segmento, x, z);
            if (!melhor || encaixe.distancia < melhor.distancia) melhor = encaixe;
          }
        }
      }
      if (melhor && melhor.distancia < raio * CELULA) return melhor;
    }
    for (const segmento of segmentos) {
      const encaixe = projetar(segmento, x, z);
      if (!melhor || encaixe.distancia < melhor.distancia) melhor = encaixe;
    }
    return melhor;
  };
  const distanciaAteNo = (ponto: Ponto, n: number) => Math.hypot(xs[n] - ponto[0], zs[n] - ponto[1]);
  function rota(de: Ponto, para: Ponto): Ponto[] | null {
    const inicio = encaixar(de[0], de[1]);
    const fim = encaixar(para[0], para[1]);
    if (!inicio || !fim) return null;
    if (inicio.segmento === fim.segmento) return [de, inicio.ponto, fim.ponto, para];
    const custo = new Map<number, number>();
    const veio = new Map<number, number>();
    const fechados = new Set<number>();
    const fila = new Fila();
    const heuristica = (n: number) => Math.hypot(xs[n] - fim.ponto[0], zs[n] - fim.ponto[1]) * 0.8;
    for (const n of [inicio.segmento.a, inicio.segmento.b]) {
      const c = distanciaAteNo(inicio.ponto, n);
      if (c < (custo.get(n) ?? Infinity)) {
        custo.set(n, c);
        veio.set(n, -1);
        fila.colocar(n, c + heuristica(n));
      }
    }
    const saidas = new Map<number, number>([[fim.segmento.a, distanciaAteNo(fim.ponto, fim.segmento.a)], [fim.segmento.b, distanciaAteNo(fim.ponto, fim.segmento.b)]]);
    let melhorFinal = -1;
    let melhorCusto = Infinity;
    while (fila.tamanho) {
      const atual = fila.tirar();
      if (fechados.has(atual)) continue;
      fechados.add(atual);
      const custoAtual = custo.get(atual)!;
      if (custoAtual + heuristica(atual) >= melhorCusto) break;
      const saida = saidas.get(atual);
      if (saida !== undefined && custoAtual + saida < melhorCusto) {
        melhorCusto = custoAtual + saida;
        melhorFinal = atual;
      }
      for (const [vizinho, peso] of ligacoes[atual]) {
        const novo = custoAtual + peso;
        if (novo < (custo.get(vizinho) ?? Infinity)) {
          custo.set(vizinho, novo);
          veio.set(vizinho, atual);
          fila.colocar(vizinho, novo + heuristica(vizinho));
        }
      }
    }
    if (melhorFinal < 0) return null;
    const nos: number[] = [];
    for (let n = melhorFinal; n >= 0; n = veio.get(n) ?? -1) nos.push(n);
    nos.reverse();
    return [de, inicio.ponto, ...nos.map((n): Ponto => [xs[n], zs[n]]), fim.ponto, para];
  }
  function pontoNaRua(x: number, z: number): Ponto {
    return encaixar(x, z)?.ponto ?? [x, z];
  }
  function comprimento(caminho: Ponto[]) {
    let total = 0;
    for (let i = 1; i < caminho.length; i++) total += Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]);
    return total;
  }
  const nomesDeRua = [...ruasPorNome.keys()].map((nome) => {
    const todas = palavras(mapa.nomes[nome]);
    return { nome, tipo: todas.find((p) => PALAVRAS_DE_TIPO.has(p)) ?? '', nucleo: nucleo(todas) };
  });
  const bairros = mapa.rotulos.filter(([tipo]) => tipo === 'bairro').map(([, x, z, nome]) => ({ x, z, nucleo: nucleo(palavras(mapa.nomes[nome])) }));
  const chavesEndereco = mapa.enderecos ? Object.keys(mapa.enderecos).map((chave) => { const todas = palavras(chave); return { chave, tipo: todas.find((p) => PALAVRAS_DE_TIPO.has(p)) ?? '', nucleo: nucleo(todas) }; }) : [];
  const bairrosReais = (mapa.bairros ?? []).map(([nome, x, z]) => ({ x, z, nucleo: nucleo(palavras(nome)) }));
  function pontoPorNumero(lista: number[], numero: number | null): Ponto {
    const total = lista.length;
    const meio = () => { const m = Math.floor(total / 3 / 2) * 3; return [lista[m + 1], lista[m + 2]] as Ponto; };
    if (numero === null || numero <= 0) return meio();
    let lo = -1, hi = -1, loNum = 0, hiNum = 0;
    for (let i = 0; i < total; i += 3) {
      const num = lista[i];
      if (num <= 0) continue;
      if (num <= numero) { lo = i; loNum = num; }
      if (num >= numero) { hi = i; hiNum = num; break; }
    }
    if (lo >= 0 && hi >= 0) {
      if (lo === hi || hiNum === loNum) return [lista[lo + 1], lista[lo + 2]];
      const t = (numero - loNum) / (hiNum - loNum);
      return [lista[lo + 1] + (lista[hi + 1] - lista[lo + 1]) * t, lista[lo + 2] + (lista[hi + 2] - lista[lo + 2]) * t];
    }
    if (lo >= 0) return [lista[lo + 1], lista[lo + 2]];
    if (hi >= 0) return [lista[hi + 1], lista[hi + 2]];
    return meio();
  }
  function pontoDaRuaComNome(nome: number, metros: number | null): Ponto {
    const pedacos: Array<[Ponto, Ponto, number]> = [];
    for (const rua of ruasPorNome.get(nome) ?? []) {
      const pontos = mapa.ruas[rua][3];
      for (let i = 0; i + 3 < pontos.length; i += 2) {
        const a: Ponto = [pontos[i], pontos[i + 1]];
        const b: Ponto = [pontos[i + 2], pontos[i + 3]];
        pedacos.push([a, b, Math.hypot(b[0] - a[0], b[1] - a[1])]);
      }
    }
    const total = pedacos.reduce((soma, [, , d]) => soma + d, 0);
    if (!pedacos.length || total <= 0) return pedacos[0]?.[0] ?? [0, 0];
    let alvo = metros === null ? total / 2 : (metros * mapa.escala) % total;
    for (const [a, b, d] of pedacos) {
      if (alvo <= d) {
        const t = d ? alvo / d : 0;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      alvo -= d;
    }
    return pedacos[pedacos.length - 1][1];
  }
  function enderecoNaCena(endereco: string): { ponto: Ponto; achou: 'numero' | 'rua' | 'bairro' | 'nada' } {
    const partes = endereco.split(/[-,–]/).map((p) => p.trim()).filter(Boolean);
    const primeira = normalizar(partes[0] ?? endereco);
    const trechoRua = primeira.replace(/\b(qd|quadra|lt|lote|n|no|numero|casa)\b.*$/, '').replace(/\b\d.*$/, '').trim();
    const resto = normalizar(endereco).slice(normalizar(endereco).indexOf(trechoRua) + trechoRua.length);
    const achado = resto.match(/\b(\d{1,5})\b/);
    const numero = achado ? Number(achado[1]) : null;
    const procuradas = palavras(trechoRua);
    const tipoProcurado = procuradas.find((p) => PALAVRAS_DE_TIPO.has(p)) ?? '';
    const nucleoProcurado = nucleo(procuradas);
    if (mapa.enderecos && chavesEndereco.length) {
      const temQuadra = /\b(qd|quadra|lt|lote)\b/.test(normalizar(endereco));
      const numeroReal = temQuadra ? null : numero;
      const porPalavra = normalizar(endereco).match(/\b(setor|jardim|jd|vila|vl|bairro|conjunto|residencial|parque|pq|loteamento|distrito|chacara|cond|condominio)\b.*$/)?.[0] ?? '';
      const restoBairro = normalizar(partes.slice(1).join(' ')).replace(/\b(qd|quadra|lt|lote|n|no|numero|casa)\b/g, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
      const textoBairro = porPalavra || restoBairro;
      let melhorEnd: { lista: number[]; nota: number } | null = null;
      for (const c of chavesEndereco) {
        const nota = semelhanca(nucleoProcurado, c.nucleo) + (tipoProcurado && c.tipo === tipoProcurado ? 0.05 : 0);
        if (!melhorEnd || nota > melhorEnd.nota) melhorEnd = { lista: mapa.enderecos[c.chave], nota };
      }
      if (melhorEnd && melhorEnd.nota >= 0.72 && melhorEnd.lista.length >= 3) return { ponto: pontoPorNumero(melhorEnd.lista, numeroReal), achou: numeroReal != null && numeroReal > 0 ? 'numero' : 'rua' };
      const nucleoBairroReal = nucleo(palavras(textoBairro));
      let melhorBairroReal: { x: number; z: number; nota: number } | null = null;
      for (const b of bairrosReais) {
        const nota = semelhanca(nucleoBairroReal, b.nucleo);
        if (!melhorBairroReal || nota > melhorBairroReal.nota) melhorBairroReal = { x: b.x, z: b.z, nota };
      }
      if (melhorBairroReal && melhorBairroReal.nota >= 0.72) return { ponto: [melhorBairroReal.x, melhorBairroReal.z], achou: 'bairro' };
    }
    let melhor: { nome: number; nota: number } | null = null;
    for (const candidato of nomesDeRua) {
      const nota = semelhanca(nucleoProcurado, candidato.nucleo) + (tipoProcurado && candidato.tipo === tipoProcurado ? 0.05 : 0);
      if (!melhor || nota > melhor.nota) melhor = { nome: candidato.nome, nota };
    }
    if (melhor && melhor.nota >= 0.72) return { ponto: pontoNaRua(...pontoDaRuaComNome(melhor.nome, numero)), achou: 'rua' };
    const nucleoBairro = nucleo(palavras(partes.slice(1).join(' ')));
    let melhorBairro: { x: number; z: number; nota: number } | null = null;
    for (const bairro of bairros) {
      const nota = semelhanca(nucleoBairro, bairro.nucleo);
      if (!melhorBairro || nota > melhorBairro.nota) melhorBairro = { x: bairro.x, z: bairro.z, nota };
    }
    if (melhorBairro && melhorBairro.nota >= 0.75) return { ponto: pontoNaRua(melhorBairro.x, melhorBairro.z), achou: 'bairro' };
    const residenciais = segmentos.filter((s) => mapa.tipos[mapa.ruas[s.rua][0]] === 'residential');
    const sorteado = residenciais.length ? residenciais[hash(normalizar(endereco)) % residenciais.length] : segmentos[0];
    if (!sorteado) return { ponto: [0, 0], achou: 'nada' };
    return { ponto: [(xs[sorteado.a] + xs[sorteado.b]) / 2, (zs[sorteado.a] + zs[sorteado.b]) / 2], achou: 'nada' };
  }
  return { rota, pontoNaRua, enderecoNaCena, comprimento };
}
