"""Assemble the viewer.

  dist/Unitree_G1_Anatomy_Explorer.html   one self-contained file: three.js, fonts, meshes, data
                                        all inlined. Opens from file://, no internet needed.
  dist/artifact/index.html              same page for publishing as a web link (three.js from CDN,
                                        fonts from Google Fonts).

Run pack_g1.py first (creates out/g1_data.js).
"""
import base64, os, re, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC, VEN, OUT = (os.path.join(HERE, d) for d in ('src', 'vendor', 'out'))
DIST = os.path.join(ROOT, 'dist')
THREE_VER = '0.147.0'
LINES = ['LineSegmentsGeometry', 'LineGeometry', 'LineMaterial', 'LineSegments2', 'Line2']
VENDOR = ['three.min.js', 'OrbitControls.js', 'RoomEnvironment.js'] + [l + '.js' for l in LINES]
CDN = [f'https://cdn.jsdelivr.net/npm/three@{THREE_VER}/build/three.min.js',
       f'https://cdn.jsdelivr.net/npm/three@{THREE_VER}/examples/js/controls/OrbitControls.js',
       f'https://cdn.jsdelivr.net/npm/three@{THREE_VER}/examples/js/environments/RoomEnvironment.js'] + \
      [f'https://cdn.jsdelivr.net/npm/three@{THREE_VER}/examples/js/lines/{l}.js' for l in LINES]
FONT_LINK_RE = re.compile(r'<link rel="preconnect"[^>]*>\s*<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">')


def read(*p):
    with open(os.path.join(*p), encoding='utf-8') as f:
        return f.read()


def inline_fonts(css_url):
    """Fetch the Google Fonts CSS (latin subset only) and inline every woff2 as a data URI."""
    cache = os.path.join(OUT, 'fonts.css')
    if os.path.exists(cache):
        return read(cache)
    req = urllib.request.Request(css_url.replace('&amp;', '&'), headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'})
    css = urllib.request.urlopen(req, timeout=30).read().decode()
    blocks = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face\s*{[^}]*})', css)
    out = []
    for subset, block in blocks:
        if subset != 'latin':
            continue
        url = re.search(r'url\((https://[^)]+\.woff2)\)', block).group(1)
        data = base64.b64encode(urllib.request.urlopen(url, timeout=30).read()).decode()
        out.append(block.replace(url, 'data:font/woff2;base64,' + data))
    css = '\n'.join(out)
    with open(cache, 'w') as f:
        f.write(css)
    return css


def script(code):
    assert '</script' not in code.lower(), 'inline script contains a closing script tag'
    return '<script>' + code + '</script>'


def main():
    head, body = read(SRC, 'head.html'), read(SRC, 'body.html')
    data, info, app = read(OUT, 'g1_data.js'), read(SRC, 'info.js'), read(SRC, 'app.js')
    own = script(data) + '\n' + script(info) + '\n' + script(app)

    # 1) offline single file
    m = FONT_LINK_RE.search(head)
    try:
        fonts = '<style>' + inline_fonts(m.group(1)) + '</style>'
    except Exception as e:  # no network at build time: fall back to system fonts
        print('fonts not embedded:', e)
        fonts = ''
    off_head = head[:m.start()] + fonts + head[m.end():]
    vendor = '\n'.join(script(read(VEN, v)) for v in VENDOR)
    offline = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
               '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
               + off_head + '\n</head>\n<body>\n' + body + '\n' + vendor + '\n' + own + '\n</body>\n</html>\n')
    assert 'https://fonts.g' not in offline.split('<script>')[0], 'offline head still references a font host'
    os.makedirs(DIST, exist_ok=True)
    p1 = os.path.join(DIST, 'Unitree_G1_Anatomy_Explorer.html')
    with open(p1, 'w', encoding='utf-8') as f:
        f.write(offline)

    # 2) web artifact (page skeleton is added by the host)
    art = head + '\n' + body + '\n' + '\n'.join(f'<script src="{u}"></script>' for u in CDN) + '\n' + own + '\n'
    os.makedirs(os.path.join(DIST, 'artifact'), exist_ok=True)
    p2 = os.path.join(DIST, 'artifact', 'index.html')
    with open(p2, 'w', encoding='utf-8') as f:
        f.write(art)
    # 3) GitHub Pages copy (served from /docs)
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    p3 = os.path.join(ROOT, 'docs', 'index.html')
    with open(p3, 'w', encoding='utf-8') as f:
        f.write(offline)
    for p in (p1, p2, p3):
        print(f'{os.path.relpath(p, ROOT)}  {os.path.getsize(p) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
