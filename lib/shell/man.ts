/** Manual pages for concepts (man rsh, man quoting…), alongside the per-command pages. */
import type { ManPage } from './command'

export interface TopicPage extends ManPage {
  name: string
  summary: string
}

export const TOPIC_PAGES: TopicPage[] = [
  {
    name: 'rsh',
    summary: 'the shell you are using',
    synopsis: ['COMMAND [ARGS...] [> FILE] [| COMMAND ...] [&& ...] [|| ...] [; ...]'],
    description: [
      'rsh is a small POSIX-style shell that runs in your browser. It reads a line, splits it into words, expands variables, globs and command substitutions, then runs the commands, wiring up pipes and redirects.',
      'The order a line is processed in: history (!!, !N) → aliases → words and quotes → ~ and $VAR and $(cmd) and $((math)) → splitting on spaces (unquoted results only) → globs (*, ?) → quote removal → run.',
      'Operators: | pipe · && and · || or · ; then · > write · >> append · < read · 2> errors · 2>&1 errors to output · <<WORD heredoc · ( … ) subshell · # comment.',
      'Everything you type is saved in this browser: history, exported variables, aliases, your files in /tmp and learn progress. reset wipes it.',
    ],
    examples: [
      ['explain \'cat *.md | grep -i agent | wc -l\'', 'see how a line is taken apart'],
      ['man quoting', 'the difference between "…" and \'…\''],
      ['learn', 'the tutorial'],
    ],
    seeAlso: ['quoting', 'variables', 'pipes', 'redirects', 'globs', 'permissions', 'exit-codes'],
  },
  {
    name: 'quoting',
    summary: 'single quotes, double quotes and backslashes',
    synopsis: ["'literal'", '"expands $VARS, keeps spaces"', '\\c'],
    description: [
      'Without quotes, the shell splits on spaces and expands $variables, ~, *globs and $(commands).',
      "Single quotes ('…') turn all of that off: what you type is what the command gets.",
      'Double quotes ("…") keep spaces and stop glob and field splitting, but $variables, $(commands) and $((math)) still expand.',
      'A backslash (\\) makes the next single character literal: \\$HOME, \\*, \\ (a space).',
    ],
    examples: [
      ['echo "I am $USER"', 'I am guest'],
      ["echo 'I am $USER'", 'I am $USER'],
      ['echo a    b', 'a b (split, rejoined with one space)'],
      ['echo "a    b"', 'a    b'],
      ['X="two words"; ls $X', 'ls gets two arguments: quote it as "$X"'],
    ],
    seeAlso: ['variables', 'globs', 'rsh'],
  },
  {
    name: 'variables',
    summary: 'shell variables versus environment variables',
    synopsis: ['NAME=value', 'export NAME[=value]', '$NAME  ${NAME}  ${NAME:-default}  ${#NAME}'],
    description: [
      'NAME=value (no spaces around =) sets a shell variable. Only this shell sees it.',
      'export NAME puts it in the environment, which is copied into every program the shell starts. env and printenv show the environment; set shows everything.',
      'NAME=value command sets a variable for that one command only. Note that the shell expands $NAME on the line before running it, so NAME=x echo $NAME prints the old value.',
      'Special variables: $? last exit code · $$ process id · $0 shell name · $RANDOM a random number · $HOME, $PWD, $OLDPWD, $PATH, $PS1 (your prompt: \\u user, \\h host, \\w directory, \\W its last part, \\$ prompt sign).',
    ],
    examples: [
      ['COLOR=green; echo $COLOR', 'a shell variable'],
      ['env | grep COLOR', 'not in the environment'],
      ['export COLOR', 'now it is'],
      ["PS1='\\W > '", 'change your prompt'],
      ['echo ${EDITOR:-vi}', 'a default when unset'],
    ],
    seeAlso: ['export', 'env', 'set', 'unset', 'quoting'],
  },
  {
    name: 'pipes',
    summary: 'connecting commands with |',
    synopsis: ['COMMAND | COMMAND | ...'],
    description: [
      'A pipe connects the output (stdout) of the command on its left to the input (stdin) of the command on its right. Error messages (stderr) still go to the screen unless you add 2>&1.',
      'Each command in a pipeline runs in its own subshell, so cd or a variable set inside one stage does not survive it.',
      'The exit code of a pipeline is the exit code of its last command. ! in front flips it.',
    ],
    examples: [
      ['cat resume.md | grep -i rag', 'filter'],
      ['ls ~/experience | wc -l', 'count'],
      ['cat skills/*.txt | sort | uniq -c | sort -rn | head -5', 'the classic'],
    ],
    seeAlso: ['redirects', 'grep', 'wc', 'sort', 'tee'],
  },
  {
    name: 'redirects',
    summary: 'sending output to files and reading input from them',
    synopsis: ['> FILE', '>> FILE', '< FILE', '2> FILE', '2>&1', '<<WORD'],
    description: [
      '> FILE sends output to FILE, replacing it. >> FILE appends. < FILE reads input from FILE. 2> FILE sends error messages to FILE; 2>/dev/null throws them away. 2>&1 sends errors wherever output is going.',
      '<<WORD starts a here-document: the lines you type next, up to a line containing only WORD, become the input.',
      "You can only write where you have permission: /tmp is yours; Raj's directories are read-only.",
    ],
    examples: [
      ['echo hello > /tmp/hi.txt', 'write'],
      ['date >> /tmp/hi.txt', 'append'],
      ['sort < /tmp/hi.txt', 'read'],
      ['cat nope.txt 2>/dev/null || echo missing', 'hide the error'],
      ['cat <<EOF > /tmp/note.txt', 'write several lines, then EOF'],
    ],
    seeAlso: ['pipes', 'permissions', 'tee'],
  },
  {
    name: 'globs',
    summary: 'wildcards: *, ? and [abc]',
    synopsis: ['*  ?  [abc]  [!abc]'],
    description: [
      'Before a command runs, the shell replaces an unquoted word containing * ? or [ with the matching file names, sorted. * matches any run of characters, ? exactly one, [abc] one of those characters.',
      'Names starting with a dot are only matched if the pattern starts with a dot. If nothing matches, the pattern is passed through unchanged. Quote it to stop expansion, as with find -name "*.md".',
    ],
    examples: [
      ['echo *.md', 'see what a glob expands to'],
      ['cat experience/*.md | wc -l', 'every role'],
      ['ls skills/[ce]*', 'names starting with c or e'],
    ],
    seeAlso: ['quoting', 'find'],
  },
  {
    name: 'permissions',
    summary: 'who may read, write and run files',
    synopsis: ['-rw-r--r--  raj  raj  resume.md'],
    description: [
      'ls -l shows permissions as ten characters: the type (d for directory, - for file) then three groups of rwx for the owner, the group and everyone else. r is read, w is write, x is execute (for directories: enter).',
      "Raj's files are owned by raj; you are guest, so the last group applies to you: read, not write. That is why rm resume.md fails. /tmp is drwxrwxrwt: anyone can create files there, and the t (sticky bit) means you can only delete your own.",
      '.secrets is -r--------: only raj can read it. Not even sudo helps a guest.',
    ],
    examples: [
      ['ls -la', 'see the permission column'],
      ['rm resume.md', 'Permission denied'],
      ['ls -ld /tmp', 'the sticky bit'],
      ['whoami', 'who you are'],
    ],
    seeAlso: ['ls', 'sudo', 'redirects'],
  },
  {
    name: 'exit-codes',
    summary: 'success, failure, $?, && and ||',
    synopsis: ['COMMAND; echo $?', 'A && B', 'A || B'],
    description: [
      'Every command ends with an exit code: 0 means success, anything else is failure (1 is general failure, 2 misuse, 126 cannot run, 127 command not found, 130 stopped by Ctrl-C). $? holds the last one.',
      'A && B runs B only if A succeeded. A || B runs B only if A failed. A; B runs both regardless. grep -q, test-style commands and true/false exist mainly for their exit codes.',
    ],
    examples: [
      ['false; echo $?', '1'],
      ['grep -qi kafka resume.md && echo yes || echo no', 'branch on a match'],
      ['nope; echo $?', '127'],
    ],
    seeAlso: ['true', 'false', 'grep'],
  },
]
