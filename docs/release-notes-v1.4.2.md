# altium-toolkit 1.4.2

Version 1.4.2 removes redundant immutable-extension validation from canonical
project document rebuilding. Parser output, project resolution, extension
selection, and renderer contracts remain unchanged.

## Faster project resolution

- `AltiumProjectDocumentResolver` rebuilds changed canonical documents through
  the shared toolkit-owned `DocumentResult` boundary.
- Already proven and frozen native extension graphs retain their identity when
  project parameters update canonical or retained-native schematic text.
- Defensive binary classification is no longer repeated across every record of
  a large owned extension graph.

## Dependency

- `circuitjson-toolkit` 1.4.2 supplies the owned-extension reuse and atomic
  cooperative structured-clone finalization behavior.
- Arbitrary caller data still uses the defensive shared validation path.

## Verification

- An inspector-backed regression bounds exception-driven binary brand probes
  during a project rebuild.
- The complete package suite, formatting, performance, feature-preservation,
  and npm dry-run gates verify the release.
