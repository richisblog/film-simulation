# Dazz Catalog Pruning and Unified Preload Design

## Goal

Remove difficult Dazz effects from the product without deleting their archived LUT files, and make every remaining Dazz effect use the same preloaded 8³ runtime path as the original 36 filters.

## Product Catalog

The following complete camera families are inactive in the product:

- 135NE
- 135SR
- 3D
- CCDR
- COLLAGE
- CPM35
- DAM
- DBLACK
- DCR
- FQS
- GLOW
- GOLF
- INSTC

The `DAZZ_FXN_FX3_3` recipe is also inactive while the rest of FXN remains available.

This removes 24 recipes from the runtime catalog. The enabled catalog contains 29 Dazz cameras and 40 Dazz recipes. Together with the original 36 filters, the runtime exposes and preloads 76 LUTs.

## Archive Versus Runtime

All generated 64³ and 8³ Dazz LUT files remain committed in GitHub, including inactive recipes. They are retained as a reversible archive.

The runtime manifest contains only enabled cameras and recipes. Inactive files are therefore never requested by the browser and consume no user traffic. The generator keeps the complete recipe archive separate from an explicit product-activation policy so regeneration cannot accidentally reactivate removed effects.

## Runtime LUT Behavior

Every enabled Dazz recipe uses its 8³ preview asset as its canonical image-processing LUT. The application does not request a Dazz 64³ asset after selection.

The original 36 and enabled Dazz 40 share one preload pipeline:

- all 76 8³ LUTs begin loading during catalog preparation;
- persistent byte caching applies to all 76;
- failures are isolated and retryable;
- selecting a filter reuses the preloaded in-memory cube;
- preview and export use the same cube instance.

The progress model reports a total of 76 and reaches the localized equivalent of `胶片色彩已就绪（76 / 76）`. Existing progress, error, CDN fallback, and retry UI remain structurally unchanged.

## UI

The Dazz separator reports 29 cameras. Inactive camera buttons and the FX3-3 variant do not render. All remaining camera and second-level variant behavior is unchanged.

Light leaks, exposure, grain, vignette, filter strength, bilingual behavior, analytics, and export formats are unchanged.

## Generator and Manifests

`scripts/dazz-recipes.json` remains the complete 42-camera, 64-recipe archive mapping. A separate activation policy lists the 13 inactive camera IDs and one inactive recipe ID. `scripts/generate-dazz-assets.mjs` continues to generate and retain every archived binary while emitting a runtime manifest filtered by that policy.

The generated manifest must contain exactly 29 cameras and 40 recipes. Asset tests must additionally prove that archived inactive binaries still exist and that none of their IDs appear in the runtime manifest.

## Testing

- Generator tests verify 42/64 archived definitions, 29/40 runtime manifest entries, and retained inactive binaries.
- Catalog tests verify 76 total LUTs, unified 8³ loading, shared full/preview cube identity, and preloading of both classic and Dazz entries.
- Progress tests verify total and completion counts derive from all enabled LUTs rather than a hard-coded 36.
- UI tests verify removed cameras and FX3-3 are absent while retained FXN variants remain.
- Browser tests verify the ready state reaches 76/76 and selecting Dazz causes no 64³ network request.
- Full asset, unit, build, Chromium, and WebKit suites run before deployment.

## Deployment

Publish the same tested commit to GitHub `master`, GitHub Pages, Cloudflare Pages, and the existing nginx synchronization at `film.richis.top`. Verify all three public endpoints serve the same bundle.
