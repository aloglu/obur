# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Current phase

**Phase 0 — Evidence and core-flow prototype** (not started; plan awaiting owner approval).

## Completed

- 2026-10-25: Repository initialised with `CLAUDE.md`, `docs/design.md`, this file and a `.gitignore` that excludes secrets and private data.

## In progress

- Phase 0 plan approved by the owner (2026-10-25).
- Owner has supplied the LoseIt export, 11 label photos and a favourite-foods list in `~/obur-private/`.
- 48 voice clips recorded (m4a) in `~/obur-private/audio/raw/`, matching `~/obur-private/audio/transcripts.tsv` (25 tr, 13 en, 10 mixed; 13 in harder conditions).
- Server access ready: SSH alias `obur-lab` (desktop `~/.ssh/config`) into the unprivileged `obur-lab` container; only `/work` (its appdata folder) is mounted. The owner's existing Cloudflare tunnel routes the pilot hostname to server port 8040 (done 2026-10-25); the container must be recreated with `-p 8040:8040` for the phone probe.
- Step 0 done: hardware recorded in `docs/feasibility.md`.
- Step 4 done (2026-10-25): owner ran the phone checklist; results in `docs/feasibility.md`. Probe stopped and its passkeys, sessions, logs and start script deleted from obur-lab; timing data kept in `~/obur-private/results/probe/`.
- Steps 2–3 done: speech and OCR benchmarked on desktop and server (`docs/feasibility.md`). Server OCR environment in `/work/ocr`, speech in `/work/speech`, probe and Node 24.11.0 (checksum-verified) in `/work/probe` and `/work/node`.
- Phone probe built and tested in desktop Chromium with a virtual authenticator (`spikes/phone-probe/`); waiting for server benchmarks to finish before the owner recreates the container with port 8040.
- A non-label photo (payment card) was found among the label photos; derived copies were deleted and the owner was told.
- Step 1 done: LoseIt export inspected (`docs/loseit-export.md`, summary in `docs/feasibility.md`). Aggregate output in `~/obur-private/results/`.

## Validation results

None yet. No measurements have been taken.

## Exact next step

Phase 0 is complete except the UI direction. Wait for the owner: (1) the chosen UI direction from the Claude app (record it in `docs/ui.md` with tokens); (2) a decision on the recommendations in `docs/feasibility.md` (speech small model, PP-OCRv6 small), then update `docs/design.md`; (3) approval to start Phase 1. The owner is also verifying `~/obur-private/labels-prepared/ground_truth.tsv`.

## Conventions for Phase 0

- Private inputs live outside the repo at `~/obur-private/` (see the plan for its layout). Nothing from it is committed.
- Throwaway probe scripts live in `spikes/` and never import from or get imported by `src/`. Their outputs that contain real data go to `~/obur-private/results/`; only aggregate numbers and redacted fixtures reach `docs/feasibility.md`.

## Unresolved questions


- Test phone: iPhone 13, iOS 27.0.1. Second authenticators for recovery tests: two YubiKeys.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).
- Off-site backup destination (needed in Phase 1, not Phase 0).

## Repository

- Local Git only; no remote yet. When a remote is added it must be **private** for now (owner decision, 2026-10-25). The rules about keeping private data and real hostnames out of the repo still apply as if it were public.
