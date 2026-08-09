# Weak-Network Asset Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make personalized filter previews lightweight and make selected LUT loading resilient through priority separation, request deduplication, bounded retry/fallback, actionable diagnostics, and optional Cloudflare delivery.

**Architecture:** Generate committed 16³ preview LUTs for background cards while retaining 64³ assets for selected effects. Move binary transport into a focused retry/fallback module, let `AssetCatalog` deduplicate decoded in-flight work, and keep interactive loads outside a cancellable two-worker thumbnail queue. Configure an optional CDN at build time while always retaining packaged same-origin assets.

**Tech Stack:** React 19, TypeScript 7, Vite 7, Vitest 4, Playwright 1.62, Node.js 22 zlib, vite-plugin-pwa/Workbox, optional Cloudflare Pages/Wrangler.

## Global Constraints

- Preserve personalized thumbnails based on the user's selected photo.
- Use 16³ preview LUTs and 64³ selected/export LUTs.
- Make at most two automatic binary download attempts with a 20-second complete-body deadline per attempt.
- Try `VITE_ASSET_BASE_URL` first when configured and packaged same-origin assets last.
- Do not upload photos, filenames, diagnostics, or usage events.
- Do not require a CDN for correctness or offline repeat use.
- Treat live Cloudflare deployment as complete only when an authorized deploy command returns a live URL.

---

### Task 1: Deterministic 16³ Preview Assets

**Files:**
- Create: `scripts/preview-luts.mjs`
- Create: `scripts/generate-preview-luts.mjs`
- Create: `scripts/preview-luts.test.mjs`
- Create: `public/assets/luts/previews/*.rgb.deflate`
- Modify: `public/assets/luts/manifest.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `sampleCube(source: Uint8Array, sourceSize: number, previewSize: number): Uint8Array`.
- Produces: each manifest LUT descriptor includes `preview_asset`, `preview_cube_size`, and `preview_byte_length`.
- Produces: `npm run assets:previews` and `npm run test:assets`.

- [ ] **Step 1: Write the failing generator test**

Test a synthetic 4³ cube downsampled to 2³. Assert output length is `2 * 2 * 2 * 3`, sampled source coordinates are `[0, 3]`, both endpoints are preserved, and two generator runs produce identical compressed bytes. Read the production manifest and assert all 36 descriptors have preview metadata and existing files of the declared size.

- [ ] **Step 2: Run the asset test and verify RED**

Run: `node --test scripts/preview-luts.test.mjs`

Expected: FAIL because `scripts/preview-luts.mjs` and preview descriptor fields do not exist.

- [ ] **Step 3: Implement deterministic sampling and generation**

Use `node:zlib` `inflateSync`/`deflateSync`, with source coordinate:

```js
const sourceIndex = Math.round(previewIndex * (sourceSize - 1) / (previewSize - 1))
const offset = (red + green * size + blue * size * size) * 3
```

Write preview paths as `previews/<ID>.rgb.deflate`, set `preview_cube_size: 16`, set the exact compressed length, and preserve the rest of every descriptor.

- [ ] **Step 4: Generate assets and verify GREEN**

Run: `npm run assets:previews && npm run test:assets`

Expected: PASS; 36 preview assets exist and their combined size is below 1 MiB.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json package-lock.json public/assets/luts/manifest.json public/assets/luts/previews
git commit -m "perf: add lightweight preview LUT assets"
```

### Task 2: Asset Roots, Complete-Body Deadlines, Fallback, and Diagnostics

**Files:**
- Create: `src/config/assets.ts`
- Create: `src/config/assets.test.ts`
- Create: `src/image/assetRequest.ts`
- Create: `src/image/assetRequest.test.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces: `assetRoots(configured?: string, sameOrigin?: string): AssetRoot[]`, where `AssetRoot` is `{ base: string; label: 'CDN' | '本站' }`.
- Produces: `requestAsset(path: string, options: AssetRequestOptions): Promise<Uint8Array>`.
- Produces: `AssetLoadError` with `category`, `assetKind`, `effectId`, `source`, `attempt`, `status`, `elapsedMs`, `message`, and `diagnostic`.

- [ ] **Step 1: Write failing root-normalization tests**

Assert an absolute CDN root is first, `./assets` is last, trailing slashes normalize, and a configured root resolving to same-origin is deduplicated.

- [ ] **Step 2: Run root tests and verify RED**

Run: `npm test -- src/config/assets.test.ts`

Expected: FAIL because `assetRoots` does not exist.

- [ ] **Step 3: Implement asset root normalization**

Read `import.meta.env.VITE_ASSET_BASE_URL` only at the configuration boundary. Return stable labels and preserve relative same-origin URLs for GitHub project paths.

- [ ] **Step 4: Run root tests and verify GREEN**

Run: `npm test -- src/config/assets.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing transport tests**

Cover these real observable behaviors separately:

1. A response whose headers arrive but whose body never resolves is aborted at the deadline.
2. A network failure on CDN falls back to same-origin and returns bytes.
3. CDN HTTP 404 and HTTP 503 fall back to same-origin; a same-origin HTTP 404 stops immediately.
4. With one root, a transient failure performs exactly two attempts.
5. Final errors classify timeout/network/http and expose source, attempt, status, and elapsed time without request body or file metadata.

Inject `fetcher`, `timeoutMs`, `delay`, and `now` through `AssetRequestOptions` so tests use short real deadlines or deterministic clocks rather than production waits.

- [ ] **Step 6: Run transport tests and verify RED**

Run: `npm test -- src/image/assetRequest.test.ts`

Expected: FAIL because the transport module does not exist.

- [ ] **Step 7: Implement the minimal request pipeline**

Keep the abort timer alive through `await response.arrayBuffer()`. Limit attempts to two total, delay retryable failures briefly, allow any failed CDN candidate to fall back to the distinct same-origin candidate, stop on a same-origin HTTP 4xx, and throw an `AssetLoadError` containing a safe diagnostic object. Accept `expectedByteLength` so a truncated CDN response also falls back before catalog decoding.

- [ ] **Step 8: Run transport tests and verify GREEN**

Run: `npm test -- src/config/assets.test.ts src/image/assetRequest.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/config src/image/assetRequest.ts src/image/assetRequest.test.ts src/vite-env.d.ts
git commit -m "feat: add resilient asset transport"
```

### Task 3: Preview/Full Catalog Separation and In-Flight Deduplication

**Files:**
- Modify: `src/image/catalog.ts`
- Modify: `src/image/catalog.test.ts`

**Interfaces:**
- Consumes: `requestAsset()` and manifest preview descriptor fields.
- Produces: `loadPreviewLut(id: string): Promise<LutCube>`.
- Preserves: `loadLut(id: string): Promise<LutCube>` and `loadLeak(id: string): Promise<HTMLImageElement>`.
- Produces: `retryLut(id: string): Promise<LutCube>` or an equivalent explicit failed-state reset used by the editor retry action.

- [ ] **Step 1: Write failing catalog tests for preview separation**

Use a manifest with distinct `TEST.preview.rgb` and `TEST.full.rgb` entries. Assert `loadPreviewLut('TEST')` requests only the preview asset and returns the preview cube size; `loadLut('TEST')` requests only the full asset and returns the full cube size.

- [ ] **Step 2: Run the separation test and verify RED**

Run: `npm test -- src/image/catalog.test.ts`

Expected: FAIL because `loadPreviewLut` does not exist.

- [ ] **Step 3: Implement separate preview and full decoded caches**

Route both methods through the transport module, validate compressed byte length before decompression, validate decompressed cube size in `LutCube`, and convert integrity/decompression/unsupported failures to classified `AssetLoadError` values.

- [ ] **Step 4: Run the separation test and verify GREEN**

Run: `npm test -- src/image/catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Write a failing concurrent-deduplication test**

Start two `loadLut('TEST')` calls before resolving the fake fetch body. Assert the fetcher is called once and both callers receive the same `LutCube` instance. Repeat for preview LUTs. Add a rejected in-flight case and assert a later retry can issue a new request.

- [ ] **Step 6: Run the deduplication test and verify RED**

Run: `npm test -- src/image/catalog.test.ts`

Expected: FAIL with two binary requests.

- [ ] **Step 7: Implement settled-cleanup in-flight maps**

Store decoded Promises by preview/full asset key before awaiting them. Remove them in `finally`; retain only successful decoded values in bounded caches. Ensure retry invalidates the selected decoded entry and any rejected in-flight state without touching editor settings.

- [ ] **Step 8: Run catalog tests and verify GREEN**

Run: `npm test -- src/image/catalog.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/image/catalog.ts src/image/catalog.test.ts
git commit -m "feat: separate and deduplicate LUT loading"
```

### Task 4: Cancellable Background Queue and Explicit Thumbnail Failure State

**Files:**
- Modify: `src/image/thumbnailQueue.ts`
- Modify: `src/image/thumbnailQueue.test.ts`
- Modify: `src/components/LutThumbnail.tsx`
- Modify: `src/components/LutThumbnail.test.tsx`
- Modify: `src/components/FilmStrip.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `TaskHandle<T> = { promise: Promise<T>; cancel(): void }` from `TaskQueue.add()`.
- Consumes: `loadPreviewLut(id)` in cards; the selected-effect path continues to use `loadLut(id)` directly.

- [ ] **Step 1: Write a failing pending-cancellation queue test**

Fill a one-worker queue, enqueue a second task, call `cancel()` on the second handle, release the first, and assert the second task never starts and rejects with a recognizable cancellation error.

- [ ] **Step 2: Run the queue test and verify RED**

Run: `npm test -- src/image/thumbnailQueue.test.ts`

Expected: FAIL because `add()` returns only a Promise and cannot cancel.

- [ ] **Step 3: Implement the cancellable task handle**

Represent pending entries explicitly, remove or mark a pending entry cancelled, preserve the concurrency limit after resolve/reject, and keep cancellation idempotent.

- [ ] **Step 4: Run queue tests and verify GREEN**

Run: `npm test -- src/image/thumbnailQueue.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing thumbnail tests**

Assert a visible card calls `loadPreviewLut('PT400')`, never a full-LUT callback; unmounting before the queued task starts cancels it; and a rejected preview adds an accessible neutral failure marker while retaining the canvas and clickable parent card.

- [ ] **Step 6: Run thumbnail tests and verify RED**

Run: `npm test -- src/components/LutThumbnail.test.tsx`

Expected: FAIL because the component still consumes `loadLut` and swallows failure.

- [ ] **Step 7: Implement preview loading and failure presentation**

Rename props through `FilmStrip` and `Controls`, cancel the returned task handle in effect cleanup, ignore the expected cancellation error, set a `failed` state for real failures, and style a low-contrast `预览不可用` overlay without opening the global toast.

- [ ] **Step 8: Run component and queue tests and verify GREEN**

Run: `npm test -- src/image/thumbnailQueue.test.ts src/components/LutThumbnail.test.tsx src/components/EffectGrids.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/image/thumbnailQueue.ts src/image/thumbnailQueue.test.ts src/components/LutThumbnail.tsx src/components/LutThumbnail.test.tsx src/components/FilmStrip.tsx src/components/Controls.tsx src/styles.css
git commit -m "perf: prioritize selected LUT over previews"
```

### Task 5: Selected-Effect Retry and Actionable Error Toast

**Files:**
- Create: `src/components/ErrorToast.tsx`
- Create: `src/components/ErrorToast.test.tsx`
- Modify: `src/hooks/useEditor.ts`
- Create: `src/hooks/useEditor.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `AssetLoadError` safe diagnostic and catalog retry operation.
- Produces from `useEditor`: `error: EditorError | null`, `retryError(): void`, and existing `setError` compatibility for non-asset operations.
- Produces: `<ErrorToast error onClose onRetry?>`.

- [ ] **Step 1: Write a failing ErrorToast behavior test**

Render a timeout diagnostic and assert role `alert`, concise Chinese category/source/attempt content, close button, and `重试` button. Click retry and assert the callback once. Render a non-retryable error and assert no retry button.

- [ ] **Step 2: Run toast tests and verify RED**

Run: `npm test -- src/components/ErrorToast.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the accessible toast**

Keep technical detail collapsible or secondary, use button labels readable by assistive technology, and never render URLs containing query data or local file metadata.

- [ ] **Step 4: Run toast tests and verify GREEN**

Run: `npm test -- src/components/ErrorToast.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write a failing editor retry test**

Render a hook harness with a fake catalog. Select a LUT, reject its first load, invoke `retryError`, resolve the second load, and assert the same selected ID and all other settings remain unchanged while the catalog is called again.

- [ ] **Step 6: Run the hook test and verify RED**

Run: `npm test -- src/hooks/useEditor.test.tsx`

Expected: FAIL because the hook has no explicit retry generation/action.

- [ ] **Step 7: Implement retry generation and structured error ownership**

Add a retry counter to the selected-LUT effect dependency, call the catalog invalidation/retry path, log only `AssetLoadError.diagnostic` with `console.error`, and preserve the existing request-generation stale-result guard.

- [ ] **Step 8: Integrate the toast into App and verify GREEN**

Replace the inline toast markup with `ErrorToast`. Run:

`npm test -- src/hooks/useEditor.test.tsx src/components/ErrorToast.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ErrorToast.tsx src/components/ErrorToast.test.tsx src/hooks/useEditor.ts src/hooks/useEditor.test.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add actionable LUT retry diagnostics"
```

### Task 6: PWA/CDN Configuration and Cloudflare Deployment Path

**Files:**
- Modify: `vite.config.ts`
- Create: `src/config/pwaCache.ts`
- Create: `src/config/pwaCache.test.ts`
- Create: `.env.example`
- Create: `wrangler.jsonc`
- Create: `docs/CLOUDFLARE_CDN.md`
- Modify: `README.md`
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: optional `VITE_ASSET_BASE_URL` at build time.
- Produces: `npm run deploy:cloudflare` for an authorized manual deployment.
- Produces: GitHub Actions build support for repository variable `VITE_ASSET_BASE_URL` without requiring it.

- [ ] **Step 1: Write a failing build-configuration assertion**

Add a focused config test or exported helper proving cross-origin URLs whose pathname begins with `/assets/` match runtime caching, unrelated URLs do not, and the cache name is `film-effects-v2`.

- [ ] **Step 2: Run the config test and verify RED**

Run: `npm test -- src/config/pwaCache.test.ts`

Expected: FAIL because the exported matcher does not exist.

- [ ] **Step 3: Implement cross-origin runtime caching**

Use a callback matcher based on `url.pathname`, cache only successful responses, retain a 64-entry/one-year runtime cache, and keep binary assets out of the install precache.

- [ ] **Step 4: Run the config test and verify GREEN**

Run: `npm test -- src/config/pwaCache.test.ts`

Expected: PASS.

- [ ] **Step 5: Add reproducible Cloudflare Pages configuration**

Configure the `dist` directory as static assets, document `npx wrangler login`, build, deploy, custom asset-domain mapping, CORS, cache rules, Aliyun DNS delegation/CNAME choices, fallback verification, and rollback. Do not embed tokens or account IDs. Pass the optional GitHub Actions repository variable into `npm run build`.

- [ ] **Step 6: Verify build configuration**

Run: `npm run build`

Expected: PASS and `dist/assets/luts/previews/` contains 36 preview files while full assets remain packaged.

- [ ] **Step 7: Probe Cloudflare authorization without mutating deployment**

Run: `npx wrangler whoami`

Expected: either an authenticated account (then an authorized deploy may proceed) or an explicit unauthenticated result recorded in the handoff. Do not claim a live CDN URL from configuration alone.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts src/config/pwaCache.ts src/config/pwaCache.test.ts .env.example wrangler.jsonc docs/CLOUDFLARE_CDN.md README.md .github/workflows/deploy.yml package.json package-lock.json
git commit -m "feat: add optional Cloudflare asset delivery"
```

### Task 7: Browser Recovery Verification and Full Completion Audit

**Files:**
- Create: `e2e/asset-loading.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `COMPATIBILITY.md`

**Interfaces:**
- Verifies the complete user-visible data flow; produces no new application interface.

- [ ] **Step 1: Write the failing browser test**

Use Playwright request routing and an in-memory PNG upload. Record LUT requests and assert:

1. opening a photo requests preview LUT paths but no full LUT path;
2. clicking a card issues its full LUT request while preview requests are still controlled;
3. a configured CDN failure falls back to same-origin and the selected effect renders without a global error;
4. when both attempts fail, the toast shows a classified message and clicking `重试` issues a new full-LUT request.

- [ ] **Step 2: Run the browser test and verify RED**

Run: `npx playwright test e2e/asset-loading.spec.ts --project=chromium`

Expected: FAIL against pre-change behavior because full LUTs are used for thumbnails and no retry action exists.

- [ ] **Step 3: Make only testability corrections required by real browser behavior**

Adjust stable accessible labels or environment injection without weakening assertions. Do not add test-only production branches.

- [ ] **Step 4: Run browser verification and verify GREEN**

Run: `npx playwright test e2e/asset-loading.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 5: Run the complete verification gate**

Run:

```bash
npm run test:assets
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0 with no failing test, build error, or whitespace error.

- [ ] **Step 6: Audit every success criterion**

Inspect the generated manifest and file sizes, transport and catalog tests, browser request log assertions, retry UI test, built Workbox output/config, Cloudflare authorization result, `git status`, and final diff. Record any external deployment limitation explicitly rather than redefining it as complete.

- [ ] **Step 7: Commit**

```bash
git add e2e/asset-loading.spec.ts playwright.config.ts COMPATIBILITY.md
git commit -m "test: verify weak-network asset recovery"
```
