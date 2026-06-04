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
- `altium-toolkit/netlist-query`
- `altium-toolkit/renderers`
- `altium-toolkit/scene3d`
- `altium-toolkit/workers/altium-parser.worker.mjs`
- `altium-toolkit/styles/altium-renderers.css`

## Parser

```js
import { AltiumParser } from 'altium-toolkit/parser'

const circuitJson = AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
```

`fileName` is used to infer schematic, PCB document, PCB footprint-library, PCB
project, or integrated-library parsing from the extension. The parser accepts
native `.SchDoc`, `.PcbDoc`, `.PcbLib`, `.PrjPcb`, and `.IntLib` bytes as an
`ArrayBuffer` and returns a Circuit JSON element array. The returned array
carries non-serialized renderer-compatibility fields such as `kind`, `fileType`,
`schematic`, `pcb`, `pcbLibrary`, `project`, `integratedLibrary`, `summary`,
`diagnostics`, and `bom` so existing renderers can consume parser output
directly during the migration.

PCB parsing reads the main primitive streams together with sidecar streams such
as `PrimitiveParameters/Data`, `WideStrings6/Data`,
`ExtendedPrimitiveInformation/Data`, `CustomShapes/Data`, `UnionNames/Data`,
and `SmartUnions/Data`. Component parameters are joined by native primitive
unique id, modern `Texts6` designator records may resolve their display string
through the wide-string table, custom pad geometry is linked to anchor pads, and
smart-union memberships are attached to referenced primitives before the
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
`IntLibStreamExtractor`, `PcbBoardRegionSemanticsParser`,
`PcbComponentPrimitiveIndexer`, `PcbCustomPadShapeParser`,
`PcbDimensionParser`, `PcbEmbeddedFontExtractor`,
`PcbExtendedPrimitiveInformationParser`, `PcbFontMetricsParser`,
`LibraryRenderManifestBuilder`, `LibrarySearchIndex`,
`PcbOwnershipGraphBuilder`, `PcbPadStackParser`,
`PcbPickPlacePositionResolver`,
`ProjectAnnotationParser`, `ProjectDesignBundleBuilder`,
`ProjectNetlistExporter`, `ProjectVariantViewBuilder`,
`PcbMechanicalLayerPairParser`, `PcbSpecialStringResolver`, `PcbUnionParser`,
`PcbViaStackParser`, `PcbRuleParser`, `PcbRawRecordRegistry`,
`PcbStatisticsBuilder`, `SchematicOwnershipGraphParser`, and
`SchematicProjectParameterResolver`.
`PcbBoardRegionSemanticsParser` exposes the substack and bending-line
normalization used by `.PcbDoc` models. `PcbComponentPrimitiveIndexer` exposes
the native component-index grouping used to populate
`pcb.componentPrimitives` and `pcb.componentPrimitiveGroups`. The pad, via, and
rule helpers expose the same mask/cache, stack, and typed-constraint
normalization used by `.PcbDoc` parsing. `PcbDimensionParser` exposes the
parser-only Dimensions6 normalization used by `.PcbDoc` parsing.
`SchematicOwnershipGraphParser` and `PcbOwnershipGraphBuilder` expose the
read-only ownership sidecars that parser roots attach under
`schematic.ownership` and `pcb.ownership`.
`PcbPickPlacePositionResolver` exposes the component-origin and pad-anchor
coordinate modes used by the normalized `pnp` model.
`ProjectDesignBundleBuilder` composes separately parsed project, schematic, and
PCB models into a project-level JSON bundle, and
`ProjectVariantViewBuilder` applies DNP, alternate fitted rows, parameter
overrides, and annotation designator mappings to bundle BOM, PnP, component,
and net views. `ProjectAnnotationParser` parses read-only annotation mapping
files, and `ProjectNetlistExporter` emits deterministic wirelist and richer
JSON netlist contracts from normalized bundles. The JSON contract includes
schematic source sheets, graphical elements, aliases, terminal endpoints,
hierarchy paths, and PCB net-table provenance when present.
`PcbMechanicalLayerPairParser`
exposes the mechanical-layer flip map used by `.PcbDoc` parsing. The font
helpers expose the same
embedded font payload and metric shape that `.PcbDoc` and `.PcbLib` parsing adds
to normalized models. `PcbRawRecordRegistry` exposes immutable primitive stream
descriptors and the raw-record preservation helpers used by the PcbDoc/PcbLib
extractors.
`LibraryRenderManifestBuilder` and `LibrarySearchIndex` expose deterministic
SchLib/PcbLib render/export manifests plus exact, keyword, and fuzzy lookup
helpers. `PcbStatisticsBuilder` emits board QA summaries used by `.PcbDoc`
models. `SchematicProjectParameterResolver` resolves dot-prefixed and
equals-prefixed schematic special strings for parser and SVG integrations.

## Netlist Query

```js
import { LoadedDesignNetlistService } from 'altium-toolkit/netlist-query'

const service = new LoadedDesignNetlistService({
    getDocuments: () => [
        {
            id: 'active-sheet',
            active: true,
            documentModel
        }
    ]
})

const nets = service.searchNets({ pattern: 'i2c' })
```

The `netlist-query` entrypoint exposes browser-safe helpers for loaded document
inspection: `LoadedDesignNetlistService`, `QueryNetlistBuilder`,
`CircuitTraversal`, `ComponentGrouping`, `MPN_MISSING_NOTE`, and
`RegexPattern`.

The service accepts host-provided loaded document entries and returns plain
JSON-compatible query results. It can list designs, components, and nets; search
components by reference designator, MPN, or description; query one component's
pin connections; and trace extended connectivity from a net or `REFDES.PIN`.
Normal user-query failures return `{ error: string }`.

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

- `SchematicSvgRenderer.render(documentModel, options)` returns schematic SVG
  markup. Pass `options.projectParameters` to resolve schematic special strings
  in visible text and title-block fields during rendering.
- `PcbSvgRenderer.render(documentModel)` returns PCB SVG markup.
- `PcbSvgRenderer.renderLayerSvgs(documentModel)` returns deterministic
  per-layer PCB SVG entries with layer descriptors and layer-filtered SVG
  markup.
- `PcbSideResolvedRenderModel.resolve(documentModel, { side })` and
  `preparePcbSideResolvedRenderModel(documentModel, { side })` return a
  side-specific PCB render model for top-oriented renderers. Use
  `side: 'back'` to project bottom components, documentation layers, copper
  primitives, vias, and pad stack geometry into the top-facing render surface.
- `BomTableRenderer.render(rows)` returns grouped BOM table markup.

Renderer output is deterministic string markup. The library does not attach DOM
events or mutate a host document.

Schematic SVG output includes stable semantic `data-*` attributes on recovered
wire, label, pin, and fallback component elements when source metadata is
available. The embedded `schematic-semantic-metadata` JSON sidecar uses schema
`altium-toolkit.schematic.svg.semantics.a1` and links element keys to nets,
components, and pins for downstream highlighting.

PCB SVG output includes stable semantic `data-*` attributes on recovered board,
copper, pad, via, component, and text elements. The embedded
`pcb-semantic-metadata` JSON sidecar uses schema
`altium-toolkit.pcb.svg.semantics.a1` and links SVG element keys to primitive
kind, layer, net/class, component, pad number, hole ownership, and board-outline
identity where that metadata is available. The same sidecar also records view
context, including board centroid, included layer ids, layer roles, cutouts, and
pad/via drill render state (`open`, `covered`, `filled`, or `capped`).
`PcbSvgRenderer.renderLayerSvgs()` uses the same semantic sidecar shape with
`view.kind: 'layer'` and a layer-specific `layerSet`.

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
  It includes refined board-region outlines when a recovered outline is a
  rasterized stair-step fallback, and each silkscreen side exposes
  `drillCutouts` plus fill holes for drilled pads and vias. External model
  placements include `projection` diagnostics indicating whether bounds came
  from authored overrides, resolved model bounds, nearby pad spans, procedural
  component fallback, or only the model anchor.
- `PcbScene3dModelRegistry` resolves embedded or session model candidates for
  component placements.
- `PcbScene3dScenePreparator.prepare(documentModel, options)` prepares the same
  scene-description data behind an async API suitable for host workers.
- `PcbScene3dSummaryRenderer.render(documentModel)` returns static 3D summary
  HTML.

The library intentionally does not create Three.js objects, canvases, controls,
or event listeners.
