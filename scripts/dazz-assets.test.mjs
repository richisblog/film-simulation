import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
}

test('ships 42 Dazz cameras and 64 user-facing recipes with valid LUT payloads', async () => {
  const specification = await readJson('scripts/dazz-recipes.json')
  const manifest = await readJson('public/assets/dazz/luts/manifest-v1.json')

  assert.equal(specification.cameras.length, 42)
  assert.equal(manifest.cameras.length, 42)
  assert.equal(manifest.recipes.length, 64)
  assert.equal(new Set(manifest.cameras.map(({ id }) => id)).size, 42)
  assert.equal(new Set(manifest.recipes.map(({ id }) => id)).size, 64)
  assert.deepEqual(manifest.recipes.map(({ id }) => id), specification.cameras.flatMap(({ recipes }) => recipes.map(({ id }) => id)))

  for (const recipe of manifest.recipes) {
    assert.match(recipe.id, /^DAZZ_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)
    assert.ok(recipe.camera_id)
    assert.ok(recipe.name_zh && recipe.name_en)
    assert.ok(recipe.stages.length >= 1)
    const full = await readFile(path.join(root, 'public/assets/dazz/luts', recipe.asset))
    const preview = await readFile(path.join(root, 'public/assets/dazz/luts', recipe.preview_asset))
    assert.equal(full.length, recipe.byte_length, recipe.id)
    assert.equal(preview.length, recipe.preview_byte_length, recipe.id)
    assert.equal(inflateSync(full).length, 64 ** 3 * 3, recipe.id)
    assert.equal(inflateSync(preview).length, 8 ** 3 * 3, recipe.id)
  }
})

test('ships 17 general and 10 Instant Dazz leaks without changing legacy counts', async () => {
  const legacyLuts = await readJson('public/assets/luts/manifest-8cube-v1.json')
  const legacyLeaks = await readJson('public/assets/light_leaks/manifest.json')
  const manifest = await readJson('public/assets/dazz/light_leaks/manifest-v1.json')

  assert.equal(legacyLuts.luts.length, 36)
  assert.equal(legacyLeaks.light_leaks.length, 20)
  assert.deepEqual(manifest.groups.map(({ id, light_leaks }) => [id, light_leaks.length]), [
    ['dazz-general', 17],
    ['dazz-instant', 10],
  ])

  for (const group of manifest.groups) {
    for (const leak of group.light_leaks) {
      const asset = path.join(root, 'public/assets/dazz/light_leaks', leak.asset)
      assert.equal((await stat(asset)).size, leak.byte_length, leak.id)
      assert.match(leak.asset, new RegExp(`^${group.id === 'dazz-general' ? 'general' : 'instant'}/.+\\.webp$`))
    }
  }
})
