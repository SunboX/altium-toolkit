# Owner-Grouped Native Footer Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every primitive in an authored Altium native-footer owner group the same effective right-edge translation.

**Architecture:** Preserve the frozen historical renderer and its primitive-level footer partitioner. Add a convergence adapter that uses the historical lower-right predicate to discover seeded footer owners and the exact shared legacy offset, then pretranslates only their non-seed members before rendering.

**Tech Stack:** JavaScript ES modules, Node.js test runner, deterministic SVG markup, Prettier.

## Global Constraints

- Implement the correction in `altium-toolkit`; do not add an ECAD Forge workaround.
- Do not modify frozen historical source under `src/ui`.
- Do not match file names, project identifiers, vendor text, image data, labels, or fixed sample coordinates.
- Do not commit the supplied native schematic or source-derived fixture data.
- Preserve ownerless primitives and primitives belonging to non-footer owners.
- Use the one shared offset the historical renderer applies to every footer seed.
- Add JSDoc for every new method.
- Use 4-space indentation, single quotes, no semicolons, and no trailing commas.
- Do not publish, push, or modify the app's existing uncommitted work.

---

### Task 1: Add the observable owner-alignment regression

**Files:**
- Create: `tests/ui/schematic-native-footer-owner-alignment.test.mjs`

- [x] **Step 1: Write a repository-owned fake promoted sheet**

Include a lower seed and upper line, text, and image sharing a neutral owner,
a second seeded owner, and one unrelated owner. Do not use supplied source
identifiers, labels, or fixture data.

- [x] **Step 2: Verify the regression is red**

Run:

```bash
node --test tests/ui/schematic-native-footer-owner-alignment.test.mjs
```

Expected before production changes: the upper owner members remain at their
untranslated coordinates.

---

### Task 2: Align seeded owners at the convergence boundary

**Files:**
- Create: `src/convergence/AltiumSchematicNativeFooterOwnerAligner.mjs`
- Modify: `src/convergence/SchematicSvgRenderer.mjs`

- [x] **Step 1: Discover seeded owners structurally**

Mirror the historical promoted-sheet and lower-right seed predicate across all
primitive families. Normalize non-empty owner indexes and collect the maximum
horizontal seed bound.

- [x] **Step 2: Derive the shared legacy offset**

Compute `max(sheet.width - margin - seedMaximumX, 0)`, matching the historical
renderer's native-footer group transform.

- [x] **Step 3: Pretranslate only non-seed owner members**

Create render-only copies of non-seed primitives belonging to seeded owners.
Translate present horizontal scalar coordinates plus point and segment arrays.
Leave seed primitives, other owners, and the caller's document unchanged.

- [x] **Step 4: Integrate before the historical renderer**

Apply the adapter after image normalization in the convergence
`SchematicSvgRenderer`, then retain the existing visibility adaptation and
legacy rendering flow.

- [x] **Step 5: Verify the focused regression is green**

Run:

```bash
node --test tests/ui/schematic-native-footer-owner-alignment.test.mjs
```

Expected: all owner members have the same effective 104-unit translation, the
second seeded owner uses that shared offset, and the unrelated owner is fixed.

---

### Task 3: Verify and commit the scoped implementation

- [x] **Step 1: Format and run repository verification**

Run:

```bash
npx prettier --write src/convergence/AltiumSchematicNativeFooterOwnerAligner.mjs src/convergence/SchematicSvgRenderer.mjs tests/ui/schematic-native-footer-owner-alignment.test.mjs
npm test
npm run check:format
```

- [x] **Step 2: Verify the supplied route structurally without committing it**

Stream the public schematic directly into the local parser, render it with the
local toolkit, and assert the shared effective transform for lower and upper
footer geometry plus the image without persisting source data.

- [x] **Step 3: Commit only the toolkit implementation**

Stage the adapter, convergence integration, fake regression, design, and plan.
Run `git diff --cached --check`, inspect the staged diff, and commit locally as:

```bash
git commit -m "fix: align complete native footer owner groups"
```

Do not push or publish.
