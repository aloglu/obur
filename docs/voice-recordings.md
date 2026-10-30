# Voice: held-out recordings

Phase 2 step 8 needs recordings nobody has tuned anything against, to measure voice logging honestly. The 48 Phase 0
clips were used to choose the model and were read while writing the parser, so they no longer count. These new clips
are scored **once**, after the voice feature is finished; only then may they be used for improvements.

Nothing here goes into the repository: clips and their transcripts stay in `~/obur-private/audio/heldout/`.

## What to record

- **You:** about 30 clips. **A second person:** 15–20 clips, if someone is willing (see "Second speaker").
- **Your own words.** Say what you would actually say to log something, about real meals. Do not reuse the Phase 0
  sentences or examples from this project; vary how you phrase things.
- **A rough mix:** about 4 in 10 Turkish, 3 in 10 English, 3 in 10 mixed.
- **Include some of each:**
  - single foods with an amount and unit (grams, slices, cans, glasses, "bir tane", "yarım", "buçuk");
  - foods by brand, from what you really eat;
  - two or three foods in one sentence (about 5 clips);
  - a day or meal ("dün akşam", "geçen cuma", "for lunch") in about a third of them;
  - weight, water, burned calories and calories-only ("300 kalorilik bir şey") — about 6 clips together;
  - one or two that are vague on purpose ("biraz pilav yedim").
- **Conditions:** mostly quiet, but about a quarter harder: TV on, kitchen noise, phone at arm's length, outdoors,
  speaking fast.
- **Length:** natural; most will be 2–8 seconds. Nothing over 30 seconds.

## How

1. Record each clip with the iPhone Voice Memos app (as in Phase 0), one sentence per clip.
2. Copy them to `~/obur-private/audio/heldout/raw/`, named `h001.m4a`, `h002.m4a`, … (second speaker: `s001.m4a`, …).
3. In `~/obur-private/audio/heldout/transcripts.tsv`, one line per clip, tab-separated, with this header:

   ```
   clip	text	lang	conditions
   ```

   - `text`: exactly what was said, written normally (numbers as you would type them, "82,4" or "iki").
   - `lang`: `tr`, `en` or `mix`.
   - `conditions`: `quiet`, `tv`, `kitchen`, `arm`, `outdoors` or `fast`.

Please do not paste the sentences into our conversations before the voice feature is finished: once I have read them,
they stop being held-out.

## Second speaker

Tell them what it is for (testing speech recognition for a calorie app you run yourself), that the clips stay on your
computer, never go into the repository or to any service, and that you will delete them whenever they ask. Their
sentences should be their own words about their own food. If they would rather not, your clips alone still give a
useful (if one-voice) result.

## What I will report

For your clips and the second speaker's separately, and by language: how many clips come out completely right after
transcription and parsing (nothing to correct on the confirmation screen), how many numbers are right, the serious
errors (a wrong number or a wrong food that looks plausible), and the time from the end of speaking to the
confirmation screen. With about 30 clips, each percentage carries roughly ±9 points of uncertainty.
