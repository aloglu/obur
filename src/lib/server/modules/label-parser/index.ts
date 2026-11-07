// Public entry of the label-parser module (OCR lines, or a table copied by a remote model, to a nutrition proposal).
// Pure; import only this file, as '#lib/server/modules/label-parser/index.ts'.
export { parseLabel, type LabelNote, type LabelProposal, type OcrLine } from './parse.ts';
export { LABEL_TABLE_SCHEMA, LabelTable, parseLabelTable } from './table.ts';
