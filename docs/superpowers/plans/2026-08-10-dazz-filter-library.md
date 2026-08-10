# Dazz Filter Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every user-facing Dazz camera recipe and all 27 Dazz light leaks to the Film Simulation PWA, separated from the existing 36 filters and 20 leaks.

**Architecture:** Keep the existing manifests immutable and add versioned Dazz manifests under `public/assets/dazz/`. A deterministic Node generator converts the recovered CUBE/JPEG inputs into lazy-loaded RGB-deflate/WebP assets; React renders a two-level camera/recipe browser and three separately labeled leak groups while the catalog exposes group metadata.

**Tech Stack:** React 19, TypeScript 7, Vite 7, Vitest/Testing Library, Node test runner, Sharp, Playwright, zlib RGB LUT payloads.

## Global Constraints

- The existing 36 LUT IDs, order, files, and manifest bytes must not change.
- The existing 20 leak IDs, order, files, and manifest entries must not change.
- Dazz camera recipes use stable `DAZZ_<CAMERA>_<VARIANT>` IDs and never expose `lookup_*` as the primary UI label.
- OFM, FQS, and PAF Light/Color stages are composed offline in the documented order; Mask and Raw helpers are not standalone cards.
- All recovered user-facing single-stage variants remain available, producing 64 Dazz recipe cards across 42 camera families.
- Dazz high-resolution LUTs load only when selected; previews use 8³ payloads.
- Dazz leaks are exactly 17 general plus 10 Instant assets and are shipped as WebP.
- Both Chinese and English UI, accessibility labels, analytics, offline caching, desktop, and mobile layouts must support the new groups.

---

### Task 1: Deterministic Dazz recipe and leak asset generator

**Files:**
- Create: `scripts/dazz-recipes.json`
- Create: `scripts/generate-dazz-assets.mjs`
- Create: `scripts/dazz-assets.test.mjs`
- Modify: `package.json`
- Create generated: `public/assets/dazz/luts/manifest-v1.json`
- Create generated: `public/assets/dazz/luts/full/*.rgb.deflate`
- Create generated: `public/assets/dazz/luts/preview/*.rgb.deflate`
- Create generated: `public/assets/dazz/light_leaks/manifest-v1.json`
- Create generated: `public/assets/dazz/light_leaks/general/*.webp`
- Create generated: `public/assets/dazz/light_leaks/instant/*.webp`

**Interfaces:**
- Consumes: `DAZZ_CUBE_DIR` containing the 72 recovered CUBE files and `DAZZ_APP_DIR` containing Dazz app JPEG resources.
- Produces: `{ version, cameras, recipes }` LUT manifest and `{ version, groups }` leak manifest with exact byte lengths and SHA-256 hashes.

- [ ] **Step 1: Write the failing resource test**

Assert that `dazz-recipes.json` defines 42 unique cameras and 64 unique recipes; every stage asset exists in the recovered inventory; the generated manifest has the same IDs; every full payload inflates to `64 ** 3 * 3`, every preview payload to `8 ** 3 * 3`; leak groups contain 17 and 10 files with exact manifest lengths. Also assert the legacy manifests still contain exactly 36 and 20 entries.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/dazz-assets.test.mjs`

Expected: FAIL because `scripts/dazz-recipes.json` and generated Dazz manifests do not exist.

- [ ] **Step 3: Implement the recipe specification and generator**

Define explicit camera IDs, bilingual camera/variant names, ordered stage arrays, and default recipe IDs. Parse CUBE headers and rows, trilinearly sample arbitrary 32/64/65 dimensions, compose ordered stages onto a 64³ identity grid, quantize RGB to bytes, create an 8³ preview, deflate both, and hash outputs. Convert only `lightleaks1..17.jpg` and `lightleaks_inst_01..10.jpg` with Sharp to WebP and write deterministic manifests.

- [ ] **Step 4: Generate assets and verify GREEN**

Run:

```bash
DAZZ_CUBE_DIR=/Users/richis/Desktop/Dazz_LUT_72_可见文件 \
DAZZ_APP_DIR=/Users/richis/Documents/ChatGPT/解包胶片模拟/dazz_analysis/extracted/Payload/DazzCamera.app \
npm run assets:dazz
node --test scripts/dazz-assets.test.mjs
```

Expected: PASS with 42 cameras, 64 recipes, 17 general leaks, and 10 Instant leaks.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/dazz-recipes.json scripts/generate-dazz-assets.mjs scripts/dazz-assets.test.mjs public/assets/dazz
git commit -m "feat: generate Dazz filter and leak assets"
```

### Task 2: Catalog groups and lazy Dazz loading

**Files:**
- Modify: `src/image/catalog.ts`
- Modify: `src/image/catalog.test.ts`
- Modify: `src/image/persistentLutCache.ts`
- Modify: `src/config/pwaCache.ts`
- Modify: `src/config/pwaCache.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `DazzCameraDescriptor`, `DazzRecipeDescriptor`, `LeakDescriptor.group`, `AssetCatalog.classicLuts`, `AssetCatalog.dazzCameras`, and a combined ID lookup used by `loadLut`, `loadPreviewLut`, and `loadLeak`.

- [ ] **Step 1: Write failing catalog tests**

Test that loading the three manifests preserves 36 classic LUTs, exposes 42 Dazz cameras/64 recipes separately, exposes leak group counts 20/17/10, never includes Dazz IDs in classic preload progress, and resolves Dazz full/preview/leak URLs under `assets/dazz/`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/image/catalog.test.ts src/config/pwaCache.test.ts`

Expected: FAIL because grouped descriptors and Dazz manifests are unsupported.

- [ ] **Step 3: Implement grouped manifests and lazy loading**

Load both LUT manifests and both leak manifests. Keep `luts` as the 36 classic descriptors for backward compatibility, add `dazzCameras` and `dazzRecipes`, index all recipes by ID, use Dazz preview metadata in `loadPreviewLut`, and preload only classic IDs. Add Dazz asset paths to runtime CacheFirst matching and increase max entries to cover user-selected Dazz assets without precaching all full LUTs.

- [ ] **Step 4: Run focused and existing catalog tests**

Run: `npm test -- src/image/catalog.test.ts src/image/persistentLutCache.test.ts src/config/pwaCache.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/image/catalog.ts src/image/catalog.test.ts src/image/persistentLutCache.ts src/config/pwaCache.ts src/config/pwaCache.test.ts vite.config.ts
git commit -m "feat: load grouped Dazz assets lazily"
```

### Task 3: Two-level Dazz camera and recipe browser

**Files:**
- Create: `src/components/DazzFilmBrowser.tsx`
- Create: `src/components/DazzFilmBrowser.test.tsx`
- Modify: `src/components/FilmStrip.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/EffectGrids.test.tsx`
- Modify: `src/hooks/useEditor.ts`
- Modify: `src/i18n.tsx`
- Modify: `src/image/lutNames.ts`
- Modify: `src/styles.css`

**Interfaces:**
- `DazzFilmBrowser` consumes camera descriptors, selected recipe ID, thumbnail source, preview loader, and `onChange(recipeId)`.
- `Controls` receives classic LUTs and Dazz cameras separately.

- [ ] **Step 1: Write failing component tests**

Cover a single-recipe camera selecting directly, a multi-recipe camera opening a second-level radiogroup, selecting and remembering its last recipe, classic group retaining 36 cards, section labels and divider rendering in both languages, and no `lookup_` text appearing in accessible names.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/DazzFilmBrowser.test.tsx src/components/EffectGrids.test.tsx src/i18n.test.tsx`

Expected: FAIL because the component, copy, and grouped props do not exist.

- [ ] **Step 3: Implement minimal two-level browser**

Render `classicFilmGroup` above the unchanged `FilmStrip`, a semantic divider, then camera buttons. Open recipe cards only for multi-recipe cameras; select the sole recipe immediately for single-recipe cameras. Store the per-camera last recipe inside the component keyed by camera ID, and derive labels entirely from manifest bilingual fields.

- [ ] **Step 4: Add responsive styling and verify GREEN**

Desktop: camera and recipe grids. Mobile: horizontal camera row and adjacent horizontal recipe row. Keep visible keyboard focus, selected states, section-local numbering, and reduced-motion behavior.

Run: `npm test -- src/components/DazzFilmBrowser.test.tsx src/components/EffectGrids.test.tsx src/i18n.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DazzFilmBrowser.tsx src/components/DazzFilmBrowser.test.tsx src/components/FilmStrip.tsx src/components/Controls.tsx src/components/EffectGrids.test.tsx src/hooks/useEditor.ts src/i18n.tsx src/image/lutNames.ts src/styles.css
git commit -m "feat: add grouped Dazz camera browser"
```

### Task 4: Three-group light leak browser

**Files:**
- Create: `src/components/LeakBrowser.tsx`
- Create: `src/components/LeakBrowser.test.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/EffectGrids.test.tsx`
- Modify: `src/i18n.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `LeakBrowser` consumes grouped leak descriptors, selected ID, and `onChange(id | null)` and emits the existing setting shape.

- [ ] **Step 1: Write failing leak grouping tests**

Assert group headings “原有漏光 · 20”, “Dazz 通用漏光 · 17”, and “Dazz Instant 漏光 · 10”; verify one shared Off option, 47 leak radios, distinct separators, correct background URLs, selection behavior, and English labels.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/LeakBrowser.test.tsx src/components/EffectGrids.test.tsx`

Expected: FAIL because all leaks currently render in one flat grid.

- [ ] **Step 3: Implement grouped leak UI and styles**

Move leak rendering from `Controls` into `LeakBrowser`, group by descriptor metadata, number within each group, and keep the existing strength control conditional on any selected leak. Reuse the same radio selection semantics and add mobile horizontal rows.

- [ ] **Step 4: Verify GREEN and regression behavior**

Run: `npm test -- src/components/LeakBrowser.test.tsx src/components/EffectGrids.test.tsx src/hooks/useEditor.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LeakBrowser.tsx src/components/LeakBrowser.test.tsx src/components/Controls.tsx src/components/EffectGrids.test.tsx src/i18n.tsx src/styles.css
git commit -m "feat: group original and Dazz light leaks"
```

### Task 5: Analytics, end-to-end flows, documentation, and release verification

**Files:**
- Modify: `src/analytics/goatCounter.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `e2e/i18n.spec.ts`
- Create: `e2e/dazz-library.spec.ts`
- Modify: `README.md`
- Modify: `COMPATIBILITY.md`

**Interfaces:**
- Export analytics consumes stable Dazz recipe IDs and bilingual manifest names through the existing `trackFilterExport` payload.

- [ ] **Step 1: Write failing integration and E2E tests**

Test Dazz display-name analytics, classic/Dazz divider presence, FXN recipe expansion/selection, OFM combined selection, all three leak group counts, language switching, photo preview, and export initiation on desktop and mobile viewports.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/App.test.tsx src/analytics/goatCounter.test.ts` and `npm run test:e2e -- e2e/dazz-library.spec.ts`

Expected: FAIL until application wiring and names are complete.

- [ ] **Step 3: Complete application wiring and documentation**

Pass grouped catalog state from `useEditor` through `App` to `Controls`, resolve analytics names from both libraries, document the new two-level UI, lazy loading, 27 Dazz leaks, generation commands, and third-party authorization boundary.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run test:assets
npm run test:pwa-assets
node --test scripts/dazz-assets.test.mjs
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0; original 36 and 20 counts remain unchanged; Dazz manifests report 42 cameras, 64 recipes, and 27 leaks.

- [ ] **Step 5: Commit**

```bash
git add src e2e README.md COMPATIBILITY.md
git commit -m "test: verify Dazz library browser flows"
```
