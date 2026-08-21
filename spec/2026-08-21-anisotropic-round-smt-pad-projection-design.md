# Anisotropic Round SMT Pad Projection Design

## Goal

Preserve the authored X/Y geometry of every Altium surface-mount pad whose
native shape is `ROUND` or `CIRCLE` and whose two positive dimensions differ.
The canonical CircuitJSON model must expose these pads as `pill` or
`rotated_pill` records instead of expanding them into overlapping circles.

## Current Behavior and Root Cause

The historical CircuitJSON adapter classifies all Altium `ROUND` pads as
circles and assigns a radius derived from the larger dimension. That behavior
is part of the provenance-pinned 1.1.41 implementation and must remain
unchanged. The public convergence layer currently forwards the lossy SMT pad
records without restoring the native dimensions.

## Chosen Approach

Apply a source-neutral correction in `AltiumCircuitJsonProjection` after the
historical adapter has produced its immutable rows. Pair canonical
`pcb_smtpad` rows with native surface-mount pads in their deterministic source
order. For native round pads with unequal positive X/Y dimensions, replace only
the canonical geometry fields:

- use `pill` when rotation is effectively zero;
- use `rotated_pill` and `ccw_rotation` otherwise;
- retain width and height in millimetres;
- set the end radius to half the shorter dimension;
- preserve identifiers, ownership, layer, port, net, position, and metadata.

Use the same small rotation tolerance as the existing canonical adapter so
floating-point noise does not create a rotated shape. Equal round pads and all
other pad shapes remain byte-for-byte unchanged.

## Alternatives Considered

1. Modify the historical adapter. This is smaller locally but violates the
   frozen native source contract and its feature-preservation gates.
2. Add an ECAD Forge renderer workaround. This would leave canonical data
   incorrect for every other consumer and duplicate library behavior in the
   host app.
3. Correct the convergence projection. This keeps the historical extension
   stable while fixing the public canonical contract for all consumers and is
   therefore the selected approach.

## Testing

Add repo-owned synthetic tests without committing any supplied native board:

- verify the public `Parser.parse()` result for unrotated and rotated
  anisotropic round SMT pads;
- verify equal round pads stay circles;
- verify a through-hole pad interleaved between SMT pads does not disturb the
  native-to-canonical pairing;
- verify near-zero rotation uses an ordinary pill;
- run the complete library test, format, performance, package dry-run, and
  feature-preservation gates;
- verify the public parser against the existing local NodeMCU demo as
  non-committed evidence that all 16 affected SMT pads retain their geometry.

The new test file credits both the original contributor and the project
copyright holder and remains GPL-3.0-or-later.

## Release and Deployment

Release the fix as the next patch of `altium-toolkit`, preserving the original
pull-request contributor in commit attribution and release notes. Publish the
GitHub release and npm package, then verify the registry version and `latest`
tag.

Update ECAD Forge through npm to the latest published versions of all five
toolkit dependencies, bump the app patch version, synchronize structured data,
run the full test, structured-data, static-build, and formatting gates, commit
and push `main`, create the GitHub release, watch the deployment workflow to a
successful conclusion, and verify the production app version and corrected pad
geometry.

## Non-Goals

Anisotropic through-hole copper and slot-hole representation is a related but
separate canonical-model issue because it requires preserving both the outer
copper aperture and drill geometry. This release does not silently change that
contract.
