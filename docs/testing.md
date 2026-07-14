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

Run all convergence and release gates:

```bash
npm run check:features
npm run check:features -- --strict
npm run check:performance
npm run check:format
npm pack --dry-run
```

The strict feature check creates an isolated packed install and packs the
currently installed CircuitJSON dependency beside the Altium candidate. This
keeps the isolated contract gate aligned with the dependency declared by the
active release instead of a stale version-specific fixture. It verifies all
historical native source and extension contracts, checks the exact
package/subpath layout, and runs the shared observable toolkit contract against
the packed package.

The performance check is bound to the immutable 1.1.41 commit, source tree,
and native-source manifest. It measures legacy and canonical projections of
the same synthetic inputs. Default canonical parsing must stay inside both a
relative budget and a small envelope-construction allowance scaled by actual
project document count. Direct async execution, metadata/full asset modes, and
the shared worker-protocol round trip have independent gates. Full and large
native extension materialization have separate absolute gates. The native
schematic facade also has a checksum-parity and relative-overhead gate against
the manifest-pinned historical renderer. `npm test` validates the complete
benchmark contract and equivalent projections without treating concurrent-suite
wall-clock noise as a release result; `npm run check:performance` is the
isolated timing gate used for release acceptance.

The tests cover:

- Exact 17-class root, common subpath contracts, and collision-free 167-native
  plus 37-shared extension union with `AltiumExtensionResolver`
- Canonical parser/project envelopes, option modes, errors, progress,
  cancellation, archive limits, companion assets, and direct/worker parity
- Nonempty `tryLoad()` failure diagnostics while preserving supplied rows
- Explicit native-model resolution without legacy fields on canonical results
- Canonical/native project-string parity, hidden-designator rendering without
  input mutation, renderer parity, and the exact historical renderer hash
- Worker auto-fallback authorization and visible parser/protocol failures
- CircuitJSON conversion with exactly one native parse per request
- Large native-extension ownership, worker round trips, and bounded rejection
- Immutable 1.1.41 API, asset, and native-source baselines plus all 1,302
  generated feature mappings
- Binary and OLE helpers
- Printable and binary Altium parser recovery for `.SchDoc`, `.PcbDoc`,
  `.PCBDwf`, `.SchLib`, `.PcbLib`, `.PrjPcb`, `.PrjScr`, and `.IntLib`
  entrypoints
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
