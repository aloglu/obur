# Phase 0 feasibility results

Evidence gathered in Phase 0 (`docs/design.md`, Roadmap). Anything marked **Not measured yet** is a placeholder, not a result. Raw per-sample results containing personal data stay outside the repository.

## Hardware and environment

| | Development desktop | Target home server |
| --- | --- | --- |
| CPU | AMD Ryzen 7 9800X3D, 8 cores / 16 threads | Intel Core i3-1115G4, 2 cores / 4 threads, 4.1 GHz max; AVX2, AVX-512F, AVX-512 VNNI |
| RAM | 60 GiB | 15 GiB total, about 11 GiB available alongside the owner's existing services (2026-10-25) |
| Storage | NVMe SSDs (btrfs) | Unraid array via shfs; device type for the benchmark folder not yet confirmed |
| OS / kernel | Omarchy (Arch), Linux 7.2.8 | Unraid, Linux 6.18.58 |
| Runtime | Docker 29.9.2 | Docker on Unraid; probes run in an unprivileged Debian 13 container (`obur-lab`) that sees only its own appdata folder |
| GPU | Not used (no working driver; the target has none) | None |

Benchmarks use the same container image, model files and settings on both machines. The server is shared with other services, so its measurements include their background load; this is recorded per run.

## LoseIt export

Full findings: `docs/loseit-export.md`. Summary:

- **Importable with good fidelity for diary history.** 2,420 active diary rows over 270 days. Each row carries its own nutrient totals, and those rows reproduce LoseIt's daily food calories exactly on all 274 summary days. That gives the importer a strong acceptance check.
- **Identity is weak.** No entry IDs, no food IDs, no times. Overlap handling must use fingerprints with occurrence counting, and real repeated meals exist in the data.
- **Traps the importer must handle:** included deleted rows, `n/a` vs `0`, thousands commas in calories, inconsistent unit names, count-only units, and `M/D/YYYY` dates without a zone.
- **Not recoverable from the export:** recipe ingredients (the recipe rows are also malformed), the weight unit (the owner confirmed kg for this export; the importer must ask), and the meaning of the device calorie-bonus values. The date range is complete: the owner's LoseIt history begins in January 2026.

## Speech (faster-whisper)

**Setup.** 48 clips recorded by the owner on the iPhone (Voice Memos, AAC 48 kHz mono, 1.3–7.2 s, mean 3.6 s): 25 Turkish, 13 English and 10 mixed sentences built from the owner's real foods, 13 of them in harder conditions (TV, kitchen noise, arm's length, fast speech). One speaker, all development data: there is no held-out set yet, so every number below is an optimistic upper bound with roughly ±7 percentage points of uncertainty per figure. faster-whisper 1.1.1, CTranslate2 4.8.3, int8, beam 5 unless stated. Scripts: `spikes/speech/`.

**Scoring.** Reference and output are normalised the same way (Turkish-aware lowercasing, number words to digits, comma/dot decimals, `g`/`gram`/`grams` unified). *Clip fully right* means every number is right and every food, brand, unit and date word is present: exactly, or close enough (≥ 0.8 similarity after Turkish letter folding) that catalog matching could recover it. That is the closest proxy for "the confirmation screen needs no edit".

| Configuration (desktop, 16 threads) | Numbers right | Clip fully right | Turkish / English / mixed | p50 latency |
| --- | --- | --- | --- | --- |
| small, auto language | 92% | 60% | 68% / 69% / 30% | 0.7 s |
| medium, auto language | 98% | 67% | 76% / 77% / 30% | 1.7 s |
| large-v3-turbo, auto language | 100% | 75% | 84% / 77% / 50% | 2.5 s |
| **large-v3-turbo, auto, brand prompt** | **100%** | **81%** | **80% / 100% / 60%** | **2.4 s** |
| large-v3-turbo, forced Turkish, brand prompt | 100% | 79% | 80% / 100% / 50% | 1.4 s |
| large-v3-turbo, forced Turkish, no prompt | 92% | 67% | 84% / 54% / 40% | 1.4 s |

Findings:

- large-v3-turbo is clearly the most accurate candidate. Numbers, including decimal commas, halves and "yüzde on", were right in every clip with the prompt.
- **Forcing Turkish without a prompt breaks English sentences; with the brand prompt it does not**, and it skips language detection, which is a large share of the time.
- **The brand prompt helps** (75% → 81%), but it listed exactly the brands in the test sentences. That mirrors the intended design (prompting with each person's frequent foods) and also flatters this result.
- Remaining errors are mostly brand and product words: "Untad" → "un tatlı", "Wasa" → "basa", "Delly" → "deli", "peynir" → "painter", "körpe ıspanak" → "kürtpil spanak", "bar" → "var". **Mixed-language sentences are the weakest category** (50–60% at best).
- Shortening Whisper's 30-second window (`chunk_length`) had no effect: CTranslate2 still processes a full 30 s window for a 3 s clip, so this cost is fixed on this engine.

**Target server (i3-1115G4, 4 threads, owner's other services running at light load).** Latency is per clip on the server only (decode plus transcription, model warm); phone upload is measured separately in the probe.

| Configuration | Numbers right | Clip fully right | Turkish / English / mixed | p50 | p95 | Worst | Peak memory |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small, auto language | 90% | 56% | 64% / 69% / 20% | 4.1 s | 4.5 s | 37.6 s | 1.5 GB |
| small, auto language, brand prompt | 96% | 77% | 80% / 92% / 50% | 3.8 s | 4.4 s | 35.1 s | 1.3 GB |
| **small, Turkish-or-English detection, brand prompt, no fallback** | **98%** | **77%** | **80% / 92% / 50%** | **4.3 s** | **4.6 s** | **4.8 s** | **0.8 GB** |
| small, forced Turkish, brand prompt | 94% | 60% | 80% / 31% / 50% | 2.6 s | 7.7 s | 13.7 s | 1.4 GB |
| large-v3-turbo, auto language | 98% | 71% | 80% / 69% / 50% | 19.1 s | 21.3 s | 27.1 s | 2.7 GB |
| large-v3-turbo, forced Turkish | 92% | 67% | 80% / 54% / 50% | 9.6 s | 12.9 s | 13.7 s | 2.2 GB |
| large-v3-turbo, forced Turkish, brand prompt | 100% | 79% | 80% / 100% / 50% | 9.7 s | 10.0 s | 12.4 s | 2.1 GB |
| the same, two requests at once | 100% | 79% | 80% / 100% / 50% | 19.6 s | 24.3 s | 25.3 s | 2.3 GB |

Findings on the server:

- **large-v3-turbo cannot meet the 5 s target on this CPU.** It takes about 8× longer than on the desktop. Its best setting is still about 10 s per clip, and two people speaking at once double each wait.
- **The small model with a brand prompt nearly matches turbo's accuracy here (77% vs 79% of clips fully right) at under half the time.** The gap is in mixed sentences and in brand words.
- **Unrestricted language detection is a real failure mode.** On a mixed English/Turkish clip the small model detected Persian, produced Arabic-script nonsense and spent 35 s on temperature-fallback retries. Restricting detection to Turkish or English and decoding once at temperature 0 removed the outlier: worst case 4.8 s, accuracy unchanged.
- Quality on the server is slightly lower than on the desktop for some configurations, consistent with int8 kernels differing by CPU. Evaluate on the target hardware.

**Conclusion so far.** The provisional voice target (p95 at most 5 s after the clip ends) is met **only** by the small model, and only on the server side, with about 0.4 s to spare for upload. About three in four clips need no correction, with mixed-language sentences the weakest. End-to-end phone timings are pending (probe).

## Label OCR (PaddleOCR via ONNX Runtime)

**Setup.** Ten real label photos from the owner's kitchen (an eleventh photo was not a label and was excluded and deleted). Values were read by hand from the photos (136 values over 16 nutrient columns; owner verification pending). Photos were converted to orientation-corrected JPEG with all metadata removed (the originals contain GPS location). The set includes curved packs, glare through plastic, very small print, two labels in running text rather than tables, %RI columns, bilingual rows, distractor tables in other languages and a distractor energy figure. Development data only. Scripts: `spikes/ocr/`; RapidOCR 3.9.2 on ONNX Runtime 1.31.0.

Models:
- **A:** PP-OCRv5 mobile detector + Latin PP-OCRv5 mobile recogniser (the design's named candidate), converted to ONNX locally from PaddlePaddle's Hugging Face release with paddle2onnx 2.1.0 / paddlepaddle 3.3.0.
- **B:** PP-OCRv6 small detector + recogniser.
- **C:** PP-OCRv6 tiny detector + recogniser.

B and C are PaddlePaddle's official ONNX exports. All three character sets include every Turkish letter. The text-orientation classifier was off.

*Readable* means the correct number appears anywhere in the OCR output. *Extracted right/wrong* uses a deliberately naive row reader, not the planned label parser.

| Desktop, 16 threads | Readable non-zero values | Extracted right | Extracted wrong | Labels fully right | p50 per image | Peak memory |
| --- | --- | --- | --- | --- | --- | --- |
| A at 2000 px | 78% | 62% | 13% | 2/10 | 0.56 s | 1.0 GB |
| **B at 1280 px** | **90%** | **71%** | 14% | 4/10 | **0.39 s** | 0.6 GB |
| B at 2000 px | 90% | 66% | 18% | 3/10 | 0.62 s | 0.9 GB |
| C at 2000 px | 86% | 62% | 19% | 3/10 | 0.29 s | 0.7 GB |

Findings:

- **PP-OCRv6 small reads labels clearly better than the PP-OCRv5 Latin model the design named.** The design's choice of "PaddleOCR mobile models" should become PP-OCRv6 small, pending server timings.
- Higher resolution did not help consistently; 1280–2000 px is enough.
- **Serious OCR failure mode: `%` read as `9`**, turning "%28" into "9628" on a curved pouch. Combined with row merging on curved packs, this produces confident wrong numbers. The design's plausibility checks (mass and energy consistency, %RI column detection) are required, not optional.
- Most "extracted wrong" results come from the naive reader, not the OCR: on the running-text turkey label every value was read correctly, but the reader mistook a best-before date for energy. The real parser must handle running text, multiple bases and distractor numbers.
- **Server timings (i3-1115G4, 4 threads), same accuracy as the desktop:**

  | Server | p50 per image | Worst | Peak memory |
  | --- | --- | --- | --- |
  | A (PP-OCRv5 Latin) at 1280 / 2000 px | 2.0 / 4.3 s | 3.3 / 5.6 s | 0.4 / 0.7 GB |
  | **B (PP-OCRv6 small) at 1280 px** | **1.9 s** | **3.3 s** | **0.5 GB** |
  | B at 2000 px | 2.5 s | 4.3 s | 0.7 GB |
  | C (PP-OCRv6 tiny) at 1280 / 2000 px | 0.7 / 1.0 s | 1.1 / 1.5 s | 0.3 / 0.6 GB |

  PP-OCRv6 small at 1280 px fits the provisional 10 s scan target with wide margin before upload time.

**Runtime notes.**
- RapidOCR's default model host (`modelscope.cn`) did not resolve on the owner's network. Models were fetched from PaddlePaddle's Hugging Face repositories instead; pin and vendor model files during setup.
- **ONNX Runtime 1.31 includes a telemetry component** that logged an attempt to persist a device ID. The production OCR worker must disable it and run without outbound network access, consistent with the no-telemetry rule. No outbound connections from the OCR process were observed on the server during the full benchmark (sampled every 0.5 s), which is evidence, not proof; the network lockdown is still required.

## Phone, HTTPS and passkeys (iPhone 13, iOS 27.0.1)

Not measured yet.

## UI direction

Not chosen yet.

## Recommendations

Not written yet.
