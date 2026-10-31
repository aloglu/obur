// The application's reminders instance (settings and this device's push subscription).
import { createReminders } from '#lib/server/modules/reminders/index.ts';
import { db } from './db/index.ts';

export const reminders = createReminders(db);
