# Public Pageview Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record aggregate pageviews with GoatCounter and display the cumulative total in a resilient footer pill beside Xiaohongshu.

**Architecture:** A focused analytics adapter owns production eligibility, official script injection, and public-counter JSON parsing. A small React component owns loading/success/failure presentation. The editor has no dependency on either unit, so blocked analytics cannot affect image processing.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, GoatCounter hosted open-source analytics, Playwright.

## Global Constraints

- Start the public total at zero; do not backfill historical traffic.
- Track only production HTTPS pages and canonicalize all supported hosts to `/`.
- Never send photos, filenames, filter selections, LUT operations, or export information.
- Do not ship administrative API keys, account passwords, cookies, user IDs, or fingerprints.
- Analytics failure must not affect loading, editing, preview, or export.
- Disable GoatCounter Sessions deduplication so every document load and refresh counts as one PV.
- The public counter is eventually consistent and may lag the private dashboard by up to four hours.

---

### Task 1: GoatCounter Adapter

**Files:**
- Create: `src/analytics/goatCounter.ts`
- Create: `src/analytics/goatCounter.test.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces: `GoatCounterOptions { siteUrl: string; location: Pick<Location, 'hostname' | 'protocol'>; document: Document; fetcher?: typeof fetch }`
- Produces: `startPageviewTracking(options): boolean`
- Produces: `readTotalPageviews(siteUrl, fetcher?, signal?): Promise<string>`

- [ ] **Step 1: Write failing adapter tests**

Cover exact behavior:

```ts
expect(startPageviewTracking(productionOptions)).toBe(true)
expect(document.querySelectorAll('script[data-goatcounter]')).toHaveLength(1)
expect(script.dataset.goatcounter).toBe('https://film-simulation.goatcounter.com/count')
expect(script.dataset.goatcounterSettings).toBe('{"path":"/","no_events":true}')
expect(startPageviewTracking(productionOptions)).toBe(true) // still one script
expect(startPageviewTracking({ ...productionOptions, location: localhost })).toBe(false)
await expect(readTotalPageviews(siteUrl, fetcher)).resolves.toBe('12,345')
await expect(readTotalPageviews(siteUrl, malformedFetcher)).rejects.toThrow('浏览量响应无效')
```

Also assert invalid/non-HTTPS service URLs are disabled and that the counter request is exactly `https://film-simulation.goatcounter.com/counter/TOTAL.json` with the supplied abort signal.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/analytics/goatCounter.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal adapter**

Normalize the service URL with `new URL`, accept only `https:`, reject localhost/loopback document hosts, inject the official `https://gc.zgo.at/count.js` script once with `async`, `data-goatcounter`, and `data-goatcounter-settings='{"path":"/","no_events":true}'`, then parse `{ count: string }` from the public total endpoint. Keep transport errors as rejected promises for the UI boundary to handle.

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run: `npm test -- src/analytics/goatCounter.test.ts`

Expected: all adapter tests pass with no real network calls.

- [ ] **Step 5: Commit the adapter**

```bash
git add src/analytics/goatCounter.ts src/analytics/goatCounter.test.ts src/vite-env.d.ts
git commit -m "feat: add privacy-conscious pageview adapter"
```

---

### Task 2: Footer Counter Component

**Files:**
- Create: `src/components/PageviewCounter.tsx`
- Create: `src/components/PageviewCounter.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `startPageviewTracking()` and `readTotalPageviews()` from Task 1.
- Produces: `<PageviewCounter siteUrl?: string />`.

- [ ] **Step 1: Write failing component and integration tests**

Mock the adapter and verify:

```tsx
render(<PageviewCounter siteUrl="https://film-simulation.goatcounter.com" />)
expect(screen.getByRole('status', { name: '网站累计浏览量' })).toHaveTextContent('浏览量读取中')
expect(await screen.findByText('已浏览 12,345 次')).toBeVisible()
```

Add rejected-read and missing-configuration cases that end at `浏览量暂不可用`. In `App.test.tsx`, assert the footer order is `GitHub Star`, `小红书`, then the named counter status.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/PageviewCounter.test.tsx src/App.test.tsx`

Expected: FAIL because the component and counter status do not exist.

- [ ] **Step 3: Implement component, App wiring, and pill styling**

On mount, call tracking without awaiting it, read the total with an `AbortController`, and ignore late completion after unmount. Render a fixed-minimum-width, 36-pixel pill with an eye icon. Insert it immediately after Xiaohongshu and pass `import.meta.env.VITE_GOATCOUNTER_URL`.

Use the existing `.social-btn` geometry but add `.social-views` with a warm dark background, light border, tabular numerals, no pointer affordance, and wrapping behavior inherited from `.support-links`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/components/PageviewCounter.test.tsx src/App.test.tsx`

Expected: all counter and App tests pass.

- [ ] **Step 5: Run the complete unit suite**

Run: `npm test`

Expected: all existing and new tests pass.

- [ ] **Step 6: Commit UI integration**

```bash
git add src/components/PageviewCounter.tsx src/components/PageviewCounter.test.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: show cumulative pageviews in footer"
```

---

### Task 3: Production Configuration and Privacy Documentation

**Files:**
- Modify: `.env.example`
- Modify: `.env.production`
- Modify: `README.md`
- Create: `docs/ANALYTICS.md`

**Interfaces:**
- Produces: production `VITE_GOATCOUNTER_URL=https://film-simulation.goatcounter.com`.
- Produces: owner runbook for the private dashboard and public counter setting.

- [ ] **Step 1: Add the production and example environment value**

Keep the URL public and secret-free. Do not add passwords, cookies, or GoatCounter API tokens.

- [ ] **Step 2: Correct README privacy claims**

Replace “没有分析或遥测” with an exact disclosure: aggregate pageview, referrer, coarse browser/device, and country analytics; photos and editing activity remain local and are never transmitted.

- [ ] **Step 3: Write the analytics owner runbook**

Document:

- Dashboard: `https://film-simulation.goatcounter.com`
- Public counter setting: Settings → Site settings → Allow adding visitor counts
- Production variable and canonical `/` path
- Public counter cache delay of up to four hours and dashboard update delay
- Owner-visit exclusion, account recovery, disable procedure, and blocked-script behavior
- Credential storage outside the repository

- [ ] **Step 4: Validate documentation and build**

Run: `rg -n "没有.*分析|没有.*遥测" README.md docs/ANALYTICS.md` and expect no stale claim.

Run: `npm run build` and expect exit 0.

Run: `rg -F "film-simulation.goatcounter.com" dist/assets/*.js` and expect the public endpoint in the bundle.

- [ ] **Step 5: Commit configuration and docs**

```bash
git add .env.example .env.production README.md docs/ANALYTICS.md
git commit -m "docs: configure GoatCounter analytics"
```

---

### Task 4: Provision GoatCounter and Verify Failure Isolation

**Files:**
- Modify only if tests reveal a defect: `src/analytics/goatCounter.ts`, `src/components/PageviewCounter.tsx`
- Test: `e2e/analytics.spec.ts`

**Interfaces:**
- Consumes the hosted `film-simulation.goatcounter.com` account.
- Produces a live empty analytics site with public counters enabled.

- [ ] **Step 1: Create the dedicated hosted account**

Create `film-simulation.goatcounter.com` for `film.richis.top` using the project owner's email. Generate a strong unique password, keep it out of terminal output and Git, store it in the system credential manager, and complete any required email verification. Enable public visitor counts and disable Sessions deduplication so each refresh is a PV. Do not create or expose an API token.

- [ ] **Step 2: Write browser tests**

Add tests that mock GoatCounter and verify one count-script load plus the visible pill, then block `*.goatcounter.com` and `gc.zgo.at` and verify the editor loads, accepts a photo, applies a LUT, and opens export while the counter says unavailable.

- [ ] **Step 3: Run browser tests**

Run: `npm run test:e2e`

Expected: all Chromium and WebKit tests pass, including the analytics failure-isolation cases.

- [ ] **Step 4: Verify the hosted endpoints without incrementing production unnecessarily**

Run a read-only request to `/counter/TOTAL.json` and expect JSON with `count`. Confirm the private dashboard is reachable only with the stored owner credentials.

- [ ] **Step 5: Commit browser coverage and any fixes**

```bash
git add e2e/analytics.spec.ts src/analytics/goatCounter.ts src/components/PageviewCounter.tsx
git commit -m "test: cover analytics availability and isolation"
```

---

### Task 5: Final Verification and Deployment

**Files:**
- No planned source changes.

**Interfaces:**
- Produces exact tested GitHub `master`, Cloudflare Production, and nginx-synced `film.richis.top`.

- [ ] **Step 1: Run the complete local gate**

Run:

```bash
npm run test:assets
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: zero failures, successful build, and clean worktree.

- [ ] **Step 2: Push exact HEAD to GitHub master**

Fetch and confirm the remote has not diverged, then perform a normal non-force push. Verify GitHub Actions succeeds for the exact commit SHA.

- [ ] **Step 3: Deploy exact HEAD to Cloudflare Pages**

Run `npm run deploy:cloudflare`, then verify the newest Production deployment source equals the short HEAD SHA.

- [ ] **Step 4: Wait for nginx sync and verify production UI**

After the configured five-minute sync, load `https://film.richis.top`, confirm the new bundle, footer order, loading-to-count transition, mobile wrapping, and absence of console errors.

- [ ] **Step 5: Verify production tracking and failure isolation**

In one fresh browser load, confirm exactly one GoatCounter count request. Confirm the public total endpoint becomes numeric after GoatCounter's documented processing/cache delay. In a separate context that blocks GoatCounter, confirm the pill falls back without breaking LUT preload, photo opening, filtering, or export.

- [ ] **Step 6: Audit privacy and repository state**

Search the tracked tree for account passwords/API tokens, confirm only the public site URL is present, compare `HEAD` with `origin/master`, and record the dashboard URL for the owner.
