export type KeybindingAction = string
export type KeybindingContextName = string

export type ParsedKeystroke = {
  name?: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  sequence?: string
}
export type KeybindingBlock = any;
export type ParsedBinding = any;
