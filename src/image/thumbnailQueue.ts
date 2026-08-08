export class TaskQueue {
  private active = 0
  private readonly pending: Array<() => void> = []

  constructor(private readonly limit: number) {}

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(() => {
        this.active += 1
        Promise.resolve().then(task).then(resolve, reject).finally(() => {
          this.active -= 1
          this.pump()
        })
      })
      this.pump()
    })
  }

  private pump(): void {
    while (this.active < this.limit && this.pending.length > 0) this.pending.shift()!()
  }
}

export const thumbnailQueue = new TaskQueue(2)
