# obur-speech image (speech to text for Speak): faster-whisper small with the model files baked in (pinned revision, checksums checked).
FROM python:3.12-slim-bookworm
# Where the source and the licences are, next to the image on the registry (2026-11-22 Gemini audit, G30).
LABEL org.opencontainers.image.source="https://github.com/aloglu/obur" \
	org.opencontainers.image.licenses="MIT AND Apache-2.0 AND LicenseRef-Intel-Simplified-Software-License" \
	org.opencontainers.image.description="obur-speech: speech to text for obur Speak (third-party notices in /app/THIRD-PARTY-NOTICES.md)"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
	SPEECH_MODEL_DIR=/models/faster-whisper-small
COPY requirements.txt constraints.txt strip_imports.py /app/
# A current pip for the build only, then none in the image: nothing at run time installs packages (2026-11-21 audit,
# A39). --no-deps: only the listed packages (no PyAV, onnxruntime or huggingface_hub; 2026-11-22 audits A11, G02, G03).
RUN pip install --no-cache-dir pip==26.3 && \
	pip install --no-cache-dir --no-deps -r /app/requirements.txt -c /app/constraints.txt && \
	pip uninstall -y pip && \
	python -I /app/strip_imports.py && \
	python -I -c "import faster_whisper, sys; bad = {'av', 'huggingface_hub', 'requests', 'onnxruntime'} & set(sys.modules); sys.exit(f'still loaded: {bad}' if bad else 0)"
COPY fetch_model.py /app/fetch_model.py
RUN python -I /app/fetch_model.py /models/faster-whisper-small
COPY service.py THIRD-PARTY-NOTICES.md /app/
COPY licenses /app/licenses
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
	CMD python -I -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "-I", "/app/service.py"]
