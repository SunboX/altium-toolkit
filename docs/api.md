<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# API

## Entrypoints

`altium-toolkit` exports the supported parser, renderer, and 3D
scene-description classes from one entrypoint.

Specialized entrypoints are also available:

- `altium-toolkit/parser`
- `altium-toolkit/renderers`
- `altium-toolkit/scene3d`
- `altium-toolkit/workers/altium-parser.worker.mjs`
- `altium-toolkit/styles/altium-renderers.css`

## Parser

```js
import { AltiumParser } from 'altium-toolkit/parser'

const circuitJson = AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
```

`fileName` is used to infer schematic, PCB document, PCB footprint-library, or
PCB project parsing from the extension. The parser accepts native `.SchDoc`,
`.PcbDoc`, `.PcbLib`, and `.PrjPcb` bytes as an `ArrayBuffer` and returns a
Circuit JSON element array. The returned array carries non-serialized
renderer-compatibility fields such as `kind`, `fileType`, `schematic`, `pcb`,
`pcbLibrary`, `project`, `summary`, `diagnostics`, and `bom` so existing
renderers can consume parser output directly during the migration.

PCB parsing reads the main primitive streams together with sidecar streams such
as `PrimitiveParameters/Data` and `WideStrings6/Data`. Component parameters are
joined by native primitive unique id, and modern `Texts6` designator records may
resolve their display string through the wide-string table before the
normalized component list and BOM are built.

```js
import { CircuitJsonModelSchema } from 'altium-toolkit/parser'

if (!CircuitJsonModelSchema.isModel(circuitJson)) {
    throw new Error('Unsupported Circuit JSON model')
}
```

Use `AltiumParser.parseArrayBufferToRendererModel(fileName, arrayBuffer)` when
an integration still needs the legacy renderer model object. The
`CircuitJsonModelAdapter` export also exposes `fromRendererModel()`,
`toRendererModel()`, and `isCircuitJson()` for explicit conversions.

Specialized parser helpers are exported for lower-level integrations, including
`PcbBoardRegionSemanticsParser`, `PcbComponentPrimitiveIndexer`,
`PcbEmbeddedFontExtractor`, `PcbFontMetricsParser`, `PcbPadStackParser`,
`PcbViaStackParser`, `PcbRuleParser`, and `PcbRawRecordRegistry`.
`PcbBoardRegionSemanticsParser` exposes the substack and bending-line
normalization used by `.PcbDoc` models. `PcbComponentPrimitiveIndexer` exposes
the native component-index grouping used to populate
`pcb.componentPrimitives` and `pcb.componentPrimitiveGroups`. The pad, via, and
rule helpers expose the same mask/cache, stack, and typed-constraint
normalization used by `.PcbDoc` parsing. The font helpers expose the same
embedded font payload and metric shape that `.PcbDoc` and `.PcbLib` parsing adds
to normalized models. `PcbRawRecordRegistry` exposes immutable primitive stream
descriptors and the raw-record preservation helpers used by the PcbDoc/PcbLib
extractors.

## Renderers

```js
import {
    SchematicSvgRenderer,
    PcbSvgRenderer,
    PcbSideResolvedRenderModel,
    preparePcbSideResolvedRenderModel,
    BomTableRenderer
} from 'altium-toolkit/renderers'
```

- `SchematicSvgRenderer.render(documentModel)` returns schematic SVG markup.
- `PcbSvgRenderer.render(documentModel)` returns PCB SVG markup.
- `PcbSideResolvedRenderModel.resolve(documentModel, { side })` and
  `preparePcbSideResolvedRenderModel(documentModel, { side })` return a
  side-specific PCB render model for top-oriented renderers. Use
  `side: 'back'` to project bottom components, documentation layers, copper
  primitives, vias, and pad stack geometry into the top-facing render surface.
- `BomTableRenderer.render(rows)` returns grouped BOM table markup.

Renderer output is deterministic string markup. The library does not attach DOM
events or mutate a host document.

## 3D Scene Data

```js
import {
    PcbScene3dBuilder,
    PcbScene3dModelRegistry,
    PcbScene3dScenePreparator,
    PcbScene3dSummaryRenderer
} from 'altium-toolkit/scene3d'
```

- `PcbScene3dBuilder.build(documentModel, options)` returns procedural board,
  placement, copper, silkscreen, and external-model scene-description data.
- `PcbScene3dModelRegistry` resolves embedded or session model candidates for
  component placements.
- `PcbScene3dScenePreparator.prepare(documentModel, options)` prepares the same
  scene-description data behind an async API suitable for host workers.
- `PcbScene3dSummaryRenderer.render(documentModel)` returns static 3D summary
  HTML.

The library intentionally does not create Three.js objects, canvases, controls,
or event listeners.
