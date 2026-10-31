// Fixed-window attempt limits per key (client IP or account). Windows expire on their own, so nobody can lock
// another person out indefinitely (docs/design.md, "Sessions, uploads and deployment"). In memory: one web process.
export class RateLimiter {
	readonly #windows = new Map<string, { count: number; resetAt: number }>();

	private readonly max: number;
	private readonly windowMs: number;
	private readonly maxKeys: number;
	private readonly now: () => number;

	constructor(max: number, windowMs: number, maxKeys = 50_000, now: () => number = Date.now) {
		this.max = max;
		this.windowMs = windowMs;
		this.maxKeys = maxKeys;
		this.now = now;
	}

	/** Records an attempt and returns whether it is allowed. */
	attempt(key: string): boolean {
		const now = this.now();
		let w = this.#windows.get(key);
		if (!w || w.resetAt <= now) {
			if (this.#windows.size >= this.maxKeys) this.#sweep(now);
			w = { count: 0, resetAt: now + this.windowMs };
			this.#windows.set(key, w);
		}
		w.count += 1;
		return w.count <= this.max;
	}

	#sweep(now: number): void {
		for (const [key, w] of this.#windows) if (w.resetAt <= now) this.#windows.delete(key);
		// Still full of live windows: drop the oldest rather than grow without bound.
		while (this.#windows.size >= this.maxKeys) {
			const oldest = this.#windows.keys().next().value;
			if (oldest === undefined) break;
			this.#windows.delete(oldest);
		}
	}
}
