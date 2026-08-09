export function sampleCube(source, sourceSize, previewSize) {
  if (!(source instanceof Uint8Array)) throw new TypeError('source must be a Uint8Array')
  if (!Number.isInteger(sourceSize) || sourceSize < 2) throw new RangeError('sourceSize must be at least 2')
  if (!Number.isInteger(previewSize) || previewSize < 2 || previewSize > sourceSize) {
    throw new RangeError('previewSize must be between 2 and sourceSize')
  }
  if (source.length !== sourceSize ** 3 * 3) throw new RangeError('source cube byte length is invalid')

  const preview = new Uint8Array(previewSize ** 3 * 3)
  const sourceCoordinate = (index) => Math.round(index * (sourceSize - 1) / (previewSize - 1))
  for (let blue = 0; blue < previewSize; blue += 1) {
    for (let green = 0; green < previewSize; green += 1) {
      for (let red = 0; red < previewSize; red += 1) {
        const sourceRed = sourceCoordinate(red)
        const sourceGreen = sourceCoordinate(green)
        const sourceBlue = sourceCoordinate(blue)
        const sourceOffset = (sourceRed + sourceGreen * sourceSize + sourceBlue * sourceSize * sourceSize) * 3
        const previewOffset = (red + green * previewSize + blue * previewSize * previewSize) * 3
        preview.set(source.subarray(sourceOffset, sourceOffset + 3), previewOffset)
      }
    }
  }
  return preview
}
