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

`fileName` is used to infer schematic, PCB document, schematic symbol-library,
PCB footprint-library, PCB project, or integrated-library parsing from the
extension. The parser accepts native `.SchDoc`, `.PcbDoc`, `.SchLib`,
`.PcbLib`, `.PrjPcb`, and `.IntLib` bytes as an `ArrayBuffer` and returns a
Circuit JSON element array. The returned array carries non-serialized
renderer-compatibility fields such as `kind`, `fileType`, `schematic`, `pcb`,
`schematicLibrary`, `pcbLibrary`, `project`, `integratedLibrary`, `summary`,
`diagnostics`, and `bom` so existing renderers can consume parser output
directly during the migration.

PCB parsing reads the main primitive streams together with sidecar streams such
as `PrimitiveParameters/Data`, `WideStrings6/Data`,
`ExtendedPrimitiveInformation/Data`, `CustomShapes/Data`, `UnionNames/Data`,
`SmartUnions/Data`, `EmbeddedBoards6/Data`, and `Rooms6/Data`. Component parameters are joined by native primitive
unique id, modern `Texts6` designator records may resolve their display string
through the wide-string table, custom pad geometry is linked to anchor pads, and
smart-union memberships are attached to referenced primitives before the
normalized component list and BOM are built. Embedded-board and room streams are
promoted to read-only `pcb.embeddedBoards` and `pcb.rooms` collections when
present.

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
Use `AltiumParser.tryParseArrayBuffer()` or
`AltiumParser.tryParseArrayBufferToRendererModel()` when a batch integration
needs a non-throwing `{ ok, model, diagnostics }` envelope.

Specialized parser helpers are exported for lower-level integrations, including
`AltiumUnits`, `IntLibStreamExtractor`, `FixtureCoverageMatrixBuilder`,
`GeometryBoundsReportBuilder`,
`ParameterCollection`, `ParameterRecordInventoryBuilder`,
`ParserDiagnosticNormalizer`,
`ParserFieldCoverageReportBuilder`, `ParserValueVerificationReportBuilder`,
`ParserCompatibilityFuzzer`, `NativeStreamInventoryBuilder`,
`RawDataPreservationReportBuilder`, `UnsupportedFeatureReportBuilder`,
`EmbeddedAssetReportBuilder`, `LibraryDiffReportBuilder`,
`LibraryInspectionReportBuilder`,
`PcbBoardRegionSemanticsParser`, `PcbComponentPrimitiveIndexer`,
`PcbCustomPadShapeParser`, `PcbDimensionParser`, `PcbEmbeddedFontExtractor`,
`PcbExtendedPrimitiveInformationParser`, `PcbFontMetricsParser`,
`LibraryRenderManifestBuilder`, `LibraryCatalogArtifactBuilder`,
`LibrarySearchIndex`, `SchLibModelParser`, `SchLibStreamExtractor`,
`PcbBomProfileBuilder`, `PcbClassReportBuilder`,
`PcbInspectionReportBuilder`, `PcbLayerStackFidelityReportBuilder`,
`PcbLayerGroups`, `PcbNetMembershipReportBuilder`,
`PcbOwnershipGraphBuilder`, `PcbPadStackParser`,
`PcbPickPlacePositionResolver`, `ProjectAnnotationParser`,
`ProjectDesignBundleBuilder`, `ProjectHierarchyReportBuilder`,
`ProjectNetlistExporter`, `ProjectVariantViewBuilder`,
`PcbMechanicalLayerPairParser`, `PcbSpecialStringResolver`, `PcbUnionParser`,
`PcbViaStackParser`, `PcbRuleParser`, `PcbRawRecordRegistry`,
`PcbStatisticsBuilder`, `SchematicCodeSymbolParser`,
`SchematicOwnershipGraphParser`,
`SchematicProjectParameterResolver`, `SchematicRecordStreamParser`, and
`SchematicTextRunParser`.
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
`SchematicCodeSymbolParser` exposes auxiliary schematic code-symbol, entry,
text, and marker records through the parser root's `schematic.codeSymbols`
sidecar.
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
hierarchy paths, and PCB net-table provenance when present. Alias arrays include
explicit schematic labels and additive unnamed-net candidates when available.
`ProjectHierarchyReportBuilder` emits a deterministic sheet hierarchy report
from parsed project and schematic models, including roots, child sheet links,
missing-sheet diagnostics, cycles, repeated references, and sheet-entry names.
`PcbMechanicalLayerPairParser`
exposes the mechanical-layer flip map used by `.PcbDoc` parsing. The font
helpers expose the same
embedded font payload and metric shape that `.PcbDoc` and `.PcbLib` parsing adds
to normalized models. `PcbRawRecordRegistry` exposes immutable primitive stream
descriptors and the raw-record preservation helpers used by the PcbDoc/PcbLib
extractors.
`PcbBomProfileBuilder` exposes PCB-only BOM grouping and parameter alias
normalization. `PcbLayerStackFidelityReportBuilder` classifies layer-stack
source evidence and unsupported native-regeneration limits for deterministic
QA/reporting.
`PcbLayerGroups` classifies legacy PCB layer ids into stable groups such as
copper, overlay, paste, solder mask, mechanical, drill, and multi-layer for
filtering and reporting. It also exposes deterministic colors and draw
priorities for report and renderer-side layer ordering. `AltiumUnits` converts
common Altium lengths between mil, millimeter, inch, and raw fixed-point
coordinate units.
`ParserFieldCoverageReportBuilder` builds a deterministic report of observed,
mapped, missing, and unsupported native fields from explicit source records or
parser roots that carry source-record sidecars. Reports include a compact matrix
view with per-family coverage status and mapped-field ratios. Field matching is
case-insensitive, while report rows preserve observed source spelling.
`ParameterRecordInventoryBuilder` scans raw pipe/backtick parameter records into
delimiter-aware field rows, duplicate-key rollups, UTF-8 marker counts, and
typed scalar hints without changing parser semantics.
`ParameterCollection` exposes duplicate-preserving, case-insensitive typed
reads over parsed parameter fields for integrations that need local lookup
helpers without writer behavior.
`ParserValueVerificationReportBuilder` compares curated expected path/value
assertions against parser output, producing fixture-gate reports that classify
missing paths separately from mismatched values.
`ParserDiagnosticNormalizer` converts string, `Error`, and object diagnostics
into a shared envelope with stable `code`, `severity`, `message`, source stream,
record index, typed error kind, field, and context metadata. Typed parser error
classes include `AltiumParseError`, `AltiumCorruptFileError`, and
`AltiumUnsupportedFeatureError`.
`GeometryBoundsReportBuilder` emits `altium-toolkit.geometry-bounds.a1` reports
with deterministic axis-aligned bounds for common parsed schematic and PCB
primitive families. `FixtureCoverageMatrixBuilder` emits
`altium-toolkit.fixture-coverage-matrix.a1` reports from synthetic fixture
manifests, including required coverage/contract gaps and native-asset policy
status.
`RawDataPreservationReportBuilder` summarizes preserved raw primitive records
unknown records, and opaque schematic/library records without copying raw
payload bytes into the report. When parser roots carry native stream
inventories, it also reports known/unknown stream counts, unconsumed stream
counts, and stream byte totals separately from raw-record payload bytes.
`UnsupportedFeatureReportBuilder` emits
`altium-toolkit.unsupported-features.a1` summaries of unsupported record
families, unsupported or unparsed raw records, opaque preserved schematic rows,
and unsupported diagnostics across parser roots.
`NativeStreamInventoryBuilder` emits metadata-only OLE stream rows with byte
length, checksum, known/unknown classification, and consumed status.
`SchematicRecordStreamParser` exposes framed schematic stream parsing with
opaque-frame preservation for lower-level extractors.
`ParserCompatibilityFuzzer` runs deterministic malformed,
wrong-reader, and sparse-input cases against parser entrypoints for parser QA.
`EmbeddedAssetReportBuilder` emits unified embedded-asset inventories across
parser roots, and `LibraryDiffReportBuilder` compares parsed symbol and
footprint libraries by name, counts, and parameters.
`LibraryInspectionReportBuilder` composes library inventory and QA findings
into one stable artifact. `SchLibStreamExtractor` and `SchLibModelParser`
expose native schematic-symbol library recovery, including section keys,
file-header font metadata, pin side streams, compressed storage assets, and
implementation child rows where available.
`LibraryRenderManifestBuilder`, `LibraryCatalogArtifactBuilder`, and
`LibrarySearchIndex` expose deterministic SchLib/PcbLib render/export
manifests, static catalog artifacts, search metadata, plus exact, keyword, and
fuzzy lookup helpers. `PcbStatisticsBuilder`, `PcbNetMembershipReportBuilder`,
`PcbClassReportBuilder`, and `PcbInspectionReportBuilder` emit board QA,
net-ownership, class-membership, and combined inspection artifacts for
`.PcbDoc` models. `SchematicProjectParameterResolver` resolves dot-prefixed and
equals-prefixed schematic special strings for parser and SVG integrations.
`SchematicTextRunParser` parses schematic backslash suffix markers into display
text plus overline run metadata reused by pin and text rendering.

## Library Exporters

```js
import {
    SourceComponentClient,
    SourceComponentBundleNormalizer,
    SourceBundleExporter,
    AltiumSchLibExporter,
    AltiumPcbLibExporter,
    AltiumLibraryBatchExporter
} from 'altium-toolkit/parser'
```

The exporter surface is local-first and host-controlled:

- `SourceComponentClient` performs component search, component fetch, model
  asset fetch, retry, and response validation through an injected `fetcher`.
  It does not use global `fetch` implicitly.
- `SourceComponentBundleNormalizer.normalize(raw)` converts provider-specific
  component responses into a deterministic bundle with `symbol`, `footprint`,
  `models`, `metadata`, `sourceJson`, and diagnostics fields.
- `SourceBundleExporter.export(bundle)` emits deterministic raw source bundle
  entries: `manifest.json`, `source/source.json`, and optional `models/*`
  assets.
- `AltiumSchLibExporter.export(bundles)` and
  `AltiumPcbLibExporter.export(bundles)` write compact OLE-backed `.SchLib`
  and `.PcbLib` byte arrays. The `.PcbLib` writer includes generated library
  streams plus STEP/WRL model payload streams when the normalized bundle
  contains model assets.
- `AltiumLibraryBatchExporter` orchestrates id lists, search-and-export,
  per-component source/SchLib/PcbLib outputs, merged library outputs,
  append/skip manifests, progress events, continue-on-error diagnostics, and
  checkpoint state.

Hosts are responsible for choosing and configuring any outbound component
source. Tests use repo-owned fake responses only.

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
    BomTableRenderer,
    PcbLayerGroups
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
- `PcbLayerGroups` is also exported from the renderer entrypoint for
  layer-filter and layer-visibility code that should not depend on parser
  internals.

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

## Read-only CLI Examples

The `examples/` directory includes small Node.js scripts for common
non-interactive workflows:

```bash
node examples/inspect-board.mjs board.PcbDoc --json
node examples/inspect-schematic.mjs design.SchDoc --view all --json
node examples/extract-bom.mjs design.SchDoc
node examples/generate-pnp.mjs board.PcbDoc
node examples/net-report.mjs design.SchDoc --json
node examples/library-catalog.mjs footprints.PcbLib
node examples/validate-library.mjs footprints.PcbLib --json
node examples/corpus-smoke.mjs local-corpus --coverage --json
```

Each script reads one input file and writes text, CSV, or JSON to stdout. The
corpus smoke script reads a caller-provided directory and can include aggregate
parser coverage and field-gap counters. The scripts are examples of library
usage, not installed package binaries.
