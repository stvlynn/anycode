export interface Transport {
  connect?(): void | Promise<void>
  close(): void | Promise<void>
  write(message: unknown): void | Promise<void>
  writeBatch?(messages: unknown[]): void | Promise<void>
  setOnData?(handler: (data: string) => void): void
  setOnClose?(handler: (...args: any[]) => void): void
  reportState?(state: string): void
  getLastSequenceNum?(): number
}
