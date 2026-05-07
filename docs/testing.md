<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Testing

Run the complete suite:

```bash
npm test
```

The tests cover:

- Binary and OLE helpers
- Printable and binary Altium parser recovery for `.SchDoc`, `.PcbDoc`,
  `.PcbLib`, and `.PrjPcb` entrypoints
- PCB primitive stream slicing and focused decoders for tracks, fills, arcs,
  vias, pads, text, regions, rules, raw records, board regions, ownership
  indexes, sidecar PrimitiveParameters/Text tables, and embedded font metadata
- Obfuscated fake schematic and PCB fixture shards
- Schematic SVG, side-resolved PCB SVG, BOM HTML, and static 3D summary
  renderers
- Non-interactive PCB 3D scene-description builders and model registry logic

Fixture data must remain repo-owned and obfuscated. Do not add native provided
Altium files, real customer identifiers, real vendor identifiers, or
source-descriptive fixture names.
