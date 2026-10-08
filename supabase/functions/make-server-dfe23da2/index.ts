import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

import authRoutes from "./routes_auth.tsx";
import productRoutes from "./routes_products.tsx";
import orderRoutes from "./routes_orders.tsx";
import deliveryRoutes from "./routes_delivery.tsx";
import configRoutes from "./routes_config.tsx";
import securityRoutes from "./routes_security.tsx";
import testRoutes from "./routes_tests.tsx";
import metaRoutes from "./meta_routes.tsx";
import mercadoPagoRoutes from "./mercadopago.tsx";
import { comEscopo, definirEscopo } from "./kv_retry.tsx";
import { acharCidade, entrarNaUnidade, escopoDoPedido } from "./franquia.tsx";

const api = new Hono();

api.use('*', (c: any, next: any) => comEscopo(null, null, async () => {
  const unidade = c.req.header('X-Unit-Id'), cidade = c.req.header('X-City-Id');
  if (unidade) await entrarNaUnidade(unidade);
  else if (cidade && await acharCidade(cidade)) definirEscopo(null, cidade);
  const doPedido = c.req.path.match(/\/(?:orders|payment\/mp\/status)\/([A-Za-z0-9_-]+)/)?.[1];
  if (doPedido && doPedido !== 'search') await escopoDoPedido(doPedido);
  return next();
}));

api.use('*', async (c: any, next: any) => {
  await next();
  const newCsrf = c.get('_newCsrf');
  if (newCsrf && c.res) {
    try {
      const hdrs = new Headers(c.res.headers);
      hdrs.set('X-New-CSRF-Token', newCsrf);
      c.res = new Response(c.res.body, { status: c.res.status, statusText: c.res.statusText, headers: hdrs });
    } catch (e) {
      console.warn('⚠️ [CSRF] Falha ao injetar header de rotação:', e);
    }
  }
});

api.route('/', authRoutes);
api.route('/', productRoutes);
api.route('/', orderRoutes);
api.route('/', deliveryRoutes);
api.route('/', configRoutes);
api.route('/', securityRoutes);
api.route('/', testRoutes);
api.route('/', metaRoutes);
api.route('/', mercadoPagoRoutes);

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Master-Token', 'X-Admin-Token', 'X-CSRF-Token', 'X-Driver-Token', 'X-Unit-Id', 'X-City-Id'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision', 'X-New-CSRF-Token'],
  maxAge: 600,
}));

app.use('*', logger(console.log));

app.route('/server', api);
app.route('/make-server-dfe23da2', api);
app.route('/', api);

Deno.serve(app.fetch);
