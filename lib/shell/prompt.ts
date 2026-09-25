import { expandVarsInText } from './expand'
import { tildify } from './vfs'
import type { Segment, SegmentStyle } from './types'

export const DEFAULT_PS1 = '\\u@\\h:\\w\\$ '

export interface PromptInfo {
  user: string
  hostname: string
  cwd: string
  home: string
  now: Date
  getVar(name: string): string | undefined
}

const two = (n: number): string => String(n).padStart(2, '0')

/**
 * Render PS1 into styled segments. Supports \u \h \H \w \W \$ \t \A \d \n \\ and \[ \] (ignored),
 * plus $VAR expansion, like bash with promptvars on.
 */
export function renderPrompt(ps1: string, info: PromptInfo): Segment[] {
  const out: Segment[] = []
  const push = (text: string, style?: SegmentStyle): void => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.style === style) last.text += text
    else out.push(style ? { text, style } : { text })
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  for (let i = 0; i < ps1.length; i++) {
    const c = ps1[i]
    if (c !== '\\' || i + 1 >= ps1.length) {
      if (c === '$' && /[A-Za-z_{?]/.test(ps1[i + 1] ?? '')) {
        const m = /^\$(\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*|\?)/.exec(ps1.slice(i))
        if (m) {
          push(expandVarsInText(m[0], info.getVar))
          i += m[0].length - 1
          continue
        }
      }
      push(c)
      continue
    }
    const e = ps1[++i]
    switch (e) {
      case 'u':
        push(info.user, 'accent')
        break
      case 'h':
        push(info.hostname.split('.')[0], 'accent')
        break
      case 'H':
        push(info.hostname, 'accent')
        break
      case 'w':
        push(tildify(info.cwd, info.home), 'highlight')
        break
      case 'W': {
        const t = tildify(info.cwd, info.home)
        push(t === '~' || t === '/' ? t : t.slice(t.lastIndexOf('/') + 1), 'highlight')
        break
      }
      case '$':
        push(info.user === 'root' ? '#' : '$', 'prompt')
        break
      case 't':
        push(`${two(info.now.getHours())}:${two(info.now.getMinutes())}:${two(info.now.getSeconds())}`, 'dim')
        break
      case 'A':
        push(`${two(info.now.getHours())}:${two(info.now.getMinutes())}`, 'dim')
        break
      case 'd':
        push(`${days[info.now.getDay()]} ${months[info.now.getMonth()]} ${two(info.now.getDate())}`, 'dim')
        break
      case 'n':
        push(' ')
        break
      case '[':
      case ']':
        break
      case '\\':
        push('\\')
        break
      default:
        push('\\' + e)
    }
  }
  return out
}
