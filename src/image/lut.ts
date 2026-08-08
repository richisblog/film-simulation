const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

export class LutCube {
  constructor(readonly size: number, readonly rgb: Uint8Array) {
    if (size < 2 || rgb.length !== size * size * size * 3) throw new Error('LUT 数据长度无效')
  }

  sample(red: number, green: number, blue: number): [number, number, number] {
    const axes = [red, green, blue].map((channel) => {
      const coordinate = Math.max(0, Math.min(255, channel)) / 255 * (this.size - 1)
      const low = Math.floor(coordinate)
      return { low, high: Math.min(this.size - 1, low + 1), amount: coordinate - low }
    })
    const [r, g, b] = axes
    const value = (ri: number, gi: number, bi: number, channel: number) =>
      this.rgb[((ri + gi * this.size + bi * this.size * this.size) * 3) + channel]
    const lerp = (first: number, second: number, amount: number) => first + (second - first) * amount
    return [0, 1, 2].map((channel) => {
      const lowBlue = lerp(
        lerp(value(r.low, g.low, b.low, channel), value(r.high, g.low, b.low, channel), r.amount),
        lerp(value(r.low, g.high, b.low, channel), value(r.high, g.high, b.low, channel), r.amount),
        g.amount,
      )
      const highBlue = lerp(
        lerp(value(r.low, g.low, b.high, channel), value(r.high, g.low, b.high, channel), r.amount),
        lerp(value(r.low, g.high, b.high, channel), value(r.high, g.high, b.high, channel), r.amount),
        g.amount,
      )
      return clampByte(lerp(lowBlue, highBlue, b.amount))
    }) as [number, number, number]
  }
}
