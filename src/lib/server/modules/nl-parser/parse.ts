// Typed (and later spoken) logging: text to proposals (docs/design.md, "Typed and voice logging"). Pure: no
// database, no I/O. It recognises English and Turkish numbers, decimal commas, units, meal words and relative days,
// and splits a sentence into tagged proposals. It never decides a food or its nutrients: food proposals carry the
// words to search for, and everything is confirmed by the person before saving.
import type { Meal } from '../../../shared/diary-types.ts';

/** A count word the person used ("3 slices", "bir kutu"); matched to the food's own portions later. */
export type CountWord =
	'slice' | 'can' | 'bottle' | 'glass' | 'container' | 'package' | 'piece' | 'portion' | 'handful';

export type ParsedUnit =
	| { kind: 'g' }
	| { kind: 'ml' }
	/** A count: with the word used, or null for a bare number ("bir muz", "one protein bar"). */
	| { kind: 'count'; word: CountWord | null };

export type Proposal =
	| {
			kind: 'food';
			/** The words naming the food, as typed (spelling preserved). */
			text: string;
			amount: number | null;
			unit: ParsedUnit | null;
			/** "biraz", "some": an amount was meant but not said. */
			vague: boolean;
	  }
	/** Calories only, as stated. */
	| { kind: 'quick'; kcal: number; description: string | null }
	| { kind: 'water'; amount: number | null; unit: ParsedUnit | null }
	| { kind: 'weight'; kg: number }
	| { kind: 'activity'; kcal: number; note: string | null };

export interface ParseResult {
	/** Days before today ("dün" = 1), or null when no day was said. */
	daysAgo: number | null;
	meal: Meal | null;
	items: Proposal[];
}

// Tokens ---------------------------------------------------------------------------------------------------------

interface Token {
	raw: string;
	/** Lowercase without diacritics (Turkish-aware): "Kahvaltıda" → "kahvaltida". */
	f: string;
	/** A number, once number phrases are read. */
	n?: number;
	/** Set on "biraz", "some". */
	vague?: boolean;
	sep?: boolean;
}

export function fold(word: string): string {
	return word.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(text: string): Token[] {
	const out: Token[] = [];
	// Numbers with a decimal comma or dot, words (letters and digits), commas and "+" as separators. Apostrophes split
	// a suffix off ("Lunch'ta" → "Lunch", "ta"); "200g" becomes "200", "g".
	for (const m of text.normalize('NFC').matchAll(/\d+(?:[.,]\d+)?|%|[\p{L}]+|[,+;]/gu)) {
		const raw = m[0];
		out.push(
			raw === ',' || raw === '+' || raw === ';' ? { raw, f: raw, sep: true } : { raw, f: fold(raw) }
		);
	}
	return out;
}

// Numbers --------------------------------------------------------------------------------------------------------

const UNITS_TR: Record<string, number> = {
	bir: 1,
	iki: 2,
	uc: 3,
	dort: 4,
	bes: 5,
	alti: 6,
	yedi: 7,
	sekiz: 8,
	dokuz: 9
};
const TENS_TR: Record<string, number> = {
	on: 10,
	yirmi: 20,
	otuz: 30,
	kirk: 40,
	elli: 50,
	altmis: 60,
	yetmis: 70,
	seksen: 80,
	doksan: 90
};
const SMALL_EN: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19
};
const TENS_EN: Record<string, number> = {
	twenty: 20,
	thirty: 30,
	forty: 40,
	fifty: 50,
	sixty: 60,
	seventy: 70,
	eighty: 80,
	ninety: 90
};

/** True for a word that could follow a number as its unit. */
const isUnitWord = (f: string) => unitOf(f) !== null;

/**
 * Replaces number phrases with single number tokens: "iki yüz elli" → 250, "two and a half" → 2.5, "yarım" → 0.5,
 * "bir buçuk" → 1.5, "82,4" → 82.4, "yüzde on" → "%10". "a"/"an"/"bir" alone count as one.
 */
function readNumbers(tokens: Token[]): Token[] {
	const out: Token[] = [];
	let i = 0;
	const at = (k: number) => tokens[k]?.f;
	while (i < tokens.length) {
		const t = tokens[i];
		// Percentages stay part of a food's name: "yüzde on yağlı", "10 percent fat", "%10".
		if ((t.f === 'yuzde' || t.f === '%') && tokens[i + 1]) {
			const [value, used] = wordNumber(tokens, i + 1, true);
			if (value !== null) {
				out.push({ raw: `%${value}`, f: `%${value}` });
				i += 1 + used;
				continue;
			}
		}
		if (/^\d/.test(t.f)) {
			let value = Number(t.f.replace(',', '.'));
			let used = 1;
			if (at(i + 1) === 'percent') {
				out.push({ raw: `%${value}`, f: `%${value}` });
				i += 2;
				continue;
			}
			[value, used] = halves(tokens, i + used, value, used);
			out.push({ ...t, n: value });
			i += used;
			continue;
		}
		if (t.f === 'yarim' || t.f === 'half' || t.f === 'ceyrek' || t.f === 'quarter') {
			// "half a container", "yarım kutu", "çeyrek iceberg", "a quarter of"
			const value = t.f === 'ceyrek' || t.f === 'quarter' ? 0.25 : 0.5;
			let skip = 1;
			if (/^(half|quarter)$/.test(t.f) && (at(i + 1) === 'a' || at(i + 1) === 'an')) skip = 2;
			out.push({ raw: t.raw, f: t.f, n: value });
			i += skip;
			continue;
		}
		if ((t.f === 'a' || t.f === 'an') && at(i + 1) === 'quarter') {
			out.push({ raw: 'a quarter', f: 'quarter', n: 0.25 });
			i += 2;
			continue;
		}
		if ((t.f === 'a' || t.f === 'an') && at(i + 1) === 'half') {
			out.push({ raw: 'a half', f: 'half', n: 0.5 });
			i += 2;
			continue;
		}
		if (t.f === 'biraz' || t.f === 'some') {
			out.push({ ...t, vague: true });
			i += 1;
			continue;
		}
		if ((t.f === 'a' && at(i + 1) === 'little') || (t.f === 'a' && at(i + 1) === 'bit')) {
			out.push({ raw: 'a little', f: 'biraz', vague: true });
			i += 2;
			continue;
		}
		const [value, used] = wordNumber(tokens, i);
		if (value !== null) {
			const [withHalf, total] = halves(tokens, i + used, value, used);
			out.push({
				raw: tokens
					.slice(i, i + total)
					.map((x) => x.raw)
					.join(' '),
				f: t.f,
				n: withHalf
			});
			i += total;
			continue;
		}
		out.push(t);
		i += 1;
	}
	return out;
}

/** "buçuk" or "and a half" after a number. */
function halves(tokens: Token[], k: number, value: number, used: number): [number, number] {
	if (tokens[k]?.f === 'bucuk') return [value + 0.5, used + 1];
	if (tokens[k]?.f === 'and' && tokens[k + 1]?.f === 'a' && tokens[k + 2]?.f === 'half')
		return [value + 0.5, used + 3];
	return [value, used];
}

/**
 * A number written in words starting at k, and how many tokens it used. Turkish "on" (ten) is read only where it
 * cannot be the English preposition: after "yüzde", inside a number, or before a unit or another number word.
 */
function wordNumber(tokens: Token[], k: number, afterPercent = false): [number | null, number] {
	const f = (j: number) => tokens[j]?.f ?? '';
	if (/^\d/.test(f(k))) return [Number(f(k).replace(',', '.')), 1];
	let total = 0;
	let current = 0;
	let j = k;
	let any = false;
	for (;;) {
		const w = f(j);
		if (w === 'on' && !(afterPercent || any || isUnitWord(f(j + 1)) || f(j + 1) in UNITS_TR)) break;
		if (w in UNITS_TR && !(w === 'bir' && any)) current += UNITS_TR[w];
		else if (w in TENS_TR) current += TENS_TR[w];
		else if (w in SMALL_EN) current += SMALL_EN[w];
		else if (w in TENS_EN) current += TENS_EN[w];
		else if (w === 'yuz' || w === 'hundred') current = (current || 1) * 100;
		else if (w === 'bin' || w === 'thousand') {
			total += (current || 1) * 1000;
			current = 0;
		} else if ((w === 'a' || w === 'an') && !any) current += 1;
		else if (w === 'and' && any && (f(j + 1) in SMALL_EN || f(j + 1) in TENS_EN)) {
			j += 1;
			continue;
		} else break;
		any = true;
		j += 1;
	}
	return any ? [total + current, j - k] : [null, 0];
}

// Units ----------------------------------------------------------------------------------------------------------

type UnitHit =
	| { kind: 'g'; factor: number }
	| { kind: 'ml'; factor: number }
	| { kind: 'kcal' }
	| { kind: 'count'; word: CountWord | null };

/** The unit a word stands for, allowing Turkish suffixes ("gramlık", "kalorilik", "dilim"). */
function unitOf(f: string): UnitHit | null {
	if (/^(g|gr|grs|gram|grams|gramme|grammes|gramlik)$/.test(f)) return { kind: 'g', factor: 1 };
	if (/^(kg|kgs|kilogram|kilograms|kilogramlik)$/.test(f)) return { kind: 'g', factor: 1000 };
	if (/^(ml|mililitre|mililitrelik|millilitre|millilitres|milliliter|milliliters)$/.test(f))
		return { kind: 'ml', factor: 1 };
	if (/^(l|lt|litre|litres|liter|liters|litrelik)$/.test(f)) return { kind: 'ml', factor: 1000 };
	if (/^(kcal|cal|cals|calorie|calories|kalori|kalorilik|kaloriyi|kaloriye)$/.test(f))
		return { kind: 'kcal' };
	if (/^(dilim|dilimi|slice|slices)$/.test(f)) return { kind: 'count', word: 'slice' };
	if (/^(kutu|kutusu|can|cans)$/.test(f)) return { kind: 'count', word: 'can' };
	if (/^(sise|sisesi|bottle|bottles)$/.test(f)) return { kind: 'count', word: 'bottle' };
	if (/^(bardak|bardagi|glass|glasses)$/.test(f)) return { kind: 'count', word: 'glass' };
	if (/^(container|containers|kap|kase|tub|pot)$/.test(f))
		return { kind: 'count', word: 'container' };
	if (/^(paket|paketi|package|packages|pack|packet)$/.test(f))
		return { kind: 'count', word: 'package' };
	if (/^(tane|adet|piece|pieces|parca)$/.test(f)) return { kind: 'count', word: 'piece' };
	if (/^(porsiyon|portion|portions|serving|servings|tabak|plate|plates)$/.test(f))
		return { kind: 'count', word: 'portion' };
	if (/^(avuc|avucu|handful|handfuls)$/.test(f)) return { kind: 'count', word: 'handful' };
	return null;
}

// Context: day and meal ------------------------------------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
	pazartesi: 1,
	monday: 1,
	sali: 2,
	tuesday: 2,
	carsamba: 3,
	wednesday: 3,
	persembe: 4,
	thursday: 4,
	cuma: 5,
	friday: 5,
	cumartesi: 6,
	saturday: 6,
	pazar: 7,
	sunday: 7
};

/** Words that only connect: dropped from a food's name. */
const FILLERS = new Set(
	[
		'yedim yedik yemistim yiyorum ictim ictik icdim icmistim aldim ekle ekleyin kaydet olarak',
		'yaninda ile lutfen ta te da de',
		'i ate eat eaten had have drank drink drunk log add put record please my me to of the for at as with in',
		'this that some',
		'tukettim tukettik tuketti yedin yaptim yaptik doktum kendime icin',
		// placeholders: "bir şey", "something"
		'sey seyler something thing stuff'
	]
		.join(' ')
		.split(' ')
);

interface Context {
	daysAgo: number | null;
	meal: Meal | null;
}

/** Removes day and meal phrases from the tokens and returns what they said. */
function readContext(tokens: Token[], today: number): { rest: Token[]; ctx: Context } {
	const ctx: Context = { daysAgo: null, meal: null };
	const rest: Token[] = [];
	const f = (j: number) => tokens[j]?.f ?? '';
	// "sabah" only suggests breakfast: it never replaces a meal already said, and a meal said later replaces it.
	const setMeal = (meal: Meal, weak = false) => {
		if (!(weak && ctx.meal)) ctx.meal = meal;
	};
	let i = 0;
	while (i < tokens.length) {
		const w = f(i);
		const n = tokens[i].n;
		// Days.
		if ((w === 'onceki' || w === 'evvelsi') && f(i + 1).startsWith('gun')) {
			ctx.daysAgo = 2;
			i += 2;
			continue;
		}
		if (w === 'the' && f(i + 1) === 'day' && f(i + 2) === 'before' && f(i + 3) === 'yesterday') {
			ctx.daysAgo = 2;
			i += 4;
			continue;
		}
		if (w === 'day' && f(i + 1) === 'before' && f(i + 2) === 'yesterday') {
			ctx.daysAgo = 2;
			i += 3;
			continue;
		}
		if (n !== undefined && f(i + 1).startsWith('gun') && f(i + 2) === 'once') {
			ctx.daysAgo = n;
			i += 3;
			continue;
		}
		if (n !== undefined && /^days?$/.test(f(i + 1)) && f(i + 2) === 'ago') {
			ctx.daysAgo = n;
			i += 3;
			continue;
		}
		if (/^dun(ku)?$/.test(w) || w === 'yesterday') {
			ctx.daysAgo = 1;
			i += 1;
			continue;
		}
		if (w === 'bu' && /^gun(ku)?$/.test(f(i + 1))) {
			ctx.daysAgo = 0; // "bu gün", as speech sometimes writes "bugün"
			i += 2;
			continue;
		}
		if (/^bugun(ku)?$/.test(w) || w === 'today') {
			ctx.daysAgo = 0;
			i += 1;
			continue;
		}
		if (
			(w === 'gecen' || w === 'last') &&
			f(i + 1).replace(/(gunu|ya|ye|yi|da|de)$/, '') in WEEKDAYS
		) {
			const day = WEEKDAYS[f(i + 1).replace(/(gunu|ya|ye|yi|da|de)$/, '')];
			ctx.daysAgo = (today - day + 7) % 7 || 7;
			i += f(i + 2) === 'gunu' ? 3 : 2;
			continue;
		}
		// "bu akşam", "bu öğlen", "this morning": today and that meal.
		if (w === 'this' || w === 'bu') {
			const meal = mealAt(tokens, i + 1);
			if (meal) {
				ctx.daysAgo ??= 0;
				setMeal(meal.meal);
				i += 1 + meal.used;
				continue;
			}
		}
		// "az önce", "demin", "just now": today.
		if ((w === 'az' && f(i + 1) === 'once') || (w === 'just' && f(i + 1) === 'now')) {
			ctx.daysAgo ??= 0;
			i += 2;
			continue;
		}
		if (w === 'demin' || (w === 'biraz' && f(i + 1) === 'once')) {
			ctx.daysAgo ??= 0;
			i += w === 'demin' ? 1 : 2;
			continue;
		}
		// "iki akşam önce": two days ago, at dinner.
		if (n !== undefined && f(i + 2) === 'once') {
			const meal = mealAt(tokens, i + 1);
			if (meal && meal.used === 1) {
				ctx.daysAgo = n;
				setMeal(meal.meal);
				i += 3;
				continue;
			}
		}
		// Meals ("akşam yemeğinde", "öğle yemeği", "Lunch'ta", "as a snack", "ara öğün olarak").
		const meal = mealAt(tokens, i);
		if (meal) {
			setMeal(meal.meal, meal.weak);
			i += meal.used;
			// "lunch'ta", "dinner'da": the suffix after the apostrophe.
			while (/^(ta|te|da|de|nda|nde)$/.test(f(i))) i += 1;
			continue;
		}
		rest.push(tokens[i]);
		i += 1;
	}
	return { rest, ctx };
}

function mealAt(tokens: Token[], i: number): { meal: Meal; used: number; weak?: boolean } | null {
	const f = (j: number) => tokens[j]?.f ?? '';
	const w = f(i);
	const withYemek = (meal: Meal) => ({ meal, used: f(i + 1).startsWith('yemeg') ? 2 : 1 });
	if (w.startsWith('kahvalti') || w === 'breakfast') return { meal: 'breakfast', used: 1 };
	if (/^ogle(n|nde|de|yin|ye)?$/.test(w))
		return /^arasi(nda)?$/.test(f(i + 1)) ? { meal: 'lunch', used: 2 } : withYemek('lunch');
	if (w === 'lunch') return { meal: 'lunch', used: 1 };
	if (/^aksam(i|lari|ki|da)?$/.test(w)) return withYemek('dinner');
	if (w === 'dinner' || w === 'supper' || w === 'tonight' || w === 'evening')
		return { meal: 'dinner', used: 1 };
	// "sabah" alone is a hint for breakfast, which a stated meal overrides.
	if (/^sabah(leyin|ki)?$/.test(w) || w === 'morning')
		return { meal: 'breakfast', used: 1, weak: true };
	if (w === 'ara' && f(i + 1).startsWith('ogun')) return { meal: 'snacks', used: 2 };
	if (w.startsWith('atistirmalik') || /^snacks?$/.test(w)) return { meal: 'snacks', used: 1 };
	// Late eating goes to Snacks: "gece", "son öğün olarak", "yatmadan önce".
	if (w === 'son' && f(i + 1).startsWith('ogun')) return { meal: 'snacks', used: 2 };
	if (w === 'yatmadan' && f(i + 1) === 'once') return { meal: 'snacks', used: 2 };
	if (/^gece(leyin)?$/.test(w)) return { meal: 'snacks', used: 1, weak: true };
	return null;
}

// Intents --------------------------------------------------------------------------------------------------------

const WEIGHT_WORD =
	/^(kilo(ydum|yum|dum|yduk|m|mu|yu)|tartildim|weighed|weigh|weight|weighing|tarti(da|ya)?)$/;
const BURN_WORD = /^(yaktim|yaktik|yakmisim|burned|burnt|burn|burning)$/;
const WATER_WORDS = new Set(['su', 'suyu', 'water']);

const words = (tokens: Token[]) =>
	tokens
		.filter((t) => t.n === undefined && !t.sep && !t.vague && !FILLERS.has(t.f))
		.map((t) => t.raw)
		.join(' ')
		.trim();

/**
 * Splits a list of items. A comma splits only before a new quantity (so "bar, caramel flavour" stays one); a joining
 * word ("ve", "and", "artı", "üzerine") also splits when there are words on both sides ("makarna ve üzerine mayonez").
 */
function splitItems(tokens: Token[]): Token[][] {
	const JOIN = /^(ve|and|yaninda|yanimda|plus|arti|uzerine|also|ayrica)$/;
	const isSep = (t: Token) => t.sep || JOIN.test(t.f);
	const named = (t: Token) =>
		t.n === undefined && !t.sep && !t.vague && !FILLERS.has(t.f) && !JOIN.test(t.f);
	const parts: Token[][] = [[]];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (isSep(t)) {
			// "ve üzerine": a joining word at the start of an item adds nothing.
			if (!parts.at(-1)!.length) continue;
			let j = i + 1;
			while (tokens[j] && (isSep(tokens[j]) || FILLERS.has(tokens[j].f))) j += 1;
			const next = tokens[j];
			const startsQuantity = next && (next.n !== undefined || next.vague || isUnitWord(next.f));
			const following = tokens.slice(j);
			const end = following.findIndex(isSep);
			const namesNext = (end < 0 ? following : following.slice(0, end)).some(named);
			const joins = !t.sep && namesNext && parts.at(-1)!.some(named);
			if ((startsQuantity || joins) && parts.at(-1)!.length) {
				parts.push([]);
				continue;
			}
			if (t.sep) continue; // a comma inside one item
		}
		parts.at(-1)!.push(t);
	}
	return parts.filter((p) => p.length);
}

function readItem(tokens: Token[]): Proposal | null {
	const numberAt = tokens.findIndex((t) => t.n !== undefined);
	const vague = tokens.some((t) => t.vague);
	let amount = numberAt >= 0 ? tokens[numberAt].n! : null;
	let unit: UnitHit | null = null;
	const used = new Set<number>();
	if (numberAt >= 0) {
		used.add(numberAt);
		let k = numberAt + 1;
		if (tokens[k]?.f === 'of') k += 1;
		const hit = tokens[k] && unitOf(tokens[k].f);
		if (hit) {
			unit = hit;
			used.add(k);
		}
	} else {
		// A unit with no number counts one: "kutu kola", "glass of water".
		const k = tokens.findIndex((t) => unitOf(t.f)?.kind === 'count');
		if (k >= 0 && !vague) {
			unit = unitOf(tokens[k].f);
			amount = 1;
			used.add(k);
		}
	}
	const rest = tokens.filter((_, k) => !used.has(k));
	const text = words(rest);
	const amountFor = (u: UnitHit | null) =>
		amount === null ? null : u && (u.kind === 'g' || u.kind === 'ml') ? amount * u.factor : amount;
	const parsedUnit = (u: UnitHit | null): ParsedUnit | null =>
		!u || u.kind === 'kcal'
			? amount === null
				? null
				: { kind: 'count', word: null }
			: u.kind === 'count'
				? { kind: 'count', word: u.word }
				: { kind: u.kind };

	if (unit?.kind === 'kcal' && amount !== null)
		return { kind: 'quick', kcal: amount, description: text || null };
	const foodWords = text.split(' ').map(fold).filter(Boolean);
	if (foodWords.length && foodWords.every((w) => WATER_WORDS.has(w)))
		return { kind: 'water', amount: amountFor(unit), unit: parsedUnit(unit) };
	if (!text && amount === null) return null;
	// A quantity with no food words ("…, 200 gram") is attached to the item before it by parseEntry.
	return { kind: 'food', text, amount: amountFor(unit), unit: parsedUnit(unit), vague };
}

/**
 * Parses one typed or spoken sentence. `todayWeekday` is today's ISO weekday (1 = Monday) in the person's zone, for
 * "geçen salı" / "last Tuesday".
 */
export function parseEntry(text: string, todayWeekday: number): ParseResult {
	const { rest, ctx } = readContext(readNumbers(tokenize(text)), todayWeekday);
	const empty: ParseResult = { ...ctx, items: [] };
	if (!rest.length) return empty;

	// A weigh-in: "bugün 82,4 kiloydum", "120 kilo geldim", "I weighed 82.4 kilos".
	const weighIn = rest.some(
		(t, k) =>
			WEIGHT_WORD.test(t.f) ||
			(/^(kilo|kg|kilogram)$/.test(t.f) &&
				/^(geldim|ciktim|oldum|gosterdi|cikti|geliyorum|cikiyorum)$/.test(rest[k + 1]?.f ?? '')) ||
			(t.f === 'tarti' && /^(gosterdi|dedi)$/.test(rest.at(-1)?.f ?? ''))
	);
	if (weighIn) {
		const value = rest.find((t) => t.n !== undefined)?.n;
		return value === undefined ? empty : { ...ctx, items: [{ kind: 'weight', kg: value }] };
	}
	// Activity: "450 kalori yaktım", "I burned 450 calories walking".
	if (rest.some((t) => BURN_WORD.test(t.f))) {
		const value = rest.find((t) => t.n !== undefined)?.n;
		const note = words(rest.filter((t) => !BURN_WORD.test(t.f) && !unitOf(t.f)));
		return value === undefined
			? empty
			: { ...ctx, items: [{ kind: 'activity', kcal: value, note: note || null }] };
	}
	const items: Proposal[] = [];
	for (const p of splitItems(rest).map(readItem)) {
		if (!p) continue;
		if (p.kind === 'food' && !p.text) {
			// "…yedim, 200 gram": the amount said after the food.
			const before = items.at(-1);
			if (before?.kind === 'food' && before.amount === null) {
				before.amount = p.amount;
				before.unit = p.unit;
				before.vague = false;
			}
			continue;
		}
		items.push(p);
	}
	return { ...ctx, items };
}
