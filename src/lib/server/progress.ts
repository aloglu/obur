// The application's progress instance (achievements).
import { createProgress } from '#lib/server/modules/progress/index.ts';
import { db } from './db/index.ts';

export const progress = createProgress(db);
