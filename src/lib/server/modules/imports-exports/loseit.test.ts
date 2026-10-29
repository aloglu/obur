import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
	LoseItError,
	number,
	parseCsv,
	readLoseItArchive,
	readLoseItFiles,
	unitOf,
	usDate
} from './loseit.ts';

const FIXTURE = path.resolve(import.meta.dirname, '../../../../../tests/fixtures/loseit');
const files = Object.fromEntries(
	readdirSync(FIXTURE)
		.filter((f) => f.endsWith('.csv'))
		.map((f) => [f, readFileSync(path.join(FIXTURE, f), 'utf8')])
);
const data = readLoseItFiles(files);
const archive = () =>
	zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

describe('values', () => {
	it('reads US dates and refuses impossible ones', () => {
		expect(usDate('1/5/2026')).toBe('2026-01-05');
		expect(usDate('12/31/2026')).toBe('2026-12-31');
		expect(usDate('2/30/2026')).toBeNull();
		expect(usDate('2026-01-05')).toBeNull();
	});

	it('keeps n/a unknown, zero as zero, and a thousands comma only where allowed', () => {
		expect(number('n/a')).toBeNull();
		expect(number('')).toBeNull();
		expect(number('0.0')).toBe(0);
		expect(number('1,180.0', true)).toBe(1180);
		expect(Number.isNaN(number('1,180.0'))).toBe(true);
		expect(Number.isNaN(number('1,18', true))).toBe(true);
	});

	it('maps grams and millilitres to physical units and keeps other units as named portions', () => {
		expect(unitOf('Grams')).toEqual({ kind: 'mass', unit: 'g' });
		expect(unitOf('Milliliters')).toEqual({ kind: 'volume', unit: 'ml' });
		expect(unitOf('Servings')).toEqual({ kind: 'count', label: 'Serving' });
		expect(unitOf('Each')).toEqual({ kind: 'count', label: 'Each' });
	});

	it('parses quoted fields with commas, quotes and line breaks', () => {
		expect(parseCsv('a,"b, c","d ""e""",\n"f\ng",h\n')).toEqual([
			['a', 'b, c', 'd "e"', ''],
			['f\ng', 'h']
		]);
	});
});

describe('readLoseItFiles', () => {
	it('leaves deleted rows out and keeps legitimate repeats', () => {
		expect(data.deletedEntries).toBe(1);
		expect(data.entries.map((e) => e.name)).not.toContain('Baklava');
		const eggs = data.entries.filter((e) => e.name === 'Haşlanmış yumurta');
		expect(eggs).toHaveLength(2);
		expect(eggs[0].fingerprint).toBe(eggs[1].fingerprint);
		expect(
			data.entries.filter((e) => e.name === 'Mercimek çorbası').map((e) => e.quantity)
		).toEqual([200, 150]);
	});

	it('keeps each row’s own totals, unknown nutrients unknown and carbohydrate unspecified', () => {
		const walnuts = data.entries.find((e) => e.name === 'Walnuts')!;
		expect(walnuts.nutrients).toEqual({ energy_kcal: { value: 78, qualifier: 'reported' } });
		const bread = data.entries.find((e) => e.name === 'Ekmek, tam buğday')!;
		expect(bread.nutrients.fibre).toBeUndefined();
		expect(bread.nutrients.carbohydrate_unspecified).toEqual({ value: 21, qualifier: 'reported' });
		expect(bread.nutrients.carbohydrate_excl_fibre).toBeUndefined();
		const tea = data.entries.find((e) => e.name === 'Çay')!;
		expect(tea.nutrients.energy_kcal?.value).toBe(0);
		expect(
			data.entries.find((e) => e.name === 'Köy "usulü" peynir')?.nutrients.energy_kcal?.value
		).toBe(1180);
	});

	it('maps LoseIt’s extra snack meals to Snacks and keeps the original meal name', () => {
		const apple = data.entries.find((e) => e.name === 'Elma')!;
		expect(apple).toMatchObject({
			meal: 'snacks',
			sourceMeal: 'Morning Snacks',
			date: '2026-01-06'
		});
	});

	it('reconciles: active rows add up to LoseIt’s own daily food totals', () => {
		for (const day of data.days.filter((d) => d.foodKcal > 0)) {
			const sum = data.entries
				.filter((e) => e.date === day.date)
				.reduce((n, e) => n + (e.nutrients.energy_kcal?.value ?? 0), 0);
			expect(Math.abs(sum - day.foodKcal)).toBeLessThan(1);
		}
	});

	it('reads custom foods without merging duplicates by name', () => {
		expect(data.foods.filter((f) => f.name === 'Mercimek çorbası')).toHaveLength(2);
		expect(data.foods.find((f) => f.brand === 'Örnek Süt')).toMatchObject({
			quantity: 250,
			unit: { kind: 'volume', unit: 'ml' }
		});
	});

	it('reads weights, water, activity, budgets, completed days and the profile', () => {
		expect(data.weights.map((w) => w.value)).toEqual([91.39999999999, 91.1]);
		expect(data.water).toEqual([
			{ date: '2026-01-05', ml: 2000 },
			{ date: '2026-01-06', ml: 2500 }
		]);
		expect(data.activity.map((a) => [a.name, a.kcal])).toEqual([
			['Calorie Burn Bonus', 212],
			['Walking', 1050]
		]);
		expect(data.days.map((d) => d.budgetKcal)).toEqual([2150, 2150, 2121, 2121]);
		expect(data.completed).toEqual(['2026-01-05', '2026-01-06']);
		expect(data.profile).toEqual({ birthDate: '1990-04-15', sex: 'male', height: 178 });
	});
});

describe('readLoseItArchive', () => {
	it('reads the archive and ignores files it does not use', () => {
		expect(readLoseItArchive(archive()).entries).toHaveLength(data.entries.length);
	});

	it('stops on anything other than the known layout', () => {
		const changed = {
			...files,
			'food-logs.csv': files['food-logs.csv'].replace('Meal,', 'Meal Name,')
		};
		expect(() => readLoseItFiles(changed)).toThrow(/different columns/);
		const { 'weights.csv': _, ...missing } = files;
		void _;
		expect(() => readLoseItFiles(missing)).toThrow(/missing weights.csv/);
		expect(() => readLoseItArchive(zipSync({ 'notes.txt': strToU8('x') }))).toThrow(LoseItError);
		expect(() => readLoseItArchive(strToU8('not a zip'))).toThrow(/not_loseit/);
		const badMeal = {
			...files,
			'food-logs.csv': files['food-logs.csv'].replace('Breakfast', 'Brunch')
		};
		expect(() => readLoseItFiles(badMeal)).toThrow(/meal "Brunch"/);
	});
});
