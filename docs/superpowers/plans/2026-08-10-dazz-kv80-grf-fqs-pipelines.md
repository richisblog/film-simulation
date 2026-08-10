# Dazz KV80, GRF, and FQS Pipeline Replication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the recovered KV80, GRF, and FQS processing graphs with original LUT/texture assets, promote them to the front of the Dazz catalog, and avoid invented exposure compensation.

**Architecture:** Extend the generated Dazz manifest from single baked recipes to typed ordered pipeline stages. Load and deduplicate LUT and texture dependencies through `AssetCatalog`, then execute the same graph through CPU and WebGL renderers for preview/export; legacy recipes continue through the existing single-LUT path.

**Tech Stack:** TypeScript 7, React 19, Vite 7, Vitest, Node test runner, Sharp, WebGL 2, Playwright.

## Global Constraints

- Do not add a fixed or hidden `-0.7 EV` stage to KV80.
- Runtime LUT stages use preloaded 8³ RGB-deflate assets; committed 64³ files remain archived and are not requested by the product.
- KV80 uses `lookup_kv80_kg200` and `grain_ofm`, never `grain_kv88`.
- GRF variants are exactly `400TX`, `NEOP100`, and `VELVIA`, backed by `lookup_dblack_1`, `lookup_dblack_2`, and `lookup_velvia_x5`.
- FQS stage order is optical blur → `grain_ou` → `lookup_ou_light` → conditional `grain_ou_lowlight` → `lookup_ou_color`.
- User exposure and light leak run before native recipe color processing; user grain and vignette run after the complete recipe blend.
- FQS alone is restored from the inactive list; all other inactive cameras/recipes remain inactive.
- Tests must distinguish confirmed constants from approximated private blend kernels.

---

### Task 1: Generate native pipeline manifests and texture assets

**Files:**
- Modify: `scripts/dazz-recipes.json`
- Modify: `scripts/dazz-product-policy.json`
- Modify: `scripts/generate-dazz-assets.mjs`
- Modify: `scripts/dazz-assets.test.mjs`
- Generate: `public/assets/dazz/luts/manifest-v1.json`
- Generate: `public/assets/dazz/luts/preview/*.rgb.deflate`
- Generate: `public/assets/dazz/textures/manifest-v1.json`
- Generate: `public/assets/dazz/textures/*.webp`

**Interfaces:**
- Produces `manifest.pipelines: Array<{ id: string; stages: DazzPipelineStageManifest[] }>` and recipe `pipeline_id` references.
- Produces texture descriptors `{ id, asset, width, height, byte_length, sha256 }` for `GRAIN_OFM`, `GRAIN_OU`, and `GRAIN_OU_LOWLIGHT`.
- Keeps legacy recipe `asset` metadata for recipes without native pipelines.

- [ ] **Step 1: Write failing asset tests**

Add assertions equivalent to:

```js
assert.deepEqual(manifest.cameras.slice(0, 3).map(({ id }) => id), ['KV80', 'GRF', 'FQS'])
assert.deepEqual(manifest.cameras.find(({ id }) => id === 'GRF').recipe_ids, [
  'DAZZ_GRF_400TX', 'DAZZ_GRF_NEOP100', 'DAZZ_GRF_VELVIA',
])
assert.deepEqual(manifest.pipelines.find(({ id }) => id === 'DAZZ_PIPELINE_FQS').stages.map(({ type }) => type), [
  'optical-blur', 'grain', 'lut', 'lowlight-grain', 'lut',
])
assert.equal(manifest.pipelines.find(({ id }) => id === 'DAZZ_PIPELINE_KV80').stages.some(({ type }) => type === 'exposure'), false)
assert.equal(manifest.pipelines.find(({ id }) => id === 'DAZZ_PIPELINE_KV80').stages.find(({ type }) => type === 'grain').texture_id, 'GRAIN_OFM')
assert.equal(policy.inactive_camera_ids.includes('FQS'), false)
```

Validate every stage LUT inflates to `8 ** 3 * 3`; validate texture hashes, dimensions, byte lengths, and source names.

- [ ] **Step 2: Run the asset test and verify RED**

Run: `node --test scripts/dazz-assets.test.mjs`

Expected: FAIL because GRF/pipeline/texture descriptors do not exist and FQS is inactive.

- [ ] **Step 3: Add explicit native recipe definitions**

Add KV80 pipeline metadata, a new GRF camera with three recipes, and FQS pipeline metadata. Remove only `FQS` from `inactive_camera_ids`. Add `promoted_camera_ids: ["KV80", "GRF", "FQS"]` to product policy and sort active cameras through that stable list.

- [ ] **Step 4: Generate stage LUTs without composing native pipelines**

Refactor the generator so legacy `stages` are baked as today, while pipeline `lut` stages emit/deduplicate their own preview payload keyed by source LUT name. Do not emit a runtime baked Light+Color FQS asset selected by `DAZZ_FQS_DEFAULT`.

- [ ] **Step 5: Generate the original texture payloads**

Convert `${DAZZ_APP_DIR}/grain_ofm.jpg`, `grain_ou.jpg`, and `grain_ou_lowlight.jpg` to deterministic WebP files under `public/assets/dazz/textures/`, recording dimensions, byte lengths, SHA-256, and source names in `manifest-v1.json`.

- [ ] **Step 6: Run the generator and verify GREEN**

Run:

```bash
DAZZ_CUBE_DIR=/Users/richis/Documents/ChatGPT/解包胶片模拟/dazz_analysis/dazz_lut_recovery/all_luts/cube \
DAZZ_APP_DIR=/Users/richis/Documents/ChatGPT/解包胶片模拟/dazz_analysis/extracted/Payload/DazzCamera.app \
npm run assets:dazz
node --test scripts/dazz-assets.test.mjs
```

Expected: PASS with promoted KV80/GRF/FQS, separate FQS stage assets, and three texture entries.

- [ ] **Step 7: Commit**

```bash
git add scripts/dazz-recipes.json scripts/dazz-product-policy.json scripts/generate-dazz-assets.mjs scripts/dazz-assets.test.mjs public/assets/dazz
git commit -m "feat: generate native Dazz pipeline assets"
```

### Task 2: Load and preload ordered pipeline dependencies

**Files:**
- Modify: `src/image/assetRequest.ts`
- Modify: `src/image/catalog.ts`
- Modify: `src/image/catalog.test.ts`
- Modify: `src/hooks/useEditor.ts`
- Modify: `src/hooks/useEditor.test.tsx`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces exported `DazzPipelineDescriptor`, `DazzPipelineStage`, `TextureDescriptor`, and `LoadedDazzPipeline` types.
- Produces `AssetCatalog.loadPipeline(recipeId): Promise<LoadedDazzPipeline | null>`.
- Produces `AssetCatalog.preloadLuts` progress that counts unique runtime LUT and texture dependencies once.

- [ ] **Step 1: Write failing catalog tests**

Use a small manifest fixture and assert:

```ts
const pipeline = await catalog.loadPipeline('DAZZ_FQS_DEFAULT')
expect(pipeline?.stages.map(({ type }) => type)).toEqual([
  'optical-blur', 'grain', 'lut', 'lowlight-grain', 'lut',
])
expect(fetchCalls.filter((url) => url.endsWith('lookup_ou_light.rgb'))).toHaveLength(1)
expect(fetchCalls.filter((url) => url.endsWith('grain_ou.webp'))).toHaveLength(1)
```

Also prove parallel main/thumbnail requests share inflight stage loads and a failed texture marks only its recipe failed.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/image/catalog.test.ts src/hooks/useEditor.test.tsx`

Expected: FAIL because pipeline and texture loading APIs do not exist.

- [ ] **Step 3: Implement typed manifest parsing and dependency caches**

Add `texture` to `AssetKind`; load the texture manifest; index pipelines by ID; reuse the existing LUT byte/cache path for LUT stages; add decoded `ImageBitmap`/`HTMLImageElement` texture caching keyed by texture ID. Resolve a recipe pipeline in declared order.

- [ ] **Step 4: Extend preloading and progress**

Build a unique dependency set containing all legacy runtime LUTs plus promoted pipeline LUT/texture assets. Publish progress from completed unique dependencies, retry only failures, and keep full 64³ URLs out of preload and selection.

- [ ] **Step 5: Pass loaded pipeline state through the editor**

Update the editor hook so selection asynchronously resolves the pipeline while preserving the last render until the new recipe is complete. Reset and Original clear native pipeline state without changing user exposure.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm test -- src/image/catalog.test.ts src/hooks/useEditor.test.tsx src/components/LutLoadProgress.test.tsx`

Expected: PASS with deduplicated dependency counts and isolated failures.

- [ ] **Step 7: Commit**

```bash
git add src/image/assetRequest.ts src/image/catalog.ts src/image/catalog.test.ts src/hooks/useEditor.ts src/hooks/useEditor.test.tsx vite.config.ts
git commit -m "feat: load native Dazz pipelines"
```

### Task 3: Implement the shared CPU pipeline model

**Files:**
- Create: `src/image/colorTransfer.ts`
- Create: `src/image/colorTransfer.test.ts`
- Create: `src/image/dazzPipeline.ts`
- Create: `src/image/dazzPipeline.test.ts`
- Modify: `src/image/cpuRenderer.ts`
- Modify: `src/image/cpuRenderer.test.ts`
- Modify: `src/image/types.ts`

**Interfaces:**
- Produces `srgbToLinear(value: number): number` and `linearToSrgb(value: number): number`.
- Produces `executeDazzPipeline(input: ImageData, pipeline: LoadedDazzPipeline, context: PipelineContext): ImageData`.
- `PipelineContext` supplies deterministic seed, user exposure/light leak input, output dimensions, and private-kernel adapters.

- [ ] **Step 1: Write failing color-transfer tests**

Assert canonical IEC sRGB vectors (`0`, `0.04045`, `0.5`, `1`) and round trips within `1e-6`. Assert no hidden KV80 exposure stage and that `0 EV` multiplies source channels by exactly one before conversion.

- [ ] **Step 2: Run color-transfer tests and verify RED**

Run: `npm test -- src/image/colorTransfer.test.ts`

Expected: FAIL because the transfer module does not exist.

- [ ] **Step 3: Implement transfer functions and ordered stage executor**

Implement typed dispatch for LUT, optical blur, grain, lowlight-grain, and vignette. Reuse LUT trilinear sampling from `lut.ts`. Keep floating-point working buffers between stages and convert to bytes only at output.

- [ ] **Step 4: Write failing stage-order tests**

Use trace adapters:

```ts
expect(trace).toEqual([
  'optical-blur', 'grain:GRAIN_OU', 'lut:OU_LIGHT',
  'lowlight-grain:GRAIN_OU_LOWLIGHT', 'lut:OU_COLOR',
])
```

Assert `lowlight-grain` skips when parameter is `null`; filter strength blends once between pipeline input and completed result; user grain/vignette run afterward.

- [ ] **Step 5: Run stage-order tests and verify RED**

Run: `npm test -- src/image/dazzPipeline.test.ts src/image/cpuRenderer.test.ts`

Expected: FAIL on missing pipeline execution.

- [ ] **Step 6: Connect CPU preview/export**

Route legacy recipes through the current LUT path and promoted recipes through `executeDazzPipeline`. Implement deterministic texture tiling/cropping. Name the unconfirmed blend adapters `dazzGrainApproximation` and `dazzLowlightApproximation`, with comments linking the evidence report and explicitly stating the unresolved private kernel.

- [ ] **Step 7: Run CPU tests and verify GREEN**

Run: `npm test -- src/image/colorTransfer.test.ts src/image/dazzPipeline.test.ts src/image/cpuRenderer.test.ts src/image/renderer.test.ts`

Expected: PASS and prove preview/export share the same descriptor and stage order.

- [ ] **Step 8: Commit**

```bash
git add src/image/colorTransfer.ts src/image/colorTransfer.test.ts src/image/dazzPipeline.ts src/image/dazzPipeline.test.ts src/image/cpuRenderer.ts src/image/cpuRenderer.test.ts src/image/types.ts
git commit -m "feat: execute Dazz pipelines on CPU"
```

### Task 4: Execute native pipelines in WebGL

**Files:**
- Modify: `src/image/shaders.ts`
- Modify: `src/image/webglRenderer.ts`
- Modify: `src/image/renderer.ts`
- Modify: `src/image/renderer.test.ts`
- Create: `src/image/webglPipeline.test.ts`

**Interfaces:**
- Produces internal `renderPipelineStages(source, pipeline, settings)` using ping-pong framebuffers.
- Uses the same `LoadedDazzPipeline` and transfer constants as the CPU executor.

- [ ] **Step 1: Write failing WebGL contract tests**

Assert shader sources expose explicit sRGB transfer, LUT, grain, lowlight, and optical-blur passes. Assert the renderer dispatch trace for FQS matches the CPU order and allocates only two reusable intermediate framebuffers.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/image/webglPipeline.test.ts src/image/renderer.test.ts`

Expected: FAIL because ordered WebGL pipeline passes do not exist.

- [ ] **Step 3: Implement ping-pong stage rendering**

Add one shader/program per stage family, reuse LUT textures by ID, upload grain textures once, apply explicit boundary transfer functions, and preserve float intermediates where supported. Fall back to the CPU executor when required extensions or a stage program are unavailable.

- [ ] **Step 4: Preserve global control order**

Apply exposure and light leak before native processing, blend filter strength once around the completed native graph, then apply user grain and vignette. Keep Original and legacy filter output unchanged.

- [ ] **Step 5: Run renderer tests and verify GREEN**

Run: `npm test -- src/image/webglPipeline.test.ts src/image/renderer.test.ts src/image/cpuRenderer.test.ts`

Expected: PASS with matching CPU/WebGL fixture pixels within the existing byte tolerance.

- [ ] **Step 6: Commit**

```bash
git add src/image/shaders.ts src/image/webglRenderer.ts src/image/renderer.ts src/image/renderer.test.ts src/image/webglPipeline.test.ts
git commit -m "feat: render native Dazz pipelines in WebGL"
```

### Task 5: Promote the three cameras and verify the product flow

**Files:**
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/EffectGrids.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/i18n.tsx`
- Modify: `src/i18n.test.tsx`
- Modify: `e2e/dazz-library.spec.ts`
- Modify: `docs/DAZZ_ASSETS.md`
- Modify: `README.md`

**Interfaces:**
- Camera browser consumes manifest order; GRF uses the existing multi-recipe selection contract.
- Documentation links the repository-local implementation to the three recovered reports and labels unresolved kernels honestly.

- [ ] **Step 1: Write failing UI and end-to-end assertions**

Assert the first camera buttons are `KV80`, `GRF`, `FQS`; clicking GRF reveals `400TX`, `NEOP100`, `VELVIA`; FQS is selectable; no internal `lookup_*` names appear; exposure remains `0` across selection.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm test -- src/components/EffectGrids.test.tsx src/App.test.tsx src/i18n.test.tsx`

Expected: FAIL because GRF/FQS and promoted ordering are absent.

- [ ] **Step 3: Render promoted order from manifest data**

Keep the existing camera/variant component, remove assumptions about the old 29/40 fixed counts, and derive headings and preload totals from loaded manifests. Do not add technical pipeline controls to the consumer UI.

- [ ] **Step 4: Update evidence and asset documentation**

Document KV80, GRF, and FQS stage order, source resources, runtime 8³ policy, retained 64³ archive, and the names of unresolved private-kernel adapters. State explicitly that KV80 has no fixed `-0.7 EV` stage.

- [ ] **Step 5: Run unit and asset verification**

Run:

```bash
node --test scripts/dazz-assets.test.mjs
npm test
npm run build
```

Expected: all commands exit 0 with no TypeScript or Vite errors.

- [ ] **Step 6: Run a single Chromium smoke test**

Run: `npm run test:e2e -- e2e/dazz-library.spec.ts --project=chromium`

Expected: PASS for promoted selection, 8³-only requests, preview, and export.

- [ ] **Step 7: Commit**

```bash
git add src/components/Controls.tsx src/components/EffectGrids.test.tsx src/App.tsx src/App.test.tsx src/i18n.tsx src/i18n.test.tsx e2e/dazz-library.spec.ts docs/DAZZ_ASSETS.md README.md
git commit -m "feat: promote native Dazz camera pipelines"
```

### Task 6: Publish and verify production

**Files:**
- Modify only if generated by the existing build: `dist/**`

**Interfaces:**
- GitHub Actions publishes GitHub Pages from the pushed branch/main integration path.
- Cloudflare Pages serves the same artifact at `film.richis.top`.

- [ ] **Step 1: Run final verification from a clean build**

Run: `npm test && node --test scripts/dazz-assets.test.mjs && npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Push the implementation branch**

Run: `git push origin codex/dazz-filter-library`

Expected: push succeeds without force.

- [ ] **Step 3: Publish through the existing deployment paths**

Run the existing GitHub Pages workflow and `npm run deploy:cloudflare` using the already configured project `film-simulation`. Do not alter DNS or project ownership.

- [ ] **Step 4: Verify deployed behavior**

Open `https://film.richis.top`, confirm the first three Dazz cameras, GRF variants, FQS selection, neutral exposure display, a successful preview/export, and network requests limited to 8³ LUT stages plus required WebP textures.

- [ ] **Step 5: Record the deployed commit**

Append the verified commit SHA and deployment date to `docs/DAZZ_ASSETS.md`, then commit that documentation-only change.
