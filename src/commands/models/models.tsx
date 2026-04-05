import * as React from 'react'
import { ModelsBrowser } from '../../components/ModelsBrowser.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

export const call: LocalJSXCommandCall = async (
  onDone,
  _context,
  _args,
): Promise<React.ReactNode> => {
  return <ModelsBrowser onDone={onDone} />
}
