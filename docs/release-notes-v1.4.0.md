# altium-toolkit 1.4.0

Version 1.4.0 adopts parser-owned CircuitJSON and retained native extension
graphs through the CircuitJSON Toolkit 1.4 ownership boundary. It removes a
redundant defensive graph copy from successful document construction without
weakening validation or immutability.

## Owned convergence graphs

- The Altium convergence builder uses
  `DocumentResult.createValidatedOwned(fields, runtime?)` for graphs it has
  just constructed and exclusively owns.
- Ordinary CircuitJSON model and native extension nodes retain their identities
  and are deeply frozen in place. Binary properties continue through the
  shared defensive binary boundary.
- Raw input remains untrusted and is decoded and validated normally. The owned
  path is applied only after the format parser has produced a new standard
  local graph.

## API and compatibility

- Parser input, options, progress, cancellation, worker, and project contracts
  are unchanged.
- Successful parsing returns the same `ecad-toolkit.document.v1` envelope with
  the same `model`, `source`, `extensions`, `assets`, `diagnostics`, and
  `statistics` fields.
- Canonical, metadata, full native-model, and empty extension selections retain
  their existing behavior and return shapes.
- No class, method, parameter, package subpath, native extension, or renderer
  behavior is removed or renamed.

## Performance verification

The shared ownership regressions verify retained identity, deep freeze,
bounded extension sealing, mutation isolation, binary protection, and direct
and worker result parity. The Altium parser and packed cross-toolkit suites
continue to validate the public envelope and renderer contracts.
