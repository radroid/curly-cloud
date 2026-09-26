import { describe, expect, it } from 'vitest'
import { explainLine } from './explain'
import { LESSONS } from './learn'
import { makeShell, run } from './test-helpers'
import type { Shell } from './shell'

const complete = (sh: Shell, line: string, cursor = line.length) => sh.complete(line, cursor)

describe('completion', () => {
  it('completes commands and aliases in command position', async () => {
    const sh = await makeShell()
    expect(complete(sh, 'whoa')).toMatchObject({ text: 'whoami ', options: [] })
    expect(complete(sh, 'ec')).toMatchObject({ text: 'echo ' })
    const multi = complete(sh, 'c')
    expect(multi.text).toBeNull()
    expect(multi.options).toEqual(expect.arrayContaining(['cat', 'cd', 'clear', 'contact', 'cowsay', 'cp']))
    expect(complete(sh, 'l').options).toEqual(expect.arrayContaining(['la', 'learn', 'll', 'ls']))
    expect(complete(sh, 'ls | gr')).toMatchObject({ text: 'grep ' })
    expect(complete(sh, 'X=1 pw')).toMatchObject({ text: 'pwd ' })
  })

  it('completes relative, absolute and ~ paths; directories get a slash', async () => {
    const sh = await makeShell()
    expect(complete(sh, 'cat ab')).toMatchObject({ start: 4, end: 6, text: 'about.txt ' })
    expect(complete(sh, 'cd exp')).toMatchObject({ text: 'experience/' })
    expect(complete(sh, 'cat experience/ed')).toMatchObject({ text: 'experience/eddy-solutions.md ' })
    expect(complete(sh, 'ls /us')).toMatchObject({ text: '/usr/' })
    expect(complete(sh, 'cat ~/con')).toMatchObject({ text: '~/contact.txt ' })
    expect(complete(sh, 'cat .p')).toMatchObject({ text: '.profile ' })
    // Case-sensitive, like bash: `re` matches resume.md but not README.md.
    expect(complete(sh, 'cat re')).toMatchObject({ text: 'resume.md ' })
    const common = complete(sh, 'cat e')
    expect(common).toMatchObject({ text: null, options: ['education.md', 'experience/'] })
    expect(complete(sh, 'cat sk')).toMatchObject({ text: 'skills/' })
    expect(complete(sh, 'cat skills/re')).toMatchObject({ text: 'skills/retrieval.txt ' })
    expect(complete(sh, 'echo hi > /tm')).toMatchObject({ text: '/tmp/' })
  })

  it('completes only directories after cd', async () => {
    const sh = await makeShell()
    expect(complete(sh, 'cd ')).toMatchObject({ options: ['builds/', 'community/', 'experience/', 'skills/'] })
    expect(complete(sh, 'cd b')).toMatchObject({ text: 'builds/' })
  })

  it('completes $VARIABLE names', async () => {
    const sh = await makeShell()
    expect(complete(sh, 'echo $HO')).toMatchObject({ text: null, options: ['$HOME', '$HOSTNAME'] })
    expect(complete(sh, 'echo $HOM')).toMatchObject({ text: '$HOME ' })
    expect(complete(sh, 'echo ${HOST')).toMatchObject({ text: '${HOSTNAME} ' })
    expect(complete(sh, 'echo $RAJ_').options).toEqual(['$RAJ_COMPANY', '$RAJ_EMAIL', '$RAJ_LOCATION', '$RAJ_MOTTO', '$RAJ_ROLE', '$RAJ_SITE'])
    expect(complete(sh, 'echo $RAJ_E')).toMatchObject({ text: '$RAJ_EMAIL ' })
  })

  it('completes man topics, open targets and learn subcommands', async () => {
    const sh = await makeShell()
    expect(complete(sh, 'man quo')).toMatchObject({ text: 'quoting ' })
    expect(complete(sh, 'man gr')).toMatchObject({ text: 'grep ' })
    expect(complete(sh, 'open mac').options).toEqual(['mac', 'macintosh'])
    expect(complete(sh, 'open git')).toMatchObject({ text: 'github ' })
    expect(complete(sh, 'open li')).toMatchObject({ text: 'linkedin ' })
    expect(complete(sh, 'learn ne')).toMatchObject({ text: 'next ' })
    expect(complete(sh, 'which fo')).toMatchObject({ text: 'fortune ' })
    expect(complete(sh, 'projects re')).toMatchObject({ text: 'regdocs ' })
  })

  it('returns nothing when nothing matches', async () => {
    const sh = await makeShell()
    expect(complete(sh, 'cat zzz')).toEqual({ start: 4, end: 7, text: null, options: [] })
  })
})

describe('explain', () => {
  it('annotates a command, options, arguments and a redirect', async () => {
    const sh = await makeShell()
    const ex = await explainLine(sh, 'grep -i mcp resume.md > /tmp/x')
    expect(ex.rows.map((r) => [r.token, r.kind])).toEqual([
      ['grep', 'command'],
      ['-i', 'option'],
      ['mcp', 'argument'],
      ['resume.md', 'argument'],
      ['> /tmp/x', 'redirect'],
    ])
    expect(ex.rows[0].text).toMatch(/print lines that match a pattern · \/bin\/grep/)
    expect(ex.rows[1].text).toMatch(/ignore case/)
    expect(ex.rows[2].label).toBe('pattern')
    expect(ex.rows[3].text).toMatch(/~\/resume\.md exists/)
    expect(ex.rows[4].text).toMatch(/goes to \/tmp\/x, replacing its contents/)
    expect(ex.expanded).toBe('grep -i mcp resume.md > /tmp/x')
    expect(ex.summary.join(' ')).toMatch(/grep prints the lines of resume\.md that match "mcp", ignoring case\. The output goes to \/tmp\/x instead of the screen\./)
  })

  it('explains pipes, globs, variables, quoting and operators with the expanded form', async () => {
    const sh = await makeShell()
    const ex = await explainLine(sh, `cat *.md | grep -i "$USER" && echo '$HOME' || echo \\$x; ls ~`)
    const byToken = Object.fromEntries(ex.rows.map((r) => [r.token, r]))
    expect(byToken['*.md'].text).toMatch(/glob: \*\.md matches 3 names: education\.md README\.md resume\.md/)
    expect(byToken['|'].text).toMatch(/output of cat becomes the input of grep/)
    expect(byToken['"$USER"'].text).toMatch(/\$USER expands to "guest" \(inside double quotes/)
    expect(byToken['&&'].text).toMatch(/only if the previous one succeeded/)
    expect(byToken["'$HOME'"].text).toMatch(/single quotes: taken literally/)
    expect(byToken['||'].text).toMatch(/only if the previous one failed/)
    expect(byToken['\\$x'].text).toMatch(/backslash/)
    expect(byToken[';'].text).toMatch(/whatever happened/)
    expect(byToken['~'].text).toMatch(/home directory, \/home\/raj/)
    expect(ex.expanded).toBe("cat education.md README.md resume.md | grep -i guest && echo '$HOME' || echo '$x'; ls /home/raj")
  })

  it('explains assignments, aliases, combined flags, $() and heredocs without running them', async () => {
    const sh = await makeShell()
    const ex = await explainLine(sh, 'X=1 ll $(rm -r /tmp) # note')
    expect(ex.rows[0]).toMatchObject({ kind: 'assignment' })
    expect(ex.rows[0].text).toMatch(/in the environment of this one command only/)
    expect(ex.rows.find((r) => r.kind === 'alias')?.text).toMatch(/shortcut for "ls -la"/)
    expect(ex.rows.find((r) => r.token === '-la')?.text).toMatch(/2 flags in one: -l long format.* · -a all/)
    expect(ex.rows.find((r) => r.token === '$(rm -r /tmp)')?.text).toMatch(/command substitution: runs `rm -r \/tmp`/)
    expect(ex.rows.at(-1)).toMatchObject({ kind: 'comment' })
    expect((await explainLine(sh, 'NAME=raj')).rows[0].text).toMatch(/not exported/)
    expect((await explainLine(sh, 'cat <<EOF')).rows[1].text).toMatch(/here-document/)
  })

  it('flags unknown commands and write permission problems', async () => {
    const sh = await makeShell()
    expect((await explainLine(sh, 'sl')).rows[0].text).toMatch(/command not found.*did you mean ls/)
    expect((await explainLine(sh, 'echo hi > resume.md')).rows.at(-1)?.text).toMatch(/permission denied/)
  })

  it('reports syntax errors instead of explaining', async () => {
    const sh = await makeShell()
    const ex = await explainLine(sh, "echo 'oops")
    expect(ex.error?.message).toMatch(/unterminated single quote/)
    const r = await run(sh, `explain "echo 'oops"`)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/syntax error: unterminated single quote/)
  })

  it('the explain command prints a table and never runs the line', async () => {
    const sh = await makeShell()
    const r = await run(sh, `explain 'rm -rf /tmp/x; echo hi > /tmp/made'`)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/expands to/)
    expect(r.out).toMatch(/in words/)
    expect(sh.vfs.stat('/tmp/made')).toBeNull()
    expect((await run(sh, 'explain')).code).toBe(2)
  })
})

describe('learn', () => {
  it('starts lesson 1 and validates what was typed, step by step', async () => {
    const sh = await makeShell()
    const start = await run(sh, 'learn')
    expect(start.out).toMatch(/Lesson 1\/7 · Finding your way/)
    expect(start.out).toMatch(/Step 1\/4 · Print where you are with pwd/)
    const wrong = await run(sh, 'ls')
    expect(wrong.out).toMatch(/learn: not quite\. Type pwd/)
    expect(sh.learn.step).toBe(0)
    const ok = await run(sh, 'pwd')
    expect(ok.out).toMatch(/✓ That is your working directory/)
    expect(ok.out).toMatch(/Step 2\/4/)
    await run(sh, 'ls')
    const cdWrong = await run(sh, 'cd experiance')
    expect(cdWrong.out).toMatch(/could not find that directory/)
    await run(sh, 'cd experience')
    expect(sh.learn.step).toBe(3)
    const done = await run(sh, 'cd ..')
    expect(done.out).toMatch(/★ Lesson 1 complete: Finding your way\. 1\/7 done\./)
    expect(done.out).toMatch(/learn next → Reading files/)
    expect(sh.learn).toMatchObject({ lesson: null, done: [0] })
  })

  it('does not nag about unrelated commands', async () => {
    const sh = await makeShell()
    await run(sh, 'learn 2')
    expect((await run(sh, 'whoami')).out).toBe('guest\n')
    expect((await run(sh, 'help')).out).not.toMatch(/not quite/)
  })

  it('lesson 2: reading files, including the hidden .profile', async () => {
    const sh = await makeShell()
    await run(sh, 'learn 2')
    for (const line of ['cat about.txt', 'head -n 5 resume.md', 'ls -a']) expect((await run(sh, line)).out).toMatch(/✓/)
    expect((await run(sh, 'cat .profile')).out).toMatch(/★ Lesson 2 complete/)
  })

  it('lesson 3: variables and export, with a hint for NAME = value', async () => {
    const sh = await makeShell()
    await run(sh, 'learn 3')
    expect((await run(sh, 'echo $USER')).out).toMatch(/✓/)
    expect((await run(sh, 'NAME = raj')).out).toMatch(/No spaces around =/)
    expect((await run(sh, 'FAV=pizza')).out).toMatch(/✓ FAV is now a shell variable/)
    expect((await run(sh, 'env | grep FAV')).out).toMatch(/✓ Nothing! FAV is a shell variable/)
    expect((await run(sh, 'export FAV')).out).toMatch(/✓ Now it is in the environment/)
    expect((await run(sh, 'env | grep FAV')).out).toMatch(/FAV=pizza[\s\S]*★ Lesson 3 complete/)
  })

  it('lessons 4 to 6: quoting, pipes and redirects, exit codes', async () => {
    const sh = await makeShell()
    await run(sh, 'learn 4')
    for (const line of ['echo "I am $USER"', "echo 'I am $USER'", 'echo "a    b"']) expect((await run(sh, line)).out).toMatch(/✓/)
    expect((await run(sh, 'echo \\$HOME')).out).toMatch(/★ Lesson 4 complete/)
    await run(sh, 'learn 5')
    expect((await run(sh, 'cat resume.md | grep -i mcp')).out).toMatch(/✓/)
    expect((await run(sh, 'grep -i mcp resume.md | wc -l')).out).toMatch(/✓/)
    expect((await run(sh, 'echo hello > hello.txt')).out).toMatch(/You can only write in \/tmp/)
    expect((await run(sh, 'echo hello > /tmp/hello.txt')).out).toMatch(/✓/)
    expect((await run(sh, 'echo again >> /tmp/hello.txt')).out).toMatch(/✓/)
    expect((await run(sh, 'cat /tmp/hello.txt')).out).toMatch(/hello\nagain\n[\s\S]*★ Lesson 5 complete/)
    await run(sh, 'learn 6')
    expect((await run(sh, 'false; echo $?')).out).toMatch(/1\n✓/)
    expect((await run(sh, 'cd builds && ls')).out).toMatch(/✓/)
    await run(sh, 'cd')
    expect((await run(sh, 'cat nope.txt || echo "no such file"')).out).toMatch(/★ Lesson 6 complete/)
  })

  it('lesson 7 accepts ask even when the clone is unavailable', async () => {
    const sh = await makeShell({
      streamAnswer: async function* () {
        yield { type: 'error', code: 'unavailable', message: 'The clone is unavailable right now.' } as const
      },
    })
    await run(sh, 'learn 7')
    expect((await run(sh, 'ask "what are you building now?"')).out).toMatch(/✓ The clone could not answer right now/)
    expect((await run(sh, "explain 'cat *.md | grep -i agent | wc -l'")).out).toMatch(/✓/)
    const last = await run(sh, 'mcp')
    expect(last.out).toMatch(/★ Lesson 7 complete/)
  })

  it('shows progress, skips with learn next, and finishes everything', async () => {
    const sh = await makeShell()
    await run(sh, 'learn 1')
    expect((await run(sh, 'learn')).out).toMatch(/Learn the shell · 0\/7 lessons done[\s\S]*▸ 1\. Finding your way {2}\(step 1\/4\)/)
    expect((await run(sh, 'learn next')).out).toMatch(/Skipped that step\.[\s\S]*Step 2\/4/)
    sh.learn.done = LESSONS.map((_, i) => i).filter((i) => i !== 6)
    await run(sh, 'learn stop')
    expect((await run(sh, 'learn next')).out).toMatch(/Lesson 7\/7/)
    for (let i = 0; i < 3; i++) await run(sh, 'learn next')
    expect(sh.learn.done).toHaveLength(7)
    expect((await run(sh, 'learn next')).out).toMatch(/finished every lesson/)
    await run(sh, 'learn reset')
    expect(sh.learn).toMatchObject({ lesson: null, done: [] })
    expect((await run(sh, 'learn 99')).code).toBe(2)
  })
})
