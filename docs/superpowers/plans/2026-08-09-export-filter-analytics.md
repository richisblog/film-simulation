# Export Filter Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Privately count successful exports by selected filter, remove the public pageview counter, and disclose the anonymous telemetry in the footer.

**Architecture:** Keep GoatCounter behind one analytics adapter. Mount page tracking as a nonvisual application side effect and fire a bounded, nonblocking event only after download initiation; the footer contains no analytics state.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Playwright, GoatCounter, Vite, Cloudflare Pages.

## Global Constraints

- Send only filter ID and public Chinese filter name for successful exports.
- Use `export-filter-NONE` and `导出滤镜：未使用滤镜` when no LUT is selected.
- Every export event uses `event: true` and `no_session: true`.
- Analytics must never block, delay, or show an error in the editor.
- Do not send or store photos, filenames, image metadata, adjustment values, or personal information.
- Show no public pageview count or analytics availability state.

---

### Task 1: Private export-event adapter

**Files:**
- Modify: `src/analytics/goatCounter.test.ts`
- Modify: `src/analytics/goatCounter.ts`

**Interfaces:**
- Produces: `trackFilterExport(options: FilterExportTrackingOptions): boolean`.
- `FilterExportTrackingOptions` contains the analytics URL, current location, LUT ID/name, browser window, and optional retry timing for deterministic tests.

- [ ] **Step 1: Write failing tests** for immediate `INSTWARM`, `NONE`, delayed collector readiness, timeout, and ineligible pages using literal expected event payloads.
- [ ] **Step 2: Run** `npm test -- src/analytics/goatCounter.test.ts` and confirm failures are caused by the missing export-event API.
- [ ] **Step 3: Implement** URL/production validation, exact event construction, immediate send, and bounded retry without throwing.
- [ ] **Step 4: Remove** `readTotalPageviews` and its public-counter parsing tests.
- [ ] **Step 5: Run** `npm test -- src/analytics/goatCounter.test.ts` and confirm all adapter tests pass.
- [ ] **Step 6: Commit** the analytics adapter and tests.

### Task 2: Nonvisual integration and footer disclosure

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Delete: `src/components/PageviewCounter.tsx`
- Delete: `src/components/PageviewCounter.test.tsx`

**Interfaces:**
- Consumes: `startPageviewTracking` and `trackFilterExport` from Task 1.
- Consumes: `lutDisplayName(id: string): string`.

- [ ] **Step 1: Change the component test first** to require exactly the GitHub and Xiaohongshu buttons, no analytics status, and the full privacy disclosure.
- [ ] **Step 2: Run** `npm test -- src/App.test.tsx` and confirm it fails against the existing public counter.
- [ ] **Step 3: Add** a mount effect for page tracking; remove `PageviewCounter`; add the disclosure and 10px/9px styling.
- [ ] **Step 4: Call** `trackFilterExport` after `anchor.click()` succeeds, passing the selected LUT ID and independently resolved display name.
- [ ] **Step 5: Delete** the obsolete public-counter component and styles.
- [ ] **Step 6: Run** `npm test -- src/App.test.tsx src/analytics/goatCounter.test.ts` and confirm both suites pass.
- [ ] **Step 7: Commit** the UI integration and disclosure.

### Task 3: Browser-level contract and failure isolation

**Files:**
- Modify: `e2e/analytics.spec.ts`

**Interfaces:**
- Observes the production browser contract: no public counter, exact GoatCounter event, successful download with analytics blocked.

- [ ] **Step 1: Replace the former public-counter expectations** with a failing browser test that supplies a collector fixture, exports using `INSTWARM`, and asserts the literal event payload.
- [ ] **Step 2: Add** a blocked-analytics export test that asserts the download still completes and no analytics error is displayed.
- [ ] **Step 3: Run** `npm run test:e2e -- e2e/analytics.spec.ts`; fix only integration defects until both tests pass.
- [ ] **Step 4: Commit** the E2E contract.

### Task 4: Owner documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/ANALYTICS.md`

**Interfaces:**
- Documents paths `export-filter-<LUT_ID>` and `export-filter-NONE` and the private GoatCounter workflow.

- [ ] **Step 1: Update** privacy statements to match the shipped collection boundary exactly.
- [ ] **Step 2: Remove** public counter setup, caching, and unavailable-state instructions.
- [ ] **Step 3: Document** filtering GoatCounter paths by `export-filter-` to rank selected filters by date range.
- [ ] **Step 4: Commit** documentation.

### Task 5: Verification and deployment

**Files:**
- Verify all tracked source and documentation.

**Interfaces:**
- Produces a tested commit deployed unchanged to GitHub, Cloudflare Pages, and the synced custom domain.

- [ ] **Step 1: Run** `npm test`, `npm run test:assets`, `npm run build`, and `npm run test:e2e` with pristine output.
- [ ] **Step 2: Inspect** the diff and confirm no photo, filename, or settings data enters analytics payloads.
- [ ] **Step 3: Push** the tested commit to `origin/master` only if the remote has not diverged.
- [ ] **Step 4: Wait** for GitHub Actions and deploy the exact commit to Cloudflare Pages.
- [ ] **Step 5: After the sync delay, verify** `film.richis.top` has no counter, shows the disclosure, records pageviews/events privately, and exports normally when analytics is blocked.
- [ ] **Step 6: Mark** the active goal complete only after online verification succeeds.
