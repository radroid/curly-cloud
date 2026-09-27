import { describe, expect, it } from 'vitest'
import { BOOT_SCRIPT } from './motion'

interface Env {
  stored?: string | null
  reduced?: boolean
  coarse?: boolean
  saveData?: boolean
  cores?: number
  memory?: number
  path?: string
  hash?: string
  booted?: boolean
  storageBlocked?: boolean
}

/** Run the <head> script against fake browser globals and return the attributes it set on <html>. */
function run(env: Env = {}): Record<string, string> {
  const attrs: Record<string, string> = {}
  const globals = {
    document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
    localStorage: {
      getItem: () => {
        if (env.storageBlocked) throw new Error('SecurityError')
        return env.stored ?? null
      },
    },
    sessionStorage: { getItem: () => (env.booted ? '1' : null) },
    matchMedia: (q: string) => ({ matches: q.includes('reduced-motion') ? !!env.reduced : q.includes('coarse') ? !!env.coarse : false }),
    navigator: { connection: { saveData: !!env.saveData }, hardwareConcurrency: env.cores ?? 8, deviceMemory: env.memory ?? 8 },
    location: { pathname: env.path ?? '/', hash: env.hash ?? '' },
  }
  new Function(...Object.keys(globals), BOOT_SCRIPT)(...Object.values(globals))
  return attrs
}

describe('BOOT_SCRIPT', () => {
  it('plays the intro at High on a capable desktop', () => {
    expect(run()).toEqual({ 'data-tier-auto': '', 'data-motion': 'high', 'data-boot': 'play' })
  })

  it('picks Medium for touch, few cores or little memory', () => {
    expect(run({ coarse: true })['data-motion']).toBe('medium')
    expect(run({ cores: 4 })['data-motion']).toBe('medium')
    expect(run({ memory: 2 })['data-motion']).toBe('medium')
  })

  it('picks Saver and skips the intro for reduced motion or Save-Data', () => {
    expect(run({ reduced: true })).toMatchObject({ 'data-motion': 'saver', 'data-boot': 'skip' })
    expect(run({ saveData: true })).toMatchObject({ 'data-motion': 'saver', 'data-boot': 'skip' })
  })

  it('keeps a saved choice, even over reduced motion, but still skips the intro there', () => {
    const a = run({ stored: 'medium' })
    expect(a['data-motion']).toBe('medium')
    expect(a).not.toHaveProperty('data-tier-auto')
    expect(run({ stored: 'high', reduced: true })).toMatchObject({ 'data-motion': 'high', 'data-boot': 'skip' })
    expect(run({ stored: 'nonsense' })['data-motion']).toBe('high')
  })

  it('skips the intro later in the session, off the home page and on a deep link', () => {
    expect(run({ booted: true })['data-boot']).toBe('skip')
    expect(run({ path: '/terminal' })['data-boot']).toBe('skip')
    expect(run({ hash: '#r-exp-eddy-mcp' })['data-boot']).toBe('skip')
    expect(run({ hash: '#fit' })['data-boot']).toBe('play')
  })

  it('skips the intro when storage is blocked', () => {
    expect(run({ storageBlocked: true })['data-boot']).toBe('skip')
  })
})
