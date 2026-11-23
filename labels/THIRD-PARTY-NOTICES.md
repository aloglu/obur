# obur-labels: third-party components

obur's own code (`service.py`, `fetch_models.py`) is MIT licensed; the licence is at the end of this file. The
`obur-labels` image also contains other people's software and models under their own licences. This file lists them
and where each licence is in the image. The image keeps a copy of this file at `/app/THIRD-PARTY-NOTICES.md`.

Python packages are in `/usr/local/lib/python3.12/site-packages/`; each one's licence is in its `*.dist-info` folder
(`licenses/` or the files named there), unless said otherwise below. Full texts of the common licences (Apache-2.0,
LGPL-2.1, MPL-2.0, BSD and others) are in `/usr/share/common-licenses/`.

## The OCR models

PaddleOCR PP-OCRv6 small, text detection and recognition, as PaddlePaddle's official ONNX exports
(`PaddlePaddle/PP-OCRv6_small_det_onnx` and `PaddlePaddle/PP-OCRv6_small_rec_onnx` on Hugging Face, at the revisions
pinned in `fetch_models.py`), **Apache License 2.0**. Copyright PaddlePaddle Authors. Source:
<https://github.com/PaddlePaddle/PaddleOCR>. The files are used as published; the recogniser's character list is
written from its `inference.yml`.

## OpenCV and the libraries it bundles (LGPL parts)

**OpenCV 5** through `opencv-python-headless` 5.0.0.93 (Apache-2.0). Its wheel bundles other libraries, among them
**FFmpeg** (libavcodec, libavformat, libavutil, libswresample, libswscale), licensed under the **GNU LGPL version 2.1
or later**. obur never uses OpenCV's video functions; the libraries are part of the wheel. OpenCV's own notice for
every bundled library, with FFmpeg's licence and where its source is, is in
`site-packages/cv2/LICENSE-3RD-PARTY.txt`, and OpenCV's licence in `site-packages/cv2/LICENSE.txt`. The bundled FFmpeg is
version **8.1.1** (read from the library itself, `av_version_info`, 2026-11-23). Source: the FFmpeg 8.1.1 release,
<https://ffmpeg.org/releases/ffmpeg-8.1.1.tar.xz>, and this exact build's scripts,
<https://github.com/opencv/opencv-python/tree/93>.

The headless build is used (2026-11-22): the full `opencv-python` also carried Qt 5 (LGPL-3.0) and needed the
system's OpenGL and GLib, none of which obur uses.

## Shapely and GEOS (LGPL)

**Shapely** 2.2.0 (BSD-3-Clause) bundles **GEOS** 3.14.1 (`shapely.libs/libgeos*.so`), licensed under the **GNU LGPL
version 2.1 or later**. Both licences are in `site-packages/shapely-2.2.0.dist-info/licenses/` (`LICENSE.txt`,
`LICENSE_GEOS`). GEOS source (version 3.14.1, read from the library): <https://github.com/libgeos/geos/tree/3.14.1>; Shapely's build scripts:
<https://github.com/shapely/shapely/tree/2.2.0>.

## Other Python packages

RapidOCR 3.9.2 (Apache-2.0; its licence text is Apache-2.0 in `/usr/share/common-licenses/Apache-2.0`, copyright
RapidAI), ONNX Runtime 1.31.0 (MIT; its own third-party notices, including Eigen under MPL-2.0, are in
`site-packages/onnxruntime/ThirdPartyNotices.txt`), NumPy (BSD-3-Clause; it bundles OpenBLAS, BSD-3-Clause, and the
GCC Fortran runtime, GPL-3.0 with the GCC Runtime Library Exception), Pillow (MIT-CMU), pyclipper (MIT; Clipper under
the Boost Software License), PyYAML (MIT), OmegaConf (BSD-3-Clause), six (MIT), tqdm (MPL-2.0 and MIT), requests
(Apache-2.0), urllib3 (MIT), idna (BSD-3-Clause), charset-normalizer (MIT), certifi (MPL-2.0), colorlog (MIT),
protobuf (BSD-3-Clause), flatbuffers (Apache-2.0) and packaging (Apache-2.0 or BSD-2-Clause), at the versions in
`requirements.txt` and `constraints.txt`.

## The base image

Debian 12 (bookworm) packages from the official `python:3.12-slim-bookworm` image, each under its own licence in
`/usr/share/doc/<package>/copyright`. Their source: <https://snapshot.debian.org/> or `apt-get source <package>`.

## obur's licence

```
MIT License

Copyright (c) 2026 Abdullah Aloğlu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
