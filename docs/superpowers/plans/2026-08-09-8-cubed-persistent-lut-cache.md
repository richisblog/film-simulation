# 8³ Persistent LUT Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one persistent 8³ LUT set power thumbnails, main preview, and export while 36 non-blocking preload tasks report progress and resume only missing items.

**Architecture:** `AssetCatalog` owns one canonical LUT memory/in-flight path and delegates durable compressed-byte storage to a focused Cache Storage adapter. `useEditor` starts preloading on mount and exposes progress to a small accessible UI component; every consumer joins the same canonical LUT promise.

**Tech Stack:** TypeScript 7, React 19, Cache Storage API, Vite/Vitest, Playwright, Node zlib asset generator, Cloudflare Pages.

## Global Constraints

- Every application LUT is an 8³ RGB cube for thumbnail, main preview, and export.
- Start 36 logical preload tasks together; editing remains non-blocking.
- Cache only byte-length-validated compressed LUTs and evict decompression failures.
- Refresh performs no LUT network request for valid cached entries and retries only missing/invalid entries.
- Cache API failure degrades safely to the existing CDN → same-origin transport.
- Background failures stay in progress UI; selected failures keep actionable structured errors.
- No image bytes, asset URLs, local paths, tokens, or personal data enter diagnostics.

---

### Task 1: Generate canonical 8³ assets

**Files:**
- Modify: `scripts/generate-preview-luts.mjs`
- Modify: `scripts/preview-luts.test.mjs`
- Modify: `public/assets/luts/manifest.json`
- Regenerate: `public/assets/luts/8cube-v1/*.rgb.deflate`

**Interfaces:**
- Consumes: `sampleCube(source: Uint8Array, sourceSize: number, previewSize: number): Uint8Array`
- Produces: manifest `preview_cube_size: 8` and deterministic 8³ compressed files.

- [ ] **Step 1: Change the production-manifest assertion to require 8³**

```js
assert.equal(descriptor.preview_cube_size, 8)
assert.equal(inflateSync(bytes).length, 8 ** 3 * 3)
```

- [ ] **Step 2: Run the asset test and verify RED**

Run: `npm run test:assets`
Expected: FAIL because committed descriptors still report `16`.

- [ ] **Step 3: Set `previewSize = 8` and regenerate**

Run: `npm run assets:previews`
Expected: 36 files regenerated and manifest byte lengths updated.

- [ ] **Step 4: Verify GREEN and deterministic output**

Run twice: `npm run assets:previews && npm run test:assets`
Expected: PASS both times and `git diff` is unchanged by the second generation.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-preview-luts.mjs scripts/preview-luts.test.mjs public/assets/luts/manifest.json public/assets/luts/8cube-v1
git commit -m "perf: shrink application LUTs to 8-cube"
```

### Task 2: Add versioned persistent compressed-byte cache

**Files:**
- Create: `src/image/persistentLutCache.ts`
- Create: `src/image/persistentLutCache.test.ts`

**Interfaces:**
- Produces: `LutByteCache` with `get(id, cubeSize, byteLength)`, `put(...)`, `delete(...)`, and `pruneOldVersions()`.
- Produces: `BrowserLutByteCache` using cache name `film-lut-bytes-v1`, synthetic same-origin keys, and a versioned localStorage mirror for browsers that lose Cache Storage across page closure.

- [ ] **Step 1: Write failing cache tests**

```ts
test('returns validated bytes from Cache Storage without network involvement', async () => {
  await cache.put('PT400', 8, bytes.length, bytes)
  expect(await cache.get('PT400', 8, bytes.length)).toEqual(bytes)
})

test('deletes and misses an entry whose byte length is wrong', async () => {
  await rawCache.put(key, new Response(new Uint8Array([1])))
  expect(await cache.get('PT400', 8, 12)).toBeNull()
  expect(await rawCache.match(key)).toBeUndefined()
})
```

Also cover Cache Storage rejection, successful-write loss recovered from localStorage, and deletion of only old `film-lut-bytes-*` cache names/keys.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/image/persistentLutCache.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal adapter**

```ts
export interface LutByteCache {
  get(id: string, cubeSize: number, byteLength: number): Promise<Uint8Array | null>
  put(id: string, cubeSize: number, byteLength: number, bytes: Uint8Array): Promise<void>
  delete(id: string, cubeSize: number, byteLength: number): Promise<void>
  pruneOldVersions(): Promise<void>
}
```

Wrap every Cache Storage operation so unsupported/quota/private-mode failures become misses or no-ops.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/image/persistentLutCache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/image/persistentLutCache.ts src/image/persistentLutCache.test.ts
git commit -m "feat: persist validated LUT bytes locally"
```

### Task 3: Unify every LUT consumer and preload all 36

**Files:**
- Modify: `src/image/catalog.ts`
- Modify: `src/image/catalog.test.ts`
- Modify: `src/image/thumbnailQueue.ts`
- Modify: `src/image/thumbnailQueue.test.ts`

**Interfaces:**
- Consumes: `LutByteCache` from Task 2.
- Produces: `LutPreloadProgress { total, completed, succeeded, failed, active, currentId, percent, done }`.
- Produces: `preloadLuts(onProgress)`, `retryFailedLuts(onProgress)`.
- Preserves: `loadLut`, `loadPreviewLut`, `retryLut`; both load methods now share one 8³ promise and cube.

- [ ] **Step 1: Write failing catalog tests**

```ts
test('full and preview APIs share one 8-cube request and cube', async () => {
  const [main, thumbnail] = await Promise.all([catalog.loadLut('PT400'), catalog.loadPreviewLut('PT400')])
  expect(main).toBe(thumbnail)
  expect(fetcher).toHaveRequestedOnly('luts/8cube-v1/PT400.rgb.deflate')
  expect(main.size).toBe(8)
})

test('preload starts every descriptor together and isolates failures', async () => {
  const pending = catalog.preloadLuts(onProgress)
  expect(fetcher.activeIds()).toHaveLength(36)
  fetcher.resolveAllBut('INSTWARM')
  await pending
  expect(lastProgress).toMatchObject({ total: 36, succeeded: 35, failed: 1, done: true })
})
```

Add tests for persistent hit/no fetch, successful network write, corrupt-decompression eviction, and retry targeting only the failed ID.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/image/catalog.test.ts src/image/thumbnailQueue.test.ts`
Expected: FAIL because paths/caches remain separate, preload methods do not exist, and default queue limit is 2.

- [ ] **Step 3: Implement one canonical load path and progress state**

Use one `lutCache`, one `lutInflight`, descriptor `preview_*` fields, and `Promise.allSettled(ids.map(loadLut))`. Read persistent bytes before `requestAsset`, persist validated network bytes, and delete the persistent entry on decompression failure.

- [ ] **Step 4: Raise thumbnail task concurrency**

```ts
export const THUMBNAIL_CONCURRENCY = 36
export const thumbnailQueue = new TaskQueue(THUMBNAIL_CONCURRENCY)
```

- [ ] **Step 5: Verify GREEN and existing transport behavior**

Run: `npx vitest run src/image/catalog.test.ts src/image/thumbnailQueue.test.ts src/image/assetRequest.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/image/catalog.ts src/image/catalog.test.ts src/image/thumbnailQueue.ts src/image/thumbnailQueue.test.ts
git commit -m "feat: preload and share persistent 8-cube LUTs"
```

### Task 4: Start preload on mount and expose progress UI

**Files:**
- Create: `src/components/LutLoadProgress.tsx`
- Create: `src/components/LutLoadProgress.test.tsx`
- Modify: `src/hooks/useEditor.ts`
- Modify: `src/hooks/useEditor.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: catalog preload APIs and `LutPreloadProgress`.
- Produces: hook fields `lutProgress`, `retryFailedLuts` and accessible `LutLoadProgress`.

- [ ] **Step 1: Write failing hook/UI tests**

```tsx
test('starts non-blocking LUT preload on mount and publishes progress', async () => {
  renderHook(() => useEditor(catalog))
  expect(catalog.preloadLuts).toHaveBeenCalledOnce()
  catalog.emit({ total: 36, completed: 12, succeeded: 11, failed: 1, active: 24, currentId: 'PT400', percent: 33, done: false })
  expect(result.current.lutProgress.completed).toBe(12)
})

test('renders progress and retries failed LUTs', () => {
  render(<LutLoadProgress progress={failedProgress} onRetry={retry} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '35')
  fireEvent.click(screen.getByRole('button', { name: '重试未完成色彩' }))
  expect(retry).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/hooks/useEditor.test.tsx src/components/LutLoadProgress.test.tsx`
Expected: FAIL because preload state/component do not exist.

- [ ] **Step 3: Implement mount preload, retry, and accessible panel**

Load manifests on mount, publish descriptors before preloading completes, guard state updates after unmount, and render the panel at app-shell level so it is visible before and after photo selection.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/hooks/useEditor.test.tsx src/components/LutLoadProgress.test.tsx src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LutLoadProgress.tsx src/components/LutLoadProgress.test.tsx src/hooks/useEditor.ts src/hooks/useEditor.test.tsx src/App.tsx src/styles.css
git commit -m "feat: show resumable LUT preload progress"
```

### Task 5: Browser persistence, partial resume, and export verification

**Files:**
- Modify: `e2e/weak-network.spec.ts`
- Modify: `COMPATIBILITY.md`
- Modify: `docs/CLOUDFLARE_CDN.md`

**Interfaces:**
- Verifies the complete UI/network contract; no new runtime interface.

- [ ] **Step 1: Add failing browser tests**

Test A waits for 36/36, records LUT network requests, reloads the same context, and asserts zero new LUT network requests after manifest load. Test B aborts only `INSTWARM` at both sources, confirms 35/36 plus one failure, removes the route, reloads, and asserts that only `INSTWARM` reaches the network. Test C selects and exports a filter and asserts every LUT URL contains `/luts/8cube-v1/`.

- [ ] **Step 2: Run Chromium and verify RED**

Run: `npx playwright test e2e/weak-network.spec.ts --project=chromium`
Expected: FAIL until persistent storage, resume state, and 8³-only export behavior are integrated.

- [ ] **Step 3: Adjust integration defects only**

Fix production behavior exposed by the browser tests without weakening request assertions or adding test-only production paths.

- [ ] **Step 4: Run all browser projects and documentation checks**

Run: `npm run test:e2e && git diff --check`
Expected: Chromium and WebKit PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/weak-network.spec.ts COMPATIBILITY.md docs/CLOUDFLARE_CDN.md
git commit -m "test: verify persistent 8-cube resume flow"
```

### Task 6: Final verification and deployment

**Files:**
- Verify all changed files and generated output.

**Interfaces:**
- Produces deployed GitHub `master`, Cloudflare Production, and verified `film.richis.top` behavior.

- [ ] **Step 1: Run the complete local gate**

```bash
npm run test:assets
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: all green and only intended commits.

- [ ] **Step 2: Audit concrete requirements**

Confirm 36 manifest entries are 8³, total compressed size, one canonical catalog path, concurrency constant 36, persistent cache version/key validation, monotonic progress, retry-only-failed behavior, and no 64³ browser requests.

- [ ] **Step 3: Push non-force to GitHub master and monitor Actions**

```bash
git push origin codex/weak-network-assets:master
gh run watch <run-id> --repo richisblog/film-simulation --exit-status
```

- [ ] **Step 4: Deploy exact commit to Cloudflare**

Run: `npm run deploy:cloudflare`
Expected: Production deployment source equals `git rev-parse --short HEAD`.

- [ ] **Step 5: Wait for the configured five-minute nginx sync and verify production**

Confirm `film.richis.top` bundle hash, 8³ asset SHA-256, progress UI, 36/36 cache completion, reload with zero LUT network traffic, CDN-blocked same-origin fallback, and partial-failure resume in a real browser context.
