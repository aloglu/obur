"""Finds reference photos on Wikimedia Commons and saves 250 px copies with their licence.
python3 -I refs.py <out dir> <name> "<search terms>" [count]"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

out, name, terms = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
count = int(sys.argv[4]) if len(sys.argv) > 4 else 6
out.mkdir(parents=True, exist_ok=True)
# Wikimedia's robot policy asks for an identifying User-Agent; generic on purpose (no personal or project details).
UA = 'icon-reference-script/1.0 (personal, non-commercial; https://www.mediawiki.org/wiki/Special:MyLanguage/User-Agent_policy)'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


q = urllib.parse.urlencode({
    'action': 'query', 'generator': 'search', 'gsrsearch': terms, 'gsrnamespace': 6, 'gsrlimit': count,
    'prop': 'imageinfo', 'iiprop': 'url|extmetadata|mime', 'format': 'json'})
pages = json.loads(get('https://commons.wikimedia.org/w/api.php?' + q)).get('query', {}).get('pages', {})
found = []
for p in sorted(pages.values(), key=lambda p: p.get('index', 0)):
    info = p['imageinfo'][0]
    if info.get('mime') not in ('image/jpeg', 'image/png'):
        continue
    url = info['url']  # https://upload.wikimedia.org/wikipedia/commons/a/ab/File.jpg
    m = re.match(r'(https://upload\.wikimedia\.org/wikipedia/commons/)(\w/\w\w/)(.+)$', url)
    if not m:
        continue
    licence = info.get('extmetadata', {}).get('LicenseShortName', {}).get('value', '?')
    i = len(found) + 1
    path = out / f'{name}_{i}.jpg'
    # Commons serves scripts only standard sizes, and only thumbnails it already has: try them in turn.
    for w in (250, 500, 330, 960, 120):
        try:
            path.write_bytes(get(f'{m.group(1)}thumb/{m.group(2)}{m.group(3)}/{w}px-{m.group(3)}'))
            break
        except Exception:  # noqa: BLE001 - try the next size
            time.sleep(1)
    else:
        print(f'{i} not available: {p["title"]}')
        continue
    found.append({'file': path.name, 'title': p['title'], 'licence': licence})
    time.sleep(1)
(out / f'{name}.json').write_text(json.dumps(found, indent=1, ensure_ascii=False))
for f in found:
    print(f"{f['file']}: {f['licence']} | {f['title']}")
