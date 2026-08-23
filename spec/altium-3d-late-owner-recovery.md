# Altium 3D Late Owner Recovery

## Scope

Recover explicit STEP placements whose shape-body rows do not carry a direct
component owner. The recovery must use generic PCB geometry and package
metadata only. It must not depend on file names, project names, designators,
vendor names, or library identifiers.

## Required behavior

- Resolve a unique owner when an unowned body anchor coincides with the center
  of pads owned by one component.
- Resolve a unique owner when a body origin is a proven model corner and the
  corresponding model dimensions agree with the owner's footprint geometry.
- Resolve a unique owner for multi-row through-hole packages when the model
  span agrees with the owned pad span and the body anchor lies within that
  span.
- Use component height agreement only as supporting evidence for nearby
  package ownership; height alone is insufficient.
- Preserve a pad-centroid body position because it is already a valid authored
  package center.
- Center proven corner-origin and row-origin bodies on the component owner and
  retain the source offset as transform diagnostics.
- Recompute component side and authored vertical standoff after late owner
  recovery.
- Correct the half-turn of a four-pad tactile-switch model when its exact owner,
  footprint topology, and tilted source frame jointly establish that package
  class.
- Decline ambiguous matches.

## Verification

- Focused synthetic tests use obfuscated package identities and cover pad
  centroid, corner origin, row origin, late standoff, ambiguity rejection, and
  tactile-switch yaw.
- The full toolkit test suite and formatting check pass.
- A read-only probe of the supplied PCB must show real component designators
  for the affected placements, owner-centered corner/row models, recovered
  top-side standoff, and corrected switch yaw.
