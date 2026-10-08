import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { unidadeAtual, cidadeAtual } from "./kv_retry.tsx";
import { franquia, emCadaUnidade, acharUnidade, configDaUnidade } from "./franquia.tsx";
import { acharCupom, usarCupom } from "./cupons.tsx";
import {
  success, error,
  sanitizeName, sanitizePhone, sanitizeText, sanitizeReviews,
  getClientIp, getBrasiliaISOString,
} from "./server_utils.tsx";
import { requireAdmin, requireAdminOrDriver, checkRateLimit, recordFailedAttempt } from "./middleware.tsx";
import { validateAndPriceOrder } from "./order_validation.tsx";
import type { OrderStatus, OrderReview } from "./types.tsx";

const router = new Hono();

router.post('/admin/migrate-scale', requireAdmin, async (c) => {
  try {
    const allOrders = await kv.getByPrefix('order:');
    let moved = 0;
    for (const order of allOrders) {
      if (order.status === 'completed' || order.status === 'cancelled') {
        await kv.set(`archive:${order.orderId}`, order);
        await kv.del(`order:${order.orderId}`);
        moved++;
      }
    }
    return success(c, { message: `Migração concluída. ${moved} pedidos arquivados.` });
  } catch (e) {
    return error(c, `Erro na migração: ${e}`);
  }
});

router.get('/orders', requireAdminOrDriver, async (c) => {
  try {
    let orders = await kv.getByPrefix('order:');
    if (c.get('authType' as never) === 'driver') {
      orders = orders.filter((o: any) => o.deliveryType === 'delivery' && ['ready_for_delivery', 'out_for_delivery'].includes(o.status));
    }
    orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return success(c, { orders });
  } catch (e) {
    return error(c, `Erro ao listar pedidos ativos: ${e}`);
  }
});

router.get('/orders/history', requireAdmin, async (c) => {
  try {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;
    const archives = await kv.getByPrefix('archive:');
    archives.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const result = limit === -1 ? archives : archives.slice(0, limit);
    return success(c, { orders: result });
  } catch (e) {
    return error(c, `Erro ao listar histórico: ${e}`);
  }
});

const pedidosDoSite = async () => {
  const daUnidade = async () => [...await kv.getByPrefix('order:'), ...await kv.getByPrefix('archive:')];
  return cidadeAtual() ? (await emCadaUnidade(daUnidade)).flat() : daUnidade();
};

router.get('/orders/search/:phone', async (c) => {
  const phone = c.req.param('phone');
  console.log('🔍 [BACKEND SEARCH] Buscando pedidos por telefone:', phone);
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    const allOrders = await pedidosDoSite();
    const matchingOrders = allOrders.filter((order: any) => {
      const orderPhone = order.customerPhone?.replace(/\D/g, '') || '';
      return orderPhone === normalizedPhone;
    });
    return success(c, { orders: matchingOrders });
  } catch (e) {
    console.error('❌ [BACKEND SEARCH] Erro ao buscar pedidos:', e);
    return error(c, `Erro ao buscar pedidos: ${e}`);
  }
});

router.get('/customers/:phone', async (c) => {
  const phone = c.req.param('phone');
  console.log('👤 [BACKEND] Buscando dados do cliente por telefone:', phone);
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    const allOrders = await pedidosDoSite();
    const customerOrders = allOrders.filter((order: any) => {
      const orderPhone = (order.customerPhone || '').replace(/\D/g, '');
      return orderPhone === normalizedPhone;
    });
    if (customerOrders.length === 0) return success(c, { customer: null });

    customerOrders.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const latestOrder = customerOrders[0];
    const customerName = latestOrder.customerName || '';

    const addressMap = new Map<string, any>();
    for (const order of customerOrders) {
      const street = order.address || order.customerAddress || '';
      if (street && !addressMap.has(street.toLowerCase().trim())) {
        addressMap.set(street.toLowerCase().trim(), {
          id: `addr_${addressMap.size + 1}`,
          street,
          reference: order.addressReference || order.reference || '',
          createdAt: order.createdAt || new Date().toISOString(),
        });
      }
    }

    const customer = {
      phone: normalizedPhone,
      name: customerName,
      addresses: Array.from(addressMap.values()),
      lastOrderDate: latestOrder.createdAt || null,
      totalOrders: customerOrders.length,
    };
    return success(c, { customer });
  } catch (e) {
    console.error('❌ [BACKEND] Erro ao buscar cliente:', e);
    return error(c, `Erro ao buscar dados do cliente: ${e}`);
  }
});

router.get('/orders/:id', async (c) => {
  const id = c.req.param('id');
  console.log('🔍 [BACKEND GET ORDER v2.1] Buscando pedido:', id);
  let order: any = await kv.get(`order:${id}`);
  if (!order) order = await kv.get(`archive:${id}`);
  if (!order) {
    const all = await kv.getByPrefix('order:');
    order = all.find((o: any) => o.orderId === id);
    if (!order) {
      const archives = await kv.getByPrefix('archive:');
      order = archives.find((o: any) => o.orderId === id);
    }
  }
  if (!order) {
    console.log('❌ [BACKEND GET ORDER] PEDIDO NÃO EXISTE NO SISTEMA:', id);
    return error(c, 'Pedido não encontrado', 404);
  }
  return success(c, { order });
});

router.post('/orders', async (c) => {
  try {
    const rawBody = await c.req.json();
    const body = {
      ...rawBody,
      customerName: rawBody.customerName ? sanitizeName(rawBody.customerName) : rawBody.customerName,
      customerPhone: rawBody.customerPhone ? sanitizePhone(rawBody.customerPhone) : rawBody.customerPhone,
      address: rawBody.address ? sanitizeText(rawBody.address, 300) : rawBody.address,
      notes: rawBody.notes ? sanitizeText(rawBody.notes, 500) : rawBody.notes,
      reference: rawBody.reference ? sanitizeText(rawBody.reference, 300) : rawBody.reference,
      items: Array.isArray(rawBody.items) ? rawBody.items.map((item: any) => ({
        ...item,
        notes: item.notes ? sanitizeText(item.notes, 300) : item.notes,
        name: item.name ? sanitizeText(item.name, 200) : item.name,
      })) : rawBody.items,
      couponCode: rawBody.couponCode ? sanitizeText(rawBody.couponCode, 50) : rawBody.couponCode,
      utm: rawBody.utm && typeof rawBody.utm === 'object'
        ? Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].filter((k) => typeof rawBody.utm[k] === 'string').map((k) => [k, sanitizeText(rawBody.utm[k], 100)]))
        : undefined,
    };

    delete body.unitId;
    if ((await franquia()) && !unidadeAtual()) return error(c, 'Escolha a unidade antes de fazer o pedido.', 400);
    const achada = await acharUnidade(unidadeAtual());
    if (achada?.unidade.isOpen === false || (await kv.get('store_status') as any)?.isOpen === false) return error(c, 'A loja está fechada agora.', 409);
    if (body.deliveryType === 'dine-in' && (await configDaUnidade()).features?.dineIn === false) return error(c, 'Esta loja não tem consumo no local.', 409);
    if (achada) { body.unitId = achada.unidade.id; body.unitName = achada.unidade.name; }

    const pricing = await validateAndPriceOrder(body);
    if (!pricing.ok) {
      console.warn('🚫 [ORDER] Pedido rejeitado por validação de preço:', pricing.message);
      return error(c, pricing.message || 'Dados do pedido inválidos', pricing.status || 400);
    }
    if (pricing.tampered) {
      console.warn('⚠️ [SECURITY] Total do cliente diverge do recomputado — usando o do servidor. Cliente:', body.total, 'Servidor:', pricing.total);
    }
    body.subtotal = pricing.subtotal;
    body.discount = pricing.discount;
    body.couponDiscount = pricing.discount;
    body.deliveryFee = pricing.deliveryFee;
    body.total = pricing.total;
    body.totalBeforeDiscount = Number((pricing.subtotal + pricing.deliveryFee).toFixed(2));

    for (const campo of ['paymentStatus', 'paymentConfirmed', 'paymentConfirmedAt', 'paidAt', 'paidAmount', 'paymentId', 'paymentGateway', 'stockDeducted', 'reviews', 'reviewedAt', 'driver']) delete body[campo];
    const timestamp = Date.now();
    const id = `order_${timestamp}`;
    let orderId = `FH-${timestamp.toString().slice(-6)}`;
    while (await kv.get(`order:${orderId}`) || await kv.get(`archive:${orderId}`) || !(await kv.inserir(`order_unit:${orderId}`, unidadeAtual() || ''))) orderId = `FH-${Math.floor(100000 + Math.random() * 900000)}`;

    if (body.couponCode && (await configDaUnidade()).features?.coupons !== false) {
      const cupom = await acharCupom(body.couponCode);
      if (cupom && !(await usarCupom(cupom))) return error(c, 'O cupom selecionado acabou de esgotar. Remova o cupom e tente novamente.', 400);
    }

    const order = {
      ...body, id, orderId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await kv.set(`order:${orderId}`, order);
    console.log('✅ [BACKEND] Pedido criado com sucesso:', orderId);
    return success(c, { order });
  } catch (e) {
    console.error('❌ [BACKEND] Erro ao criar pedido:', e);
    return error(c, `Erro ao criar pedido: ${e}`);
  }
});

router.put('/orders/:id/status', requireAdminOrDriver, async (c) => {
  const id = c.req.param('id');
  console.log('📥 [BACKEND] PUT /orders/:id/status:', id, '— auth:', c.get('authType'));
  try {
    const body = await c.req.json();
    const { status } = body;
    console.log('📥 [BACKEND] Novo status solicitado:', status);

    let order: any = await kv.get(`order:${id}`);
    let isArchived = false;
    if (!order) {
      order = await kv.get(`archive:${id}`);
      isArchived = true;
    }
    if (!order) {
      console.error('❌ [BACKEND] Pedido não encontrado:', id);
      return error(c, 'Pedido não encontrado', 404);
    }

    const updated: any = {
      ...order, status,
      updatedAt: new Date().toISOString(),
      ...(status === 'completed' && { completedAt: new Date().toISOString() })
    };

    if (status === 'preparing' && !order.stockDeducted && (await configDaUnidade()).features?.stockControl) {
      try {
        const orderItems = order.items || [];
        const now = getBrasiliaISOString();
        const isDineIn = order.deliveryType === 'dine-in';
        const rawAcomp = order.selectedAcompanhamentos || [];
        const selectedAcompIds: string[] = rawAcomp.map((a: any) => typeof a === 'string' ? a : a.id);

        for (const item of orderItems) {
          const product: any = await kv.get(`product:${item.productId || item.id}`);
          if (!product) continue;

          const productsToDeduct: any[] = [];
          
          if (product.promoItems && product.promoItems.length > 0) {
            for (const promoItem of product.promoItems) {
              const subProduct: any = await kv.get(`product:${promoItem.productId}`);
              if (subProduct?.recipe?.ingredients) {
                productsToDeduct.push(subProduct);
              }
            }
            if (product.recipe?.ingredients) {
              productsToDeduct.push(product);
            }
          } else if (product.recipe?.ingredients) {
            productsToDeduct.push(product);
          }

          if (productsToDeduct.length === 0) continue;

          for (const prodToDeduct of productsToDeduct) {
            for (const recipeIng of prodToDeduct.recipe.ingredients) {
            const ingredientKey = `stock_ingredient:${recipeIng.ingredientId}`;
            const ingredient: any = await kv.get(ingredientKey);
            if (!ingredient) continue;

            const ingCategory = recipeIng.category || ingredient.category || 'ingredient';

            if (isDineIn && (ingCategory === 'embalagem' || ingCategory === 'acompanhamento')) {
              console.log(`📦 [STOCK] Pulando ${ingCategory} "${ingredient.name}" (pedido no local)`);
              continue;
            }

            let totalDeduct = 0;

            if (ingCategory === 'acompanhamento') {
              if (!selectedAcompIds.includes(recipeIng.ingredientId)) {
                console.log(`📦 [STOCK] Pulando acompanhamento "${ingredient.name}" (cliente não selecionou)`);
                continue;
              }
              const defaultQty = recipeIng.defaultQuantityPerOrder || ingredient.defaultQuantity || recipeIng.quantityUsed || 1;
              totalDeduct = defaultQty * (item.quantity || 1);
            } else {
              totalDeduct = recipeIng.quantityUsed * (item.quantity || 1);
              if (recipeIng.selectedPortionG && recipeIng.selectedPortionG > 0) {
                totalDeduct = (recipeIng.selectedPortionG / 1000) * recipeIng.quantityUsed * (item.quantity || 1);
              }
            }

            try {
              await kv.atomicStockDecrement(ingredientKey, totalDeduct, now);
              console.log(`📦 [STOCK] ⚛️ Atômico: "${ingredient.name}" -${totalDeduct.toFixed(4)} (${ingCategory})`);
            } catch (atomicErr) {
              console.warn(`⚠️ [STOCK] Fallback não-atômico para "${ingredient.name}":`, String(atomicErr).slice(0, 80));
              ingredient.currentStock = Math.max(0, (ingredient.currentStock || 0) - totalDeduct);
              ingredient.updatedAt = now;
              await kv.set(ingredientKey, ingredient);
            }

            const deductionId = `deduct_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            await kv.set(`stock_deduction:${deductionId}`, {
              id: deductionId, ingredientId: ingredient.id, ingredientName: ingredient.name,
              category: ingCategory, portionLabel: recipeIng.selectedPortionLabel || null,
              portionG: recipeIng.selectedPortionG || null,
              productId: item.productId || item.id, quantity: totalDeduct, orderId: id, date: now,
            });
          }
          }
        }
        updated.stockDeducted = true;
        console.log('📦 [STOCK] Estoque descontado para pedido:', id, isDineIn ? '(no local)' : '(entrega/retirada)');
      } catch (stockErr) {
        console.error('⚠️ [STOCK] Erro ao descontar estoque (pedido continuará):', stockErr);
      }
    }

    if (status === 'completed' && updated.driver?.phone) {
      const normalizedPhone = String(updated.driver.phone).replace(/\D/g, '');
      const driver: any = await kv.get(`driver:${normalizedPhone}`);
      if (driver) {
        const now = new Date();
        const getBusinessDayStr = (date: Date) => {
          const businessTime = new Date(date.getTime() - (4 * 60 * 60 * 1000));
          return businessTime.toISOString().split('T')[0];
        };
        const todayStr = getBusinessDayStr(now);
        const currentMonthStr = todayStr.substring(0, 7);
        const stats = driver.stats || { today: { count: 0 }, month: { count: 0 }, total: 0 };
        const todayCount = (stats.today?.date === todayStr) ? (stats.today.count || 0) + 1 : 1;
        const monthCount = (stats.month?.month === currentMonthStr) ? (stats.month.count || 0) + 1 : 1;
        const totalCount = (stats.total || 0) + 1;
        const updatedDriver = {
          ...driver,
          stats: {
            today: { date: todayStr, count: todayCount },
            month: { month: currentMonthStr, count: monthCount },
            total: totalCount
          }
        };
        await kv.set(`driver:${normalizedPhone}`, updatedDriver);
      }
    }

    if (status === 'completed' || status === 'cancelled') {
      await kv.set(`archive:${id}`, updated);
      if (!isArchived) await kv.del(`order:${id}`);
    } else {
      await kv.set(`order:${id}`, updated);
      if (isArchived) {
        await kv.del(`archive:${id}`);
        console.log(`🔄 [ORDER] Pedido ${id} reaberto: removido do arquivo`);
      }
    }

    return success(c, { order: updated });
  } catch (e) {
    console.error('❌ [BACKEND] Erro ao atualizar status:', e);
    return error(c, `Erro ao atualizar status: ${e}`);
  }
});

router.put('/orders/:id/assign', requireAdminOrDriver, async (c) => {
  const id = c.req.param('id');
  try {
    const driver = await c.req.json();
    const order: any = await kv.get(`order:${id}`);
    if (!order) return error(c, 'Pedido não encontrado ou já arquivado', 404);
    const normalizedDriver = { ...driver, phone: String(driver.phone || '').replace(/\D/g, '') };
    const updated = {
      ...order, driver: normalizedDriver, status: 'out_for_delivery',
      updatedAt: new Date().toISOString()
    };
    await kv.set(`order:${id}`, updated);
    return success(c, { order: updated });
  } catch (e) {
    console.error('❌ [ASSIGN] Erro:', e);
    return error(c, `Erro ao atribuir entregador: ${e}`);
  }
});

router.post('/orders/:id/confirm-payment', requireAdmin, async (c) => {
  const id = c.req.param('id');
  console.log('💳 [PAYMENT] Confirmação de pagamento para pedido:', id);
  try {
    let order: any = await kv.get(`order:${id}`);
    if (!order) order = await kv.get(`archive:${id}`);
    if (!order) return error(c, 'Pedido não encontrado', 404);
    const agora = new Date().toISOString();
    const updated = { ...order, paymentStatus: 'paid', paymentConfirmed: true, paymentConfirmedAt: agora, paidAt: order.paidAt || agora, updatedAt: agora };
    await kv.set((await kv.get(`order:${id}`)) ? `order:${id}` : `archive:${id}`, updated);
    return success(c, { order: updated });
  } catch (e) {
    console.error('❌ [PAYMENT] Erro:', e);
    return error(c, `Erro ao confirmar pagamento: ${e}`, 500);
  }
});

router.delete('/admin/orders/clear-all', requireAdmin, async (c) => {
  const orders = await kv.getByPrefix('order:');
  for (const o of orders) await kv.del(`order:${(o as any).orderId}`);
  const archives = await kv.getByPrefix('archive:');
  for (const a of archives) await kv.del(`archive:${(a as any).orderId}`);
  return success(c, { message: 'Todos os pedidos (ativos e arquivados) foram limpos' });
});

router.put('/admin/orders/:id/cancel', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json();
  const order: any = await kv.get(`order:${id}`);
  if (!order) return error(c, 'Pedido não encontrado', 404);
  const updated = {
    ...order, status: 'cancelled', cancellationReason: reason,
    cancelledAt: new Date().toISOString()
  };
  await kv.set(`archive:${id}`, updated);
  await kv.del(`order:${id}`);
  return success(c, { order: updated });
});

router.get('/reviews/top', async (c) => {
  try {
    const pedidos = await pedidosDoSite();
    const ratings: Record<string, { total: number; count: number }> = {};
    for (const o of pedidos as any[]) {
      for (const r of Array.isArray(o?.reviews) ? o.reviews : []) {
        if (!r?.productName || typeof r.rating !== 'number') continue;
        const n = (ratings[r.productName] ||= { total: 0, count: 0 });
        n.total += r.rating;
        n.count += 1;
      }
    }
    return success(c, { ratings });
  } catch (e) {
    return error(c, `Erro ao calcular avaliações: ${e}`);
  }
});

router.post('/orders/:id/review', async (c) => {
  const id = c.req.param('id');
  console.log('⭐ [BACKEND] POST /orders/:id/review:', id);
  try {
    const ip = getClientIp(c);
    const rl = await checkRateLimit('review', ip);
    if (!rl.allowed) {
      console.warn(`🚫 [RATE LIMIT] IP ${ip} bloqueado no review — retry em ${rl.retryAfterSec}s`);
      return c.json({ success: false, error: `Muitas avaliações. Tente novamente em ${Math.ceil((rl.retryAfterSec || 60) / 60)} minutos.` }, 429);
    }
    const body = await c.req.json();
    const { reviews } = body;
    const sanitized = sanitizeReviews(reviews);
    if (!sanitized || sanitized.length === 0) {
      console.warn('⚠️ [REVIEW] Dados de review inválidos recebidos');
      return error(c, 'Dados de avaliação inválidos', 400);
    }
    let order: any = await kv.get(`order:${id}`);
    let isArchived = false;
    if (!order) {
      order = await kv.get(`archive:${id}`);
      isArchived = true;
    }
    if (!order) {
      console.error('❌ [BACKEND] Pedido não encontrado:', id);
      await recordFailedAttempt('review', ip);
      return error(c, 'Pedido não encontrado', 404);
    }
    if (order.reviewedAt) {
      console.warn('⚠️ [REVIEW] Pedido já avaliado:', id);
      return error(c, 'Este pedido já foi avaliado', 400);
    }
    const updated = { ...order, reviews: sanitized, reviewedAt: new Date().toISOString() };
    const key = isArchived ? `archive:${id}` : `order:${id}`;
    await kv.set(key, updated);
    await recordFailedAttempt('review', ip);
    console.log(`✅ [REVIEW] Avaliação salva para pedido ${id} (${sanitized.length} produtos)`);
    return success(c, { order: updated });
  } catch (e) {
    console.error('❌ [BACKEND] Erro ao salvar avaliação:', e);
    return error(c, `Erro ao salvar avaliação: ${e}`);
  }
});

export default router;