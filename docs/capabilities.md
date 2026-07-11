<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Capabilities

`ToolkitCapabilities.inventory()` returns fresh clone-safe rows in stable id
order. The ids, categories, operations, and row shape are identical across
`circuitjson-toolkit`, `gerber-toolkit`, `altium-toolkit`, and `kicad-toolkit`.

Altium uses three truthful status levels:

- `native`: the package owns the source decoder, project loader, worker, or
  Altium-specific exporter.
- `shared`: the operation runs on canonical CircuitJSON through
  `circuitjson-toolkit`.
- `unavailable`: a capability cannot be represented honestly; callers receive
  `ERR_CAPABILITY_UNAVAILABLE` instead of a placeholder result.

| Capability id          | Altium implementation | Entrypoint                                 |
| ---------------------- | --------------------- | ------------------------------------------ |
| `parse.document`       | Native                | `Parser`                                   |
| `project.load`         | Native                | `ProjectLoader`                            |
| `worker.parse`         | Native                | `altium-toolkit/workers/parser.worker.mjs` |
| `worker.load-project`  | Native                | `altium-toolkit/workers/parser.worker.mjs` |
| `export.selected-part` | Native extension      | `altium-toolkit/extensions`                |
| `validation.document`  | Shared CircuitJSON    | `DocumentResult`                           |
| `metadata.normalize`   | Shared CircuitJSON    | `DocumentResult`                           |
| `units.convert`        | Shared CircuitJSON    | `CircuitJsonUnits`                         |
| `render.pcb`           | Shared CircuitJSON    | `PcbSvgRenderer`                           |
| `render.schematic`     | Shared CircuitJSON    | `SchematicSvgRenderer`                     |
| `bom.build`            | Shared CircuitJSON    | `BomTableRenderer`                         |
| `interaction.pcb`      | Shared CircuitJSON    | `PcbInteractionIndex`                      |
| `query.document`       | Shared CircuitJSON    | `QueryService`                             |
| `manufacturing.export` | Shared CircuitJSON    | `ManufacturingService`                     |
| `simulation.spice`     | Shared CircuitJSON    | `SimulationService`                        |
| `scene3d.build`        | Shared CircuitJSON    | `PcbScene3dBuilder`                        |
| `scene3d.prepare`      | Shared CircuitJSON    | `PcbScene3dPreparator`                     |

The table describes the common surface, not the limit of Altium support. The
complete 1.1.41 native API remains at `altium-toolkit/extensions`. The
entrypoint is the collision-free union of 167 native exports and 37 shared
source-neutral helpers, plus `AltiumExtensionResolver` for explicit native
model access. Its 1,302 frozen historical exports, members, assets, and
native-source contracts are mapped in the
[migration appendix](migration.md). Exact Altium-only binary parsing, reports,
library writers, native SVG fidelity helpers, and native scene adapters are not
copied into unrelated source packages merely to claim parity. Functionality
that can operate truthfully on CircuitJSON is supplied to every package through
the shared canonical services instead.

## Programmatic use

```js
import { ToolkitCapabilities } from 'altium-toolkit/capabilities'

const rows = ToolkitCapabilities.inventory()
const parsing = rows.find((row) => row.id === 'parse.document')

console.log(parsing.status, parsing.entrypoint)
```

Each row includes `id`, `category`, `operation`, `status`, `entrypoint`,
`summary`, `reason`, `tested`, and `documented`.
