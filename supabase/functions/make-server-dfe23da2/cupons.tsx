import * as kv from "./kv_retry.tsx";
import { unidadeAtual } from "./kv_retry.tsx";

const ITEM = 'cupom_compartilhado:item:';
export const ehCompartilhado = (id: string) => id.startsWith('cshared_');
export const chaveDoCupom = (id: string) => (ehCompartilhado(id) ? `${ITEM}${id}` : `coupon:${id}`);

export async function cuponsDaUnidade(): Promise<any[]> {
  const proprios = await kv.getByPrefix('coupon:');
  const u = unidadeAtual();
  const divididos = u ? (await kv.getByPrefix(ITEM)).filter((c: any) => (c.unidades || []).includes(u)) : [];
  return [...proprios, ...divididos.map((c: any) => ({ ...c, compartilhado: true }))];
}

export async function acharCupom(code: string): Promise<any | null> {
  const alvo = String(code || '').trim().toUpperCase();
  return (await cuponsDaUnidade()).find((c: any) => c.code?.toUpperCase() === alvo) || null;
}

export async function usarCupom(cupom: any): Promise<boolean> {
  const chave = chaveDoCupom(cupom.id);
  const atual: any = await kv.get(chave);
  if (!atual) return false;
  let usos = atual.currentUses || 0;
  if (atual.maxUses !== -1) {
    const base = ehCompartilhado(cupom.id) ? `cupom_compartilhado:uso:${cupom.id}:` : `coupon_uso:${cupom.id}:`;
    let n = usos + 1;
    while (n <= atual.maxUses && !(await kv.inserir(`${base}${n}`, new Date().toISOString()))) n++;
    if (n > atual.maxUses) return false;
    usos = n;
  } else usos += 1;
  const depois: any = await kv.get(chave);
  await kv.set(chave, { ...depois, currentUses: Math.max(usos, depois?.currentUses || 0), lastUsedAt: new Date().toISOString() });
  return true;
}
