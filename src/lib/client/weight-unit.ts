// The signed-in person's weight unit, from the settings every page carries (shared/preferences.ts).
import { page } from '$app/state';
import type { WeightUnit } from '#lib/shared/weight-unit.ts';

export const weightUnit = (): WeightUnit => page.data.preferences?.weightUnit ?? 'kg';
