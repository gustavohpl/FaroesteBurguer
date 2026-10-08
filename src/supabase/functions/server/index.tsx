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

const api = new Hono();

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

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Master-Token', 'X-Admin-Token', 'X-CSRF-Token', 'X-Driver-Token'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision', 'X-New-CSRF-Token'],
  maxAge: 600,
}));

app.use('*', logger(console.log));

app.route('/server', api);
app.route('/make-server-dfe23da2', api);
app.route('/', api);

Deno.serve(app.fetch);
