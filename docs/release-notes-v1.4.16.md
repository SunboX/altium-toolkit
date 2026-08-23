# altium-toolkit 1.4.16

Version 1.4.16 preserves authored STEP anchors during late geometric owner
recovery and leaves model-local orientation normalization to the 3D runtime.

## 3D placement fidelity

- Near-centroid surface-mount bodies retain their authored positions when the
  recovered owner is geometrically unambiguous.
- Height-backed owner recovery marks valid source anchors explicitly instead
  of converting them into component-center offsets.
- Geometric owner recovery preserves the component's authored board-space yaw;
  it no longer infers package-specific half-turns from labels or pad topology.

## Compatibility

- Placement recovery remains based on generic body, pad, and footprint
  geometry without project names, filenames, designators, or library strings.
- Existing schematic colors, canvas borders, and public renderer signatures
  remain unchanged.

## Verification

- Repository-owned synthetic tests cover near-centroid connectors,
  height-backed authored anchors, and preserved switch yaw.
- The complete package suite, formatting check, and npm package dry run are
  required for release.
