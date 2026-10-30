// Validation for diary requests, shared by the interface and the API.
import * as v from 'valibot';
import { isIsoDate, isValidZone } from './diary-rules.ts';
import { MEALS } from './diary-types.ts';

export const DateString = v.pipe(v.string(), v.check(isIsoDate, 'Invalid date'));
export const Zone = v.pipe(v.string(), v.maxLength(64), v.check(isValidZone, 'Invalid time zone'));
const Amount = v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(100_000));
const Kcal = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(20_000));
const Description = v.pipe(
	v.optional(v.nullable(v.string()), null),
	v.transform((s) =>
		s ? s.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200) || null : null
	)
);

export const UnitInput = v.variant('kind', [
	v.object({ kind: v.literal('mass'), unit: v.picklist(['g', 'kg', 'oz', 'lb']) }),
	v.object({
		kind: v.literal('volume'),
		unit: v.picklist(['ml', 'l', 'us_cup', 'metric_cup', 'us_fl_oz', 'imp_fl_oz'])
	}),
	v.object({ kind: v.literal('measure'), code: v.pipe(v.string(), v.maxLength(40)) }),
	v.object({ kind: v.literal('basis_serving') }),
	v.object({ kind: v.literal('serving'), servingId: v.pipe(v.string(), v.uuid()) })
]);

const Context = {
	id: v.optional(v.pipe(v.string(), v.uuid())),
	date: DateString,
	meal: v.picklist(MEALS),
	zone: Zone
};

export const CreateEntry = v.variant('kind', [
	v.object({
		kind: v.literal('food'),
		...Context,
		foodId: v.pipe(v.string(), v.uuid()),
		amount: Amount,
		unit: UnitInput
	}),
	v.object({ kind: v.literal('quick'), ...Context, kcal: Kcal, description: Description })
]);

export const UpdateEntry = v.object({
	revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
	amount: v.optional(Amount),
	unit: v.optional(UnitInput),
	kcal: v.optional(Kcal),
	description: v.optional(Description),
	meal: v.optional(v.picklist(MEALS)),
	date: v.optional(DateString)
});

export type CreateEntry = v.InferOutput<typeof CreateEntry>;
export type UpdateEntry = v.InferOutput<typeof UpdateEntry>;

const Uuid = v.pipe(v.string(), v.uuid());
const Revision = v.pipe(v.number(), v.integer(), v.minValue(1));
export const SavedMealName = v.pipe(
	v.string(),
	v.transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim()),
	v.minLength(1),
	v.maxLength(120)
);

export const CreateSavedMeal = v.object({
	id: v.optional(Uuid),
	name: SavedMealName,
	entryIds: v.pipe(v.array(Uuid), v.minLength(1), v.maxLength(100))
});

export const RenameSavedMeal = v.object({ revision: Revision, name: SavedMealName });
export const RefreshSavedMeal = v.object({ revision: Revision });

export const LogSavedMeal = v.object({
	date: DateString,
	meal: v.picklist(MEALS),
	zone: Zone,
	items: v.pipe(
		v.array(v.object({ itemId: Uuid, entryId: Uuid })),
		v.minLength(1),
		v.maxLength(100)
	)
});
