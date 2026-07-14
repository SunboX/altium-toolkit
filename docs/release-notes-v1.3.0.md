# altium-toolkit 1.3.0

Version 1.3.0 consumes the CircuitJSON Toolkit 1.2 shared contract and restores
the established schematic placeholder for unusable embedded image previews.

## Schematic image behavior

- The common `Parser` and `SchematicSvgRenderer` adapt the exact historical
  BMP-to-PNG representation when its decoded alpha coverage is strictly below
  one percent. Those rows use `unusable-embedded-payload`, preserve placement
  and source metadata, and render the existing missing-image placeholder.
- The adapter is owned by the convergence layer. The frozen 1.1.41 native
  parser and its extension API remain byte-identical and continue to expose the
  original recovered payload.
- Native wrapped PNG, JPEG, GIF, SVG, and WebP assets are unchanged. Malformed,
  unknown, differently encoded, and exactly one-percent-visible PNG data is
  also left untouched. Historical stored-zlib payloads must pass both the PNG
  chunk CRC and the zlib Adler-32 checksum before adaptation.
- Only affected image rows and their containing model branches are cloned.
  Alpha coverage is cached by immutable image identity, and warnings are
  deduplicated.

## Shared runtime

- `circuitjson-toolkit` now uses the `^1.2.0` runtime baseline, aligning Altium
  documents with the validated PCB text, drilled-pad geometry, and metadata
  consumed by the other source toolkits and the 3D viewer.
- Existing root exports, package subpaths, parser parameters, document/project
  envelopes, native extension APIs, and healthy image return shapes remain
  available. The unusable-image state is an additive common-view behavior.
