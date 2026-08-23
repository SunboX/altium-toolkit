# Partial Final OLE Sector Recovery Design

## Problem

Some valid Altium compound documents omit unused padding bytes from their final
512-byte OLE sector. The current reader rejects every non-aligned file before it
can compare the physical tail with the final stream's declared logical length.
Consequently, a recoverable PCB document is reported as corrupt even when every
declared stream byte is present.

## Decision

Keep structural sectors strict and recover only logical stream tails. Directory,
FAT, DIFAT, and mini-FAT reads must still have complete sectors. A regular stream
may read a partial final sector only when its declared byte length requires no
byte beyond the physical input. The reader zero-fills only the unused remainder
needed by its internal fixed-sector concatenation.

This is preferred over unconditional padding because it rejects actual stream
truncation. It is also preferred over an ECAD Forge loader workaround because
OLE integrity belongs to `altium-toolkit`.

## Data Flow

1. Parse the OLE header without requiring total-file sector alignment.
2. Resolve structural chains with full-sector availability requirements.
3. Resolve a regular stream chain with its declared stream length.
4. For every sector in that chain, compute the logical bytes required from that
   sector and compare them with the physical bytes available.
5. Reject when required bytes are missing; otherwise return the available bytes
   and leave only unused tail padding zero-filled.

Mini-stream entries remain protected by the root mini-stream's declared regular
stream length.

## Error Handling

Use the existing actionable corruption error when a structural sector is short
or a declared stream byte is missing. Do not turn malformed FAT chains, directory
chains, or genuinely truncated streams into successful parses.

## Verification

Synthetic repo-owned OLE buffers cover both sides of the boundary:

- a file whose last stream uses only the physically present prefix of its final
  sector must parse and return the exact declared bytes;
- a file missing one declared stream byte must retain the corruption error;
- aligned files and existing stream extraction behavior must remain unchanged.

After the library passes its focused and full checks, release a patch version,
integrate it into ECAD Forge, run the app's test/structured-data/static-build
gates, deploy `main`, and verify a public hosted project in a real browser.
