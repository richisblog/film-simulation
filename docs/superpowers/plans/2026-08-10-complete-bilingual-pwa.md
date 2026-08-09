# Complete Bilingual UI and PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete PR #1 so Chinese and English users receive fully consistent UI, errors, analytics titles, metadata, and installable PWA identity without regressing existing rendering, caching, privacy, or export behavior.

**Architecture:** Preserve PR #1 commits, then centralize locale selection and typed copy in the existing language provider. Localize structured errors at the presentation boundary, keep analytics grouping paths language-neutral while localizing titles, and switch between two static localized manifests while sharing one service worker and asset cache.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite 7, vite-plugin-pwa, Workbox, Playwright, GoatCounter, Sharp, GitHub Pages, Cloudflare Pages.

## Global Constraints

- Active languages are exactly `zh-CN` and `en`.
- Persisted explicit choice wins; otherwise browser languages beginning with `zh` select Chinese and all others select English.
- Chinese surfaces contain Chinese copy and English surfaces contain English copy, except technical standards, product names, filter IDs, filenames, and file formats.
- GoatCounter paths stay `export-filter-<LUT_ID>` or `export-filter-NONE`; only event titles are localized.
- Analytics never includes photos, filenames, image metadata, adjustment values, or personal identifiers.
- Chinese and English PWA manifests share scope, start URL, icons, service worker, and caches.
- Existing 8-cube LUT persistence, 36-way preload, CDN fallback, export, privacy, and analytics-failure isolation behavior must remain unchanged.
- No incomplete intermediate PR state may be pushed to `master`.

---

### Task 1: Preserve and establish the PR baseline

**Files:**
- Replay unchanged commits: `718b475cbb1ff632887651f25a2903930885e60d`, `aa86aa7d88382488ad41937d0cfca8dbfdde1d14`
- Verify: all PR-modified source, icons, and tests

**Interfaces:**
- Produces the contributor-authored `LanguageProvider`, `useLanguage`, `InstallPrompt`, localized component call sites, and PWA icons that later tasks correct.

- [ ] **Step 1: Replay the original commits without squashing**

```bash
git cherry-pick 718b475cbb1ff632887651f25a2903930885e60d aa86aa7d88382488ad41937d0cfca8dbfdde1d14
```

- [ ] **Step 2: Verify the exact replayed state**

Run: `npm test && npm run test:assets && npm run build && npm run test:e2e`

Expected: 90 unit tests, 4 asset tests, 10 browser tests, and production build pass; this characterizes the contribution before corrections.

### Task 2: Deterministic locale selection and document identity

**Files:**
- Modify: `src/i18n.tsx`
- Create: `src/i18n.test.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces `resolveInitialLanguage(stored: string | null, browserLanguages: readonly string[]): Language`.
- Produces `manifestHref(language: Language): string`.
- `LanguageProvider` consumes optional browser/localStorage globals and synchronizes document metadata.

- [ ] **Step 1: Write failing locale resolution tests**

```ts
expect(resolveInitialLanguage(null, ['zh-HK', 'en-US'])).toBe('zh-CN')
expect(resolveInitialLanguage(null, ['fr-FR', 'en-US'])).toBe('en')
expect(resolveInitialLanguage('en', ['zh-CN'])).toBe('en')
expect(resolveInitialLanguage('invalid', ['zh-CN'])).toBe('zh-CN')
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- src/i18n.test.tsx`

Expected: FAIL because `resolveInitialLanguage` and `manifestHref` are not exported.

- [ ] **Step 3: Implement deterministic selection**

```ts
export function resolveInitialLanguage(stored: string | null, browserLanguages: readonly string[]): Language {
  if (stored === 'zh-CN' || stored === 'en') return stored
  return browserLanguages.some((value) => value.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en'
}

export function manifestHref(language: Language): string {
  return language === 'zh-CN' ? './manifest-zh.webmanifest' : './manifest-en.webmanifest'
}
```

Initialize from `navigator.languages` with `[navigator.language]` fallback. Continue to work when storage access throws.

- [ ] **Step 4: Write failing metadata synchronization tests**

Render the provider with a real `<meta name="description">`, `<meta name="apple-mobile-web-app-title">`, and `<link rel="manifest">`; switch to English and assert literal `lang`, title, descriptions, Apple title, and `./manifest-en.webmanifest` values.

- [ ] **Step 5: Run the metadata test and verify RED**

Run: `npm test -- src/i18n.test.tsx`

Expected: FAIL because the PR does not update the manifest link and defaults all first visits to Chinese.

- [ ] **Step 6: Implement metadata synchronization and storage-failure fallback**

Update the existing provider effect so all five document surfaces change atomically, and only explicit or resolved valid language values are persisted.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/i18n.test.tsx src/App.test.tsx`

```bash
git add src/i18n.tsx src/i18n.test.tsx src/App.test.tsx
git commit -m "feat: resolve and persist the complete UI language"
```

### Task 3: Structured bilingual user-facing errors

**Files:**
- Create: `src/i18n/errors.ts`
- Create: `src/i18n/errors.test.ts`
- Modify: `src/components/ErrorToast.tsx`
- Modify: `src/components/ErrorToast.test.tsx`
- Modify: `src/components/Preview.tsx`
- Modify: `src/hooks/useEditor.ts`

**Interfaces:**
- Produces `localizedError(error: unknown, language: Language): string`.
- Consumes `AssetLoadError` structured fields without parsing its Chinese message.
- Unknown errors resolve to a localized generic message; detailed errors remain console-only.

- [ ] **Step 1: Write literal table-driven failing tests for structured errors**

```ts
expect(localizedError(new AssetLoadError('timeout', 'lut', 'INSTWARM', 'CDN', 2, undefined, 20_001), 'en'))
  .toBe('Timed out downloading INSTWARM (CDN, attempt 2).')
expect(localizedError(new AssetLoadError('http', 'leak', '12', '本站', 1, 503, 10), 'zh-CN'))
  .toBe('素材服务返回 HTTP 503：12（本站，第 1 次）')
expect(localizedError(new Error('内部未知错误'), 'en')).toBe('Something went wrong. Please try again.')
```

Cover timeout, network, HTTP, integrity, decompression, unsupported, HEIC, corrupt photo, export encoding, unsupported export MIME, renderer size, and unknown failures in both languages.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/i18n/errors.test.ts`

Expected: FAIL because the structured localizer does not exist.

- [ ] **Step 3: Implement structured localization**

Use `instanceof AssetLoadError` plus category switches. Recognize stable known browser errors through dedicated predicates/patterns; never return an unknown original message in the opposite language.

- [ ] **Step 4: Write failing presentation tests**

Render `ErrorToast` in an English provider with an `AssetLoadError` and assert the complete English alert, retry button, and stage text. Render an unknown Chinese `Error` in English and assert no CJK characters appear in the alert.

- [ ] **Step 5: Run the presentation tests and verify RED**

Run: `npm test -- src/components/ErrorToast.test.tsx`

Expected: FAIL because the PR's `localizeErrorMessage` falls back to the untranslated message.

- [ ] **Step 6: Preserve error objects to the display boundary**

Update `useEditor` and `Preview` to pass `Error` or `AssetLoadError` objects where available. Use `localizedError` only when rendering; log unknown original errors with `console.error` before showing the generic translation.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/i18n/errors.test.ts src/components/ErrorToast.test.tsx src/hooks/useEditor.test.tsx src/components/Preview.test.tsx`

```bash
git add src/i18n/errors.ts src/i18n/errors.test.ts src/components/ErrorToast.tsx src/components/ErrorToast.test.tsx src/components/Preview.tsx src/hooks/useEditor.ts
git commit -m "fix: localize every user-facing error"
```

### Task 4: Language-consistent export analytics

**Files:**
- Modify: `src/analytics/goatCounter.ts`
- Modify: `src/analytics/goatCounter.test.ts`
- Modify: `src/App.tsx`
- Modify: `docs/ANALYTICS.md`

**Interfaces:**
- Extend `FilterExportTrackingOptions` with `language: Language`.
- Preserve event paths and payload flags; localize only title prefix and no-filter label.

- [ ] **Step 1: Add failing event contract tests**

```ts
expect(chineseCount).toHaveBeenCalledWith({
  path: 'export-filter-INSTWARM', title: '导出滤镜：暖调拍立得', event: true, no_session: true,
})
expect(englishCount).toHaveBeenCalledWith({
  path: 'export-filter-INSTWARM', title: 'Export filter: Warm Instant', event: true, no_session: true,
})
expect(englishNoFilterCount).toHaveBeenCalledWith({
  path: 'export-filter-NONE', title: 'Export filter: No filter', event: true, no_session: true,
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/analytics/goatCounter.test.ts`

Expected: FAIL because event title prefixes and `NONE` are hard-coded Chinese.

- [ ] **Step 3: Implement localized titles with stable paths**

Add `language` to the tracking options and build the literal localized title inside the adapter. `App` passes the active language and the matching localized LUT display name.

- [ ] **Step 4: Update the owner documentation**

Document that rows group by stable path while titles may be Chinese or English according to the exporting visitor. Reaffirm the unchanged anonymous data boundary.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/analytics/goatCounter.test.ts src/App.test.tsx`

```bash
git add src/analytics/goatCounter.ts src/analytics/goatCounter.test.ts src/App.tsx docs/ANALYTICS.md
git commit -m "feat: localize export analytics without splitting counts"
```

### Task 5: Localized PWA identity and reproducible icons

**Files:**
- Create: `public/manifest-zh.webmanifest`
- Create: `public/manifest-en.webmanifest`
- Modify: `index.html`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/generate-pwa-icons.mjs`
- Create: `scripts/pwa-assets.test.mjs`
- Modify: `src/components/InstallPrompt.test.ts`

**Interfaces:**
- Two static manifests with identical technical fields and localized `name`, `short_name`, `description`, and `lang`.
- `npm run assets:pwa-icons` directly consumes declared `sharp`.

- [ ] **Step 1: Write a failing manifest and icon-generation contract test**

The Node test reads both manifests and asserts literal localized names, identical `start_url`, `scope`, icon arrays, and existing 180/192/512 PNG dimensions. It resolves `sharp` as a direct root dependency through `package.json`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test scripts/pwa-assets.test.mjs`

Expected: FAIL because localized manifests and direct `sharp` declaration do not exist.

- [ ] **Step 3: Add the localized manifests and configure VitePWA**

Set `manifest: false` so the plugin keeps service-worker registration without generating a third bilingual manifest. Point `index.html` at `./manifest-zh.webmanifest` as the static fallback; `LanguageProvider` switches it at runtime.

- [ ] **Step 4: Declare and lock Sharp**

Run: `npm install --save-dev sharp@0.35.2`

Keep `assets:pwa-icons` and regenerate the committed icons once with the declared version.

- [ ] **Step 5: Extend install prompt tests**

Test iPhone Safari eligibility, Chrome iOS exclusion, standalone suppression, seven-day cooldown, and Chinese/English copy through a real provider.

- [ ] **Step 6: Verify and commit**

Run: `node --test scripts/pwa-assets.test.mjs && npm run assets:pwa-icons && npm test -- src/components/InstallPrompt.test.ts src/i18n.test.tsx && npm run build`

```bash
git add public/manifest-zh.webmanifest public/manifest-en.webmanifest public/icons index.html vite.config.ts package.json package-lock.json scripts/generate-pwa-icons.mjs scripts/pwa-assets.test.mjs src/components/InstallPrompt.test.ts
git commit -m "feat: ship localized installable PWA identities"
```

### Task 6: End-to-end language and regression coverage

**Files:**
- Create: `e2e/i18n.spec.ts`
- Modify: `e2e/analytics.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Browser contract covers first-visit locale, persistence, complete English export flow, Chinese fallback, and analytics failure isolation.

- [ ] **Step 1: Write failing browser scenarios**

Use context locale `en-US` and assert English title, chooser, LUT progress, filter name, export dialog, privacy note, and manifest. Switch to Chinese, reload, and assert the persisted Chinese UI. Use a Chinese locale context with no storage and assert Chinese first visit.

- [ ] **Step 2: Add a production-like event fixture**

Serve a controlled GoatCounter client and assert English export produces the exact stable path plus English title, while the payload serialization contains neither uploaded filename nor image bytes.

- [ ] **Step 3: Run and fix integration gaps**

Run: `npm run test:e2e -- e2e/i18n.spec.ts e2e/analytics.spec.ts`

Expected: all new scenarios pass in Chromium and WebKit after Tasks 2–5.

- [ ] **Step 4: Update README**

Document automatic first-visit language selection, persistent manual switch, localized PWA installation, and stable language-neutral analytics paths.

- [ ] **Step 5: Commit**

```bash
git add e2e/i18n.spec.ts e2e/analytics.spec.ts README.md
git commit -m "test: cover complete bilingual browser flows"
```

### Task 7: Complete verification, integration, and deployment

**Files:**
- Verify the complete branch and deployed artifacts.

**Interfaces:**
- Produces one corrected `master` containing the contributor commits and all fixes, deployed identically to GitHub Pages, Cloudflare Pages, and `film.richis.top`.

- [ ] **Step 1: Run the fresh full verification suite**

Run: `npm ci && npm test && npm run test:assets && node --test scripts/pwa-assets.test.mjs && npm run assets:pwa-icons && npm run build && npm run test:e2e && git diff --check`

Expected: zero failures and a clean working tree after deterministic icon regeneration.

- [ ] **Step 2: Audit language and privacy boundaries**

Search production components and built bundles for hard-coded Chinese user-facing strings outside the catalog and for English UI strings outside the catalog. Confirm analytics payload construction includes only path, localized title, `event`, and `no_session`.

- [ ] **Step 3: Review commit provenance**

Confirm `718b475` and `aa86aa7` remain ancestors of the final head and the branch contains no unrelated root-workspace changes.

- [ ] **Step 4: Integrate only if remote master is unchanged**

Push the tested final head to `origin/master` without force. The inclusion of the PR commits should allow GitHub to recognize PR #1 as merged while retaining contributor attribution.

- [ ] **Step 5: Wait for GitHub Actions and deploy the exact head to Cloudflare Pages**

Use the existing Pages Direct Upload workflow with `--commit-hash` set to the full final SHA.

- [ ] **Step 6: Verify the formal site**

After the server sync window, test Chinese and English first visits, persisted switching, both manifests, iPhone install prompt eligibility, one controlled export per language, stable analytics paths, no public counter, and successful export when analytics is blocked.
