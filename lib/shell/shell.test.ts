import { describe, expect, it } from 'vitest'
import { HOME } from './fs-content'
import { makeShell, memoryStorage, run } from './test-helpers'
import { normalizePath, resolvePath, VFS, modeString } from './vfs'
import { buildBaseTree } from './fs-content'

describe('expansion', () => {
  it('expands variables, ${}, defaults and lengths', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo $USER ${HOME} ${NOPE:-fallback} ${#USER}')).out).toBe('guest /home/raj fallback 5\n')
    expect((await run(sh, 'X=; echo "${X-set but empty}|${X:-empty}"')).out).toBe('|empty\n')
    expect((await run(sh, 'echo ${Y:=assigned}; echo $Y')).out).toBe('assigned\nassigned\n')
  })

  it('tracks $? across commands', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'false; echo $?')).out).toBe('1\n')
    expect((await run(sh, 'true; echo $?')).out).toBe('0\n')
    expect((await run(sh, 'nosuchcmd 2>/dev/null; echo $?')).out).toBe('127\n')
    await run(sh, 'false')
    expect((await run(sh, 'echo $?')).out).toBe('1\n')
  })

  it('distinguishes single quotes, double quotes and escapes', async () => {
    const sh = await makeShell()
    expect((await run(sh, `echo "$USER" '$USER' \\$USER`)).out).toBe('guest $USER $USER\n')
    expect((await run(sh, 'echo a    b "c    d"')).out).toBe('a b c    d\n')
  })

  it('field-splits unquoted expansions but not quoted ones', async () => {
    const sh = await makeShell()
    await run(sh, 'X="one   two"')
    expect((await run(sh, 'printf_args() { :; }; echo $X')).code).not.toBe(0) // functions are not supported
    expect((await run(sh, 'echo $X')).out).toBe('one two\n')
    expect((await run(sh, 'echo "$X"')).out).toBe('one   two\n')
    expect((await run(sh, 'cd $X')).err).toMatch(/too many arguments/)
  })

  it('drops empty unquoted expansions but keeps empty quoted strings', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo $NOPE x')).out).toBe('x\n')
    expect((await run(sh, 'env E="" printenv E')).out).toBe('\n')
  })

  it('runs command substitution in a subshell and strips trailing newlines', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo "[$(printf_missing 2>/dev/null)]"')).out).toBe('[]\n')
    expect((await run(sh, 'echo "you are $(whoami) in $(pwd)"')).out).toBe(`you are guest in ${HOME}\n`)
    expect((await run(sh, 'x=$(cd /tmp; pwd); echo $x; pwd')).out).toBe(`/tmp\n${HOME}\n`)
    expect((await run(sh, 'x=$(false); echo $?')).out).toBe('1\n')
    expect((await run(sh, 'echo `echo back`')).out).toBe('back\n')
  })

  it('does arithmetic', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'N=4; echo $((N * (2 + 3))) $((7 / 2)) $((7 % 3)) $((2 ** 5)) $((-3 + 1))')).out).toBe('20 3 1 32 -2\n')
    const r = await run(sh, 'echo $((1 / 0))')
    expect(r.err).toMatch(/division by 0/)
    expect(r.code).toBe(1)
  })

  it('expands tildes', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo ~ ~/builds ~raj "~" ~nobody')).out).toBe(`${HOME} ${HOME}/builds ${HOME} ~ ~nobody\n`)
  })

  it('expands globs against the filesystem, sorted, skipping dotfiles', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo *.md')).out).toBe('education.md README.md resume.md\n')
    expect((await run(sh, 'echo .p*')).out).toBe('.profile\n')
    expect((await run(sh, 'echo experience/*.md')).out).toMatch(/^experience\/aro\.md experience\/create-club\.md .*experience\/eddy-solutions\.md/)
    expect((await run(sh, 'echo skills/[ce]*')).out).toBe('skills/cloud.txt skills/code.txt skills/evals.txt\n')
    expect((await run(sh, 'echo skills/[^ce]*')).out).toBe('skills/genai.txt skills/retrieval.txt skills/ways.txt\n')
    expect((await run(sh, 'echo /home/raj/b?ilds')).out).toBe('/home/raj/builds\n')
    expect((await run(sh, 'echo "*.md" nomatch*')).out).toBe('*.md nomatch*\n')
  })
})

describe('environment and shell variables', () => {
  it('keeps plain assignments out of the environment until exported', async () => {
    const sh = await makeShell()
    await run(sh, 'COLOR=green')
    expect((await run(sh, 'echo $COLOR')).out).toBe('green\n')
    expect((await run(sh, 'env')).out).not.toMatch(/COLOR=/)
    expect((await run(sh, 'printenv COLOR')).code).toBe(1)
    expect((await run(sh, 'set')).out).toMatch(/^COLOR=green$/m)
    await run(sh, 'export COLOR')
    expect((await run(sh, 'env')).out).toMatch(/^COLOR=green$/m)
    expect((await run(sh, 'printenv COLOR')).out).toBe('green\n')
    await run(sh, 'export -n COLOR')
    expect((await run(sh, 'env')).out).not.toMatch(/COLOR=/)
    expect((await run(sh, 'echo $COLOR')).out).toBe('green\n')
  })

  it('export NAME=value, export -p and unset', async () => {
    const sh = await makeShell()
    await run(sh, 'export A=1 B="x y"')
    expect((await run(sh, 'export -p')).out).toMatch(/declare -x B="x y"/)
    await run(sh, 'unset A')
    expect((await run(sh, 'echo "[$A]"')).out).toBe('[]\n')
    expect((await run(sh, 'export 1bad')).err).toMatch(/not a valid identifier/)
  })

  it('export NAME with no value marks it for later', async () => {
    const sh = await makeShell()
    await run(sh, 'export LATER')
    expect((await run(sh, 'env')).out).not.toMatch(/LATER/)
    await run(sh, 'LATER=now')
    expect((await run(sh, 'printenv LATER')).out).toBe('now\n')
  })

  it('applies NAME=value cmd only to that command', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'GREETING=hi printenv GREETING')).out).toBe('hi\n')
    expect((await run(sh, 'echo "[$GREETING]"')).out).toBe('[]\n')
    // Classic gotcha: the line is expanded before the assignment applies.
    expect((await run(sh, 'GREETING=hi echo "[$GREETING]"')).out).toBe('[]\n')
  })

  it('has the expected defaults, some from ~/.profile', async () => {
    const sh = await makeShell()
    const env = (await run(sh, 'env')).out
    for (const k of ['USER=guest', `HOME=${HOME}`, `PWD=${HOME}`, `OLDPWD=${HOME}`, 'SHELL=/bin/rsh', 'PATH=/usr/local/bin:/bin', 'TERM=', 'EDITOR=', 'LANG=']) {
      expect(env).toContain(k)
    }
    expect(env).toContain('RAJ_ROLE=Lead Software Developer')
    expect(env).toContain('RAJ_LOCATION=Toronto, ON')
    expect(env).toContain('RAJ_EMAIL=raj9dholakia@gmail.com')
    expect(env).not.toMatch(/PS1=|RAJ_MOTTO/)
    expect((await run(sh, 'set')).out).toMatch(/RAJ_MOTTO='design for reliability first'/)
  })

  it('renders PS1 live, with escapes and $VARS', async () => {
    const sh = await makeShell()
    const prompt = (): string => sh.prompt().map((s) => s.text).join('')
    expect(prompt()).toBe('guest@curlycloud:~$ ')
    await run(sh, 'cd builds')
    expect(prompt()).toBe('guest@curlycloud:~/builds$ ')
    await run(sh, `PS1='\\W > '`)
    expect(prompt()).toBe('builds > ')
    await run(sh, `PS1='[\\u on \\h] \\w \\$ '`)
    expect(prompt()).toBe('[guest on curlycloud] ~/builds $ ')
    await run(sh, `PS1='$USER@\\t> '`)
    expect(prompt()).toMatch(/^guest@\d\d:\d\d:\d\d> $/)
    const segs = sh.prompt()
    expect(segs.find((s) => s.text === 'guest')?.style).toBeUndefined()
    await run(sh, `PS1='\\u:\\w\\$ '`)
    const styled = sh.prompt()
    expect(styled.find((s) => s.text === 'guest')?.style).toBe('accent')
    expect(styled.find((s) => s.text === '~/builds')?.style).toBe('highlight')
    expect(styled.find((s) => s.text === '$')?.style).toBe('prompt')
  })

  it('$RANDOM, $$ and $0 exist', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo $0 $$ $RANDOM')).out).toBe('rsh 1984 16384\n')
  })
})

describe('virtual filesystem', () => {
  it('normalizes and resolves paths', () => {
    expect(normalizePath('/a/./b/../c//d/')).toBe('/a/c/d')
    expect(normalizePath('/../..')).toBe('/')
    expect(resolvePath('/home/raj', '../x')).toBe('/home/x')
    expect(resolvePath('/home/raj', '/etc/motd')).toBe('/etc/motd')
    expect(resolvePath('/home/raj', '')).toBe('/home/raj')
  })

  it('navigates with .., ~, -, absolute and relative paths', async () => {
    const sh = await makeShell()
    await run(sh, 'cd experience')
    expect(sh.cwd).toBe(`${HOME}/experience`)
    await run(sh, 'cd ../builds')
    expect(sh.cwd).toBe(`${HOME}/builds`)
    expect((await run(sh, 'cd -')).out).toBe(`${HOME}/experience\n`)
    await run(sh, 'cd /etc')
    expect((await run(sh, 'pwd')).out).toBe('/etc\n')
    await run(sh, 'cd ~/skills')
    expect(sh.cwd).toBe(`${HOME}/skills`)
    await run(sh, 'cd')
    expect(sh.cwd).toBe(HOME)
    await run(sh, 'cd ../../..')
    expect(sh.cwd).toBe('/')
    expect((await run(sh, 'echo $PWD $OLDPWD')).out).toBe(`/ ${HOME}\n`)
  })

  it('reports missing paths and non-directories', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'cd nope')).err).toMatch(/cd: nope: No such file or directory/)
    expect((await run(sh, 'cd about.txt')).err).toMatch(/Not a directory/)
    expect((await run(sh, 'cat about.txt/x')).err).toMatch(/Not a directory/)
  })

  it("keeps Raj's files read-only and explains why", async () => {
    const sh = await makeShell()
    const rm = await run(sh, 'rm resume.md')
    expect(rm.code).toBe(1)
    expect(rm.err).toMatch(/rm: cannot remove 'resume.md': Permission denied/)
    expect(rm.err).toMatch(/belongs to raj \(-rw-r--r--\)/)
    expect(rm.err).toMatch(/\/tmp is writable/)
    expect((await run(sh, 'echo x > resume.md')).err).toMatch(/resume.md: Permission denied/)
    expect((await run(sh, 'touch new.txt')).err).toMatch(/cannot touch 'new.txt': Permission denied/)
    expect((await run(sh, 'mkdir ~/mine')).err).toMatch(/Permission denied/)
    expect((await run(sh, 'mv about.txt /tmp/')).err).toMatch(/cannot move 'about.txt'.*Permission denied/)
    expect((await run(sh, 'cat resume.md')).code).toBe(0)
    // The resume is unchanged.
    expect(sh.vfs.read(`${HOME}/resume.md`)).toMatch(/^# Raj Dholakia/)
  })

  it('writes to the /tmp overlay', async () => {
    const sh = await makeShell()
    await run(sh, 'echo hello > /tmp/a.txt; echo again >> /tmp/a.txt')
    expect((await run(sh, 'cat /tmp/a.txt')).out).toBe('hello\nagain\n')
    await run(sh, 'mkdir -p /tmp/x/y && touch /tmp/x/y/z && cp /tmp/a.txt /tmp/x/')
    expect((await run(sh, 'find /tmp -type f')).out).toBe('/tmp/a.txt\n/tmp/x/a.txt\n/tmp/x/y/z\n')
    await run(sh, 'mv /tmp/x/a.txt /tmp/b.txt')
    expect((await run(sh, 'ls /tmp')).out).toBe('a.txt  b.txt  x\n')
    expect((await run(sh, 'ls /tmp | cat')).out).toBe('a.txt\nb.txt\nx\n')
    expect((await run(sh, 'rm /tmp/x')).err).toMatch(/Is a directory/)
    await run(sh, 'rm -r /tmp/x')
    expect((await run(sh, 'ls -1 /tmp')).out).toBe('a.txt\nb.txt\n')
    expect((await run(sh, 'ls -l /tmp')).out).toMatch(/-rw-r--r-- 1 guest guest\s+12 .* a\.txt/)
  })

  it('has permission bits that match the story', () => {
    const tree = buildBaseTree([])
    expect(modeString(tree.get('/tmp')!)).toBe('drwxrwxrwt')
    expect(modeString(tree.get(`${HOME}/.secrets`)!)).toBe('-r--------')
    expect(modeString(tree.get(HOME)!)).toBe('drwxr-xr-x')
  })

  it('denies reading .secrets with a joke', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'cat .secrets')
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/Permission denied/)
    expect(r.err).toMatch(/only its owner, raj, can read it/)
  })

  it('caps the overlay size', async () => {
    const vfs = new VFS(buildBaseTree([]))
    expect(() => vfs.write('/tmp/big', 'x'.repeat(250_000))).toThrow(/No space left/)
  })

  it('/dev/null swallows writes', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo gone > /dev/null; cat /dev/null')).out).toBe('')
    expect((await run(sh, 'cat nope 2>/dev/null')).err).toBe('')
  })
})

describe('execution', () => {
  it('pipes stdout between commands', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo hello | cat')).out).toBe('hello\n')
    expect((await run(sh, 'ls experience | wc -l')).out).toBe('5\n')
    expect((await run(sh, 'cat *.md | grep -i agent | wc -l')).out).toMatch(/^\d+\n$/)
    expect((await run(sh, 'seq 5 | sort -rn | head -2')).out).toBe('5\n4\n')
  })

  it('runs each pipeline stage in a subshell', async () => {
    const sh = await makeShell()
    await run(sh, 'cd /tmp | cat; X=1 | cat')
    expect(sh.cwd).toBe(HOME)
    expect((await run(sh, 'echo "[$X]"')).out).toBe('[]\n')
  })

  it('uses the last command’s exit code for a pipeline, and ! flips it', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'false | true')).code).toBe(0)
    expect((await run(sh, 'true | false')).code).toBe(1)
    expect((await run(sh, '! grep -q zzzz resume.md')).code).toBe(0)
  })

  it('short-circuits && and ||', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'true && echo yes || echo no')).out).toBe('yes\n')
    expect((await run(sh, 'false && echo yes || echo no')).out).toBe('no\n')
    expect((await run(sh, 'cat nope.txt 2>/dev/null || echo "no such file"')).out).toBe('no such file\n')
    expect((await run(sh, 'false; echo after')).out).toBe('after\n')
    const r = await run(sh, 'false && echo never')
    expect(r.out).toBe('')
    expect(r.code).toBe(1)
  })

  it('redirects stdin, stdout and stderr', async () => {
    const sh = await makeShell()
    await run(sh, 'printf 2>/dev/null; echo b > /tmp/in; echo a >> /tmp/in')
    expect((await run(sh, 'sort < /tmp/in')).out).toBe('a\nb\n')
    await run(sh, 'cat nope 2> /tmp/err')
    expect(sh.vfs.read('/tmp/err')).toMatch(/nope: No such file/)
    await run(sh, 'cat nope > /tmp/both 2>&1')
    expect(sh.vfs.read('/tmp/both')).toMatch(/No such file/)
    expect((await run(sh, 'cat nope 2>&1 | wc -l')).out).toBe('1\n')
    expect((await run(sh, 'sort < /tmp/missing')).err).toMatch(/\/tmp\/missing: No such file/)
  })

  it('truncates before running, like a real shell', async () => {
    const sh = await makeShell()
    await run(sh, 'echo old > /tmp/f')
    await run(sh, 'echo new > /tmp/f')
    expect(sh.vfs.read('/tmp/f')).toBe('new\n')
  })

  it('runs subshells without leaking state', async () => {
    const sh = await makeShell()
    const r = await run(sh, '(cd /tmp && pwd; Y=2); pwd; echo "[$Y]"')
    expect(r.out).toBe(`/tmp\n${HOME}\n[]\n`)
    expect((await run(sh, '(exit 3); echo $?')).out).toBe('3\n')
  })

  it('reads heredocs from the keyboard', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'cat <<EOF > /tmp/h', { input: ['line one $USER', "it's fine", 'EOF'] })
    expect(r.prompts).toEqual(['> ', '> ', '> '])
    expect(sh.vfs.read('/tmp/h')).toBe("line one guest\nit's fine\n")
    await run(sh, `cat <<'EOF' > /tmp/q`, { input: ['$USER', 'EOF'] })
    expect(sh.vfs.read('/tmp/q')).toBe('$USER\n')
  })

  it('reports command not found with a typo suggestion', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'sl -la')
    expect(r.code).toBe(127)
    expect(r.err).toMatch(/rsh: command not found: sl — did you mean ls\?/)
    const link = r.errSegs.find((s) => s.link?.kind === 'command')
    expect(link?.link).toEqual({ kind: 'command', command: 'ls -la' })
    expect((await run(sh, 'grpe x')).err).toMatch(/did you mean grep/)
    expect((await run(sh, 'qqqqqq')).err).toMatch(/command not found: qqqqqq\nType help/)
  })

  it('finds programs through PATH, and explains when PATH is broken', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'PATH=/nowhere ls')
    expect(r.code).toBe(127)
    expect(r.err).toMatch(/ls lives in \/bin, which isn't in your PATH/)
    expect((await run(sh, 'PATH=/nowhere cd /tmp; pwd')).out).toBe('/tmp\n')
    expect((await run(sh, '/bin/ls -d /tmp')).out).toBe('/tmp\n')
    expect((await run(sh, 'cd; ./about.txt')).err).toMatch(/Permission denied/)
  })

  it('reports syntax errors with exit code 2 and a hint', async () => {
    const sh = await makeShell()
    const r = await run(sh, "echo 'unterminated")
    expect(r.code).toBe(2)
    expect(r.err).toMatch(/unterminated single quote/)
    expect(r.err).toMatch(/closing '/)
  })

  it('expands history: !!, !n, !-n and !prefix', async () => {
    const sh = await makeShell()
    await run(sh, 'echo one')
    await run(sh, 'echo two')
    const again = await run(sh, '!!')
    expect(again.out).toBe('echo two\ntwo\n')
    expect((await run(sh, '!1')).out).toBe('echo one\none\n')
    expect((await run(sh, '!-2')).out).toMatch(/two\n$/)
    expect((await run(sh, "echo '!!' !ech")).out).toMatch(/^echo '!!' echo two\n!! echo two\n$/)
    const bad = await run(sh, '!99')
    expect(bad.err).toMatch(/!99: event not found/)
    expect(sh.history.at(-1)).not.toBe('!99')
  })

  it('stops on abort with exit code 130', async () => {
    const sh = await makeShell()
    const ac = new AbortController()
    ac.abort()
    expect((await run(sh, 'echo hi; echo there', { signal: ac.signal })).code).toBe(130)
  })
})

describe('persistence', () => {
  it('saves history, exported vars, aliases, files and learn progress, and restores them', async () => {
    const storage = memoryStorage()
    const a = await makeShell({ storage })
    await run(a, 'export COLOR=green')
    await run(a, 'SHELLONLY=1')
    await run(a, "alias hi='echo hello'")
    await run(a, 'unalias la')
    await run(a, 'echo kept > /tmp/keep.txt')
    await run(a, 'learn')
    expect(storage.data).toBeTruthy()

    const b = await makeShell({ storage })
    expect(b.history).toContain('export COLOR=green')
    expect((await run(b, 'printenv COLOR')).out).toBe('green\n')
    expect((await run(b, 'echo "[$SHELLONLY]"')).out).toBe('[]\n')
    expect((await run(b, 'hi')).out).toBe('hello\n')
    expect((await run(b, 'type la')).code).toBe(1)
    expect((await run(b, 'cat /tmp/keep.txt')).out).toBe('kept\n')
    expect(b.learn.lesson).toBe(0)
    expect(b.bootLog().map((l) => l.map((s) => s.text).join('')).join('\n')).toMatch(/1 of your files/)
  })

  it('ignores corrupt or foreign saved state', async () => {
    const sh = await makeShell({ storage: memoryStorage('{not json') })
    expect(sh.history).toEqual([])
    const sh2 = await makeShell({ storage: memoryStorage(JSON.stringify({ v: 1, files: { '/home/raj/resume.md': { t: 'f', c: 'hacked', m: 1 } } })) })
    expect(sh2.vfs.read(`${HOME}/resume.md`)).toMatch(/^# Raj Dholakia/)
  })

  it('reset wipes everything after confirming', async () => {
    const storage = memoryStorage()
    let cleared = 0
    const sh = await makeShell({ storage, clear: () => cleared++ })
    await run(sh, 'export COLOR=green; echo x > /tmp/x')
    const no = await run(sh, 'reset', { input: ['n'] })
    expect(no.out).toMatch(/Nothing changed/)
    const yes = await run(sh, 'reset', { input: ['y'] })
    expect(yes.code).toBe(0)
    expect(cleared).toBe(1)
    expect((await run(sh, 'printenv COLOR')).code).toBe(1)
    expect((await run(sh, 'ls /tmp')).out).toBe('')
    expect(sh.history).toEqual(['printenv COLOR', 'ls /tmp'])
  })

  it('reset repairs a broken PATH because it is a builtin', async () => {
    const sh = await makeShell()
    await run(sh, 'unset PATH')
    expect((await run(sh, 'ls')).code).toBe(127)
    await run(sh, 'reset -f')
    expect((await run(sh, 'ls')).code).toBe(0)
  })
})
