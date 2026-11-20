#!/bin/bash
# Checks an add-on image before it is published: it becomes healthy and reads one input. obur-labels must read
# "250 kcal" from a drawn label; obur-speech must transcribe one second of silence (an empty text is right: the model
# loaded and ran). Usage: deploy/addon-test.sh <image> speech|labels
set -euo pipefail
image=${1:?usage: addon-test.sh <image> speech|labels}
kind=${2:?usage: addon-test.sh <image> speech|labels}
name=obur-addon-$kind-$$
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
fail() {
	echo "add-on test ($kind) failed: $*" >&2
	docker logs "$name" 2>&1 | tail -20 >&2
	exit 1
}

docker run -d --name "$name" "$image" >/dev/null
for _ in $(seq 90); do
	[[ $(docker inspect -f '{{.State.Health.Status}}' "$name") == healthy ]] && break
	[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "the container stopped"
	sleep 2
done
[[ $(docker inspect -f '{{.State.Health.Status}}' "$name") == healthy ]] || fail "not healthy after 3 minutes"

case $kind in
labels)
	out=$(docker exec "$name" python -I -c '
import base64, io, json, urllib.request
from PIL import Image, ImageDraw, ImageFont
image = Image.new("RGB", (640, 200), "white")
ImageDraw.Draw(image).text((30, 60), "Energy 250 kcal", fill="black", font=ImageFont.load_default(size=56))
png = io.BytesIO()
image.save(png, "PNG")
body = json.dumps({"image": base64.b64encode(png.getvalue()).decode()}).encode()
request = urllib.request.Request("http://127.0.0.1:8000/ocr", body, {"content-type": "application/json"})
print(" ".join(line["text"] for line in json.load(urllib.request.urlopen(request, timeout=60))["lines"]))
') || fail "the OCR request failed"
	[[ $out == *250* && $out == *kcal* ]] || fail "read \"$out\", not 250 kcal"
	;;
speech)
	out=$(docker exec "$name" python -I -c '
import base64, io, json, urllib.request, wave
clip = io.BytesIO()
with wave.open(clip, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(bytes(32000))
body = json.dumps({"audio": base64.b64encode(clip.getvalue()).decode()}).encode()
request = urllib.request.Request("http://127.0.0.1:8000/transcribe", body, {"content-type": "application/json"})
answer = json.load(urllib.request.urlopen(request, timeout=120))
print(json.dumps({"text": answer.get("text"), "asrMs": answer.get("asrMs")}))
') || fail "the transcription request failed"
	[[ $out == *'"text": '* && $out == *'"asrMs": '[0-9]* ]] || fail "unexpected answer: $out"
	;;
*) fail "unknown add-on" ;;
esac
docker stop -t 30 "$name" >/dev/null
echo "add-on test ($kind) passed"
