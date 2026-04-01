import type { Message } from './message.js'

export type QueuedMessage = {
  id: string
  createdAt: number
  message: Message
}

export type MessageQueueState = {
  pending: QueuedMessage[]
  processing?: QueuedMessage | null
}
export type QueueOperationMessage = any;
export type QueueOperation = any;
