// Settings' Units row: "Metric" or "Imperial" when every unit agrees, otherwise each unit ("lb · cm · ml").
import { m } from '#lib/paraglide/messages.js';
import { DEFAULT_PREFERENCES, type Preferences } from '#lib/shared/preferences.ts';
import { waterSymbol } from '#lib/shared/body-units.ts';

type Units = Pick<Preferences, 'weightUnit' | 'lengthUnit' | 'waterUnit'>;

export function unitsSummary(p: Units | undefined): string {
	const { weightUnit, lengthUnit, waterUnit } = p ?? DEFAULT_PREFERENCES;
	if (weightUnit === 'kg' && lengthUnit === 'cm' && waterUnit === 'ml') return m.units_metric();
	if (weightUnit === 'lb' && lengthUnit === 'in' && waterUnit === 'floz') return m.units_imperial();
	return unitsList({ weightUnit, lengthUnit, waterUnit });
}

/** Each unit: "kg · cm · ml", "lb · ft, in · fl oz". */
export function unitsList(p: Units): string {
	return [p.weightUnit, p.lengthUnit === 'in' ? 'ft, in' : 'cm', waterSymbol(p.waterUnit)].join(
		' · '
	);
}
