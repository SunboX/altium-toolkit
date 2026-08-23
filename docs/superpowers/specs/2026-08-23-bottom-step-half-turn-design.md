# Bottom STEP Source Half-Turn Design

## Problem

Bottom-mounted embedded STEP bodies can be authored with an X-axis half-turn
because their solid geometry occupies the negative side of the model's local Z
origin. The current Altium scene builder clears that half-turn for most
surface-mount bodies because the shared viewer already mirrors bottom-side
placements. For negative-Z source geometry, clearing it reverses the model's
occupied side and places the solid toward the PCB instead of away from it.

The reported board exposes this with two bottom-side surface-mount coaxial
receptacles. Both source bodies carry `x: 180`, their STEP geometry spans almost
entirely from negative Z to the origin, and the current final placements carry
`x: 0`. Applying the missing half-turn through the live component adjustment
control restores the expected orientation.

## Scope

- Fix the transform decision in `altium-toolkit`.
- Derive the decision from signed STEP source geometry, not designators,
  filenames, package names, manufacturers, or project identifiers.
- Preserve existing through-hole behavior.
- Preserve the current normalization for models whose geometry occupies the
  positive side of source Z or whose signed source extents are unavailable.
- Supersede the package-family-specific historical behavior at the convergence
  boundary with the same signed-geometry rule.
- Do not add app-side adapters or viewer-side Altium behavior.
- Do not publish, push, update the app dependency, or deploy.

## Architecture

The historical `src/core` and `src/ui` implementation is protected by a
byte-exact native-source manifest. Current behavior therefore belongs in
`src/convergence`, which wraps the historical implementation without changing
it.

The converged `PcbScene3dModelRegistry` exposes a `sourceBoundsMil` record for
embedded STEP payloads. It contains signed `minX`, `maxX`, `minY`, `maxY`,
`minZ`, and `maxZ` values in mils. The historical `boundsMil` width, depth, and
height contract remains unchanged.

The converged `PcbScene3dBuilder` delegates scene construction to the preserved
native builder, then corrects bottom placements only when signed bounds show
that the source solid extends predominantly into negative Z and the associated
source body carries an authored X-axis half-turn. `src/extensions.mjs` exports
the converged classes under the existing public names.

## Data Flow

1. The parser supplies the embedded STEP payload and authored model transform.
2. The converged registry delegates native matching, parses Cartesian points,
   converts signed extents to mils, and adds `sourceBoundsMil`.
3. The historical builder creates and repairs the scene unchanged.
4. The converged builder compares negative and positive source-Z extensions. A
   dominant negative extension restores the authored half-turn; otherwise the
   historical result remains unchanged.
5. The format-neutral viewer consumes the final scene description without any
   Altium-specific branch.

## Boundary Conditions

- Bounds must contain finite `minZ` and `maxZ` values.
- The source must have a meaningful negative-Z extension.
- A small positive tolerance near the origin is allowed for STEP tessellation
  and authored seating offsets.
- Centered or predominantly positive-Z source geometry does not preserve the
  half-turn.
- Missing or unsupported model payloads retain the existing normalization.
- Through-hole components continue to preserve their local half-turn through
  the existing pad-geometry rule.

## Testing

- Extend the model-registry regression to assert signed STEP extents and unit
  conversion while keeping dimension-only bounds unchanged.
- Add a synthetic bottom-side surface-mount regression whose STEP geometry is
  predominantly negative Z and assert that its X half-turn survives.
- Retain a positive-Z synthetic case and assert that its redundant half-turn is
  cleared.
- Update the existing half-turn preservation regression to use structural
  signed bounds rather than package-family metadata.
- Run the focused toolkit tests first, then the complete toolkit suite.
- Run the complete ECAD Forge suite against the locally linked toolkit.
- Re-run the app-style parser and scene preparator on the reported board and
  verify both final external placements retain their source X half-turn.
- Reload the localhost page and capture the corrected orientation without
  relying on saved component adjustments.

## Completion Criteria

- No production rule contains fixture-, file-, project-, designator-, or
  package-family-specific matching for this behavior.
- The historical native-source manifest remains byte-exact.
- Negative-Z embedded STEP bodies retain the required half-turn on the bottom
  side.
- Positive-Z surface-mount bodies continue to normalize the redundant
  half-turn.
- Toolkit and app suites pass.
- The reported live board renders both affected connectors correctly after a
  clean reload.
