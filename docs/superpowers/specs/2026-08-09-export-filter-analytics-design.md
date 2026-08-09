# Export Filter Analytics Design

## Goal

Keep GoatCounter pageview analytics private, remove every public pageview counter state from the site, and record which filter was active only after a photo export succeeds. Add a very small footer disclosure that accurately describes the anonymous telemetry without implying that photos or personal data leave the device.

## Data Model

Each successful export emits one GoatCounter event with `event: true` and `no_session: true`, so repeated exports are counted independently:

- Path: `export-filter-<LUT_ID>`; for no selected LUT use `export-filter-NONE`.
- Title: `导出滤镜：<中文公开名称>`; for no selected LUT use `导出滤镜：未使用滤镜`.

Only the stable filter ID and its public display name are sent. Photos, image bytes, filenames, image dimensions, export filenames, adjustment values, LUT contents, and identifiers are never included. Recording `NONE` keeps the total number of successful exports interpretable instead of silently excluding exports without a filter.

## Runtime Behavior

`startPageviewTracking` remains responsible for loading GoatCounter once on eligible production HTTPS pages. `App` starts it as a nonvisual side effect; analytics is no longer coupled to a rendered footer component or a public counter request.

After the browser download action has been initiated successfully, `App` calls a nonblocking `trackFilterExport` adapter. The adapter calls GoatCounter immediately when its client is ready. If the asynchronous collector has not initialized yet, it retries briefly for at most three seconds, then gives up silently. Analytics failure never changes export status, shows an error, delays rendering, or prevents a download.

Localhost, HTTP pages, invalid service configuration, and missing GoatCounter clients remain ineligible. The public `counter/TOTAL.json` endpoint is not read by the application.

## Footer

The footer contains only the existing GitHub and Xiaohongshu buttons. Beneath them it displays this small, low-contrast disclosure:

> 为持续优化使用体验，本页面会记录匿名访问及导出所用的滤镜类型；不会上传或保存您的照片、文件名及个人信息。

Use a 10px desktop font (9px on narrow screens), restrained color, and normal line wrapping. It is disclosure text rather than a button or status region.

## Owner Workflow

The owner opens the private GoatCounter dashboard and filters the path list by `export-filter-`. Counts rank filters over the chosen date range. `export-filter-NONE` represents successful exports without a LUT. The public site displays no traffic total, ranking, analytics status, or event success/failure.

## Verification

- Unit tests cover production page tracking and the immediate, delayed, no-filter, and unavailable-client event paths.
- Component tests prove the footer has only two buttons, no public counter/status, and the disclosure.
- Browser tests prove successful export sends the exact filter event and blocked analytics does not prevent editing/export.
- Documentation describes the private dashboard schema and precise data boundary.
- The tested commit is deployed to GitHub and Cloudflare, then verified on `film.richis.top` after the existing sync delay.

