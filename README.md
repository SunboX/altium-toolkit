# Altium Toolkit

Altium Toolkit is an ESM JavaScript library for parsing native Altium
schematic and PCB documents and rendering deterministic, non-interactive
outputs from the recovered model.

The package was extracted from ECAD Forge so parser behavior, normalized model
shape, and renderer output can be reused by other browser or Node-based tools.

## Features

- Parse standalone native `.SchDoc` and `.PcbDoc` files from `ArrayBuffer`
- Recover schematic records, PCB outlines, placements, primitives, embedded
  schematic images, and embedded PCB STEP payload metadata
- Render schematic SVG, PCB SVG, and grouped BOM HTML
- Build non-interactive PCB 3D scene-description data for host applications
- Render a static 3D board summary
- Run entirely with local input data; no network calls are made by the parser

## Install

```bash
npm install git+ssh://git@github.com/SunboX/altium-toolkit.git
```

## Usage

```js
import {
    AltiumParser,
    SchematicSvgRenderer,
    PcbSvgRenderer,
    BomTableRenderer,
    PcbScene3dBuilder
} from '@sunbox/altium-toolkit'

const documentModel = AltiumParser.parseArrayBuffer(file.name, arrayBuffer)

const schematicMarkup = SchematicSvgRenderer.render(documentModel)
const pcbMarkup = PcbSvgRenderer.render(documentModel)
const bomMarkup = BomTableRenderer.render(documentModel.bom || [])
const sceneDescription = PcbScene3dBuilder.build(documentModel)
```

Optional renderer CSS is available through:

```js
import '@sunbox/altium-toolkit/styles/altium-renderers.css'
```

## Documentation

- [API](docs/api.md)
- [Model Format](docs/model-format.md)
- [Testing](docs/testing.md)
- [Scope](spec/library-scope.md)

## Test

```bash
npm test
```

The test suite uses repo-owned, obfuscated fixture shards only. Do not add
native customer, vendor, or source project files to this repository.

## License

This repository is licensed under the PolyForm Noncommercial License 1.0.0.
See [LICENSE](LICENSE) and [NOTICE](NOTICE).
