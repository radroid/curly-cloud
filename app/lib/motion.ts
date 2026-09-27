/**
 * Render tiers for the resume page, and the tiny <head> script that picks one before first paint.
 *
 * The script sets two attributes on <html>:
 * - `data-motion`: `high` | `medium` | `saver`. A choice saved in localStorage wins; otherwise it's
 *   picked from reduced motion, Save-Data, pointer type, cores and memory (`data-tier-auto` marks
 *   an automatic pick, which the renderer may downgrade if frames are slow).
 * - `data-boot`: `play` | `skip`. The intro plays once per session on `/`, and never for reduced
 *   motion, Saver, a `#r-…` deep link or a later visit in the same session.
 *
 * CSS reads both (`still:` variant, the boot overlay), so nothing flashes before hydration.
 */

export type MotionTier = 'high' | 'medium' | 'saver'

export const MOTION_TIERS: { id: MotionTier; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'saver', label: 'Saver' },
]

/** localStorage: the visitor's chosen tier. */
export const TIER_KEY = 'curlycloud-tier'
/** sessionStorage: set once the intro has played (or been skipped). */
export const BOOT_KEY = 'curlycloud-booted'

export function isMotionTier(v: unknown): v is MotionTier {
  return v === 'high' || v === 'medium' || v === 'saver'
}

// Plain ES5 on purpose: it runs before anything else, in every browser that loads the page.
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;try{
var t=localStorage.getItem('${TIER_KEY}');
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(t!=='high'&&t!=='medium'&&t!=='saver'){
var c=navigator.connection,n=navigator.hardwareConcurrency||8,m=navigator.deviceMemory||8;
t=rm||(c&&c.saveData)?'saver':matchMedia('(pointer: coarse)').matches||n<=4||m<=4?'medium':'high';
d.setAttribute('data-tier-auto','');}
d.setAttribute('data-motion',t);
var skip=rm||t==='saver'||location.pathname!=='/'||location.hash.indexOf('#r-')===0||sessionStorage.getItem('${BOOT_KEY}');
d.setAttribute('data-boot',skip?'skip':'play');
}catch(e){d.setAttribute('data-boot','skip');}})()`

/** The tier currently applied to the page (`saver` before the head script has run, e.g. on the server). */
export function currentTier(): MotionTier {
  if (typeof document === 'undefined') return 'saver'
  const t = document.documentElement.dataset.motion
  return isMotionTier(t) ? t : 'saver'
}

/**
 * Apply a tier. `persist: false` is for automatic downgrades (slow frames), which shouldn't
 * overwrite what the visitor chose.
 */
export function applyTier(tier: MotionTier, { persist = true }: { persist?: boolean } = {}): void {
  const d = document.documentElement
  d.dataset.motion = tier
  if (!persist) return
  delete d.dataset.tierAuto
  try {
    localStorage.setItem(TIER_KEY, tier)
  } catch {
    // Private mode or storage disabled: the choice lasts for this page only.
  }
}

/** Remember that the intro has run this session. */
export function markBooted(): void {
  document.documentElement.dataset.boot = 'skip'
  try {
    sessionStorage.setItem(BOOT_KEY, '1')
  } catch {
    // Storage disabled: the intro may play again on the next load.
  }
}
