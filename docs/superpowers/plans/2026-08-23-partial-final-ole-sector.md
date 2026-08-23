# Partial Final OLE Sector Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse OLE-backed Altium documents that omit only unused padding from the final sector while continuing to reject missing logical stream bytes.

**Architecture:** Keep the immutable historical OLE reader unchanged. Add a convergence input normalizer that validates structural sectors and declared regular-stream bytes against the original physical length, then zero-fills solely the unused part of an otherwise complete logical stream tail.

**Tech Stack:** JavaScript ES modules, Node.js test runner, npm, OLE Compound File Binary Format.

## Global Constraints

- The behavior must be derived from OLE sector and stream lengths, never file names or project identifiers.
- Tests must use generated, repo-owned binary data and no supplied native files.
- Every new method must have JSDoc and files must remain under 1000 lines.
- Preserve unrelated working-tree changes and stage only scoped release files.

---

### Task 1: Lock the convergence recovery boundary with synthetic OLE tests

**Files:**
- Create: `tests/convergence-ole-tail-normalizer.test.mjs`

**Interfaces:**
- Consumes: a generated OLE buffer and `OleCompoundDocument.fromArrayBuffer(arrayBuffer)` as the unchanged strict reader.
- Produces: regression coverage for recoverable missing padding and unrecoverable missing logical bytes.

- [ ] **Step 1: Add a factory option for the standard stream's logical length**

Generate a compact OLE file whose FAT and directory sectors are complete and
whose declared regular stream occupies the physical final sector.

- [ ] **Step 2: Write the recoverable-tail test**

Create a synthetic aligned document, slice the file after the declared final
stream bytes, normalize it, and assert the unchanged strict reader returns the
exact stream.

- [ ] **Step 3: Retain a genuine-truncation test**

Slice one additional declared byte and assert normalization preserves the
misaligned input so the unchanged strict reader retains its corruption error.

- [ ] **Step 4: Run the focused test and verify RED**

Run: `node --test tests/convergence-ole-tail-normalizer.test.mjs`

Expected: FAIL because `AltiumOleInputTailNormalizer` does not exist.

### Task 2: Implement bounded convergence input normalization

**Files:**
- Create: `src/convergence/AltiumOleInputTailNormalizer.mjs`
- Modify: `src/convergence/AltiumDocumentBuilder.mjs`
- Test: `tests/convergence-ole-tail-normalizer.test.mjs`

**Interfaces:**
- Consumes: one owned parser `ArrayBuffer` before the native decoder.
- Produces: `AltiumOleInputTailNormalizer.normalize(arrayBuffer)` with strict structural validation and bounded logical-stream tail recovery.

- [ ] **Step 1: Preserve the historical native reader**

Do not modify `src/core/ole/OleCompoundDocument.mjs` or its immutable source
manifest. Run the canonical performance contract to prove the baseline remains
byte-exact.

- [ ] **Step 2: Validate required bytes per sector**

In the convergence normalizer, require full DIFAT, FAT, directory, and mini-FAT
sectors. For a regular stream chain, require
`min(sectorSize, max(0, expectedByteLength - logicalOffset))` from each sector.
Preserve the original input if the physical buffer contains fewer bytes.

- [ ] **Step 3: Zero-fill only unused tail padding**

Copy a proven complete logical input into an aligned zero-filled buffer. Do not
synthesize any declared stream byte.

- [ ] **Step 4: Normalize before the native parser boundary**

Invoke the normalizer from `AltiumDocumentBuilder.decode` after obtaining the
owned input buffer and before the unchanged `AltiumParser` call.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/convergence-ole-tail-normalizer.test.mjs` and
`node --test tests/canonical-performance-contract.test.mjs`

Expected: all focused OLE tests pass.

### Task 3: Release the toolkit and integrate ECAD Forge

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify in ECAD Forge: `package.json`
- Modify in ECAD Forge: `package-lock.json`
- Modify generated ECAD Forge `src/*.html` through `npm run sync:structured-data`

**Interfaces:**
- Consumes: published `altium-toolkit` patch release.
- Produces: ECAD Forge production dependency and deployed static app using the bounded OLE recovery.

- [ ] **Step 1: Verify the toolkit**

Run the focused test, `npm test`, `npm run check:format`, and
`npm publish --dry-run` using an isolated npm cache. Distinguish any pre-existing
unrelated dirty-test failure from the scoped focused test.

- [ ] **Step 2: Release the toolkit patch**

Bump the package patch version, stage only scoped files, commit, push `main`,
create the GitHub release, publish with npm web auth, and verify `latest`.

- [ ] **Step 3: Integrate the registry package in ECAD Forge**

Install the new `altium-toolkit` version through npm, bump the app patch version,
run `npm run sync:structured-data`, then verify `npm test`,
`npm run check:structured-data`, and `npm run build:static`.

- [ ] **Step 4: Deploy and verify LIVE**

Commit and push app `main`, create the GitHub release, watch the exact deployment
workflow to success, then use a real browser to confirm a hosted project opens
its PCB document and renders PCB entities.
