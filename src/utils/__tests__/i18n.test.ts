import { t, setLocale, getLocale, getAvailableLocales, subscribe } from '../i18n';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (e: unknown) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toContain(item: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
      } else if (typeof actual === 'string') {
        if (!actual.includes(item as string)) throw new Error(`Expected "${actual}" to contain "${item}"`);
      }
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n) {
        throw new Error(`Expected ${actual} to be > ${n}`);
      }
    },
  };
}

setLocale('pt-BR');

test('locale padrão é pt-BR', () => {
  expect(getLocale()).toBe('pt-BR');
});

test('availableLocales contém pt-BR e en-US', () => {
  const locales = getAvailableLocales();
  expect(locales).toContain('pt-BR');
  expect(locales).toContain('en-US');
});

test('t(): retorna string pt-BR para chave válida', () => {
  setLocale('pt-BR');
  expect(t('common.loading')).toBe('Carregando...');
});

test('t(): retorna string pt-BR para nav.home', () => {
  setLocale('pt-BR');
  expect(t('nav.home')).toBe('Início');
});

test('t(): retorna string pt-BR para products.addToCart', () => {
  setLocale('pt-BR');
  expect(t('products.addToCart')).toBe('Adicionar');
});

test('t(): retorna string pt-BR para cart.empty', () => {
  setLocale('pt-BR');
  expect(t('cart.empty')).toBe('Seu carrinho está vazio');
});

test('t(): retorna string pt-BR para orders.pending', () => {
  setLocale('pt-BR');
  expect(t('orders.pending')).toBe('Pendente');
});

test('t(): retorna string en-US após setLocale', () => {
  setLocale('en-US');
  expect(t('common.loading')).toBe('Loading...');
});

test('t(): retorna string en-US para nav.home', () => {
  setLocale('en-US');
  expect(t('nav.home')).toBe('Home');
});

test('t(): retorna string en-US para products.addToCart', () => {
  setLocale('en-US');
  expect(t('products.addToCart')).toBe('Add');
});

test('t(): retorna string en-US para cart.empty', () => {
  setLocale('en-US');
  expect(t('cart.empty')).toBe('Your cart is empty');
});

test('t(): retorna string en-US para orders.pending', () => {
  setLocale('en-US');
  expect(t('orders.pending')).toBe('Pending');
});

test('t(): interpolação com {minutes} em pt-BR', () => {
  setLocale('pt-BR');
  const result = t('auth.tooManyAttempts', { minutes: 5 });
  expect(result).toBe('Muitas tentativas. Tente novamente em 5 minutos.');
});

test('t(): interpolação com {minutes} em en-US', () => {
  setLocale('en-US');
  const result = t('auth.tooManyAttempts', { minutes: 10 });
  expect(result).toBe('Too many attempts. Try again in 10 minutes.');
});

test('t(): interpolação com {qty} em pt-BR', () => {
  setLocale('pt-BR');
  const result = t('products.addToCartWithQty', { qty: 3 });
  expect(result).toBe('Adicionar (3)');
});

test('t(): interpolação com {qty} em en-US', () => {
  setLocale('en-US');
  const result = t('products.addToCartWithQty', { qty: 7 });
  expect(result).toBe('Add (7)');
});

test('t(): retorna a própria key se não encontrada', () => {
  setLocale('pt-BR');
  expect(t('nonexistent.key')).toBe('nonexistent.key');
});

test('t(): retorna a key se categoria não existe', () => {
  setLocale('pt-BR');
  expect(t('fantasy.something.deep')).toBe('fantasy.something.deep');
});

test('t(): retorna a key para chave parcialmente válida (nó não-terminal)', () => {
  setLocale('pt-BR');
  expect(t('common')).toBe('common');
});

test('setLocale() muda o locale efetivamente', () => {
  setLocale('en-US');
  expect(getLocale()).toBe('en-US');
  expect(t('common.save')).toBe('Save');

  setLocale('pt-BR');
  expect(getLocale()).toBe('pt-BR');
  expect(t('common.save')).toBe('Salvar');
});

test('setLocale() com locale inválido não muda nada', () => {
  setLocale('pt-BR');
  setLocale('xx-YY' as any);
  expect(getLocale()).toBe('pt-BR');
});

test('subscribe() é chamado quando locale muda', () => {
  setLocale('pt-BR');
  let callCount = 0;
  const unsub = subscribe(() => { callCount++; });

  setLocale('en-US');
  expect(callCount).toBe(1);

  setLocale('pt-BR');
  expect(callCount).toBe(2);

  unsub();
  setLocale('en-US');
  expect(callCount).toBe(2);
});

test('seção security existe em pt-BR', () => {
  setLocale('pt-BR');
  expect(t('security.auditLogs')).toBe('Logs de Auditoria');
});

test('seção security existe em en-US', () => {
  setLocale('en-US');
  expect(t('security.auditLogs')).toBe('Audit Logs');
});

test('seção tests existe em pt-BR', () => {
  setLocale('pt-BR');
  expect(t('tests.run')).toBe('Executar Testes');
});

test('seção store existe em en-US', () => {
  setLocale('en-US');
  expect(t('store.closed')).toBe('Store Closed');
});

test('seção time existe em pt-BR', () => {
  setLocale('pt-BR');
  expect(t('time.justNow')).toBe('agora mesmo');
});

test('seção checkout existe em en-US', () => {
  setLocale('en-US');
  expect(t('checkout.placeOrder')).toBe('Place Order');
});

setLocale('pt-BR');

export function runI18nTests(): { results: TestResult[]; passed: number; failed: number; total: number } {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { results, passed, failed, total: results.length };
}

export type { TestResult };
