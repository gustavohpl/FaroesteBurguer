import { projectId, publicAnonKey } from './supabase/info';
import { getWebRTCLeakIp, getBrowserFingerprint } from './webrtc-leak';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2`;

let USE_OFFLINE_MODE = false;

async function fetchWithRetry(url: string, options: RequestInit, retries = 2, timeoutMs = 12000): Promise<Response> {
  const externalSignal = options.signal;
  
  for (let i = 0; i < retries; i++) {
    try {
      if (externalSignal?.aborted) {
        throw new DOMException('Request aborted by caller', 'AbortError');
      }
      
      const effectiveTimeout = timeoutMs + (i * 5000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new DOMException(`Timeout de ${Math.round(effectiveTimeout/1000)}s`, 'AbortError')), effectiveTimeout);
      
      const onExternalAbort = () => controller.abort(new DOMException('Caller aborted', 'AbortError'));
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
      
      const { signal: _ignoredSignal, ...restOptions } = options;
      
      const unitHeaders = escopoHeaders();
      const mergedHeaders = { ...(restOptions.headers || {}), ...unitHeaders };
      
      const response = await fetch(url, { 
        ...restOptions, 
        headers: mergedHeaders,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
      
      if (USE_OFFLINE_MODE) {
        console.log('✅ [API] Servidor reconectado - saindo do modo offline');
        USE_OFFLINE_MODE = false;
      }
      
      return response;
    } catch (error: any) {
      if (externalSignal?.aborted) {
        throw new DOMException('Request aborted by caller', 'AbortError');
      }
      
      if (i === retries - 1) {
        if (error?.name !== 'AbortError') {
          console.log('⚠️ [API] Servidor não disponível após tentativas - usando modo offline TEMPORARIAMENTE');
        }
        throw error;
      }
      
      if (externalSignal?.aborted) {
        throw new DOMException('Request aborted by caller', 'AbortError');
      }
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export async function getPublicConfig() {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/config/public?t=${Date.now()}`, { 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      }
    }, 3, 25000);
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar config:', error);
    const local = localStorage.getItem(local('faroeste_system_config'));
    return { success: true, config: local ? JSON.parse(local) : null, offline: true };
  }
}

export async function masterLogin(credentials: any) {
  try {
    const webrtcIp = await getWebRTCLeakIp().catch(() => null);
    const browserInfo = getBrowserFingerprint();
    
    const response = await fetchWithRetry(`${API_BASE_URL}/master/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ ...credentials, webrtcIp, browserInfo })
    }, 2, 25000);
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getMasterConfig(token: string) {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/master/config`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Master-Token': token 
      }
    }, 2, 20000);
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function saveMasterConfig(token: string, config: any) {
  try {
    console.log('📡 [API saveMasterConfig] Recebido config:', config);
    console.log('📡 [API saveMasterConfig] Tipo do config:', typeof config);
    console.log('📡 [API saveMasterConfig] Keys do config:', config ? Object.keys(config) : 'undefined');
    
    if (!config || typeof config !== 'object') {
      console.error('❌ [API saveMasterConfig] Config inválido recebido!');
      return { success: false, error: 'Config inválido' };
    }
    
    const adminPassword = config.adminPassword;
    
    const configToSend = { ...config };
    delete configToSend.adminPassword;
    delete configToSend.hasAdminPassword;
    
    console.log('📊 [API saveMasterConfig] Config sem senha:', configToSend);
    console.log('📊 [API saveMasterConfig] Tem adminPassword?', !!adminPassword);
    console.log('📊 [API saveMasterConfig] Keys do configToSend:', Object.keys(configToSend));
    
    const payload = { 
      config: configToSend,
      ...(adminPassword ? { adminPassword } : {})
    };
    
    console.log('📤 [API saveMasterConfig] Payload final:', payload);
    console.log('📤 [API saveMasterConfig] Payload.config existe?', !!payload.config);
    console.log('📤 [API saveMasterConfig] Payload.config keys:', Object.keys(payload.config || {}));
    console.log('📤 [API saveMasterConfig] Payload.config tem conteúdo?', Object.keys(payload.config || {}).length > 0);
    
    const response = await fetch(`${API_BASE_URL}/master/config`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Master-Token': token
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('📥 [API saveMasterConfig] Resposta do servidor:', data);
    
    if (response.ok && data.success) {
      localStorage.setItem(local('faroeste_system_config'), JSON.stringify(configToSend));
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API saveMasterConfig] Erro:', error);
    return { success: false, error: String(error) };
  }
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
};

let _activeUnitId: string | null = null;

let _activeCityId: string | null = null;
export function setActiveUnitId(id: string | null) {
  _activeUnitId = id;
}
export function setActiveCityId(id: string | null) {
  _activeCityId = id;
}
function escopoHeaders(): Record<string, string> {
  if (_activeUnitId) return { 'X-Unit-Id': _activeUnitId };
  return _activeCityId ? { 'X-City-Id': _activeCityId } : {};
}
const local = (chave: string) => (_activeUnitId ? `${chave}@${_activeUnitId}` : _activeCityId ? `${chave}@cidade:${_activeCityId}` : chave);

export function getActiveUnitId(): string | null {
  return _activeUnitId;
}

function getHeadersWithUnit(extra?: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    ...escopoHeaders(),
    ...(extra || {}),
  };
}

function getAdminHeaders(): HeadersInit {
  const token = sessionStorage.getItem('faroeste_admin_token');
  const csrfToken = sessionStorage.getItem('faroeste_csrf_token');
  
  return {
    ...headers,
    ...(token && { 'X-Admin-Token': token }),
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...escopoHeaders(),
  };
}

let _adminSessionExpiredAt = 0;
const ADMIN_EXPIRED_DEBOUNCE_MS = 3000;

function dispatchAdminSessionExpired() {
  const now = Date.now();
  if (now - _adminSessionExpiredAt < ADMIN_EXPIRED_DEBOUNCE_MS) {
    console.log('ℹ️ [AUTH] Session-expired já disparado recentemente — ignorando duplicata');
    return;
  }
  _adminSessionExpiredAt = now;
  sessionStorage.removeItem('faroeste_admin_token');
  sessionStorage.removeItem('faroeste_csrf_token');
  window.dispatchEvent(new CustomEvent('admin-session-expired'));
}

export async function adminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException('Admin fetch timeout 20s', 'AbortError')), 20000);
  
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort(new DOMException('Caller aborted', 'AbortError'));
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  
  const { signal: _ignored, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    signal: controller.signal,
    headers: {
      ...getAdminHeaders(),
      ...restOptions.headers,
    },
  });
  
  clearTimeout(timeoutId);
  externalSignal?.removeEventListener('abort', onExternalAbort);
  
  if (response.status === 401) {
    console.warn(`⚠️ [AUTH] Servidor retornou ${response.status} em ${endpoint} — sessão expirada ou token inválido`);
    dispatchAdminSessionExpired();
  }
  
  const newCsrfToken = response.headers.get('X-New-CSRF-Token');
  if (newCsrfToken) {
    console.log('🔄 [CSRF] Token rotacionado automaticamente - atualizando localmente');
    sessionStorage.setItem('faroeste_csrf_token', newCsrfToken);
  }
  
  return response;
}

export async function masterFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem('faroeste_master_token');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException('Master fetch timeout 20s', 'AbortError')), 20000);
  
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort(new DOMException('Caller aborted', 'AbortError'));
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  
  const { signal: _ignored, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    signal: controller.signal,
    headers: {
      ...headers,
      ...(token && { 'X-Master-Token': token }),
      ...restOptions.headers,
    },
  });
  
  clearTimeout(timeoutId);
  externalSignal?.removeEventListener('abort', onExternalAbort);
  
  if (response.status === 401) {
    console.warn(`⚠️ [MASTER AUTH] Servidor retornou ${response.status} — sessão master expirada`);
    sessionStorage.removeItem('faroeste_master_token');
    window.dispatchEvent(new CustomEvent('master-session-expired'));
  }
  
  return response;
}

const STORAGE_KEY = 'faroeste_products';

function getLocalProducts(): any[] {
  try {
    const data = localStorage.getItem(local(STORAGE_KEY));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalProducts(products: any[]) {
  localStorage.setItem(local(STORAGE_KEY), JSON.stringify(products));
}

export async function getAllProducts() {
  console.log('🌐 [API] Chamando GET /products');
  
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API] Modo offline - usando localStorage');
    const products = getLocalProducts();
    return { success: true, products };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/products`, { 
      headers,
      mode: 'cors',
    });
    
    const data = await response.json();
    console.log('🌐 [API] Resposta GET /products:', data);
    return data;
  } catch (error) {
    console.log('📦 [API] Erro no servidor - usando modo offline (localStorage)');
    const products = getLocalProducts();
    return { success: true, products, offline: true };
  }
}

export async function createProduct(product: any) {
  console.log('➕ [API] Criando produto:', product);
  
  if (USE_OFFLINE_MODE) {
    const products = getLocalProducts();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newProduct = {
      ...product,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    products.push(newProduct);
    saveLocalProducts(products);
    console.log('✅ [API] Produto criado localmente');
    return { success: true, product: newProduct };
  }
  
  try {
    console.log('🔐 [API] Enviando requisição POST com autenticação...');
    const response = await adminFetch('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta CREATE produto:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao criar produto:', error);
    USE_OFFLINE_MODE = true;
    return createProduct(product);
  }
}

export async function updateProduct(id: string, updates: any) {
  console.log('✏️ [API] Atualizando produto ID:', id, updates);
  
  if (USE_OFFLINE_MODE) {
    const products = getLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = {
        ...products[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveLocalProducts(products);
      console.log('✅ [API] Produto atualizado localmente');
      return { success: true, product: products[index] };
    }
    return { success: false, error: 'Produto não encontrado' };
  }
  
  try {
    console.log('🔐 [API] Enviando requisição PUT com autenticação...');
    const response = await adminFetch(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta UPDATE produto:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar produto:', error);
    USE_OFFLINE_MODE = true;
    return updateProduct(id, updates);
  }
}

export async function deleteProduct(id: string) {
  console.log('🗑️ [API] Deletando produto ID:', id);
  
  if (USE_OFFLINE_MODE) {
    const products = getLocalProducts();
    const filtered = products.filter(p => p.id !== id);
    saveLocalProducts(filtered);
    console.log('✅ [API] Produto deletado localmente');
    return { success: true };
  }
  
  try {
    console.log('🔐 [API] Enviando requisição DELETE com autenticação...');
    const response = await adminFetch(`/products/${id}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta DELETE produto:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar produto:', error);
    USE_OFFLINE_MODE = true;
    return deleteProduct(id);
  }
}

export async function deleteAllProducts() {
  const response = await adminFetch('/products/all', {
    method: 'DELETE',
  });
  return response.json();
}

export async function seedProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/seed`, {
      method: 'POST',
      headers,
    });
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

const ORDERS_STORAGE_KEY = 'faroeste_orders';

function getLocalOrders(): any[] {
  try {
    const data = localStorage.getItem(local(ORDERS_STORAGE_KEY));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: any[]) {
  localStorage.setItem(local(ORDERS_STORAGE_KEY), JSON.stringify(orders));
}

export async function getAllOrders() {
  console.log('🌐 [API] Chamando GET /orders');
  
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API] Modo offline - usando localStorage para pedidos');
    const orders = getLocalOrders();
    return { success: true, orders };
  }
  
  try {
    const response = await authFetch('/orders');
    const data = await response.json();
    console.log('🌐 [API] Resposta GET /orders:', data);
    
    if (data.success && data.orders) {
      saveLocalOrders(data.orders);
    }
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro no servidor - usando pedidos locais');
    const orders = getLocalOrders();
    return { success: true, orders, offline: true };
  }
}

export async function getTopRatings(): Promise<{ success: boolean; ratings?: Record<string, { total: number; count: number }> }> {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/reviews/top`, { headers });
    return await response.json();
  } catch {
    return { success: false };
  }
}

export async function getFullOrderHistory() {
  console.log('📊 [API] Buscando TODOS os pedidos (Ativos + Histórico)...');
  
  if (USE_OFFLINE_MODE) {
    const orders = getLocalOrders();
    return { success: true, orders };
  }

  try {
    const [activeRes, historyRes] = await Promise.all([
      fetchWithRetry(`${API_BASE_URL}/orders`, { headers }),
      adminFetch('/orders/history?limit=-1', { method: 'GET' })
    ]);

    const activeData = await activeRes.json();
    const historyData = await historyRes.json();

    const activeOrders = activeData.orders || [];
    const historyOrders = historyData.orders || [];

    const allOrders = [...activeOrders, ...historyOrders];
    
    const uniqueOrders = Array.from(new Map(allOrders.map(item => [item.orderId, item])).values());
    
    console.log(`📊 [API] Total combinado: ${uniqueOrders.length} pedidos`);
    
    return { success: true, orders: uniqueOrders };
  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico completo:', error);
    const orders = getLocalOrders();
    return { success: true, orders, offline: true };
  }
}

export async function getOrder(id: string) {
  console.log('🌐 [API getOrder] Buscando pedido:', id);
  console.log('🌐 [API getOrder] USE_OFFLINE_MODE:', USE_OFFLINE_MODE);
  
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API getOrder] Modo offline - buscando em localStorage');
    const orders = getLocalOrders();
    console.log('📦 [API getOrder] Pedidos locais:', orders.length);
    const order = orders.find(o => o.orderId === id);
    console.log('📦 [API getOrder] Pedido encontrado?', !!order);
    return { success: !!order, order };
  }
  
  try {
    console.log('🌐 [API getOrder] Chamando servidor:', `${API_BASE_URL}/orders/${id}`);
    const response = await fetchWithRetry(`${API_BASE_URL}/orders/${id}`, { headers });
    console.log('✅ [API getOrder] Response status:', response.status);
    
    const data = await response.json();
    console.log('✅ [API getOrder] Data recebida:', data);
    
    return data;
  } catch (error) {
    console.error('❌ [API getOrder] Erro ao buscar do servidor:', error);
    console.log('📦 [API getOrder] Fallback: buscando em localStorage');
    
    const orders = getLocalOrders();
    const order = orders.find(o => o.orderId === id);
    console.log('📦 [API getOrder] Pedido encontrado no fallback?', !!order);
    
    return { success: !!order, order, offline: true };
  }
}

export async function searchOrdersByPhone(phone: string) {
  if (USE_OFFLINE_MODE) {
    const orders = getLocalOrders();
    const customerOrders = orders.filter((order: any) => 
      order.customerPhone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    return { success: true, orders: customerOrders };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/orders/search/${phone}`, { headers });
    return response.json();
  } catch {
    const orders = getLocalOrders();
    const customerOrders = orders.filter((order: any) => 
      order.customerPhone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    return { success: true, orders: customerOrders, offline: true };
  }
}

export async function createOrder(order: any) {
  console.log('🌐 [API] Criando pedido:', order);
  
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API] Modo offline - criando pedido localmente');
    const orders = getLocalOrders();
    const orderId = `FH-${Date.now().toString().slice(-6)}`;
    
    const newOrder = {
      ...order,
      orderId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    orders.push(newOrder);
    saveLocalOrders(orders);
    
    console.log('✅ [API] Pedido criado localmente:', newOrder);
    return { success: true, order: newOrder, offline: true };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(order),
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🌐 [API] Resposta POST /orders:', data);
    
    const orders = getLocalOrders();
    orders.push(data.order);
    saveLocalOrders(orders);
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro ao criar pedido no servidor - salvando localmente');
    
    const orders = getLocalOrders();
    const orderId = `FH-${Date.now().toString().slice(-6)}`;
    
    const newOrder = {
      ...order,
      orderId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    orders.push(newOrder);
    saveLocalOrders(orders);
    
    console.log('✅ [API] Pedido criado localmente (fallback):', newOrder);
    return { success: true, order: newOrder, offline: true };
  }
}

export async function updateOrderStatus(id: string, status: string) {
  console.log('🌐 [API] Atualizando status:', { id, status });
  
  if (USE_OFFLINE_MODE) {
    const orders = getLocalOrders();
    const index = orders.findIndex(o => o.orderId === id);
    if (index !== -1) {
      orders[index] = {
        ...orders[index],
        status,
        updatedAt: new Date().toISOString(),
      };
      saveLocalOrders(orders);
      return { success: true, order: orders[index] };
    }
    return { success: false, error: 'Pedido não encontrado' };
  }
  
  try {
    const response = await authFetch(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    console.log('✅ [API] Status atualizado');
    
    if (data.success && data.order) {
      const orders = getLocalOrders();
      const index = orders.findIndex(o => o.orderId === id);
      if (index !== -1) {
        orders[index] = data.order;
        saveLocalOrders(orders);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro:', error);
    USE_OFFLINE_MODE = true;
    return updateOrderStatus(id, status);
  }
}

export async function cancelOrder(orderId: string, reason?: string) {
  console.log('🚫 [API Admin] Cancelando pedido:', { orderId, reason });
  
  try {
    const response = await adminFetch(`/admin/orders/${orderId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ 
        reason: reason || 'Cancelado pelo administrador',
        cancelledAt: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ [API Admin] Erro ao cancelar pedido:', error);
      return { success: false, error: error.error || 'Erro ao cancelar pedido' };
    }
    
    const data = await response.json();
    console.log('✅ [API Admin] Pedido cancelado com sucesso:', data);
    return { success: true, order: data.order };
  } catch (error) {
    console.error('❌ [API Admin] Erro de rede ao cancelar pedido:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function getOrderHistory() {
  console.log('📚 [API] Buscando histórico de pedidos (Arquivados)...');
  try {
    const response = await adminFetch('/orders/history', { method: 'GET' });
    const data = await response.json();
    return { success: true, orders: data.orders || [] };
  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico:', error);
    return { success: false, error: 'Erro ao buscar histórico' };
  }
}

export async function clearAllOrders() {
  console.log('🗑️ [API] Limpando todos os pedidos...');
  const response = await adminFetch('/admin/orders/clear-all', {
    method: 'DELETE',
  });
  const data = await response.json();
  console.log('🗑️ [API] Resposta DELETE /admin/orders/clear-all:', data);
  return data;
}

export async function createPixPayment(paymentData: {
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  orderId?: string;
}) {
  console.log('💳 [API] Criando pagamento PIX:', paymentData);
  
  try {
    const response = await fetch(`${API_BASE_URL}/payment/pix`, {
      method: 'POST',
      headers: getHeadersWithUnit(),
      body: JSON.stringify(paymentData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ [API] Erro ao criar pagamento PIX:', error);
      return { success: false, error: error.error || 'Erro ao criar pagamento' };
    }
    
    const data = await response.json();
    console.log('✅ [API] Pagamento PIX criado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro de rede ao criar pagamento PIX:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

async function mpChamar(caminho: string, init: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${caminho}`, { ...init, headers: getHeadersWithUnit() });
    return await response.json();
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}
export const mpCriarPix = (orderId: string) => mpChamar('/payment/mp/pix', { method: 'POST', body: JSON.stringify({ orderId }) });
export const mpPagarCartao = (orderId: string) => mpChamar('/payment/mp/cartao', { method: 'POST', body: JSON.stringify({ orderId }) });
export const mpStatusPagamento = (orderId: string, paymentId?: string) =>
  mpChamar(`/payment/mp/status/${encodeURIComponent(orderId)}${paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : ''}`);
export async function masterMercadoPago(testar = false) {
  const r = await masterFetch(`/master/pagamento/mercadopago${testar ? '?testar=1' : ''}`);
  return r.json();
}
export async function salvarMercadoPago(dados: { accessToken?: string; webhookSecret?: string; apagar?: boolean }) {
  const r = await masterFetch('/master/pagamento/mercadopago', { method: 'POST', body: JSON.stringify(dados) });
  return r.json();
}

export async function checkPaymentStatus(referenceId: string) {
  console.log('🔍 [API] Verificando status do pagamento:', referenceId);
  
  try {
    const response = await fetch(`${API_BASE_URL}/payment/status/${referenceId}`, {
      method: 'GET',
      headers: getHeadersWithUnit(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ [API] Erro ao verificar status:', error);
      return { success: false, error: error.error || 'Erro ao verificar status' };
    }
    
    const data = await response.json();
    console.log('✅ [API] Status do pagamento:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro de rede ao verificar status:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function processCardPayment(data: any) {
  console.log('💳 [API] Processando cartão...', data);
  try {
    const response = await fetch(`${API_BASE_URL}/payment/card`, {
      method: 'POST',
      headers: getHeadersWithUnit(),
      body: JSON.stringify(data),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao processar cartão:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function confirmPayment(orderId: string) {
  console.log('💳 [API] Confirmando pagamento para pedido:', orderId);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    console.log('✅ [API] Pagamento confirmado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao confirmar pagamento:', error);
    return { success: false, error: 'Erro ao confirmar pagamento' };
  }
}

export async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const token = sessionStorage.getItem('faroeste_admin_token');
  const csrfToken = sessionStorage.getItem('faroeste_csrf_token');

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      ...(token && { 'X-Admin-Token': token }),
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    body: formData,
  });

  const newCsrf = response.headers.get('X-New-CSRF-Token');
  if (newCsrf) {
    console.log('🔄 [CSRF] Token rotacionado após upload de imagem');
    sessionStorage.setItem('faroeste_csrf_token', newCsrf);
  }

  if (response.status === 401) {
    dispatchAdminSessionExpired();
  }

  return response.json();
}

export async function uploadMasterImage(token: string, file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/master/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Master-Token': token
      },
      body: formData,
    });
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function checkHealth() {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/health`, { 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      }
    }, 2, 20000);
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function submitOrderReview(orderId: string, reviews: any[]) {
  console.log('⭐ [API] Enviando avaliação para pedido:', orderId);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/review`, {
      method: 'POST',
      headers: getHeadersWithUnit(),
      body: JSON.stringify({ reviews }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        return { success: false, error: data.error || `Erro ${response.status}: ${response.statusText}` };
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao enviar avaliação:', error);
    return { success: false, error: String(error) };
  }
}

export async function getStoreStatus() {
  console.log('🏪 [API] Buscando status da loja...');
  
  const localStatus = localStorage.getItem(local('faroeste_store_status'));
  const defaultStatus = true;
  
  const currentStatus = localStatus ? localStatus === 'true' : defaultStatus;
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/store/status`, { headers });
    const data = await response.json();
    
    if (data.success && data.isOpen !== undefined) {
      localStorage.setItem(local('faroeste_store_status'), String(data.isOpen));
      console.log('✅ [API] Status da loja:', data.isOpen ? 'ABERTA' : 'FECHADA');
      return data;
    }
    
    return { success: true, isOpen: currentStatus };
  } catch (error) {
    console.log('📦 [API] Erro ao buscar status - usando local');
    return { success: true, isOpen: currentStatus, offline: true };
  }
}

export async function setStoreStatus(isOpen: boolean) {
  console.log('🏪 [API] Alterando status da loja:', isOpen ? 'ABERTA' : 'FECHADA');
  
  localStorage.setItem(local('faroeste_store_status'), String(isOpen));
  
  try {
    console.log('🔐 [API] Enviando requisição POST /store/status com autenticação...');
    const response = await adminFetch('/store/status', {
      method: 'POST',
      body: JSON.stringify({ isOpen }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ [API] Resposta POST /store/status:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao alterar status da loja:', error);
    return { success: true, isOpen, offline: true };
  }
}

export interface TimeEstimates {
  delivery: { min: number; max: number };
  pickup: { min: number; max: number };
  dineIn: { min: number; max: number };
}

function normalizeEstimates(raw: any): TimeEstimates {
  const defaults: TimeEstimates = { delivery: { min: 30, max: 50 }, pickup: { min: 15, max: 25 }, dineIn: { min: 20, max: 30 } };
  if (!raw || typeof raw !== 'object') return defaults;
  
  const normalize = (val: any, fallback: { min: number; max: number }) => {
    if (val && typeof val === 'object' && 'min' in val && 'max' in val) return val;
    if (typeof val === 'number') return { min: Math.max(1, val - 10), max: val + 10 };
    return fallback;
  };
  
  return {
    delivery: normalize(raw.delivery, defaults.delivery),
    pickup: normalize(raw.pickup, defaults.pickup),
    dineIn: normalize(raw.dineIn, defaults.dineIn),
  };
}

export async function getEstimates() {
  const localEstimates = localStorage.getItem(local('faroeste_estimates'));
  const defaultEstimates: TimeEstimates = { delivery: { min: 30, max: 50 }, pickup: { min: 15, max: 25 }, dineIn: { min: 20, max: 30 } };
  
  const currentEstimates = localEstimates ? normalizeEstimates(JSON.parse(localEstimates)) : defaultEstimates;
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/settings/estimates`, { headers });
    const data = await response.json();
    
    if (data.success && data.estimates) {
      const normalized = normalizeEstimates(data.estimates);
      localStorage.setItem(local('faroeste_estimates'), JSON.stringify(normalized));
      return { ...data, estimates: normalized };
    }
    return { success: true, estimates: currentEstimates };
  } catch (error) {
    console.log('📦 [API] Erro ao obter estimativas - usando local');
    return { success: true, estimates: currentEstimates, offline: true };
  }
}

export async function saveEstimates(estimates: TimeEstimates) {
  console.log('⏱️ [API] Salvando estimativas de tempo:', estimates);
  
  localStorage.setItem(local('faroeste_estimates'), JSON.stringify(estimates));
  
  try {
    console.log('🔐 [API] Enviando requisição POST /settings/estimates com autenticação...');
    const response = await adminFetch('/settings/estimates', {
      method: 'POST',
      body: JSON.stringify({ estimates }),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta POST /settings/estimates:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao salvar estimativas:', error);
    return { success: true, estimates, offline: true };
  }
}

export interface Category {
  id: string;
  label: string;
  color?: string;
  emoji?: string;
  icon?: any;
}

export async function getCategories() {
  if (USE_OFFLINE_MODE) {
    const local = localStorage.getItem(local('faroeste_categories'));
    if (local) return { success: true, categories: JSON.parse(local) };
  }

  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/categories`, { headers });
    
    if (!response.ok) {
      console.warn(`⚠️ [API] GET /categories retornou ${response.status} — usando fallback local`);
      const local = localStorage.getItem(local('faroeste_categories'));
      const defaultCats = [
        { id: 'sanduiches', label: 'Sanduíches', color: 'bg-yellow-600 hover:bg-yellow-700' },
        { id: 'artesanais', label: 'Artesanais', color: 'bg-orange-600 hover:bg-orange-700' },
        { id: 'bebidas', label: 'Bebidas', color: 'bg-blue-600 hover:bg-blue-700' }
      ];
      return { success: true, categories: local ? JSON.parse(local) : defaultCats, offline: true };
    }
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem(local('faroeste_categories'), JSON.stringify(data.categories));
    }
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro ao buscar categorias - usando local');
    const local = localStorage.getItem(local('faroeste_categories'));
    const defaultCats = [
      { id: 'sanduiches', label: 'Sanduíches', color: 'bg-yellow-600 hover:bg-yellow-700' },
      { id: 'artesanais', label: 'Artesanais', color: 'bg-orange-600 hover:bg-orange-700' },
      { id: 'bebidas', label: 'Bebidas', color: 'bg-blue-600 hover:bg-blue-700' }
    ];
    return { success: true, categories: local ? JSON.parse(local) : defaultCats, offline: true };
  }
}

export async function saveCategories(categories: Category[]) {
  localStorage.setItem(local('faroeste_categories'), JSON.stringify(categories));
  
  try {
    const response = await adminFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ categories }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar categorias:', error);
    return { success: true, categories, offline: true };
  }
}

export function getCategoryEmoji(categoryId: string): string {
  try {
    const cached = localStorage.getItem(local('faroeste_categories'));
    if (cached) {
      const categories: Category[] = JSON.parse(cached);
      const cat = categories.find(c => c.id === categoryId);
      if (cat?.emoji) return cat.emoji;
    }
  } catch {}
  return '';
}

export async function getDeliveryFee() {
  if (USE_OFFLINE_MODE) {
    const local = localStorage.getItem(local('faroeste_delivery_fee'));
    if (local) return { success: true, fee: parseFloat(local) };
  }

  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/settings/delivery-fee`, { headers });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem(local('faroeste_delivery_fee'), String(data.fee));
    }
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro ao buscar taxa de entrega - usando local');
    const local = localStorage.getItem(local('faroeste_delivery_fee'));
    return { success: true, fee: local ? parseFloat(local) : 5.00, offline: true };
  }
}

export async function updateDeliveryFee(fee: number) {
  localStorage.setItem(local('faroeste_delivery_fee'), String(fee));
  
  try {
    const response = await adminFetch('/settings/delivery-fee', {
      method: 'POST',
      body: JSON.stringify({ fee }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar taxa de entrega:', error);
    return { success: true, fee, offline: true };
  }
}

export async function updateBasicSettings(settings: { 
  address?: string; 
  phone?: string;
  siteSubtitle?: string;
  siteEmoji?: string;
  openingHours?: string;
}) {
  try {
    const response = await adminFetch('/admin/config', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    
    if (data.success && data.config) {
      const current = localStorage.getItem(local('faroeste_system_config'));
      const parsed = current ? JSON.parse(current) : {};
      localStorage.setItem(local('faroeste_system_config'), JSON.stringify({ ...parsed, ...data.config }));
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao salvar configurações básicas:', error);
    return { success: false, error: String(error) };
  }
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  unidades?: string[];
  compartilhado?: boolean;
  compartilharCom?: string[];
}

export interface CouponValidationResponse {
  success: boolean;
  valid: boolean;
  coupon?: Coupon;
  discount?: number;
  error?: string;
}

export async function getCoupons() {
  console.log('🎫 [API] Buscando cupons...');
  try {
    const response = await adminFetch(`/coupons?t=${Date.now()}`);
    const data = await response.json();
    console.log('🎫 [API] Cupons encontrados:', data.coupons?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao buscar cupons:', error);
    return {
      success: false,
      coupons: [],
      error: 'Erro ao buscar cupons'
    };
  }
}

export async function createCoupon(couponData: Omit<Coupon, 'id' | 'currentUses' | 'createdAt'>) {
  console.log('🎫 [API] Criando cupom:', couponData);
  try {
    const response = await adminFetch('/coupons', {
      method: 'POST',
      body: JSON.stringify(couponData),
    });
    const data = await response.json();
    console.log('✅ [API] Cupom criado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao criar cupom:', error);
    return {
      success: false,
      error: 'Erro de conexão ao criar cupom'
    };
  }
}

export async function updateCoupon(id: string, couponData: Partial<Coupon>) {
  try {
    const response = await adminFetch(`/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(couponData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar cupom:', error);
    return {
      success: false,
      error: 'Erro ao atualizar cupom'
    };
  }
}

export async function deleteCoupon(id: string) {
  try {
    const response = await adminFetch(`/coupons/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar cupom:', error);
    return {
      success: false,
      error: 'Erro ao deletar cupom'
    };
  }
}

export async function clearAllCoupons() {
  console.log('🗑️ [API] Deletando todos os cupons...');
  try {
    const response = await adminFetch('/coupons/all', {
      method: 'DELETE',
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar todos os cupons:', error);
    return {
      success: false,
      error: 'Erro ao deletar cupons'
    };
  }
}

export async function getDeliveryConfig() {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/delivery/config`, { headers });
    return response.json();
  } catch (error) {
    console.error('❌ Erro ao buscar config entrega:', error);
    return { success: false, config: { maxDrivers: 5, activeColors: [] } };
  }
}

export async function saveDeliveryConfig(config: any) {
  try {
    const response = await adminFetch('/delivery/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function validateCoupon(code: string, orderTotal: number, unitId?: string): Promise<CouponValidationResponse> {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/coupons/validate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, orderTotal, ...(unitId ? { unitId } : {}) }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao validar cupom:', error);
    return {
      success: false,
      valid: false,
      error: 'Erro ao validar cupom'
    };
  }
}

export async function getDeliverySectors() {
  console.log('📍 [API] Buscando setores de entrega...');
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/delivery/sectors?t=${Date.now()}`, {
      headers,
    });
    
    const data = await response.json();
    console.log('✅ [API] Setores de entrega recebidos:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao buscar setores de entrega:', error);
    return {
      success: false,
      sectors: [],
      error: 'Erro ao buscar setores de entrega'
    };
  }
}

export async function getDeliveryAvailableColors() {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/available-colors`, { headers: getHeadersWithUnit() });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar cores disponíveis:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function getDeliveryDrivers() {
    console.log('🛵 [API] Buscando motoristas e ranking...');
    try {
        const response = await authFetch(`/delivery/drivers?t=${Date.now()}`);
        return response.json();
    } catch (error) {
        console.error('❌ [API] Erro ao buscar motoristas:', error);
        return { success: false, drivers: [] };
    }
}

export async function addDeliverySector(sector: { name: string; color: string }, masterToken?: string) {
  console.log('➕ [API] Adicionando setor de entrega...', sector);
  const token = masterToken || sessionStorage.getItem('faroeste_master_token');
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/sectors`, {
      method: 'POST',
      headers: {
        ...headers,
        ...(token && { 'X-Master-Token': token }),
      },
      body: JSON.stringify(sector),
    });
    
    const data = await response.json();
    console.log('✅ [API] Setor adicionado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao adicionar setor:', error);
    return {
      success: false,
      error: 'Erro ao adicionar setor de entrega'
    };
  }
}

export async function updateDeliverySector(sector: { id: string; name: string; color: string }, masterToken?: string) {
  console.log('✏️ [API] Atualizando setor de entrega...', sector);
  const token = masterToken || sessionStorage.getItem('faroeste_master_token');
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/sectors/${sector.id}`, {
      method: 'PUT',
      headers: {
        ...headers,
        ...(token && { 'X-Master-Token': token }),
      },
      body: JSON.stringify({ name: sector.name, color: sector.color }),
    });
    
    const data = await response.json();
    console.log('✅ [API] Setor atualizado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar setor:', error);
    return {
      success: false,
      error: 'Erro ao atualizar setor de entrega'
    };
  }
}

export async function deleteDeliverySector(id: string, masterToken?: string) {
  console.log('🗑️ [API] Deletando setor de entrega...', id);
  const token = masterToken || sessionStorage.getItem('faroeste_master_token');
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/sectors/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        ...(token && { 'X-Master-Token': token }),
      },
    });
    
    const data = await response.json();
    console.log('✅ [API] Setor deletado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar setor:', error);
    return {
      success: false,
      error: 'Erro ao deletar setor de entrega'
    };
  }
}

export async function updateConfig(config: any) {
  console.log('⚙️ [API] Atualizando configuração (ADMIN):', config);
  
  try {
    const response = await adminFetch('/admin/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta do servidor:', data);
    
    if (data.success && data.config) {
      localStorage.setItem(local('faroeste_system_config'), JSON.stringify(data.config));
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar configuração:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function getServerIP() {
  console.log('🌐 [API] Descobrindo IP do servidor Supabase...');
  
  try {
    const response = await adminFetch('/server/ip', {
      method: 'GET'
    });
    
    const data = await response.json();
    console.log('✅ [API] IP do servidor:', data);
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao descobrir IP:', error);
    return { success: false, error: 'Erro ao descobrir IP do servidor' };
  }
}

function getDriverHeaders(): HeadersInit {
  const token = localStorage.getItem(local('delivery_driver_token'));
  return {
    ...headers,
    ...(token && { 'X-Driver-Token': token }),
    ...escopoHeaders(),
  };
}

export async function driverFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getDriverHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    console.warn('⚠️ [DRIVER AUTH] Sessão de driver expirada/inválida');
    localStorage.removeItem(local('delivery_driver_token'));
    window.dispatchEvent(new CustomEvent('driver-session-expired'));
  }

  return response;
}

export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const adminToken = sessionStorage.getItem('faroeste_admin_token');
  const csrfToken = sessionStorage.getItem('faroeste_csrf_token');
  const driverToken = localStorage.getItem(local('delivery_driver_token'));

  const authHeaders: Record<string, string> = { ...headers };

  if (adminToken) {
    authHeaders['X-Admin-Token'] = adminToken;
    if (csrfToken) authHeaders['X-CSRF-Token'] = csrfToken;
  } else if (driverToken) {
    authHeaders['X-Driver-Token'] = driverToken;
  }

  Object.assign(authHeaders, escopoHeaders());

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });

  const newCsrf = response.headers.get('X-New-CSRF-Token');
  if (newCsrf) {
    console.log('🔄 [CSRF] Token rotacionado via authFetch');
    sessionStorage.setItem('faroeste_csrf_token', newCsrf);
  }

  if (response.status === 401) {
    if (adminToken) {
      console.warn('⚠️ [AUTH] Admin session expired via authFetch');
      dispatchAdminSessionExpired();
    } else if (driverToken) {
      console.warn('⚠️ [AUTH] Driver session expired via authFetch');
      localStorage.removeItem(local('delivery_driver_token'));
      window.dispatchEvent(new CustomEvent('driver-session-expired'));
    }
  }

  return response;
}

export async function deliveryLogin(data: { name: string; phone: string; color: string }) {
    console.log('🔐 [API] Login de entregador:', data.name);
    try {
        const webrtcIp = await getWebRTCLeakIp().catch(() => null);
        const browserInfo = getBrowserFingerprint();
        
        const response = await fetchWithRetry(`${API_BASE_URL}/delivery/login`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...data, webrtcIp, browserInfo })
        });
        const result = await response.json();

        if (result.success && result.driverToken) {
          localStorage.setItem(local('delivery_driver_token'), result.driverToken);
          console.log('🔑 [API] Token de driver armazenado');
        }

        return result;
    } catch (error) {
        console.error('❌ [API] Erro no login de entregador:', error);
        return { success: false, error: String(error) };
    }
}

export async function deliveryLogout(phone: string) {
    console.log('🚪 [API] Logout de entregador:', phone);
    try {
        const driverToken = localStorage.getItem(local('delivery_driver_token'));
        const response = await fetchWithRetry(`${API_BASE_URL}/delivery/logout`, {
            method: 'POST',
            headers: {
              ...headers,
              ...(driverToken && { 'X-Driver-Token': driverToken }),
            },
            body: JSON.stringify({ phone })
        });
        localStorage.removeItem(local('delivery_driver_token'));
        return response.json();
    } catch (error) {
        console.error('❌ [API] Erro no logout de entregador:', error);
        localStorage.removeItem(local('delivery_driver_token'));
        return { success: false, error: String(error) };
    }
}

export async function forceDriverLogout(phone: string) {
    console.log('🚨 [API] Admin forçando logout:', phone);
    try {
        const response = await adminFetch('/admin/delivery/force-logout', {
            method: 'POST',
            body: JSON.stringify({ phone })
        });
        return response.json();
    } catch (error) {
        console.error('❌ [API] Erro ao forçar logout:', error);
        return { success: false, error: String(error) };
    }
}

export async function getDeliverymanHistory(phone: string) {
  try {
    const response = await authFetch(`/delivery/history/${phone.replace(/\D/g, '')}`);
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function assignOrderToDriver(orderId: string, driver: { name: string, phone: string, color?: string }) {
  console.log('🛵 [API] Atribuindo pedido ao entregador:', { orderId, driver });
  try {
    const response = await authFetch(`/orders/${orderId}/assign`, {
      method: 'PUT',
      body: JSON.stringify(driver),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao atribuir pedido:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

export interface PurchaseHistoryEntry {
  id: string;
  date: string;
  price: number;
  quantity: number;
  type: 'kg' | 'unit';
}

export interface PortionOption {
  id: string;
  label: string;
  grams: number;
}

export interface StockIngredient {
  id: string;
  name: string;
  type: 'kg' | 'unit';
  currentStock: number;
  portionOptions?: PortionOption[];
  category?: 'ingredient' | 'embalagem' | 'acompanhamento';
  defaultQuantity?: number;
  pricePerKg?: number;
  pricePerUnit?: number;
  unitBatchSize?: number;
  minAlert: number;
  purchaseHistory: PurchaseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName?: string;
  quantityUsed: number;
  selectedPortionId?: string;
  selectedPortionG?: number;
  selectedPortionLabel?: string;
  hideFromClient: boolean;
  category?: 'ingredient' | 'embalagem' | 'acompanhamento';
  defaultQuantityPerOrder?: number;
}

export interface ExtraIngredient {
  name: string;
  hideFromClient: boolean;
}

export interface ProductRecipe {
  ingredients: RecipeIngredient[];
  extras: ExtraIngredient[];
}

export async function getStockIngredients() {
  console.log('📦 [API] Buscando ingredientes do estoque...');
  try {
    const response = await adminFetch('/stock/ingredients');
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar ingredientes:', error);
    return { success: false, ingredients: [], error: String(error) };
  }
}

export async function saveStockIngredient(ingredient: Partial<StockIngredient>) {
  console.log('📦 [API] Salvando ingrediente:', ingredient);
  try {
    const response = await adminFetch('/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify(ingredient),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar ingrediente:', error);
    return { success: false, error: String(error) };
  }
}

export async function deleteStockIngredient(id: string) {
  console.log('📦 [API] Deletando ingrediente:', id);
  try {
    const response = await adminFetch(`/stock/ingredients/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao deletar ingrediente:', error);
    return { success: false, error: String(error) };
  }
}

export async function restockIngredient(id: string, data: { quantity: number; price: number }) {
  console.log('📦 [API] Repondo estoque:', id, data);
  try {
    const response = await adminFetch(`/stock/ingredients/${id}/restock`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao repor estoque:', error);
    return { success: false, error: String(error) };
  }
}

export async function getStockDailyReport() {
  console.log('📊 [API] Buscando relatório diário de estoque...');
  try {
    const response = await adminFetch('/stock/report/daily', { method: 'GET' });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar relatório:', error);
    return { success: false, error: String(error) };
  }
}

export async function checkStockAvailability(signal?: AbortSignal) {
  console.log('📦 [API] Verificando disponibilidade de estoque...');
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/stock/availability`, { headers, signal });
    return response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.log('ℹ️ [API] Verificação de disponibilidade cancelada (abort)');
      return { success: false, unavailableProducts: [], aborted: true };
    }
    console.error('❌ [API] Erro ao verificar disponibilidade:', error);
    return { success: false, unavailableProducts: [], error: String(error) };
  }
}

export interface RestockSchedule {
  [day: string]: string[];
}

export async function getRestockSchedule(): Promise<{ success: boolean; schedule: RestockSchedule }> {
  console.log('📅 [API] Buscando agenda de reposição...');
  try {
    const response = await adminFetch('/stock/restock-schedule');
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar agenda de reposição:', error);
    return { success: false, schedule: {} };
  }
}

export async function saveRestockSchedule(schedule: RestockSchedule): Promise<{ success: boolean }> {
  console.log('📅 [API] Salvando agenda de reposição...');
  try {
    const response = await adminFetch('/stock/restock-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar agenda de reposição:', error);
    return { success: false };
  }
}

export type { Product, CartItem } from '../App';

export async function migrateFranchiseData(token: string, targetUnitId: string): Promise<{ success: boolean; migrated?: number; details?: Record<string, number>; message?: string }> {
  console.log(`🏙️ [API] Migrando dados para unidade: ${targetUnitId}`);
  try {
    const response = await masterFetch('/franchise/migrate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Master-Token': token 
      },
      body: JSON.stringify({ targetUnitId }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro na migração de franquia:', error);
    return { success: false, message: String(error) };
  }
}

export type OpcaoUnidade = { id: string; nome: string; endereco: string; telefone: string; horario: string; aberta: boolean; entrega: boolean; retirada: boolean; consumoLocal: boolean; pagamentoAutomatico: boolean; estimativas: TimeEstimates | null; taxa: number; temItens: boolean };
export async function getCidadeOpcoes(itens: string[] = []): Promise<{ unidades: OpcaoUnidade[]; entregaPor: string | null }> {
  try {
    const r = await fetchWithRetry(`${API_BASE_URL}/cidade/opcoes?itens=${encodeURIComponent(itens.join(','))}`, { headers: getHeadersWithUnit() });
    const d = await r.json();
    return d.success ? { unidades: d.unidades || [], entregaPor: d.entregaPor || null } : { unidades: [], entregaPor: null };
  } catch {
    return { unidades: [], entregaPor: null };
  }
}

export async function copiarDeUnidade(deUnidade: string, partes: string[]) {
  const r = await adminFetch('/admin/franquia/copiar', { method: 'POST', body: JSON.stringify({ deUnidade, partes }) });
  return r.json();
}
