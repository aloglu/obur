# obur-speech: third-party components

obur's own code is MIT licensed (see the repository's `LICENSE`). The `obur-speech` image also contains other
people's software under their own licences. This file lists them. The image keeps a copy of this file at
`/app/THIRD-PARTY-NOTICES.md` and the licence texts in `/app/licenses/`.

Speak makes a 16 kHz WAV recording on the phone, so this image has no media decoder: no FFmpeg, no PyAV and no GPL
code (2026-11-22 audits A11, G02 and G03; until then, PyAV's FFmpeg build was in the image).

## CTranslate2 4.8.3 (the speech engine)

- **CTranslate2** (MIT, © SYSTRAN): `licenses/CTranslate2-MIT.txt`. Source: <https://github.com/OpenNMT/CTranslate2/tree/v4.8.3>.
  The published Linux x86-64 wheel has these parts built into its library (`ctranslate2.libs/libctranslate2-*.so`):
- **Intel oneAPI Math Kernel Library (oneMKL)**, binary only, under the **Intel Simplified Software License
  (Version October 2022)**: `licenses/Intel-Simplified-Software-License.txt`. Copyright © Intel Corporation.
  CTranslate2 4.8.3's build script installs oneMKL 2025.3.0. obur redistributes it unmodified, inside CTranslate2's
  published wheel.
- **oneDNN 3.1.1** (Apache-2.0, © Intel Corporation): `licenses/oneDNN-Apache-2.0.txt`. Source:
  <https://github.com/uxlfoundation/oneDNN/tree/v3.1.1>.
- **spdlog** at commit `76fb40d` (MIT, © Gabi Melman): `licenses/spdlog-MIT.txt`. Source:
  <https://github.com/gabime/spdlog/tree/76fb40d95455f249bd70824ecfcae7a8f0930fa3>.
- **GNU OpenMP runtime** (`ctranslate2.libs/libgomp-*.so`), part of GCC: GPL version 3 with the GCC Runtime Library
  Exception, which allows its distribution with other software under any licence. Source: <https://gcc.gnu.org/>.

## Other Python packages

- **faster-whisper 1.1.1** (MIT, © SYSTRAN): `licenses/faster-whisper-MIT.txt`. Source:
  <https://github.com/SYSTRAN/faster-whisper/tree/v1.1.1>. Changed at build time by `strip_imports.py`: the imports
  of PyAV, huggingface_hub and requests are removed (obur never uses the parts that need them).
- **tokenizers 0.23.3** (Apache-2.0, © Hugging Face): `licenses/tokenizers-Apache-2.0.txt`.
- **NumPy 2.5.4** (BSD-3-Clause, with bundled OpenBLAS and other parts listed in its own licence file), **PyYAML
  6.0.3** (MIT) and **tqdm 4.70.1** (MPL-2.0 and MIT). Each package's licence is in its `*.dist-info` folder under
  `/usr/local/lib/python3.12/site-packages/`.

## The speech model

**faster-whisper `small`**: Systran's CTranslate2 conversion of OpenAI's Whisper small, MIT licence (© OpenAI):
`licenses/whisper-model-MIT.txt`. Downloaded at a pinned revision, with checksums, by `fetch_model.py`.

## The base image

`python:3.12-slim-bookworm`: Python (PSF licence) on Debian 12. The Debian packages' copyright files are in
`/usr/share/doc/*/copyright`.

When a package is updated, check this file again. For CTranslate2, read its build script
(`python/tools/prepare_build_environment_linux.sh` at the new tag) for the oneMKL and oneDNN versions.
