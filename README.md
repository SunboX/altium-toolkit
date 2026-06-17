<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Altium Toolkit

Altium Toolkit is an ESM JavaScript library for parsing native Altium
schematic and PCB documents and rendering deterministic, non-interactive
outputs from the recovered model.

The package was extracted from [ECAD Forge](https://ecadforge.app/), where it
is used for browser-based Altium document parsing and deterministic render
output. It is also used in [PCB Styler](https://pcb-styler.app/). Its parser
behavior, normalized model shape, and renderer output can be reused by other
browser or Node-based tools.

## Features

- Parse standalone native `.SchDoc`, `.PcbDoc`, `.SchLib`, `.PcbLib`,
  `.PrjPcb`, and `.IntLib` files from `ArrayBuffer`
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
    AltiumParser,
    SchematicSvgRenderer,
    PcbSvgRenderer,
    preparePcbSideResolvedRenderModel,
    BomTableRenderer,
    PcbScene3dBuilder
} from 'altium-toolkit'

const documentModel = AltiumParser.parseArrayBuffer(file.name, arrayBuffer)
const backRenderModel = preparePcbSideResolvedRenderModel(documentModel, {
    side: 'back'
})

const schematicMarkup = SchematicSvgRenderer.render(documentModel)
const pcbMarkup = PcbSvgRenderer.render(backRenderModel)
const bomMarkup = BomTableRenderer.render(documentModel.bom || [])
const sceneDescription = PcbScene3dBuilder.build(documentModel)
```

Optional renderer CSS is available through:

```js
import 'altium-toolkit/styles/altium-renderers.css'
```

## Documentation

- [API](docs/api.md)
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
