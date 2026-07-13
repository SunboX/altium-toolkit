# Missing Schematic Image Placeholder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the exact Altium missing-file message when a recovered 32-bit BMP preview is effectively invisible.

**Architecture:** `SchematicImageParser` remains responsible for deciding whether recovered binary image data is drawable. It will measure 32-bit BMP alpha coverage and expose an unusable payload through the existing normalized image contract, allowing `SchematicImageRenderer` to reuse its established placeholder markup without binary inspection.

**Tech Stack:** JavaScript ES modules, Node.js test runner through `npm test`, OLE schematic test factory, SVG string renderer.

## Global Constraints

- Classify only from image payload structure and visibility; never match file names, paths, projects, or source-derived phrases.
- Alpha coverage below 1 percent is effectively invisible.
- Wrapped native PNG, JPEG, GIF, SVG, and WebP payloads remain unchanged.
- Preserve image placement, source path, embed flag, aspect ratio, and render order for unusable payloads.
- Use only generated, obfuscated schematic data in tests.
- Do not add a provided native `.SchDoc` file to the test suite.

---

### Task 1: Add the failing parser-to-renderer regression

**Files:**
- Modify: `tests/core/altium-parser/schematic-images.mjs`

**Interfaces:**
- Consumes: `AltiumParser.parseArrayBufferToRendererModel(fileName, arrayBuffer)` and `SchematicSvgRenderer.render(documentModel)`.
- Produces: `createSparseAlphaBmpBytes()` and height support in `createBmpBytes(options)` for generated test payloads.

- [ ] **Step 1: Import the schematic renderer**

```js
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'
```

- [ ] **Step 2: Add a generated sparse-alpha regression**

```js
test('parseAltiumArrayBuffer renders effectively invisible BMP previews as missing-image placeholders', () => {
    const imageFileName =
        'C:\\Forge\\Obfuscated\\Artwork\\ghost-badge.bmp'
    const fileHeaderText =
        '|HEADER=Schematic Document' +
        '|RECORD=31|CustomX=160|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
        '|RECORD=30|IndexInSheet=2|Location.X=20|Location.Y=30|Corner.X=80|Corner.Y=70' +
        '|EmbedImage=T|KeepAspect=T|FileName=' +
        imageFileName
    const arrayBuffer = SchematicImageOleFactory.createDocumentBuffer({
        fileHeaderText,
        imageFileName,
        imageBytes: createSparseAlphaBmpBytes()
    })
    const documentModel = AltiumParser.parseArrayBufferToRendererModel(
        'ghost-image.SchDoc',
        arrayBuffer
    )
    const image = documentModel.schematic.images[0]
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(image.diagnosticState, 'unusable-embedded-payload')
    assert.equal(image.mimeType, '')
    assert.equal(image.dataBase64, '')
    assert.match(
        documentModel.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join('\n'),
        /effectively invisible/i
    )
    assert.match(markup, /Cannot open file/)
    assert.match(markup, /C:\\Forge\\Obfuscated/)
    assert.match(markup, /ghost-badge\.bmp/)
    assert.match(markup, /\. File does not exist\./)
    assert.doesNotMatch(markup, /class="schematic-embedded-image/)
})
```

- [ ] **Step 3: Extend the BMP factory without adding fixture files**

```js
function createSparseAlphaBmpBytes() {
    const width = 20
    const height = 20
    const pixels = new Array(width * height * 4).fill(0)
    pixels.splice(0, 4, 0xff, 0xff, 0xff, 0xff)

    return createBmpBytes({ bitsPerPixel: 32, width, height, pixels })
}
```

Change the factory contract and height initialization to:

```js
/**
 * @param {{ bitsPerPixel: 24 | 32, width?: number, height?: number, pixels: number[] }} options
 */
function createBmpBytes(options) {
    const width = options.width || 1
    const height = options.height || 1
```

- [ ] **Step 4: Run the focused regression and verify RED**

Run:

```bash
npm test -- --test-name-pattern="effectively invisible BMP previews"
```

Expected: FAIL because the image currently has diagnostic state `embedded` and non-empty PNG data.

---

### Task 2: Classify effectively invisible previews in the parser

**Files:**
- Modify: `src/core/altium/SchematicImageParser.mjs`
- Test: `tests/core/altium-parser/schematic-images.mjs`

**Interfaces:**
- Consumes: parsed BMP metadata `{ width, height, bitsPerPixel, pixelOffset, rowStride }`.
- Produces: decoded payload field `effectivelyInvisible: boolean`, normalized diagnostic state `unusable-embedded-payload`, and a recoverable warning.

- [ ] **Step 1: Add the structural coverage threshold**

```js
const MINIMUM_VISIBLE_ALPHA_COVERAGE = 0.01
```

- [ ] **Step 2: Return invisibility metadata from payload decoding**

Update `#decodeEmbeddedImagePayload` so native payloads return
`effectivelyInvisible: false`. For BMP previews, calculate coverage before PNG
encoding:

```js
const alphaCoverage = SchematicImageParser.#bmpAlphaCoverage(bytes, bmpInfo)

if (
    alphaCoverage !== null &&
    alphaCoverage < MINIMUM_VISIBLE_ALPHA_COVERAGE
) {
    return {
        bytes: new Uint8Array(),
        mimeType: '',
        sourceMimeType: sourceMimeType || 'image/bmp',
        nativeClass: '',
        hasAlpha: true,
        effectivelyInvisible: true
    }
}

if (alphaCoverage !== null && alphaCoverage < 1) {
    const rgba = SchematicImageParser.#decodeBmpRgba(bytes, bmpInfo)
    return {
        bytes: SchematicImageParser.#encodePngRgba(
            bmpInfo.width,
            bmpInfo.height,
            rgba
        ),
        mimeType: PNG_SCHEMA_MIME_TYPE,
        sourceMimeType: sourceMimeType || 'image/bmp',
        nativeClass: '',
        hasAlpha: true,
        effectivelyInvisible: false
    }
}
```

The unchanged raw-payload return also includes
`effectivelyInvisible: false`.

- [ ] **Step 3: Replace the boolean alpha scan with coverage measurement**

```js
static #bmpAlphaCoverage(bytes, bmpInfo) {
    if (bmpInfo?.bitsPerPixel !== 32) return null

    let alphaTotal = 0
    for (let y = 0; y < bmpInfo.height; y += 1) {
        const rowOffset = bmpInfo.pixelOffset + y * bmpInfo.rowStride
        for (let x = 0; x < bmpInfo.width; x += 1) {
            alphaTotal += bytes[rowOffset + x * 4 + 3]
        }
    }

    return alphaTotal / (bmpInfo.width * bmpInfo.height * 255)
}
```

Add complete JSDoc describing the nullable coverage result.

- [ ] **Step 4: Normalize the unusable payload without dropping placement**

In `#parseSchematicImageRecord`, branch on
`decoded.effectivelyInvisible` before assigning drawable data:

```js
sourceMimeType = decoded.sourceMimeType
nativeClass = decoded.nativeClass
hasAlpha = decoded.hasAlpha

if (decoded.effectivelyInvisible) {
    diagnosticState = 'unusable-embedded-payload'
    diagnostics.push({
        severity: 'warning',
        message:
            'Embedded schematic image payload is effectively invisible for ' +
            fileName +
            '.'
    })
} else {
    mimeType = decoded.mimeType
    dataBase64 = SchematicImageParser.#encodeBase64(decoded.bytes)
    diagnosticState = 'embedded'
}
```

- [ ] **Step 5: Run the focused regression and verify GREEN**

Run:

```bash
npm test -- --test-name-pattern="effectively invisible BMP previews"
```

Expected: PASS, including exact placeholder-message assertions.

- [ ] **Step 6: Run the complete library verification**

Run:

```bash
npm test
npm run check:format
```

Expected: all tests pass and Prettier reports all matched files use its formatting.

- [ ] **Step 7: Commit the parser fix and regression**

```bash
git add src/core/altium/SchematicImageParser.mjs tests/core/altium-parser/schematic-images.mjs
git commit -m "fix: render unusable schematic images as placeholders"
```

---

### Task 3: Verify the ECAD Forge integration

**Files:**
- Verify only: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app`

**Interfaces:**
- Consumes: local `altium-toolkit` package source and the ECAD Forge Altium demo URL.
- Produces: library/app test evidence plus live DOM and screenshot evidence.

- [ ] **Step 1: Install the local library into the app without changing manifests**

Run from the ECAD Forge repository:

```bash
npm install --no-save --package-lock=false ../altium-toolkit
```

Expected: `package.json` and `package-lock.json` remain unchanged.

- [ ] **Step 2: Run the app-owned tests**

```bash
npm test
```

Expected: all ECAD Forge tests pass.

- [ ] **Step 3: Reopen the local demo and inspect observable markup**

Open:

```text
http://localhost:3000/?demo=altium&view=schematic&document=NODEMCU_ESP12.SchDoc
```

Expected DOM evidence:

```text
.schematic-image-placeholder count: 1
.schematic-image-placeholder-message text includes:
Cannot open file
C:\Forge\Obfuscated\Artwork\ghost-badge.bmp
. File does not exist.
.schematic-embedded-image count: 0
```

- [ ] **Step 4: Capture and inspect a screenshot**

Expected: the missing-file message is visible in the authored title-block image
bounds and the surrounding schematic/title-block geometry remains unchanged.

- [ ] **Step 5: Confirm both worktrees contain only intended tracked changes**

```bash
git status --short
git -C ../altium-toolkit status --short
```

Expected: ECAD Forge has no tracked changes; Altium Toolkit is clean after its
implementation commit.
