# Complete Bilingual UI and PWA Design

## Goal

Complete PR #1 so every user-facing surface is consistently Chinese or English according to the active language. Preserve the contributor's two original commits, retain all existing weak-network, 8-cube LUT cache, export analytics, and privacy behavior, and avoid deploying an intermediate partially localized version.

## Integration Strategy

Start from the current `origin/master`, replay PR #1 commits `718b475` and `aa86aa7` unchanged, then add focused correction commits. This preserves the contributor's authorship and commit history. Only the final corrected branch is integrated into `master`; the incomplete PR state is never deployed by itself.

## Language Selection

The active language is either `zh-CN` or `en`.

1. A valid persisted user choice in localStorage has highest priority.
2. On a first visit, any browser language beginning with `zh` selects `zh-CN`; every other browser language selects `en`.
3. The language switch updates the UI immediately and persists the explicit selection.
4. Storage failure is nonfatal; the current session still works.

Changing language synchronizes `document.documentElement.lang`, document title, description metadata, Apple web-app title, and the active PWA manifest link.

## Translation Architecture

Use one typed catalog with complete Chinese and English entries. Components consume semantic keys rather than hard-coded user-visible strings. This includes:

- visible labels, buttons, notices, progress, empty state, footer, and privacy disclosure;
- accessibility names, dialog descriptions, status regions, and retry controls;
- filter names, export filenames, generated-file status, and comparison labels;
- iPhone installation instructions and dismissal controls;
- HTML title, description, Apple web-app title, and installable application name.

Internal identifiers, diagnostic categories, filenames selected by the user, and filter IDs are not translated.

## Error Boundary

Presentation code accepts the original error object instead of depending on Chinese message parsing. `AssetLoadError` is localized from its structured category, effect ID, source, attempt, status, and elapsed time. Known browser/export/decode failures receive stable localized messages. Unknown failures display a safe generic message in the active language; their original diagnostic remains available to developers through the console and is never leaked as untranslated UI.

Chinese error surfaces contain no English prose except technical standards or product names such as HTTP, WebGL, JPEG, PNG, WebP, HEIC, LUT, CDN, and file-format labels. English error surfaces contain no Chinese prose.

## Analytics

The stable GoatCounter path remains language-independent:

- Selected filter: `export-filter-<LUT_ID>`
- No filter: `export-filter-NONE`

The event title follows the active language without changing grouping:

- Chinese: `导出滤镜：暖调拍立得`, `导出滤镜：未使用滤镜`
- English: `Export filter: Warm Instant`, `Export filter: No filter`

Events still use `event: true` and `no_session: true`, run only after successful export, and contain no photo, filename, adjustment value, or personal identifier.

## PWA

Ship separate Chinese and English web app manifests with identical scope, start URL, icons, caching, and display behavior but localized name, short name, description, and `lang`. The active language switches the manifest link so installation uses the corresponding application metadata. Apple-specific metadata is updated at the same time.

The service worker and effect-asset cache remain shared across languages; changing language does not redownload LUTs or duplicate photo data. PNG PWA icons remain precached. `sharp` becomes an explicit development dependency and the generated icons remain committed and reproducible.

The iPhone Safari install prompt appears only outside standalone mode, observes the existing seven-day dismissal cooldown, and renders entirely in the active language. It must not prevent photo editing or export.

## Testing

- Unit-test first-visit browser-language detection, persisted preference priority, runtime switching, storage failure, and metadata/manifest synchronization.
- Test representative Chinese and English strings and accessibility labels at application level.
- Test structured timeout, network, HTTP, integrity, unsupported, decode, export, and unknown errors in both languages, proving no opposite-language leakage.
- Test Chinese and English GoatCounter event titles with identical paths, including `NONE`.
- Test iPhone Safari eligibility, standalone suppression, cooldown, and both-language prompt copy.
- Validate both manifests and run the icon generator from a clean dependency install.
- Run the complete unit, asset, production-build, Chromium, and WebKit suites to protect existing cache, weak-network, privacy, and export behavior.

## Deployment

After verification, integrate the corrected branch into `master` in a way that retains the PR commits. Wait for GitHub Pages and deploy the exact same commit to Cloudflare Pages. Verify `film.richis.top` in Chinese and English, including one controlled export event per language, without exposing a public counter or analytics status.

## Non-goals

- Additional languages beyond Chinese and English.
- Separate `/zh/` and `/en/` routes, server-side rendering, or SEO-specific duplicated pages.
- Translating user filenames, filter IDs, protocol names, file formats, or internal console diagnostics.
- Changing LUT rendering, effect assets, export resolution, or the anonymous data boundary.
