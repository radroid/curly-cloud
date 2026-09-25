import type { CommandDef } from '../command'
import { BUILTIN_COMMANDS } from './builtins'
import { CLONE_COMMANDS } from './clone'
import { FILE_COMMANDS } from './files'
import { RAJ_COMMANDS } from './raj'
import { TEACH_COMMANDS } from './teach'
import { TEXT_COMMANDS } from './text'

/** Every command rsh knows, in help order. */
export const COMMANDS: CommandDef[] = [
  ...FILE_COMMANDS,
  ...TEXT_COMMANDS,
  ...BUILTIN_COMMANDS,
  ...RAJ_COMMANDS.filter((c) => c.group === 'raj'),
  ...CLONE_COMMANDS,
  ...TEACH_COMMANDS,
  ...RAJ_COMMANDS.filter((c) => c.group !== 'raj'),
]
