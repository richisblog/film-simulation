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

test('keeps the 42/64 archive while shipping only the approved 29/40 product catalog', async () => {
  const specification = await readJson('scripts/dazz-recipes.json')
  const policy = await readJson('scripts/dazz-product-policy.json')
  const manifest = await readJson('public/assets/dazz/luts/manifest-v1.json')

  assert.equal(specification.cameras.length, 42)
  assert.equal(specification.cameras.flatMap(({ recipes }) => recipes).length, 64)
  assert.deepEqual(policy.inactive_camera_ids, ['135NE', '135SR', '3D', 'CCDR', 'COLLAGE', 'CPM35', 'DAM', 'DBLACK', 'DCR', 'FQS', 'GLOW', 'GOLF', 'INSTC'])
  assert.deepEqual(policy.inactive_recipe_ids, ['DAZZ_FXN_FX3_3'])
  assert.equal(manifest.cameras.length, 29)
  assert.equal(manifest.recipes.length, 40)
  assert.equal(new Set(manifest.cameras.map(({ id }) => id)).size, 29)
  assert.equal(new Set(manifest.recipes.map(({ id }) => id)).size, 40)
  assert.ok(!manifest.cameras.some(({ id }) => policy.inactive_camera_ids.includes(id)))
  assert.ok(!manifest.recipes.some(({ id }) => policy.inactive_recipe_ids.includes(id)))
  assert.deepEqual(manifest.cameras.find(({ id }) => id === 'FXN').recipe_ids, [
    'DAZZ_FXN_ORIGINAL', 'DAZZ_FXN_FXN2', 'DAZZ_FXN_FX3_2',
  ])

  for (const archivedId of ['DAZZ_135NE_07FF', 'DAZZ_FXN_FX3_3']) {
    await stat(path.join(root, 'public/assets/dazz/luts/full', `${archivedId}.rgb.deflate`))
    await stat(path.join(root, 'public/assets/dazz/luts/preview', `${archivedId}.rgb.deflate`))
  }

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
