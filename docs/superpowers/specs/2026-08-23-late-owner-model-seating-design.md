# Late Owner Model Seating Design

## Context

Altium component-body ownership can be recovered after the historical scene
builder has already calculated a model's vertical offset. This occurs when a
body anchor and component anchor are close, but their mechanical-layer side and
identity tokens are initially incompatible. A later placement adapter can use
richer component metadata to recover the real owner.

The historical builder deliberately treats positive source `dzMil` differently
for owned and unowned bodies:

- An owned package model is seated from its loaded geometry bounds unless its
  authored standoff says otherwise.
- An unowned shape body retains positive `dzMil` because it may represent an
  intentional mechanical stack.

When ownership is recovered later, the designator and board side are corrected,
but the earlier unowned-body vertical-offset decision remains. The loaded model
is first seated on the board by the viewer and then receives the stale positive
offset, leaving it floating.

## Evidence

The supplied board contains two bottom-side placements of the same embedded
STEP model. The normally matched instance is emitted with `dzMil: 0`. The late
owner-recovered instance has source `standoffHeightMil: 0`, source
`dzMil: 35.4331`, and final `modelTransform.dzMil: 35.4331`.

This isolates the defect to inconsistent offset normalization after ownership
repair. STEP geometry, board thickness, mount side, and viewer seating are the
same for both instances.

## Approved Behavior

After the historical builder and its ownership adapters finish, the convergence
builder must apply the same seating invariant to late-resolved owners that an
initial owner receives:

1. Resolve the source component body from the placement's model name and body
   anchor.
2. Resolve a real component from the final placement designator.
3. Treat a finite zero `standoffHeightMil` as authoritative evidence that no
   authored air gap exists.
4. If the remaining positive placement offset is the unchanged positive source
   `dzMil`, clear it to zero and let the viewer's model-bounds seating define the
   mount contact plane.

The rule must not use component designators, project names, model names, package
names, vendor strings, or fixture-derived phrases.

## Preservation Rules

- Preserve placements without a resolved component owner.
- Preserve positive authored standoffs.
- Preserve offsets that do not equal the positive source `dzMil`, because a
  downstream adapter may have intentionally changed them.
- Preserve input objects; return copied placement and transform records only
  when normalization is required.
- Continue applying the existing signed STEP bottom-side orientation rule.

## Ownership

The fix belongs in `altium-toolkit`'s convergence scene builder. The toolkit
owns conversion from Altium body metadata to viewer-ready scene placements. The
shared 3D viewer should continue seating arbitrary loaded geometry on its mount
plane and applying the offset supplied by the scene contract.

## Verification

- A repository-owned fake placement reproduces a late-resolved owner with zero
  standoff and a stale positive source offset; it must normalize to zero.
- The same test preserves a positive authored standoff and an unresolved body.
- The focused test must demonstrate red before production code and green after.
- The full toolkit test and format suites must pass.
- The exact supplied board must emit zero vertical offset for the affected
  placement while preserving the prior J7/J8 signed-source orientation result.
- ECAD Forge must consume the published toolkit version, pass its full test,
  structured-data, and static-build gates, and render the exact route without
  the floating model.
