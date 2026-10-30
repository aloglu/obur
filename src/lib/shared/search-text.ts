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

/** A food's search key plus any reviewed aliases (curated foods keep theirs in source_meta.aliases). */
export function searchKeyWithAliases(name: string, brand: string | null, meta: unknown): string {
	const aliases = (meta as { aliases?: unknown } | null)?.aliases;
	const extra = Array.isArray(aliases) ? aliases.filter((a) => typeof a === 'string') : [];
	return [foodSearchKey(name, brand), ...extra.map((a) => foldForSearch(a))].join(' ');
}
