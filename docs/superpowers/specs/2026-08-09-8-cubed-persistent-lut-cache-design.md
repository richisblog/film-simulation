# 8³ Persistent LUT Cache Design

## Objective

Use one lightweight 8³ LUT per film simulation for thumbnails, the main preview, and export. Start all 36 LUT loads together, retain every successful LUT locally, resume only missing or invalid entries after refresh, and expose useful loading progress without blocking editing.

## Decisions

- The committed `preview_asset` files become 8³ cubes. Existing 64³ source files remain in the repository for deterministic regeneration, but the browser never requests them during editing or export.
- `loadLut` and `loadPreviewLut` resolve through one canonical 8³ cache and one in-flight map. A single LUT cannot be downloaded or decompressed twice concurrently.
- Export deliberately uses the same 8³ cube shown in the main preview. There is no late 64³ quality upgrade.
- All 36 preload promises start immediately after the same-origin manifest loads. This is an application concurrency limit of 36; the browser and HTTP/2 transport still control socket scheduling.
- Preloading is non-blocking. Successfully loaded filters are usable immediately. Missing filters continue in the background, and selecting one joins its existing in-flight request.

## Persistent Storage

Use the browser Cache Storage API through a small adapter and mirror the same small payload into localStorage as a Safari-compatible fallback. Each successful compressed LUT is stored under a versioned key containing:

- cache schema version;
- cube size (`8`);
- LUT ID;
- manifest compressed byte length.

Before returning a cached entry, validate its byte length. An absent or invalid entry is deleted and fetched through the existing ordered CDN → same-origin transport. Store bytes only after the network response passes the manifest length check. If decompression fails, evict that entry so the next attempt cannot repeat a corrupt cached payload.

Reads prefer Cache Storage and fall back to the localStorage Base64 copy. The complete fallback payload is only about 62 KB. If either storage API is unavailable or throws (private-mode or quota conditions), the other remains usable; if both fail, the app degrades to memory/network behavior. Storage failures do not prevent editing and do not replace the existing safe network diagnostic.

Changing the cache schema, cube size, or manifest byte length creates a new key. On startup, delete older application-owned LUT cache versions; do not touch unrelated browser caches.

## Loading and Progress Model

`AssetCatalog.preloadLuts` loads the manifest, launches all 36 canonical LUT requests, and emits immutable progress snapshots:

- `total`;
- `completed`;
- `succeeded`;
- `failed`;
- `active`;
- `currentId`, the most recently settled LUT;
- `percent`, derived from completed / total;
- `done`.

Progress counts cache hits as successful completions because they are ready for use, while the persistent-cache adapter exposes whether network access occurred for tests and diagnostics. A refresh revisits the 36 logical items but performs network requests only for missing or invalid entries.

Failures are isolated: one rejection does not cancel the other 35. The progress UI shows the failed count and offers “retry failed items”; a refresh naturally performs the same resume operation. Selecting a failed LUT continues to use the existing actionable error toast and retry flow.

## UI

Show a compact LUT loading panel on both the empty page and editing page while work is active or failures remain. It includes:

- `正在准备胶片色彩` while loading;
- `已完成 X / 36` and percentage;
- a native/accessible progress bar;
- the most recently completed LUT display name;
- success and failure counts;
- a retry button when failures remain;
- `胶片色彩已就绪（36 / 36）` briefly/steadily after completion.

The panel uses `role="status"` with polite announcements and a labelled `progress` element. It never blocks photo selection, controls, or export.

## Data Flow

1. `useEditor` loads manifests on mount and publishes descriptors immediately.
2. It starts `preloadLuts` once and updates React state from progress snapshots.
3. Catalog requests a canonical 8³ LUT.
4. Memory cache → in-flight map → persistent cache are checked in that order.
5. On a miss, existing CDN/same-origin transport fetches and validates compressed bytes.
6. Bytes are persisted, decompressed, and placed in the bounded memory cache.
7. Thumbnail, main preview, and export all share the same `LutCube` instance path.

## Error Handling

- Background failures update progress rather than producing 36 global toasts.
- A user-selected LUT failure still produces the existing structured `AssetLoadError` and retry action.
- Persistent cache read/write/delete failures are treated as cache misses and logged only with a safe category; URLs, image data, and local paths are never logged.
- Retry clears failed in-memory state but retains valid successful entries.

## Tests and Acceptance

- Generator test proves every committed preview cube is 8³ and deterministic.
- Persistent-cache tests prove hit-without-network, invalid-entry eviction, successful dual write, Cache Storage loss with localStorage recovery, decompression eviction, and graceful unavailable-storage fallback.
- Catalog tests prove preview/full APIs share one request and one cube; no 64³ asset is requested.
- Preload tests prove 36 tasks start without a queue bottleneck, progress is monotonic, failures are isolated, and retry targets only failures.
- Hook/UI tests prove preload starts on mount and the accessible progress/retry states render.
- Browser tests prove all application LUT requests use 8³ assets, export does not request 64³, reload issues no LUT network requests for completed entries, and partial failure reload requests only the missing entry.
- Run asset tests, unit tests, production build, Chromium and WebKit tests, then deploy the exact commit to GitHub and Cloudflare and verify `film.richis.top` after its five-minute sync.

## Alternatives Rejected

- Service Worker cache alone: insufficient application-level completion/resume visibility and harder corruption recovery.
- IndexedDB: workable but adds database schema and transaction complexity; a roughly 62 KB localStorage mirror is sufficient for Safari fallback.
- 4³ cubes: smaller, but only 64 color samples and materially higher risk of visible banding. 8³ is already eight times smaller than 16³ before compression.
