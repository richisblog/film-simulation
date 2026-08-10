import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cubeDir = process.env.DAZZ_CUBE_DIR
const appDir = process.env.DAZZ_APP_DIR

if (!cubeDir || !appDir) {
  throw new Error('DAZZ_CUBE_DIR and DAZZ_APP_DIR are required')
}

const specification = JSON.parse(await readFile(path.join(root, 'scripts/dazz-recipes.json'), 'utf8'))
const productPolicy = JSON.parse(await readFile(path.join(root, 'scripts/dazz-product-policy.json'), 'utf8'))
const lutRoot = path.join(root, 'public/assets/dazz/luts')
const leakRoot = path.join(root, 'public/assets/dazz/light_leaks')
await Promise.all([
  mkdir(path.join(lutRoot, 'full'), { recursive: true }),
  mkdir(path.join(lutRoot, 'preview'), { recursive: true }),
  mkdir(path.join(leakRoot, 'general'), { recursive: true }),
  mkdir(path.join(leakRoot, 'instant'), { recursive: true }),
])

const cubeCache = new Map()

async function loadCube(name) {
  if (cubeCache.has(name)) return cubeCache.get(name)
  const text = await readFile(path.join(cubeDir, `${name}.cube`), 'utf8')
  const sizeMatch = text.match(/^LUT_3D_SIZE\s+(\d+)\s*$/m)
  if (!sizeMatch) throw new Error(`${name}: LUT_3D_SIZE is missing`)
  const size = Number(sizeMatch[1])
  const values = []
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim()
    if (!clean || clean.startsWith('#') || /^[A-Z_]+\b/.test(clean)) continue
    const row = clean.split(/\s+/).map(Number)
    if (row.length === 3 && row.every(Number.isFinite)) values.push(...row)
  }
  if (values.length !== size ** 3 * 3) {
    throw new Error(`${name}: expected ${size ** 3} rows, found ${values.length / 3}`)
  }
  const cube = { size, values: Float32Array.from(values) }
  cubeCache.set(name, cube)
  return cube
}

function sample(cube, input) {
  const { size, values } = cube
  const coordinates = input.map((value) => Math.max(0, Math.min(1, value)) * (size - 1))
  const lo = coordinates.map(Math.floor)
  const hi = coordinates.map((value, index) => Math.min(size - 1, lo[index] + 1))
  const mix = coordinates.map((value, index) => value - lo[index])
  const result = [0, 0, 0]
  for (let bz = 0; bz < 2; bz += 1) {
    for (let gy = 0; gy < 2; gy += 1) {
      for (let rx = 0; rx < 2; rx += 1) {
        const r = rx ? hi[0] : lo[0]
        const g = gy ? hi[1] : lo[1]
        const b = bz ? hi[2] : lo[2]
        const weight = (rx ? mix[0] : 1 - mix[0]) * (gy ? mix[1] : 1 - mix[1]) * (bz ? mix[2] : 1 - mix[2])
        const offset = ((b * size + g) * size + r) * 3
        for (let channel = 0; channel < 3; channel += 1) result[channel] += values[offset + channel] * weight
      }
    }
  }
  return result
}

function bake(stages, size) {
  const output = Buffer.allocUnsafe(size ** 3 * 3)
  let offset = 0
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        let color = [r / (size - 1), g / (size - 1), b / (size - 1)]
        for (const stage of stages) color = sample(stage, color)
        for (const value of color) output[offset++] = Math.round(Math.max(0, Math.min(1, value)) * 255)
      }
    }
  }
  return output
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const recipes = []
for (const camera of specification.cameras) {
  for (const recipe of camera.recipes) {
    process.stdout.write(`Baking ${recipe.id}\n`)
    const stages = await Promise.all(recipe.stages.map(loadCube))
    const full = deflateSync(bake(stages, 64), { level: 9 })
    const preview = deflateSync(bake(stages, 8), { level: 9 })
    const fullName = `full/${recipe.id}.rgb.deflate`
    const previewName = `preview/${recipe.id}.rgb.deflate`
    await Promise.all([
      writeFile(path.join(lutRoot, fullName), full),
      writeFile(path.join(lutRoot, previewName), preview),
    ])
    recipes.push({
      ...recipe,
      camera_id: camera.id,
      asset: fullName,
      cube_size: 64,
      byte_length: full.length,
      sha256: sha256(full),
      preview_asset: previewName,
      preview_cube_size: 8,
      preview_byte_length: preview.length,
      preview_sha256: sha256(preview),
    })
  }
}

const inactiveCameras = new Set(productPolicy.inactive_camera_ids)
const inactiveRecipes = new Set(productPolicy.inactive_recipe_ids)
const activeCameras = specification.cameras.filter(({ id }) => !inactiveCameras.has(id)).map((camera) => {
  const recipeIds = camera.recipes.map(({ id }) => id).filter((id) => !inactiveRecipes.has(id))
  return {
    id: camera.id,
    name_zh: camera.name_zh,
    name_en: camera.name_en,
    default_recipe_id: recipeIds.includes(camera.default_recipe_id) ? camera.default_recipe_id : recipeIds[0],
    recipe_ids: recipeIds,
  }
})
const activeRecipeIds = new Set(activeCameras.flatMap(({ recipe_ids }) => recipe_ids))

await writeFile(path.join(lutRoot, 'manifest-v1.json'), `${JSON.stringify({
  version: 1,
  cube_format: 'rgb8-deflate-red-fastest',
  cameras: activeCameras,
  recipes: recipes.filter(({ id }) => activeRecipeIds.has(id)),
}, null, 2)}\n`)

async function convertLeaks({ id, count, source, output, prefix }) {
  const light_leaks = []
  for (let index = 1; index <= count; index += 1) {
    const sourceName = source(index)
    const outputName = `${prefix}${String(index).padStart(2, '0')}.webp`
    const relative = `${output}/${outputName}`
    const buffer = await sharp(path.join(appDir, sourceName)).webp({ quality: 92 }).toBuffer()
    await writeFile(path.join(leakRoot, relative), buffer)
    light_leaks.push({
      id: `DAZZ_LEAK_${id === 'dazz-general' ? 'GENERAL' : 'INSTANT'}_${String(index).padStart(2, '0')}`,
      asset: relative,
      source_name: sourceName,
      byte_length: buffer.length,
      sha256: sha256(buffer),
    })
  }
  return { id, light_leaks }
}

const groups = await Promise.all([
  convertLeaks({ id: 'dazz-general', count: 17, source: (index) => `lightleaks${index}.jpg`, output: 'general', prefix: 'dazz_general_' }),
  convertLeaks({ id: 'dazz-instant', count: 10, source: (index) => `lightleaks_inst_${String(index).padStart(2, '0')}.jpg`, output: 'instant', prefix: 'dazz_instant_' }),
])
await writeFile(path.join(leakRoot, 'manifest-v1.json'), `${JSON.stringify({ version: 1, groups }, null, 2)}\n`)
process.stdout.write(`Generated ${recipes.length} Dazz recipes and ${groups.reduce((sum, group) => sum + group.light_leaks.length, 0)} leaks.\n`)
