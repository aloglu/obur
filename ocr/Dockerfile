# obur OCR service image: PP-OCRv6 small (ONNX) through RapidOCR, models baked in (pinned revisions, checksums
# checked).
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OCR_MODEL_DIR=/models/pp-ocrv6-small
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt constraints.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt -c /app/constraints.txt
COPY fetch_models.py /app/fetch_models.py
RUN python -I /app/fetch_models.py /models/pp-ocrv6-small
COPY service.py /app/service.py
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
	CMD python -I -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "-I", "/app/service.py"]
