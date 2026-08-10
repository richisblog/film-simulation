import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
}

test('ships promoted native KV80, GRF, and FQS pipelines without reactivating other archived cameras', async () => {
  const specification = await readJson('scripts/dazz-recipes.json')
  const policy = await readJson('scripts/dazz-product-policy.json')
  const manifest = await readJson('public/assets/dazz/luts/manifest-v1.json')
  const textures = await readJson('public/assets/dazz/textures/manifest-v1.json')

  assert.equal(specification.cameras.length, 43)
  assert.equal(specification.cameras.flatMap(({ recipes }) => recipes).length, 67)
  assert.deepEqual(policy.inactive_camera_ids, ['135NE', '135SR', '3D', 'CCDR', 'COLLAGE', 'CPM35', 'DAM', 'DBLACK', 'DCR', 'GLOW', 'GOLF', 'INSTC'])
  assert.deepEqual(policy.inactive_recipe_ids, ['DAZZ_FXN_FX3_3'])
  assert.deepEqual(policy.promoted_camera_ids, ['KV80', 'GRF', 'FQS'])
  assert.equal(manifest.cameras.length, 31)
  assert.equal(manifest.recipes.length, 44)
  assert.equal(new Set(manifest.cameras.map(({ id }) => id)).size, 31)
  assert.equal(new Set(manifest.recipes.map(({ id }) => id)).size, 44)
  assert.ok(!manifest.cameras.some(({ id }) => policy.inactive_camera_ids.includes(id)))
  assert.ok(!manifest.recipes.some(({ id }) => policy.inactive_recipe_ids.includes(id)))
  assert.deepEqual(manifest.cameras.slice(0, 3).map(({ id }) => id), ['KV80', 'GRF', 'FQS'])
  assert.deepEqual(manifest.cameras.find(({ id }) => id === 'GRF').recipe_ids, [
    'DAZZ_GRF_400TX', 'DAZZ_GRF_NEOP100', 'DAZZ_GRF_VELVIA',
  ])
  assert.deepEqual(manifest.cameras.find(({ id }) => id === 'FXN').recipe_ids, [
    'DAZZ_FXN_ORIGINAL', 'DAZZ_FXN_FXN2', 'DAZZ_FXN_FX3_2',
  ])

  const kv80 = manifest.pipelines.find(({ id }) => id === 'DAZZ_PIPELINE_KV80')
  assert.deepEqual(kv80.stages.map(({ type }) => type), ['lut', 'grain'])
  assert.equal(kv80.stages.some(({ type }) => type === 'exposure'), false)
  assert.equal(kv80.stages.find(({ type }) => type === 'grain').texture_id, 'GRAIN_OFM')
  const fqs = manifest.pipelines.find(({ id }) => id === 'DAZZ_PIPELINE_FQS')
  assert.deepEqual(fqs.stages.map(({ type }) => type), ['optical-blur', 'grain', 'lut', 'lowlight-grain', 'lut'])
  assert.deepEqual(fqs.stages.filter(({ type }) => type === 'lut').map(({ lut_id }) => lut_id), [
    'DAZZ_STAGE_LOOKUP_OU_LIGHT', 'DAZZ_STAGE_LOOKUP_OU_COLOR',
  ])
  assert.equal(manifest.recipes.find(({ id }) => id === 'DAZZ_FQS_DEFAULT').pipeline_id, 'DAZZ_PIPELINE_FQS')
  assert.deepEqual(textures.textures.map(({ id }) => id), ['GRAIN_OFM', 'GRAIN_OU', 'GRAIN_OU_LOWLIGHT'])

  for (const archivedId of ['DAZZ_135NE_07FF', 'DAZZ_FXN_FX3_3']) {
    await stat(path.join(root, 'public/assets/dazz/luts/full', `${archivedId}.rgb.deflate`))
    await stat(path.join(root, 'public/assets/dazz/luts/preview', `${archivedId}.rgb.deflate`))
  }

  for (const recipe of manifest.recipes) {
    assert.match(recipe.id, /^DAZZ_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)
    assert.ok(recipe.camera_id)
    assert.ok(recipe.name_zh && recipe.name_en)
    assert.ok(recipe.pipeline_id || recipe.stages.length >= 1)
    const full = await readFile(path.join(root, 'public/assets/dazz/luts', recipe.asset))
    const preview = await readFile(path.join(root, 'public/assets/dazz/luts', recipe.preview_asset))
    assert.equal(full.length, recipe.byte_length, recipe.id)
    assert.equal(preview.length, recipe.preview_byte_length, recipe.id)
    assert.equal(inflateSync(full).length, 64 ** 3 * 3, recipe.id)
    assert.equal(inflateSync(preview).length, 8 ** 3 * 3, recipe.id)
  }

  for (const stage of manifest.stage_luts) {
    const preview = await readFile(path.join(root, 'public/assets/dazz/luts', stage.preview_asset))
    assert.equal(preview.length, stage.preview_byte_length, stage.id)
    assert.equal(inflateSync(preview).length, 8 ** 3 * 3, stage.id)
  }

  const expectedTextures = new Map([
    ['GRAIN_OFM', ['grain_ofm.jpg', 2138, 3207]],
    ['GRAIN_OU', ['grain_ou.jpg', 2043, 3070]],
    ['GRAIN_OU_LOWLIGHT', ['grain_ou_lowlight.jpg', 2043, 3070]],
  ])
  for (const texture of textures.textures) {
    const [sourceName, width, height] = expectedTextures.get(texture.id)
    const bytes = await readFile(path.join(root, 'public/assets/dazz/textures', texture.asset))
    assert.equal(texture.source_name, sourceName)
    assert.equal(texture.width, width)
    assert.equal(texture.height, height)
    assert.equal(bytes.length, texture.byte_length)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), texture.sha256)
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
