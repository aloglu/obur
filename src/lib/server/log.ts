// What the server log may say about an error (CLAUDE.md: redact sensitive content from logs). A failed query's
// message holds the whole query and its values (Drizzle: "Failed query: … params: …"), which can be a diary note,
// a food name or a display name, so the log keeps only the kind of error and the database's error code
// (2026-11-20 audit).

/** "DrizzleQueryError (PostgresError 23505)", never the message. */
export function describeError(e: unknown): string {
	if (!(e instanceof Error)) return typeof e;
	const cause = (e as { cause?: unknown }).cause;
	const code = (x: unknown) => {
		const c = (x as { code?: unknown } | null)?.code;
		return typeof c === 'string' && /^[A-Z0-9_]{2,40}$/i.test(c) ? c : undefined;
	};
	// Some errors (DrizzleQueryError) leave name as "Error"; their class says more.
	const kind = (x: Error) => (x.name !== 'Error' ? x.name : x.constructor?.name || 'Error');
	const one = (x: Error) => `${kind(x)}${code(x) ? ` ${code(x)}` : ''}`;
	return cause instanceof Error ? `${one(e)} (${one(cause)})` : one(e);
}
