// Development sentences for the parser, written for it (not anyone's recordings): English, Turkish and mixed, with
// decimal commas, relative days, half quantities, several items, vague amounts and the other intents. Each case is the
// complete expected result; a case passes only when everything matches. Held-out evaluation uses separate data.
import type { CountWord, ParseResult } from './parse.ts';

/** Fixtures assume today is a Friday (ISO weekday 5). */
export const TODAY_WEEKDAY = 5;

const food = (
	text: string,
	amount: number | null,
	unit: ParseResultItemUnit,
	vague = false
): ParseResult['items'][number] => ({ kind: 'food', text, amount, unit, vague });
type ParseResultItemUnit = Extract<ParseResult['items'][number], { kind: 'food' }>['unit'];
const g = { kind: 'g' } as const;
const ml = { kind: 'ml' } as const;
const count = (word: CountWord | null) => ({ kind: 'count', word }) as const;

export const DEV_CASES: [string, ParseResult][] = [
	// Turkish
	[
		'Kahvaltıda iki dilim tam buğday ekmeği yedim',
		{ daysAgo: null, meal: 'breakfast', items: [food('tam buğday ekmeği', 2, count('slice'))] }
	],
	[
		'Öğlen 150 gram ızgara köfte yedim.',
		{ daysAgo: null, meal: 'lunch', items: [food('ızgara köfte', 150, g)] }
	],
	[
		'Akşam yemeğinde 300 gr mercimek çorbası içtim',
		{ daysAgo: null, meal: 'dinner', items: [food('mercimek çorbası', 300, g)] }
	],
	[
		'Bir şişe ayran içtim',
		{ daysAgo: null, meal: null, items: [food('ayran', 1, count('bottle'))] }
	],
	[
		'Ara öğün olarak bir elma yedim',
		{ daysAgo: null, meal: 'snacks', items: [food('elma', 1, count(null))] }
	],
	[
		'Dün akşam 250 gram fırın tavuk yedim',
		{ daysAgo: 1, meal: 'dinner', items: [food('fırın tavuk', 250, g)] }
	],
	[
		'Sabah yarım paket Eti burçak yedim',
		{ daysAgo: null, meal: 'breakfast', items: [food('Eti burçak', 0.5, count('package'))] }
	],
	[
		'Üç gün önce dört dilim Uno ekmek yedim',
		{ daysAgo: 3, meal: null, items: [food('Uno ekmek', 4, count('slice'))] }
	],
	[
		'Önceki gün öğle yemeğinde 120 gram bulgur pilavı yedim',
		{ daysAgo: 2, meal: 'lunch', items: [food('bulgur pilavı', 120, g)] }
	],
	['Bugün 79,6 kiloydum', { daysAgo: 0, meal: null, items: [{ kind: 'weight', kg: 79.6 }] }],
	[
		'Geçen pazartesi 80,2 kiloydum',
		{ daysAgo: 4, meal: null, items: [{ kind: 'weight', kg: 80.2 }] }
	],
	[
		'Üç bardak su içtim',
		{ daysAgo: null, meal: null, items: [{ kind: 'water', amount: 3, unit: count('glass') }] }
	],
	[
		'Bir litre su içtim',
		{ daysAgo: null, meal: null, items: [{ kind: 'water', amount: 1000, unit: ml }] }
	],
	[
		'Bisiklette 320 kalori yaktım',
		{ daysAgo: null, meal: null, items: [{ kind: 'activity', kcal: 320, note: 'Bisiklette' }] }
	],
	[
		'250 kalorilik bir şey yedim',
		{ daysAgo: null, meal: null, items: [{ kind: 'quick', kcal: 250, description: null }] }
	],
	[
		'Akşam 180 gram brokoli yedim, yanında bir kutu ayran',
		{
			daysAgo: null,
			meal: 'dinner',
			items: [food('brokoli', 180, g), food('ayran', 1, count('can'))]
		}
	],
	['Biraz peynir yedim', { daysAgo: null, meal: null, items: [food('peynir', null, null, true)] }],
	['Simit yedim', { daysAgo: null, meal: null, items: [food('Simit', null, null)] }],
	[
		'Kahvaltıda bir buçuk dilim ekmek yedim',
		{ daysAgo: null, meal: 'breakfast', items: [food('ekmek', 1.5, count('slice'))] }
	],
	[
		'İki buçuk kutu maden suyu içtim',
		{ daysAgo: null, meal: null, items: [food('maden suyu', 2.5, count('can'))] }
	],
	[
		'Yüzde beş yağlı 200 gram kıyma yedim',
		{ daysAgo: null, meal: null, items: [food('%5 yağlı kıyma', 200, g)] }
	],
	[
		'İki yüz elli gram yoğurt yedim',
		{ daysAgo: null, meal: null, items: [food('yoğurt', 250, g)] }
	],
	[
		'Bir tane muz ve iki tane ceviz yedim',
		{
			daysAgo: null,
			meal: null,
			items: [food('muz', 1, count('piece')), food('ceviz', 2, count('piece'))]
		}
	],
	[
		'Dün kahvaltıda iki yumurta yedim',
		{ daysAgo: 1, meal: 'breakfast', items: [food('yumurta', 2, count(null))] }
	],
	[
		'Bu sabah bir kase yulaf yedim',
		{ daysAgo: 0, meal: 'breakfast', items: [food('yulaf', 1, count('container'))] }
	],
	[
		'On dilim salam yedim',
		{ daysAgo: null, meal: null, items: [food('salam', 10, count('slice'))] }
	],
	[
		'Yüzde on beş yağlı peynirden 40 gram yedim',
		{ daysAgo: null, meal: null, items: [food('%15 yağlı peynirden', 40, g)] }
	],
	// Added after the held-out evaluation (2026-10-30), written for the gaps it found
	['Bu akşam 180 gram somon yedim', { daysAgo: 0, meal: 'dinner', items: [food('somon', 180, g)] }],
	[
		'Öğle arasında iki dilim pizza yedim',
		{ daysAgo: null, meal: 'lunch', items: [food('pizza', 2, count('slice'))] }
	],
	['Az önce bir elma yedim', { daysAgo: 0, meal: null, items: [food('elma', 1, count(null))] }],
	[
		'Üç akşam önce 250 gram köfte yedim',
		{ daysAgo: 3, meal: 'dinner', items: [food('köfte', 250, g)] }
	],
	[
		'Gece bir bardak süt içtim',
		{ daysAgo: null, meal: 'snacks', items: [food('süt', 1, count('glass'))] }
	],
	[
		'Yatmadan önce yarım kase yoğurt yedim',
		{ daysAgo: null, meal: 'snacks', items: [food('yoğurt', 0.5, count('container'))] }
	],
	[
		'Son öğün olarak bir muz',
		{ daysAgo: null, meal: 'snacks', items: [food('muz', 1, count(null))] }
	],
	[
		'Çeyrek karpuz yedim',
		{ daysAgo: null, meal: null, items: [food('karpuz', 0.25, count(null))] }
	],
	[
		'Dün bir porsiyon mantı yedim',
		{ daysAgo: 1, meal: null, items: [food('mantı', 1, count('portion'))] }
	],
	[
		'Bir tabak kuru fasulye',
		{ daysAgo: null, meal: null, items: [food('kuru fasulye', 1, count('portion'))] }
	],
	[
		'Bir avuç kaju yedim',
		{ daysAgo: null, meal: null, items: [food('kaju', 1, count('handful'))] }
	],
	[
		'Simit yedim, iki tane',
		{ daysAgo: null, meal: null, items: [food('Simit', 2, count('piece'))] }
	],
	[
		'Kahvaltıda peynir yedim, 60 gram',
		{ daysAgo: null, meal: 'breakfast', items: [food('peynir', 60, g)] }
	],
	['Pilav yaptım kendime, 200 gram', { daysAgo: null, meal: null, items: [food('Pilav', 200, g)] }],
	[
		'Makarna ve üzerine rendelenmiş peynir yedim',
		{
			daysAgo: null,
			meal: null,
			items: [food('Makarna', null, null), food('rendelenmiş peynir', null, null)]
		}
	],
	[
		'80 gram yulaf artı 150 ml süt',
		{ daysAgo: null, meal: null, items: [food('yulaf', 80, g), food('süt', 150, ml)] }
	],
	[
		'Dün iki adet yumurta tükettim',
		{ daysAgo: 1, meal: null, items: [food('yumurta', 2, count('piece'))] }
	],
	['Bugün 95,5 kilo geldim', { daysAgo: 0, meal: null, items: [{ kind: 'weight', kg: 95.5 }] }],
	[
		'Sabah tartıda 91 kilo çıktım',
		{ daysAgo: null, meal: 'breakfast', items: [{ kind: 'weight', kg: 91 }] }
	],
	[
		'Just now I had a quarter of a pizza',
		{ daysAgo: 0, meal: null, items: [food('pizza', 0.25, count(null))] }
	],
	[
		'Bu gün öğlende 90 gram hindi füme yedim',
		{ daysAgo: 0, meal: 'lunch', items: [food('hindi füme', 90, g)] }
	],
	// English
	[
		'I had 180 grams of salmon for dinner',
		{ daysAgo: null, meal: 'dinner', items: [food('salmon', 180, g)] }
	],
	[
		'Two slices of rye bread for breakfast',
		{ daysAgo: null, meal: 'breakfast', items: [food('rye bread', 2, count('slice'))] }
	],
	[
		'One can of sparkling water',
		{ daysAgo: null, meal: null, items: [food('sparkling water', 1, count('can'))] }
	],
	[
		'A banana as a snack',
		{ daysAgo: null, meal: 'snacks', items: [food('banana', 1, count(null))] }
	],
	['I ate three eggs yesterday', { daysAgo: 1, meal: null, items: [food('eggs', 3, count(null))] }],
	[
		'Log a flat white for this morning',
		{ daysAgo: 0, meal: 'breakfast', items: [food('flat white', 1, count(null))] }
	],
	[
		'450 kcal lunch',
		{ daysAgo: null, meal: 'lunch', items: [{ kind: 'quick', kcal: 450, description: null }] }
	],
	[
		'I drank 750 ml of water',
		{ daysAgo: null, meal: null, items: [{ kind: 'water', amount: 750, unit: ml }] }
	],
	[
		'A glass of water',
		{ daysAgo: null, meal: null, items: [{ kind: 'water', amount: 1, unit: count('glass') }] }
	],
	['I weighed 81.3 kilos today', { daysAgo: 0, meal: null, items: [{ kind: 'weight', kg: 81.3 }] }],
	[
		'I burned 600 calories cycling three days ago',
		{ daysAgo: 3, meal: null, items: [{ kind: 'activity', kcal: 600, note: 'cycling' }] }
	],
	[
		'Half a container of cottage cheese with lunch',
		{ daysAgo: null, meal: 'lunch', items: [food('cottage cheese', 0.5, count('container'))] }
	],
	[
		'Two and a half slices of toast',
		{ daysAgo: null, meal: null, items: [food('toast', 2.5, count('slice'))] }
	],
	// Fractions (owner report 2026-11-09: "1/3s of a container" was not understood).
	[
		'I ate 1/3s of a container of ricotta peyniri',
		{ daysAgo: null, meal: null, items: [food('ricotta peyniri', 1 / 3, count('container'))] }
	],
	[
		'A third of a container of ricotta',
		{ daysAgo: null, meal: null, items: [food('ricotta', 1 / 3, count('container'))] }
	],
	[
		'Two thirds of a tub of yogurt',
		{ daysAgo: null, meal: null, items: [food('yogurt', 2 / 3, count('container'))] }
	],
	[
		'⅓ container of hummus and 1 1/2 slices of bread',
		{
			daysAgo: null,
			meal: null,
			items: [food('hummus', 1 / 3, count('container')), food('bread', 1.5, count('slice'))]
		}
	],
	[
		'Three quarters of a pizza',
		{ daysAgo: null, meal: null, items: [food('pizza', 0.75, count(null))] }
	],
	[
		'Üçte bir kutu yoğurt',
		{ daysAgo: null, meal: null, items: [food('yoğurt', 1 / 3, count('can'))] }
	],
	[
		"3'te 2 paket bisküvi",
		{ daysAgo: null, meal: null, items: [food('bisküvi', 2 / 3, count('package'))] }
	],
	['Some rice', { daysAgo: null, meal: null, items: [food('rice', null, null, true)] }],
	[
		'300g chicken and 100g rice for dinner the day before yesterday',
		{ daysAgo: 2, meal: 'dinner', items: [food('chicken', 300, g), food('rice', 100, g)] }
	],
	[
		'Last Thursday I had 2 bottles of kefir',
		{ daysAgo: 1, meal: null, items: [food('kefir', 2, count('bottle'))] }
	],
	[
		'Twenty five grams of dark chocolate',
		{ daysAgo: null, meal: null, items: [food('dark chocolate', 25, g)] }
	],
	[
		'One Nutri protein bar, peanut flavour',
		{ daysAgo: null, meal: null, items: [food('Nutri protein bar peanut flavour', 1, count(null))] }
	],
	// Mixed
	[
		"Lunch'ta 220 gram somon yedim",
		{ daysAgo: null, meal: 'lunch', items: [food('somon', 220, g)] }
	],
	[
		"Dün dinner'da iki dilim pizza yedim",
		{ daysAgo: 1, meal: 'dinner', items: [food('pizza', 2, count('slice'))] }
	],
	[
		'Snack olarak bir Ülker protein bar',
		{ daysAgo: null, meal: 'snacks', items: [food('Ülker protein bar', 1, count(null))] }
	],
	[
		'Add 60 grams of beyaz peynir to breakfast',
		{ daysAgo: null, meal: 'breakfast', items: [food('beyaz peynir', 60, g)] }
	],
	[
		'I had 2 dilim kaşar yesterday',
		{ daysAgo: 1, meal: null, items: [food('kaşar', 2, count('slice'))] }
	],
	[
		'Kahvaltıda one cup of filtre kahve',
		{ daysAgo: null, meal: 'breakfast', items: [food('cup filtre kahve', 1, count(null))] }
	],
	[
		'200 ml süt and bir muz',
		{ daysAgo: null, meal: null, items: [food('süt', 200, ml), food('muz', 1, count(null))] }
	]
];
