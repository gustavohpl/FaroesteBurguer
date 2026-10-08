import { getVisibleIngredients } from '../ingredientUtils';

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
    toEqual(expected: unknown) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected ${b} but got ${a}`);
      }
    },
    toHaveLength(n: number) {
      if (!Array.isArray(actual) || actual.length !== n) {
        throw new Error(`Expected length ${n} but got ${Array.isArray(actual) ? actual.length : 'not an array'}`);
      }
    },
    toContain(item: unknown) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`Expected array to contain ${JSON.stringify(item)} but got ${JSON.stringify(actual)}`);
      }
    },
    not: {
      toContain(item: unknown) {
        if (Array.isArray(actual) && actual.includes(item)) {
          throw new Error(`Expected array NOT to contain ${JSON.stringify(item)} but it does`);
        }
      },
    },
  };
}

function makeProduct(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'prod_1',
    name: 'Produto Teste',
    price: 10,
    category: 'cat_1',
    ...overrides,
  };
}

test('retorna array vazio se produto não tem recipe nem ingredientsText', () => {
  const result = getVisibleIngredients(makeProduct());
  expect(result).toHaveLength(0);
});

test('retorna ingredientes de ingredientsText quando não há recipe', () => {
  const result = getVisibleIngredients(makeProduct({
    ingredientsText: 'Queijo, Presunto, Tomate',
  }));
  expect(result).toHaveLength(3);
  expect(result).toContain('Queijo');
  expect(result).toContain('Presunto');
  expect(result).toContain('Tomate');
});

test('ignora ingredientsText se recipe existe', () => {
  const result = getVisibleIngredients(makeProduct({
    ingredientsText: 'Queijo, Presunto',
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Mussarela' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Mussarela');
  expect(result).not.toContain('Queijo');
});

test('ingredientsText: filtra entradas vazias', () => {
  const result = getVisibleIngredients(makeProduct({
    ingredientsText: 'Queijo, , Presunto, ,',
  }));
  expect(result).toHaveLength(2);
});

test('retorna ingredientes visíveis da recipe', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Mussarela', quantityUsed: 1 },
        { ingredientId: 'ing2', ingredientName: 'Tomate', quantityUsed: 2 },
      ],
    },
  }));
  expect(result).toHaveLength(2);
  expect(result).toContain('Mussarela');
  expect(result).toContain('2x Tomate');
});

test('hideFromClient=true oculta ingrediente', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Mussarela', hideFromClient: false },
        { ingredientId: 'ing2', ingredientName: 'Tempero Secreto', hideFromClient: true },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Mussarela');
  expect(result).not.toContain('Tempero Secreto');
});

test('usa ingredientId como fallback quando ingredientName está ausente', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'queijo_mussarela' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('queijo_mussarela');
});

test('selectedPortionLabel: mostra porção quando nome e label são diferentes', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Queijo', selectedPortionLabel: '200g Fatia' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Queijo (200g Fatia)');
});

test('selectedPortionLabel: NÃO mostra porção quando label contém nome (bidirecional)', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Queijo Mussarela', selectedPortionLabel: 'Queijo Mussarela 200g' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Queijo Mussarela');
  expect(result).not.toContain('Queijo Mussarela (Queijo Mussarela 200g)');
});

test('selectedPortionLabel: NÃO mostra porção quando nome contém label (bidirecional inverso)', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Peito de Frango', selectedPortionLabel: 'Frango' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Peito de Frango');
  expect(result).not.toContain('Peito de Frango (Frango)');
});

test('selectedPortionLabel: case-insensitive na comparação', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'queijo', selectedPortionLabel: 'QUEIJO 200g' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('queijo');
  expect(result).not.toContain('queijo (QUEIJO 200g)');
});

test('selectedPortionLabel: exibe se nomes são completamente distintos', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Bacon', selectedPortionLabel: 'Pacote 500g' },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Bacon (Pacote 500g)');
});

test('extras visíveis são incluídos', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [],
      extras: [
        { name: 'Catupiry Extra' },
        { name: 'Borda Recheada' },
      ],
    },
  }));
  expect(result).toHaveLength(2);
  expect(result).toContain('Catupiry Extra');
  expect(result).toContain('Borda Recheada');
});

test('extras com hideFromClient=true são ocultados', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [],
      extras: [
        { name: 'Catupiry Extra', hideFromClient: false },
        { name: 'Embalagem Especial', hideFromClient: true },
      ],
    },
  }));
  expect(result).toHaveLength(1);
  expect(result).toContain('Catupiry Extra');
  expect(result).not.toContain('Embalagem Especial');
});

test('extras sem name são ignorados', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [],
      extras: [
        { name: 'Válido' },
        { name: '' },
        {},
      ],
    },
  }));
  expect(result).toHaveLength(1);
});

test('combina ingredientes e extras visíveis', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Mussarela' },
        { ingredientId: 'ing2', ingredientName: 'Presunto' },
      ],
      extras: [
        { name: 'Catupiry' },
      ],
    },
  }));
  expect(result).toHaveLength(3);
  expect(result).toContain('Mussarela');
  expect(result).toContain('Presunto');
  expect(result).toContain('Catupiry');
});

test('quantityUsed=1 não adiciona prefixo', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Tomate', quantityUsed: 1 },
      ],
    },
  }));
  expect(result).toContain('Tomate');
  expect(result).not.toContain('1x Tomate');
});

test('quantityUsed=3 adiciona prefixo 3x', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Ovo', quantityUsed: 3 },
      ],
    },
  }));
  expect(result).toContain('3x Ovo');
});

test('quantityUsed ausente (undefined) não adiciona prefixo', () => {
  const result = getVisibleIngredients(makeProduct({
    recipe: {
      ingredients: [
        { ingredientId: 'ing1', ingredientName: 'Alface' },
      ],
    },
  }));
  expect(result).toContain('Alface');
});

export function runIngredientUtilsTests(): { results: TestResult[]; passed: number; failed: number; total: number } {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { results, passed, failed, total: results.length };
}

export type { TestResult };
