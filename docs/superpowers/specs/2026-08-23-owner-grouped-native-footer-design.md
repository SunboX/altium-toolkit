# Owner-Grouped Native Footer Alignment Design

## Context

Promoted Altium sheets can have a recovered standard-page width that is wider
than the stored native template width. The renderer keeps native footer chrome
at the standard sheet edge by translating selected lower-right primitives by
the width difference.

The supplied route exposes one authored title-block assembly whose lines,
texts, and embedded image all share one non-empty owner index. The current
partitioner classifies each primitive independently using a lower-page cutoff.
Primitives below the cutoff enter the translated native-footer group, while
the upper rows and image remain in the unshifted schematic-content group. The
result is a horizontal break inside one title block.

## Evidence

The live SVG uses a `translate(104 0)` transform for the native footer. The
lower title-block grid is inside that group, while the upper grid and logo are
inside the untransformed schematic-content group.

A local parse of the supplied document confirms that every affected primitive
has the same owner index. The lower rows occupy native document Y coordinates
through 120, while the upper rows and image extend through 180. The current
120-unit primitive cutoff therefore splits the owner group.

The supplied document is reproduction evidence only. Its native file, project
name, vendor name, logo data, labels, and exact coordinates must not enter the
repository fixtures or production rules.

## Considered Approaches

### Group primitives by authored owner

Use the existing lower-right footer predicate only to identify a footer owner,
then classify every primitive family with that owner as native footer chrome.
This preserves the authored grouping contract and keeps the current sheet and
footer detection behavior.

This is the approved approach because it derives alignment from structural
ownership rather than sample dimensions or text.

### Increase the footer cutoff

Raising the cutoff would include this template's upper rows, but another
template could extend farther and fail again. It would encode a coordinate
heuristic instead of the document structure and is rejected.

### Replace native graphics with a synthesized title block

Suppressing native footer graphics would avoid mixed transforms, but it would
discard authored logos, custom rows, typography, and parameters. It is
rejected because native-template fidelity is required.

## Approved Behavior

`SchematicNativeFooterPartitioner` must partition promoted-sheet footer
graphics in two passes:

1. Apply the existing promoted-sheet and lower-right footer predicate to find
   structurally qualifying primitives with non-empty owner indexes.
2. Collect the qualifying owner indexes.
3. Classify every line, polygon, rectangle, rounded rectangle, ellipse, arc,
   bezier, pie, IEEE symbol, text, and image with one of those owners into the
   native footer.
4. Leave ownerless primitives and primitives belonging to other owners in
   their existing coordinate space.
5. Compute footer bounds from the complete classified owner groups so the
   existing right-edge translation is derived from the complete footer.

Owner indexes must be normalized as trimmed strings. The rule must not match
file names, project identifiers, vendor text, image data, labels, or fixed
sample coordinates.

## Ownership and Scope

The correction belongs in `altium-toolkit`, which owns Altium schematic
parsing and deterministic SVG rendering. ECAD Forge must not add an app-side
SVG translation, CSS override, or document-specific adapter.

Only the native-footer partitioning behavior and its renderer regression test
are in scope. The app's existing uncommitted PCB and release work must remain
untouched.

## Testing

A repository-owned fake promoted sheet will contain one footer owner whose
lower primitive qualifies under the existing predicate and whose upper line,
text, and image extend beyond the cutoff. The observable SVG must place the
entire owner group inside one translated `schematic-native-footer` group and
must not leave those upper primitives in `schematic-content`.

The focused test must fail before production changes and pass after them. The
complete toolkit test and formatting checks must pass. The supplied live route
will be reparsed locally as non-committed verification evidence and its
title-block primitives must share the same final horizontal transform.
