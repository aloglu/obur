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

**Setup.** Ten real label photos from the owner's kitchen (an eleventh photo was not a label and was excluded and deleted). Values were read by hand from the photos (136 values over 16 nutrient columns; the owner spot-checked 5–6 of the 10 labels against the photos and found no errors, so this is not a full verification). Photos were converted to orientation-corrected JPEG with all metadata removed (the originals contain GPS location). The set includes curved packs, glare through plastic, very small print, two labels in running text rather than tables, %RI columns, bilingual rows, distractor tables in other languages and a distractor energy figure. Development data only. Scripts: `spikes/ocr/`; RapidOCR 3.9.2 on ONNX Runtime 1.31.0.

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

Tested on 2026-10-25 by the owner with the throwaway probe in `spikes/phone-probe/`, served from the target server through the owner's existing Cloudflare Tunnel at the pilot hostname. The RP ID was the parent domain. Owner observations plus server-side timings; the probe and all its credentials were deleted afterwards.

| Check | Result |
| --- | --- |
| HTTPS through Cloudflare Tunnel, RP ID = parent domain, origin = pilot subdomain | **Works** |
| Passkey creation and sign-in in Safari | **Works.** The owner's 1Password extension acts as passkey provider alongside Apple's sheet |
| Hardware keys | **Works.** Two YubiKeys registered and used, one over USB and one over NFC (single-device, not backed up) |
| Synced passkey | **Works** (multi-device, backed up), created inside the installed app |
| Remove one credential, sign in with another (simulated recovery) | **Works** |
| Installed app (Add to Home Screen) | Detected as standalone. **The session was shared with Safari**: already signed in. Passkey sign-in works inside it |
| Camera via file picker | No permission prompt; iOS delivers a 4032×3024 JPEG (≈2.8 MB), converted from HEIC |
| Live camera in the page | Permission prompt; full 3024×4032 frames (≈2 MB JPEG). **Capture felt slow, so the owner tapped repeatedly and several photos were uploaded.** Focus and torch capabilities were not recorded |
| Upload of a 2–3 MB photo through the tunnel | 0.8–2.2 s for the server to receive the body |
| Recording format | Safari's MediaRecorder produces `audio/mp4` (AAC-LC), about 23 KB per second |
| Voice, owner's own sentences (10 clips, 2.9–8.6 s) | Owner judged every transcript correct with both models (informal check, not scored). Server time: **small 3.5–3.9 s, large-v3-turbo 7.7–7.8 s** regardless of clip length. The server-side receive time was 12–45 ms because Cloudflare buffers the upload; **the phone-measured release→result time was shown on screen but not logged, so full end-to-end latency remains unmeasured** |
| Retry of an already-sent entry | **Works**: the server returned the original result (`replayed: true`) without creating a duplicate |
| Entries created in Airplane Mode | Each sent exactly once after reconnecting. **They were sent in the wrong order**, because the probe's queue was keyed by random IDs; the real queue must preserve creation order. **`navigator.onLine` reported online during Airplane Mode**, so offline state must be inferred from failed requests, not from that flag |
| Launch of the installed app while offline | **Failed**: black, then blank white screen. Cause not diagnosed. The probe's service worker fetched from the network first with no timeout. The Phase 1 offline work must use a cache-first app shell and re-test offline launch on the phone |
| Permission prompts in the installed app | The owner believes camera and microphone permission were asked again; not certain |
| OS reporting | Safari's user agent reports iOS 18.7 on iOS 27.0.1 (frozen string); do not use it to detect OS versions |

## UI direction

**Chosen: Pazar** (2026-10-25), from three directions explored by the owner in the Claude app using `spikes/ui/BRIEF.md`. The direction, its behaviour, tokens and open items are in `docs/ui.md`; the reference demo is `docs/ui/pazar-demo.dc.html` (read it for structure, it does not run outside its canvas).

## Recommendations

1. **Start Phase 1 (manual logging pilot).** Nothing measured in Phase 0 blocks it. Passkeys, YubiKey recovery, the installed app, the tunnel route and retry-safe creation all worked on the owner's phone.
2. **Speech: make faster-whisper `small` the Phase 2 starting point, not large-v3-turbo.** Configure Turkish-or-English language detection, a per-person prompt built from their frequent foods, and decoding once at temperature 0. On the target server this measured 77% of clips fully right in 4.3–4.8 s server time. large-v3-turbo is slightly more accurate but takes about 10 s per clip at best, and doubles under concurrent use. Keep the confirmation screen central: about one clip in four needs a correction, mostly brand names and mixed-language sentences. If better accuracy at the same speed is wanted later, evaluate whisper.cpp, which can shorten Whisper's fixed 30-second window. That would be a stack change and needs a separate decision.
3. **OCR: replace the design's PP-OCRv5 candidate with PP-OCRv6 small at about 1280 px.** It reads more values correctly and runs in about 2 s per label on the server. The label parser and plausibility checks must handle running text, distractor numbers and the `%`→`9` misread before any OCR feature ships.
4. **LoseIt import is feasible.** The per-day calorie totals give an exact acceptance check. Identity must use fingerprints with occurrence counting, deleted rows must be skipped, and the weight unit and time zone must be asked in the preview.
5. **Offline (Phase 1):** preserve queue order; do not trust `navigator.onLine`; use a cache-first app shell and re-test offline launch of the installed app on the iPhone early.
6. **Camera (Phase 3):** downscale on the phone to about 1280–2000 px before upload (OCR gains nothing above that, and uploads shrink from 2–3 MB); give immediate capture feedback and ignore repeated taps.
7. **Operations:** vendor and checksum model files during setup (`modelscope.cn` does not resolve on the owner's network; Hugging Face works); run the OCR and speech workers with telemetry disabled and no outbound network access.

## Gaps and evidence still needed

- Full phone release→result voice latency (server time is measured; upload over mobile data is not).
- A held-out voice set, ideally including another household member with consent, before trusting the 77% figure. All 48 Phase 0 clips were development data from one speaker.
- A full check of the hand-read label values (owner spot-checked 5–6 labels, no errors), and more labels toward 30.
- Cause of the failed offline launch.

## Voice, held-out evaluation (Phase 2 step 8, 2026-10-30)

**Data.** 46 new clips recorded after the voice feature was finished and scored once with `scripts/voice-eval.ts` (clips
and per-clip results stay in `~/obur-private/`): the owner, 31 clips (24 Turkish, 4 mixed, 3 English; 19 in harder
conditions) and a second speaker, 15 clips (all Turkish, nearly all quiet). Same speech image and settings as
production (faster-whisper small, int8, Turkish-or-English detection, beam 5, temperature 0), on the desktop limited to
4 cores. Owner's clips used a prompt rebuilt from his 30 most recently logged foods, as the server builds it; the second
speaker had no prompt (a new user). With 15–31 clips per group, each percentage is uncertain by roughly ±9–13 points.

| Speaker | Parse of the transcript = parse of the typed sentence | Numbers right | Transcript exact | p50 / max transcription |
| --- | --- | --- | --- | --- |
| Owner (31) | 11 (35%) | 26 (84%) | 5 (16%) | 1.0 s / 1.3 s |
| Second speaker (15) | 3 (20%) | 11 (73%) | 2 (13%) | 0.9 s / 1.0 s |

"Same parse" is strict: any difference in a food's words counts, including misspelt brands the catalog search might
still find. Read with the parser results below: voice is only as good as the parser on the typed sentence.

**Parser on the typed sentences (its first held-out test).** About 20 of 46 parse completely right; about 10 more have
the right day, meal and amounts but leftover words in a food name ("bu", "arasında", "tükettim"); about 16 are wrong.
The development and Phase 0 sentences (55/55, 47/48) overstated it: real phrasing is freer. Gaps found:

- a quantity after the verb ("…yedim, 200 gram", "…içtim, bir kutu"); separators "artı", "üzerine"; "yanımda";
- day and meal phrases: "bu akşam/öğlen", "öğle arasında", "az önce", "iki akşam önce", "gece", "son öğün",
  "yatmadan önce";
- "çeyrek" (a quarter); "porsiyon", "tabak", "avuç" as count words; "tükettim" as a verb; "kilo geldim";
- descriptive sentences ("…salata yaptım", "yediğim yemekte … vardı") and counts that are not amounts
  ("iki şekerli bir bardak çay", "Torku No 1").

**Errors added by speech.** Brand and product names (Coke Zero, Untad, SEK, San Pellegrino, Heinz, Wasa, Eker, Torku);
"ara öğün" heard as "arayın" (4 of the second speaker's clips, which loses the meal); "yarım" heard as "yarın" (a wrong
amount); "kutu kola" run together; "250 kalorilik" garbled. No wrong number was invented without a visible change on
the confirmation screen, but "yarın"/"yarım" and lost trailing amounts are the serious kind.

**Latency.** Transcription about 1 s per clip on 4 desktop cores; the owner's phone check on the server: about 2–3 s
from Done to the confirmation screen for a long two-item sentence.

**Next.** These 46 clips are now development data. Improvements to the parser gaps above and a fixed bilingual
vocabulary in the prompt (meal and unit words) can be measured on them; a later, smaller fresh set is needed for the
next held-out number.

**Improvement round (same day, on these 46 clips as development data).** Parser gaps closed with new development
sentences (80 cases), and a fixed bilingual prompt of meal, amount and unit words placed before each person's foods.
The prompt is written as ordinary sentences: a comma-separated word list made Whisper put commas between words, which
split items, and lowered the owner's numbers from 87% to 77%. Three prompt variants were tried on these clips, so the
figures below are tuned on them and overstate what new recordings would show; the example sentence also shares common
words (ekmek, tavuk, kola, kraker) with some clips.

| Speaker | Same as typed | Numbers right | Transcript exact |
| --- | --- | --- | --- |
| Owner (31), before → after | 35% → 61% | 84% → 97% | 16% → 42% |
| Second speaker (15), before → after | 20% → 33% | 73% → 93% | 13% → 27% |

The serious "yarım" → "yarın" error and "ara öğün" → "arayın" no longer occur on these clips. Remaining: brand names
(Untad, San Pellegrino, Heinz, Eker), descriptive sentences, and days the recogniser drops ("Bugün" heard as "Ben").
A fresh set of 10–15 clips is needed for the next held-out number.

## Label scanning, held-out evaluation (Phase 3, 2026-10-30)

**Setup.** Parser frozen at commit `7884d6f` (developed only on the 10 Phase 0 labels). Twelve new photos from the
owner (2026-10-30), prepared like Phase 0 (orientation-corrected, metadata removed) and sent as the phone sends them
(1600 px JPEG, quality 88) through the production OCR service (PP-OCRv6 small at 1280 px, the `ocr/` image). Values
were read by hand from the photos (zooming where the print was small) before the OCR or parser was run on them, and
scored once. One photo is a second picture of a development product (the fruit mix, L10); it is counted but noted.
Private data stays in `~/obur-private`.

| | Development (10 labels) | Held-out (12 labels) |
| --- | --- | --- |
| Values right (per 100 g/ml column) | 85% (72/85) | **61% (63/104)** |
| Wrong values (serious) | 0 | **14** (13%) |
| Missing (left unknown) | 13 | 27 |
| Basis right | 10/10 | 8/12 (4 left unset) |
| Labels fully right | 8/10 | 2/12 (one the repeat) |
| OCR time per label (desktop) | 0.3–0.6 s | similar |

**Failure categories (held-out).**
- *Rows shifted by one (8 of the 14 wrong values):* energy printed on two lines ("1358 kJ" / "338 kcal") and German
  two-line rows ("Fett / davon gesättigte Fettsäuren") add a value line the drift-following assignment pairs with the
  next row. This is the most serious failure: confident values under the wrong nutrient.
- *Energy written kcal first with units ("92,2 kcal/389,6 kj"):* kJ and kcal swapped (2). The units were in the text
  but the parser used the column label's order. The kJ/kcal check flagged it.
- *Row names over two lines* (a six-language table): a row read the next row's number (2).
- *Bare %RA numbers* ("19", "16" without %): one taken as saturated fat (flagged: saturates above fat).
- *Missing:* very small or dim print the OCR did not read (one label nothing at all), German names not in the list
  ("davon Zucker", "Eiweiß" with ß), a two-line energy row.
- *Basis:* when the basis is only in the title ("Enerji ve Besin Öğeleri (100g'da)") or in a single header cell, the
  parser left it unset; the Scan screen then defaulted to per 100 g, which it should not do silently.

**Conclusion.** Not good enough to ship: the serious-error gate (`docs/design.md`, evaluation) requires the known
unflagged wrong values to be fixed first. The fixes are specific (explicit energy units, value lines that belong to
no row, two-line names, basis from the title, no silent basis). After an improvement round these 12 photos become
development data, so a fresh set of about 10 is needed for the next honest held-out number.

**Improvement round (2026-10-30), after the held-out score.** The 12 photos are now development data. Changes, all
general: row names must share the table's left edge (per-portion badges beside a table are ignored); values must sit
clearly right of the names; a line of kJ or kcal belongs to the energy row (two-line energy) and a line of grams never
does; units written beside the values decide kJ against kcal; "davon / of which / bunlardan" before a name and ß are
handled; names after a slash in bilingual rows count; a name must end its word ("Fett" is not "Fettsäuren"); a
name-column line that is no nutrient (a misread "Lif", a vitamin) keeps its numbers; a second line of a name belongs to
its row; a short bracket after a name is its unit, never a value ("(g)" read as "(9)"); with only %RI columns the
amounts are the numbers left of them; the basis comes from the title when no column says it; a value may follow the
drift so far or sit level with its row, and a tie goes to the row above. The energy check now counts a "less than"
value at its bound instead of skipping the check, and the Scan screen says when the basis wasn't read.

| Same OCR output, parser after the round | Phase 0 labels | The 12 new photos (no longer held out) |
| --- | --- | --- |
| Values right | 84% (71/85) | 77% (80/104) |
| Wrong values | 1 | 3 |
| Of those, flagged by a warning on the same label | 0 | 3 (2 by the value itself) |
| Basis right | 10/10 | 12/12 |
| Labels fully right | 7/10 | 5/12 |

Noisier OCR on the Phase 0 labels also improved (2000 px: 2 → 1 wrong; tiny model: 9 → 2 wrong). Every remaining wrong
value is an OCR misread that dropped a decimal comma or digit ("2,5" → "25", "7,8" → "8", "2,2" → "22"); the parser
cannot see these, the person checks every value against the photo, and the warnings catch the large ones. Missing
values (21 on the new photos) are mostly very small or pale print the OCR did not read; they stay empty. An honest
held-out number now needs new photos (the owner has few new products: options are counting edits in real use, a
friend's kitchen, or new purchases over time).

## Blurry label photos (2026-11-07)

Question: can the OCR service tell a photo too blurry to read from a sharp one, without calling sharp photos blurry?

Method: the owner's 22 label photos (10 development, 12 held-out), each redrawn at 1600 px as the phone does, then blurred with a Gaussian of radius 0, 1, 1.5, 2, 3 and 4 px (132 images), read by the deployed OCR configuration (PP-OCRv6 small, 1280 px) on the desktop, parsed, and scored against the hand-read values (seven fields). Sharpness: at the 1 % strongest edges of the service's 1280 px copy, the mean absolute Laplacian over the mean gradient (unchanged by contrast, lowered by blur).

| Blur radius | Sharpness range | Labels read with at least 5 of 7 right | Labels with a wrong value |
| --- | --- | --- | --- |
| none (real photos) | 0.26–0.53 | 17 of 22 | 4 |
| 1 px | 0.15–0.32 | 17 | 3 |
| 1.5 px | 0.11–0.20 | 15 | 4 |
| 2 px | 0.09–0.14 | 3 | 4 |
| 3 px | 0.07–0.10 | 1 | 0 |
| 4 px | 0.07–0.11 | 0 | 0 |

Findings: no real photo measured below 0.26; from 2 px, where reading mostly fails, every copy measured 0.14 or below. Between 0.15 and 0.20 some copies were still read correctly, so the measure cannot predict a failed read on its own. Blurred copies that were read gave wrong values more often (up to 4 of 7 on one label).

Decision (provisional): below 0.16 a photo is called blurry. With nothing read, the scan page says the photo is blurry instead of "no table found"; with values read, Check the label opens with a note that values may be misread. Limits: the blur was artificial (a Gaussian), not camera shake or a missed focus; 22 labels; one OCR configuration. Revisit with real blurry photos if the message appears wrongly or not at all.

## Weight trend, development evaluation (Phase 4, 2026-10-31)

Question: how far a smoothed weight is from what the scale says. Data: the owner's 150 LoseIt weigh-ins (266 days,
median gap 1 day, longest 9 days, −48,6 kg overall; private, aggregates only). Each method estimates the next
weigh-in from earlier ones only; the first 14 days are skipped while methods settle. "Bias" is the mean of reading
minus estimate (negative: the estimate is heavier than the scale). "Rises" counts steps where the estimate went up by
more than 0,05 kg (raw readings rose on 44 of 149 steps).

| Method | Average miss | Bias | Rises | Last 60 days: miss / bias |
| --- | --- | --- | --- | --- |
| Exponential smoothing, 10 % a day (first build) | 2,15 kg | −2,13 | 1 | 2,04 / −1,82 |
| Exponential smoothing, 20 % a day | 1,23 kg | −1,14 | 7 | 1,31 / −1,01 |
| Average of the last 7 days | 1,02 kg | −0,91 | 5 | 1,13 / −0,80 |
| Holt, 10 % / 5 % a day, undamped | 0,81 kg | −0,19 | 2 | 1,09 / +0,47 |
| Line through the last 14 days | 0,74 kg | −0,02 | 16 | 1,16 / +0,14 |
| **Holt, 15 % / 10 % a day, pace damped 2 % a day (chosen)** | **0,71 kg** | **−0,29** | **4** | **0,91 / −0,02** |

Plain smoothing lags about (1 − α)/α days behind a steady loss, so at about 1,3 kg a week it read 2 kg heavy; the
first build was replaced. Holt's method smooths a level and a pace; damping keeps it from assuming full-speed loss
across long gaps. The chosen settings are round values near the best of a small grid (level 0.80–0.95, pace
0.90–0.98, damping 0.95–1.00), not the single best fit. Most of the remaining miss is day-to-day water and food,
which no method removes. Limits: one person, one fast-loss period, tuned on the same data; this is development
evidence, not a held-out result. Recheck with other people's histories or a maintenance period before claiming it
generally.

**Simulated histories (2026-10-31).** To check the settings beyond one person, 300 random runs each of ten made-up
histories with a known true weight; scale noise carries over from day to day (water: e = 0.5·e(previous day) +
N(0, sd), sd 0,5 kg unless noted). Mean distance from the true weight at each weigh-in after the first three weeks:

| Scenario | Trend (chosen) | Raw reading | 7-day average | First build | Trend at the latest weigh-in: mean / worst 5 % |
| --- | --- | --- | --- | --- | --- |
| Fast loss 1,3 kg/wk, daily | 0,30 | 0,46 | 0,58 | 1,66 | +0,17 / 0,74 |
| Slow loss 0,3 kg/wk, daily | 0,26 | 0,46 | 0,29 | 0,39 | +0,02 / 0,63 |
| Maintenance, daily | 0,25 | 0,46 | 0,27 | 0,17 | +0,01 / 0,70 |
| Loss, then plateau | 0,27 | 0,46 | 0,32 | 0,56 | −0,03 / 0,67 |
| Loss, then regain | 0,30 | 0,46 | 0,35 | 0,71 | −0,09 / 0,74 |
| Weekly weigh-ins, 0,5 kg/wk | 0,35 | 0,46 | 0,46 | 0,49 | +0,06 / 0,90 |
| Twice a week, 0,8 kg/wk | 0,31 | 0,47 | 0,38 | 0,86 | +0,09 / 0,73 |
| Daily with a four-week gap | 0,28 | 0,46 | 0,37 | 0,82 | +0,10 / 0,68 |
| Noisy scale (sd 1,2), 0,7 kg/wk | 0,63 | 1,11 | 0,70 | 0,92 | +0,15 / 1,56 |
| Water spikes of +1,5 kg, 0,7 kg/wk | 0,39 | 0,58 | 0,52 | 1,06 | +0,26 / 1,08 |

The chosen trend is closer to the true weight than a single reading in every case, and closer than a 7-day average
in every case; plain smoothing is better only when weight is flat. No case showed a lasting lag or overshoot. These
are simulations with assumed noise, not people; real histories from other people remain the better check.
