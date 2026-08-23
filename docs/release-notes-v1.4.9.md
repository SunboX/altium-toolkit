# altium-toolkit 1.4.9

Version 1.4.9 restores complete mechanical and documentation artwork in native
Altium PCB rendering and supports fitting the viewport to visible layers.

## Drawing annotations

- Text from mechanical, assembly, fabrication, documentation, notes, dimension,
  and courtyard layers is rendered alongside the corresponding drawing
  geometry.
- Side-specific assembly annotations follow the active board side.
- Off-board drawing annotations remain outside the board clip, preserving title
  blocks and fabrication notes at their authored positions.

## Visible-layer viewport

- PCB render options accept hidden layer aliases when calculating the root SVG
  viewport.
- Hidden drawing layers retain their SVG markup for instant visibility toggles
  while no longer expanding the fitted viewport.
- Component placements far outside the board are excluded from board-first
  viewport fitting when drawing layers are hidden.

## Compatibility

- Historical native renderer source remains frozen; the behavior is composed in
  the public convergence renderer.
- Existing render calls without hidden layers preserve their previous output and
  bounds.
- Layer-only exports retain the historical output contract.

## Verification

- Repository-owned fake regressions cover top- and bottom-side drawing text,
  unclipped annotations, retained hidden markup, and visible-layer bounds.
- The complete package suite, formatting check, performance guard, npm package
  dry run, and ECAD Forge integration gates are required for release.
