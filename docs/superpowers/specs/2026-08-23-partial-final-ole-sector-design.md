# Partial Final OLE Sector Recovery Design

## Problem

Some valid Altium compound documents omit unused padding bytes from their final
512-byte OLE sector. The current reader rejects every non-aligned file before it
can compare the physical tail with the final stream's declared logical length.
Consequently, a recoverable PCB document is reported as corrupt even when every
declared stream byte is present.

## Decision

Keep the immutable historical OLE reader unchanged and adapt only the convergence
parser input. Directory, FAT, DIFAT, and mini-FAT sectors must still be physically
complete. A regular stream may use a partial final sector only when its declared
byte length requires no byte beyond the physical input. The convergence adapter
then zero-fills only the unused remainder before invoking the strict native
reader.

This is preferred over unconditional padding because it rejects actual stream
truncation. It is also preferred over an ECAD Forge loader workaround because
OLE integrity belongs to `altium-toolkit`.

## Data Flow

1. Detect a misaligned OLE input at the convergence parser boundary.
2. Read its header, DIFAT, FAT, directory, and mini-FAT chains while requiring
   every structural sector to exist in the original bytes.
3. Resolve each regular directory or root stream with its declared stream length.
4. For every sector in that chain, compute the logical bytes required from that
   sector and compare them with the physical bytes available.
5. Preserve the original buffer when required bytes are missing; otherwise pass
   a zero-padded aligned copy to the unchanged native reader.

Mini-stream entries remain protected by the root mini-stream's declared regular
stream length.

## Error Handling

Preserve the original misaligned buffer when a structural sector is short, a
chain is invalid, or a declared stream byte is missing, so the unchanged native
reader emits its existing actionable corruption error. Do not turn malformed FAT
chains, directory chains, or genuinely truncated streams into successful parses.

## Verification

Synthetic repo-owned OLE buffers cover both sides of the boundary:

- a file whose last stream uses only the physically present prefix of its final
  sector must parse and return the exact declared bytes;
- a file missing one declared stream byte must retain the corruption error;
- aligned files and existing stream extraction behavior must remain unchanged.

After the library passes its focused and full checks, release a patch version,
integrate it into ECAD Forge, run the app's test/structured-data/static-build
gates, deploy `main`, and verify a public hosted project in a real browser.
