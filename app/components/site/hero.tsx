'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useInView } from '@/app/lib/use-in-view'
import { useMagnetic } from '@/app/lib/use-magnetic'
import { useMotionTier } from '@/app/lib/use-motion-tier'
import { setRenderStatus } from '@/app/lib/use-render-status'
import { STARTERS } from './ask-panel'
import { layout, posterBox, type HeroBox } from './cloud/figure'
import type { Cloud, CloudTier } from './cloud/renderer'
import { ALL_STARS, PERSONAL, STARS, starCitations } from './cloud/stars'
import { HERO_PROMPT_ID, useSite } from './site-context'

/**
 * C2 Hero: the curly cloud (REDESIGN-PLAN.md §2, §4). A dark stage with Raj's portrait drawn
 * as a point cloud, one yellow star per company, build and community entry the clone can cite (plus
 * Education) and a white one per personal interest (HERO-STARS-PLAN.md), the name, and a prompt bar
 * that hands its question to the Ask panel.
 *
 * The server renders the poster (and so do Saver, reduced motion and no WebGL). Once hydrated, on
 * screen and not on Saver, the WebGL renderer loads as its own chunk and replaces it.
 */

/** Height of the fixed top bar that floats over the hero. */
const BAR_H = 56

// Browsers keep public images for an hour, so a cached source image could redraw the old figure over
// a new poster. Bump the version whenever scripts/portrait-images.py rewrites them.
const CLOUD_SRC = '/hero-cloud-src.png?v=6'
const CLOUD_POSTER = '/hero-cloud.webp?v=6'

// The server build sees `typeof window === 'undefined'` and drops the import, keeping the renderer out of the Worker.
const loadRenderer = () => (typeof window === 'undefined' ? null : import('./cloud/renderer'))

/** Progress for the boot overlay: `loaded` (chunk), `sampled` (source image), `ready` (first frame). */
function emitStage(stage: 'loaded' | 'sampled' | 'ready'): void {
  window.dispatchEvent(new CustomEvent('curlycloud:cloud', { detail: { stage } }))
}

/** The copy, measured so the figure can be fitted beside or above it. */
function measure(hero: HTMLElement, copy: HTMLElement, form: HTMLElement): HeroBox {
  const hr = hero.getBoundingClientRect()
  // The name's spans are full-width blocks: use the right edge of the text itself.
  const range = document.createRange()
  let right = form.getBoundingClientRect().right
  for (const el of copy.children) {
    if (el === form) continue
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walk.nextNode()) {
      if (walk.currentNode.parentElement?.closest('[role="tooltip"]')) continue
      range.selectNodeContents(walk.currentNode)
      right = Math.max(right, range.getBoundingClientRect().right)
    }
  }
  return {
    w: hr.width,
    h: hr.height,
    top: BAR_H + 14,
    copyTop: copy.getBoundingClientRect().top - hr.top,
    copyRight: right - hr.left,
  }
}

// Before hydration (and without JS) the poster is placed by CSS that approximates layout() in
// cloud/figure.ts; once measured, the hero sets --fig-* exactly. The figure sits above the copy by
// default, and stands on the bottom edge right of the copy on wide stages.
// --below is the height of the links row and prompt bar under the name; Privacy wraps below 430 px.
const POSTER_BOX = [
  '[--fs:clamp(64px,10.5cqi,168px)] [--hh:clamp(620px,100svh,1000px)] [--below:110px] @max-[430px]:[--below:129px]',
  '[--copy-top:calc(var(--hh)_-_clamp(28px,7vh,72px)_-_var(--fs)*1.8_-_clamp(10px,1.2cqi,20px)_-_var(--below))]',
  '@max-[700px]:[--copy-top:calc(var(--hh)_-_84px_-_env(safe-area-inset-bottom)_-_var(--fs)*1.8_-_clamp(10px,1.2cqi,20px)_-_var(--below))]',
  '[--k:min(108cqi,(var(--copy-top)_-_84px)/1.05)] [--fig-w:calc(var(--k)*1.2)]',
  '[--fig-x:calc(min(50cqi,100cqi_-_8px_-_var(--k)*0.5)_-_var(--k)*0.6)]',
  '[--fig-y:calc(var(--copy-top)_-_14px_-_var(--k)*1.14)]',
  '@min-[1000px]:[--lb:calc(var(--spacing-gutter)_+_max(34rem,var(--fs)*3.63)_+_24px)]',
  '@min-[1000px]:[--rb:calc(100cqi_-_8px)]',
  '@min-[1000px]:[--s:min(var(--rb)_-_var(--lb),(var(--hh)_-_70px)/0.98,var(--hh)*0.84)]',
  '@min-[1000px]:[--fig-w:calc(var(--s)*1.2)] @min-[1000px]:[--fig-x:calc((var(--lb)_+_var(--rb))/2_-_var(--s)*0.6)]',
  '@min-[1000px]:[--fig-y:calc(var(--hh)_-_var(--s)*1.1)]',
].join(' ')

const LINK = 'underline decoration-current/45 decoration-1 underline-offset-4 hover:decoration-current'

export function Hero() {
  const { ask, focusAnchor, cited } = useSite()
  const router = useRouter()
  const { tier, auto, setTier } = useMotionTier()
  const still = tier === 'saver'

  const heroEl = useRef<HTMLElement | null>(null)
  const [inViewRef, inView] = useInView<HTMLElement>()
  const setHero = useCallback(
    (el: HTMLElement | null) => {
      heroEl.current = el
      inViewRef(el)
    },
    [inViewRef],
  )
  const copyRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const posterRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cloudRef = useRef<Cloud | null>(null)

  const [seen, setSeen] = useState(false)
  const [booted, setBooted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const [hover, setHover] = useState<{ i: number; x: number; y: number; flip: boolean } | null>(null)
  const live = !still && !failed

  // A work star lights up when any source in its block is cited.
  const citedStars = STARS.flatMap((s, i) => (s.sources.some((a) => cited[a]) ? [i] : []))
  const citedKey = citedStars.join()
  // Latest values for the renderer, which arrives asynchronously.
  const now = useRef({ tier, auto, inView, booted, citedStars })
  now.current = { tier, auto, inView, booted, citedStars }

  useEffect(() => {
    if (inView) setSeen(true)
  }, [inView])

  // The cloud assembles once the boot overlay has gone (it sets data-boot="skip" as it leaves).
  useEffect(() => {
    const root = document.documentElement
    const check = () => setBooted(root.dataset.boot !== 'play')
    check()
    const mo = new MutationObserver(check)
    mo.observe(root, { attributes: true, attributeFilter: ['data-boot'] })
    return () => mo.disconnect()
  }, [])

  const relayout = useCallback(() => {
    const hero = heroEl.current
    if (!hero || !copyRef.current || !formRef.current) return
    const box = measure(hero, copyRef.current, formRef.current)
    const fig = layout(box)
    const p = posterBox(fig)
    const poster = posterRef.current?.style
    poster?.setProperty('--fig-x', `${p.x}px`)
    poster?.setProperty('--fig-y', `${p.y}px`)
    poster?.setProperty('--fig-w', `${p.size}px`)
    cloudRef.current?.setLayout(fig, box.w, box.h)
  }, [])

  useEffect(() => {
    relayout()
    const ro = new ResizeObserver(relayout)
    if (heroEl.current) ro.observe(heroEl.current)
    if (copyRef.current) ro.observe(copyRef.current)
    // The name's width depends on the display font.
    document.fonts?.addEventListener('loadingdone', relayout)
    return () => {
      ro.disconnect()
      document.fonts?.removeEventListener('loadingdone', relayout)
    }
  }, [relayout])

  const slow = useRef(0)
  const onFps = useCallback(
    (v: number) => {
      setFps(v)
      // An automatic High that can't hold 40 fps for two seconds drops to Medium (not saved).
      const { tier: t, auto: a } = now.current
      slow.current = t === 'high' && a && v < 40 ? slow.current + 1 : 0
      if (slow.current >= 2) {
        slow.current = 0
        setTier('medium', { persist: false })
      }
    },
    [setTier],
  )

  // Load the renderer once the hero has been on screen, unless the tier is Saver.
  useEffect(() => {
    if (!live || !seen) return
    const canvas = canvasRef.current
    const load = loadRenderer()
    if (!canvas || !load) return
    let dead = false
    let ready = false
    let cloud: Cloud | null = null
    const fail = () => {
      if (dead) return
      setFailed(true)
      if (!ready) emitStage('ready') // the poster is up: the overlay needn't wait
    }
    load
      .then(async (m) => {
        if (dead) return
        emitStage('loaded')
        const c = await m.createCloud({
          canvas,
          src: CLOUD_SRC,
          stars: { work: STARS.length, personal: PERSONAL.length },
          tier: now.current.tier as CloudTier,
          onStage: (stage) => {
            emitStage(stage)
            if (stage !== 'ready') return
            ready = true
            setDrawn(true)
          },
          onFps,
          onLost: fail,
        })
        if (dead) return c?.destroy()
        if (!c) return fail()
        cloud = cloudRef.current = c
        relayout()
        c.setCited(now.current.citedStars)
        c.setActive(now.current.inView)
        if (now.current.booted) c.start()
      })
      .catch(fail)
    return () => {
      dead = true
      cloud?.destroy()
      cloudRef.current = null
      setDrawn(false)
      setHover(null)
    }
  }, [live, seen, onFps, relayout])

  // Only a mouse brushes the points; touch scrolls the page.
  const brush = useRef(false)
  const pointerAt = (e: React.MouseEvent, pick: boolean): number => {
    const cloud = cloudRef.current
    const hero = heroEl.current
    if (!cloud || !hero) return -1
    const r = hero.getBoundingClientRect()
    return cloud.pointer({ x: e.clientX - r.left, y: e.clientY - r.top, brush: brush.current, pick })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    brush.current = e.pointerType === 'mouse'
    // Over the copy the cloud still follows the cursor, but stars aren't picked.
    const pick = !(e.target as Element).closest('[data-hero-ui]')
    const i = pointerAt(e, pick)
    if (canvasRef.current) canvasRef.current.style.cursor = i >= 0 && (ALL_STARS[i].anchor || ALL_STARS[i].href) ? 'pointer' : ''
    if (i === (hover?.i ?? -1)) return
    if (i < 0 || !cloudRef.current) return setHover(null)
    const at = cloudRef.current.starAt(i)
    setHover({ i, ...at, flip: at.x + 300 > (heroEl.current?.clientWidth ?? 0) })
  }

  const onPointerLeave = () => {
    cloudRef.current?.pointer(null)
    setHover(null)
  }

  // Work stars open their line; personal dots are hover only, unless they link somewhere (Music).
  const onCanvasClick = (e: React.MouseEvent) => {
    const i = pointerAt(e, true)
    const { anchor, href } = ALL_STARS[i] ?? {}
    if (!anchor && !href) return
    onPointerLeave()
    if (anchor) focusAnchor(anchor)
    else if (href) router.push(href)
  }

  useEffect(() => {
    if (tier !== 'saver') cloudRef.current?.setTier(tier)
  }, [tier])
  useEffect(() => {
    cloudRef.current?.setActive(inView)
    if (!inView) onPointerLeave()
  }, [inView])
  useEffect(() => {
    if (booted) cloudRef.current?.start()
  }, [booted])
  useEffect(() => cloudRef.current?.setCited(now.current.citedStars), [citedKey])

  // Prompt bar: the placeholder cycles through the Ask panel's starters while the box is idle.
  const [ph, setPh] = useState(0)
  const [fade, setFade] = useState(false)
  useEffect(() => {
    if (still) return
    let swap: ReturnType<typeof setTimeout> | undefined
    const id = setInterval(() => {
      const el = inputRef.current
      if (!el || el.value || document.activeElement === el || !now.current.inView) return
      setFade(true)
      swap = setTimeout(() => {
        setPh((i) => (i + 1) % STARTERS.length)
        setFade(false)
      }, 300)
    }, 3400)
    return () => {
      clearInterval(id)
      clearTimeout(swap)
    }
  }, [still])
  const placeholder = still ? STARTERS[0] : STARTERS[ph]

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const el = inputRef.current
    if (!el) return
    const q = el.value.trim() || placeholder
    el.value = ''
    ask(q)
  }

  // M15: the Ask button leans towards a mouse pointer, up to 6 px.
  const magnet = useMagnetic<HTMLButtonElement>()

  const star = hover ? ALL_STARS[hover.i] : null
  const starCited = star ? starCitations(star, cited) : []
  // Shown in the clone status card on the Ask panel's avatar.
  const render = still ? 'saver, static' : failed ? 'static poster' : `${tier}, ${fps ?? '…'} fps`
  useEffect(() => setRenderStatus(render), [render])

  return (
    <section
      ref={setHero}
      id="home"
      aria-labelledby="hero-name"
      onPointerMove={live ? onPointerMove : undefined}
      onPointerLeave={live ? onPointerLeave : undefined}
      className="@container relative h-svh max-h-[1000px] min-h-[620px] overflow-hidden bg-[radial-gradient(110%_90%_at_66%_44%,var(--color-forest)_0%,var(--color-night)_50%,var(--color-night-deep)_100%)] text-term-text print:h-auto print:min-h-0 print:overflow-visible print:bg-none print:pt-2 print:text-ink"
    >
      <div
        ref={posterRef}
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 aspect-square w-(--fig-w) [translate:var(--fig-x)_var(--fig-y)] transition-opacity duration-700 print:hidden ${POSTER_BOX} ${live && drawn ? 'opacity-0' : ''}`}
      >
        <svg viewBox="0 0 1 1" className="block size-full">
          {/* The poster's three panels: points, work stars, personal dots. */}
          {['points', 'stars', 'personal'].map((id, k) => (
            <mask key={id} id={`hero-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1">
              <image href={CLOUD_POSTER} x={-k} width="3" height="1" preserveAspectRatio="none" />
            </mask>
          ))}
          <rect width="1" height="1" mask="url(#hero-points)" className="fill-term-accent" />
          <rect width="1" height="1" mask="url(#hero-stars)" className="fill-sun" />
          <rect width="1" height="1" mask="url(#hero-personal)" className="fill-term-text" />
        </svg>
      </div>
      {live && (
        <canvas
          ref={canvasRef}
          aria-hidden
          onClick={onCanvasClick}
          className={`absolute inset-0 size-full touch-pan-y transition-opacity duration-700 print:hidden ${drawn ? '' : 'opacity-0'}`}
        />
      )}

      {star && hover && (
        <div
          aria-hidden
          className={`pointer-events-none absolute z-[3] max-w-[280px] -translate-y-1/2 rounded-lg border bg-night-deep/95 px-2.5 py-2 text-[13px] leading-[1.4] text-term-text ${star.kind === 'work' ? 'border-sun/55' : 'border-term-text/40'} ${hover.flip ? '-translate-x-[calc(100%_+_14px)]' : 'translate-x-3.5'}`}
          style={{ left: hover.x, top: hover.y }}
        >
          <span className={`block font-mono text-[11px] font-medium ${starCited.length ? 'text-coral-glow' : star.kind === 'work' ? 'text-sun' : 'text-term-text'}`}>
            {star.name}
            {starCited.length > 0 && ` · cited [${starCited.join(', ')}]`}
          </span>
          {star.words.length > 0 && <span className="mt-[3px] block">{star.words.join(' · ')}</span>}
        </div>
      )}

      <div
        ref={copyRef}
        data-hero-ui
        className="absolute bottom-[clamp(28px,7vh,72px)] left-gutter z-[2] w-[min(40rem,calc(100%_-_2*var(--spacing-gutter)))] @max-[700px]:bottom-[calc(84px_+_env(safe-area-inset-bottom))] print:static print:w-auto print:px-gutter"
      >
        <h1 id="hero-name" className="type-display m-0 text-[clamp(64px,10.5cqi,168px)] print:text-7xl">
          <span className="block">Raj</span> <span className="block">Dholakia</span>
        </h1>
        <div className="mt-[clamp(10px,1.2cqi,20px)] flex max-w-[34rem] flex-wrap items-baseline gap-x-6 font-medium print:hidden">
          <a href="#fit" className={`inline-flex min-h-11 items-center ${LINK}`}>
            Check my fit for a role
          </a>
          <a href="#agents" className={`inline-flex min-h-11 items-center ${LINK}`}>
            Connect your agent
          </a>
          {/* The AI and logging disclosure sits behind this link; the Ask panel shows it under its input. */}
          <PrivacyLink />
        </div>
        <form
          ref={formRef}
          role="search"
          aria-label="Ask my AI clone"
          onSubmit={onSubmit}
          className="mt-2 flex max-w-[34rem] gap-1.5 rounded-[14px] border border-term-text/30 bg-night-deep/55 p-1.5 backdrop-blur-[8px] focus-within:border-term-accent print:hidden"
        >
          <label htmlFor={HERO_PROMPT_ID} className="sr-only">
            Ask my AI clone a question
          </label>
          <input
            ref={inputRef}
            id={HERO_PROMPT_ID}
            autoComplete="off"
            maxLength={1000}
            placeholder={placeholder}
            className={`min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2.5 text-base text-term-text placeholder:text-term-dim placeholder:transition-opacity placeholder:duration-300 ${fade ? 'placeholder:opacity-0' : ''}`}
          />
          <button
            ref={magnet}
            type="submit"
            className="shrink-0 rounded-[10px] bg-term-accent px-5 text-[15px] font-semibold text-pine transition-[translate,background-color] duration-200 ease-out hover:bg-term-text"
          >
            Ask
          </button>
        </form>
      </div>
    </section>
  )
}

/**
 * Hover or focus shows the disclosure. Touch has no hover, so there the first tap shows it and the second
 * follows the link; a tap anywhere else hides it.
 */
function PrivacyLink() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const tapped = useRef(false)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent): void => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <span ref={wrap} className="group/privacy relative ml-auto inline-block text-[13px] font-normal leading-[1.45] text-term-dim">
      <a
        href="#privacy"
        aria-describedby="hero-disclosure"
        className={LINK}
        onPointerDown={(e) => {
          tapped.current = e.pointerType !== 'mouse'
        }}
        onClick={(e) => {
          const tap = tapped.current
          tapped.current = false
          if (tap && !open) e.preventDefault()
          setOpen(tap && !open)
        }}
      >
        Privacy
      </a>
      <span
        id="hero-disclosure"
        role="tooltip"
        className={`absolute bottom-full right-0 z-[3] mb-1.5 w-max max-w-[min(34rem,calc(100cqi_-_2*var(--spacing-gutter)))] rounded-md border border-term-text/20 bg-night-deep px-2.5 py-1.5 text-term-text group-focus-within/privacy:block group-hover/privacy:block ${open ? 'block' : 'hidden'}`}
      >
        An AI clone of me. It can be wrong, and questions are logged (never your IP).
      </span>
    </span>
  )
}
