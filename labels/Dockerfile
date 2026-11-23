# obur-labels image (label reading for Scan): PP-OCRv6 small (ONNX) through RapidOCR, models baked in (pinned
# revisions, checksums checked).
FROM python:3.12-slim-bookworm
# Where the source and the licences are, next to the image on the registry (2026-11-22 Gemini audit, G30).
LABEL org.opencontainers.image.source="https://github.com/aloglu/obur" \
	org.opencontainers.image.licenses="MIT AND Apache-2.0 AND BSD-3-Clause AND MPL-2.0 AND MIT-CMU AND LGPL-2.1-or-later" \
	org.opencontainers.image.description="obur-labels: label reading for obur Scan (third-party notices in /app/THIRD-PARTY-NOTICES.md)"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OCR_MODEL_DIR=/models/pp-ocrv6-small
COPY requirements.txt constraints.txt /app/
# A current pip for the build only, then none in the image: nothing at run time installs packages (2026-11-21 audit,
# A39).
RUN pip install --no-cache-dir pip==26.3 && \
	pip install --no-cache-dir -r /app/requirements.txt -c /app/constraints.txt && \
	pip install --no-cache-dir --no-deps rapidocr==3.9.2 && \
	pip uninstall -y pip
COPY fetch_models.py /app/fetch_models.py
RUN python -I /app/fetch_models.py /models/pp-ocrv6-small
COPY service.py THIRD-PARTY-NOTICES.md /app/
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
	CMD python -I -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "-I", "/app/service.py"]
