<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Model Format

The public parser returns one Circuit JSON element array per parsed native
document. Circuit JSON is the serialized model contract. The returned array
also carries non-serialized renderer-compatibility fields that preserve the
previous ECAD Forge parser model for renderers and migration code.

## Circuit JSON Fields

Every parser result is an array of elements with a `type` field. The adapter
emits Circuit JSON elements for source project metadata, source components,
ports, nets, schematic symbols, schematic lines, schematic text, PCB boards,
PCB components, PCB pads, PCB traces, and PCB vias where those structures are
available in the source document. Altium Toolkit sidecar contracts that do not
map to upstream Circuit JSON element families are serialized as custom
`altium_toolkit_*` elements. Each sidecar element includes a stable
`altium_toolkit_sidecar_id`, a `source_document` identity block, the sidecar
`schema`, and the original normalized sidecar object in `payload`.

Current custom sidecar element types include PCB layer stacks, rigid-flex
topology, PCB review metadata, placed-footprint extraction manifests, PCB
library parity reports, project OutJob digests, project document graphs,
BOM/PnP reconciliation reports, Draftsman image payloads, Draftsman board-view
metadata, contract-gate reports, and host-capability diagnostics.

Use `CircuitJsonModelSchema.isModel(result)` to validate that a value is a
Circuit JSON array. `JSON.stringify(result)` serializes only the Circuit JSON
elements, including custom `altium_toolkit_*` sidecar elements; compatibility
fields are intentionally omitted from serialized JSON.

## Source Export Bundle

`SourceComponentBundleNormalizer` produces the exporter input contract used by
the source bundle, `.SchLib`, and `.PcbLib` writers:

- `id` and `name`: stable component identity
- `metadata`: provider metadata copied into deterministic plain-object form
- `symbol`: schematic symbol name, pins, primitives, and raw source object
- `footprint`: PCB footprint name, primitive families, and raw source object
- `models`: model id, file name, format, bytes/text, and optional source URL
- `sourceJson`: the original raw response retained for reproducible exports
- `diagnostics`: warnings for incomplete source data

`SourceBundleExporter.export()` serializes the original source response and a
manifest that lists included model assets. It does not fetch network resources;
callers provide already-normalized model bytes or use `SourceComponentClient`
before exporting.

## Renderer Compatibility Fields

For compatibility, `AltiumParser.parseArrayBuffer()` attaches the previous
renderer model fields directly to the Circuit JSON array. Integrations that need
the object form can call
`AltiumParser.parseArrayBufferToRendererModel(fileName, arrayBuffer)` or
`CircuitJsonModelAdapter.toRendererModel(circuitJson)`.

## Common Fields

- `schema`: normalized model schema id, currently
  `urn:altium-toolkit:normalized-model:a1`
- `kind`: `schematic`, `pcb`, `pcb-library`, `project`,
  `integrated-library`, or `design-bundle`
- `fileType`: `SchDoc`, `PcbDoc`, `PcbLib`, `PrjPcb`, `IntLib`, or
  `ProjectDesignBundle`
- `fileName`: original file name passed to the parser
- `diagnostics`: parser warnings and recovery notes. Each diagnostic carries a
  machine-readable `code` plus `severity` and `message`.
- `bom`: grouped component metadata where available

## Schema Contracts

The legacy renderer compatibility contract is published as a JSON Schema at
[`docs/schemas/altium_toolkit/normalized_model_a1.schema.json`](schemas/altium_toolkit/normalized_model_a1.schema.json).
Compatibility fields expose the same id through the top-level `schema` field,
and consumers can compare it with `NormalizedModelSchema.CURRENT_SCHEMA_ID`.
The serialized parser return value follows the upstream
[`tscircuit/circuit-json`](https://github.com/tscircuit/circuit-json) element
array convention.

## Schematic Fields

Schematic documents include recovered `schematic` data with sheet metadata,
primitives, wires, labels, power ports, sheet symbols, images, net metadata, and
component ownership hints. Coordinates remain in recovered document units until
the SVG renderer maps them into SVG space.

`schematic.recordTypes` summarizes the native schematic `RECORD` ids seen in
the document. Each entry includes the numeric `recordType`, stable `name`,
semantic `family`, parser `supported` flag, and observed `count`. Bezier and
pie-chart primitives are exposed as first-class `schematic.beziers` and
`schematic.pies` arrays for deterministic SVG rendering. Rounded rectangles are
exposed through `schematic.roundedRectangles`, and IEEE drawing symbols are
exposed through `schematic.ieeeSymbols` with a stable `symbolName`. The registry
also names schematic families such as notes, compile masks, harness records,
blankets, and hyperlinks so consumers can inspect supported parser coverage
without stringly typed local maps.

Record-28 text frames are preserved both as drawable note text and as a
read-only `schematic.textFrames` contract with frame rectangle, alignment,
border width, fill/border state, font, margin, and render-order metadata.
Polyline records preserve authored endpoint marker kind and size on the first
and last rendered segment when present.

`schematic.directiveSemantics` exposes first-class schematic directives beside
their drawable geometry. It groups No ERC markers, parameter sets,
differential-pair directives, compile masks, and blankets. Parameter sets carry
owner-linked child parameter rows and a `parameterMap`, which lets consumers
distinguish hidden directive metadata from visible sheet text.

`schematic.ownership` is a read-only sidecar built from raw record
`OwnerIndex` and `IndexInSheet` values. It exposes stable record keys,
`childrenByParentKey`, `parentsByChildKey`, and `recordsByIndexInSheet` so
consumers can inspect component, sheet-symbol, and directive children without
reimplementing owner-index lookup rules.

Schematic project parameters and special strings can be resolved without
mutating source parser models through `SchematicProjectParameterResolver`.
The resolver supports dot-prefixed project parameters, equals-prefixed template
fields, and simple quoted-literal concatenation expressions. Schematic SVG
rendering accepts `projectParameters` and uses the resolver for visible sheet
text and title-block fields.

`schematic.renderDiagnostics` is an optional structured sidecar for rendering
fallback decisions. Font-family fallbacks are emitted with code
`schematic.font.family-fallback`, the raw source family, resolved deterministic
family, and matching top-level warning diagnostic.

The normalized schematic net model is single-sheet. `schematic.nets` is built
from the wires, labels, ports, pins, junctions, bus entries, and sheet entries
present in the parsed `.SchDoc`. Project-level hierarchy, repeated channels,
variants, and cross-sheet compilation metadata are preserved through the
`.PrjPcb` parser, but this schema does not currently emit a compiled
multi-sheet design netlist.

Embedded schematic images preserve the raw record geometry and expose
browser-facing payload metadata. When an embedded stream contains a native
PNG/JPEG/GIF/SVG/WebP payload alongside a preview, `mimeType` and `dataBase64`
refer to the native payload while `sourceMimeType` records the preview format.
Alpha-bearing 32-bit BMP previews are converted to PNG and marked with
`hasAlpha` so SVG renderers can display transparency deterministically.

## PCB Fields

PCB documents include recovered `pcb` data with board outline geometry,
component placements, layer metadata, primitive detail, copper, pads, vias,
fills, arcs, embedded model references, model body placement metadata,
`embeddedFonts`, and `rawRecords`. Embedded font entries include the recovered
family/style, source stream, self-contained base64 payload, TrueType/OpenType
format hint, MIME type, byte counts, and basic sfnt metrics such as
units-per-em, ascent, descent, cell height, cap height, average advance width,
and weight class. Decoded TrueType PCB text primitives may reference these
metrics through `embeddedFontIndex` and `fontMetrics`. Raw record entries expose
the registry id, source stream, primitive family/type, byte offsets, byte
counts, parse status, encoding style, and a base64 payload for unsupported or
partially decoded primitive stream data.

Barcode PCB text records preserve their barcode kind, render mode, authored
full size, margins, minimum bar width, show-text flag, and inverted state. SVG
rendering uses those fields to emit deterministic vector barcode groups with
semantic data attributes.

`pcb.mechanicalLayerPairs` lists paired mechanical layer ids and display names.
`pcb.layerFlipMetadata.mechanicalFlipMap` gives the bidirectional layer-id map
needed when bottom-side components or footprints are mirrored between paired
mechanical overlays.

PCB printable and sidecar property streams are decoded as UTF-8 first, with
Windows-1252 and GB18030 fallbacks for legacy text-backed properties.

Component-owned PCB primitives are exposed directly from native Altium owner
indexes. `pcb.componentPrimitives[componentIndex]` returns the grouped pads,
tracks, arcs, fills, vias, regions, texts, and component bodies linked to that
component; missing sparse component indexes are represented as `null`. The
compatibility list `pcb.componentPrimitiveGroups` carries the same group objects
in placement order. Board-owned or net-owned primitives without a native
`componentIndex` are intentionally left out of these component groups.
`pcb.ownership` is the broader primitive ownership sidecar. It groups public
primitive keys by component index, net index, and polygon index, while
`primitiveOwners` records the component/net/polygon owner for each decoded
primitive where that metadata exists.

Component annotations may also include `uniqueId`, `parameters`, and
`parameterSource` when the PCB contains `PrimitiveParameters/Data` entries keyed
by the component primitive ID. Modern Texts6 designator records are resolved
through `WideStrings6/Data` when Altium stores the display string in that table;
when such a Texts6 designator differs from `SOURCEDESIGNATOR`, the public
component uses the displayed designator and preserves the original value in
`baseDesignator` with `displayDesignator` and `designatorSource` metadata.
Component-owned Texts6 comment/value records are marked with `role: 'comment'`
and `isComment`; unresolved annotation slots are additionally marked with
`isPlaceholder`.

Component rows may include schematic and library provenance in
`component.provenance`: channel offsets, source unique-id and hierarchy
segments, source library references, footprint descriptions, annotation
autoposition values, and pin/part swapping flags. This metadata is read-only
and is carried before any project-level schematic compilation is attempted.

Pick-and-place coordinates are exposed as `pnp` at the model root and mirrored
under `pcb.pickPlace`. The default `positionMode` is `altium-pick-place`, which
uses the center of component-owned pad anchors when available and falls back to
the component origin. `pnp.modes.componentOrigin.entries` exposes the same
components using authored component-origin coordinates. Entries preserve the
authored component rotation while using the normalized PCB coordinate frame.

`pcb.statistics` provides a deterministic board QA summary for regression
diffs and reports. It includes outline dimensions and centroid, drill and slot
counts, plated/non-plated hole counts, primitive-width histograms, and a
layer-stack summary with per-layer primitive counts. When stack metadata is
available, layer entries also carry material, copper thickness/weight,
dielectric thickness, dielectric constant, and dissipation factor, plus
aggregate material and role counts. The `planning` section summarizes keepout
regions, room-related rules and names, board-region flex/rigid counts, locked
3D regions, bending-line counts, and board-region layer-stack usage.

Decoded pad primitives preserve raw `padFlags` plus named tenting and testpoint
flags. Pad shape codes are kept as raw `shapeTop` / `shapeMid` / `shapeBottom`
values and mirrored through normalized `shape*Name` labels plus
`padShapeNames`. Extended pad records also expose named hole shapes, normalized
`holeGeometry` for round/square/slot drills, merged `middleLayerPads` entries
that combine middle-layer size and effective shape data, per-layer shape names,
pad-cache thermal-relief fields through `padCache`, corrected cache-validity
fields for plane/thermal/power relief, raw paste/solder mask modes, effective
mask expansions, and side-specific `hasTop*MaskOpening` /
`hasBottom*MaskOpening` booleans for renderers that need layer-accurate paste
and solder-mask decisions. Pad and via drill tolerances use
`positiveTolerance`, `negativeTolerance`, and grouped `holeTolerance`; unset
native sentinel values are omitted instead of exposed as numeric mil values.

Decoded via primitives preserve stack mode, per-layer diameters, removed-pad
metadata, solder-mask-from-hole-edge flags, back solder-mask expansion,
`drillLayerPairType`, optional `propagationDelayPs`, and sidecar-linked
`viaProtection` metadata. `pcb.viaStructures` exposes the read-only sidecar
contract: `structures` describes IPC-4761-style protection definitions and
feature rows, `links` maps structure definitions to via primitive indexes, and
`byPrimitiveIndex` provides the same lookup in object form.
Linked via-protection records also add `drill` metadata to matching vias with
`holeKind`, `plating`, `renderState`, and `ipc4761Type`. Render states are
normalized as `open`, `covered`, `filled`, or `capped` for SVG and 3D
consumers.

PCB dimensions from `Dimensions6/Data` are exposed through `pcb.dimensions`.
Dimension entries preserve native kind codes and raw fields while adding a
normalized `kind` (`linear`, `angular`, `radial`, `datum`, `baseline`, or
`ordinate`), reference points, optional text location, prefix/suffix, precision,
measured value, angle value, and unit.

`pcb.extendedPrimitiveInformation` exposes
`ExtendedPrimitiveInformation/Data` entries keyed by primitive index and, when
available, primitive object id. Matching decoded primitives receive an
`extendedPrimitiveInformation` object with raw paste and solder mask-expansion
modes, source labels, and manual expansion values.

`pcb.customPadShapes` exposes `CustomShapes/Data` entries keyed by anchor pad
primitive index. Matching normalized pads receive a `customShape` object whose
layer entries reference the normalized region, shape-region, arc, track, and
fill geometry that forms the custom pad shape.

`pcb.unions` exposes `UnionNames/Data` and `SmartUnions/Data` metadata.
Smart-union type ids are normalized to stable labels such as `via-stitching`,
`via-shielding`, `drill-table`, `length-tuning`, and `layer-stack-table`.
Primitive records referenced by smart unions receive `unionMemberships`.

Differential-pair records are exposed through `pcb.differentialPairs`.
`Classes6/Data` entries whose kind identifies differential-pair classes are
joined into `pcb.differentialPairClasses`; each pair lists `classNames`, and
each class lists resolved `pairNames` plus `unresolvedMembers` for members that
were present in the class table but absent from `DifferentialPairs6/Data`.

PCB text primitives preserve authored special-string expressions in `text`.
When parser callers supply project parameters through extraction context,
matched text records also expose `rawText`, `resolvedText`, and
`specialString` metadata. The resolver supports dot-prefixed project parameter
references and simple quoted-literal concatenation expressions.

PCB design rules preserve native rule-specific `constraints` as strings and add
typed views for common consumers. `ruleType` exposes a normalized rule kind and
category, `constraintValues` parses common numeric units such as mil, mm, inch,
degrees, percentages, and booleans, and `typedConstraints` maps common rule
fields to semantic names. Covered families include width, clearance, routing
topology/corners/priority, fanout, length, matched length, solder-mask sliver,
silkscreen clearances, component clearance, annular ring, vias-under-SMD,
testpoint style, and testpoint usage rules.

Board-planning regions are decoded separately from copper regions through
`pcb.boardRegions`. These entries retain their contour geometry and now add
rigid-flex semantics from BoardRegions/Data properties: `objectKind`, `name`,
`layerStackId`, `substackIndex`, `substackName`, flex/rigid flags, `locked3d`,
`cavityHeight`, and typed `bendingLines`. Bend lines preserve the raw
semicolon-delimited payload while exposing angle, radius, fold index, endpoint
coordinates, and calculated affected width in mils. Board-level substack
metadata is exposed in `pcb.layerSubstacks`, and
`pcb.boardRegionContexts` provides a compact region-to-substack lookup for
callers that do not need the full geometry.

## PCB Library Fields

PCB footprint libraries include recovered `pcbLibrary` data with library header
properties, optional SectionKeys mappings, ComponentParamsTOC entries, and an
ordered `footprints` list. Each footprint exposes its source storage name,
parameters, component metadata, primitive order, unknown record markers, and
decoded pads, tracks, arcs, vias, fills, texts, and regions. Each footprint also
preserves raw mixed-format primitive records with the same registry metadata
shape used by PcbDoc raw records. Library-level `embeddedFonts` uses the same
payload and metric shape as PCB documents. Library-level `embeddedModels` and
`componentBodies` preserve embedded 3D payloads and body references when
present.
`pcbLibrary.indexes.footprintsByName` provides read-only footprint lookup and
search metadata, including source storage, primitive counts, pad/text counts,
and keyword tokens from footprint and component parameters. Footprint entries
may also preserve implementation rows, component-model rows, and pin display
mode metadata when those records are available from extraction.
Footprints carry the same advanced field shapes as PCB documents when available:
extended mask/paste sidecars attached to primitives, custom pad shape geometry,
barcode text metadata, embedded model references, and projection diagnostics for
component bodies. `pcbLibrary.renderManifest` exposes stable footprint SVG keys,
per-layer SVG keys, layer descriptors, and embedded asset descriptors. Asset
descriptors may include native format, wrapper type, byte size, checksum, and
structured diagnostics when extraction supplied that metadata.
`LibraryRenderManifestBuilder.buildSchematicExtractionManifest()` adds a
read-only database-library audit plan for placed schematic symbols, including
preserved versus stripped parameter names and stripped implementation keys.
`LibraryRenderManifestBuilder.buildSchematicTemplateExtractionManifest()`
summarizes template identity, owned records, fonts, title-block fields, and
missing template parameters without generating template files.
`LibrarySearchIndex` provides exact, keyword, and fuzzy symbol/footprint lookup
helpers over parsed library read models.

## Project Fields

PCB projects include recovered `project` data from `.PrjPcb` files. The parser
preserves raw INI sections while also exposing normalized document entries,
document groups, project parameters, project variants, configurations, and
output groups. Reachable schematic documents follow the durable project
metadata convention used by Altium: schematic stubs with only `DocumentPath` and
`DocumentUniqueId` remain listed, but richer schematic document entries are
preferred in `project.documentGroups.reachableSchematics`.
`project.classGeneration` preserves `[PrjClassGen]` policies and any
per-document class-generation options, including differential-pair class and
room-transfer policy flags when present.

Project parsing is metadata-only. It does not load referenced schematics or
emit a compiled multi-sheet netlist; consumers that need a design-wide netlist
should combine project metadata with separately parsed schematic documents.

`ProjectAnnotationParser` parses read-only annotation mapping files into
`annotations.mappings`, `bySourceDesignator`, and `byCompiledDesignator`.
`ProjectDesignBundleBuilder.build({ projectModel, documentModels,
annotationModels })` composes already parsed project, schematic, PCB, and
annotation models into a `design-bundle` payload. The bundle exposes `project`,
`variants`, `sheets`, `components`, `schematic_hierarchy`, `pnp`, `nets`,
`annotations`, and `indexes` so multi-document consumers can use one normalized
JSON object above single-document parser output. Passing `variantName` adds
`effectiveVariant`, which applies DNP rows, alternate fitted rows, parameter
overrides, and annotation designator mappings to BOM, PnP, component, and net
views without mutating the source parser models. `ProjectNetlistExporter` emits
deterministic wirelist and JSON netlist contracts from the normalized bundle or
effective variant view. The wirelist remains a compact line-oriented
`component.pin` view. The JSON netlist also carries aliases, auto-named flags,
schematic source sheets, graphical source elements, terminal endpoints,
hierarchy paths, and PCB net-table provenance when the bundle includes those
details.

## SVG And 3D Contracts

`PcbSvgRenderer.renderLayerSvgs(documentModel)` returns one layer descriptor and
SVG string per recovered display layer. Layer SVGs use the same PCB semantic
metadata sidecar as the composite SVG, with `view.kind` set to `layer`, a
single included layer id, and `layerSet.layerView` describing the exported
layer.

PCB documents expose `pcb.bomProfile` for PCB-only BOM grouping and parameter
alias normalization. `pcb.layerStackReadModel.fidelityReport` classifies
semantic layer-stack data, preserved native cache evidence, interchange-only
fields, and unsupported native-regeneration reasons. Draftsman digests preserve
typed font-style records, note geometry, note border/fill state, and picture
geometry when those fields are available in the container.

External model placements in the 3D scene description include a `projection`
diagnostic object. The `source` explains whether bounds came from an authored
projection override, resolved model bounds, nearby pad-span fallback,
procedural component fallback, or model-anchor fallback. The diagnostic does
not alter placement coordinates.

## Integrated Library Fields

Integrated libraries include recovered `integratedLibrary` data from `.IntLib`
compound documents. The parser preserves `Version.Txt`, cross-reference rows
from `LibCrossRef.Txt`, parameter records from `Parameters   .bin`, and bundled
source entries from schematic-symbol, PCB-footprint, and PCB-3D library
folders. Source entries expose their stream path, file name, file type, library
kind, compression wrapper, byte count, base64 payload, and printable payload
text when the recovered bytes are text-like. Child source payloads are
read-only; callers can parse extracted `.SchLib`, `.PcbLib`, or 3D library
payloads with separate workflows where applicable.
`integratedLibrary.indexes` adds source lookups by file name and source kind,
plus cross-reference indexes that group schematic symbol and PCB footprint
models by component.

## Compatibility Rule

Consumers should treat unknown fields as additive within the same schema id.
Parser fixes may add detail, but existing field names and shapes should stay
compatible unless a new schema id explicitly documents a model migration.
Focused machine-readable schemas are available under
`docs/schemas/altium_toolkit/` for the normalized root plus focused project,
netlist, SVG, PCB review, layer-stack, Draftsman, library, and CI/reporting
contracts.
