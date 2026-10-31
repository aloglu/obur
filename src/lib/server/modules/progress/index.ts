// Public entry of the progress module (achievements). Import only this file, as
// '#lib/server/modules/progress/index.ts'.
export { achievements } from './schema.ts';
export {
	CELEBRATE_DAYS,
	createProgress,
	type Progress,
	type StoredAchievement
} from './service.ts';
