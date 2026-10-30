// Words the speech recogniser is told to expect, ahead of each person's foods (speech prompt). These are the words
// the parser relies on for meals, amounts and units; the held-out evaluation (docs/feasibility.md) found them
// misheard ("ara öğün" as "arayın", "yarım" as "yarın"). Written as ordinary sentences: Whisper copies the prompt's
// punctuation, and a comma-separated word list made it put commas between words, which split items.
export const SPEECH_VOCABULARY =
	'Bugün kahvaltıda yarım dilim ekmek ve öğle yemeğinde 200 gram tavuk yedim, akşam yemeğinde bir kutu kola ' +
	'içtim, ara öğün olarak bir buçuk paket kraker yedim. I had two slices of bread for breakfast.';
