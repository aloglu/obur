// Each batch's icons and the Foods rows that show them on its review page (review.ts): icon name, a realistic row
// name (English, Turkish or mixed, as people log), detail, kcal, and whether the owner has seen it before (pilot).
type Row = [string, string, string, string, boolean?];

export interface Batch {
	title: string;
	intro: string;
	rows: Row[];
}

export const BATCHES: Record<number, Batch> = {
	1: {
		title: 'fruit',
		intro: '17 new fruit icons, plus the 4 fruits from the pilot. Keep or redo each one.',
		rows: [
			['apple', 'Elma', 'per 100 g', '52'],
			['green_apple', 'Granny Smith apple', 'per 100 g', '58'],
			['pear', 'Armut', 'per 100 g', '57', true],
			['banana', 'Banana', '1 medium (118 g)', '105'],
			['orange', 'Portakal', '1 medium (131 g)', '62'],
			['grapefruit', 'Greyfurt', 'per 100 g', '42'],
			['lemon', 'Limon suyu', 'per 1 tbsp (15 ml)', '3'],
			['lime', 'Misket limonu', 'per 100 g', '30'],
			['apricot', 'Kayısı', 'per 100 g', '48', true],
			['cherries', 'Vişne', 'per 100 g', '50', true],
			['strawberry', 'Çilek', 'per 100 g', '32'],
			['blueberries', 'Blueberries', 'per 100 g', '57'],
			['grapes', 'Kuru üzüm', 'per 100 g', '299'],
			['watermelon', 'Karpuz', 'per 100 g', '30'],
			['melon', 'Kavun', 'per 100 g', '34'],
			['pineapple', 'Pineapple chunks', 'per 100 g', '50'],
			['mango', 'Mango', 'per 100 g', '60'],
			['kiwi', 'Kivi', '1 medium (69 g)', '42'],
			['pomegranate', 'Nar', 'per 100 g', '83', true],
			['coconut', 'Hindistan cevizi rendesi', 'per 100 g', '660'],
			['avocado', 'Avokado', 'per 100 g', '160']
		]
	},
	2: {
		title: 'vegetables and legumes',
		intro:
			'19 new icons, each drawn from the real thing, plus the pilot’s eggplant and chili. Keep or redo each one; a Redo comes back as three versions to pick from.',
		rows: [
			['tomato', 'Domates', 'per 100 g', '18'],
			['bell_pepper', 'Kapya biber', 'per 100 g', '31'],
			['chili', 'Acı sivri biber', 'per 100 g', '40', true],
			['eggplant', 'Közlenmiş patlıcan', 'per 100 g', '35', true],
			['cucumber', 'Salatalık', 'per 100 g', '15'],
			['leafy_greens', 'Ispanak', 'per 100 g', '23'],
			['broccoli', 'Broccoli, steamed', 'per 100 g', '35'],
			['carrot', 'Havuç', '1 medium (61 g)', '25'],
			['potato', 'Haşlanmış patates', 'per 100 g', '87'],
			['corn', 'Haşlanmış mısır', '1 ear (90 g)', '88'],
			['onion', 'Kuru soğan', 'per 100 g', '40'],
			['garlic', 'Sarımsak', 'per 1 clove (3 g)', '4'],
			['mushroom', 'Kültür mantarı', 'per 100 g', '22'],
			['ginger', 'Taze zencefil', 'per 1 tsp (2 g)', '2'],
			['olives', 'Siyah zeytin', 'per 10 olives (30 g)', '87'],
			['peas', 'Bezelye', 'per 100 g', '81'],
			['beans', 'Kuru fasulye', 'per 1 portion (200 g)', '280'],
			['peanut', 'Peanut butter', 'per 1 tbsp (16 g)', '94'],
			['chestnut', 'Kestane', 'per 100 g', '213'],
			['herbs', 'Maydanoz', 'per 1 bunch (30 g)', '11'],
			['seeds', 'Chia seeds', 'per 1 tbsp (12 g)', '58']
		]
	}
};
