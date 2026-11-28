# Reference tools (trial, 2026-11-28)

Drawing from reference photos: the photo gives the outline and proportions only; the icon keeps the house style
(`../STYLE.md`). Development tools, not part of the app; photos are not committed.

- `refs.py <out dir> <name> "<search terms>" [count]` finds photos on Wikimedia Commons and saves copies with their
  licence. Commons serves scripts only standard thumbnail sizes that it already has, wants an identifying
  User-Agent (a generic one is used), and rate-limits shared cloud addresses: expect refusals (HTTP 429) and retry
  later.
- `trace.py <photo> <out.json> [--sat=S] [--open=K] [--fourier=N] [--sym] [--eps=E] [--part …] [--debug png]` cuts
  the food out of a plain light background and writes its outline on the 1024 grid: `--sat` keeps coloured pixels
  only (drops grey shadows), `--open` strips thin parts (roots, a dry neck), `--fourier` smooths the outline to its
  broad shape, `--sym` makes it upright and symmetrical. Needs numpy and OpenCV (`pip install --target <dir>
opencv-python-headless`, then put that directory on `sys.path`).

The traced points are pasted into the icon's drawing as constants, with the photo's Commons file name in a comment.
