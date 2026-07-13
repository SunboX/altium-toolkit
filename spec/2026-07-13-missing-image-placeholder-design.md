# Missing Schematic Image Placeholder Design

## Problem

An embedded schematic image record can resolve to a 32-bit BMP preview whose
alpha channel makes nearly the entire payload invisible. The parser currently
treats any mixture of transparent and visible pixels as meaningful alpha,
converts the preview to PNG, and classifies it as an embedded image. The SVG
renderer then emits an image node that appears blank instead of the missing-file
message used for an unavailable image.

## Scope

The fix belongs in `altium-toolkit`, which owns Altium image parsing and
schematic SVG rendering. It must apply to all recovered 32-bit BMP previews
without matching source file names, paths, projects, or message content.

Native wrapped PNG, JPEG, GIF, SVG, and WebP payloads remain unchanged. Healthy
BMP previews with meaningful visible alpha coverage also remain embedded.

## Design

`SchematicImageParser` will measure the alpha coverage of an uncompressed
32-bit BMP preview before converting it to PNG. Alpha coverage is the sum of
the pixel alpha values divided by the maximum possible alpha sum for the image.

A preview with alpha coverage below 1 percent is effectively invisible and is
not a drawable embedded payload. The normalized image retains its placement,
source file name, embed flag, aspect-ratio flag, and render order, but exposes
empty `mimeType` and `dataBase64` values with diagnostic state
`unusable-embedded-payload`. Parsing also emits a warning that the embedded
payload is effectively invisible.

The existing `SchematicImageRenderer` already renders images without usable
payload data as placeholders. It will therefore produce the existing exact
Altium-style message:

1. `Cannot open file`
2. The source path wrapped to the placeholder width
3. `. File does not exist.`

No renderer-specific binary inspection or source-specific phrase matching will
be added.

## Data Flow

1. Resolve the embedded image bytes from an OLE stream or packed storage.
2. Prefer a valid wrapped native image payload when present.
3. For an uncompressed 32-bit BMP preview, calculate alpha coverage.
4. Classify coverage below 1 percent as unusable; otherwise keep the current
   BMP-to-PNG behavior.
5. Render unusable payloads through the existing missing-image placeholder.

## Error Handling

An effectively invisible preview is a recoverable parse condition. The parser
keeps the image record and adds a warning rather than throwing or dropping the
placement. Missing payloads continue to use their current diagnostic state.

## Testing

Tests will use only generated, obfuscated schematic data:

- A synthetic OLE schematic with a 32-bit BMP preview below 1 percent alpha
  coverage must normalize to `unusable-embedded-payload` with empty payload
  data and a warning.
- Rendering that normalized image must contain the exact three-part message and
  wrapped source path, with no embedded image node.
- A synthetic 32-bit BMP with alpha coverage at or above 1 percent must remain
  a PNG embedded image.
- Existing `altium-toolkit` tests and the ECAD Forge application tests must
  remain green.
- The local ECAD Forge demo must show the placeholder message in the authored
  image bounds.

## Acceptance Criteria

- Effectively invisible recovered BMP previews display the exact Altium-style
  missing-file message.
- Valid embedded images continue to render.
- The behavior is derived only from payload structure and visibility.
- No provided native schematic is added to the test suite.
