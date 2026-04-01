import type { Message } from '../types/message.js'

export function createSessionTurnUploader():
  | ((messages: Message[]) => void)
  | null {
  return () => {}
}
