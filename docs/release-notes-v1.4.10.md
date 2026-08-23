# altium-toolkit 1.4.10

Version 1.4.10 keeps complete authored schematic footer assemblies aligned when
a recovered standard sheet is wider than its stored native template.

## Native schematic footer alignment

- The convergence renderer detects structurally seeded native-footer owners
  across every supported schematic primitive family.
- Lines, shapes, text, and embedded images belonging to the same authored owner
  receive one shared effective right-edge translation.
- Multiple footer owners use the exact single offset computed by the preserved
  historical renderer, while unrelated and ownerless content remains fixed.

## Compatibility

- Historical native renderer and partitioner sources remain byte-for-byte
  frozen.
- The correction is a render-only convergence adaptation and does not mutate
  parsed documents or change public parser and renderer signatures.
- Detection derives from promoted-sheet metadata, authored ownership, and
  primitive geometry without matching project names, labels, or sample data.

## Verification

- Repository-owned fake regressions cover lower footer seeds, upper geometry,
  text, embedded images, multiple seeded owners, and unrelated content.
- The complete package suite, formatting check, performance guard, npm package
  dry run, and ECAD Forge integration gates are required for release.
