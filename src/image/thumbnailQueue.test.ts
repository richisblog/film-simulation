import { expect, it, vi } from 'vitest'
import { TaskQueue } from './thumbnailQueue'

it('最多同时执行两个任务，并在失败后继续处理队列', async () => {
  const queue = new TaskQueue(2)
  const releases: Array<() => void> = []
  const started: number[] = []
  let active = 0
  let peak = 0
  const run = (id: number, fail = false) => queue.add(async () => {
    started.push(id)
    active += 1
    peak = Math.max(peak, active)
    await new Promise<void>((resolve) => releases.push(resolve))
    active -= 1
    if (fail) throw new Error('失败')
    return id
  })

  const first = run(1)
  const second = run(2, true)
  const third = run(3)
  await vi.waitFor(() => expect(started).toEqual([1, 2]))
  releases[0]()
  await vi.waitFor(() => expect(started).toEqual([1, 2, 3]))
  releases[1]()
  releases[2]()

  await expect(first).resolves.toBe(1)
  await expect(second).rejects.toThrow('失败')
  await expect(third).resolves.toBe(3)
  expect(peak).toBe(2)
})
