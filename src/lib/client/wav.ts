// Speak's recording as the speech add-on reads it: 16 kHz mono 16-bit WAV, made on the phone from the microphone's raw
// samples (2026-11-22 audits A11/G02/G03: the add-on needs no FFmpeg). Tested on the owner's iPhone in Safari and as a
// Home Screen app (2026-11-23, spikes/speech-browser); averaging measured on 48 clips (docs/feasibility.md).

export const WAV_RATE = 16000;

/**
 * Samples at `from` Hz to 16 kHz by averaging each output sample's span of input samples. For speech at 44.1 or
 * 48 kHz this gave the same transcripts as FFmpeg's resampler; a windowed-sinc filter was worse.
 */
export function to16k(samples: Float32Array, from: number): Float32Array {
	if (from === WAV_RATE) return samples;
	const ratio = from / WAV_RATE;
	const out = new Float32Array(Math.floor(samples.length / ratio));
	for (let i = 0; i < out.length; i++) {
		const start = Math.floor(i * ratio);
		const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
		let sum = 0;
		for (let j = start; j < end; j++) sum += samples[j];
		out[i] = sum / Math.max(1, end - start);
	}
	return out;
}

/** 16 kHz mono 16-bit PCM WAV: a 44-byte header, then the samples, clipped to -1…1. */
export function wav(samples: Float32Array): Blob {
	const buffer = new ArrayBuffer(44 + samples.length * 2);
	const v = new DataView(buffer);
	const text = (at: number, s: string) => {
		for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
	};
	text(0, 'RIFF');
	v.setUint32(4, 36 + samples.length * 2, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	v.setUint32(16, 16, true); // format block size
	v.setUint16(20, 1, true); // PCM
	v.setUint16(22, 1, true); // mono
	v.setUint32(24, WAV_RATE, true);
	v.setUint32(28, WAV_RATE * 2, true); // bytes a second
	v.setUint16(32, 2, true); // bytes a sample
	v.setUint16(34, 16, true); // bits a sample
	text(36, 'data');
	v.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
	}
	return new Blob([buffer], { type: 'audio/wav' });
}

/** The pieces the microphone sent, joined, at 16 kHz and at most `maxSeconds` long, as WAV. */
export function recordingWav(parts: Float32Array[], rate: number, maxSeconds: number): Blob {
	const total = parts.reduce((n, p) => n + p.length, 0);
	const raw = new Float32Array(total);
	let at = 0;
	for (const p of parts) {
		raw.set(p, at);
		at += p.length;
	}
	const mono = to16k(raw, rate);
	return wav(mono.subarray(0, Math.min(mono.length, maxSeconds * WAV_RATE)));
}
