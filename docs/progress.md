# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Current phase

**Phase 0 — Evidence and core-flow prototype** (not started; plan awaiting owner approval).

## Completed

- 2026-10-25: Repository initialised with `CLAUDE.md`, `docs/design.md`, this file and a `.gitignore` that excludes secrets and private data.

## In progress

- Phase 0 plan approved by the owner (2026-10-25).
- Owner has supplied the LoseIt export, 11 label photos and a favourite-foods list in `~/obur-private/`.
- Voice clip script written to `~/obur-private/audio/transcripts.tsv` (48 clips: 25 tr, 13 en, 10 mixed; 13 in harder conditions). Owner is recording.
- Server access: recommended an isolated Unraid VM rather than SSH to the Unraid host (host SSH is root and sees every share). Waiting for the owner.

## Validation results

None yet. No measurements have been taken.

## Exact next step

Step 0 (desktop hardware inventory), then step 1: inspect the LoseIt export with scripts in `spikes/loseit/` that print structure and coverage, not diary rows.

## Conventions for Phase 0

- Private inputs live outside the repo at `~/obur-private/` (see the plan for its layout). Nothing from it is committed.
- Throwaway probe scripts live in `spikes/` and never import from or get imported by `src/`. Their outputs that contain real data go to `~/obur-private/results/`; only aggregate numbers and redacted fixtures reach `docs/feasibility.md`.

## Unresolved questions

- Test phone: iPhone 13; iOS version not yet recorded.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).
- Off-site backup destination (needed in Phase 1, not Phase 0).

## Repository

- Local Git only; no remote yet. When a remote is added it must be **private** for now (owner decision, 2026-10-25). The rules about keeping private data and real hostnames out of the repo still apply as if it were public.
