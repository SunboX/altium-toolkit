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
- `altium-toolkit/renderers`
- `altium-toolkit/scene3d`
- `altium-toolkit/workers/altium-parser.worker.mjs`
- `altium-toolkit/styles/altium-renderers.css`

## Parser

```js
import { AltiumParser } from 'altium-toolkit/parser'

const documentModel = AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
```

`fileName` is used to infer schematic versus PCB parsing from the extension.
The parser accepts native `.SchDoc` and `.PcbDoc` document bytes as an
`ArrayBuffer` and returns the normalized model described in
[Model Format](model-format.md).

## Renderers

```js
import {
    SchematicSvgRenderer,
    PcbSvgRenderer,
    BomTableRenderer
} from 'altium-toolkit/renderers'
```

- `SchematicSvgRenderer.render(documentModel)` returns schematic SVG markup.
- `PcbSvgRenderer.render(documentModel)` returns PCB SVG markup.
- `BomTableRenderer.render(rows)` returns grouped BOM table markup.

Renderer output is deterministic string markup. The library does not attach DOM
events or mutate a host document.

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
- `PcbScene3dModelRegistry` resolves embedded or session model candidates for
  component placements.
- `PcbScene3dScenePreparator.prepare(documentModel, options)` prepares the same
  scene-description data behind an async API suitable for host workers.
- `PcbScene3dSummaryRenderer.render(documentModel)` returns static 3D summary
  HTML.

The library intentionally does not create Three.js objects, canvases, controls,
or event listeners.
