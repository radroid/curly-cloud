"""
Make the hero cloud's source image and poster from a cut-out photo of Raj.

    python3 scripts/hero-cloud-src.py <photo.png>

Writes public/hero-cloud-src.png (what the renderer samples) and public/hero-cloud.webp (the poster:
Saver, reduced motion, no WebGL, and the frame before the renderer loads).

The photo needs a transparent background (a "sticker" export works). The cloud's sampler
(app/components/site/cloud/sampler.ts) is tuned for line art: dark lines and dark fill get the points,
light areas stay sparse, and the alpha channel is the figure. So this draws the photo as a line sketch:

- crops a square around the face and cleans the cut-out's edge;
- on the head, a difference of Gaussians over a contrast-equalised copy gives the features and the
  curls, and the hair and beard get a dark fill;
- on the shirt, a horizontal closing lifts out the narrow vertical stripes first (they would swallow
  the points), so only the collar's shading is left to draw;
- an ink outline goes round the silhouette, because the sampler reads the background as white paper.

The poster is drawn from the renderer's own sampler (run with Bun), facing forward.

Needs Bun, numpy, Pillow (with WebP), scipy and scikit-image. CROP and HEAD below were fitted by hand
to the current photo: a new photo needs new numbers, a look at the head and body ellipses in
sampler.ts and the bust's extent in figure.ts, then a check of the hero at 1440, 1280, 1024 and 390 wide.
After any re-run, bump the `?v=` on CLOUD_SRC and CLOUD_POSTER in app/components/site/hero.tsx.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import exposure

ROOT = Path(__file__).resolve().parent.parent
SIZE = 320  # SRC_SIZE in sampler.ts
# Square crop in photo px: centre x of the face, top edge (negative pads above the hair), side.
CROP = (448, -18, 760)
# The head and the open neck, traced on the 320² crop; the rest of the figure is shirt.
HEAD = [(0, 0), (320, 0), (320, 150), (206, 150), (206, 176), (200, 205), (186, 224), (166, 252),
        (156, 252), (141, 231), (126, 210), (119, 188), (117, 150), (0, 150)]


def cut_out(photo: np.ndarray) -> np.ndarray:
    """The figure's mask: solid alpha, no specks or rim-light fringe, holes filled."""
    rgb, alpha = photo[..., :3], photo[..., 3]
    m = ndi.binary_opening(alpha > 160, iterations=3)
    lab, n = ndi.label(m)
    m = lab == 1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1))))
    m = ndi.binary_fill_holes(m)
    # The cut-out kept a patch of red rim light by the ear.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = (r > 150) & (r - g > 70) & (r - b > 70)
    m &= ~(red & m & ~ndi.binary_erosion(m, iterations=14))
    return ndi.binary_opening(m, iterations=2)


def crop(photo: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    cx, top, side = CROP
    h, w = mask.shape
    rgb = np.zeros((side, side, 3), np.float32)
    fig = np.zeros((side, side), bool)
    ys, xs = np.arange(side) + top, np.arange(side) + cx - side // 2
    oy, ox = (ys >= 0) & (ys < h), (xs >= 0) & (xs < w)
    rgb[np.ix_(oy, ox)] = photo[np.ix_(ys[oy], xs[ox])][..., :3]
    fig[np.ix_(oy, ox)] = mask[np.ix_(ys[oy], xs[ox])]
    return rgb, fig


def dog(img: np.ndarray, sigma: float) -> np.ndarray:
    return ndi.gaussian_filter(img, sigma) - ndi.gaussian_filter(img, sigma * 1.6)


def sketch(rgb: np.ndarray, fig: np.ndarray) -> np.ndarray:
    """Ink, 0..1, at the crop's resolution."""
    n = fig.shape[0]
    k = n / SIZE  # crop px per source px
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    lum = np.where(fig, lum, np.median(lum[fig]))
    poly = Image.new('L', (n, n), 0)
    ImageDraw.Draw(poly).polygon([(x * k, y * k) for x, y in HEAD], fill=255)
    head = ndi.gaussian_filter(np.asarray(poly, np.float32) / 255, 2 * k)

    eq = exposure.equalize_adapthist(lum, kernel_size=n // 8, clip_limit=0.012)
    lines = np.clip(-dog(eq, 0.8 * k) * 10, 0, 1)
    dark = 1 - np.clip((ndi.gaussian_filter(eq, 0.8 * k) - 0.18) / 0.14, 0, 1)
    face = np.maximum(lines, dark * 0.72)

    plain = ndi.gaussian_filter(ndi.grey_closing(lum, size=(1, int(10 * k))), 1.5 * k)
    plain = exposure.equalize_adapthist(np.clip(plain, 0, 1), kernel_size=n // 8, clip_limit=0.012)
    shirt = np.clip(-dog(plain, 1.2 * k) * 5, 0, 1)

    ink = head * face + (1 - head) * shirt
    edge = ndi.distance_transform_edt(fig)
    return np.maximum(ink, np.clip(1 - (edge - 1.2 * k) / k, 0, 1))


def source(photo_path: str) -> np.ndarray:
    """The 320² grey + alpha source image."""
    photo = np.asarray(Image.open(photo_path).convert('RGBA')).astype(np.float32)
    rgb, fig = crop(photo / 255, cut_out(photo))
    tone = 1 - sketch(rgb, fig)
    grey = Image.fromarray((np.clip(tone, 0, 1) * 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
    alpha = Image.fromarray(fig.astype(np.uint8) * 255).resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(alpha) > 128
    g = np.where(a, np.asarray(grey), 0)
    # 32 grey levels are plenty for the sampler and keep the file small.
    g = (np.round(g / 255 * 31) * 255 / 31).astype(np.uint8)
    return np.dstack([g, a.astype(np.uint8) * 255])


SAMPLE = """
import { pickStars, sample, SRC_SIZE } from './app/components/site/cloud/sampler'
import { STARS } from './app/components/site/cloud/stars'
const pts = sample(new Uint8Array(await Bun.stdin.arrayBuffer()), SRC_SIZE)
const stars = pickStars(pts, STARS.length)
console.log(JSON.stringify({ x: [...pts.x], y: [...pts.y], z: [...pts.z], b: [...pts.b], stars }))
"""

# The poster covers -0.6..0.6 of the figure (POSTER_SPAN in figure.ts): the points on the left half, the
# stars on the right. Sizes are the renderer's at a 640 px figure: point radius 0.8, star halo 6, core 2.6.
HALF = 1024
SCALE = HALF / 1.2
PX = SCALE / 640


def splat(x: np.ndarray, y: np.ndarray, a: np.ndarray, r: float, core: float = 0) -> np.ndarray:
    """White round points, composited over each other, as alpha 0..1."""
    keep = np.zeros((HALF, HALF))  # sum of log(1 - alpha)
    reach = int(np.ceil(r + 1))
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            ix, iy = np.floor(x).astype(int) + dx, np.floor(y).astype(int) + dy
            d = np.hypot(ix + 0.5 - x, iy + 0.5 - y)
            cov = np.clip(r + 0.5 - d, 0, 1)
            if core:
                c = np.clip(core + 0.5 - d, 0, 1)
                cov = c + (1 - c) * 0.28 * cov
            cov = np.minimum(cov * a, 0.999)
            ok = (ix >= 0) & (ix < HALF) & (iy >= 0) & (iy < HALF) & (cov > 0)
            np.add.at(keep, (iy[ok], ix[ok]), np.log1p(-cov[ok]))
    return 1 - np.exp(keep)


def poster(src: np.ndarray) -> Image.Image:
    rgba = np.dstack([src[..., 0], src[..., 0], src[..., 0], src[..., 1]]).astype(np.uint8)
    run = subprocess.run(['bun', '-e', SAMPLE], input=rgba.tobytes(), capture_output=True, cwd=ROOT, check=True)
    p = json.loads(run.stdout)
    x, y, z, b = (np.array(p[k]) for k in 'xyzb')
    k = 1.9 / (1.9 - z)
    qx, qy = HALF / 2 + x * k * SCALE, HALF / 2 + y * k * SCALE
    # The vertex shader's alpha: brightness, nearer is brighter, and the bottom rows fade.
    a = np.clip(b * (0.3 + (z + 0.2) * 1.5) * np.minimum(1, (0.5 - y) * 9), 0.06, 1)
    a = np.minimum(1, a + 0.08) * 0.95
    s = np.array(p['stars'])
    alpha = np.hstack([splat(qx, qy, a, 0.8 * PX), splat(qx[s], qy[s], np.ones(len(s)), 6 * PX, 2.6 * PX)])
    # 12 alpha levels keep the lossless WebP under 40 KB.
    alpha = (np.round(alpha * 11) * 255 / 11).astype(np.uint8)
    white = np.where(alpha > 0, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([white, white, white, alpha]))


def main() -> None:
    src = source(sys.argv[1])
    Image.fromarray(src, 'LA').save(ROOT / 'public/hero-cloud-src.png', optimize=True)
    poster(src).save(ROOT / 'public/hero-cloud.webp', lossless=True, quality=100, method=6)
    print('wrote public/hero-cloud-src.png and public/hero-cloud.webp')


if __name__ == '__main__':
    main()
