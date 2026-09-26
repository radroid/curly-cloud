import { describe, expect, it } from 'vitest'
import { lex, ShellSyntaxError, type Token, type Word } from './lexer'
import { asAssignment, parse, simpleCommands } from './parser'

const words = (input: string): Word[] =>
  lex(input)
    .filter((t): t is Extract<Token, { kind: 'word' }> => t.kind === 'word')
    .map((t) => t.word)

const ops = (input: string): string[] =>
  lex(input)
    .filter((t) => t.kind === 'op')
    .map((t) => (t.kind === 'op' ? `${t.fd ?? ''}${t.op}` : ''))

describe('lexer', () => {
  it('splits words on whitespace', () => {
    expect(words('ls   -la  ~').map((w) => w.raw)).toEqual(['ls', '-la', '~'])
  })

  it('keeps single quotes literal', () => {
    const [, w] = words(`echo 'a $HOME "b"'`)
    expect(w.parts).toEqual([{ type: 'text', text: 'a $HOME "b"', quote: 'single' }])
  })

  it('expands inside double quotes and honours escapes', () => {
    const [, w] = words(`echo "hi $USER \\$x \\"q\\" \\n"`)
    expect(w.parts.map((p) => p.type)).toEqual(['text', 'param', 'text'])
    expect(w.parts[1]).toMatchObject({ type: 'param', name: 'USER', quoted: true })
    expect(w.parts[2]).toMatchObject({ type: 'text', text: ' $x "q" \\n', quote: 'double' })
  })

  it('treats a backslash as an escape outside quotes', () => {
    const [, w] = words('echo \\$HOME a\\ b')
    expect(w.parts).toEqual([
      { type: 'text', text: '$', quote: 'escape' },
      { type: 'text', text: 'HOME', quote: 'none' },
    ])
    expect(words('echo a\\ b')[1].parts.map((p) => (p.type === 'text' ? p.text : '')).join('')).toBe('a b')
  })

  it('parses $?, ${VAR}, ${VAR:-x}, ${#VAR}, $(...), $((...)) and backquotes', () => {
    const w = words('echo $? ${HOME} ${X:-def} ${#HOME} $(ls -a | wc -l) $((1 + (2*3))) `pwd`').slice(1)
    expect(w[0].parts[0]).toMatchObject({ type: 'param', name: '?' })
    expect(w[1].parts[0]).toMatchObject({ type: 'param', name: 'HOME', braced: true, op: '' })
    expect(w[2].parts[0]).toMatchObject({ type: 'param', name: 'X', op: ':-', arg: 'def' })
    expect(w[3].parts[0]).toMatchObject({ type: 'param', name: 'HOME', op: 'length' })
    expect(w[4].parts[0]).toMatchObject({ type: 'subst', source: 'ls -a | wc -l' })
    expect(w[5].parts[0]).toMatchObject({ type: 'arith', expr: '1 + (2*3)' })
    expect(w[6].parts[0]).toMatchObject({ type: 'subst', source: 'pwd' })
  })

  it('handles nested command substitution with quotes and parens', () => {
    const [, w] = words(`echo $(echo "(a)" $(pwd))`)
    expect(w.parts[0]).toMatchObject({ type: 'subst', source: 'echo "(a)" $(pwd)' })
  })

  it('recognises tilde only at the start of an unquoted word', () => {
    expect(words('cd ~/x')[1].parts[0]).toMatchObject({ type: 'tilde', user: '' })
    expect(words('cd ~raj')[1].parts[0]).toMatchObject({ type: 'tilde', user: 'raj' })
    expect(words('echo a~ "~"')[1].parts[0]).toMatchObject({ type: 'text', text: 'a~' })
    expect(words('echo "~"')[1].parts[0]).toMatchObject({ type: 'text', quote: 'double' })
  })

  it('lexes operators, including fd redirects', () => {
    expect(ops('a | b || c && d ; e & f')).toEqual(['|', '||', '&&', ';', '&'])
    expect(ops('cat < in > out >> log 2> err 2>&1 <<EOF')).toEqual(['<', '>', '>>', '2>', '2>&', '<<'])
    // Only a lone digit touching the operator is a file descriptor.
    expect(words('echo a2>x').map((w) => w.raw)).toEqual(['echo', 'a2', 'x'])
  })

  it('treats # as a comment only at the start of a word', () => {
    const tokens = lex('echo a#b # the rest')
    expect(tokens.filter((t) => t.kind === 'word').length).toBe(2)
    expect(tokens.at(-1)).toMatchObject({ kind: 'comment', text: '# the rest' })
  })

  it('keeps empty quoted strings as words', () => {
    expect(words(`echo '' ""`).length).toBe(3)
  })

  it('reports unterminated quotes and substitutions clearly', () => {
    expect(() => lex(`echo 'oops`)).toThrow(/unterminated single quote/)
    expect(() => lex('echo "oops')).toThrow(/unterminated double quote/)
    expect(() => lex('echo $(pwd')).toThrow(/unterminated command substitution/)
    expect(() => lex('echo ${HOME')).toThrow(/unterminated \$\{/)
    expect(() => lex('echo ${a b}')).toThrow(/bad substitution/)
    try {
      lex(`echo 'x`)
    } catch (e) {
      expect(e).toBeInstanceOf(ShellSyntaxError)
      expect((e as ShellSyntaxError).hint).toMatch(/closing '/)
    }
  })
})

describe('parser', () => {
  it('builds lists, and-or chains and pipelines', () => {
    const { list } = parse('a | b && c || d; e')
    expect(list.items).toHaveLength(2)
    const ao = list.items[0].andOr
    expect(ao.first.commands).toHaveLength(2)
    expect(ao.rest.map((r) => r.op)).toEqual(['&&', '||'])
    expect(list.items[0].sep).toBe(';')
  })

  it('separates prefix assignments from the command', () => {
    const [cmd] = simpleCommands(parse('A=1 B="two words" env X=3').list)
    expect(cmd.assigns.map((a) => a.name)).toEqual(['A', 'B'])
    expect(cmd.words.map((w) => w.raw)).toEqual(['env', 'X=3'])
    expect(asAssignment(words('"A"=1')[0])).toBeNull()
  })

  it('parses assignment-only commands', () => {
    const [cmd] = simpleCommands(parse('NAME=value').list)
    expect(cmd.words).toHaveLength(0)
    expect(cmd.assigns[0]).toMatchObject({ name: 'NAME' })
    expect(cmd.assigns[0].value.parts[0]).toMatchObject({ text: 'value' })
  })

  it('attaches redirects with default file descriptors', () => {
    const [cmd] = simpleCommands(parse('sort < in > out 2>> err').list)
    expect(cmd.redirects.map((r) => [r.op, r.fd, r.target.raw])).toEqual([
      ['<', 0, 'in'],
      ['>', 1, 'out'],
      ['>>', 2, 'err'],
    ])
  })

  it('collects heredocs with quoted and unquoted delimiters', () => {
    expect(parse('cat <<EOF').heredocs[0].heredoc).toEqual({ delimiter: 'EOF', quoted: false, body: null })
    expect(parse(`cat <<'END'`).heredocs[0].heredoc).toMatchObject({ delimiter: 'END', quoted: true })
  })

  it('parses subshells and negation', () => {
    const { list } = parse('! (cd /tmp && ls) > out')
    const p = list.items[0].andOr.first
    expect(p.negate).toBe(true)
    expect(p.commands[0]).toMatchObject({ type: 'subshell' })
    expect(p.commands[0].redirects).toHaveLength(1)
  })

  it('expands aliases in command position only, without looping', () => {
    const aliases = new Map([
      ['ll', 'ls -la'],
      ['ls', 'ls -F'],
    ])
    const [a, b] = simpleCommands(parse('ll docs; echo ll', { aliases }).list)
    expect(a.words.map((w) => w.raw)).toEqual(['ls', '-F', '-la', 'docs'])
    expect(a.alias).toEqual({ name: 'll', value: 'ls -la' })
    expect(b.words.map((w) => w.raw)).toEqual(['echo', 'll'])
  })

  it('gives clear syntax errors', () => {
    expect(() => parse('| ls')).toThrow(/near unexpected token '\|'/)
    expect(() => parse('ls |')).toThrow(/unexpected end of line after '\|'/)
    expect(() => parse('ls &&')).toThrow(/after '&&'/)
    expect(() => parse('echo >')).toThrow(/needs a file name/)
    expect(() => parse('(ls')).toThrow(/missing \)/)
    expect(() => parse('ls )')).toThrow(/unexpected token '\)'/)
    expect(() => parse('ls ;; ls')).toThrow(/unexpected token ';'/)
  })

  it('returns an empty list for blank lines and comments', () => {
    expect(parse('   ').list.items).toHaveLength(0)
    expect(parse('# only a comment').comment).toBe('# only a comment')
  })
})
