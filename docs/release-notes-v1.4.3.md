# altium-toolkit 1.4.3

Version 1.4.3 keeps PCB fabrication details on their authored board side when
preparing side-resolved render models.

## Side-correct PCB fabrication details

- Front-side views retain top overlay, paste, and solder-mask primitives while
  excluding their bottom-side counterparts.
- Back-side views retain bottom overlay, paste, and solder-mask primitives while
  excluding their top-side counterparts.
- Shared mechanical and documentation layers remain visible on both sides.
- Copper projection continues to use the established native Altium behavior.

## Verification

- A side-resolution regression covers fills, tracks, arcs, regions,
  shape-based regions, and board regions with neutral-layer preservation.
- The complete package suite, formatting, and npm dry-run gates verify the
  release.
