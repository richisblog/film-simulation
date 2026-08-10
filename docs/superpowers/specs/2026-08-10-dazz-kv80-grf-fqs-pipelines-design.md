# Dazz KV80, GRF, and FQS Pipeline Replication Design

## Goal

Replace the current single/composed-LUT approximations for KV80, GRF, and FQS with recipe-specific processing graphs that follow the recovered Dazz application call order and original assets. Promote these three families to the beginning of the Dazz camera browser while leaving the remaining Dazz catalog available after them.

This feature must reproduce the application pipeline from recovered evidence. It must not introduce a hard-coded `-0.7 EV` KV80 correction or tune curves merely to resemble selected reference images.

## Product Behavior

- The first three Dazz camera cards are `KV80`, `GRF`, and `FQS`, in that order.
- KV80 selects its complete pipeline directly.
- GRF opens a second-level menu with `400TX`, `NEOP100`, and `VELVIA` variants.
- FQS is restored to the runtime catalog even though it remains present in the archived product-policy list; this is an intentional, narrowly scoped reactivation. Other inactive cameras and recipes remain inactive.
- Existing Dazz cameras follow these three cards in their existing relative order.
- The exposure slider remains a user adjustment. Its displayed `0 EV` means no user-supplied exposure change and must not conceal a recipe-specific constant.
- Existing user grain, vignette, light-leak, and LUT-strength controls retain their established semantics. User light leak remains before native color transformation; user grain and vignette remain after the completed native recipe. They do not replace or suppress required native recipe nodes.
- Preload progress includes every runtime LUT and texture required by the three promoted pipelines. Archived 64³ LUT files remain committed and are not fetched by normal runtime selection.

## Evidence Boundary

The implementation distinguishes three evidence levels:

- Confirmed nodes, assets, ordering, dimensions, constants, and conditional branches are implemented directly.
- Color-space behavior is implemented to match the Core Image working-space model as closely as WebGL and the CPU fallback permit, and is covered by deterministic color-vector tests.
- A node whose private blend kernel is not statically recoverable is isolated behind a named operation and documented as an unresolved kernel. It may use the closest deterministic implementation only when its inputs, ordering, and known strength are preserved. No inferred value may be described in the UI or documentation as an original constant.

## Pipeline Architecture

Introduce a declarative `DazzPipelineDescriptor` separate from the existing single `LutDescriptor`. A pipeline contains an ordered list of typed stages:

```ts
type DazzPipelineStage =
  | { type: 'lut'; lutId: string; inputEncoding: 'linear-srgb' | 'srgb' }
  | { type: 'grain'; textureId: string; amount: number; kernel: 'dazz-grain' }
  | { type: 'lowlight-grain'; textureId: string; parameter: number | null; kernel: 'dazz-lowlight' }
  | { type: 'optical-blur'; blurScale: number; start: number; samples: number }
  | { type: 'vignette'; intensity: number; radius: number }
```

Recipe descriptors reference either a legacy single LUT or a pipeline ID. Catalog loading resolves all stage dependencies before marking a promoted recipe ready. Pipeline execution is shared by preview and export so both paths use the same order and parameters.

The renderer must preserve unclamped floating-point values between stages where the active backend supports them. sRGB decoding and encoding occur only at explicit pipeline boundaries; the code must not repeatedly gamma-convert between consecutive stages.

## KV80 Pipeline

The KV80 graph is:

```text
decoded source
→ user exposure
→ user light leak
→ sRGB-to-linear working conversion
→ lookup_kv80_kg200 (64³ source; 8³ runtime preview)
→ optional recovered Color Profile extension point (inactive without profile data)
→ grain_ofm.jpg through the isolated Dazz grain kernel
→ linear-to-output conversion
→ user grain / vignette adjustments
```

The runtime pipeline contains no fixed EV correction. The apparent `+0.7` to `+1.0 EV` midtone behavior remains part of `lookup_kv80_kg200` and the working-space interpretation.

The previous KV80 approximation using `grain_kv88.jpg` is removed from runtime behavior. `grain_kv88.jpg` remains archived; the native texture is `grain_ofm.jpg`.

## GRF Pipeline Family

GRF exposes three variants with the recovered enum order and resources:

| Variant | Framework entry | LUT |
|---|---|---|
| 400TX | `lookupCubeGRF_400TX` | `lookup_dblack_1` |
| NEOP100 | `lookupGRF_NEOP100` | `lookup_dblack_2` |
| VELVIA | `lookupGRF_VELVIA` | `lookup_velvia_x5` |

Each GRF graph is:

```text
decoded source
→ user exposure
→ user light leak
→ recovered working-space conversion
→ selected 64³ source / 8³ runtime LUT
→ output conversion
→ user grain / vignette adjustments
```

No recipe-specific exposure, fixed curve, or grain stage is added because the recovered GRF dispatcher contains none. Correct tonal behavior comes from the selected original LUT and the matching input color-space semantics.

GRDR remains a separate camera later in the catalog. It continues to use `lookup_grdr`; it is not renamed or merged into GRF.

## FQS Pipeline

FQS preserves its two-LUT topology and the texture stages between them:

```text
decoded source
→ user exposure
→ user light leak
→ working-space conversion
→ optical blur/drag node
   - inputBlur = image scale × 6.0
   - inputStart = 0.0
   - inputSamples = 5.0
→ grain_ou.jpg, amount 1.0, isolated Dazz grain kernel
→ lookup_ou_light
→ grain_ou_lowlight.jpg through the lowlight-control node
→ lookup_ou_color
→ optional recovered Color Profile extension point (inactive without profile data)
→ output conversion
→ user grain / vignette adjustments
```

The generator must stop composing `lookup_ou_light` and `lookup_ou_color` into one baked FQS LUT for runtime use. Both stage assets are independently generated and preloaded. This preserves the fact that the lowlight texture is transformed by the Color LUT.

The static binary exposes an optional `lowlight` float but no confirmed fixed default value. The descriptor therefore uses `null` when no reference configuration supplies it and skips the lowlight-grain blend in that state, matching the conditional branch. It must not invent a default intensity.

## Assets and Loading

- Keep canonical 64³ CUBE files in the repository archive.
- Generate 8³ deflated stage LUTs for runtime preload using the existing deterministic sampler.
- Add original textures as optimized WebP runtime assets while retaining the original JPEG source outside the web payload:
  - `grain_ofm.jpg` for KV80;
  - `grain_ou.jpg` for FQS;
  - `grain_ou_lowlight.jpg` for conditional FQS lowlight processing.
- Extend the generated manifest with pipeline descriptors, stage asset hashes, byte lengths, and source-evidence labels.
- Deduplicate stage assets during preload. A LUT or texture referenced by more than one pipeline is downloaded and decoded once.
- A failed required stage marks only the affected recipe unavailable and exposes the existing retry path; unrelated filters remain usable.

## Rendering Backends

The accelerated renderer executes the ordered graph with ping-pong framebuffers. LUT stages sample the existing 3D-cube representation. Grain and optical nodes use separate shader passes so stage order is observable and testable.

The CPU compatibility renderer mirrors the same graph and transfer functions. It may use lower-resolution texture sampling for performance but must keep node order, constants, deterministic placement, and color-space transitions identical.

Filter strength blends the source entering the recipe with the completed native recipe result. It must not attenuate each internal stage independently. User exposure and light leak run before native recipe color processing; user-added grain and vignette run after the recipe blend, preserving existing control semantics.

## Interface and Catalog Ordering

- Add an explicit priority field or stable promoted-camera list rather than depending on JSON insertion order.
- Order promoted cameras as `KV80`, `GRF`, `FQS`.
- GRF uses the existing multi-variant drawer pattern.
- KV80 and FQS select immediately as single recipes.
- Pipeline badges or technical stage names are not added to the normal consumer UI.
- Bilingual labels remain manifest-driven and must not expose internal names such as `lookup_ou_light`.

## Testing

Asset tests must prove:

- promoted order is exactly KV80, GRF, FQS;
- GRF has exactly the three mapped variants;
- FQS is active while all other previously inactive cameras remain inactive;
- FQS references two separate LUT stages in Light-then-Color order;
- KV80 references `grain_ofm`, not `grain_kv88`;
- every stage asset exists, hashes match, 8³ LUTs inflate to `8 ** 3 * 3`, and no composed FQS runtime LUT is selected.

Renderer tests must prove:

- sRGB/linear transfer vectors round-trip within tolerance;
- user exposure precedes recipe processing and remains zero by default;
- KV80 has no hidden constant exposure stage;
- FQS executes blur, main grain, Light LUT, conditional lowlight grain, then Color LUT in order;
- filter strength blends once around the complete recipe;
- CPU and WebGL fixtures agree within the established byte tolerance;
- preview and export call the same pipeline executor.

UI and end-to-end tests must prove:

- the first three Dazz cards and GRF submenu labels/order;
- selection loads only 8³ runtime assets and required textures;
- preload progress counts the newly active stage assets without duplicate downloads;
- FQS can be selected after its targeted reactivation;
- existing classic filters, remaining Dazz filters, exposure, leaks, reset, language switching, preview, and export still work.

## Documentation and Delivery

- Link the three reverse-engineering reports from `docs/DAZZ_ASSETS.md` or copy their confirmed conclusions into a repository-local evidence section when the source reports are outside the deployable worktree.
- Document known unresolved private kernels separately from confirmed behavior.
- Update runtime catalog counts and preload wording from generated manifest values rather than hard-coded text.
- After unit, asset, build, and one Chromium end-to-end smoke test pass, publish through the existing GitHub Actions and Cloudflare Pages paths and verify `film.richis.top` serves the new bundle.

## Out of Scope

- No visual-fit EV compensation, automatic histogram exposure, or scene-dependent curve fitting.
- No reactivation or pipeline research for other inactive Dazz cameras.
- No deletion of archived 64³ LUTs or original resources.
- No claim of bit-identical reproduction for private blend kernels that static analysis has not yet resolved.
