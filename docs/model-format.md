<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Model Format

The normalized model is intentionally stable with the ECAD Forge parser model.
The parser returns one object per parsed native document.

## Common Fields

- `schema`: normalized model schema id, currently
  `urn:altium-toolkit:normalized-model:a1`
- `kind`: `schematic`, `pcb`, `pcb-library`, or `project`
- `fileType`: `SchDoc`, `PcbDoc`, `PcbLib`, or `PrjPcb`
- `fileName`: original file name passed to the parser
- `diagnostics`: parser warnings and recovery notes
- `bom`: grouped component metadata where available

## Schema Contracts

The current root model contract is published as a JSON Schema at
[`docs/schemas/altium_toolkit/normalized_model_a1.schema.json`](schemas/altium_toolkit/normalized_model_a1.schema.json).
Parser roots expose the same id through the top-level `schema` field, and
library consumers can compare it with
`NormalizedModelSchema.CURRENT_SCHEMA_ID`.

## Schematic Fields

Schematic documents include recovered `schematic` data with sheet metadata,
primitives, wires, labels, power ports, sheet symbols, images, net metadata, and
component ownership hints. Coordinates remain in recovered document units until
the SVG renderer maps them into SVG space.

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

Component-owned PCB primitives are exposed directly from native Altium owner
indexes. `pcb.componentPrimitives[componentIndex]` returns the grouped pads,
tracks, arcs, fills, vias, regions, texts, and component bodies linked to that
component; missing sparse component indexes are represented as `null`. The
compatibility list `pcb.componentPrimitiveGroups` carries the same group objects
in placement order. Board-owned or net-owned primitives without a native
`componentIndex` are intentionally left out of these component groups.

Component annotations may also include `uniqueId`, `parameters`, and
`parameterSource` when the PCB contains `PrimitiveParameters/Data` entries keyed
by the component primitive ID. Modern Texts6 designator records are resolved
through `WideStrings6/Data` when Altium stores the display string in that table;
when such a Texts6 designator differs from `SOURCEDESIGNATOR`, the public
component uses the displayed designator and preserves the original value in
`baseDesignator` with `displayDesignator` and `designatorSource` metadata.

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
and solder-mask decisions.

PCB design rules preserve native rule-specific `constraints` as strings and add
typed views for common consumers. `ruleType` exposes a normalized rule kind and
category, `constraintValues` parses common numeric units such as mil, mm, inch,
degrees, percentages, and booleans, and `typedConstraints` maps common Width and
Clearance rule fields to semantic names such as `minWidth`,
`preferredWidth`, `maxWidth`, `minClearance`, and `genericClearance`.

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
payload and metric shape as PCB documents.

## Project Fields

PCB projects include recovered `project` data from `.PrjPcb` files. The parser
preserves raw INI sections while also exposing normalized document entries,
document groups, project parameters, project variants, configurations, and
output groups. Reachable schematic documents follow the durable project
metadata convention used by Altium: schematic stubs with only `DocumentPath` and
`DocumentUniqueId` remain listed, but richer schematic document entries are
preferred in `project.documentGroups.reachableSchematics`.

## Compatibility Rule

Consumers should treat unknown fields as additive within the same schema id.
Parser fixes may add detail, but existing field names and shapes should stay
compatible unless a new schema id explicitly documents a model migration.
