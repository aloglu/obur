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
- Server access ready: SSH alias `obur-lab` (desktop `~/.ssh/config`) into the unprivileged `obur-lab` container; only `/work` (its appdata folder) is mounted. Port 8040 will be published when the phone probe starts; the owner routes the pilot hostname to it through their existing Cloudflare tunnel.
- Step 0 done: hardware recorded in `docs/feasibility.md`.
- Step 1 done: LoseIt export inspected (`docs/loseit-export.md`, summary in `docs/feasibility.md`). Aggregate output in `~/obur-private/results/`.

## Validation results

None yet. No measurements have been taken.

## Exact next step

Step 2: speech benchmark (faster-whisper) in a shared Docker image under `spikes/speech/`, desktop first, then `obur-lab`.

## Conventions for Phase 0

- Private inputs live outside the repo at `~/obur-private/` (see the plan for its layout). Nothing from it is committed.
- Throwaway probe scripts live in `spikes/` and never import from or get imported by `src/`. Their outputs that contain real data go to `~/obur-private/results/`; only aggregate numbers and redacted fixtures reach `docs/feasibility.md`.

## Unresolved questions

- LoseIt: weight unit (kg suspected), diary time zone (Europe/Istanbul suspected), whether pre-2026 history exists.

- Test phone: iPhone 13, iOS 27.0.1.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).
- Off-site backup destination (needed in Phase 1, not Phase 0).

## Repository

- Local Git only; no remote yet. When a remote is added it must be **private** for now (owner decision, 2026-10-25). The rules about keeping private data and real hostnames out of the repo still apply as if it were public.
