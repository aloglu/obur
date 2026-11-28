"""Cuts a food out of a plain light background and writes its outline, simplified, on the icons' 1024 grid.
PYTHONPATH=<pylib> python3 -I trace.py <photo> <out.json> [--parts hue ranges] [--debug out.png]

Output: {"outline": [[x, y], ...], "parts": {"name": [[x, y], ...]}, "colours": {...}} in grid units, the outline
fitted into a 860-unit box centred on (512, 560). Parts are regions of a given colour (a stalk, a tip), each as its
own simplified outline, so the drawing can place them where the photo has them."""
import json, sys
import cv2
import numpy as np

photo, out = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
debug = args[args.index('--debug') + 1] if '--debug' in args else None
# --part name:hmin-hmax:smin:vmax  (OpenCV hue 0-179); any number of them.
part_specs = [args[i + 1] for i, a in enumerate(args) if a == '--part']

img = cv2.imread(photo)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
# The food: anything not near-white and not a faint grey shadow on the background.
light = (hsv[..., 2] > 215) & (hsv[..., 1] < 40)
mask = (~light).astype(np.uint8) * 255
# --sat=S keeps only coloured pixels: drops grey shadows (and anything else colourless) around a coloured food.
sat = int(next((a.split('=')[1] for a in args if a.startswith('--sat=')), 0))
if sat:
    mask[hsv[..., 1] < sat] = 0
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
# --open=K strips thin parts (roots, a dry neck, stray fibres) narrower than about K pixels.
opening = int(next((a.split('=')[1] for a in args if a.startswith('--open=')), 0))
if opening:
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (opening, opening)))
n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
mask = np.where(labels == biggest, 255, 0).astype(np.uint8)
# Shadows under the food are darker grey with no colour: drop low-saturation pixels touching the bottom edge of the
# shape only if they're grey (the food itself is coloured).
cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
c = max(cs, key=cv2.contourArea)
x, y, w, h = cv2.boundingRect(c)
scale = 860 / max(w, h)
ox, oy = 512 - (x + w / 2) * scale, 560 - (y + h / 2) * scale


def grid(cnt, eps):
    s = cv2.approxPolyDP(cnt, eps * cv2.arcLength(cnt, True), True)
    return [[round(float(p[0][0]) * scale + ox), round(float(p[0][1]) * scale + oy)] for p in s]


def fourier(cnt, harmonics, points=48):
    """The outline's broad shape: resampled evenly, its first harmonics kept, sampled at `points` places."""
    pts = cnt[:, 0, :].astype(float)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(np.r_[pts, pts[:1]], axis=0).T))]
    even = np.linspace(0, seg[-1], 512, endpoint=False)
    z = np.interp(even, seg, np.r_[pts[:, 0], pts[0, 0]]) + 1j * np.interp(even, seg, np.r_[pts[:, 1], pts[0, 1]])
    f = np.fft.fft(z)
    keep = np.zeros_like(f)
    keep[: harmonics + 1] = f[: harmonics + 1]
    keep[-harmonics:] = f[-harmonics:]
    s = np.fft.ifft(keep)[:: 512 // points]
    return [[round(float(q.real) * scale + ox), round(float(q.imag) * scale + oy)] for q in s]


harm = int(next((a.split('=')[1] for a in args if a.startswith('--fourier=')), 0))
result = {'outline': fourier(c, harm) if harm else grid(c, float(next((a.split('=')[1] for a in args if a.startswith('--eps=')), 0.006))), 'parts': {}, 'colours': {}}
body = cv2.mean(img, mask=mask)
result['colours']['body'] = '#%02X%02X%02X' % (int(body[2]), int(body[1]), int(body[0]))
for spec in part_specs:
    name, hue, smin, vmax = spec.split(':')
    h0, h1 = map(int, hue.split('-'))
    pm = ((hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) & (hsv[..., 1] >= int(smin)) & (hsv[..., 2] <= int(vmax))).astype(np.uint8) * 255
    pm = cv2.bitwise_and(pm, mask)
    pm = cv2.morphologyEx(pm, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    pcs, _ = cv2.findContours(pm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pcs = [p for p in pcs if cv2.contourArea(p) > 15]
    result['parts'][name] = [grid(p, 0.03) for p in sorted(pcs, key=cv2.contourArea, reverse=True)[:3]]
    if pcs:
        m = np.zeros_like(mask)
        cv2.drawContours(m, pcs, -1, 255, -1)
        col = cv2.mean(img, mask=m)
        result['colours'][name] = '#%02X%02X%02X' % (int(col[2]), int(col[1]), int(col[0]))
if '--sym' in args:
    # Upright and symmetrical: the photo's width at each height, mirrored about the centre.
    rows = np.where(mask.any(axis=1))[0]
    ys = np.linspace(rows[0], rows[-1], 40)
    half = []
    for yy in ys:
        r = mask[int(round(yy))]
        xs = np.where(r > 0)[0]
        half.append((xs[-1] - xs[0]) / 2 if len(xs) else 0)
    half = np.convolve(np.r_[half[0], half, half[-1]], [0.25, 0.5, 0.25], 'valid')
    cx = 512
    right = [[round(cx + h * scale), round(float(yy) * scale + oy)] for yy, h in zip(ys, half)]
    left = [[round(cx - h * scale), round(float(yy) * scale + oy)] for yy, h in zip(ys, half)]
    result['outline'] = right + left[::-1]
json.dump(result, open(out, 'w'))
print(f"outline {len(result['outline'])} points; parts", {k: [len(p) for p in v] for k, v in result['parts'].items()}, result['colours'])
if debug:
    dbg = img.copy()
    cv2.drawContours(dbg, [c], -1, (255, 0, 255), 1)
    cv2.imwrite(debug, dbg)
