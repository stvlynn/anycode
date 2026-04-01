import type { Message } from '../../types/message.js'

export async function writeSessionTranscriptSegment(
  _messages: Message[],
): Promise<void> {}

export function flushOnDateChange(
  _messages: Message[],
  _currentDate: string,
): void {}
