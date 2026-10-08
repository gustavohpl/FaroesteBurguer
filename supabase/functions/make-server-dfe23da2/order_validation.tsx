import * as kv from "./kv_retry.tsx";
import { acharCupom } from "./cupons.tsx";
import { configDaUnidade } from "./franquia.tsx";

const MAX_QTY = 99;
const EPS = 0.01;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export interface OrderPricing {
  ok: boolean;
  status?: number;
  message?: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  tampered?: boolean;
}

export async function validateAndPriceOrder(body: any): Promise<OrderPricing> {
  const fail = (message: string, status = 400): OrderPricing => ({
    ok: false, status, message, subtotal: 0, discount: 0, deliveryFee: 0, total: 0,
  });

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return fail("Pedido sem itens.");
  }

  let subtotal = 0;
  for (const item of items) {
    const qty = item?.quantity;
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return fail(`Quantidade inválida para "${item?.name ?? "item"}": deve ser inteiro entre 1 e ${MAX_QTY}.`);
    }

    const clientPrice = Number(item?.price);
    if (!isFiniteNumber(clientPrice) || clientPrice < 0) {
      return fail(`Preço inválido para "${item?.name ?? "item"}".`);
    }

    const productId = item?.productId ?? item?.id;
    if (productId) {
      const product: any = await kv.get(`product:${productId}`);
      if (product && isFiniteNumber(product.price) && clientPrice < product.price - EPS) {
        return fail(`Preço do item "${item?.name ?? productId}" abaixo do preço vigente.`);
      }
    }

    const addons = Array.isArray(item?.selectedAddons) ? item.selectedAddons : [];
    let addonsTotal = 0;
    for (const addon of addons) {
      const ap = Number(addon?.price);
      if (isFiniteNumber(ap) && ap > 0) addonsTotal += ap;
    }

    subtotal += (clientPrice + addonsTotal) * qty;
  }

  const rawFee = Number(body?.deliveryFee);
  const feeGiven = isFiniteNumber(rawFee) && rawFee >= 0 ? rawFee : 0;
  const deliveryFee = body?.deliveryType === "delivery" ? feeGiven : 0;

  let discount = 0;
  const code = typeof body?.couponCode === "string" ? body.couponCode.trim() : "";
  if (code) {
    const coupon: any = (await configDaUnidade()).features?.coupons === false ? null : await acharCupom(code);
    const usable =
      coupon &&
      coupon.isActive &&
      (coupon.maxUses === -1 || (coupon.currentUses ?? 0) < coupon.maxUses) &&
      (!coupon.expiresAt || new Date() <= new Date(coupon.expiresAt));
    if (usable) {
      discount = coupon.type === "percentage" ? (subtotal * coupon.value) / 100 : Number(coupon.value) || 0;
      if (!isFiniteNumber(discount) || discount < 0) discount = 0;
      discount = Math.min(discount, subtotal);
    }
  }

  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const clientTotal = Number(body?.total);
  const tampered = isFiniteNumber(clientTotal) ? Math.abs(clientTotal - total) > EPS : true;

  return {
    ok: true,
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    total: Number(total.toFixed(2)),
    tampered,
  };
}
