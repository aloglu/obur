# obur speech service image: faster-whisper small with the model files baked in (pinned revision, checksums checked).
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
	HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 \
	SPEECH_MODEL_DIR=/models/faster-whisper-small
COPY requirements.txt constraints.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt -c /app/constraints.txt
COPY fetch_model.py /app/fetch_model.py
RUN python -I /app/fetch_model.py /models/faster-whisper-small
COPY service.py /app/service.py
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
	CMD python -I -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "-I", "/app/service.py"]
