// Search keys that match regardless of case, diacritics and Turkish dotted/dotless i, so "sutas" finds "Sütaş"
// and "ISPANAK" finds "ıspanak". Stored names keep their original spelling; only the key is folded.

/** Folds text for matching. Every form of i (I, İ, ı, i) becomes "i", so English casing is unaffected. */
export function foldForSearch(text: string): string {
	return text
		.normalize('NFC')
		.replace(/[İIı]/g, 'i')
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.normalize('NFD')
		.replace(/\p{M}+/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/** The stored search key of a food: brand and name together. */
export function foodSearchKey(name: string, brand?: string | null): string {
	return foldForSearch(brand ? `${brand} ${name}` : name);
}
