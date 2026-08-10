# Exposure Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `-2.0 EV` to `+2.0 EV` source-exposure slider whose result is identical in CPU preview, WebGL preview, and export.

**Architecture:** Store exposure in `EditSettings` and apply the photographic multiplier `2 ** exposure` immediately after source sampling and before leak, LUT, grain, and vignette. Reuse the existing renderer settings path so preview and export cannot drift; extend the shared range UI only enough to express EV bounds, step, and formatting.

**Tech Stack:** React 19, TypeScript 7, WebGL2 GLSL ES 3.0, Vitest, Testing Library, Playwright, Vite.

## Global Constraints

- Exposure range is exactly `-2.0 EV` through `+2.0 EV`, step `0.1 EV`, default `0 EV`.
- Processing order is source → exposure → light leak → LUT → grain → vignette → output.
- Original selection preserves exposure; Reset restores `0 EV`.
- Filter thumbnails remain at neutral exposure.
- No automatic exposure, histogram, highlight recovery, tone mapping, or per-filter exposure memory.

---

### Task 1: Exposure Data and CPU Pixel Pipeline

**Files:**
- Modify: `src/image/types.ts`
- Modify: `src/image/pixelEffects.ts`
- Modify: `src/image/core.test.ts`
- Modify: `src/image/cpuRenderer.test.ts`

**Interfaces:**
- Consumes: existing `EditSettings` passed to `transformPixels` and `CpuRenderer.render`.
- Produces: `EditSettings.exposure: number`; CPU exposure behavior `channel * 2 ** exposure` before leak/LUT.

- [ ] **Step 1: Write failing pixel tests**

Add literal-fixture tests proving a `[60, 100, 140]` pixel becomes `[120, 200, 255]` at `+1 EV` and `[30, 50, 70]` at `-1 EV`. Add a LUT fixture whose result differs depending on whether exposure happens before lookup, and assert the pre-LUT result.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/image/core.test.ts src/image/cpuRenderer.test.ts`

Expected: TypeScript/test failure because `exposure` is absent or pixel values remain unchanged.

- [ ] **Step 3: Add the setting and CPU computation**

Add `exposure: number` to `EditSettings`, set `DEFAULT_SETTINGS.exposure` to `0`, update typed fixtures, and multiply RGB by `2 ** settings.exposure` immediately after reading source channels.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run src/image/core.test.ts src/image/cpuRenderer.test.ts src/hooks/useEditor.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/image/types.ts src/image/pixelEffects.ts src/image/core.test.ts src/image/cpuRenderer.test.ts src/hooks/useEditor.test.tsx
git commit -m "feat: apply source exposure in CPU pipeline"
```

### Task 2: WebGL Exposure Parity

**Files:**
- Modify: `src/image/shaders.ts`
- Modify: `src/image/webglRenderer.ts`
- Modify: `src/image/renderer.test.ts`

**Interfaces:**
- Consumes: `EditSettings.exposure` from Task 1.
- Produces: GLSL uniform `u_exposure_multiplier` set to `2 ** settings.exposure` for every render.

- [ ] **Step 1: Write a failing renderer test**

Extend the real fake-WebGL boundary assertions to require `uniform1f` for `u_exposure_multiplier` with literal values `1`, `2`, and `0.5` at `0`, `+1`, and `-1 EV`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/image/renderer.test.ts`

Expected: failure because the exposure uniform is never set.

- [ ] **Step 3: Implement the WebGL path**

Declare `uniform float u_exposure_multiplier;`, multiply `source.rgb` before the leak block, and set the uniform with `2 ** settings.exposure` in `WebGlRenderer.render`.

- [ ] **Step 4: Run renderer and pixel tests**

Run: `npx vitest run src/image/renderer.test.ts src/image/core.test.ts`

Expected: all selected tests pass and CPU/WebGL ordering matches.

- [ ] **Step 5: Commit**

```bash
git add src/image/shaders.ts src/image/webglRenderer.ts src/image/renderer.test.ts
git commit -m "feat: apply source exposure in WebGL pipeline"
```

### Task 3: EV Control, Localization, Verification, and Deployment

**Files:**
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/EffectGrids.test.tsx`
- Modify: `src/i18n.tsx`
- Modify: `src/i18n.test.tsx`
- Modify: `e2e/dazz-library.spec.ts`

**Interfaces:**
- Consumes: `EditSettings.exposure` and existing `onChange(EditSettings)`.
- Produces: localized EV slider with `min=-2`, `max=2`, `step=0.1`, and signed output.

- [ ] **Step 1: Write failing UI tests**

Assert the Exposure slider has the exact bounds and step, shows `0 EV`, emits `exposure: 1.2`, survives Original selection, and returns to `0` through the existing reset behavior.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/components/EffectGrids.test.tsx src/i18n.test.tsx src/hooks/useEditor.test.tsx`

Expected: failure because the Exposure control and copy do not exist.

- [ ] **Step 3: Implement the shared range extension and EV control**

Allow `Range` to accept `min`, `max`, `step`, and `formatValue`; default these to the current `0`, `100`, `1`, and numeric output. Render Exposure before filter selection using signed one-decimal EV formatting and add `曝光` / `Exposure` copy.

- [ ] **Step 4: Add browser coverage**

In Playwright, upload the fixture, move Exposure to `+1.0 EV`, select a Dazz variant, and assert both controls remain selected without a page error.

- [ ] **Step 5: Run complete verification**

```bash
npm run test:assets
npm run test:dazz-assets
npm run test:pwa-assets
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: asset suites pass, all Vitest tests pass, production build exits zero, all Chromium/WebKit tests pass, and diff check is empty.

- [ ] **Step 6: Commit and publish the tested head**

```bash
git add src/components/Controls.tsx src/components/EffectGrids.test.tsx src/i18n.tsx src/i18n.test.tsx e2e/dazz-library.spec.ts
git commit -m "feat: add source exposure control"
git push origin HEAD:master
npm run deploy:cloudflare
```

Wait for GitHub Actions, then verify GitHub Pages, Cloudflare Pages, and `film.richis.top` serve the same new bundle and the exposure control is visible.
