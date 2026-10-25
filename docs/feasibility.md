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

Not measured yet.

## Speech (faster-whisper)

Not measured yet.

## Label OCR (PaddleOCR via ONNX Runtime)

Not measured yet.

## Phone, HTTPS and passkeys (iPhone 13, iOS 27.0.1)

Not measured yet.

## UI direction

Not chosen yet.

## Recommendations

Not written yet.
