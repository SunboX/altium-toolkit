# Native Schematic Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore authored schematic placement and missing native content while preserving the ECAD Forge color scheme and canvas-border layout.

**Architecture:** The frozen Altium parser and historical renderer remain byte-identical. The convergence normalizer uses the native ownership sidecar to restore structurally proven template dimensions, footer parameters, additional-list harness ownership, and rotated owner-text columns. Focused renderer helpers emit harness markup through existing theme variables without changing sheet chrome.

**Implementation correction:** Repository verification showed that the initial task file targets are part of the immutable v1.1.41 source manifest. The completed implementation therefore routes Tasks 1-5 through `src/convergence/AltiumSchematicFidelityNormalizer.mjs`, `src/convergence/SchematicSvgRenderer.mjs`, and focused new UI helpers, with coverage in `tests/convergence-schematic-fidelity.test.mjs`.

**Tech Stack:** JavaScript ES modules, Node.js test runner, SVG, npm.

## Global Constraints

- Never commit or identify the supplied native schematic in tests or fixtures.
- Tests use only obfuscated synthetic records and labels.
- Do not change CSS, schematic theme variables, palette rules, border zones, or title-block chrome geometry.
- Every production function and method receives JSDoc.
- Use the repository-owned `npm test` command for committed verification.

---

### Task 1: Preserve an embedded native template frame

**Files:**
- Modify: `src/core/altium/AltiumLayoutParser.mjs`
- Test: `tests/core/altium-parser/schematic-layout.mjs`

**Interfaces:**
- Consumes: normalized sheet metadata, drawable bounds, and owned footer lines.
- Produces: `resolveSchematicSheetSize(...)` returning the stored native `width`, `height`, `sourceWidth`, and `sourceHeight` when an explicit standard template frame is structurally complete.

- [ ] **Step 1: Write the failing sparse-template regression**

Add a synthetic `SheetStyle=1` record with a fake `A3` template, stored
`CustomX=1550`, `CustomY=1110`, owned footer lines reaching `x=1530`, and sparse
content below `y=800`. Assert the parsed sheet is exactly `1550×1110`, keeps
eight horizontal/four vertical zones, and the SVG viewBox is
`viewBox="0 0 1550 1110"`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/core/altium-parser/schematic-layout.mjs`

Expected failure: parsed height is shortened or promoted instead of `1110`.

- [ ] **Step 3: Implement the structural native-frame resolver**

Add a private helper shaped as:

```js
static #resolveEmbeddedNativeTemplateSheetSize(
    sheet,
    bounds,
    footerLineBounds,
    margin
) {
    // Require SheetStyle=1, paperSize, positive source dimensions, borderOn,
    // all drawables inside the stored frame, and owned footer chrome reaching
    // sourceWidth - margin. Return source dimensions or null.
}
```

Call it before generic sparse-sheet shrinking. Do not modify
`SchematicSheetChromeRenderer`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/core/altium-parser/schematic-layout.mjs`

Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/altium/AltiumLayoutParser.mjs tests/core/altium-parser/schematic-layout.mjs
git commit -m "fix: preserve embedded native schematic frames"
```

### Task 2: Resolve the complete native footer owner group

**Files:**
- Modify: `src/core/altium/SchematicTextParser.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`
- Test: `tests/core/altium-parser/schematic-title-block-footer.mjs`

**Interfaces:**
- Consumes: record-4 text records, hidden sheet parameters, and seeded footer owner indices.
- Produces: visible resolved footer text rows, including organization/address rows and literal approval markers.

- [ ] **Step 1: Write the failing owner-group regressions**

Extend the synthetic footer with one lower seed at `y=85`, upper owner rows at
`y=105..165`, parameters containing obfuscated organization/address values, and
approval parameters containing `*`. Assert all values occur in
`documentModel.schematic.texts` and unresolved `=address...` placeholders do
not.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/core/altium-parser/schematic-title-block-footer.mjs`

Expected failure: upper owner rows stay unresolved or `*` rows are absent.

- [ ] **Step 3: Implement footer-owner collection and literal marker handling**

Add:

```js
static collectTitleBlockFooterOwners(records, sheetWidth) {
    return new Set(
        records
            .filter((record) =>
                SchematicTitleBlockParser.isFooterRecord(
                    record.fields,
                    sheetWidth
                )
            )
            .map((record) => ParserUtils.getField(record.fields, 'OwnerIndex'))
            .filter(Boolean)
    )
}
```

Pass the set to `normalizeSchematicTextRecord(...)`. Owner membership selects
sheet metadata even above the seed band. Preserve `*` only when it resolves an
authored footer placeholder; keep ordinary hidden metadata filtering unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/core/altium-parser/schematic-title-block-footer.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/core/altium/SchematicTextParser.mjs src/core/altium/AltiumParser.mjs tests/core/altium-parser/schematic-title-block-footer.mjs
git commit -m "fix: resolve complete native footer owner text"
```

### Task 3: Recover additional-list harness ownership

**Files:**
- Modify: `src/core/altium/SchematicHarnessParser.mjs`
- Test: `tests/core/altium-parser/schematic-basics.mjs`

**Interfaces:**
- Consumes: records 215, 216, 217, 218 with explicit owners or `OwnerIndexAdditionalList=T`.
- Produces: `schematic.harnesses.connectors[].entries`, `.typeLabel`, `.signalHarnesses`, and `.bundleLinks`.

- [ ] **Step 1: Write the failing additional-list regression**

Build an obfuscated record sequence with one connector, two adjacent entries,
one type label, and one signal harness. Omit `OwnerIndex` on children and set
`OwnerIndexAdditionalList=T`. Assert both entries and the type label attach to
the connector.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/core/altium-parser/schematic-basics.mjs`

Expected failure: connector entries are empty and `typeLabel` is null.

- [ ] **Step 3: Implement adjacency-bounded owner recovery**

Build connector groups in record order. For each connector, accept subsequent
216/217 records marked `OwnerIndexAdditionalList=T` until the next unrelated
top-level record. Explicit `OwnerIndex` remains authoritative; ambiguous rows
remain unowned.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/core/altium-parser/schematic-basics.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/core/altium/SchematicHarnessParser.mjs tests/core/altium-parser/schematic-basics.mjs
git commit -m "fix: recover additional-list harness ownership"
```

### Task 4: Render native schematic harnesses

**Files:**
- Create: `src/ui/SchematicHarnessRenderer.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Test: `tests/ui/renderers/schematic-harnesses.mjs`

**Interfaces:**
- Consumes: normalized `schematic.harnesses`, rendered sheet height, and sheet typography.
- Produces: `SchematicHarnessRenderer.buildMarkup(harnesses, sheetHeight, sheet): string`.

- [ ] **Step 1: Write the failing SVG regression**

Render a synthetic model containing one signal harness and one connector with
two entries and a type label. Assert markup contains classes
`schematic-signal-harness`, `schematic-harness-connector`,
`schematic-harness-entry`, and `schematic-harness-type`, and existing
`--schematic-*` theme variables rather than new colors/CSS.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/ui/renderers/schematic-harnesses.mjs`

Expected failure: no harness markup exists.

- [ ] **Step 3: Implement the focused renderer**

Create a class with static helpers for finite geometry, projected points,
connector-side entry points, theme color resolution, and text markup. Use
`SchematicSvgUtils`, `SchematicTypography`, and `SchematicColorResolver`.
Integrate its output inside the existing clipped schematic-content group; do
not touch border or stylesheet code.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/ui/renderers/schematic-harnesses.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/ui/SchematicHarnessRenderer.mjs src/ui/SchematicSvgRenderer.mjs tests/ui/renderers/schematic-harnesses.mjs
git commit -m "feature: render native schematic harnesses"
```

### Task 5: Keep rotated passive text outside the owner body

**Files:**
- Create: `src/ui/SchematicRotatedOwnerTextPlacement.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Test: `tests/ui/renderers/schematic-rotated-owner-text.mjs`

**Interfaces:**
- Consumes: one text row, its candidate x coordinate, resolved viewer font size, and owner body bounds.
- Produces: `SchematicRotatedOwnerTextPlacement.resolveX(text, x, fontSize, ownerBounds): number`.

- [ ] **Step 1: Write the failing rotated-text regression**

Render a vertical passive body with a left designator and two right-side owner
texts. Assert the left designator keeps its authored x coordinate and each
right-side column receives the same viewer-font baseline compensation, keeping
the value clear of the body and distinct from the comment.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/ui/renderers/schematic-rotated-owner-text.mjs`

Expected failure: the right-side value baseline remains on the body edge.

- [ ] **Step 3: Implement placement helper and integrate it**

`resolveX` returns the original x unless the row has an owner, has a 90-degree
rotation, and lies to the right of that owner's body bounds. For qualifying
rows, return `x + fontSize`. Call it from
`#resolveSchematicTextPlacement(...)` before SVG text creation.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/ui/renderers/schematic-rotated-owner-text.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/ui/SchematicRotatedOwnerTextPlacement.mjs src/ui/SchematicSvgRenderer.mjs tests/ui/renderers/schematic-rotated-owner-text.mjs
git commit -m "fix: place rotated passive text beside owner bodies"
```

### Task 6: Verify and publish the toolkit

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/release-notes-v1.4.11.md`

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run check:format`; format only intended files if needed, then rerun tests.
- [ ] Run `npm run check:performance` and require a passing report.
- [ ] Bump to `1.4.11` with `npm version patch --no-git-tag-version`.
- [ ] Run `npm publish --dry-run --cache /private/tmp/altium-toolkit-npm-cache` and inspect the package.
- [ ] Commit release metadata, push `main`, create `v1.4.11`, monitor CI, publish through npm web authentication, and verify npm `latest` is `1.4.11`.

### Task 7: Release and deploy ECAD Forge

**Files:**
- Modify through npm: `package.json`, `package-lock.json`
- Modify generated/version assertions required by repository tests.

- [ ] Install all five toolkit dependencies at registry `latest`; confirm only intended updates.
- [ ] Bump ECAD Forge from `1.13.29` to `1.13.30`.
- [ ] Run `npm run sync:structured-data`.
- [ ] Run focused dependency/version tests, `npm test`, `npm run check:structured-data`, `npm run build:static`, and `npm run check:format`.
- [ ] Verify the exact local route has native `1550×1110` placement, visible harness markup, resolved footer rows, separated resistor text columns, unchanged theme variables, and unchanged border renderer output.
- [ ] Commit, push `main`, create `v1.13.30`, monitor the FTP deployment to terminal success, and verify production metadata plus the exact live route.
