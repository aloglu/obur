# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Current phase

**Phase 0 — Evidence and core-flow prototype** (not started; plan awaiting owner approval).

## Completed

- 2026-10-25: Repository initialised with `CLAUDE.md`, `docs/design.md`, this file and a `.gitignore` that excludes secrets and private data.

## In progress

- Phase 0 plan presented to the owner; waiting for approval before running any probes.

## Validation results

None yet. No measurements have been taken.

## Exact next step

Owner approves (or amends) the Phase 0 plan and supplies the inputs listed in it. Then start with the LoseIt export inspection.

## Conventions for Phase 0

- Private inputs live outside the repo at `~/obur-private/` (see the plan for its layout). Nothing from it is committed.
- Throwaway probe scripts live in `spikes/` and never import from or get imported by `src/`. Their outputs that contain real data go to `~/obur-private/results/`; only aggregate numbers and redacted fixtures reach `docs/feasibility.md`.

## Unresolved questions

- Exact phone model(s) and OS versions to support.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).
- Off-site backup destination (needed in Phase 1, not Phase 0).
