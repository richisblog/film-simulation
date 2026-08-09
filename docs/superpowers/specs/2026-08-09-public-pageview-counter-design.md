# Public Pageview Counter Design

## Goal

Add privacy-conscious pageview analytics to `film.richis.top` from zero and show the cumulative site pageview total beside the existing Xiaohongshu footer link. The image editor must remain fully usable when analytics is blocked or unavailable.

## Service Choice

Use the hosted edition of the open-source GoatCounter project. It supplies a private analytics dashboard, a lightweight browser pageview collector, and a public visitor-counter endpoint. This avoids adding a database or mutable API to the static application.

The production account is dedicated to this project and starts empty. Its canonical tracked path is `/`; all supported hostnames report the same canonical path so `film.richis.top`, GitHub Pages, and Cloudflare preview traffic do not fragment the displayed total. Localhost and automated tests never send analytics.

GoatCounter may be blocked by privacy tools or unavailable on some networks. Analytics is optional telemetry, never an application dependency. No account key or administrative API token is shipped to the browser.

## Tracking Module

Create a small analytics module with two responsibilities:

1. On a production `https:` page outside localhost, load GoatCounter's official `count.js` once, configure the endpoint and canonical `/` path, and let it record one pageview for the document load.
2. Fetch the public `counter/TOTAL.json` endpoint after the tracking request has had time to settle and return a validated formatted count.

The service URL is supplied through `VITE_GOATCOUNTER_URL`. Missing or invalid configuration disables analytics cleanly. The module deduplicates script injection and uses bounded timeouts so a statistics outage cannot delay page rendering.

The published counter is eventually consistent. GoatCounter documents a roughly 30-minute cache for public counters, so the visible number may lag the private dashboard. This is acceptable for a cumulative social-proof number.

## Footer UI

Add a `PageviewCounter` component as the third item in `.support-links`, immediately to the right of Xiaohongshu. It uses the same 36-pixel pill geometry and visual weight as the existing social buttons, with a small eye icon.

States:

- Loading: `浏览量读取中`
- Success: `已浏览 12,345 次`
- Unavailable or disabled: `浏览量暂不可用`

The counter is a non-interactive status element, not a link. It uses `role="status"` with a stable accessible name and never causes the footer to jump in width. On small screens it participates in the existing wrapping layout.

## Privacy and Documentation

Update the README statement that currently says the site has no analytics. State exactly what is collected: aggregate pageview, referrer, coarse device/browser and country information as supplied by GoatCounter, without advertising identifiers or cookies. Photos, filenames, filter choices, LUT operations, and exported images are never sent.

Document where the owner can view the private dashboard, how to set the production environment variable, how to enable GoatCounter's public visitor counter, how to exclude owner visits, and how to disable or replace analytics without touching editor code.

## Failure Handling

- Script blocked: show unavailable after a bounded wait; editor remains unchanged.
- Counter endpoint timeout, non-2xx response, malformed JSON, or missing `count`: show unavailable.
- Tracking succeeds but the new hit is not yet visible: display the last total returned by GoatCounter; no optimistic increment.
- Component unmount: abort pending counter fetch and ignore late results.
- Local/test build: do not load the remote script or send a pageview.

## Testing and Verification

- Unit-test configuration validation, production/localhost eligibility, script deduplication, canonical path, valid counter parsing, timeout/error handling, and cleanup.
- Component-test loading, formatted success, unavailable state, accessibility, and footer ordering after Xiaohongshu.
- Build with the production analytics endpoint and inspect the emitted bundle for the expected account URL without secrets.
- In a real browser, confirm one pageview request, the public counter pill, no analytics on localhost tests, and normal editing/export when GoatCounter is blocked.
- Deploy the exact tested commit to GitHub and Cloudflare, wait for the existing nginx sync, then verify `film.richis.top` and the private GoatCounter dashboard.

## Non-goals

- Backfilling historical traffic.
- Cookies, user IDs, fingerprinting, login, per-user histories, or photo-event analytics.
- Making the public counter resistant to deliberate artificial traffic; it is an approximate public pageview total, not a billing or security metric.
- Building a custom analytics database or exposing GoatCounter administrative credentials.
