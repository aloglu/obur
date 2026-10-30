// Public entry of the diary module (entries, snapshots, trash). Import only this file,
// as '#lib/server/modules/diary/index.ts'.
export {
	dayCompletions,
	diaryEntries,
	purgedRecords,
	savedMealItems,
	savedMeals
} from './schema.ts';
export {
	createSavedMeals,
	MAX_ITEMS as SAVED_MEAL_MAX_ITEMS,
	type SavedMeals
} from './saved-meals.ts';
export {
	createDiary,
	DiaryError,
	resolveUnit,
	snapshotOf,
	type Diary,
	type EntryContext,
	type Measure,
	type UnitInput
} from './service.ts';
