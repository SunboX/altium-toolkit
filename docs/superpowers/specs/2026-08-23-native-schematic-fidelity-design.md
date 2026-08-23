# Native Schematic Fidelity Design

## Context

An Altium schematic with an explicit standard template renders with three
independent fidelity failures: its sparse page is shortened, native harness
graphics are absent, and upper title-block parameters are filtered as
unresolved. The supplied reference shows that the authored template coordinate
frame and owner relationships must be preserved.

The source document is diagnostic evidence only. It must not be committed or
named in tests. Regressions use small, obfuscated schematic records that encode
only the relevant structural signals.

## Considered Approaches

### Preserve ISO promotion and add more offsets

This would extend the existing footer translation and add vertical offsets for
sparse content. It is rejected because it treats an incorrect page size as the
source of truth and would require separate compensations for every primitive
family.

### Preserve the valid native template frame and render authored structures

This is the selected approach. When an explicit standard template declares a
native coordinate frame that contains all authored graphics, the parser keeps
that frame. Footer parameters resolve through the complete structural owner
group and harness records gain a renderer. Each rule is derived from format
structure rather than a file name, template vendor, label, or designator.

### Repair the final SVG in ECAD Forge

This is rejected because the defects belong to the toolkit rendering model.
An ECAD Forge adapter would duplicate Altium semantics and leave every other
toolkit consumer incorrect. The toolkit's frozen historical parser and
renderer remain byte-identical; the repair belongs to its convergence layer.

## Architecture

### Native template canvas

`AltiumSchematicFidelityNormalizer` distinguishes an explicit
standard-template coordinate frame from a generic sparse custom page by using
the native ownership sidecar. When `SheetStyle=1`, the template identifies an
ISO size, the stored positive dimensions use the same orientation, and owned
chrome reaches the stored frame edge without overflowing it, those dimensions
become the render frame. Sparse content must never shorten such a frame.

This rule preserves arbitrary valid template frames. It does not match template
paths or project names beyond the existing structural ISO-size extraction.

### Footer parameter resolution

The convergence normalizer identifies a native footer owner from seeded lower
footer records in the ownership sidecar, then treats every visible text record
with that owner as footer text. All such placeholders resolve against raw sheet
metadata, including address and approval rows above the historical `y <= 100`
band. Metadata values of `*` remain drawable for authored footer cells.

### Harness parsing and rendering

The convergence normalizer attaches record 216 entries and record 217 type
labels to a connector when their `OwnerIndexAdditionalList` flag is present and
they form the adjacent ownership-sidecar group following record 215. Explicit
owner indices remain authoritative.

A focused `SchematicHarnessRenderer` will render:

- signal-harness polylines;
- connector body/bracket geometry from location, size, side, and primary
  connection position;
- entry stubs and labels from side and distance;
- the type label at its authored location.

The renderer consumes only the normalized `schematic.harnesses` contract, does
not parse source records, and routes colors through the existing schematic
theme variables.

### Rotated owner text placement

Vertical owner annotations use Altium insertion points on the near edge of each
text column. SVG `rotate(-90)` places the font ascent on the opposite side of
that point. A focused placement helper will shift right-side vertical owner
text by its resolved viewer font size while leaving left-side designators and
unowned vertical annotations unchanged. This keeps passive values and comments
in separate columns beside the symbol body instead of drawing the value through
the body.

### Preserved presentation contract

The ECAD Forge schematic color scheme and existing canvas border/title-block
chrome are unchanged. The sheet-frame correction changes only the coordinate
dimensions supplied to the renderer. It does not change border-zone counts,
chrome geometry, CSS variables, palette rules, or existing connector fills.

## Data Flow

1. The OLE stream extractor supplies printable schematic records.
2. The frozen parser produces its historical model plus the native ownership
   sidecar.
3. The convergence normalizer resolves the native frame, footer ownership, and
   additional-list harness ownership from structural adjacency and owner seeds.
4. The convergence renderer receives the normalized model and emits native
   sheet chrome through the unchanged border renderer, plus ordinary schematic
   primitives, corrected owner-text columns, and themed harness markup in
   authored coordinates.
5. ECAD Forge consumes the released toolkit without app-side geometry repair.

## Error Handling

Ambiguous native frames fall back to the existing ISO/custom-sheet resolver.
Ambiguous additional-list records remain unowned instead of being attached to
an unrelated connector. Harness renderers skip non-finite geometry and use the
existing palette resolution path.

## Testing and Acceptance

Repository-owned tests must prove:

- a sparse explicit template keeps its complete native landscape frame;
- ordinary sparse pages still use existing sizing behavior;
- all placeholders owned by a seeded footer resolve, including upper address
  rows and literal `*` values;
- additional-list harness entries attach to the adjacent connector and the SVG
  includes connector, entry, type-label, and signal-harness markup;
- vertical passive values and comments render in distinct columns beside the
  owner body while left-side designators retain their authored placement;
- existing schematic theme variables and canvas border markup remain unchanged;
- all toolkit tests, format checks, performance checks, and package dry-run
  succeed;
- the released toolkit is integrated into ECAD Forge, whose full test,
  structured-data, and static-build gates pass;
- the exact deployed route visually matches the reference page placement,
  harness, footer text, and resistor text columns while retaining the ECAD
  Forge palette and border.

## Release Scope

Publish one patch release of `altium-toolkit`, then one patch release of ECAD
Forge. Push both `main` branches, create GitHub releases, publish the toolkit to
npm, monitor the ECAD Forge deployment to terminal success, and verify the live
application version and exact schematic route.
