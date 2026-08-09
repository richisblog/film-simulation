import sharp from 'sharp'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'public/icons/icon.svg')
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  await sharp(source, { density: 192 }).resize(size, size).flatten({ background: '#12100e' }).png().toFile(path.join(root, 'public/icons', name))
}
