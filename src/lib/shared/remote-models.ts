// Remote models for Speak and Scan (docs/design.md, "Remote models for Speak and Scan"): each person may use their
// own OpenAI or OpenRouter key, after allowing it per feature. Shared so the pages can type what the server sends.

export const PROVIDERS = ['openai', 'openrouter'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const FEATURES = ['speak', 'scan'] as const;
export type Feature = (typeof FEATURES)[number];

/** What reads a person's recordings or label photos: obur's own add-on, or their key with a provider. */
export type Source = 'server' | Provider;

export const PROVIDER_NAME: Record<Provider, string> = {
	openai: 'OpenAI',
	openrouter: 'OpenRouter'
};

/** A key as the person sees it again: never the key itself. */
export interface KeySummary {
	provider: Provider;
	last4: string;
	checkedAt: string;
	/** The server can no longer decrypt it (restored onto another server): it has to be entered again. */
	unreadable: boolean;
}

export interface ModelChoices {
	speak: Source;
	scan: Source;
}

/** This month's remote uses, per provider and feature (counts only). */
export type MonthUsage = Partial<Record<Provider, Partial<Record<Feature, number>>>>;

/** Why a remote model gave no answer; each has its own message and way on. */
export type RemoteError =
	'key_refused' | 'no_credit' | 'provider_busy' | 'provider_unavailable' | 'key_missing';
