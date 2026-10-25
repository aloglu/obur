// Weight (kg) and water (ml) readings as the API returns them.
export interface BodyReading {
	id: string;
	localDate: string;
	/** Kilograms for weight, millilitres for water. */
	value: number;
	revision: number;
	createdAt: string;
}

export interface ActivityEntry {
	id: string;
	localDate: string;
	/** Calories burned above an inactive day. */
	kcal: number;
	note: string | null;
	source: 'manual' | 'loseit';
	/** Imported values with an unclear meaning are recorded but not added to the budget. */
	countsTowardBudget: boolean;
	createdAt: string;
}
