# altium-toolkit 1.4.6

Version 1.4.6 preserves anisotropic ROUND/CIRCLE SMT pad dimensions when
converting Altium renderer data to Circuit JSON.

## Anisotropic ROUND/CIRCLE SMT projection

- Unequal positive dimensions become dimension-preserving `pill` geometry, or
  `rotated_pill` when the authored rotation is meaningful.
- Zero-hole SMT filtering and stable source ordering keep through-hole and
  unrelated pads unchanged.
- Equal-diameter ROUND/CIRCLE pads retain their existing circle geometry.

## Verification

- Public `Parser.parse()` regression coverage exercises schematic and PCB-only models,
  mixed SMT/through-hole order, rotation tolerance, and metadata preservation.
- The complete test suite, performance check, feature-preservation check,
  formatting check, and npm publish dry run passed for this release metadata.

## Contributor

Thanks to Ahmed Alshaybani for the original anisotropic pad projection work.
