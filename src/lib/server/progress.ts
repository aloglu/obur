// The application's progress instance (achievements).
import { createProgress } from '#lib/server/modules/progress/index.ts';
import { db } from './db/index.ts';

export const progress = createProgress(db);

type Sync = ReturnType<typeof progress.sync>;
const synced = new WeakMap<App.Locals, Sync>();

/**
 * Achievements brought up to date once for a request: the layout and Progress, Journal or Achievements each need
 * them, and each worked them out again over the whole history (2026-11-25 Review.md audit, 3.2).
 */
export function syncOnce(locals: App.Locals, userId: string, today: string, zone: string): Sync {
	let sync = synced.get(locals);
	if (!sync) synced.set(locals, (sync = progress.sync(userId, today, zone)));
	return sync;
}
