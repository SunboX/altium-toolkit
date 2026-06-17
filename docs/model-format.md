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
- `kind`: `schematic`, `pcb`, `schematic-library`, `pcb-library`, `project`,
  `integrated-library`, or `design-bundle`
- `fileType`: `SchDoc`, `PcbDoc`, `SchLib`, `PcbLib`, `PrjPcb`, `IntLib`, or
  `ProjectDesignBundle`
- `fileName`: original file name passed to the parser
- `diagnostics`: parser warnings and recovery notes. Each diagnostic carries a
  machine-readable `code`, `severity`, and `message`; entries may also carry
  source stream, storage, record-index, field, and context metadata.
- `bom`: grouped component metadata where available

## Schema Contracts

The legacy renderer compatibility contract is published as a JSON Schema at
[`docs/schemas/altium_toolkit/normalized_model_a1.schema.json`](schemas/altium_toolkit/normalized_model_a1.schema.json).
Compatibility fields expose the same id through the top-level `schema` field,
and consumers can compare it with `NormalizedModelSchema.CURRENT_SCHEMA_ID`.
The serialized parser return value follows the upstream
[`tscircuit/circuit-json`](https://github.com/tscircuit/circuit-json) element
array convention.

## Parser Utility Reports

`ParserFieldCoverageReportBuilder.build()` emits
`altium-toolkit.parser-field-coverage.a1` reports. Rows are grouped by parser
domain and primitive family, with observed native fields split into mapped,
missing, and unsupported sets. The report also carries a compact matrix with
per-family coverage status and mapped-field ratios. Source field matching is
case-insensitive while observed field names preserve their original spelling.
It is intended for fixture coverage and parser QA; it does not mutate parser
output or require native source files in tests.

`ParameterRecordInventoryBuilder.build()` emits
`altium-toolkit.parameter-record-inventory.a1` reports. Rows expose raw keys,
normalized keys, values, delimiter type, backtick nesting level, duplicate
occurrence numbers, UTF-8 key markers, and simple boolean/integer/number hints.
Duplicate-key rollups include first and last values so consumers can audit
parser policies without changing parsed model output.
`ParameterCollection.parse()` provides the corresponding local read helper for
duplicate-preserving, case-insensitive string, integer, number, boolean, code,
and coordinate-style parameter access.

`ParserValueVerificationReportBuilder.build()` emits
`altium-toolkit.parser-value-verification.a1` reports for curated fixture
manifests. Each assertion targets one explicit model path and expected value,
then reports pass, missing-path, or mismatch status. This complements field
coverage by checking recovered values rather than only field presence.

`ParserDiagnosticNormalizer.buildReport()` emits
`altium-toolkit.parser-diagnostics.a1` reports from string, `Error`, or object
diagnostics. The normalized envelope uses stable codes, `info`/`warning`/`error`
severities, messages, and optional source-stream, storage, record-index, field,
typed error-kind, field, and context keys.

`GeometryBoundsReportBuilder.build()` emits
`altium-toolkit.geometry-bounds.a1` reports from parsed schematic and PCB
document models. Rows identify document, domain, primitive family, primitive
index, status, and rounded axis-aligned bounds; the summary carries the union
bounds and missing-bounds count for QA tooling.

`FixtureCoverageMatrixBuilder.build()` emits
`altium-toolkit.fixture-coverage-matrix.a1` reports from synthetic fixture
manifests. Coverage rows and contract rows list fixture keys, required flags,
and missing gaps, while the policy section records the manifest asset policy
and native-asset count.

`RawDataPreservationReportBuilder.build()` emits
`altium-toolkit.raw-data-preservation.a1` reports. It summarizes preserved raw
primitive records, unknown records, and opaque schematic/library records by
count, parse state, support state, and byte length without repeating the base64
payloads already carried by parser models. When parser roots include
`nativeStreams`, the report adds native-stream counts and byte totals without
folding those stream bytes into the raw-record payload total.

`UnsupportedFeatureReportBuilder.build()` emits
`altium-toolkit.unsupported-features.a1` reports. It collects unsupported
schematic record type summaries, unsupported or unparsed raw records, opaque
preserved records, and unsupported diagnostics so parser coverage gaps can be
reviewed separately from general raw-data preservation.

`NativeStreamInventoryBuilder.buildFromStreams()` emits
`altium-toolkit.native-stream-inventory.a1` reports for OLE stream maps. Parser
roots expose the same metadata under `schematic.nativeStreams`,
`pcb.nativeStreams`, `schematicLibrary.nativeStreams`, and
`pcbLibrary.nativeStreams` when the source file was parsed from a compound
document. Rows include stream path, storage, leaf name, byte length, checksum,
known/unknown classification, and consumed status.

`EmbeddedAssetReportBuilder.build()` emits
`altium-toolkit.embedded-assets.a1` reports that normalize schematic images,
embedded file inventories, PCB font/model payloads, and integrated-library
source entries into one stable asset table.
`LibraryCompatibilityReportBuilder.build()` emits
`altium-toolkit.library.compatibility.a1` reports for schematic-library pin
roles and edge markers, hidden-pin hints, symbol bounds, field-placement risk
rows, footprint bounds, pad diagnostics, custom pad outline diagnostics, and
package-key suggestions with pin-one rotation hints for missing model
references. The report is read-only and is also composed into library QA when
it emits issues.
`LibraryDiffReportBuilder.build()` emits `altium-toolkit.library.diff.a1`
reports comparing parsed symbol and footprint libraries by item name, counts,
and parameter values.
`LibraryInspectionReportBuilder.build()` emits
`altium-toolkit.library.inspection.a1` reports that combine library inventory
rows with duplicate, stale-link, missing-model, lint, and merge-plan QA
summaries.

`PcbNetMembershipReportBuilder.build()` emits
`altium-toolkit.pcb.net-membership.a1` reports that count observed copper
ownership by net across pads, tracks, arcs, vias, fills, regions, and polygons.
Declared-but-empty nets, observed-but-undeclared nets, unowned primitives, and
possible unrouted pad-only nets are split into deterministic lists.
`PcbClassReportBuilder.build()` emits
`altium-toolkit.pcb.class-report.a1` reports that summarize PCB classes by
kind, enabled state, member resolution, empty classes, and unresolved members.
`PcbDimensionReportBuilder.build()` emits
`altium-toolkit.pcb.dimensions.a1` reports that classify recovered PCB
dimensions as renderable or unresolved from reference geometry and summarize
dimension kinds. `PcbRuleImpactReportBuilder.build()` emits
`altium-toolkit.pcb.rule-impact.a1` reports that group design rules by enabled
state, affected primitive families, scope predicates, manufacturing category,
and length-valued constraints.
`PcbFabricationReadinessReportBuilder.build()` emits
`altium-toolkit.pcb.fabrication-readiness.a1` reports that summarize pad/via
fabrication review items such as non-simple pad stack modes, local pad
offsets, slotted and non-plated holes, mask overrides, thermal relief, via
spans, via protection, and microvia-like geometry.
`PcbInspectionReportBuilder.build()` emits `altium-toolkit.pcb.inspection.a1`
reports that compose board statistics, primitive counts, design-rule counts,
diagnostics, net membership, class membership, dimension QA, rule-impact,
review metadata, fabrication-readiness, and route-analysis summaries into one
inspection artifact.

`PcbLayerGroups` provides stable layer-group names, deterministic display
colors, and draw priorities for legacy PCB layer ids. `AltiumUnits` provides
deterministic mil, millimeter, inch, and raw coordinate conversions for report
output.

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
also names schematic families such as notes, compile masks, harness records, and
blankets so consumers can inspect supported parser coverage without stringly
typed local maps. Hyperlink records are exposed as first-class
`schematic.hyperlinks` entries with URL, display text, location, font/color, and
owner/source metadata.

`schematic.qa.fieldCoverage` provides a parser-development coverage sidecar for
additive native fields that are not in the toolkit's current schematic field
catalog. It groups unrecognized field names by record type and stable record
keys without emitting top-level diagnostics. Known schematic fields are matched
case-insensitively, so uppercase native keys do not inflate the unrecognized
field counts.

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
`childrenByParentKey`, `parentsByChildKey`, `recordsByIndexInSheet`, and a
nested `hierarchy` projection so consumers can inspect component, sheet-symbol,
and directive children without reimplementing owner-index lookup rules.

`schematic.codeSymbols` is an optional read-only sidecar for auxiliary
code-symbol style records. It preserves block geometry, entry pins, title/source
text rows, routine and memory metadata, and marker points without affecting
schematic SVG rendering or netlist merging.

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
present in the parsed `.SchDoc`. Nets with explicit labels keep those labels as
their canonical `name`; unnamed nets keep their stable `UnknownNetN` name and
may add `autoName`, `autoNameSource`, and `aliasCandidates` from connected
component pins for display/search use. Project-level hierarchy, repeated
channels, variants, and cross-sheet compilation metadata are preserved through
the `.PrjPcb` parser, but this schema does not currently emit a compiled
multi-sheet design netlist.
`schematic.connectivityQa` reports read-only connectivity findings, including
implicit generated net names, dangling labels, orphan ports, unconnected pins,
ambiguous junctions, and un-junctioned tee contacts where one wire endpoint
touches another wire interior without an authored junction. Harness-specific
findings flag sheet entries whose local harness type cannot be resolved,
harness entries without linked signal-harness geometry, and connector type-label
mismatches. Pin interpretation findings flag hidden name/number labels,
endpoint symbol markers, and power-like pin names whose recovered electrical
type is not a power pin.

Embedded schematic images preserve the raw record geometry and expose
browser-facing payload metadata. When an embedded stream contains a native
PNG/JPEG/GIF/SVG/WebP payload alongside a preview, `mimeType` and `dataBase64`
refer to the native payload while `sourceMimeType` records the preview format.
Alpha-bearing 32-bit BMP previews are converted to PNG and marked with
`hasAlpha` so SVG renderers can display transparency deterministically.
`schematic.imageDiagnostics` reports embedded payload counts, external image
references, missing embedded payloads, unsupported MIME states, converted
preview/native payloads, and alpha-bearing images without attempting any file
system lookups.
When a schematic OLE container exposes preview metadata, `schematic.thumbnails`
contains PNG thumbnail sidecars with `kind`, dimensions, `sourceStream`,
`pixelFormat`, `mimeType`, and `dataBase64` fields.

When a native framed schematic stream contains non-property frames,
`schematic.opaqueRecords` preserves compact metadata for those unmodelled
payloads. Each row carries source stream context, frame type, record index, byte
length, and base64 payload data for downstream read-only diagnostics.

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
Native panel and placement streams are exposed as `pcb.embeddedBoards` and
`pcb.rooms` when present. Embedded-board rows preserve source document path,
placement layer, rotation, mirroring, array counts and spacing, unique id, and
selected policy flags. Room rows preserve name, unique id, members, and simple
bounds when available.

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
normalized `kind` (`linear`, `angular`, `radial`, `diameter`, `datum`,
`baseline`, or `ordinate`), reference points, optional text location,
prefix/suffix, precision, measured value, angle value, and unit. PCB SVG output
renders dimensions with sufficient reference geometry as static mechanical
dimension primitives and includes them in the semantic sidecar.

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

Schematic symbol libraries include recovered `schematicLibrary` data with a
library header, file-header metadata, section keys, stream names, ordered
`symbols`, lookup `indexes`, embedded file inventory, opaque native frames,
render manifest, and library QA report. Each symbol exposes source storage,
pins, parts, parameters, implementation rows, primitive summaries, and
referenced embedded assets where available. Pin rows preserve side-stream
metadata such as fractional location/length, descriptions, package length,
symbol line width, text placement, and pin-function hints when those streams are
present.
`schematicLibrary.indexes.symbolsByName` provides read-only symbol lookup and
search metadata, while `schematicLibrary.renderManifest` lists deterministic
symbol render outputs and embedded asset descriptors.

PCB footprint libraries include recovered `pcbLibrary` data with library header
properties, optional SectionKeys mappings, ComponentParamsTOC entries, and an
ordered `footprints` list. Each footprint exposes its source storage name,
parameters, component metadata, primitive order, unknown record markers, and
decoded pads, tracks, arcs, vias, fills, texts, and regions. Each footprint also
preserves raw mixed-format primitive records with the same registry metadata
shape used by PcbDoc raw records. Library-level `embeddedFonts` uses the same
payload and metric shape as PCB documents. Library-level `embeddedModels` and
`componentBodies` preserve embedded 3D payloads and body references when
present. When declared footprint names cannot be resolved to storage names,
`pcbLibrary.storageDiagnostics.missingFootprints` lists the declared name,
attempted storage candidates, and reason. Shape-based component bodies may
include `staticGeometry` for
extruded-polygon, cone, cylinder, and sphere bodies, with dimensions and
vertices expressed in mils when native evidence is available.
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
`LibraryCatalogArtifactBuilder.build()` emits
`altium-toolkit.library.catalog.a1` artifacts for parsed schematic and PCB
libraries. The artifact includes deterministic entries, QA issue badges,
search-index rows, preview SVG keys from render manifests, and a static HTML
catalog string with no server or runtime interaction. `LibrarySearchIndex`
provides exact, keyword, and fuzzy symbol/footprint lookup helpers over parsed
library read models.

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
`variants`, `sheets`, `components`, `schematic_hierarchy`,
`schematicHierarchyReport`, `pnp`, `nets`, `annotations`, and `indexes` so
multi-document consumers can use one normalized JSON object above
single-document parser output. `ProjectHierarchyReportBuilder.build()` emits
the richer hierarchy report directly from parsed project and schematic models,
including child sheet links, missing sheets, cycles, repeated references,
roots, and sheet-entry names. Passing `variantName` adds
`effectiveVariant`, which applies DNP rows, alternate fitted rows, parameter
overrides, and annotation designator mappings to BOM, PnP, component, and net
views without mutating the source parser models. `ProjectNetlistExporter` emits
deterministic wirelist and JSON netlist contracts from the normalized bundle or
effective variant view. The wirelist remains a compact line-oriented
`component.pin` view. The JSON netlist also carries aliases, auto-named flags,
schematic source sheets, graphical source elements, terminal endpoints,
hierarchy paths, and PCB net-table provenance when the bundle includes those
details. Alias lists include explicit schematic labels and additive unnamed-net
alias candidates when present.

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
not alter placement coordinates. Shape-based component bodies with complete
static geometry are exposed separately as `staticBodyPlacements`, using the
same board-centered coordinate convention as component and external-model
placements.

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
netlist, SVG, PCB review, layer-stack, Draftsman, library, parser QA,
inspection, unsupported-feature, and CI/reporting contracts.
