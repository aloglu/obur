// Short-lived, single-use WebAuthn challenges. Kept in memory: the app runs one web process, and a restart only
// asks people to tap the passkey button again. Bounded so it cannot grow without limit.
import { randomUUID } from 'node:crypto';
import { POLICY } from './policy.ts';

export type ChallengePurpose =
	'setup' | 'join' | 'login' | 'reauth' | 'add-credential' | 'recovery';

export interface Challenge {
	challenge: string;
	purpose: ChallengePurpose;
	/** The account the ceremony is for, when known. */
	userId?: string;
	/** Hash of the setup token, invite token or recovery session that started the ceremony. */
	tokenHash?: string;
	/** Display name chosen before a setup or join ceremony. */
	displayName?: string;
}

interface Stored extends Challenge {
	expires: number;
}

export class ChallengeStore {
	readonly #items = new Map<string, Stored>();

	private readonly maxItems: number;
	private readonly now: () => number;

	constructor(maxItems = 10_000, now: () => number = Date.now) {
		this.maxItems = maxItems;
		this.now = now;
	}

	put(challenge: Challenge): string {
		this.#sweep();
		if (this.#items.size >= this.maxItems) {
			// Drop the oldest entry rather than refusing everyone.
			const oldest = this.#items.keys().next().value;
			if (oldest) this.#items.delete(oldest);
		}
		const id = randomUUID();
		this.#items.set(id, { ...challenge, expires: this.now() + POLICY.challengeMs });
		return id;
	}

	/** Returns the challenge once; later calls, wrong purposes and expired entries return undefined. */
	take(id: string, purpose: ChallengePurpose): Challenge | undefined {
		const item = this.#items.get(id);
		this.#items.delete(id);
		if (!item || item.purpose !== purpose || item.expires <= this.now()) return undefined;
		return {
			challenge: item.challenge,
			purpose: item.purpose,
			...(item.userId && { userId: item.userId }),
			...(item.tokenHash && { tokenHash: item.tokenHash }),
			...(item.displayName && { displayName: item.displayName })
		};
	}

	#sweep(): void {
		const now = this.now();
		for (const [id, item] of this.#items) if (item.expires <= now) this.#items.delete(id);
	}
}
