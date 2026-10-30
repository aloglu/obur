// Public entry of the catalog module (foods, servings, household measures, search). Import only this file,
// as '#lib/server/modules/catalog/index.ts'.
export { foods, foodNutrients, foodServings } from './schema.ts';
export { CatalogError, createCatalog, type Catalog } from './service.ts';
export { loadCuratedFoods, readCuratedFile, type CuratedFile } from './curated.ts';
export type { FoodDetail, FoodSearchResult } from '../../../shared/food-types.ts';
