# Exposure Control Design

## Goal

Add a camera-style exposure control that adjusts the decoded source image before every color and texture effect. The control must behave identically in accelerated preview, compatibility preview, and export.

## User Experience

- Add an `曝光` / `Exposure` slider in the Film Simulation section before filter selection.
- Range: `-2.0 EV` through `+2.0 EV`.
- Step: `0.1 EV`.
- Default: `0 EV`.
- Display signed values such as `-0.7 EV`, `0 EV`, and `+1.2 EV`.
- Selecting Original disables only the LUT; it preserves exposure.
- Reset restores exposure to `0 EV` together with the other defaults.
- Filter thumbnails continue to show each filter at neutral exposure so the catalog remains comparable.

## Processing Model

Exposure uses a photographic stop multiplier:

```text
exposedColor = sourceColor × 2^exposureEV
```

CPU byte-channel processing uses the equivalent multiplier before subsequent effects. WebGL applies the multiplier to sampled source RGB and clamps only where required by later sampling/output.

The complete order is:

```text
decoded source → exposure → light leak → LUT → grain → vignette → output
```

This order ensures exposure changes the image entering the Dazz or classic color transform rather than merely brightening the finished result.

## Data and Components

- Add `exposure: number` to `EditSettings` and set it to `0` in `DEFAULT_SETTINGS`.
- Extend the shared range control to support custom minimum, maximum, step, and formatted output.
- Bind the new control to `settings.exposure`.
- Add a WebGL `u_exposure` uniform and mirror the same computation in `transformPixels`.
- Existing preview and export renderers receive `EditSettings`, so no parallel export-only implementation is needed.

## Testing

- Pixel tests prove `+1 EV` doubles channels and `-1 EV` halves channels before clipping.
- A non-identity LUT fixture proves exposure is applied before LUT lookup.
- UI tests prove the slider range, step, signed label, and state update.
- Default/reset tests prove neutral exposure is restored.
- Renderer/shader tests cover the new WebGL uniform contract.
- Run all asset tests, unit tests, production build, and Chromium/WebKit end-to-end tests before deployment.

## Scope

No automatic exposure, histogram, highlight recovery, gamma-aware tone mapping, per-filter exposure memory, or exposure adjustment in thumbnails is included.
