# Linear PCB Pad Copper Grouping Design

## Problem

Composite Altium PCB views assign pads to `surface` or `subsurface` copper
groups. The current convergence renderer first renders every pad in the surface
group and then relocates subsurface pads by repeatedly searching and slicing the
complete SVG string. Rendering therefore scales with the product of SVG size
and subsurface-pad count. Dense but valid boards can exhaust the browser
renderer heap and crash the tab.

## Scope

- Fix copper-group placement in `altium-toolkit` for every PCB model that uses
  the existing `copperRenderGroup` data contract.
- Preserve observable SVG grouping, semantic element keys, pad order within
  each group, layer-only exports, and existing surface/subsurface styling.
- Do not add file-name checks, project-specific behavior, board-size limits, or
  ECAD Forge fallbacks.
- Publish a patch release of `altium-toolkit`, update ECAD Forge to that exact
  released dependency through npm, and publish/deploy an ECAD Forge patch
  release.

## Approaches Considered

### Render pads directly into their copper groups

Partition rendered pad fragments using each pad's `copperRenderGroup` while the
legacy SVG renderer is already iterating the pad model. Append subsurface pad
markup to the subsurface copper group and all remaining pad markup to the
surface group. The convergence wrapper can then delegate without rewriting the
completed SVG.

This is the selected approach. It is linear in the output size, follows the
existing data model, and removes the failure mechanism.

### Rewrite completed SVG in one pass

A single scan could extract all selected pad groups and rebuild the SVG once.
This would reduce asymptotic cost, but it would still treat renderer output as a
second input language and depend on markup layout details.

### Reject or simplify dense boards

A size guard or reduced-detail fallback would protect the tab, but it would
reject or silently degrade valid input. It would not correct the renderer.

## Architecture and Data Flow

`PcbSideResolvedRenderModel` remains responsible for assigning
`copperRenderGroup`. The historical PCB SVG renderer consumes that property at
the point where it turns each pad into markup. It accumulates two ordered
fragment lists:

1. Pads with `copperRenderGroup === 'subsurface'` enter the subsurface list.
2. Every other pad enters the surface list, preserving legacy behavior for
   models without the property.

The final SVG assembly inserts each list into its corresponding copper group.
The convergence `PcbSvgRenderer` becomes a direct delegate for composite and
layer renders; no completed SVG is searched or sliced.

## Error Handling

Unknown or absent copper-group values are treated as `surface`, matching the
current default placement. The change introduces no new thrown errors and no
input-size thresholds.

## Testing

- Add a small renderer regression proving the historical renderer places
  explicit surface and subsurface pads directly into the matching groups.
- Keep the existing convergence-level copper grouping test to prove its public
  output contract remains unchanged.
- Add a dense synthetic renderer regression using only repo-owned fake model
  data. It must complete under a bounded child-process heap and preserve all pad
  element keys; the pre-fix quadratic relocation must fail that bound.
- Run the complete `altium-toolkit` test and format checks.
- Publish/dry-run the toolkit package and verify the npm version and `latest`
  dist-tag.
- Install the published toolkit in ECAD Forge, bump the app patch version, sync
  structured data, and run `npm test`, `npm run check:structured-data`, and
  `npm run build:static`.
- Reopen the original public deep link in a fresh real browser and verify the
  PCB view renders without a renderer crash.
- Push both `main` branches, create GitHub releases, watch the ECAD Forge FTP
  deployment workflow to `success`, and verify the live app version and deep
  link.

## Release Boundaries

The library must be published and verified on npm before ECAD Forge updates its
dependency. ECAD Forge must install from the registry rather than a local
`file:` dependency. A GitHub release or successful local build is not treated
as a completed app release until the pushed commit's deployment workflow
concludes successfully and the live site is verified.
