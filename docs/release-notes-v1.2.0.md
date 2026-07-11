<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Altium Toolkit 1.2.0

Version 1.2.0 is the breaking API-convergence release. It aligns
`altium-toolkit` with the CircuitJSON, Gerber, and KiCad toolkit contracts while
retaining every audited 1.1.41 feature.

## API changes

- The root now exports exactly the 17 shared classes: `Parser`,
  `ProjectLoader`, `CircuitJsonDocument`, `CircuitJsonDocumentContext`,
  `CircuitJsonIndexer`, `CircuitJsonUnits`, three renderers,
  `PcbInteractionIndex`, `QueryService`, `ManufacturingService`,
  `SimulationService`, two scene classes, `ToolkitCapabilities`, and
  `ToolkitError`.
- `Parser.parse()` now accepts `{ fileName, data, assets? }` plus a common
  options object. It returns `ecad-toolkit.document.v1`, not a bare model array.
  CircuitJSON is available at `document.model`.
- `Parser.parseAsync()`, `Parser.tryParse()`, and `Parser.supports()` use the
  same names, options, error model, progress rows, cancellation, and worker
  behavior as the other toolkits.
- The `/parser` subpath now has the exact shared export key set, including
  `CircuitJsonDocumentContext` for validation/index reuse.
- `ProjectLoader.load()`, `loadAsync()`, `tryLoad()`, and `supports()` return
  the common `ecad-toolkit.project.v1` envelope and enforce shared path and
  archive limits over both entry payloads and attached assets.
- The `/project` entrypoint now has the exact shared key set, including
  `ZipArchiveInspector` for bounded central-directory ZIP preflight.
- `ProjectLoader.tryLoad()` preserves supplied diagnostics and synthesizes one
  canonical error diagnostic when a failure otherwise has none.
- Project loading resolves referenced schematic project strings directly in
  canonical CircuitJSON and in an explicitly retained native model. Compact
  `.PrjPcb` parameters and document ownership are available through
  `altium.project-context`, while `extensions: 'none'` keeps the same resolved
  canonical model without exposing source-specific context.
- Direct async progress callbacks preserve host-thrown error identity; null is
  the only explicit absent signal value, and all other non-`AbortSignal` values
  are rejected consistently.
- Project extensions now follow the same `none`, `metadata`, `canonical`,
  `full`, and explicit feature-id selection behavior as document parsing.
- `extensions: 'none'` and an empty selection now return the exact common empty
  map `{}` instead of an Altium metadata placeholder.
- `AltiumExtensionResolver.nativeModel(document)` resolves an explicitly
  retained native model while leaving the canonical document envelope intact.
- Explicit native models, including realistic large PCB graphs, are captured
  once as bounded immutable extension data and round-trip through the shared
  worker protocol without the former generic metadata ceiling.
- Shared descriptor-safe asset preparation rejects accessors and sparse lists,
  performs zero payload copies in metadata mode, one defensive snapshot in full
  mode, and accounts for attached payloads before archive-limit allocation.
- Common render, interaction, query, manufacturing, simulation, and scene
  operations use CircuitJSON internally and accept reusable
  `CircuitJsonDocumentContext` instances.
- Canonical schematic projection now preserves native rectangles, circles,
  arcs, cubic Beziers, polygons, text frames, tables, ownership, style, and
  source drawing order. Curves use the shared 24-segment Bezier, 48-point
  ellipse, and 7.5-degree elliptical-arc sampling contracts.
- Hierarchical child sheets are `schematic_sheet_symbol` elements with
  `source_file_name`; their ports reference `schematic_sheet_symbol_id`, so
  multiple children no longer replace or hide root-sheet graphics.
- Embedded schematic images are asset-backed `schematic_image` elements.
  Exact decoded bytes live once in document `ToolkitAsset` rows, while missing
  external references preserve source metadata and emit a diagnostic without
  an inline Base64 payload, placeholder, or implicit network request.
- Electrical line classification is now explicit: native record-27 segments
  are projected with `sourceType: 'wire'`, while artwork with net-like metadata
  stays graphical. Mixed schematic/PCB documents retain every PCB
  `source_trace` relation when the schematic projection is rebuilt.
- `worker: 'auto'` falls back only for an exactly authorized worker-construction
  failure. Parser, protocol, post, validation, cancellation, and runtime errors
  are never hidden by a direct retry.
- Common worker and stylesheet paths are now
  `altium-toolkit/workers/parser.worker.mjs` and
  `altium-toolkit/styles/renderers.css`.

## Feature preservation

- All 167 unique historical exports and their exact static/prototype contracts
  remain at `altium-toolkit/extensions`. The same entrypoint also re-exports all
  37 shared source-neutral extension helpers and the convergence resolver, for
  a collision-free total of 205.
- The historical Altium worker and stylesheet remain at the namespaced
  extension asset paths.
- All 275 native `src/core` and `src/ui` modules are byte-identical to the
  immutable 1.1.41 Git tree.
- `SchematicSvgRenderer` at the extension entrypoint is now a convergence
  facade with the same public contract. It honors hidden source designators
  before delegating to the byte-identical historical renderer, so applications
  no longer need a render-only clone/rewrite workaround.
- The generated preservation ledger contains 1,302 exact mappings. It is
  derived from independently pinned API, asset, and native-source artifacts and
  verified against both the worktree and an isolated packed install.

Before:

```js
import { AltiumParser } from 'altium-toolkit/parser'

const model = AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
```

After, canonical:

```js
import { Parser } from 'altium-toolkit'

const document = Parser.parse({ fileName, data: arrayBuffer })
const model = document.model
```

After, retained native API:

```js
import { AltiumParser } from 'altium-toolkit/extensions'

const legacyModel = AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
```

## Extension modes and performance

The native parser executes exactly once per canonical request. Default
`extensions: 'canonical'` returns compact source summary metadata, avoiding a
deep clone of the complete native project tree. Use `extensions: 'full'`,
`preserveRaw: true`, or `extensions: ['altium.native-model']` when the full
native read model is required.

Performance checks are pinned to the immutable 1.1.41 native-source manifest.
They compare legacy and canonical document/project projections, enforce bounded
canonical overhead, scale project overhead by actual document count, and
separately gate async parsing, metadata/full assets, worker protocol throughput,
explicit full/large extension materialization, and native renderer-facade
overhead with checksum parity against the historical renderer.

## Package and verification

- Requires `circuitjson-toolkit ^1.1.0` and Node.js 20 or newer.
- Adds `altium-toolkit/testing` for the shared packed conformance harness.
- Full legacy tests, canonical contract tests, strict feature preservation,
  packed-install verification, formatting, package contents, and performance
  gates must all pass before publication.

See [API](api.md), [capabilities](capabilities.md), and the complete
[migration mapping](migration.md).
