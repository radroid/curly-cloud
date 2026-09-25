import { describe, expect, it } from 'vitest'
import { RESUME } from '@/content/resume'
import { HOME } from './fs-content'
import { makeShell, run } from './test-helpers'

describe('file commands', () => {
  it('ls: short, -a, -l, -1, errors, and clickable names on screen', async () => {
    const sh = await makeShell()
    const short = await run(sh, 'ls')
    expect(short.out).toBe('about.txt  builds  contact.txt  education.md  experience  README.md  resume.md  skills\n')
    const dir = short.outSegs.find((s) => s.text === 'experience')
    expect(dir).toMatchObject({ style: 'accent', link: { kind: 'command', command: 'cd experience && ls' } })
    expect(short.outSegs.find((s) => s.text === 'about.txt')?.link).toEqual({ kind: 'command', command: 'cat about.txt' })
    expect((await run(sh, 'ls -a')).out).toMatch(/^\.  \.\.  \.profile  \.secrets  about\.txt/)
    expect((await run(sh, 'ls -A')).out).toMatch(/^\.profile  \.secrets/)
    const long = (await run(sh, 'ls -la')).out
    expect(long).toMatch(/^total \d+/)
    expect(long).toMatch(/-r-------- 1 raj {3}raj {4}\s*\d+ .* \.secrets/)
    expect(long).toMatch(/drwxr-xr-x 2 raj {3}raj {3}4096 .* experience/)
    expect((await run(sh, 'ls -lh resume.md')).out).toMatch(/\d\.\dK .* resume\.md/)
    expect((await run(sh, 'ls -1 builds')).out).toBe('jobsearch.md\nregdocs.md\n')
    expect((await run(sh, 'ls builds skills')).out).toMatch(/^builds:\n.*\n\nskills:\n/)
    const missing = await run(sh, 'ls nope')
    expect(missing.code).toBe(2)
    expect(missing.err).toMatch(/cannot access 'nope': No such file or directory/)
    expect((await run(sh, 'ls -z')).err).toMatch(/invalid option -- 'z'/)
  })

  it('cat: files, -n, stdin, directories and missing files', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'cat about.txt')).out).toMatch(/^Raj Dholakia\nLead Software Developer · Toronto, ON\n/)
    expect((await run(sh, 'cat -n education.md')).out).toMatch(/^ {5}1 {2}# Education\n/)
    expect((await run(sh, 'echo piped | cat')).out).toBe('piped\n')
    expect((await run(sh, 'cat builds')).err).toMatch(/cat: builds: Is a directory/)
    expect((await run(sh, 'cat')).err).toMatch(/no input/)
    const contact = await run(sh, 'cat contact.txt')
    expect(contact.outSegs.some((s) => s.link?.kind === 'url' && s.link.href === `mailto:${RESUME.email}`)).toBe(true)
    expect(contact.out).not.toMatch(/phone|\+1|\(\d{3}\)/i)
  })

  it('tree: draws the home directory and counts', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'tree')
    expect(r.out).toMatch(/^\.\n├── about\.txt\n├── builds\n│   ├── jobsearch\.md\n│   └── regdocs\.md/)
    expect(r.out).toMatch(/3 directories, \d+ files\n$/)
    expect((await run(sh, 'tree -L 1 /')).out).toMatch(/^\/\n├── bin\n/)
    expect((await run(sh, 'tree -a -d')).out).toMatch(/3 directories\n$/)
  })

  it('find: -name, -iname, -type, -maxdepth', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'find builds -name "*.md"')).out).toBe('builds/jobsearch.md\nbuilds/regdocs.md\n')
    expect((await run(sh, 'find . -maxdepth 1 -type d')).out).toBe('.\n./builds\n./experience\n./skills\n')
    expect((await run(sh, 'find ~ -iname "*EDDY*"')).out).toBe(`${HOME}/experience/eddy-solutions.md\n`)
    expect((await run(sh, 'find . -bogus')).err).toMatch(/unknown predicate/)
  })

  it('touch, mkdir, cp, mv and rm work in /tmp', async () => {
    const sh = await makeShell()
    await run(sh, 'cd /tmp && touch a && mkdir -p d/e && cp ~/about.txt d/ && cp -r ~/builds b && mv a z')
    expect((await run(sh, 'find . | sort')).out).toBe('.\n./b\n./b/jobsearch.md\n./b/regdocs.md\n./d\n./d/about.txt\n./d/e\n./z\n')
    expect((await run(sh, 'cp ~/builds /tmp/x')).err).toMatch(/-r not specified; omitting directory/)
    expect((await run(sh, 'mkdir d')).err).toMatch(/cannot create directory 'd': File exists/)
    expect((await run(sh, 'rm nothere')).err).toMatch(/cannot remove 'nothere': No such file/)
    expect((await run(sh, 'rm -f nothere')).code).toBe(0)
    await run(sh, 'rm -r b d z')
    expect((await run(sh, 'ls -A /tmp')).out).toBe('')
  })

  it('rm -rf / is refused with a failsafe', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'rm -rf /')
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/dangerous to operate recursively on '\/'/)
  })

  it('rm -r on Raj’s directory removes nothing', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'rm -r ~/builds')
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/Permission denied/)
    expect((await run(sh, 'ls -1 ~/builds')).out).toBe('jobsearch.md\nregdocs.md\n')
  })
})

describe('text commands', () => {
  it('echo: -n, -e, spacing', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo -n hi')).out).toBe('hi')
    expect((await run(sh, 'echo -e "a\\tb\\nc"')).out).toBe('a\tb\nc\n')
    expect((await run(sh, 'echo')).out).toBe('\n')
  })

  it('head and tail: -n, -N, +N and multiple files', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'seq 20 | head')).out).toBe('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n')
    expect((await run(sh, 'seq 20 | head -n 3')).out).toBe('1\n2\n3\n')
    expect((await run(sh, 'seq 20 | head -2')).out).toBe('1\n2\n')
    expect((await run(sh, 'seq 20 | tail -n 2')).out).toBe('19\n20\n')
    expect((await run(sh, 'seq 5 | tail -n +4')).out).toBe('4\n5\n')
    expect((await run(sh, 'head -n 1 about.txt education.md')).out).toBe('==> about.txt <==\nRaj Dholakia\n\n==> education.md <==\n# Education\n')
    expect((await run(sh, 'head -n x about.txt')).err).toMatch(/invalid number/)
  })

  it('wc: counts, flags and totals', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'echo "one two three" | wc -w')).out).toBe('3\n')
    expect((await run(sh, 'echo "one two three" | wc -l')).out).toBe('1\n')
    expect((await run(sh, 'echo "héllo" | wc -c')).out).toBe('7\n')
    expect((await run(sh, 'echo "héllo" | wc -m')).out).toBe('6\n')
    expect((await run(sh, 'echo "a b" | wc')).out).toBe('      1       2       4\n')
    expect((await run(sh, 'wc -l education.md builds/*.md')).out).toMatch(/\d+ education\.md\n.*\n.*\n\s*\d+ total\n$/)
  })

  it('grep: -i -n -v -c -l -r -o -w -q, stdin and exit codes', async () => {
    const sh = await makeShell()
    const plain = await run(sh, 'grep MCP resume.md')
    expect(plain.code).toBe(0)
    expect(plain.out.split('\n').every((l) => !l || l.includes('MCP'))).toBe(true)
    expect(plain.outSegs.some((s) => s.text === 'MCP' && s.style === 'highlight')).toBe(true)
    const ci = (await run(sh, 'grep -ic mcp resume.md')).out
    expect(Number(ci)).toBeGreaterThan(Number((await run(sh, 'grep -c mcp resume.md')).out))
    expect((await run(sh, 'grep -n Education education.md')).out).toBe('1:# Education\n')
    expect((await run(sh, 'seq 5 | grep -v 3 | wc -l')).out).toBe('4\n')
    expect((await run(sh, 'grep -l Qdrant builds/*.md')).out).toBe('builds/jobsearch.md\n')
    expect((await run(sh, 'grep -ri qdrant ~/builds | wc -l')).out).not.toBe('0\n')
    expect((await run(sh, 'grep -rl Qdrant')).out).toMatch(/builds\/jobsearch\.md/)
    expect((await run(sh, 'echo "rag ragged" | grep -ow rag')).out).toBe('rag\n')
    expect((await run(sh, 'grep -qi kafka resume.md && echo yes || echo no')).out).toBe('yes\n')
    expect((await run(sh, 'grep zzzz resume.md')).code).toBe(1)
    expect((await run(sh, 'grep x builds')).err).toMatch(/Is a directory/)
    expect((await run(sh, 'grep x nope.txt')).code).toBe(2)
    expect((await run(sh, 'grep "(" resume.md')).err).toMatch(/invalid regular expression/)
    expect((await run(sh, 'grep -F "(" resume.md')).code).toBe(0)
    expect((await run(sh, 'grep "Eddy\\|Duit" experience/*.md | wc -l')).out).not.toBe('0\n')
    expect((await run(sh, 'grep')).err).toMatch(/missing pattern/)
  })

  it('sort and uniq', async () => {
    const sh = await makeShell()
    await run(sh, 'echo b > /tmp/s; echo a >> /tmp/s; echo b >> /tmp/s; echo 10 >> /tmp/s; echo 9 >> /tmp/s')
    expect((await run(sh, 'sort /tmp/s')).out).toBe('10\n9\na\nb\nb\n')
    expect((await run(sh, 'sort -n /tmp/s')).out).toBe('a\nb\nb\n9\n10\n')
    expect((await run(sh, 'sort -r /tmp/s | head -1')).out).toBe('b\n')
    expect((await run(sh, 'sort -u /tmp/s')).out).toBe('10\n9\na\nb\n')
    expect((await run(sh, 'sort /tmp/s | uniq -c')).out).toBe('      1 10\n      1 9\n      1 a\n      2 b\n')
    expect((await run(sh, 'sort /tmp/s | uniq -d')).out).toBe('b\n')
    expect((await run(sh, 'uniq /tmp/s')).out).toBe('b\na\nb\n10\n9\n')
  })

  it('seq and tee', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'seq 3')).out).toBe('1\n2\n3\n')
    expect((await run(sh, 'seq 2 2 6')).out).toBe('2\n4\n6\n')
    expect((await run(sh, 'seq 3 | tee /tmp/t | wc -l')).out).toBe('3\n')
    expect(sh.vfs.read('/tmp/t')).toBe('1\n2\n3\n')
  })
})

describe('shell commands', () => {
  it('env, printenv and set', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'printenv HOME USER')).out).toBe(`${HOME}\nguest\n`)
    expect((await run(sh, 'env X=1 printenv X')).out).toBe('1\n')
    const set = await run(sh, 'set')
    expect(set.outSegs.find((s) => s.text === 'RAJ_MOTTO')?.style).toBe('highlight')
    expect(set.outSegs.find((s) => s.text === 'RAJ_ROLE')?.style).toBe('accent')
  })

  it('alias and unalias', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'alias')).out).toMatch(/alias ll='ls -la'/)
    await run(sh, "alias greet='echo hi there'")
    expect((await run(sh, 'greet you')).out).toBe('hi there you\n')
    expect((await run(sh, 'alias greet')).out).toBe("alias greet='echo hi there'\n")
    await run(sh, 'unalias greet')
    expect((await run(sh, 'greet')).code).toBe(127)
    expect((await run(sh, 'unalias nope')).err).toMatch(/nope: not found/)
    expect((await run(sh, '..; pwd')).out).toBe('/home\n')
  })

  it('history lists numbered entries and -c clears', async () => {
    const sh = await makeShell()
    await run(sh, 'echo a')
    await run(sh, 'echo b')
    expect((await run(sh, 'history')).out).toBe('    1  echo a\n    2  echo b\n    3  history\n')
    expect((await run(sh, 'history 1')).out).toBe('    4  history 1\n')
    await run(sh, 'history -c')
    expect((await run(sh, 'history')).out).toBe('    6  history\n')
  })

  it('clear calls the host', async () => {
    let cleared = false
    const sh = await makeShell({ clear: () => (cleared = true) })
    await run(sh, 'clear')
    expect(cleared).toBe(true)
  })

  it('whoami, hostname, uname, date', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'whoami')).out).toBe('guest\n')
    expect((await run(sh, 'hostname')).out).toBe('curlycloud\n')
    expect((await run(sh, 'uname')).out).toBe('CurlyOS\n')
    expect((await run(sh, 'uname -a')).out).toMatch(/^CurlyOS curlycloud /)
    expect((await run(sh, 'date -u +%Y-%m-%dT%H:%M')).out).toBe('2026-09-25T12:00\n')
    expect((await run(sh, 'date -u')).out).toBe('Fri Sep 25 12:00:00 UTC 2026\n')
  })

  it('which and type', async () => {
    const sh = await makeShell()
    expect((await run(sh, 'which ls ask')).out).toBe('/bin/ls\n/usr/local/bin/ask\n')
    expect((await run(sh, 'which cd')).out).toBe('cd: shell built-in command\n')
    expect((await run(sh, 'which nope')).code).toBe(1)
    expect((await run(sh, 'type ll cd grep')).out).toBe("ll is aliased to `ls -la'\ncd is a shell builtin\ngrep is /bin/grep\n")
    expect((await run(sh, 'type nope')).err).toMatch(/nope: not found/)
  })

  it('true, false and exit', async () => {
    const navigated: string[] = []
    const sh = await makeShell({ navigate: (href) => navigated.push(href) })
    expect((await run(sh, 'true')).code).toBe(0)
    expect((await run(sh, 'false')).code).toBe(1)
    expect((await run(sh, '(exit 4)')).code).toBe(4)
    expect(navigated).toEqual([])
    const r = await run(sh, 'exit')
    expect(r.out).toMatch(/logout/)
    expect(navigated).toEqual(['/'])
  })

  it('source runs a file in the current shell', async () => {
    const sh = await makeShell()
    await run(sh, `echo "export FROM_SCRIPT=yes" > /tmp/rc; echo "alias hey='echo hey'" >> /tmp/rc; echo 'cd /tmp' >> /tmp/rc`)
    await run(sh, 'source /tmp/rc')
    expect((await run(sh, 'printenv FROM_SCRIPT; hey; pwd')).out).toBe('yes\nhey\n/tmp\n')
    await run(sh, '. /tmp/rc')
    expect((await run(sh, 'source')).err).toMatch(/filename argument required/)
    expect((await run(sh, 'source nope')).err).toMatch(/nope/)
  })

  it('help lists groups and man renders sections with clickable examples', async () => {
    const sh = await makeShell()
    const help = await run(sh, 'help')
    for (const g of ['Files and directories', 'Reading and filtering text', 'Variables and the shell', 'Raj and his AI clone', 'Learning', 'Fun']) {
      expect(help.out).toContain(g)
    }
    expect(help.out).not.toMatch(/^\s+builds\s/m)
    expect((await run(sh, 'help grep')).out).toMatch(/grep — print lines that match a pattern\n\s+grep \[-invclrwoEFq\]/)
    const man = await run(sh, 'man ls')
    for (const s of ['NAME', 'SYNOPSIS', 'DESCRIPTION', 'OPTIONS', 'EXAMPLES', 'SEE ALSO']) expect(man.out).toMatch(new RegExp(`^${s}$`, 'm'))
    expect(man.outSegs.some((s) => s.link?.kind === 'command' && s.link.command === 'ls -la')).toBe(true)
    expect((await run(sh, 'man quoting')).out).toMatch(/single quotes, double quotes/)
    expect((await run(sh, 'man rsh')).out).toMatch(/POSIX-style shell/)
    expect((await run(sh, 'man zzz')).err).toMatch(/no manual entry for zzz/)
    // Every visible command has a real manual page.
    for (const def of sh.commandDefs().filter((d) => !d.hidden)) {
      expect(def.man.synopsis.length, def.name).toBeGreaterThan(0)
      expect(def.man.description.join(' ').length, def.name).toBeGreaterThan(20)
    }
  })
})

describe("Raj's commands", () => {
  it('resume, resume --json and resume --md', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'resume')
    expect(r.out).toMatch(/^Raj Dholakia {2}· {2}Lead Software Developer/)
    for (const role of RESUME.experience) expect(r.out).toContain(role.company)
    const json = JSON.parse((await run(sh, 'resume --json')).out)
    expect(json.name).toBe('Raj Dholakia')
    expect((await run(sh, 'resume --md | head -1')).out).toBe('# Raj Dholakia\n')
  })

  it('contact has email and links, and never a phone number', async () => {
    const sh = await makeShell()
    const r = await run(sh, 'contact')
    expect(r.out).toContain(RESUME.email)
    for (const l of RESUME.links) expect(r.out).toContain(l.href.replace(/^https?:\/\//, ''))
    expect(r.out).not.toMatch(/phone|tel:|\+\d/i)
    for (const path of sh.vfs.walk('/')) {
      const node = sh.vfs.stat(path)
      if (node?.type === 'file' && node.content) expect(node.content, path).not.toMatch(/\bphone\b|\btel:|\(\d{3}\)\s?\d{3}-\d{4}/i)
    }
  })

  it('projects, builds and skills', async () => {
    const sh = await makeShell()
    const p = await run(sh, 'projects')
    for (const b of RESUME.builds) expect(p.out).toContain(b.title)
    expect((await run(sh, 'builds regdocs')).out).toMatch(/^# Grounded regulatory assistant/)
    expect((await run(sh, 'projects nope')).code).toBe(1)
    expect((await run(sh, 'skills')).out).toContain('Retrieval')
    expect((await run(sh, 'skills --grep aws')).out).toMatch(/AWS \(EC2/)
    expect((await run(sh, 'skills retrieval')).out).not.toContain('Python')
    expect((await run(sh, 'skills --grep cobol')).code).toBe(1)
  })

  it('open navigates to the Mac, the website and links', async () => {
    const calls: [string, boolean][] = []
    const sh = await makeShell({ navigate: (href, o) => calls.push([href, o.external]) })
    await run(sh, 'open macintosh')
    await run(sh, 'open mac')
    await run(sh, 'open website')
    await run(sh, 'open github')
    await run(sh, 'open linkedin')
    await run(sh, 'open email')
    expect(calls).toEqual([
      ['/mac', false],
      ['/mac', false],
      ['/', false],
      ['https://github.com/radroid', true],
      ['https://linkedin.com/in/raj-dholakia', true],
      [`mailto:${RESUME.email}`, true],
    ])
    expect((await run(sh, 'open about.txt')).out).toMatch(/^Raj Dholakia/)
    expect((await run(sh, 'open narnia')).code).toBe(1)
    expect((await run(sh, 'open terminal')).out).toMatch(/already in it/)
  })

  it('website and gui go home', async () => {
    const calls: string[] = []
    const sh = await makeShell({ navigate: (href) => calls.push(href) })
    await run(sh, 'website')
    await run(sh, 'gui')
    expect(calls).toEqual(['/', '/'])
  })

  it('neofetch, fortune, cowsay, matrix and sudo', async () => {
    const sh = await makeShell({ reducedMotion: () => true })
    expect((await run(sh, 'neofetch')).out).toMatch(/guest@curlycloud[\s\S]*Role: Lead Software Developer @ Eddy Solutions/)
    expect((await run(sh, 'fortune')).out.trim().length).toBeGreaterThan(10)
    const cow = (await run(sh, 'echo moo | cowsay')).out
    expect(cow).toMatch(/< moo >/)
    expect(cow).toMatch(/\(oo\)/)
    const m = await run(sh, 'matrix')
    expect(m.out).toMatch(/still frame/)
    const sudo = await run(sh, 'sudo cat .secrets')
    expect(sudo.code).toBe(1)
    expect(sudo.err).toMatch(/not in the sudoers file/)
    expect((await run(sh, 'sudo make me a sandwich')).out).toBe('Okay.\n')
  })

  it('matrix animates until done or Ctrl-C', async () => {
    const ac = new AbortController()
    let ticks = 0
    const sh = await makeShell({
      sleep: async () => {
        if (++ticks === 5) ac.abort()
      },
    })
    const r = await run(sh, 'matrix', { signal: ac.signal })
    expect(r.code).toBe(130)
    expect(r.out.split('\n').length).toBeLessThan(10)
  })

  it('mcp explains the endpoint for this origin', async () => {
    const sh = await makeShell({ origin: 'https://example.dev' })
    const r = await run(sh, 'mcp')
    expect(r.out).toContain('https://example.dev/mcp')
    expect(r.out).toContain('https://example.dev/llms.txt')
    expect(r.out).toMatch(/claude mcp add --transport http raj https:\/\/example\.dev\/mcp/)
    expect(r.out).toMatch(/ask_raj, assess_fit, get_profile, get_resume, list_topics/)
  })
})
