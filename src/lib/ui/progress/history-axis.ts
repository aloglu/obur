// Dates as numbers on the history charts' x axis.
export const dayNumber = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86_400_000;
