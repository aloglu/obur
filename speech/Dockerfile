# obur-speech image (speech to text for Speak): faster-whisper small with the model files baked in (pinned revision, checksums checked).
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
	HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 \
	SPEECH_MODEL_DIR=/models/faster-whisper-small
COPY requirements.txt constraints.txt /app/
# A current pip for the build only, then none in the image: nothing at run time installs packages (2026-11-21 audit,
# A39).
RUN pip install --no-cache-dir pip==26.3 && \
	pip install --no-cache-dir -r /app/requirements.txt -c /app/constraints.txt && \
	pip uninstall -y pip
COPY fetch_model.py /app/fetch_model.py
RUN python -I /app/fetch_model.py /models/faster-whisper-small
COPY service.py THIRD-PARTY-NOTICES.md /app/
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
	CMD python -I -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "-I", "/app/service.py"]
