<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Testing

Exporter tests use only synthetic component responses and generated OLE
streams. Do not add native customer files or provider-derived raw fixtures.
When exercising source lookup, inject a fake fetcher/client and assert emitted
entries, progress events, checkpoints, diagnostics, and OLE round trips.

Run the complete suite:

```bash
npm test
```

The tests cover:

- Binary and OLE helpers
- Printable and binary Altium parser recovery for `.SchDoc`, `.PcbDoc`,
  `.PcbLib`, `.PrjPcb`, and `.IntLib` entrypoints
- PCB primitive stream slicing and focused decoders for tracks, fills, arcs,
  vias, pads, text, regions, rules, raw records, board regions, ownership
  indexes, sidecar PrimitiveParameters/Text tables, extended primitive
  information, custom pad shapes, union metadata, and embedded font metadata
- Obfuscated fake schematic and PCB fixture shards
- Schematic SVG, side-resolved PCB SVG, BOM HTML, and static 3D summary
  renderers
- Non-interactive PCB 3D scene-description builders and model registry logic

Fixture data must remain repo-owned and obfuscated. Do not add native provided
Altium files, real customer identifiers, real vendor identifiers, or
source-descriptive fixture names. The machine-readable
`tests/fixtures/fixture-manifest.json` catalog tracks synthetic fixture coverage
areas and must keep `assetPolicy` set to `repo-owned-synthetic-only`. Each
fixture entry records `source: inline-synthetic-records` plus expected parser,
SVG, schema, and diagnostic contracts so tests can catch drift between fake
fixtures and public read-model coverage.
`FixtureCoverageMatrixBuilder` can turn the manifest into a machine-readable
required-coverage report without adding native fixture files.
