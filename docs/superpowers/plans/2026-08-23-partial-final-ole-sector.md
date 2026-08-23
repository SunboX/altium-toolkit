# Partial Final OLE Sector Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse OLE-backed Altium documents that omit only unused padding from the final sector while continuing to reject missing logical stream bytes.

**Architecture:** Keep full-sector reads as the default for structural OLE data. Pass an expected logical byte length only for regular stream chains, validate physical availability per sector, and zero-fill solely the unused part of an otherwise complete logical stream tail.

**Tech Stack:** JavaScript ES modules, Node.js test runner, npm, OLE Compound File Binary Format.

## Global Constraints

- The behavior must be derived from OLE sector and stream lengths, never file names or project identifiers.
- Tests must use generated, repo-owned binary data and no supplied native files.
- Every new method must have JSDoc and files must remain under 1000 lines.
- Preserve unrelated working-tree changes and stage only scoped release files.

---

### Task 1: Lock the recovery boundary with synthetic OLE tests

**Files:**
- Modify: `tests/core/ole-compound-document.test.mjs`

**Interfaces:**
- Consumes: `OleTestDocumentFactory.createDocumentBuffer()` and `OleCompoundDocument.fromArrayBuffer(arrayBuffer)`.
- Produces: regression coverage for recoverable missing padding and unrecoverable missing logical bytes.

- [ ] **Step 1: Add a factory option for the standard stream's logical length**

Extend the generated directory entry and standard-stream payload so one test can
truncate only unused padding while another truncates declared data.

- [ ] **Step 2: Write the recoverable-tail test**

Create a synthetic aligned document, declare the standard stream length as 13,
slice the file after those 13 final-sector bytes, parse it, and assert
`getStream('StandardStream')` returns `standard-data`.

- [ ] **Step 3: Retain a genuine-truncation test**

Slice one additional byte so only 12 of the declared 13 bytes remain and assert
that reading `StandardStream` throws the existing sector-alignment corruption
message.

- [ ] **Step 4: Run the focused test and verify RED**

Run: `node --test tests/core/ole-compound-document.test.mjs`

Expected: the recoverable-tail test fails because construction still rejects the
partial sector; the genuine-truncation assertion remains meaningful.

### Task 2: Implement bounded partial-sector reads

**Files:**
- Modify: `src/core/ole/OleCompoundDocument.mjs`
- Test: `tests/core/ole-compound-document.test.mjs`

**Interfaces:**
- Consumes: regular sector ids, physical reader byte length, and optional declared stream byte length.
- Produces: `#readRegularChain(startSectorId, expectedByteLength?)` with strict structural reads and bounded logical-stream tail recovery.

- [ ] **Step 1: Remove the blanket total-file alignment rejection**

Retain the actionable corruption message as a shared private error constructor or
throw helper used by availability checks.

- [ ] **Step 2: Validate required bytes per sector**

For structural reads, require the full sector. For a stream chain, require
`min(sectorSize, max(0, expectedByteLength - logicalOffset))` from each sector.
Reject if the physical buffer contains fewer bytes than required.

- [ ] **Step 3: Zero-fill only unused tail padding**

Read the available prefix of a permitted partial final sector into the existing
fixed-size concatenation buffer. Do not synthesize any declared stream byte.

- [ ] **Step 4: Pass declared sizes at stream boundaries**

Pass the root mini-stream size and regular entry stream size into
`#readRegularChain`; leave FAT, DIFAT, directory, and mini-FAT calls strict.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/core/ole-compound-document.test.mjs`

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
