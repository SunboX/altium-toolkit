<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Library Compatibility Reports

Library compatibility reports provide deterministic, source-neutral QA over
parsed schematic symbol libraries and PCB footprint libraries. The report is
read-only: it never rewrites symbols, footprints, model references, or rendered
output.

## Scope

The report focuses on compatibility signals that are useful across importer,
renderer, catalog, and review workflows:

- schematic pin electrical roles, decorative edge markers, hidden state, and
  hidden-pin placement hints
- schematic symbol bounds, pin/body bounds, deterministic field anchor hints,
  and visible field-placement risk rows
- PCB footprint bounds and padded courtyard-like bounds derived from recovered
  pad and primitive geometry
- PCB pad diagnostics for top/bottom size mismatches, explicit zero-size pads,
  unknown pad shapes, unresolved pad layers, and custom pad outline geometry
- package-name keys and pin-one rotation hints that can help downstream tools
  suggest model matches when a footprint has no embedded or body-level model
  reference

The report does not perform format conversion, file writing, model download,
interactive model binding, or application UI work.

## Contract

`LibraryCompatibilityReportBuilder.build()` emits
`altium-toolkit.library.compatibility.a1` with these top-level arrays:

- `symbolPins`: normalized schematic-library pin compatibility rows
- `hiddenPins`: hidden pins with placement hints and source location metadata
- `symbolBounds`: per-symbol bounds, body bounds, pin bounds, source counts,
  and deterministic field anchor hints
- `fieldPlacementRisks`: warning rows for visible designator/comment/value
  fields placed inside symbol bounds
- `footprintBounds`: footprint-level bounds, courtyard bounds, and primitive
  source counts
- `padDiagnostics`: warning rows for pad geometry and mapping problems
- `modelSuggestions`: package-key and rotation-hint rows for model matching by
  host tools
- `issues`: flattened warning/info rows suitable for library QA summaries

PcbLib extraction also exposes `diagnostics.missingFootprints` rows when a
declared footprint name cannot be resolved to a compound-document storage. Each
row lists the declared name, attempted storage candidates, and reason. Parsed
PcbLib models surface the same rows at
`pcbLibrary.storageDiagnostics.missingFootprints`.

`LibraryQaReportBuilder.build()` composes compatibility issues into its
top-level `issues` array when the compatibility report finds non-empty issue
rows. Clean inputs keep the existing QA summary shape.

## Testing Policy

Tests for this report use synthetic library objects only. They must not rely on
native library files or real project, customer, vendor, or product identifiers.
