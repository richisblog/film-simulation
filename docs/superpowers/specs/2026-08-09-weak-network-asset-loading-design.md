# Weak-Network Asset Loading Design

**Date:** 2026-08-09

**Status:** Approved

## Goal

Make film selection reliable on slow or intermittently reachable networks without sacrificing personalized thumbnails. The editor must stop downloading full 64³ LUTs for background thumbnails, give the selected effect priority, deduplicate concurrent work, recover from transient failures, support an optional CDN with same-site fallback, and report actionable local diagnostics without adding telemetry.

## Current Failure

The current editor renders personalized filter cards by downloading the same full LUT files used by the main preview. On desktop, the intersection margin can enqueue roughly 18 full LUTs (about 7.75 MiB) when a photo opens, while all 20 light-leak backgrounds are also requested. A selected LUT request can therefore compete with background traffic.

`AssetCatalog.loadLut()` caches only completed `LutCube` objects, so concurrent callers may download and decode the same asset more than once. The 15-second timer wraps only `fetch()`, is cleared as soon as response headers arrive, does not retry, and reduces every abort to a generic timeout message. Thumbnail failures are swallowed, leaving blank cards and little evidence about the failing request stage.

## Selected Approach

Use deterministic 16³ preview LUTs for personalized cards and retain the existing 64³ LUTs for the selected effect and export. A 16³ RGB cube contains 12,288 uncompressed bytes, so all 36 preview cubes are approximately 432 KiB before deflate compression instead of 15.7 MiB of full LUT downloads.

This preserves user-photo thumbnails while separating background preview traffic from interactive full-quality traffic. Static generic WebP thumbnails were rejected because they would be smaller but would no longer preview the user's image. Keeping full LUT thumbnails was rejected because scheduling and CDN changes alone would not remove the excessive first-load payload.

## Asset Generation and Manifest

Create a deterministic Node.js generator that:

1. Inflates each committed 64³ LUT.
2. Samples 16 evenly distributed coordinates per channel, including source coordinates 0 and 63.
3. Writes a zlib-deflated 16³ RGB cube under `public/assets/luts/previews/`.
4. Adds `preview_asset`, `preview_cube_size`, and `preview_byte_length` to every LUT descriptor.
5. Produces byte-identical output across repeated runs.

Generated preview LUTs remain committed so GitHub Pages, nginx, and Cloudflare builds do not depend on runtime generation. The generator and verification test prevent the committed assets and manifest from drifting.

## Loading Architecture

`AssetCatalog` exposes two distinct operations:

- `loadPreviewLut(id, options?)` loads the 16³ asset for a filter card.
- `loadLut(id, options?)` loads the full 64³ asset for the selected filter and export.

Successful decoded cubes use separate bounded caches. In-flight byte/decode Promises are cached by resolved asset identity and removed when they settle. Concurrent callers for the same asset therefore share one request and one decompression operation.

Filter-card tasks continue through a two-worker background queue. The queue returns a cancellable task handle; work that has not started is removed when its component leaves the preload window or its photo changes. An active preview download is allowed to finish because the small asset may be reused, while cancelled consumers do not render stale pixels.

The selected full LUT bypasses the preview queue. Because preview assets are small and limited to two concurrent transfers, interactive selection no longer waits behind multi-megabyte thumbnail work.

## CDN and Fallback

The build accepts `VITE_ASSET_BASE_URL` as an optional absolute asset root. Manifests stay with the application so descriptors always match the deployed app version. Binary LUT and light-leak requests use this ordered candidate list:

1. `VITE_ASSET_BASE_URL`, when configured.
2. The application's same-origin `./assets` root.

Duplicate normalized candidates are removed. Two automatic attempts are made in total: CDN then same-origin when both exist, or two same-origin attempts when no CDN is configured. A short fixed delay separates attempts. Any CDN transport or compressed-length failure may fall back to the distinct same-origin source. A same-origin HTTP 4xx, decompression failure, or unsupported-browser failure stops immediately; network errors, HTTP 5xx, and timeouts retry while an attempt remains.

The service worker runtime route must cache eligible `/assets/` responses from either origin and must not cache failed responses. The cache name is versioned for this asset layout change.

The repository provides a Cloudflare deployment path and exact configuration documentation. The preferred no-storage deployment is Cloudflare Pages serving the same `dist` artifact, with an optional custom asset subdomain. The app remains functional when Cloudflare is unavailable because same-origin assets remain packaged and are always the final candidate. Actual Cloudflare publication requires account authorization and cannot be claimed complete unless the deployment command returns a live URL.

`film.richis.top` currently serves assets through nginx with a seven-day cache. The documentation preserves that origin as the fallback and explains DNS, CORS, cache, build-variable, and rollback settings. Ordinary Cloudflare global service is described as global acceleration, not guaranteed mainland-China infrastructure.

## Retry, Timeout, and Diagnostics

Each automatic attempt has a 20-second deadline covering both response headers and complete body consumption. The abort controller remains active until the response bytes have been read. Two failed attempts therefore have a bounded worst-case wait of roughly 40 seconds plus the retry delay.

An `AssetLoadError` records:

- asset kind and public effect ID;
- failure category: `timeout`, `network`, `http`, `integrity`, `decompression`, or `unsupported`;
- source label (`CDN` or `本站`), attempt count, HTTP status when available, and elapsed milliseconds;
- a concise user-facing Chinese message and a structured local diagnostic object.

The UI logs the structured diagnostic with `console.error` and shows a concise toast. It does not transmit diagnostics. The selected-effect toast includes a `重试` action that repeats the current selection through an explicit retry generation even when the ID has not changed. Retry clears only the relevant error and failed in-flight state; it does not reset edits or reload the photo.

Thumbnail failures render a visible neutral fallback state instead of disappearing silently, but they do not open a global toast. This prevents 36 background failures from obscuring the user's selected-effect error.

## Components and Boundaries

- `scripts/generate-preview-luts.mjs`: deterministic preview-asset generation only.
- `src/config/assets.ts`: normalize the configured CDN and same-origin candidate roots.
- `src/image/assetRequest.ts`: complete-body deadline, attempt policy, fallback, structured errors, and local timing diagnostics.
- `src/image/catalog.ts`: manifests, decoded caches, and in-flight request deduplication.
- `src/image/thumbnailQueue.ts`: cancellable, bounded background scheduling.
- `src/components/LutThumbnail.tsx`: preview LUT loading and neutral failure presentation.
- `src/hooks/useEditor.ts`: selected-LUT retry generation and selected error ownership.
- `src/components/ErrorToast.tsx`: accessible message, diagnostic summary, close, and retry controls.
- `vite.config.ts`: build-time asset root exposure and cross-origin Workbox runtime caching.
- Cloudflare configuration and deployment documentation: optional acceleration with same-origin rollback.

Each unit has one purpose and can be tested without rendering the entire application.

## Test Strategy

Follow red-green TDD for every behavioral change.

Unit tests must prove:

- preview generation creates valid 16³ cubes, includes both endpoints, and is deterministic;
- all manifest entries reference present preview files with matching lengths;
- preview cards call `loadPreviewLut`, never the full `loadLut` path;
- concurrent calls for one asset perform one fetch and return the same decoded cube;
- selected full LUT loading is independent of the preview queue;
- queued preview work can be cancelled before it starts;
- the deadline remains active while the response body is pending;
- a transient timeout/network/5xx failure retries or falls back and succeeds;
- non-retryable integrity/decompression/unsupported failures stop immediately;
- diagnostics contain the category, source, attempt, status, and elapsed time without photo data;
- clicking `重试` reloads the currently selected LUT without changing editor settings;
- CDN candidates normalize correctly and always retain same-origin fallback.

Browser-level verification must simulate a failed or delayed CDN request, observe same-origin recovery, select a full LUT while thumbnails are loading, and confirm that the selected effect renders. The final gate runs the full unit suite, production build, and Playwright suite.

## Success Criteria

1. Opening a photo downloads only 16³ LUTs for personalized filter cards; no full LUT downloads occur until selection.
2. Selecting a LUT initiates its full asset immediately and never waits in the thumbnail queue.
3. Concurrent requests for the same asset produce one network transfer.
4. A retryable first-source failure automatically recovers through the second attempt/source.
5. A final selected-effect failure presents a classified local diagnostic and working retry action.
6. The site works with no CDN configuration and continues working when the configured CDN is unavailable.
7. Cloudflare deployment configuration is reproducible; live deployment status is reported truthfully according to available authorization.
8. No photo, filename, diagnostics, or usage event is uploaded by the application.

## Non-Goals

- Adding analytics, remote error reporting, accounts, or a backend API.
- Guaranteeing mainland-China latency through ordinary Cloudflare global service.
- Migrating the existing US nginx origin or changing the image-rendering pipeline.
- Prefetching every full LUT for offline use.
