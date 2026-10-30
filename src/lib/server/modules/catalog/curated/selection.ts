// The curated generic foods (docs/design.md, "Food catalog and recipes"): USDA records chosen for foods people here
// actually log, with a plain English name and reviewed Turkish search aliases. All SR Legacy: every record has plain
// energy, sugars and household portions with gram weights (Foundation Foods mostly lack them). Cooked starches and
// legumes use the salted variants, as they are usually cooked at home. Change this list, then run
// `npm run curated:build` with the dataset files to regenerate usda-foods.json.
import type { UsdaDataset } from '../usda.ts';

export interface Selection {
	dataset: UsdaDataset;
	fdcId: number;
	name: string;
	/** Searchable, not shown: Turkish names and common alternatives. */
	aliases: string[];
}

const sr = (fdcId: number, name: string, aliases: string[]): Selection => ({
	dataset: 'sr_legacy',
	fdcId,
	name,
	aliases
});

export const SELECTION: Selection[] = [
	// Nuts, seeds and dried fruit
	sr(170187, 'Walnuts', ['ceviz']),
	sr(170567, 'Almonds', ['badem']),
	sr(170581, 'Hazelnuts', ['fındık']),
	sr(170184, 'Pistachios', ['antep fıstığı', 'fıstık']),
	sr(172430, 'Peanuts', ['yer fıstığı']),
	sr(170178, 'Macadamia nuts', ['makadamya']),
	sr(170562, 'Sunflower seeds', ['ay çekirdeği', 'çekirdek']),
	sr(170169, 'Coconut meat, raw', ['hindistan cevizi']),
	sr(174665, 'Figs, dried', ['kuru incir', 'incir']),
	sr(173941, 'Apricots, dried', ['kuru kayısı', 'kayısı']),
	// Fruit
	sr(173944, 'Banana', ['muz']),
	sr(171688, 'Apple, with skin', ['elma']),
	sr(169118, 'Pear', ['armut']),
	sr(169917, 'Orange', ['portakal']),
	sr(169105, 'Mandarin', ['mandalina', 'tangerine']),
	sr(167746, 'Lemon', ['limon']),
	sr(167747, 'Lemon juice', ['limon suyu']),
	sr(167762, 'Strawberries', ['çilek']),
	sr(171711, 'Blueberries', ['yaban mersini']),
	sr(171719, 'Cherries, sweet', ['kiraz']),
	sr(174683, 'Grapes', ['üzüm']),
	sr(169928, 'Peach', ['şeftali']),
	sr(169949, 'Plum', ['erik']),
	sr(167765, 'Watermelon', ['karpuz']),
	sr(169092, 'Cantaloupe melon', ['kavun']),
	sr(168153, 'Kiwi', ['kivi']),
	sr(169134, 'Pomegranate', ['nar']),
	sr(168151, 'Jujube', ['hünnap']),
	sr(171705, 'Avocado', ['avokado']),
	// Vegetables
	sr(170457, 'Tomato', ['domates', 'çeri domates', 'cherry tomatoes']),
	sr(168409, 'Cucumber', ['salatalık', 'hıyar']),
	sr(168558, 'Pickled cucumbers', ['salatalık turşusu', 'turşu', 'gherkins']),
	sr(170393, 'Carrot', ['havuç']),
	sr(168568, 'Baby carrots', ['bebek havuç']),
	sr(169247, 'Romaine lettuce', ['marul', 'cos lettuce']),
	sr(169975, 'Cabbage', ['lahana', 'beyaz lahana']),
	sr(169977, 'Red cabbage', ['mor lahana', 'kırmızı lahana']),
	sr(168462, 'Spinach, raw', ['ıspanak']),
	sr(170531, 'Spinach, boiled (salted)', ['haşlanmış ıspanak', 'ıspanak']),
	sr(170108, 'Red bell pepper', ['kırmızı biber', 'kapya biber']),
	sr(169383, 'Yellow bell pepper', ['sarı biber']),
	sr(170427, 'Green bell pepper', ['yeşil biber', 'dolmalık biber']),
	sr(170000, 'Onion', ['soğan']),
	sr(169230, 'Garlic', ['sarımsak']),
	sr(170416, 'Parsley', ['maydanoz']),
	sr(169228, 'Eggplant', ['patlıcan', 'aubergine']),
	sr(169291, 'Zucchini', ['kabak', 'courgette']),
	sr(170379, 'Broccoli', ['brokoli']),
	sr(169986, 'Cauliflower', ['karnabahar']),
	sr(169251, 'Mushrooms', ['mantar']),
	sr(170026, 'Potato, raw', ['patates']),
	sr(170520, 'Potato, boiled without skin (salted)', ['haşlanmış patates', 'patates']),
	sr(168482, 'Sweet potato, raw', ['tatlı patates']),
	sr(170105, 'Peas, boiled (salted)', ['bezelye']),
	// Legumes, grains, bread
	sr(175254, 'Lentils, boiled (salted)', ['mercimek', 'yeşil mercimek']),
	sr(174284, 'Red lentils, raw', ['kırmızı mercimek']),
	sr(173799, 'Chickpeas, boiled (salted)', ['nohut']),
	sr(175242, 'Kidney beans, boiled (salted)', ['kırmızı fasulye', 'barbunya']),
	sr(169753, 'Rice, white, boiled (salted)', ['pirinç', 'haşlanmış pirinç']),
	sr(170287, 'Bulgur, cooked', ['bulgur']),
	sr(169751, 'Pasta, boiled (salted)', ['makarna']),
	sr(173904, 'Oats, dry', ['yulaf', 'yulaf ezmesi']),
	sr(174924, 'White bread', ['beyaz ekmek', 'ekmek']),
	sr(172688, 'Whole-wheat bread', ['tam buğday ekmeği', 'tam buğday']),
	// Eggs and dairy
	sr(171287, 'Egg, raw', ['yumurta']),
	sr(172185, 'Omelette, plain', ['omlet']),
	sr(171265, 'Milk, whole (3.25%)', ['süt', 'tam yağlı süt']),
	sr(171267, 'Milk, reduced fat (2%)', ['süt', 'yarım yağlı süt']),
	sr(170872, 'Milk, low fat (1%)', ['süt', 'az yağlı süt']),
	sr(171284, 'Yoghurt, plain, whole milk', ['yoğurt']),
	sr(170894, 'Greek yoghurt, plain, nonfat', ['süzme yoğurt', 'yağsız yoğurt']),
	sr(173420, 'Feta cheese', ['feta', 'beyaz peynir']),
	sr(173435, 'Goat cheese, soft', ['keçi peyniri']),
	sr(170845, 'Mozzarella, whole milk', ['mozarella']),
	sr(173414, 'Cheddar cheese', ['çedar', 'kaşar']),
	sr(172182, 'Cottage cheese, 2% fat', ['cottage peyniri']),
	sr(173410, 'Butter, salted', ['tereyağı']),
	// Meat and fish
	sr(171077, 'Chicken breast, raw (skinless)', ['tavuk göğsü', 'tavuk göğüs', 'tavuk']),
	sr(171477, 'Chicken breast, roasted (meat only)', ['tavuk göğsü', 'ızgara tavuk', 'tavuk']),
	sr(173627, 'Chicken thigh, raw (meat only)', ['tavuk but', 'tavuk']),
	sr(174516, 'Turkey breast, roasted (meat only)', ['hindi göğsü', 'hindi']),
	sr(174030, 'Ground beef, 10% fat, raw', ['kıyma', 'dana kıyma']),
	sr(174762, 'Beef tenderloin, lean, raw', ['bonfile', 'dana bonfile']),
	sr(168627, 'Beef liver, pan-fried', ['ciğer', 'dana ciğeri']),
	sr(174317, 'Lamb leg, lean, raw', ['kuzu but', 'kuzu']),
	sr(175167, 'Salmon, farmed, raw', ['somon']),
	sr(173709, 'Tuna, canned in water, drained', ['ton balığı']),
	sr(175139, 'Sardines, canned in oil, drained', ['sardalya']),
	sr(174182, 'Anchovy, raw', ['hamsi']),
	sr(173704, 'Swordfish, cooked', ['kılıç balığı']),
	sr(174200, 'Halibut, raw', ['pisi balığı']),
	// Oils, spreads, sweet
	sr(171413, 'Olive oil', ['zeytinyağı', 'zeytin yağı']),
	sr(169096, 'Green olives', ['yeşil zeytin', 'zeytin']),
	sr(169094, 'Black olives', ['siyah zeytin', 'zeytin']),
	sr(170189, 'Tahini', ['tahin']),
	sr(174289, 'Hummus', ['humus']),
	sr(168556, 'Ketchup', ['ketçap']),
	sr(169640, 'Honey', ['bal']),
	sr(169655, 'Sugar', ['şeker', 'toz şeker']),
	// Drinks
	sr(173227, 'Black tea, brewed', ['çay', 'siyah çay']),
	sr(171890, 'Coffee, brewed', ['kahve', 'filtre kahve']),
	sr(175099, 'Diet cola', ['kola', 'diyet kola', 'light kola'])
];
