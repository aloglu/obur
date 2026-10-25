# Phase 0 OCR benchmark image (PaddleOCR PP-OCR models via ONNX Runtime, through RapidOCR).
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir rapidocr==3.9.2 onnxruntime==1.31.0 pillow-heif==1.8.1 psutil==6.1.1 && pip freeze > /versions.txt
WORKDIR /bench
ENTRYPOINT ["python", "-I"]
