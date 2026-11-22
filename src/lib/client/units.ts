// The signed-in person's units, from the settings every page carries (shared/preferences.ts).
import { page } from '$app/state';
import type { LengthUnit, WaterUnit } from '#lib/shared/body-units.ts';

export { weightUnit } from './weight-unit.ts';
export const lengthUnit = (): LengthUnit => page.data.preferences?.lengthUnit ?? 'cm';
export const waterUnit = (): WaterUnit => page.data.preferences?.waterUnit ?? 'ml';
