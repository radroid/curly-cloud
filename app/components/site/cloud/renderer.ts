import type { FigureLayout } from './figure'
import { pickStars, POINTS, sample, scatter, SRC_SIZE } from './sampler'

/**
 * The curly-cloud renderer (REDESIGN-PLAN.md §4, M2/M3): one `gl.POINTS` draw for the cloud and
 * one for the stars. The vertex shader does the assembly, rotation, perspective and cursor brush;
 * the fragment shader draws round points. GLSL ES 1.00, so the same code runs on WebGL2 and WebGL1.
 *
 * Loaded with `import()` by the hero, only when it's on screen and the tier isn't Saver.
 */

export type CloudTier = 'high' | 'medium'
export type CloudStage = 'sampled' | 'ready'

export interface CloudOptions {
  canvas: HTMLCanvasElement
  /** The source illustration (same origin). */
  src: string
  /** How many stars to pick: one per public source. */
  stars: number
  tier: CloudTier
  onStage: (stage: CloudStage) => void
  /** Frames drawn in the last second, reported once a second while running. */
  onFps: (fps: number) => void
  /** The GPU dropped the context: the hero falls back to the poster. */
  onLost: () => void
}

export interface Cloud {
  /** Where to draw the figure, and the stage size, in CSS px. */
  setLayout: (l: FigureLayout, w: number, h: number) => void
  setTier: (tier: CloudTier) => void
  /** Run while the hero is on screen; stop otherwise. */
  setActive: (on: boolean) => void
  /** Start the assembly (after the intro has gone). */
  start: () => void
  /** Stars, by index, that the latest answer cited. They flare coral. */
  setCited: (stars: number[]) => void
  /**
   * The pointer, in stage px, or null when it leaves. `brush` pushes points (mouse only);
   * `pick` looks for a star under it. Returns the star's index, or -1.
   */
  pointer: (p: { x: number; y: number; brush: boolean; pick: boolean } | null) => number
  /** A star's current position on the stage. */
  starAt: (i: number) => { x: number; y: number }
  destroy: () => void
}

// `radius` is the point's radius in CSS px: about the area of the prototype's 1.3 and 1.7 px squares.
const TIERS: Record<CloudTier, { points: number; dpr: number; fps: number; radius: number }> = {
  high: { points: POINTS.high, dpr: 2, fps: 60, radius: 0.8 },
  medium: { points: POINTS.medium, dpr: 1, fps: 30, radius: 0.96 },
}

const ASSEMBLE_MS = 1400
const BRUSH_R = 95
const BRUSH_PUSH = 26
const HIT_R = 18
// The brush is a damped spring (about 0.1 s rise, 27% overshoot), applied as a weighted sum over
// the cursor's recent positions, so the shader needs no per-point state.
const TAPS = 16
const TAP_MS = 1000 / 30
const TAP_W = (() => {
  const w = Array.from({ length: TAPS }, (_, k) => Math.exp(-5.95 * k * (TAP_MS / 1000)) * Math.sin(14.26 * k * (TAP_MS / 1000)))
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((v) => v / sum)
})()

const VERT = `
attribute vec3 aPos;
attribute vec3 aFrom;
attribute vec2 aMeta;
uniform vec4 uRot;
uniform vec3 uFig;
uniform vec3 uView;
uniform vec2 uClock;
uniform vec3 uTap[${TAPS}];
uniform vec2 uKind;
varying vec4 vDot;
varying float vHue;
void main() {
  float e = clamp((uClock.x - aMeta.x) / ${ASSEMBLE_MS}.0, 0.0, 1.0);
  vec3 p = mix(aFrom, aPos, 1.0 - pow(1.0 - e, 3.0));
  float x1 = p.x * uRot.x + p.z * uRot.y;
  float z1 = p.z * uRot.x - p.x * uRot.y;
  float y1 = p.y * uRot.z - z1 * uRot.w;
  float z2 = p.y * uRot.w + z1 * uRot.z;
  vec2 q = uFig.xy + vec2(x1, y1) * uFig.z * (1.9 / (1.9 - z2));
  vec2 push = vec2(0.0);
  for (int i = 0; i < ${TAPS}; i++) {
    vec2 d = q - uTap[i].xy;
    float l = length(d);
    float f = max(0.0, 1.0 - l / ${BRUSH_R}.0);
    if (l > 0.01) push += d / l * f * f * uTap[i].z;
  }
  q += push;
  gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
  float dpr = uView.z;
  if (uKind.x < 0.5) {
    float a = clamp(aMeta.y * (0.3 + (z2 + 0.2) * 1.5) * min(1.0, (0.5 - aPos.y) * 9.0), 0.06, 1.0);
    float r = uKind.y * dpr;
    vDot = vec4(r, 0.0, ceil(r * 2.0 + 2.0), min(1.0, a + 0.08) * 0.95);
    vHue = 0.0;
  } else {
    float hover = mod(aMeta.y, 2.0);
    float cited = step(1.5, aMeta.y);
    float halo = hover > 0.5 ? 11.0 : cited > 0.5 ? 9.0 + sin(uClock.y / 260.0) * 2.5 : 6.0;
    float core = hover > 0.5 ? 4.5 : cited > 0.5 ? 3.6 : 2.6;
    vDot = vec4(halo * dpr, core * dpr, ceil(halo * dpr * 2.0 + 2.0), uKind.y);
    vHue = 1.0 + cited;
  }
  gl_PointSize = vDot.z;
}`

const FRAG = `
precision mediump float;
uniform vec3 uHue[3];
varying vec4 vDot;
varying float vHue;
void main() {
  float d = length(gl_PointCoord - 0.5) * vDot.z;
  float outer = clamp(vDot.x + 0.5 - d, 0.0, 1.0);
  if (outer <= 0.0) discard;
  float core = clamp(vDot.y + 0.5 - d, 0.0, 1.0);
  float a = (vDot.y > 0.0 ? core + (1.0 - core) * 0.28 * outer : outer) * vDot.w;
  vec3 c = vHue < 0.5 ? uHue[0] : vHue < 1.5 ? uHue[1] : uHue[2];
  gl_FragColor = vec4(c * a, a);
}`

type GL = WebGLRenderingContext

function compile(gl: GL): WebGLProgram | null {
  const prog = gl.createProgram()
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const sh = gl.createShader(type)
    if (!sh) return null
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    gl.attachShader(prog, sh)
    gl.deleteShader(sh)
  }
  ;['aPos', 'aFrom', 'aMeta'].forEach((name, i) => gl.bindAttribLocation(prog, i, name))
  gl.linkProgram(prog)
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null
}

/** A theme colour (`--color-*` on <html>) as linear 0..1 RGB, whatever format the token uses. */
function themeColor(probe: CanvasRenderingContext2D, name: string): number[] {
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

/** Resolves to null when there's no WebGL; rejects if the source image won't load. */
export async function createCloud(o: CloudOptions): Promise<Cloud | null> {
  const attrs: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }
  const gl = (o.canvas.getContext('webgl2', attrs) ?? o.canvas.getContext('webgl', attrs)) as GL | null
  if (!gl || gl.isContextLost()) return null

  const img = new Image()
  img.src = o.src
  await img.decode()
  const scratch = document.createElement('canvas')
  scratch.width = scratch.height = SRC_SIZE
  const g2 = scratch.getContext('2d', { willReadFrequently: true })
  if (!g2) return null
  g2.drawImage(img, 0, 0, SRC_SIZE, SRC_SIZE)
  const pts = sample(g2.getImageData(0, 0, SRC_SIZE, SRC_SIZE).data)
  const from = scatter(pts)
  const starIdx = pickStars(pts, o.stars)
  o.onStage('sampled')

  const prog = compile(gl)
  if (!prog) return null
  const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(prog, name)
  const U = { rot: u('uRot'), fig: u('uFig'), view: u('uView'), clock: u('uClock'), tap: u('uTap'), kind: u('uKind'), hue: u('uHue') }

  // Interleaved per vertex: target xyz, start xyz, delay, brightness (points) or state (stars).
  const STRIDE = 8
  const pointData = new Float32Array(pts.count * STRIDE)
  for (let i = 0; i < pts.count; i++) {
    pointData.set([pts.x[i], pts.y[i], pts.z[i], from.x[i], from.y[i], from.z[i], from.delay[i], pts.b[i]], i * STRIDE)
  }
  const starData = new Float32Array(starIdx.length * STRIDE)
  starIdx.forEach((i, k) => starData.set(pointData.subarray(i * STRIDE, i * STRIDE + STRIDE - 1), k * STRIDE))
  const pointBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf)
  gl.bufferData(gl.ARRAY_BUFFER, pointData, gl.STATIC_DRAW)
  const starBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf)
  gl.bufferData(gl.ARRAY_BUFFER, starData, gl.DYNAMIC_DRAW)
  const bindAttrs = (buf: WebGLBuffer | null): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE * 4, 0)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE * 4, 12)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE * 4, 24)
  }

  gl.useProgram(prog)
  for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)
  gl.uniform3fv(U.hue, [...themeColor(g2, 'term-accent'), ...themeColor(g2, 'sun'), ...themeColor(g2, 'coral-glow')])

  let tier = TIERS[o.tier]
  let fig: FigureLayout = { cx: 0, cy: 0, s: 0 }
  let w = 0
  let h = 0
  let dpr = 1
  let active = false
  let dead = false
  let raf = 0
  let last = 0
  let fpsT = 0
  let frames = 0
  let drawn = false
  let t0: number | null = null
  const assembledAt = from.maxDelay + ASSEMBLE_MS
  const rot = { a: 0, b: 0 }
  const mouse = { x: 0, y: 0, nx: 0, ny: 0, brush: false }
  let hover = -1
  let cited = new Set<number>()
  let showStars = 0

  // Cursor history for the brush, newest at `head`.
  const HIST = 48
  const hx = new Float32Array(HIST)
  const hy = new Float32Array(HIST)
  const ht = new Float64Array(HIST).fill(-1e9)
  const hon = new Uint8Array(HIST)
  let head = 0
  const taps = new Float32Array(TAPS * 3)
  const starPos = new Float32Array(starIdx.length * 2)

  const resize = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, tier.dpr)
    const cw = Math.max(1, Math.round(w * dpr))
    const ch = Math.max(1, Math.round(h * dpr))
    if (o.canvas.width !== cw || o.canvas.height !== ch) {
      o.canvas.width = cw
      o.canvas.height = ch
    }
    gl.viewport(0, 0, cw, ch)
  }

  const uploadStars = (): void => {
    starIdx.forEach((_, k) => (starData[k * STRIDE + 7] = (k === hover ? 1 : 0) + (cited.has(k) ? 2 : 0)))
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, starData)
  }

  const updateTaps = (t: number): void => {
    head = (head + 1) % HIST
    hx[head] = mouse.x
    hy[head] = mouse.y
    ht[head] = t
    hon[head] = mouse.brush ? 1 : 0
    let j = 0
    for (let k = 0; k < TAPS; k++) {
      const at = t - k * TAP_MS
      while (j < HIST - 1 && ht[(head - j + HIST) % HIST] > at + 1) j++
      const n = (head - j + HIST) % HIST
      taps[k * 3] = hx[n]
      taps[k * 3 + 1] = hy[n]
      taps[k * 3 + 2] = hon[n] && ht[n] > -1e8 ? TAP_W[k] * BRUSH_PUSH : 0
    }
  }

  /** The same projection and brush as the vertex shader, for the stars' hit targets. */
  const placeStars = (): void => {
    const ca = Math.cos(rot.a)
    const sa = Math.sin(rot.a)
    const cb = Math.cos(rot.b)
    const sb = Math.sin(rot.b)
    starIdx.forEach((i, k) => {
      const x = pts.x[i]
      const y = pts.y[i]
      const z = pts.z[i]
      const x1 = x * ca + z * sa
      const z1 = z * ca - x * sa
      const y1 = y * cb - z1 * sb
      const z2 = y * sb + z1 * cb
      const p = 1.9 / (1.9 - z2)
      let qx = fig.cx + x1 * fig.s * p
      let qy = fig.cy + y1 * fig.s * p
      let px = 0
      let py = 0
      for (let n = 0; n < TAPS; n++) {
        const dx = qx - taps[n * 3]
        const dy = qy - taps[n * 3 + 1]
        const l = Math.hypot(dx, dy)
        const f = Math.max(0, 1 - l / BRUSH_R)
        if (l > 0.01) {
          px += (dx / l) * f * f * taps[n * 3 + 2]
          py += (dy / l) * f * f * taps[n * 3 + 2]
        }
      }
      qx += px
      qy += py
      starPos[k * 2] = qx
      starPos[k * 2 + 1] = qy
    })
  }

  const hit = (x: number, y: number): number => {
    if (showStars < 1) return -1
    let best = -1
    let bd = HIT_R * HIT_R
    for (let k = 0; k < starIdx.length; k++) {
      const d = (starPos[k * 2] - x) ** 2 + (starPos[k * 2 + 1] - y) ** 2
      if (d < bd) {
        bd = d
        best = k
      }
    }
    return best
  }

  const draw = (t: number, dt: number): void => {
    const ease = 1 - Math.pow(0.95, dt / 16.67)
    rot.a += (Math.sin(t / 5200) * 0.2 + mouse.nx * 0.5 - rot.a) * ease
    rot.b += (mouse.ny * 0.22 - rot.b) * ease
    const clock = t0 === null ? -1 : Math.min(t - t0, assembledAt + 1)
    if (t0 !== null && clock > assembledAt) showStars = Math.min(1, (t - t0 - assembledAt) / 400)
    updateTaps(t)

    gl.useProgram(prog)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform4f(U.rot, Math.cos(rot.a), Math.sin(rot.a), Math.cos(rot.b), Math.sin(rot.b))
    gl.uniform3f(U.fig, fig.cx, fig.cy, fig.s)
    gl.uniform3f(U.view, w, h, dpr)
    gl.uniform2f(U.clock, clock, t % (Math.PI * 2 * 260))
    gl.uniform3fv(U.tap, taps)
    gl.uniform2f(U.kind, 0, tier.radius)
    bindAttrs(pointBuf)
    gl.drawArrays(gl.POINTS, 0, tier.points)
    if (showStars > 0) {
      placeStars()
      gl.uniform2f(U.kind, 1, showStars)
      bindAttrs(starBuf)
      gl.drawArrays(gl.POINTS, 0, starIdx.length)
    }
    if (!drawn) {
      drawn = true
      o.onStage('ready')
    }
  }

  const frame = (t: number): void => {
    raf = requestAnimationFrame(frame)
    if (last && t - last < 1000 / tier.fps - 3) return
    const dt = last ? Math.min(100, t - last) : 16.67
    last = t
    // Frames after the one that opened the window, so a steady 60 reads 60.
    if (!fpsT) fpsT = t
    else frames++
    if (fpsT && t - fpsT >= 1000) {
      o.onFps(Math.round((frames * 1000) / (t - fpsT)))
      frames = 0
      fpsT = t
    }
    draw(t, dt)
  }

  const run = (): void => {
    const go = active && !dead && !document.hidden && w > 0
    if (go && !raf) {
      last = fpsT = frames = 0
      ht.fill(-1e9)
      raf = requestAnimationFrame(frame)
    } else if (!go && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const onLost = (): void => {
    dead = true
    run()
    o.onLost()
  }
  o.canvas.addEventListener('webglcontextlost', onLost)
  document.addEventListener('visibilitychange', run)

  return {
    setLayout(l, width, height) {
      fig = l
      w = width
      h = height
      resize()
      run()
    },
    setTier(next) {
      tier = TIERS[next]
      resize()
    },
    setActive(on) {
      active = on
      run()
    },
    start() {
      t0 ??= performance.now()
    },
    setCited(stars) {
      cited = new Set(stars)
      uploadStars()
    },
    pointer(p) {
      if (!p) {
        mouse.nx = mouse.ny = 0
        mouse.brush = false
      } else {
        mouse.x = p.x
        mouse.y = p.y
        mouse.nx = w ? p.x / w - 0.5 : 0
        mouse.ny = h ? p.y / h - 0.5 : 0
        mouse.brush = p.brush
      }
      const next = p?.pick ? hit(p.x, p.y) : -1
      if (next !== hover) {
        hover = next
        uploadStars()
      }
      return next
    },
    starAt(i) {
      return { x: starPos[i * 2], y: starPos[i * 2 + 1] }
    },
    destroy() {
      dead = true
      run()
      o.canvas.removeEventListener('webglcontextlost', onLost)
      document.removeEventListener('visibilitychange', run)
      gl.deleteBuffer(pointBuf)
      gl.deleteBuffer(starBuf)
      gl.deleteProgram(prog)
    },
  }
}
