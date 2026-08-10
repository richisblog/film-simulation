# Dazz Catalog Pruning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 29 enabled Dazz cameras and 40 enabled recipes while retaining all archived binaries, and preload one canonical 8³ cube for all 76 runtime filters.

**Architecture:** Keep `scripts/dazz-recipes.json` as the complete archive and introduce a separate inactive-product policy consumed only when emitting the runtime manifest. Collapse classic and Dazz runtime loading onto one preview-asset cache/inflight/preload path so progress, selection, retry, preview, and export use the same 8³ `LutCube`.

**Tech Stack:** Node.js asset generator, React 19, TypeScript 7, Vitest, Playwright, Vite PWA.

## Global Constraints

- Preserve all committed Dazz 64³ and 8³ binary files, including inactive effects.
- Runtime catalog is exactly 29 Dazz cameras and 40 Dazz recipes.
- Inactive cameras: `135NE`, `135SR`, `3D`, `CCDR`, `COLLAGE`, `CPM35`, `DAM`, `DBLACK`, `DCR`, `FQS`, `GLOW`, `GOLF`, `INSTC`.
- Inactive recipe: `DAZZ_FXN_FX3_3`.
- Runtime total and preload progress are exactly 36 classic + 40 Dazz = 76 LUTs.
- Runtime processing uses only 8³ LUTs; archived 64³ files receive no browser requests.
- Exposure and all light leaks remain unchanged.

---

### Task 1: Separate Archive Definitions from Product Activation

**Files:**
- Create: `scripts/dazz-product-policy.json`
- Modify: `scripts/generate-dazz-assets.mjs`
- Modify: `scripts/dazz-assets.test.mjs`
- Modify: `public/assets/dazz/luts/manifest-v1.json`

**Interfaces:**
- Consumes: complete 42-camera/64-recipe `scripts/dazz-recipes.json`.
- Produces: explicit `inactive_camera_ids` and `inactive_recipe_ids`; runtime manifest with 29 cameras and 40 recipes while all 128 LUT binary files remain present.

- [ ] **Step 1: Write failing asset assertions**

Assert archive definitions remain 42/64, policy IDs match the exact approved list, runtime manifest is 29/40, no inactive ID is present, FXN contains three recipes without `DAZZ_FXN_FX3_3`, and representative inactive full/preview binaries still exist.

- [ ] **Step 2: Run asset tests and verify RED**

Run: `npm run test:dazz-assets`

Expected: failure because the policy is missing and manifest remains 42/64.

- [ ] **Step 3: Implement product filtering in the generator**

Load `dazz-product-policy.json`, bake/write every archive recipe as before, then filter cameras and recipes only when constructing `manifest-v1.json`. Remove inactive recipe IDs from each enabled camera and preserve each valid default recipe.

- [ ] **Step 4: Regenerate only the manifest deterministically**

Run the authorized generator using `DAZZ_CUBE_DIR` and `DAZZ_APP_DIR`; verify no committed binary is deleted and the manifest changes to 29/40.

- [ ] **Step 5: Run asset tests and verify GREEN**

Run: `npm run test:dazz-assets`

Expected: both asset tests pass with archived files present.

- [ ] **Step 6: Commit**

```bash
git add scripts/dazz-product-policy.json scripts/generate-dazz-assets.mjs scripts/dazz-assets.test.mjs public/assets/dazz/luts/manifest-v1.json
git commit -m "feat: prune the runtime Dazz catalog"
```

### Task 2: Unify All 76 Runtime LUTs on the 8³ Preload Path

**Files:**
- Modify: `src/image/catalog.ts`
- Modify: `src/image/catalog.test.ts`
- Modify: `src/components/LutLoadProgress.tsx`
- Modify: `src/components/LutLoadProgress.test.tsx`
- Modify: `src/hooks/useEditor.test.tsx`

**Interfaces:**
- Consumes: 36 classic plus 40 enabled Dazz descriptors.
- Produces: `loadLut(id)` and `loadPreviewLut(id)` returning one shared 8³ cube; `preloadLuts` tracking all 76; cache capacity covering all runtime LUTs.

- [ ] **Step 1: Write failing catalog tests**

Build a controlled manifest with classic and Dazz descriptors. Assert both load APIs share one preview request and one cube, no Dazz `full/` request occurs, preload starts every enabled ID, and final progress is `{ total: 76, completed: 76, succeeded: 76, failed: 0, done: true }`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/image/catalog.test.ts src/components/LutLoadProgress.test.tsx src/hooks/useEditor.test.tsx`

Expected: Dazz full request or total/preload count remains limited to classic filters.

- [ ] **Step 3: Collapse runtime loading onto preview assets**

Make `loadLut` always call the preview descriptor, make `loadPreviewLut` delegate to `loadLut`, remove the separate preview cache/inflight maps, preload `this.luts`, derive total from `this.luts.length`, and set the in-memory limit to at least 76.

- [ ] **Step 4: Remove the hard-coded progress fallback**

Use `progress.total || 1` only as the HTML progress maximum while the manifest loads; keep visible copy driven by actual totals.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npx vitest run src/image/catalog.test.ts src/components/LutLoadProgress.test.tsx src/hooks/useEditor.test.tsx`

Expected: all selected tests pass with unified Dazz/classic behavior.

- [ ] **Step 6: Commit**

```bash
git add src/image/catalog.ts src/image/catalog.test.ts src/components/LutLoadProgress.tsx src/components/LutLoadProgress.test.tsx src/hooks/useEditor.test.tsx
git commit -m "feat: preload all enabled LUTs"
```

### Task 3: Product UI, Browser Network Contract, Verification, and Deployment

**Files:**
- Modify: `src/components/EffectGrids.test.tsx`
- Modify: `e2e/dazz-library.spec.ts`
- Modify: `e2e/weak-network.spec.ts`
- Modify: `README.md`
- Modify: `docs/DAZZ_ASSETS.md`

**Interfaces:**
- Consumes: runtime manifest and unified catalog behavior from Tasks 1–2.
- Produces: UI showing 29 Dazz cameras, progress reaching 76/76, and browser coverage proving zero 64³ requests.

- [ ] **Step 1: Write failing UI and browser assertions**

Assert removed camera labels and FX3-3 are absent, retained FXN variants remain, the ready status reaches `76 / 76`, and all Dazz LUT binary requests use `/preview/` rather than `/full/`.

- [ ] **Step 2: Run targeted tests and verify RED where behavior is not yet connected**

Run: `npx vitest run src/components/EffectGrids.test.tsx && npx playwright test e2e/dazz-library.spec.ts --project=chromium`

Expected before Tasks 1–2 artifacts are applied: old counts or full-request assertions fail.

- [ ] **Step 3: Update durable documentation**

Document 42/64 archived versus 29/40 active, 76-LUT preload behavior, and the fact that 64³ files remain GitHub-only archives with no runtime traffic.

- [ ] **Step 4: Run complete verification**

```bash
npm run test:assets
npm run test:dazz-assets
npm run test:pwa-assets
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: all asset and unit suites pass, build exits zero, all Chromium/WebKit tests pass, and diff check is empty.

- [ ] **Step 5: Commit and publish**

```bash
git add src/components/EffectGrids.test.tsx e2e/dazz-library.spec.ts e2e/weak-network.spec.ts README.md docs/DAZZ_ASSETS.md
git commit -m "docs: explain the active Dazz catalog"
git push origin HEAD:master
npm run deploy:cloudflare
```

Wait for GitHub Actions and nginx synchronization. Verify GitHub Pages, Cloudflare Pages, and `film.richis.top` serve the same tested bundle and show 76/76.
