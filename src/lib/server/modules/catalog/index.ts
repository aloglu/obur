// Public entry of the catalog module (foods, servings, household measures, search). Import only this file,
// as '#lib/server/modules/catalog/index.ts'.
export { foods, foodNutrients, foodServings, recipeIngredients, recipes } from './schema.ts';
export { createRecipes, MAX_INGREDIENTS, type IngredientEdit, type Recipes } from './recipes.ts';
export { CatalogError, createCatalog, type Catalog } from './service.ts';
export { loadCuratedFoods, readCuratedFile, type CuratedFile } from './curated.ts';
export type { FoodDetail, FoodSearchResult } from '../../../shared/food-types.ts';
