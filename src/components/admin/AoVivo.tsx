import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bell, Bike, Check, ChefHat, Clock, Crosshair, Home, Minus, Plus, ShoppingBag, Sparkles, Timer, X } from 'lucide-react';
import * as api from '../../utils/api';
import { useConfig } from '../../ConfigContext';
import { useDeliveryRealtime } from '../../hooks/useRealtime';
import { CAMERA_INICIAL, Cena, corDaEtapa, type Comando, type Etapa, type Foco, type MarcaCasa, type MotoCena } from './aovivo/Cena';
import { CASAS, COZINHA, VAGAS, duracaoViagem, hashTexto, rotaEntrega } from './aovivo/cidade';
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
const SIMULACAO = { preparo: 4000, pronto: 13000, rua: 17000, viagem: 14000, fim: 33500 };
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
  const anteriores = useRef(new Map<string, Pedido>());
  const casas = useRef(new Map<string, number>());
  const vagas = useRef(new Map<string, number>());
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
  const casaDe = useMemo(() => {
    const ativos = new Set([...vivos.map((p) => p.id), ...entregas.map((e) => e.pedido.id)]);
    for (const id of [...casas.current.keys()]) if (!ativos.has(id)) casas.current.delete(id);
    const ocupadas = new Set(casas.current.values());
    for (const p of [...vivos].reverse()) {
      if (!p.entrega || casas.current.has(p.id)) continue;
      let i = hashTexto(p.endereco || p.id) % CASAS.length;
      for (let n = 0; n < CASAS.length && ocupadas.has(i); n++) i = (i + 1) % CASAS.length;
      casas.current.set(p.id, i);
      ocupadas.add(i);
    }
    return new Map(casas.current);
  }, [vivos, entregas]);
  const motos = useMemo<MotoCena[]>(() => {
    const equipe = new Map<string, Entregador>();
    for (const d of motoboys) {
      const chave = soDigitos(d.phone);
      if (d.status === 'online' && chave) equipe.set(chave, { chave, nome: primeiroNome(d.name, 'Entregador'), cor: d.color || COR_NEUTRA });
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
      while (usadas.has(vaga) && vaga < VAGAS.length) vaga++;
      if (vaga >= VAGAS.length) vaga = hashTexto(chave) % VAGAS.length;
      vagas.current.set(chave, vaga);
      usadas.add(vaga);
    }
    return [...equipe.values()].map((e): MotoCena => {
      const vaga = vagas.current.get(e.chave) ?? 0;
      const pedido = vivos.find((p) => p.etapa === 'rua' && chaveDoEntregador(p) === e.chave && casaDe.has(p.id));
      if (pedido) {
        const rotas = rotaEntrega(vaga, casaDe.get(pedido.id)!);
        return { ...e, vaga, pedidoId: pedido.id, rotulo: `#${pedido.id}`, plano: { modo: 'ida', rota: rotas.ida, inicio: pedido.mudou, duracao: pedido.viagem ?? duracaoViagem(rotas.ida) } };
      }
      const entrega = [...entregas].reverse().find((x) => x.pedido.etapa === 'rua' && chaveDoEntregador(x.pedido) === e.chave && casaDe.has(x.pedido.id));
      if (entrega) {
        const rotas = rotaEntrega(vaga, casaDe.get(entrega.pedido.id)!);
        const duracao = entrega.pedido.viagem ?? duracaoViagem(rotas.ida);
        return { ...e, vaga, pedidoId: entrega.pedido.id, rotulo: 'voltando', plano: { modo: 'volta', ida: rotas.ida, volta: rotas.volta, inicio: entrega.em, progressoIda: Math.min(1, Math.max(0, (entrega.em - entrega.pedido.mudou) / duracao)) } };
      }
      return { ...e, vaga, plano: { modo: 'vaga' } };
    });
  }, [motoboys, simulacoes, vivos, entregas, casaDe]);
  const previsaoDe = useCallback((id: string) => {
    const moto = motos.find((m) => m.pedidoId === id);
    return moto && moto.plano.modo === 'ida' ? moto.plano.inicio + moto.plano.duracao : null;
  }, [motos]);
  const marcas = useMemo<MarcaCasa[]>(() => {
    const lista: MarcaCasa[] = [];
    for (const p of vivos) {
      const casa = casaDe.get(p.id);
      if (casa === undefined) continue;
      const previsao = previsaoDe(p.id);
      lista.push({ casa, pedidoId: p.id, etapa: p.etapa, titulo: `#${p.id} ${p.nome}`, legenda: previsao && agora >= previsao ? 'Na porta' : LEGENDAS[p.etapa] });
    }
    for (const e of entregas) {
      const casa = casaDe.get(e.pedido.id);
      if (casa !== undefined) lista.push({ casa, pedidoId: e.pedido.id, etapa: 'entregue', titulo: `#${e.pedido.id} ${e.pedido.nome}`, legenda: 'Entregue' });
    }
    return lista;
  }, [vivos, entregas, casaDe, previsaoDe, agora]);
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
    if (atual && (atual.etapa === 'preparo' || atual.etapa === 'pronto' || !atual.entrega)) return { tipo: 'ponto', x: COZINHA.x, z: COZINHA.z };
    const casa = casaDe.get(selecionado);
    return casa === undefined ? null : { tipo: 'ponto', x: CASAS[casa].x, z: CASAS[casa].z };
  }, [selecionado, motos, atual, casaDe]);
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
  const statusDaMoto = (m: MotoCena) => (m.plano.modo === 'ida' ? `Entregando #${m.pedidoId}` : m.plano.modo === 'volta' ? 'Voltando' : 'Disponível');
  return (
    <div className="relative h-[calc(100dvh-12.5rem)] min-h-[520px] overflow-hidden rounded-2xl bg-[#efeae1] shadow-sm ring-1 ring-black/5 md:h-[calc(100dvh-3rem)]">
      <Falha>
        <Canvas orthographic shadows dpr={[1, 1.75]} camera={{ position: CAMERA_INICIAL, zoom: 10, near: 0.1, far: 400 }}>
          <Cena cor={cor} nome={nomeLoja} motos={motos} marcas={marcas} cozinha={cozinha} selecionado={selecionado} foco={foco} comando={comando} compacto={telaPequena} aoSelecionar={setSelecionado} />
        </Canvas>
      </Falha>
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
        <button onClick={simular} className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white">
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
