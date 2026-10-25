// Weight (kg) and water (ml) readings as the API returns them.
export interface BodyReading {
	id: string;
	localDate: string;
	/** Kilograms for weight, millilitres for water. */
	value: number;
	revision: number;
	createdAt: string;
}
