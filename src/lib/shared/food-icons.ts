// Food icons (owner's choice 2026-10-30: OpenMoji 15.1.0, CC BY-SA 4.0; files and licence in static/icons/food/).
// Each icon lists the English and Turkish words it stands for, so a food's icon can be suggested from its name. The
// suggestion follows how food names are built in both languages: the last word names the thing ("mercimek çorbası"
// is a soup, "chicken breast" is chicken), so the match nearest the end of the name wins.
import { foldForSearch } from './search-text.ts';

export interface FoodIcon {
	/** OpenMoji hexcode, also the file name. */
	hex: string;
	/** English and Turkish words or phrases, as written; folded for matching. */
	words: string[];
}

/** The icon for a meal or quick add with no better match: a plate. */
export const GENERIC_ICON = '1F37D';

export const iconUrl = (hex: string) => `/icons/food/${hex}.svg`;

export const FOOD_ICONS: FoodIcon[] = [
	// Fruit
	{
		hex: '1F347',
		words: [
			'fruit mix',
			'meyve karışımı',
			'grape',
			'grapes',
			'raisin',
			'raisins',
			'üzüm',
			'kuru üzüm'
		]
	},
	{ hex: '1F348', words: ['melon', 'cantaloupe', 'kavun'] },
	{ hex: '1F349', words: ['watermelon', 'karpuz'] },
	{
		hex: '1F34A',
		words: ['orange', 'tangerine', 'mandarin', 'clementine', 'portakal', 'mandalina']
	},
	{ hex: '1F34B', words: ['lemon', 'limon'] },
	{ hex: '1F34B-200D-1F7E9', words: ['lime', 'misket limonu'] },
	{ hex: '1F34C', words: ['banana', 'muz'] },
	{ hex: '1F34D', words: ['pineapple', 'ananas'] },
	{ hex: '1F96D', words: ['mango'] },
	{ hex: '1F34E', words: ['apple', 'elma'] },
	{ hex: '1F34F', words: ['green apple', 'yeşil elma'] },
	{ hex: '1F350', words: ['pear', 'armut'] },
	{ hex: '1F351', words: ['peach', 'apricot', 'nectarine', 'şeftali', 'kayısı', 'nektarin'] },
	{ hex: '1F352', words: ['cherry', 'cherries', 'sour cherry', 'kiraz', 'vişne'] },
	{ hex: '1F353', words: ['strawberry', 'strawberries', 'çilek'] },
	{
		hex: '1FAD0',
		words: [
			'forest fruits',
			'orman meyveli',
			'orman meyvesi',
			'blueberry',
			'blueberries',
			'blackberry',
			'raspberry',
			'berries',
			'yaban mersini',
			'böğürtlen',
			'ahududu',
			'frambuaz',
			'dut'
		]
	},
	{ hex: '1F95D', words: ['kiwi', 'kivi'] },
	{ hex: 'E0C4', words: ['pomegranate', 'nar'] },
	{ hex: 'E0C0', words: ['grapefruit', 'greyfurt'] },
	{ hex: '1F965', words: ['coconut', 'hindistan cevizi'] },
	{ hex: '1F951', words: ['avocado', 'avokado'] },
	// Vegetables and legumes
	{ hex: '1F345', words: ['tomato', 'tomatoes', 'domates', 'salça'] },
	{ hex: '1FAD2', words: ['olive', 'olives', 'zeytin'] },
	{ hex: '1F346', words: ['eggplant', 'aubergine', 'patlıcan'] },
	{ hex: '1F954', words: ['potato', 'potatoes', 'patates'] },
	{ hex: '1F955', words: ['carrot', 'carrots', 'havuç'] },
	{ hex: '1F33D', words: ['corn', 'sweetcorn', 'maize', 'mısır'] },
	{ hex: '1F336', words: ['chili', 'chilli', 'hot pepper', 'jalapeno', 'acı biber', 'pul biber'] },
	{ hex: '1FAD1', words: ['bell pepper', 'pepper', 'peppers', 'biber', 'kapya'] },
	{
		hex: '1F952',
		words: ['cucumber', 'pickle', 'pickles', 'gherkin', 'salatalık', 'hıyar', 'turşu']
	},
	{
		hex: '1F96C',
		words: [
			'lettuce',
			'spinach',
			'cabbage',
			'kale',
			'rocket',
			'arugula',
			'marul',
			'ıspanak',
			'lahana',
			'roka',
			'pazı',
			'semizotu'
		]
	},
	{
		hex: '1F966',
		words: [
			'vegetable',
			'vegetables',
			'sebze',
			'garnitür',
			'zucchini',
			'kabak',
			'broccoli',
			'cauliflower',
			'brokoli',
			'karnabahar'
		]
	},
	{ hex: '1F9C4', words: ['garlic', 'sarımsak'] },
	{ hex: '1F9C5', words: ['onion', 'onions', 'soğan'] },
	{ hex: '1F344-200D-1F7EB', words: ['mushroom', 'mushrooms', 'mantar'] },
	{ hex: '1FADA', words: ['ginger', 'zencefil'] },
	{
		hex: '1FADB',
		words: ['peas', 'pea', 'green beans', 'edamame', 'bezelye', 'taze fasulye', 'bakla']
	},
	{
		hex: '1FAD8',
		words: [
			'beans',
			'lentil',
			'lentils',
			'chickpea',
			'chickpeas',
			'fasulye',
			'kuru fasulye',
			'mercimek',
			'nohut',
			'barbunya'
		]
	},
	{
		hex: '1F95C',
		words: [
			'peanut',
			'peanuts',
			'nut',
			'nuts',
			'hazelnut',
			'hazelnuts',
			'walnut',
			'walnuts',
			'almond',
			'almonds',
			'cashew',
			'pistachio',
			'fıstık',
			'fındık',
			'ceviz',
			'badem',
			'kaju',
			'kuruyemiş'
		]
	},
	{ hex: '1F330', words: ['chestnut', 'chestnuts', 'kestane'] },
	{
		hex: '1F33F',
		words: [
			'seasoning',
			'würze',
			'sesam',
			'çeşni',
			'herb',
			'herbs',
			'spice',
			'parsley',
			'mint',
			'basil',
			'baharat',
			'kekik',
			'nane',
			'maydanoz',
			'dereotu',
			'fesleğen'
		]
	},
	{
		hex: '1F33E',
		words: [
			'chia',
			'seeds',
			'tohum',
			'susam',
			'sesame',
			'quinoa',
			'kinoa',
			'karabuğday',
			'buckwheat',
			'flour',
			'wheat',
			'semolina',
			'un',
			'buğday',
			'irmik'
		]
	},
	// Bread and bakery
	{ hex: '1F35E', words: ['bread', 'loaf', 'toast bread', 'ekmek', 'tost ekmeği'] },
	{ hex: 'E0CA', words: ['sourdough', 'country bread', 'köy ekmeği', 'ekşi maya'] },
	{ hex: '1F950', words: ['çörek', 'croissant', 'kruvasan', 'poğaça', 'açma'] },
	{ hex: '1F956', words: ['grissini', 'breadsticks', 'breadstick', 'baguette', 'baget'] },
	{
		hex: '1FAD3',
		words: [
			'piadina',
			'flatbread',
			'pita',
			'naan',
			'tortilla',
			'lavash',
			'bazlama',
			'lavaş',
			'pide',
			'yufka',
			'gözleme'
		]
	},
	{ hex: '1F968', words: ['pretzel'] },
	{ hex: '1F96F', words: ['bagel', 'simit'] },
	{ hex: '1F95E', words: ['pancake', 'pancakes', 'crepe', 'pankek', 'krep'] },
	{ hex: '1F9C7', words: ['waffle'] },
	// Dairy and eggs
	{
		hex: '1F9C0',
		words: [
			'cheese',
			'cheddar',
			'feta',
			'mozzarella',
			'halloumi',
			'peynir',
			'kaşar',
			'lor',
			'tulum',
			'hellim',
			'labne'
		]
	},
	{ hex: '1F95B', words: ['milk', 'kefir', 'süt', 'ayran'] },
	{ hex: '1F9C8', words: ['butter', 'margarine', 'tereyağı', 'tereyağ', 'margarin'] },
	{ hex: '1F95A', words: ['egg', 'eggs', 'yumurta'] },
	{
		hex: '1F373',
		words: [
			'omelette',
			'omelet',
			'fried egg',
			'scrambled eggs',
			'omlet',
			'menemen',
			'sahanda yumurta'
		]
	},
	// Meat and fish
	{ hex: '1F356', words: ['ribs', 'lamb', 'kuzu', 'kaburga', 'incik'] },
	{
		hex: '1F357',
		words: [
			'chicken',
			'drumstick',
			'poultry',
			'turkey',
			'wings',
			'tavuk',
			'piliç',
			'hindi',
			'kanat'
		]
	},
	{
		hex: '1F969',
		words: [
			'meat',
			'steak',
			'beef',
			'pork',
			'mince',
			'minced meat',
			'et',
			'biftek',
			'dana',
			'kıyma',
			'bonfile',
			'pirzola',
			'antrikot'
		]
	},
	{
		hex: '1F953',
		words: ['bacon', 'salami', 'ham', 'pastrami', 'pastırma', 'salam', 'jambon', 'füme']
	},
	{ hex: '1F32D', words: ['hot dog', 'sausage', 'sausages', 'frankfurter', 'sosis', 'sucuk'] },
	{
		hex: '1F41F',
		words: [
			'halibut',
			'swordfish',
			'cod',
			'trout',
			'kılıç',
			'alabalık',
			'morina',
			'fish',
			'salmon',
			'tuna',
			'sardine',
			'anchovy',
			'balık',
			'somon',
			'levrek',
			'çipura',
			'hamsi',
			'sardalya'
		]
	},
	{ hex: '1F990', words: ['shrimp', 'prawn', 'prawns', 'karides'] },
	{ hex: '1F991', words: ['squid', 'calamari', 'kalamar'] },
	{ hex: '1F9AA', words: ['oyster', 'mussel', 'mussels', 'midye', 'istiridye'] },
	{ hex: '1F980', words: ['crab', 'yengeç'] },
	{ hex: '1F99E', words: ['lobster', 'ıstakoz'] },
	{ hex: '1F363', words: ['sushi', 'suşi'] },
	{ hex: '1F364', words: ['tempura', 'fried shrimp'] },
	// Dishes
	{ hex: '1F354', words: ['hamburger', 'burger', 'cheeseburger'] },
	{
		hex: '1F35F',
		words: ['fries', 'french fries', 'chips', 'crisps', 'patates kızartması', 'cips']
	},
	{ hex: '1F355', words: ['pizza', 'lahmacun'] },
	{ hex: '1F96A', words: ['sandwich', 'toastie', 'sandviç', 'tost'] },
	{ hex: '1F32E', words: ['taco', 'tako'] },
	{ hex: '1F32F', words: ['burrito', 'wrap', 'dürüm'] },
	{ hex: '1F959', words: ['kebab', 'gyro', 'doner', 'shawarma', 'döner', 'iskender'] },
	{ hex: '1F362', words: ['skewer', 'shish', 'kabob', 'şiş', 'şiş kebap', 'çöp şiş'] },
	{ hex: '1F9C6', words: ['falafel', 'meatball', 'meatballs', 'köfte', 'içli köfte'] },
	{ hex: '1F958', words: ['casserole', 'paella', 'stir fry', 'güveç', 'tava', 'kavurma'] },
	{ hex: '1F372', words: ['soup', 'stew', 'çorba', 'yahni', 'türlü', 'haşlama'] },
	{ hex: '1F957', words: ['salad', 'salata', 'cacık'] },
	{
		hex: '1F963',
		words: [
			'quark',
			'skyr',
			'cereal',
			'oats',
			'oatmeal',
			'porridge',
			'granola',
			'muesli',
			'yogurt',
			'yoghurt',
			'yulaf',
			'müsli',
			'gevrek',
			'yoğurt'
		]
	},
	{ hex: '1F35A', words: ['rice', 'pilav', 'pirinç', 'bulgur'] },
	{ hex: '1F35B', words: ['curry', 'köri'] },
	{ hex: '1F35C', words: ['noodles', 'noodle', 'ramen', 'erişte'] },
	{
		hex: '1F35D',
		words: [
			'fusilli',
			'farfalle',
			'rigatoni',
			'pennoli',
			'linguine',
			'tagliatelle',
			'noodle pasta',
			'spaghetti',
			'macaroni',
			'penne',
			'makarna',
			'spagetti'
		]
	},
	{ hex: '1F95F', words: ['dumpling', 'dumplings', 'mantı'] },
	{ hex: '1F360', words: ['sweet potato', 'tatlı patates'] },
	{
		hex: '1F358',
		words: [
			'cracker',
			'crackers',
			'kraker',
			'galeta',
			'rice cakes',
			'rice cake',
			'rice cracker',
			'pirinç patlağı'
		]
	},
	{ hex: '1F359', words: ['onigiri', 'rice ball'] },
	{ hex: '1F371', words: ['bento'] },
	{ hex: '1F961', words: ['takeout', 'takeaway'] },
	{ hex: '1F37F', words: ['popcorn', 'patlamış mısır'] },
	{ hex: '1F96B', words: ['canned', 'tinned', 'konserve', 'ton balığı'] },
	{ hex: '1F9C2', words: ['salt', 'tuz'] },
	{ hex: '1FAD5', words: ['fondue'] },
	// Sweets
	{ hex: '1F36B', words: ['chocolate', 'chocolate bar', 'protein bar', 'çikolata', 'gofret'] },
	{ hex: '1F36A', words: ['cookie', 'cookies', 'biscuit', 'biscuits', 'bisküvi', 'kurabiye'] },
	{
		hex: '1F370',
		words: ['revani', 'cake', 'cheesecake', 'dessert', 'pasta dilimi', 'kek', 'tatlı']
	},
	{ hex: '1F382', words: ['birthday cake', 'doğum günü pastası'] },
	{ hex: '1F9C1', words: ['cupcake', 'muffin'] },
	{ hex: '1F967', words: ['pie', 'tart', 'pastry', 'baklava', 'börek', 'turta', 'künefe'] },
	{ hex: '1F369', words: ['doughnut', 'donut', 'lokma', 'halka tatlı'] },
	{ hex: '1F368', words: ['ice cream', 'gelato', 'dondurma'] },
	{ hex: '1F366', words: ['soft serve', 'külah dondurma'] },
	{ hex: '1F367', words: ['sorbet', 'shaved ice'] },
	{ hex: '1F36E', words: ['pudding', 'custard', 'puding', 'sütlaç', 'muhallebi', 'kazandibi'] },
	{ hex: '1F36C', words: ['candy', 'sweets', 'şeker', 'lokum', 'akide'] },
	{ hex: '1F36D', words: ['lollipop', 'lolipop'] },
	{ hex: '1F36F', words: ['honey', 'bal'] },
	{
		hex: '1FAD9-200D-1F7EB',
		words: [
			'peanut butter',
			'nutella',
			'tahini',
			'molasses',
			'spread',
			'jam',
			'tahin',
			'pekmez',
			'fıstık ezmesi',
			'fındık ezmesi',
			'helva',
			'reçel'
		]
	},
	{ hex: '1FAD9', words: ['jar', 'sauce', 'sos', 'kavanoz'] },
	// Drinks
	{ hex: '1F4A7', words: ['water', 'su'] },
	{ hex: 'E0CB', words: ['mineral water', 'sparkling water', 'maden suyu', 'soda'] },
	{ hex: 'E0CC', words: ['bottled water', 'pet şişe'] },
	{
		hex: '1F375',
		words: ['tea', 'green tea', 'herbal tea', 'çay', 'yeşil çay', 'bitki çayı', 'ıhlamur']
	},
	{ hex: '1FAD6', words: ['teapot', 'demlik'] },
	{ hex: '1F9C9', words: ['mate', 'yerba mate'] },
	{ hex: '1F376', words: ['sake'] },
	{
		hex: '2615',
		words: ['coffee', 'hot chocolate', 'kahve', 'türk kahvesi', 'sıcak çikolata', 'salep']
	},
	{ hex: 'E0C5', words: ['latte', 'cappuccino', 'flat white', 'kapuçino'] },
	{ hex: 'E0C6', words: ['espresso', 'coffee beans'] },
	{ hex: '1F964', words: ['cola', 'soft drink', 'lemonade', 'kola', 'gazoz', 'limonata'] },
	{ hex: '1F9C3', words: ['juice', 'meyve suyu', 'portakal suyu'] },
	{ hex: '1F379', words: ['smoothie', 'tropical drink'] },
	{ hex: '1F9CB', words: ['bubble tea'] },
	{ hex: '1F37A', words: ['beer', 'bira'] },
	{ hex: '1F377', words: ['wine', 'şarap'] },
	{ hex: '1F378', words: ['cocktail', 'martini', 'kokteyl'] },
	{ hex: '1F943', words: ['whisky', 'whiskey', 'vodka', 'liquor', 'rakı', 'viski', 'votka'] },
	{ hex: '1F37E', words: ['champagne', 'şampanya'] },
	{ hex: '1F9CA', words: ['ice', 'buz'] },
	{ hex: '1F37C', words: ['baby formula', 'baby milk', 'mama'] },
	{ hex: GENERIC_ICON, words: ['meal', 'dinner', 'lunch', 'yemek', 'tabak'] }
];

const KNOWN = new Set(FOOD_ICONS.map((i) => i.hex));
export const isFoodIcon = (hex: string) => KNOWN.has(hex);

/** Suffixes a short word may carry and still match: Turkish ones and English plurals ("çayı", "suyu" are not: compounds are listed). */
const SHORT_SUFFIX = /^(i|ı|u|ü|li|lı|lu|lü|si|sı|su|sü|ler|lar|leri|ları|s|es)$/;

interface Entry {
	hex: string;
	words: string[];
}
const ENTRIES: Entry[] = FOOD_ICONS.flatMap((icon) =>
	icon.words.map((w) => ({ hex: icon.hex, words: foldForSearch(w).split(' ') }))
);

/** Turkish softens a final k, p or t before a vowel: ekmek → ekmeği, tavuk → tavuğu, biftek → bifteği. */
const soft = (word: string) => word.replace(/k$/, 'g').replace(/p$/, 'b').replace(/t$/, 'd');

/** A name token matches a word: whole, with a Turkish suffix, or (from five letters) as a prefix ("peyniri"). */
function tokenMatches(token: string, word: string): boolean {
	if (token === word) return true;
	for (const stem of new Set(word.length >= 4 ? [word, soft(word)] : [word])) {
		if (!token.startsWith(stem) || token === stem) continue;
		const rest = token.slice(stem.length);
		// A softened stem always carries a vowel-led suffix; otherwise long words match as prefixes.
		if (stem !== word ? /^[aeiou]/.test(rest) : word.length >= 5) return true;
		if (word.length >= 3 && SHORT_SUFFIX.test(rest)) return true;
	}
	return false;
}

/**
 * The icon a food's name suggests, or null. The match ending nearest the end of the name wins; among those, the
 * longest phrase ("ton balığı" over "balık").
 */
export function suggestIcon(...texts: (string | null | undefined)[]): string | null {
	let best: { hex: string; end: number; size: number } | null = null;
	for (const text of texts) {
		if (!text) continue;
		const tokens = foldForSearch(text).split(' ').filter(Boolean);
		for (const e of ENTRIES) {
			for (let i = 0; i + e.words.length <= tokens.length; i++) {
				const fits = e.words.every((w, k) =>
					k < e.words.length - 1 ? tokens[i + k] === w : tokenMatches(tokens[i + k], w)
				);
				if (!fits) continue;
				const end = i + e.words.length;
				const size = e.words.join(' ').length;
				if (!best || end > best.end || (end === best.end && size > best.size))
					best = { hex: e.hex, end, size };
			}
		}
		// The name decides; the brand or other text is consulted only when the name says nothing.
		if (best) return best.hex;
	}
	return best?.hex ?? null;
}
