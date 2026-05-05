# Model Format

The normalized model is intentionally stable with the ECAD Forge parser model.
The parser returns one object per parsed native document.

## Common Fields

- `kind`: `schematic` or `pcb`
- `fileName`: original file name passed to the parser
- `diagnostics`: parser warnings and recovery notes
- `bom`: grouped component metadata where available

## Schematic Fields

Schematic documents include recovered `schematic` data with sheet metadata,
primitives, wires, labels, power ports, sheet symbols, images, net metadata, and
component ownership hints. Coordinates remain in recovered document units until
the SVG renderer maps them into SVG space.

## PCB Fields

PCB documents include recovered `pcb` data with board outline geometry,
component placements, layer metadata, primitive detail, copper, pads, vias,
fills, arcs, embedded model references, and model body placement metadata.

## Compatibility Rule

Consumers should treat unknown fields as additive. Parser fixes may add detail,
but existing field names and shapes should stay compatible unless a major
version explicitly documents a model migration.
