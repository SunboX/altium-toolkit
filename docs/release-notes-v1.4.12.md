# altium-toolkit 1.4.12

Version 1.4.12 preserves native schematic footer metadata when a project also
provides document-level special-string parameters.

## Project schematic fidelity

- Project parameters are resolved before the convergence fidelity pass so
  document context and native fallback metadata compose deterministically.
- Footer fallback values synchronize the visible text, resolved-text sidecar,
  and special-string expression before the historical renderer consumes them.
- Organization, address, approval, and other native owner metadata no longer
  regress to unresolved placeholders in complete project loads.

## Compatibility

- Historical parser and renderer sources remain byte-for-byte frozen.
- Existing schematic colors, canvas borders, title-block chrome, and public
  renderer signatures remain unchanged.
- Resolution derives from the ownership and parameter data models without
  project names, filenames, labels, or sample-specific rules.

## Verification

- A repository-owned generic regression covers project parameters combined
  with native footer metadata fallbacks.
- The complete package suite, immutable-source checks, feature-preservation
  check, formatting check, performance guard, and npm package dry run are
  required for release.
