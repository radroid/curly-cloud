import { describe, expect, it } from 'vitest'
import { isShortcut, type ShortcutEvent } from './use-key-shortcut'

const target = (editable: boolean): EventTarget => ({ closest: () => (editable ? {} : null) }) as unknown as EventTarget

function press(key: string, extra: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key, metaKey: false, ctrlKey: false, altKey: false, repeat: false, target: target(false), ...extra }
}

describe('isShortcut', () => {
  it('matches the key in either case', () => {
    expect(isShortcut(press('c'), 'c')).toBe(true)
    expect(isShortcut(press('C'), 'c')).toBe(true)
  })

  it('ignores other keys', () => {
    expect(isShortcut(press('v'), 'c')).toBe(false)
  })

  it('leaves ⌘C, Ctrl+C and Alt+C to the browser', () => {
    expect(isShortcut(press('c', { metaKey: true }), 'c')).toBe(false)
    expect(isShortcut(press('c', { ctrlKey: true }), 'c')).toBe(false)
    expect(isShortcut(press('c', { altKey: true }), 'c')).toBe(false)
  })

  it('fires once while the key is held', () => {
    expect(isShortcut(press('c', { repeat: true }), 'c')).toBe(false)
  })

  it('ignores typing in a field', () => {
    expect(isShortcut(press('c', { target: target(true) }), 'c')).toBe(false)
  })

  it('works when the target is the document', () => {
    expect(isShortcut(press('c', { target: null }), 'c')).toBe(true)
  })
})
