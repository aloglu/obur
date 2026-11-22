// A field's own unit choice (setup, owner's pick 2026-11-22): the unit at the end of the field is a button that
// switches it.
export interface UnitChoice {
	/** The units, in order; `value` is one of them. */
	options: { value: string; label: string }[];
	value: string;
	/** The field's name for the choice's spoken label ("Height unit"). */
	name: string;
	onchange: (value: string) => void;
}

/** The other of two units. */
export const otherUnit = (c: UnitChoice): string =>
	c.options.find((o) => o.value !== c.value)?.value ?? c.value;
