import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bell, Bike, Check, ChefHat, Clock, Crosshair, Home, Loader2, MapPin, Minus, Plus, ShoppingBag, Sparkles, Timer, X } from 'lucide-react';
import * as api from '../../utils/api';
import { useConfig } from '../../ConfigContext';
import { useDeliveryRealtime } from '../../hooks/useRealtime';
import { Cena, corDaEtapa, type Comando, type Etapa, type Foco, type MarcaCasa, type MotoCena, type PlanoMoto } from './aovivo/Cena';
import { duracaoViagem, hashTexto, rotaDoCaminho, type Ponto, type Rota } from './aovivo/trajetos';
import { encaixarLote, vagasDoLote, type Lote } from './aovivo/lote';
import { URL_MAPA, cenaParaGeo, geoParaCena, type MapaCidade } from './aovivo/tiposMapa';
import { indiceDeCasas } from './aovivo/vizinhanca';
type Roteador = { rota(de: Ponto, para: Ponto): Ponto[] | null; pontoNaRua(x: number, z: number): Ponto; enderecoNaCena(endereco: string): { ponto: Ponto; achou: 'rua' | 'bairro' | 'nada' } };
type Destino = { casa: Ponto; rua: Ponto };
type Gps = { de: Ponto; para: Ponto; inicio: number; duracao: number; em: number };
const modulosRoteador = import.meta.glob('./aovivo/rotas.ts');
type PedidoApi = { orderId: string; customerName?: string; items?: Array<{ name: string; quantity: number }>; total?: number; status: string; deliveryType?: string; address?: string; createdAt: string; updatedAt?: string; completedAt?: string; driver?: { name?: string; phone?: string; color?: string } };
type Motoboy = { name?: string; phone?: string; color?: string; status?: string };
type Entregador = { chave: string; nome: string; cor: string };
type Pedido = { id: string; nome: string; itens: Array<{ name: string; quantity: number }>; total: number; etapa: Etapa; entrega: boolean; criado: number; mudou: number; entregador?: Entregador; endereco?: string; viagem?: number; simulado?: boolean };
type Entrega = { pedido: Pedido; em: number };
type Simulacao = { id: string; inicio: number; nome: string; itens: Array<{ name: string; quantity: number }>; total: number; entregador: Entregador };
const ETAPA_DO_STATUS: Record<string, Etapa> = { pending_payment: 'novo', pending: 'novo', confirmed: 'novo', preparing: 'preparo', packing: 'preparo', ready_for_delivery: 'pronto', ready_for_pickup: 'pronto', out_for_delivery: 'rua', completed: 'entregue' };
const PASSOS: Array<[Etapa, string]> = [['novo', 'Recebido'], ['preparo', 'Preparando'], ['pronto', 'Pronto'], ['rua', 'Saiu p/ entrega'], ['entregue', 'Entregue']];
const ICONES: Record<Etapa, typeof Bell> = { novo: Bell, preparo: ChefHat, pronto: ShoppingBag, rua: Bike, entregue: Home };
const LEGENDAS: Record<Etapa, string> = { novo: 'Novo pedido', preparo: 'Na chapa', pronto: 'Pronto', rua: 'A caminho', entregue: 'Entregue' };
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João'];
const LANCHES: Array<[string, number]> = [['X-Bacon', 32], ['X-Salada', 26], ['X-Tudo', 38], ['Batata frita', 18], ['Refrigerante', 8], ['Milk-shake', 19], ['Onion rings', 22]];
const CORES_TESTE = ['#2563eb', '#16a34a', '#9333ea', '#db2777', '#0891b2'];
const COR_NEUTRA = '#64748b';
const SIMULACAO = { preparo: 4000, pronto: 13000, rua: 17000, viagem: 18000, fim: 37500 };
const VALIDADE_GPS = 120000;
const DURACAO_ENTREGUE = 16000;
function tempo(iso?: string) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : Date.now();
}
function soDigitos(texto?: string) {
  return String(texto || '').replace(/\D/g, '');
}
function primeiroNome(nome?: string, reserva = 'Cliente') {
  return (nome || '').trim().split(/\s+/)[0] || reserva;
}
function hora(ms: number) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function desde(ms: number, agora: number) {
  const minutos = Math.floor((agora - ms) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  return `há ${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}
function dinheiro(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function converter(o: PedidoApi): Pedido | null {
  const etapa = ETAPA_DO_STATUS[o.status];
  if (!etapa) return null;
  const telefone = soDigitos(o.driver?.phone);
  return {
    id: String(o.orderId),
    nome: primeiroNome(o.customerName),
    itens: o.items || [],
    total: Number(o.total) || 0,
    etapa,
    entrega: (o.deliveryType || 'delivery') === 'delivery',
    criado: tempo(o.createdAt),
    mudou: tempo(o.updatedAt || o.createdAt),
    endereco: o.address,
    entregador: o.driver && (o.driver.name || telefone) ? { chave: telefone || `pedido:${o.orderId}`, nome: primeiroNome(o.driver.name, 'Entregador'), cor: o.driver.color || COR_NEUTRA } : undefined,
  };
}
function simulado(s: Simulacao, agora: number): Pedido {
  const t = agora - s.inicio;
  const etapa: Etapa = t < SIMULACAO.preparo ? 'novo' : t < SIMULACAO.pronto ? 'preparo' : t < SIMULACAO.rua ? 'pronto' : 'rua';
  const mudou = s.inicio + (etapa === 'novo' ? 0 : SIMULACAO[etapa as 'preparo' | 'pronto' | 'rua']);
  return { id: s.id, nome: s.nome, itens: s.itens, total: s.total, etapa, entrega: true, criado: s.inicio, mudou, entregador: s.entregador, viagem: SIMULACAO.viagem, simulado: true };
}
function useTelaPequena() {
  const [pequena, setPequena] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 767px)');
    const mudar = () => setPequena(consulta.matches);
    consulta.addEventListener('change', mudar);
    return () => consulta.removeEventListener('change', mudar);
  }, []);
  return pequena;
}
function posicaoGps(g: Gps, agora: number): Ponto {
  const t = Math.min(1, (agora - g.inicio) / g.duracao);
  return [g.de[0] + (g.para[0] - g.de[0]) * t, g.de[1] + (g.para[1] - g.de[1]) * t];
}
function chaveDoEntregador(p: Pedido) {
  return p.entregador?.chave ?? `pedido:${p.id}`;
}
class Falha extends React.Component<{ children: React.ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (this.state.falhou) return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">Este aparelho não conseguiu abrir a cena 3D.</div>;
    return this.props.children;
  }
}
function Etapas({ pedido, cor, previsao }: { pedido: Pedido; cor: string; previsao: number | null }) {
  const passos = pedido.entrega ? PASSOS : PASSOS.filter(([e]) => e !== 'rua').map(([e, r]): [Etapa, string] => [e, e === 'entregue' ? 'Retirado' : r]);
  const indice = passos.findIndex(([e]) => e === pedido.etapa);
  return (
    <ol className="flex items-start">
      {passos.map(([etapa, rotulo], i) => {
        const feito = i < indice || pedido.etapa === 'entregue';
        const atual = i === indice && pedido.etapa !== 'entregue';
        const Icone = ICONES[etapa];
        const detalhe = i === 0 ? hora(pedido.criado) : atual ? (etapa === 'rua' && previsao ? `chega ~${hora(previsao)}` : `desde ${hora(pedido.mudou)}`) : feito ? 'ok' : '—';
        return (
          <li key={etapa} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {i > 0 && <span className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2" style={{ background: i <= indice || pedido.etapa === 'entregue' ? cor : '#e5e7eb' }} />}
            <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2" style={{ background: feito || atual ? cor : '#ffffff', borderColor: feito || atual ? cor : '#e5e7eb', color: feito || atual ? '#ffffff' : '#9ca3af', boxShadow: atual ? `0 0 0 4px ${cor}33` : undefined }}>
              {feito ? <Check className="h-4 w-4" /> : <Icone className={`h-4 w-4 ${atual ? 'animate-pulse' : ''}`} />}
            </span>
            <span className="mt-1.5 w-full truncate px-0.5 text-[11px] font-semibold text-gray-800">{rotulo}</span>
            <span className="w-full truncate px-0.5 text-[10px] text-gray-500">{detalhe}</span>
          </li>
        );
      })}
    </ol>
  );
}
export function AoVivo() {
  const { config } = useConfig();
  const cor = config.themeColor || '#d97706';
  const nomeLoja = config.siteName || 'Lanchonete';
  const [pedidosApi, setPedidosApi] = useState<PedidoApi[]>([]);
  const [historico, setHistorico] = useState<PedidoApi[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<'pedidos' | 'entregadores'>('pedidos');
  const [comando, setComando] = useState<Comando>(null);
  const telaPequena = useTelaPequena();
  const [mapa, setMapa] = useState<MapaCidade | null>(null);
  const [falhaMapa, setFalhaMapa] = useState(false);
  const [roteador, setRoteador] = useState<Roteador | null>(null);
  const [gps, setGps] = useState<Map<string, Gps>>(() => new Map());
  const [localSalvo, setLocalSalvo] = useState<{ lat: number; lng: number } | null>(null);
  const [posicionando, setPosicionando] = useState(false);
  const [provisorio, setProvisorio] = useState<{ lote: Lote; x: number; z: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const anteriores = useRef(new Map<string, Pedido>());
  const destinos = useRef(new Map<string, Destino>());
  const destinosBase = useRef<unknown>(null);
  const vagas = useRef(new Map<string, number>());
  const rotas = useRef(new Map<string, { ida: Rota; volta: Rota }>());
  const roteadorAtual = useRef<Roteador | null>(null);
  roteadorAtual.current = roteador;
  const localConfig: { lat: number; lng: number } | null = localSalvo ?? (config as { localLanchonete?: { lat: number; lng: number } }).localLanchonete ?? null;
  useEffect(() => {
    let vivo = true;
    fetch(URL_MAPA).then((r) => r.json()).then((dados: MapaCidade) => { if (vivo) setMapa(dados); }).catch(() => { if (vivo) setFalhaMapa(true); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    const carregarModulo = Object.values(modulosRoteador)[0];
    if (!mapa || !carregarModulo) return;
    carregarModulo().then((m) => {
      const modulo = m as { criarRoteador?: (mapa: MapaCidade) => Roteador };
      if (modulo.criarRoteador) setRoteador(modulo.criarRoteador(mapa));
    }).catch(() => {});
  }, [mapa]);
  const loteSalvo = useMemo(() => {
    if (!mapa) return null;
    if (!localConfig && mapa.loteLanchonete) {
      const [x, z, giro, escala] = mapa.loteLanchonete;
      return { x, z, giro, escala };
    }
    const [x, z] = localConfig ? geoParaCena(mapa, localConfig.lat, localConfig.lng) : mapa.lanchonete ?? [0, 0];
    return encaixarLote(mapa, x, z);
  }, [mapa, localConfig?.lat, localConfig?.lng]);
  const lote = posicionando && provisorio ? provisorio.lote : loteSalvo;
  const vizinhanca = useMemo(() => (mapa && lote ? indiceDeCasas(mapa, lote) : null), [mapa, lote]);
  const vagasMundo = useMemo(() => (lote ? vagasDoLote(lote) : []), [lote]);
  useEffect(() => {
    const buscar = (api as unknown as { getDriverLocations?: () => Promise<{ success?: boolean; locations?: Array<{ phone: string; lat: number; lng: number; at: string }> }> }).getDriverLocations;
    if (typeof buscar !== 'function' || !mapa) return;
    let vivo = true;
    const atualizar = async () => {
      try {
        const resposta = await buscar();
        if (!vivo || !resposta?.success) return;
        setGps((anterior) => {
          const novo = new Map(anterior);
          const instante = Date.now();
          for (const l of resposta.locations || []) {
            const chave = soDigitos(l.phone);
            const em = tempo(l.at);
            if (!chave || instante - em > VALIDADE_GPS || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
            const velho = anterior.get(chave);
            if (velho && velho.em === em) continue;
            let alvo = geoParaCena(mapa, l.lat, l.lng);
            if (roteadorAtual.current) alvo = roteadorAtual.current.pontoNaRua(alvo[0], alvo[1]);
            novo.set(chave, { de: velho ? posicaoGps(velho, instante) : alvo, para: alvo, inicio: instante, duracao: velho ? Math.min(12000, Math.max(2000, em - velho.em)) : 1, em });
          }
          for (const [chave, g] of novo) if (instante - g.em > VALIDADE_GPS) novo.delete(chave);
          return novo;
        });
      } catch {
        return;
      }
    };
    atualizar();
    const intervalo = setInterval(atualizar, 5000);
    return () => { vivo = false; clearInterval(intervalo); };
  }, [mapa]);
  const historicoBuscado = useRef(0);
  const contadorTeste = useRef(0);
  const buscarHistorico = useCallback(async () => {
    historicoBuscado.current = Date.now();
    try {
      const resposta = await api.adminFetch('/orders/history?limit=300', { method: 'GET' });
      const dados = await resposta.json();
      const lista: PedidoApi[] = dados.orders || [];
      setHistorico(lista);
      return lista;
    } catch {
      return null;
    }
  }, []);
  const carregar = useCallback(async () => {
    const [resposta, equipe] = await Promise.all([api.getAllOrders(), api.getDeliveryDrivers()]);
    if (equipe?.success) setMotoboys(equipe.drivers || []);
    if (!resposta?.success) return;
    const lista = Array.from(new Map<string, PedidoApi>((resposta.orders || []).map((o: PedidoApi) => [String(o.orderId), o])).values());
    const ids = new Set(lista.map((o) => String(o.orderId)));
    const sumiram = [...anteriores.current.values()].filter((p) => !ids.has(p.id) && p.entrega);
    anteriores.current = new Map(lista.map(converter).filter((p): p is Pedido => !!p).map((p) => [p.id, p]));
    setPedidosApi(lista);
    if (!sumiram.length && historicoBuscado.current) return;
    const arquivados = await buscarHistorico();
    if (!arquivados || !sumiram.length) return;
    const concluidos = sumiram.filter((p) => arquivados.some((o) => String(o.orderId) === p.id && o.status === 'completed'));
    if (concluidos.length) setEntregas((atual) => [...atual, ...concluidos.map((pedido) => ({ pedido, em: Date.now() }))]);
  }, [buscarHistorico]);
  useDeliveryRealtime(carregar, true);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, []);
  useEffect(() => {
    if (historicoBuscado.current && agora - historicoBuscado.current > 60000) buscarHistorico();
    const terminadas = simulacoes.filter((s) => agora - s.inicio >= SIMULACAO.fim);
    if (terminadas.length) {
      setSimulacoes((atual) => atual.filter((s) => !terminadas.includes(s)));
      setEntregas((atual) => [...atual, ...terminadas.map((s) => ({ pedido: simulado(s, s.inicio + SIMULACAO.fim - 1), em: Date.now() }))]);
    }
    if (entregas.some((e) => agora - e.em > DURACAO_ENTREGUE)) setEntregas((atual) => atual.filter((e) => agora - e.em <= DURACAO_ENTREGUE));
  }, [agora]);
  const relogioSimulacao = simulacoes.length ? agora : 0;
  const vivos = useMemo(() => {
    const reais = pedidosApi.map(converter).filter((p): p is Pedido => !!p);
    const testes = simulacoes.map((s) => simulado(s, relogioSimulacao || Date.now()));
    return [...testes, ...reais].sort((a, b) => b.criado - a.criado);
  }, [pedidosApi, simulacoes, relogioSimulacao]);
  const destinoDe = useMemo(() => {
    if (!vizinhanca) return new Map<string, Destino>();
    const base = destinosBase.current as { vizinhanca: unknown; roteador: unknown } | null;
    if (!base || base.vizinhanca !== vizinhanca || base.roteador !== roteador) destinos.current.clear();
    destinosBase.current = { vizinhanca, roteador };
    const ativos = new Set([...vivos.map((p) => p.id), ...entregas.map((e) => e.pedido.id)]);
    for (const id of [...destinos.current.keys()]) if (!ativos.has(id)) destinos.current.delete(id);
    for (const p of vivos) {
      if (!p.entrega || destinos.current.has(p.id)) continue;
      const ponto = roteador && p.endereco && !p.simulado ? roteador.enderecoNaCena(p.endereco).ponto : vizinhanca.sortear(hashTexto(p.endereco || p.id), p.simulado ? 260 : 420);
      const casa = vizinhanca.perto(ponto[0], ponto[1]) ?? ponto;
      destinos.current.set(p.id, { casa, rua: roteador ? roteador.pontoNaRua(casa[0], casa[1]) : casa });
    }
    return new Map(destinos.current);
  }, [vivos, entregas, vizinhanca, roteador]);
  const rotaPara = useCallback((vaga: Ponto, destino: Destino) => {
    const chave = `${vaga.join()}|${destino.rua.join()}|${roteador ? 1 : 0}`;
    const pronta = rotas.current.get(chave);
    if (pronta) return pronta;
    const caminho = roteador?.rota(vaga, destino.rua) ?? [vaga, destino.rua];
    const nova = { ida: rotaDoCaminho(caminho), volta: rotaDoCaminho([...caminho].reverse()) };
    if (rotas.current.size > 300) rotas.current.clear();
    rotas.current.set(chave, nova);
    return nova;
  }, [roteador]);
  const motos = useMemo<MotoCena[]>(() => {
    if (!lote) return [];
    const equipe = new Map<string, Entregador>();
    for (const d of motoboys) {
      const chave = soDigitos(d.phone);
      if (chave && (d.status === 'online' || gps.has(chave))) equipe.set(chave, { chave, nome: primeiroNome(d.name, 'Entregador'), cor: d.color || COR_NEUTRA });
    }
    for (const s of simulacoes) equipe.set(s.entregador.chave, s.entregador);
    const naRua = [...vivos.filter((p) => p.etapa === 'rua'), ...entregas.filter((e) => e.pedido.etapa === 'rua').map((e) => e.pedido)];
    for (const p of naRua) {
      const chave = chaveDoEntregador(p);
      if (!equipe.has(chave)) equipe.set(chave, p.entregador ?? { chave, nome: 'Entregador', cor: COR_NEUTRA });
    }
    for (const chave of [...vagas.current.keys()]) if (!equipe.has(chave)) vagas.current.delete(chave);
    const usadas = new Set(vagas.current.values());
    for (const chave of equipe.keys()) {
      if (vagas.current.has(chave)) continue;
      let vaga = 0;
      while (usadas.has(vaga) && vaga < vagasMundo.length) vaga++;
      if (vaga >= vagasMundo.length) vaga = hashTexto(chave) % vagasMundo.length;
      vagas.current.set(chave, vaga);
      usadas.add(vaga);
    }
    return [...equipe.values()].map((e): MotoCena => {
      const vaga = vagasMundo[vagas.current.get(e.chave) ?? 0];
      const base = { ...e, vaga, giroVaga: lote.giro };
      const sinal = gps.get(e.chave);
      const pedido = vivos.find((p) => p.etapa === 'rua' && chaveDoEntregador(p) === e.chave && destinoDe.has(p.id));
      const planoGps: PlanoMoto | null = sinal ? { modo: 'gps', de: sinal.de, para: sinal.para, inicio: sinal.inicio, duracao: sinal.duracao } : null;
      if (pedido) {
        const destino = destinoDe.get(pedido.id)!;
        const { ida } = rotaPara(vaga, destino);
        const trajeto = sinal ? rotaPara(sinal.para, destino).ida : undefined;
        return { ...base, pedidoId: pedido.id, rotulo: `#${pedido.id}`, trajeto, plano: planoGps ?? { modo: 'ida', rota: ida, inicio: pedido.mudou, duracao: pedido.viagem ?? duracaoViagem(ida) } };
      }
      const entrega = [...entregas].reverse().find((x) => x.pedido.etapa === 'rua' && chaveDoEntregador(x.pedido) === e.chave && destinoDe.has(x.pedido.id));
      if (entrega) {
        const { ida, volta } = rotaPara(vaga, destinoDe.get(entrega.pedido.id)!);
        const duracao = entrega.pedido.viagem ?? duracaoViagem(ida);
        return { ...base, pedidoId: entrega.pedido.id, rotulo: 'voltando', plano: planoGps ?? { modo: 'volta', ida, volta, inicio: entrega.em, progressoIda: Math.min(1, Math.max(0, (entrega.em - entrega.pedido.mudou) / duracao)) } };
      }
      return { ...base, plano: planoGps ?? { modo: 'vaga' } };
    });
  }, [lote, vagasMundo, motoboys, simulacoes, vivos, entregas, destinoDe, rotaPara, gps]);
  const previsaoDe = useCallback((id: string) => {
    const moto = motos.find((m) => m.pedidoId === id);
    if (!moto) return null;
    if (moto.plano.modo === 'ida') return moto.plano.inicio + moto.plano.duracao;
    const destino = destinoDe.get(id);
    if (moto.plano.modo !== 'gps' || !destino) return null;
    return Date.now() + (Math.hypot(destino.rua[0] - moto.plano.para[0], destino.rua[1] - moto.plano.para[1]) * 1.3 / 2.8) * 1000;
  }, [motos, destinoDe]);
  const naPorta = useCallback((id: string) => {
    const moto = motos.find((m) => m.pedidoId === id);
    const destino = destinoDe.get(id);
    if (!moto || !destino) return false;
    if (moto.plano.modo === 'ida') return Date.now() >= moto.plano.inicio + moto.plano.duracao;
    return moto.plano.modo === 'gps' && Math.hypot(destino.rua[0] - moto.plano.para[0], destino.rua[1] - moto.plano.para[1]) < 8;
  }, [motos, destinoDe]);
  const marcas = useMemo<MarcaCasa[]>(() => {
    const lista: MarcaCasa[] = [];
    for (const p of vivos) {
      const destino = destinoDe.get(p.id);
      if (!destino) continue;
      lista.push({ x: destino.casa[0], z: destino.casa[1], pedidoId: p.id, etapa: p.etapa, titulo: `#${p.id} ${p.nome}`, legenda: p.etapa === 'rua' && naPorta(p.id) ? 'Na porta' : LEGENDAS[p.etapa] });
    }
    for (const e of entregas) {
      const destino = destinoDe.get(e.pedido.id);
      if (destino) lista.push({ x: destino.casa[0], z: destino.casa[1], pedidoId: e.pedido.id, etapa: 'entregue', titulo: `#${e.pedido.id} ${e.pedido.nome}`, legenda: 'Entregue' });
    }
    return lista;
  }, [vivos, entregas, destinoDe, naPorta, agora]);
  const cozinha = useMemo(() => ({
    novos: vivos.filter((p) => p.etapa === 'novo').length,
    preparando: vivos.filter((p) => p.etapa === 'preparo').length,
    prontos: vivos.filter((p) => p.etapa === 'pronto').length,
  }), [vivos]);
  const atual = useMemo<Pedido | null>(() => {
    if (!selecionado) return null;
    const vivo = vivos.find((p) => p.id === selecionado);
    if (vivo) return vivo;
    const entrega = [...entregas].reverse().find((e) => e.pedido.id === selecionado);
    return entrega ? { ...entrega.pedido, etapa: 'entregue' } : null;
  }, [selecionado, vivos, entregas]);
  const motoSelecionada = useMemo(() => (selecionado ? motos.find((m) => `moto:${m.chave}` === selecionado) ?? null : null), [selecionado, motos]);
  const foco = useMemo<Foco>(() => {
    if (!selecionado) return null;
    const moto = motos.find((m) => m.pedidoId === selecionado || `moto:${m.chave}` === selecionado);
    if (moto && (moto.plano.modo !== 'vaga' || !atual)) return { tipo: 'moto', chave: moto.chave };
    if (lote && atual && (atual.etapa === 'preparo' || atual.etapa === 'pronto' || !atual.entrega)) {
      const { x, z } = lote;
      return { tipo: 'ponto', x, z };
    }
    const destino = destinoDe.get(selecionado);
    return destino ? { tipo: 'ponto', x: destino.casa[0], z: destino.casa[1] } : null;
  }, [selecionado, motos, atual, destinoDe, lote]);
  const aoClicarChao = useCallback((x: number, z: number) => {
    if (posicionando && mapa) {
      setProvisorio({ lote: encaixarLote(mapa, x, z), x, z });
      return;
    }
    setSelecionado(null);
  }, [posicionando, mapa]);
  const salvarLocal = async () => {
    if (!provisorio || !mapa) return;
    const [lat, lng] = cenaParaGeo(mapa, provisorio.x, provisorio.z);
    setSalvando(true);
    try {
      const resposta = await api.adminFetch('/admin/config', { method: 'POST', body: JSON.stringify({ localLanchonete: { lat, lng } }) });
      const dados = await resposta.json();
      if (!resposta.ok || dados?.success === false) throw new Error('falhou');
      setLocalSalvo({ lat, lng });
      setPosicionando(false);
      setProvisorio(null);
      setAviso('');
    } catch {
      setAviso('Não deu para salvar o local. Tente de novo.');
    }
    setSalvando(false);
  };
  useEffect(() => {
    if (!selecionado || atual || motoSelecionada) return;
    const espera = setTimeout(() => setSelecionado(null), 4000);
    return () => clearTimeout(espera);
  }, [selecionado, atual, motoSelecionada]);
  const numeros = useMemo(() => {
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    const hoje = inicioDoDia.getTime();
    const concluidos = historico.filter((o) => o.status === 'completed' && tempo(o.createdAt) >= hoje);
    const minutos = concluidos.filter((o) => o.completedAt).map((o) => (tempo(o.completedAt) - tempo(o.createdAt)) / 60000).filter((m) => m > 0 && m < 240);
    return [
      { rotulo: 'Pedidos hoje', curto: 'Hoje', valor: String(vivos.filter((p) => !p.simulado && p.criado >= hoje).length + concluidos.length), Icone: ShoppingBag },
      { rotulo: 'Na cozinha', curto: 'Cozinha', valor: String(cozinha.novos + cozinha.preparando + cozinha.prontos), Icone: ChefHat },
      { rotulo: 'Na rua', curto: 'Na rua', valor: String(vivos.filter((p) => p.etapa === 'rua').length), Icone: Bike },
      { rotulo: 'Tempo médio', curto: 'Média', valor: minutos.length ? `${Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length)} min` : '—', Icone: Timer },
    ];
  }, [historico, vivos, cozinha]);
  const simular = () => {
    const n = ++contadorTeste.current;
    const itens = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
      const [name] = LANCHES[Math.floor(Math.random() * LANCHES.length)];
      return { name, quantity: 1 + Math.floor(Math.random() * 2) };
    });
    const total = itens.reduce((soma, item) => soma + (LANCHES.find(([nome]) => nome === item.name)?.[1] ?? 20) * item.quantity, 0);
    const id = `TESTE-${n}`;
    setSimulacoes((lista) => [...lista, { id, inicio: Date.now(), nome: NOMES[Math.floor(Math.random() * NOMES.length)], itens, total, entregador: { chave: `teste:${id}`, nome: 'Entregador teste', cor: CORES_TESTE[n % CORES_TESTE.length] } }]);
    setSelecionado(id);
  };
  const enviar = (tipo: 'mais' | 'menos' | 'inicio') => setComando((c) => ({ tipo, n: (c?.n ?? 0) + 1 }));
  const acompanhado = atual ?? vivos[0] ?? null;
  const motoDoAtual = atual ? motos.find((m) => m.pedidoId === atual.id) : undefined;
  const previsaoAtual = atual ? previsaoDe(atual.id) : null;
  const statusDaMoto = (m: MotoCena) => (m.pedidoId && m.rotulo !== 'voltando' ? `Entregando #${m.pedidoId}` : m.rotulo === 'voltando' ? 'Voltando' : m.plano.modo === 'gps' ? 'Com GPS ligado' : 'Disponível');
  return (
    <div className="relative h-[calc(100dvh-12.5rem)] min-h-[520px] overflow-hidden rounded-2xl bg-[#efeae1] shadow-sm ring-1 ring-black/5 md:h-[calc(100dvh-3rem)]">
      <Falha>
        {mapa && lote ? (
          <Canvas orthographic shadows dpr={[1, 1.5]} camera={{ position: [lote.x + 30, 34, lote.z + 30], zoom: 10, near: -20000, far: 20000 }}>
            <Cena mapa={mapa} lote={lote} cor={cor} nome={nomeLoja} motos={motos} marcas={marcas} cozinha={cozinha} selecionado={selecionado} foco={foco} comando={comando} compacto={telaPequena} aoSelecionar={setSelecionado} aoClicarChao={aoClicarChao} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-gray-500">
            {falhaMapa ? 'Não deu para carregar o mapa da cidade.' : <><Loader2 className="h-4 w-4 animate-spin" />Carregando o mapa de Goiatuba…</>}
          </div>
        )}
      </Falha>
      {(posicionando || (mapa && !localConfig && !mapa.lanchonete)) && (
        <div className="absolute left-1/2 top-[7.6rem] z-40 w-[min(26rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl bg-white/95 p-3 text-xs shadow-xl ring-1 ring-black/5 backdrop-blur md:top-24">
          {posicionando ? (
            <>
              <p className="font-semibold text-gray-900">Toque no mapa no lugar da lanchonete.</p>
              <p className="mt-0.5 text-gray-500">Ela se vira sozinha para a rua mais próxima. Afaste o zoom para achar o quarteirão.</p>
              {aviso && <p className="mt-1 text-red-600">{aviso}</p>}
              <div className="mt-2 flex gap-2">
                <button disabled={!provisorio || salvando} onClick={salvarLocal} className="flex-1 rounded-lg py-2 font-semibold text-white disabled:opacity-40" style={{ background: cor }}>{salvando ? 'Salvando…' : 'Salvar local'}</button>
                <button onClick={() => { setPosicionando(false); setProvisorio(null); setAviso(''); }} className="flex-1 rounded-lg bg-gray-100 py-2 font-semibold text-gray-700">Cancelar</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0" style={{ color: cor }} />
              <p className="flex-1 text-gray-700">O local da lanchonete ainda não foi marcado no mapa.</p>
              <button onClick={() => setPosicionando(true)} className="shrink-0 rounded-lg px-3 py-2 font-semibold text-white" style={{ background: cor }}>Marcar</button>
            </div>
          )}
        </div>
      )}
      <p className="pointer-events-none absolute bottom-0.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-[9px] text-gray-500">Mapa © colaboradores do OpenStreetMap</p>
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 grid grid-cols-4 gap-1.5 md:right-auto md:flex md:gap-2">
        {numeros.map(({ rotulo, curto, valor, Icone }) => (
          <div key={rotulo} className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-xl bg-white/90 px-2 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur md:min-w-[150px] md:px-3">
            <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex" style={{ background: `${cor}1f`, color: cor }}><Icone className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-gray-500"><span className="md:hidden">{curto}</span><span className="hidden md:inline">{rotulo}</span></p>
              <p className="truncate text-sm font-bold leading-tight text-gray-900 md:text-lg">{valor}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 top-[4.6rem] z-30 flex items-center gap-2 md:top-3">
        <button onClick={() => { setPosicionando((v) => !v); setProvisorio(null); setAviso(''); }} title="Ajustar o local da lanchonete" className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white">
          <MapPin className="h-3.5 w-3.5" style={{ color: cor }} /><span className="hidden md:inline">Local</span>
        </button>
        <button onClick={simular} disabled={!mapa} className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white">
          <Sparkles className="h-3.5 w-3.5" style={{ color: cor }} />Simular pedido
        </button>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" /></span>
          Ao vivo<span className="tabular-nums text-gray-500">{new Date(agora).toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>
      <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white/90 shadow-sm ring-1 ring-black/5 backdrop-blur">
        {([['mais', Plus, 'Aproximar'], ['menos', Minus, 'Afastar'], ['inicio', Crosshair, 'Centralizar']] as const).map(([tipo, Icone, titulo]) => (
          <button key={tipo} title={titulo} onClick={() => enviar(tipo)} className="flex h-9 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-100"><Icone className="h-4 w-4" /></button>
        ))}
      </div>
      {(atual || motoSelecionada) && (
        <div className="absolute inset-x-3 bottom-3 z-40 rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-black/5 backdrop-blur md:inset-x-auto md:bottom-auto md:right-16 md:top-16 md:w-80">
          <button onClick={() => setSelecionado(null)} className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
          {atual ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{atual.simulado ? 'Pedido de teste' : atual.entrega ? 'Pedido · entrega' : 'Pedido · retirada'}</p>
              <div className="mt-0.5 flex items-center gap-2 pr-6">
                <h3 className="truncate text-base font-bold text-gray-900">#{atual.id} · {atual.nome}</h3>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: corDaEtapa(atual.etapa, cor) }}>{LEGENDAS[atual.etapa]}</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Feito</dt><dd className="font-medium text-gray-800">{hora(atual.criado)} · {desde(atual.criado, agora)}</dd></div>
                {motoDoAtual && <div className="flex justify-between gap-3"><dt className="text-gray-500">Entregador</dt><dd className="flex items-center gap-1.5 font-medium text-gray-800"><span className="h-2 w-2 rounded-full" style={{ background: motoDoAtual.cor }} />{motoDoAtual.nome}</dd></div>}
                {previsaoAtual && <div className="flex justify-between gap-3"><dt className="text-gray-500">Previsão</dt><dd className="font-medium text-gray-800">{agora >= previsaoAtual ? 'na porta do cliente' : `chega ~${hora(previsaoAtual)}`}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Total</dt><dd className="font-semibold text-gray-900">{dinheiro(atual.total)}</dd></div>
              </dl>
              {atual.itens.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-700">
                  {atual.itens.slice(0, 4).map((item, i) => <li key={i} className="truncate"><span className="font-semibold">{item.quantity}x</span> {item.name}</li>)}
                  {atual.itens.length > 4 && <li className="text-gray-400">+{atual.itens.length - 4} itens</li>}
                </ul>
              )}
              <div className="mt-4 md:hidden"><Etapas pedido={atual} cor={cor} previsao={previsaoAtual} /></div>
            </>
          ) : motoSelecionada && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Entregador</p>
              <h3 className="mt-0.5 flex items-center gap-2 pr-6 text-base font-bold text-gray-900"><span className="h-3 w-3 rounded-full" style={{ background: motoSelecionada.cor }} />{motoSelecionada.nome}</h3>
              <p className="mt-2 text-xs text-gray-600">{statusDaMoto(motoSelecionada)}</p>
            </>
          )}
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-30 hidden w-[min(640px,calc(100%-24rem))] rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 backdrop-blur md:block">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-900"><Bike className="h-4 w-4" style={{ color: cor }} />Acompanhamento</p>
          {acompanhado && <p className="truncate text-xs text-gray-500">#{acompanhado.id} · {acompanhado.nome}</p>}
        </div>
        {acompanhado ? <Etapas pedido={acompanhado} cor={cor} previsao={previsaoDe(acompanhado.id)} /> : <p className="py-3 text-center text-xs text-gray-500">Nenhum pedido em andamento agora. Toque em “Simular pedido” para ver a animação.</p>}
      </div>
      <div className="absolute bottom-3 right-3 z-30 hidden max-h-[46%] w-80 flex-col overflow-hidden rounded-2xl bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur md:flex">
        <div className="flex gap-1 border-b border-gray-100 p-2">
          {([['pedidos', `Pedidos ${vivos.length}`], ['entregadores', `Entregadores ${motos.length}`]] as const).map(([id, rotulo]) => (
            <button key={id} onClick={() => setAba(id)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${aba === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{rotulo}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {aba === 'pedidos' && (vivos.length ? vivos.map((p) => (
            <button key={p.id} onClick={() => setSelecionado(p.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-gray-50 ${selecionado === p.id ? 'bg-gray-100' : ''}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corDaEtapa(p.etapa, cor) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-gray-900">#{p.id} · {p.nome}</span>
                <span className="block truncate text-[11px] text-gray-500">{LEGENDAS[p.etapa]}{p.entrega ? '' : ' · retirada'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-gray-400"><Clock className="h-3 w-3" />{desde(p.criado, agora)}</span>
            </button>
          )) : <p className="px-3 py-6 text-center text-xs text-gray-500">Sem pedidos em andamento.</p>)}
          {aba === 'entregadores' && (motos.length ? motos.map((m) => (
            <button key={m.chave} onClick={() => setSelecionado(m.pedidoId ?? `moto:${m.chave}`)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-gray-50">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.cor }} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">{m.nome}</span>
              <span className="shrink-0 text-[11px] text-gray-500">{statusDaMoto(m)}</span>
            </button>
          )) : <p className="px-3 py-6 text-center text-xs text-gray-500">Nenhum entregador online.</p>)}
        </div>
      </div>
      {!atual && !motoSelecionada && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {vivos.length ? vivos.map((p) => (
            <button key={p.id} onClick={() => setSelecionado(p.id)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-gray-800 shadow-md ring-1 ring-black/5">
              <span className="h-2 w-2 rounded-full" style={{ background: corDaEtapa(p.etapa, cor) }} />#{p.id} · {p.nome}
            </button>
          )) : <p className="rounded-full bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-md ring-1 ring-black/5">Nenhum pedido agora · toque em “Simular pedido”</p>}
        </div>
      )}
    </div>
  );
}
