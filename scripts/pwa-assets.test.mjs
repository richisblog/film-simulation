import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)

async function json(path) {
  return JSON.parse(await readFile(new URL(path, root), 'utf8'))
}

test('declares sharp directly so icon generation is reproducible', async () => {
  const packageJson = await json('package.json')
  assert.equal(packageJson.devDependencies.sharp, '0.35.2')
})

test('ships localized manifests with one shared app identity', async () => {
  const zh = await json('public/manifest-zh.webmanifest')
  const en = await json('public/manifest-en.webmanifest')

  assert.deepEqual(
    { id: zh.id, start_url: zh.start_url, scope: zh.scope, display: zh.display, icons: zh.icons },
    { id: en.id, start_url: en.start_url, scope: en.scope, display: en.display, icons: en.icons },
  )
  assert.deepEqual(
    { lang: zh.lang, name: zh.name, short_name: zh.short_name, description: zh.description },
    {
      lang: 'zh-CN',
      name: '胶片模拟',
      short_name: '胶片模拟',
      description: '照片只在浏览器本地处理的胶片模拟工具',
    },
  )
  assert.deepEqual(
    { lang: en.lang, name: en.name, short_name: en.short_name, description: en.description },
    {
      lang: 'en',
      name: 'Film Simulation',
      short_name: 'Film Sim',
      description: 'A film simulation tool that processes photos locally in your browser',
    },
  )
})

test('generated PNG icons have the declared dimensions', async () => {
  for (const [name, size] of [
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
  ]) {
    const png = await readFile(new URL(`public/icons/${name}`, root))
    assert.equal(png.toString('ascii', 1, 4), 'PNG')
    assert.equal(png.readUInt32BE(16), size, `${name} width`)
    assert.equal(png.readUInt32BE(20), size, `${name} height`)
  }
})
