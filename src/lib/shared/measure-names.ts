// The household measures' names per interface language (docs/design.md, "Household measures"): same sizes, a name
// in each language. A measure added later without a translation shows its stored name.
import { getLocale } from '#lib/paraglide/runtime.js';

const NAMES: Record<'en' | 'tr', Record<string, string>> = {
	en: {
		su_bardagi: 'Water glass',
		cay_bardagi: 'Tea glass',
		yemek_kasigi: 'Tablespoon',
		tatli_kasigi: 'Dessert spoon',
		cay_kasigi: 'Teaspoon'
	},
	tr: {
		su_bardagi: 'Su bardağı',
		cay_bardagi: 'Çay bardağı',
		yemek_kasigi: 'Yemek kaşığı',
		tatli_kasigi: 'Tatlı kaşığı',
		cay_kasigi: 'Çay kaşığı'
	}
};

export const measureName = (code: string, stored: string): string =>
	NAMES[getLocale()][code] ?? stored;
