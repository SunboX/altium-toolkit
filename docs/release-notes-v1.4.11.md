# altium-toolkit 1.4.11

Version 1.4.11 restores complete native schematic fidelity for embedded
template frames, footer metadata, signal harnesses, and rotated passive text.

## Native schematic fidelity

- Structurally proven embedded template dimensions remain the authored render
  frame instead of being replaced by a sparse-content estimate.
- Complete footer owner groups resolve organization, address, approval, and
  other native metadata rows from the ownership sidecar.
- Signal harness trunks, connector brackets, entries, and type labels render as
  first-class SVG primitives with native additional-list ownership.
- Right-side vertical component parameters clear narrow passive bodies while
  left-side designators retain their authored columns.

## Compatibility

- Historical parser and renderer sources remain byte-for-byte frozen.
- Repairs are isolated to the convergence layer used by current toolkit
  consumers and do not change public parser or renderer signatures.
- Geometry and ownership decisions derive from native structure rather than
  project names, labels, filenames, or fixture-specific values.
- Existing schematic theme variables, palette behavior, canvas border, and
  title-block chrome remain unchanged.

## Verification

- Obfuscated repository-owned regressions cover native-frame proof, complete
  footer owners, implicit harness children, themed harness SVG, and vertical
  passive annotation columns.
- The complete package suite, immutable-source checks, feature-preservation
  check, formatting check, performance guard, and npm package dry run are
  required for release.
