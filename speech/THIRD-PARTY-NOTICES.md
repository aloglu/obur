# obur-speech: third-party components

obur's own code is MIT licensed (see the repository's `LICENSE`). The `obur-speech` image also contains other
people's software under their own licences. This file lists the components that need a notice. The image keeps a
copy of this file at `/app/THIRD-PARTY-NOTICES.md`.

## FFmpeg, x264 and x265 (through PyAV)

Speak decodes recordings with **PyAV 19.0.2** (BSD-3-Clause). The PyAV wheel bundles its own build of
**FFmpeg 9.0.2** (libavcodec 63.1.102, libavformat 63.1.102, libavutil 61.1.102, libswresample 7.1.102, and the
other FFmpeg libraries). In this build, FFmpeg reports its licence as LGPL version 3 or later
(`--enable-version3`). The same wheel also bundles **x264** (`libx264.so.165`) and **x265** (`libx265.so.217`),
which are GPL version 2 or later, and links FFmpeg against them (`--enable-libx264 --enable-libx265`).

Because of x264 and x265, treat these bundled libraries together as licensed under the **GNU GPL version 3 or
later**. obur uses them only to decode audio. It never encodes video.

Where to get the source code of this exact build:

- PyAV 19.0.2: <https://github.com/PyAV-Org/PyAV/tree/v19.0.2>
- The FFmpeg build that the PyAV 19.0.2 wheels bundle, with its configuration: <https://github.com/PyAV-Org/pyav-ffmpeg>
  (PyAV's build scripts at the tag above name the release it uses)
- FFmpeg 9.0.2: <https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz>
- x264: <https://code.videolan.org/videolan/x264>
- x265: <https://bitbucket.org/multicoreware/x265_git>

The full FFmpeg configuration line, as the bundled library reports it:

```
--disable-static --enable-shared --disable-programs --disable-doc --disable-libxml2 --disable-lzma
--disable-libtheora --disable-libfreetype --disable-libfontconfig --disable-libbluray --disable-libopenjpeg
--disable-mediafoundation --enable-version3 --enable-alsa --enable-gnutls --enable-libdav1d --enable-libmp3lame
--enable-libopus --enable-libsvtav1 --enable-libvmaf --enable-libvpx --enable-libwebp --enable-libxcb --enable-zlib
--enable-libx265 --enable-libx264 --enable-nvenc --enable-nvdec --enable-amf --enable-libvpl
--disable-encoder='avui,dca,mlp,opus,s302m,sonic,sonic_ls,truehd' --disable-decoder=sonic --disable-libjack
--disable-indev=jack --disable-filter=gfxcapture
```

The wheel's own software list (other bundled libraries, such as libopus, libvpx, libdav1d, GnuTLS and Nettle, with
their versions) is in the image at
`/usr/local/lib/python3.12/site-packages/av-19.0.2.dist-info/sboms/auditwheel.cdx.json`, and PyAV's licence at
`/usr/local/lib/python3.12/site-packages/av-19.0.2.dist-info/licenses/LICENSE.txt`.

## Other Python packages

faster-whisper (MIT), CTranslate2 (MIT), ONNX Runtime (MIT), tokenizers (Apache-2.0), huggingface_hub (Apache-2.0),
NumPy (BSD-3-Clause) and requests (Apache-2.0), at the versions in `requirements.txt` and `constraints.txt`. Each
package's licence is in its `*.dist-info` folder under `/usr/local/lib/python3.12/site-packages/`.

## The speech model

faster-whisper `small` (Systran's CTranslate2 conversion of OpenAI's Whisper small), MIT licence, downloaded at a
pinned revision by `fetch_model.py`.

When PyAV is updated, check this file again: run `python -I -c "import av; print(av.ffmpeg_version_info,
av.library_versions)"` in the image and read the bundled FFmpeg's licence and configuration.
