# Phase 0 speech benchmark image. Same image runs on the desktop and on obur-lab.
FROM python:3.12-slim-bookworm
RUN pip install --no-cache-dir faster-whisper==1.1.1 av==13.1.0 psutil==6.1.1 requests==2.32.3 && pip freeze > /versions.txt
WORKDIR /bench
COPY bench.py /bench/
ENV HF_HOME=/models HF_HUB_DISABLE_TELEMETRY=1
ENTRYPOINT ["python", "-I", "/bench/bench.py"]
