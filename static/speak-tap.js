// Speak's AudioWorklet (SpeakSheet.svelte, src/lib/client/wav.ts): passes the microphone's first channel to the page,
// one 128-sample block at a time. Plain JavaScript loaded by URL (an AudioWorklet module cannot be bundled), served
// from obur itself like every other script.
class SpeakTap extends AudioWorkletProcessor {
	process(inputs) {
		const channel = inputs[0] && inputs[0][0];
		if (!channel) return true;
		// One copy, handed over rather than copied again (2026-11-23 Gemini audit 2, H21).
		const copy = channel.slice(0);
		this.port.postMessage(copy, [copy.buffer]);
		return true;
	}
}
registerProcessor('speak-tap', SpeakTap);
