// Public entry of the label-parser module (OCR lines to a nutrition proposal). Pure; import only this file, as
// '#lib/server/modules/label-parser/index.ts'.
export { parseLabel, type LabelNote, type LabelProposal, type OcrLine } from './parse.ts';
