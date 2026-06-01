<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Altium KiCad Feature Parity Design

## Goal

Bring `altium-toolkit` to format-appropriate public feature parity with
`kicad-toolkit` for host integrations. Parity means matching the public feature
families that are useful across both formats, not cloning KiCad-specific
internals such as S-expression helpers or KiCad layer wildcard semantics.

The new Altium APIs must remain read-only, local-first, deterministic, and
within the parser/renderer utility scope defined for this package.

## Scope

Add three Altium-specific public feature families:

- `AltiumProjectLoader`
- `AltiumToolkitCapabilities`
- `AltiumReadinessReport`

Export them from `src/parser.mjs`, which also makes them available from the
root package entrypoint. Add tests and documentation for each feature family.

Do not add host app behavior such as UI state, downloads, DOM event handling,
network fetching, or interactive 3D controls. Do not add native Altium fixture
files under tests.

## Public API

### AltiumProjectLoader

`AltiumProjectLoader` provides a local loading facade for browser `File`
objects, named byte entries, and ZIP archives:

```js
const result = await AltiumProjectLoader.loadEntries([
    { name: 'board.PcbDoc', bytes }
])
```

Public methods:

- `loadFiles(files)`
- `loadEntries(entries)`
- `findDocumentEntries(entries)`
- `expandArchiveEntries(entries)`
- `isSchematicFile(fileName)`
- `isBoardFile(fileName)`
- `isPcbLibraryFile(fileName)`
- `isProjectFile(fileName)`
- `isRecognizedDocumentFile(fileName)`
- `isZipFile(fileName)`

The loader accepts `.SchDoc`, `.PcbDoc`, `.PcbLib`, and `.PrjPcb` documents. ZIP
archives are expanded with `fflate`; `__MACOSX/` entries are ignored.

The returned container should include:

- `documents`: Circuit JSON parser results
- `rendererDocuments`: renderer compatibility models
- `project`: a project summary
- `assets`: companion 3D/model assets from archive entries
- `diagnostics`: non-fatal warnings and parse failures
- `sourceFileName`: present for direct single-document loads

For direct single-document loads, parse the document and build a minimal project
summary around it. For multi-document or project loads, parse all recognized
documents. A `.PrjPcb` document, when present, anchors the project name and
known document references.

Document-reference diagnostics should flag project-referenced document paths
that are not present in the loaded entries. Matching should normalize path
separators and compare base names conservatively, but parser-owned document
paths should not be rewritten.

If no recognized Altium document is found, `loadEntries()` throws. If a
multi-file load has parse failures but at least one document parses, the loader
returns successful documents with diagnostics. If every recognized document
fails, the loader throws the first parse error.

### AltiumToolkitCapabilities

`AltiumToolkitCapabilities.inventory(options)` returns the same capability
record shape as `KicadToolkitCapabilities.inventory(options)`.

Supported filters:

- `category`
- `safety`
- `includeCapabilities`

Capability categories:

- `parser`
- `project_loading`
- `binary_metadata`
- `rendering`
- `scene3d`
- `netlist_query`
- `reporting`

All initial capabilities are `read_only`, do not mutate caller data, do not
create backups, and do not expose dry-run write behavior.

Capability records should describe Altium-specific parser, OLE/binary helper,
project loading, renderer, scene-description, netlist-query, and reporting
support. Unknown category or safety filters throw errors, matching the KiCad
API.

### AltiumReadinessReport

`AltiumReadinessReport` exposes report normalization and recovered-model
readiness helpers:

- `parseDrcReport(report, options)`
- `summarizeDrcReport(report, options)`
- `parseErcReport(report, options)`
- `summarizeErcReport(report, options)`
- `fabricationReadiness(input)`

Report normalization accepts JSON strings, objects, or arrays. It recognizes
issue lists such as `violations`, `warnings`, `errors`, `exclusions`,
`unconnected_items`, `schematic_parity`, and `items`. Normalized issues include
`category`, `severity`, `rule`, `message`, and optional source detail fields.
Options match KiCad semantics: `includeItems`, `limit`, `exampleLimit`,
`severity`, `rule`, and `category`.

`fabricationReadiness(input)` accepts an Altium renderer model, a Circuit JSON
array with attached compatibility fields, a wrapper with `{ pcb }`, or a raw PCB
object.

The readiness result includes:

- `ok`
- `readiness`: `ready`, `review`, or `blocked`
- `score`
- `findingCounts`
- `findings`
- `statistics`
- `outline`
- `connectivity`
- `bounds`

Readiness checks are intentionally conservative and use recovered parser data
only. Blockers should include missing board outline and insufficient copper
layers when those can be inferred. Open outline endpoints should be reported
when line segments can be checked. Warnings should include missing components,
missing pads, no-net pads, unrouted multi-pad nets, and missing visible 3D model
metadata when components exist.

## Data Flow

`AltiumProjectLoader.loadFiles()` converts browser files into named byte
entries, then delegates to `loadEntries()`.

`loadEntries()` expands archive entries, partitions recognized documents and
assets, parses documents with `AltiumParser.parseArrayBuffer()`, and converts
parsed Circuit JSON results to renderer models through
`CircuitJsonModelAdapter.toRendererModel()`.

Project summary construction uses parsed document metadata:

- Prefer `.PrjPcb` project data for `name`, `fileName`, document references,
  parameters, variants, and output groups.
- Count parsed schematic, PCB, PCB library, and project documents.
- Group BOM rows from parsed documents where available.
- Preserve diagnostics from parser results and append loader diagnostics.

Readiness checks operate on `pcb` compatibility data because that is the stable
renderer-facing model shared by existing Altium parser and renderer APIs.

## Error Handling

- Invalid report JSON throws through `JSON.parse`.
- Unknown capability filters throw `Error` with a clear message.
- Unsupported or empty project loads throw a clear `Error`.
- Multi-file parse failures are diagnostic warnings when other recognized
  documents parse successfully.
- Readiness helpers tolerate missing optional arrays by treating them as empty
  arrays.

## Tests

Add focused tests using repo-owned synthetic inputs only:

- API entrypoint tests for root and parser exports.
- Capability inventory filtering, counts, and representative records.
- DRC/ERC report normalization and summary tests.
- Fabrication readiness tests for blocked and ready/review models.
- Project loader tests for direct document entries, ZIP archive expansion,
  companion asset collection, project-reference diagnostics, and partial
  multi-file parse failures.

Do not add real `.SchDoc`, `.PcbDoc`, `.PcbLib`, or `.PrjPcb` fixture files.
Synthetic text buffers and obfuscated names are acceptable.

## Documentation

Add `docs/capabilities.md`.

Update:

- `README.md`
- `docs/api.md`
- `docs/model-format.md`

Documentation should explicitly state that the new helpers are read-only,
local-first, and do not replace full Altium DRC/ERC/fabrication review tools.

## Non-Goals

- No KiCad-specific parser helpers in Altium.
- No host app project state management.
- No file writing, backup creation, or dry-run mutation APIs.
- No network fetching.
- No real customer, vendor, or source project identifiers in tests.
