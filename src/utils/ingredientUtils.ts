import type { Product } from './api';

interface RecipeIngredientData {
  ingredientId: string;
  ingredientName?: string;
  quantityUsed?: number;
  selectedPortionLabel?: string;
  hideFromClient?: boolean;
  hidePortionFromClient?: boolean;
  category?: string;
}

interface RecipeExtraData {
  name?: string;
  hideFromClient?: boolean;
}

interface ProductWithRecipe extends Product {
  recipe?: {
    ingredients?: RecipeIngredientData[];
    extras?: RecipeExtraData[];
  };
  ingredientsText?: string;
}

export function getVisibleIngredients(product: Product): string[] {
  const visible: string[] = [];
  const p = product as ProductWithRecipe;

  if (p.recipe?.ingredients) {
    for (const ri of p.recipe.ingredients) {
      if (!ri.hideFromClient) {
        const name = ri.ingredientName || ri.ingredientId;
        const qty = ri.quantityUsed || 1;
        let label = '';
        if (qty > 1) label += `${qty}x `;
        label += name;
        if (ri.selectedPortionLabel && !ri.hidePortionFromClient) {
          const nameNorm = name.trim().toLowerCase();
          const portionNorm = ri.selectedPortionLabel.trim().toLowerCase();
          if (!portionNorm.includes(nameNorm) && !nameNorm.includes(portionNorm)) {
            label += ` (${ri.selectedPortionLabel})`;
          } else {
            const gramsMatch = ri.selectedPortionLabel.match(/(\d+)\s*g/i);
            if (gramsMatch) {
              label += ` (${gramsMatch[1]}g)`;
            }
          }
        }
        visible.push(label);
      }
    }
  }

  if (p.recipe?.extras) {
    for (const ex of p.recipe.extras) {
      if (!ex.hideFromClient && ex.name) {
        visible.push(ex.name);
      }
    }
  }

  if (!p.recipe && p.ingredientsText) {
    visible.push(...p.ingredientsText.split(',').map((s: string) => s.trim()).filter(Boolean));
  }

  return visible;
}
