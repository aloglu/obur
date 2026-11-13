/** A value's shape after JSON: dates become ISO text. */
export type Jsonified<T> = T extends Date
	? string
	: T extends (infer U)[]
		? Jsonified<U>[]
		: T extends object
			? { [K in keyof T]: Jsonified<T[K]> }
			: T;

/**
 * A value exactly as the API would send it (dates as ISO text), for page data that replaces an API call: screens
 * keep one shape whichever way the data arrived.
 */
export const asJson = <T>(value: T): Jsonified<T> =>
	JSON.parse(JSON.stringify(value)) as Jsonified<T>;
