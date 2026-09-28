"""
Make every image of Raj on the site from one portrait: the hero cloud's source and poster, and the avatar.

    python3 scripts/portrait-images.py <portrait.png>

Writes:
- public/hero-cloud-src.png: what the hero's renderer samples;
- public/hero-cloud.webp: the cloud's poster (Saver, reduced motion, no WebGL, and the frame before the
  renderer loads);
- public/raj-avatar.webp: the avatar (favicon, Ask panel, dock, terminal, Mac).

The portrait is Raj's cartoon, on a plain background that's cut away by flood-filling from the border.
The cloud's sampler (app/components/site/cloud/sampler.ts) is tuned for line art: dark lines and dark fill
get the points, light areas stay sparse, and the alpha channel is the figure. So the cloud's source is a
line sketch:

- crops a square around the face;
- on the head, a difference of Gaussians over a contrast-equalised copy gives the features and the
  curls, and the hair and beard get a dark fill;
- on the shirt, a horizontal closing lifts out the narrow vertical stripes first (they would swallow
  the points), so only the collar's shading is left to draw;
- an ink outline goes round the silhouette, because the sampler reads the background as white paper.

The poster is drawn from the renderer's own sampler (run with Bun), facing forward: points, work stars
and personal dots in three panels.

Needs Bun, numpy, Pillow (with WebP), scipy and scikit-image. CROP, AVATAR and HEAD below were fitted
by hand to the current portrait: a new one needs new numbers, a look at the head and body ellipses in
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
# Square crops in portrait px: centre x of the face, top edge (negative pads above the hair), side.
CROP = (582, -19, 926)
AVATAR = (582, -30, 830)
# The head and the open neck, traced on the 320² crop; the rest of the figure is shirt.
HEAD = [(0, 0), (320, 0), (320, 175), (214, 175), (210, 192), (200, 205), (163, 262), (126, 205),
        (116, 192), (108, 175), (0, 175)]


def cut_out(rgb: np.ndarray) -> np.ndarray:
    """The figure's mask: everything not joined to the border by background-coloured pixels."""
    edge = np.concatenate([rgb[:20, :20], rgb[:20, -20:], rgb[-20:, :20], rgb[-20:, -20:]]).reshape(-1, 3)
    near = np.sqrt(((rgb - np.median(edge, 0)) ** 2).sum(-1)) < 10
    lab, _ = ndi.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    m = ndi.binary_fill_holes(~np.isin(lab, border[border > 0]))
    m = ndi.binary_opening(m, iterations=2)
    lab, n = ndi.label(m)
    return lab == 1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1))))


def crop(img: np.ndarray, box: tuple[int, int, int], pad: float = 0) -> np.ndarray:
    """A square from `img` (any channels); outside the portrait is `pad`."""
    cx, top, side = box
    h, w = img.shape[:2]
    out = np.full((side, side) + img.shape[2:], pad, img.dtype)
    ys, xs = np.arange(side) + top, np.arange(side) + cx - side // 2
    oy, ox = (ys >= 0) & (ys < h), (xs >= 0) & (xs < w)
    out[np.ix_(oy, ox)] = img[np.ix_(ys[oy], xs[ox])]
    return out


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


def source(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """The 320² grey + alpha source image."""
    fig = crop(mask, CROP, False)
    tone = 1 - sketch(crop(rgb, CROP), fig)
    grey = Image.fromarray((np.clip(tone, 0, 1) * 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
    alpha = Image.fromarray(fig.astype(np.uint8) * 255).resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(alpha) > 128
    g = np.where(a, np.asarray(grey), 0)
    # 32 grey levels are plenty for the sampler and keep the file small.
    g = (np.round(g / 255 * 31) * 255 / 31).astype(np.uint8)
    return np.dstack([g, a.astype(np.uint8) * 255])


def avatar(rgb: np.ndarray) -> Image.Image:
    """Head and shoulders on the portrait's own background, 1024²."""
    bg = np.median(rgb[:20, :20].reshape(-1, 3), 0)
    square = np.stack([crop(rgb[..., c], AVATAR, bg[c]) for c in range(3)], -1)
    return Image.fromarray((np.clip(square, 0, 1) * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)


SAMPLE = """
import { pickStars, sample, SRC_SIZE } from './app/components/site/cloud/sampler'
import { PERSONAL, STARS } from './app/components/site/cloud/stars'
const pts = sample(new Uint8Array(await Bun.stdin.arrayBuffer()), SRC_SIZE)
const stars = pickStars(pts, STARS.length + PERSONAL.length)
console.log(JSON.stringify({ x: [...pts.x], y: [...pts.y], z: [...pts.z], b: [...pts.b], stars, work: STARS.length }))
"""

# The poster covers -0.6..0.6 of the figure (POSTER_SPAN in figure.ts), in three panels: the points, the
# work stars and the personal dots. Sizes are the renderer's at a 640 px figure: point radius 0.8, star halo 6, core 2.6.
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
    work, personal = np.array(p['stars'][: p['work']]), np.array(p['stars'][p['work'] :])
    star = lambda s: splat(qx[s], qy[s], np.ones(len(s)), 6 * PX, 2.6 * PX)
    alpha = np.hstack([splat(qx, qy, a, 0.8 * PX), star(work), star(personal)])
    # 12 alpha levels keep the lossless WebP under 40 KB.
    alpha = (np.round(alpha * 11) * 255 / 11).astype(np.uint8)
    white = np.where(alpha > 0, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([white, white, white, alpha]))


def main() -> None:
    rgb = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32) / 255
    src = source(rgb, cut_out(rgb * 255))
    Image.fromarray(src, 'LA').save(ROOT / 'public/hero-cloud-src.png', optimize=True)
    poster(src).save(ROOT / 'public/hero-cloud.webp', lossless=True, quality=100, method=6)
    avatar(rgb).save(ROOT / 'public/raj-avatar.webp', quality=82, method=6)
    print('wrote public/hero-cloud-src.png, public/hero-cloud.webp and public/raj-avatar.webp')


if __name__ == '__main__':
    main()
