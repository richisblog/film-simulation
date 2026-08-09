import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { deflateSync, inflateSync } from 'node:zlib'
import { sampleCube } from './preview-luts.mjs'

const root = path.resolve(import.meta.dirname, '..')

function coordinateCube(size) {
  const bytes = new Uint8Array(size ** 3 * 3)
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        const offset = (red + green * size + blue * size * size) * 3
        bytes.set([red, green, blue], offset)
      }
    }
  }
  return bytes
}

test('samples a cube evenly and preserves both endpoints', () => {
  const preview = sampleCube(coordinateCube(4), 4, 2)

  assert.equal(preview.length, 2 ** 3 * 3)
  assert.deepEqual([...preview.slice(0, 3)], [0, 0, 0])
  assert.deepEqual([...preview.slice(-3)], [3, 3, 3])
  const coordinates = new Set()
  for (let offset = 0; offset < preview.length; offset += 3) {
    coordinates.add(preview[offset])
    coordinates.add(preview[offset + 1])
    coordinates.add(preview[offset + 2])
  }
  assert.deepEqual([...coordinates].sort(), [0, 3])
})

test('sampling and compression are byte-for-byte deterministic', () => {
  const source = coordinateCube(4)
  const first = deflateSync(sampleCube(source, 4, 2))
  const second = deflateSync(sampleCube(source, 4, 2))

  assert.deepEqual(first, second)
})

test('production manifest has a valid lightweight preview for every LUT', async () => {
  const manifestPath = path.join(root, 'public/assets/luts/manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(manifest.luts.length, 36)

  let total = 0
  for (const descriptor of manifest.luts) {
    assert.equal(descriptor.preview_cube_size, 8, descriptor.id)
    assert.match(descriptor.preview_asset, /^8cube-v1\/[A-Z0-9]+\.rgb\.deflate$/)
    const asset = path.join(root, 'public/assets/luts', descriptor.preview_asset)
    const info = await stat(asset)
    assert.equal(info.size, descriptor.preview_byte_length, descriptor.id)
    const compressed = await readFile(asset)
    assert.equal(inflateSync(compressed).length, 8 ** 3 * 3, descriptor.id)
    total += info.size
  }
  assert.ok(total < 1024 * 1024, `preview assets total ${total} bytes`)
})

test('ships an identical versioned manifest so old HTTP caches cannot pin asset paths', async () => {
  const legacy = await readFile(path.join(root, 'public/assets/luts/manifest.json'), 'utf8')
  const versioned = await readFile(path.join(root, 'public/assets/luts/manifest-8cube-v1.json'), 'utf8')

  assert.equal(versioned, legacy)
})
