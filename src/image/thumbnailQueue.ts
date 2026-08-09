export class TaskCancelledError extends Error {
  readonly name = 'TaskCancelledError'

  constructor() {
    super('缩略图任务已取消')
  }
}

export interface TaskHandle<T> {
  promise: Promise<T>
  cancel(): void
}

interface PendingTask<T> {
  state: 'pending' | 'active' | 'settled' | 'cancelled'
  task: () => Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(reason?: unknown): void
}

export class TaskQueue {
  private active = 0
  private readonly pending: Array<PendingTask<unknown>> = []

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('queue limit must be at least 1')
  }

  add<T>(task: () => Promise<T>): TaskHandle<T> {
    let entry!: PendingTask<T>
    const promise = new Promise<T>((resolve, reject) => {
      entry = { state: 'pending', task, resolve, reject }
    })
    this.pending.push(entry as PendingTask<unknown>)
    this.pump()
    return {
      promise,
      cancel: () => {
        if (entry.state !== 'pending') return
        entry.state = 'cancelled'
        const index = this.pending.indexOf(entry as PendingTask<unknown>)
        if (index >= 0) this.pending.splice(index, 1)
        entry.reject(new TaskCancelledError())
      },
    }
  }

  private pump(): void {
    while (this.active < this.limit && this.pending.length > 0) {
      const entry = this.pending.shift()!
      if (entry.state !== 'pending') continue
      entry.state = 'active'
      this.active += 1
      void Promise.resolve().then(entry.task).then(entry.resolve, entry.reject).finally(() => {
        entry.state = 'settled'
        this.active -= 1
        this.pump()
      })
    }
  }
}

export const THUMBNAIL_CONCURRENCY = 36
export const thumbnailQueue = new TaskQueue(THUMBNAIL_CONCURRENCY)
