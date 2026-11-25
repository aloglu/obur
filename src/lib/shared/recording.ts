// How short a Speak recording can be and still hold a word. Speak sends 16 kHz mono 16-bit WAV (client/wav.ts): a
// 44-byte header, then 32,000 bytes a second. Done tapped at once still sends the header, which OpenAI refuses as too
// short (under 0.1 s), and Try again sent it once more (2026-11-25 Review.md audit, 2.2). Under a quarter of a second
// no word fits, so it is "nothing heard", on the phone and again on the server.

export const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_SECOND = 16000 * 2;
export const MIN_SPEECH_SECONDS = 0.25;

/** Whether a recording of this many bytes is too short to hear anything in (WAV, or any recording that is empty). */
export function tooShortToHear(bytes: number, mime: string): boolean {
	if (bytes === 0) return true;
	if (!/^audio\/(x-)?wav\b/i.test(mime.trim())) return false;
	return bytes < WAV_HEADER_BYTES + WAV_BYTES_PER_SECOND * MIN_SPEECH_SECONDS;
}
