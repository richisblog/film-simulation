import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'
import { sampleCube } from './preview-luts.mjs'

const root = path.resolve(import.meta.dirname, '..')
const lutRoot = path.join(root, 'public/assets/luts')
const previewRoot = path.join(lutRoot, 'previews')
const manifestPath = path.join(lutRoot, 'manifest.json')
const previewSize = 8

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
await mkdir(previewRoot, { recursive: true })

for (const descriptor of manifest.luts) {
  const compressed = await readFile(path.join(lutRoot, descriptor.asset))
  const source = new Uint8Array(inflateSync(compressed))
  const expectedLength = descriptor.cube_size ** 3 * 3
  if (source.length !== expectedLength) {
    throw new Error(`${descriptor.id} expands to ${source.length} bytes, expected ${expectedLength}`)
  }
  const preview = sampleCube(source, descriptor.cube_size, previewSize)
  const output = deflateSync(preview, { level: 9 })
  const previewAsset = `previews/${descriptor.id}.rgb.deflate`
  await writeFile(path.join(lutRoot, previewAsset), output)
  descriptor.preview_asset = previewAsset
  descriptor.preview_cube_size = previewSize
  descriptor.preview_byte_length = output.length
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Generated ${manifest.luts.length} preview LUTs in ${path.relative(root, previewRoot)}`)
