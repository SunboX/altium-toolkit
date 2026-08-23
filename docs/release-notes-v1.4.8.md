# altium-toolkit 1.4.8

Version 1.4.8 corrects embedded STEP placement for bottom-side components and
for package owners recovered after initial scene construction.

## Signed STEP source orientation

- Embedded STEP registry entries expose signed source bounds derived from the
  model payload and its declared length units.
- Bottom-side models whose geometry is predominantly below the authored origin
  preserve their authored half-turn instead of being normalized upside down.
- Direct scene construction and asynchronous scene preparation share the same
  convergence registry and builder path.

## Late-owner model seating

- Final placement owners are reconciled with their original component-body
  metadata after historical ownership adapters complete.
- A finite zero authored standoff clears only an unchanged positive source
  `dzMil`, allowing the shared viewer's model-bounds seating to place the model
  on the PCB surface.
- Positive authored standoffs, unresolved bodies, downstream-adjusted offsets,
  and unrelated model transformations remain unchanged.
- The rule is derived from ownership and placement metadata without component,
  model, vendor, package, project, or fixture-specific matching.

## Compatibility

- Historical native source remains frozen; the corrections live in the public
  convergence layer.
- Existing parser, renderer, extension, and viewer scene contracts remain
  unchanged.

## Verification

- Repository-owned fake regressions cover signed-source bottom half-turns,
  zero-standoff late owners, positive authored standoffs, unresolved bodies,
  and downstream-adjusted offsets.
- Exact local-board verification checks the affected model seating together
  with the previously reported bottom connector orientation.
- Release gates include the complete package suite, formatting check, npm dry
  run, ECAD Forge integration tests, structured-data check, and static build.
