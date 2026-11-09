// Public entry of the nl-parser module (typed and spoken entries to proposals). Pure; import only this file, as
// '#lib/server/modules/nl-parser/index.ts'.
export {
	fold,
	parseEntry,
	type CountWord,
	type ParsedUnit,
	type ParseResult,
	type Proposal
} from './parse.ts';
export { portionNamed, proposeForFood, unitForFood, type FoodUnit } from './units.ts';
export { SPEECH_VOCABULARY } from './vocabulary.ts';
