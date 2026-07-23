<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Altium Toolkit

Altium Toolkit is the native Altium decoder in the common ECAD toolkit family.
It parses Altium files into immutable CircuitJSON document envelopes and common
project envelopes, and exposes the same parser, renderer, interaction, query,
simulation, 3D scene, capability, error, and worker contracts as
`circuitjson-toolkit`, `gerber-toolkit`, and `kicad-toolkit`.

The package was extracted from [ECAD Forge](https://ecadforge.app/), where it
is used for browser-based Altium document parsing and deterministic render
output. It is also used in [PCB Styler](https://pcb-styler.app/). Its parser
behavior, normalized model shape, and renderer output can be reused by other
browser or Node-based tools. Parsing and all default services are local-only.

## Breaking API convergence

Version 1.2.0 intentionally changes root names, parameters, return shapes, and
package subpaths. The root now contains the exact 17-class shared toolkit
surface, and `Parser.parse()` returns an `ecad-toolkit.document.v1` envelope whose `model`
is CircuitJSON. No Altium feature was deleted: all 1.1.41 exports and public
members remain under `altium-toolkit/extensions`, alongside the 37 shared
source-neutral extension helpers, with the exhaustive native mapping in the
[migration guide](docs/migration.md).

Version 1.2.1 keeps Three.js as an example-only development dependency. The
published parser and CircuitJSON services do not install a second, unused
Three.js runtime into host applications.

Version 1.3.0 updates the common runtime baseline to CircuitJSON Toolkit 1.2
and adapts effectively invisible historical 32-bit BMP previews at the common
convergence boundary. The public parser and renderer now show the existing
missing-image placeholder for those unusable payloads without changing the
frozen native parser or healthy embedded images. See the
[1.3.0 release notes](docs/release-notes-v1.3.0.md).

Version 1.4.0 adopts newly decoded CircuitJSON and native extension graphs at
the shared validation boundary. Their ordinary nodes retain identity and are
deeply frozen without a redundant defensive graph copy. Parser parameters,
document envelopes, extension fields, and return shapes remain unchanged. See
the [1.4.0 release notes](docs/release-notes-v1.4.0.md).

Version 1.4.1 re-exports the canonical `SelfAdjustingComputation` runtime from
CircuitJSON Toolkit 1.4.1. Persistent Altium consumers can retain dependency
traces across input edits without changing parser, document, renderer, or
native-extension contracts. See the
[1.4.1 release notes](docs/release-notes-v1.4.1.md).

Version 1.4.2 rebuilds project-resolved canonical documents through the
toolkit-owned validation path and CircuitJSON Toolkit 1.4.2. Large native
extension graphs retain their proven ownership instead of repeating defensive
binary classification. See the
[1.4.2 release notes](docs/release-notes-v1.4.2.md).

Default `extensions: 'canonical'` keeps compact Altium summary metadata.
Request the complete native read model with `extensions: 'full'`,
`preserveRaw: true`, or `extensions: ['altium.native-model']`. Project batches
resolve referenced schematic project strings consistently in canonical
CircuitJSON and an explicitly retained native model; select
`altium.project-context` only when the compact native parameter/document facts
are also needed.
`extensions: 'none'` and an empty selection return the exact common
`extensions: {}` shape on documents and projects.

Hosts that need an Altium-only renderer for details not represented by
CircuitJSON can resolve the explicit extension without changing the canonical
document shape:

```js
import { Parser } from 'altium-toolkit'
import { AltiumExtensionResolver } from 'altium-toolkit/extensions'

const document = Parser.parse(input, {
    extensions: ['altium.native-model']
})
const nativeModel = AltiumExtensionResolver.nativeModel(document)
```

`document` remains an immutable `ecad-toolkit.document.v1` result; native
`schematic` and `pcb` fields are never copied onto it.

`SchematicSvgRenderer` from `altium-toolkit/extensions` is the native
convergence renderer. It honors recovered component-designator visibility and
delegates to the provenance-pinned historical renderer without requiring a
host to clone or rewrite the native model.

The common parser now projects native schematic rectangles, rounded
rectangles, circles and ellipses, arcs, Beziers, polygons, text frames, tables
when present, hierarchical child-sheet symbols, and ordinary text into the
same CircuitJSON rows used by KiCad. Component ownership, stroke/fill style,
geometry, and stable render order are retained. Embedded schematic image bytes
are owned once as `ToolkitAsset` records with `kind: 'schematic-image'`; their
`schematic_image` rows reference `asset_id` and retain source path, bounds,
aspect policy, and order without duplicating base64 data in the model.
Only native wire records become canonical electrical traces; graphical lines
remain artwork even when they carry net-like metadata, and PCB source-trace
relations are preserved unchanged in mixed documents.

## Features

- Exact common `Parser` and `ProjectLoader` contracts with immutable
  CircuitJSON document envelopes, common project envelopes, progress,
  cancellation, archive limits, ZIP preflight inspection, and workers
- Shared CircuitJSON context, rendering, interaction, query, manufacturing,
  injected simulation, and right-handed Z-up 3D scene services
- One native Altium parse per canonical request; compact default extensions
  avoid cloning the complete native tree unless explicitly requested
- Explicit large native extensions are captured once as bounded immutable
  CircuitJSON document data and survive the shared worker protocol
- Machine-readable capability inventory, packed conformance harness,
  provenance-bound performance gates, and explicit `/extensions` compatibility
- Parse standalone native `.SchDoc`, `.PcbDoc`, `.PCBDwf`, `.SchLib`,
  `.PcbLib`, `.PrjPcb`, `.PrjScr`, and `.IntLib` files from `ArrayBuffer`
- Recover schematic records, PCB outlines, placements, schematic library
  symbols, PCB library footprints,
  project document references, variants, parameters, primitives, embedded
  schematic images, component annotations from PrimitiveParameters/Text streams,
  PCB pad/via stack and hole-tolerance detail, via-protection sidecars, custom
  pad shape links, extended mask/paste sidecars, PCB union metadata, embedded
  PCB 3D payload metadata, PCB component provenance, differential-pair class
  joins, schematic directive semantics, barcode PCB text metadata, mechanical
  layer pairs, pick-and-place coordinate modes, PCB dimensions, embedded-board
  panel placements, placement rooms, project
  class-generation policy, project-level design bundles, annotation mappings,
  effective variant views, schematic/PCB ownership sidecars, deterministic
  wirelist/netlist exports, library render manifests, library lookup indexes,
  library catalog artifacts, project hierarchy reports,
  schematic-library section keys, pin side streams, compressed storage assets,
  schematic project-parameter text resolution, PCB QA statistics, structured
  diagnostics, and embedded PCB/PcbLib font payloads with basic text metrics
- Project rich native schematic graphics and asset-backed images directly into
  the shared CircuitJSON renderer contract, including distinct hierarchical
  `schematic_sheet_symbol` rows whose child file names do not become page rows
- Preserve raw PCB primitive records through a read-only record registry so
  unsupported or partially decoded stream data remains inspectable; native OLE
  stream inventories summarize known, unknown, consumed, and opaque streams
- Build deterministic parser field-coverage matrix, raw-data preservation,
  parameter-record inventory, parser value-verification, normalized
  diagnostics, geometry-bounds, fixture-coverage, embedded-asset,
  library-diff, library-compatibility, library-QA lint, project-hierarchy, and
  static library-catalog reports, classify PCB layer ids, and convert common
  Altium length units for downstream QA tooling
- Emit Circuit JSON arrays from parser roots, with non-serialized
  renderer-compatibility fields for existing consumers
- Render semantically annotated schematic SVG, semantically annotated PCB SVG,
  deterministic per-layer PCB SVG exports, and grouped BOM HTML
- Build non-interactive PCB 3D scene-description data for host applications,
  including refined board outlines, silkscreen drill cutouts, and external
  model projection diagnostics
- Render a static 3D board summary
- Run entirely with local input data; no network calls are made by the parser

## Install

The package is published on npm as
[`altium-toolkit`](https://www.npmjs.com/package/altium-toolkit).

```bash
npm install altium-toolkit
```

GitHub Packages releases are published as `@sunbox/altium-toolkit`. Configure
the GitHub Packages registry for the `@sunbox` scope before installing:

```bash
npm config set @sunbox:registry https://npm.pkg.github.com
npm install @sunbox/altium-toolkit
```

## Usage

```js
import {
    CircuitJsonDocumentContext,
    Parser,
    PcbInteractionIndex,
    PcbScene3dBuilder,
    PcbSvgRenderer,
    QueryService
} from 'altium-toolkit'

const document = await Parser.parseAsync(
    { fileName: file.name, data: arrayBuffer },
    {
        worker: 'auto',
        onProgress: ({ stage }) => console.log(stage)
    }
)
const context = CircuitJsonDocumentContext.prepare(document, {
    indexes: ['elements', 'relations', 'connectivity', 'spatial']
})

const pcbMarkup = PcbSvgRenderer.render(context, { side: 'bottom' })
const hits = PcbInteractionIndex.create(context).hitTest({ x: 10, y: 5 })
const components = QueryService.create(context).query({
    select: 'components'
})
const sceneDescription = PcbScene3dBuilder.build(context)

console.log(document.model, pcbMarkup, hits, components.items, sceneDescription)
```

Optional renderer CSS is available through:

```js
import 'altium-toolkit/styles/renderers.css'
```

Use the retained native API deliberately when needed:

```js
import { AltiumParser, AltiumSchLibExporter } from 'altium-toolkit/extensions'

const legacyCircuitJson = AltiumParser.parseArrayBuffer(file.name, arrayBuffer)
```

## Documentation

- [API](docs/api.md)
- [Capabilities](docs/capabilities.md)
- [Migration from 1.1.41](docs/migration.md)
- [1.4.2 release notes](docs/release-notes-v1.4.2.md)
- [1.4.1 release notes](docs/release-notes-v1.4.1.md)
- [1.4.0 release notes](docs/release-notes-v1.4.0.md)
- [1.3.0 release notes](docs/release-notes-v1.3.0.md)
- [1.2.1 release notes](docs/release-notes-v1.2.1.md)
- [1.2.0 release notes](docs/release-notes-v1.2.0.md)
- [Model Format](docs/model-format.md)
- [Normalized Model Schema](docs/schemas/altium_toolkit/normalized_model_a1.schema.json)
- [Project Bundle Schema](docs/schemas/altium_toolkit/project_bundle_a1.schema.json)
- [Netlist Schema](docs/schemas/altium_toolkit/netlist_a1.schema.json)
- [Parser Diagnostics Schema](docs/schemas/altium_toolkit/parser_diagnostics_a1.schema.json)
- [Parser Value Verification Schema](docs/schemas/altium_toolkit/parser_value_verification_a1.schema.json)
- [Geometry Bounds Schema](docs/schemas/altium_toolkit/geometry_bounds_a1.schema.json)
- [Fixture Coverage Matrix Schema](docs/schemas/altium_toolkit/fixture_coverage_matrix_a1.schema.json)
- [Unsupported Features Schema](docs/schemas/altium_toolkit/unsupported_features_a1.schema.json)
- [Library Compatibility Schema](docs/schemas/altium_toolkit/library_compatibility_a1.schema.json)
- [Testing](docs/testing.md)
- [Scope](spec/library-scope.md)
- [Library Compatibility Reports](spec/library-compatibility.md)

## Examples

- Read-only utility scripts:
  `examples/inspect-board.mjs`, `examples/extract-bom.mjs`,
  `examples/generate-pnp.mjs`, `examples/net-report.mjs`,
  `examples/library-catalog.mjs`, `examples/validate-library.mjs`, and
  `examples/corpus-smoke.mjs`
- [Arduino Uno Altium example](examples/arduino-uno/) based on Mehdi
  KHALFALLAH's public
  [My-Arduino-UNO-Design](https://github.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design)
  project. The example fetches credited source documents from
  `raw.githubusercontent.com` at runtime and does not redistribute them.

Run the local example server with:

```bash
npm start
```

## Test

```bash
npm test
npm run check:features -- --strict
npm run check:performance
npm run check:format
```

The test suite uses repo-owned, obfuscated fixture shards only. Do not add
native customer, vendor, or source project files to this repository.

## License

This project is available under two licensing options.

### 1. Open-source software license

GNU General Public License v3.0 or later (`GPL-3.0-or-later`).

You may use, modify, and distribute this project under the GPL. If you
distribute modified versions or larger works based on this project, they must
comply with the GPL, including source-code availability requirements.

### 2. Commercial/proprietary license

For use in closed-source, proprietary, or otherwise GPL-incompatible products,
a separate paid commercial license is required.

Commercial licensing contact: https://github.com/SunboX

### Documentation and notices

Documentation and non-code text are licensed under Creative Commons
Attribution-ShareAlike 4.0 (`CC-BY-SA-4.0`) unless otherwise marked.

Copyright (C) 2026 André Fiedler.

Copyright, license, attribution, and source-origin notices must be preserved as
required by the GPL, CC-BY-SA-4.0, and the notice files in this repository.
See [LICENSE](LICENSE), [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md), and
[NOTICE.md](NOTICE.md).
