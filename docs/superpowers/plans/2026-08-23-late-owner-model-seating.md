# Late Owner Model Seating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seat late owner-resolved Altium package models on the PCB when their authoritative standoff is zero.

**Architecture:** Extend the public convergence `PcbScene3dBuilder` with a post-build vertical-offset normalization. Resolve the final component owner and original body structurally, then clear only an unchanged positive source `dzMil` whose authored standoff is finite zero. Leave the frozen historical builder and the shared viewer unchanged.

**Tech Stack:** JavaScript ES modules, Node.js test runner, npm, GitHub CLI, ECAD Forge static deployment.

## Global Constraints

- Do not match real project names, designators, vendors, model names, or package names.
- Do not modify frozen historical native source files.
- Preserve positive authored standoffs, unresolved bodies, and downstream-adjusted offsets.
- Add JSDoc to every new method.
- Use 4-space indentation, single quotes, no semicolons, and no trailing commas.
- Publish through the owning toolkit, npm, and ECAD Forge release chain.

---

### Task 1: Capture the structural regression

**Files:**
- Create: `tests/ui/pcb-scene-builder-late-owner-seating.test.mjs`
- Modify: none

**Interfaces:**
- Consumes: `PcbScene3dBuilder.build(documentModel, options)` from `src/convergence/PcbScene3dBuilder.mjs` and `PcbScene3dBuilder.build` from `src/ui/PcbScene3dBuilder.mjs` as the replaceable historical seam.
- Produces: A deterministic regression proving zero-standoff late owners are seated while authored standoffs and unresolved bodies are preserved.

- [ ] **Step 1: Write the failing test**

Create a fake document containing components `U7` and `U8`, plus three fake
component bodies. Temporarily replace the historical builder's public `build`
method so it returns:

```js
{
    externalPlacements: [
        {
            designator: 'U7',
            bodyPositionMil: { x: 120, y: 140 },
            modelTransform: { dzMil: 35 },
            externalModel: { name: 'neutral-body.step' }
        },
        {
            designator: 'U8',
            bodyPositionMil: { x: 320, y: 140 },
            modelTransform: { dzMil: 20 },
            externalModel: { name: 'raised-body.step' }
        },
        {
            designator: 'anonymous-body',
            bodyPositionMil: { x: 520, y: 140 },
            modelTransform: { dzMil: 25 },
            externalModel: { name: 'anonymous-body.step' }
        }
    ]
}
```

Use source bodies with matching names and anchors. Give the first body
`standoffHeightMil: 0, dzMil: 35`, the second
`standoffHeightMil: 20, dzMil: 20`, and the third
`standoffHeightMil: 0, dzMil: 25`. Assert final offsets of `0`, `20`, and `25`
respectively. Restore the historical method in `finally`.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
node --test tests/ui/pcb-scene-builder-late-owner-seating.test.mjs
```

Expected: one assertion failure because the first placement still has
`modelTransform.dzMil === 35`.

### Task 2: Normalize late-owner seating

**Files:**
- Modify: `src/convergence/PcbScene3dBuilder.mjs`
- Test: `tests/ui/pcb-scene-builder-late-owner-seating.test.mjs`

**Interfaces:**
- Consumes: `placement`, `documentModel.pcb.componentBodies`, and `documentModel.pcb.components`.
- Produces: `#normalizeRecoveredOwnerVerticalOffset(placement, componentBody, components): object` and owner/source-offset predicates used only by the convergence builder.

- [ ] **Step 1: Pass components into placement normalization**

Change the build mapping to call:

```js
PcbScene3dBuilder.#normalizePlacement(
    placement,
    documentModel?.pcb?.componentBodies,
    documentModel?.pcb?.components
)
```

Update `#normalizePlacement` so it resolves the source body once, applies
late-owner vertical normalization, then applies the existing bottom STEP
orientation correction to the resulting placement.

- [ ] **Step 2: Implement the late-owner invariant**

Add private helpers equivalent to:

```js
static #normalizeRecoveredOwnerVerticalOffset(
    placement,
    componentBody,
    components
) {
    if (
        !PcbScene3dBuilder.#hasResolvedOwner(placement, components) ||
        !PcbScene3dBuilder.#hasZeroAuthoredStandoff(componentBody) ||
        !PcbScene3dBuilder.#retainsPositiveSourceOffset(
            placement,
            componentBody
        )
    ) {
        return placement
    }

    return {
        ...placement,
        modelTransform: {
            ...(placement.modelTransform || {}),
            dzMil: 0
        }
    }
}
```

`#hasResolvedOwner` must match the final placement designator to a component
designator. `#hasZeroAuthoredStandoff` must require a finite source value whose
absolute value is within `POSITION_EPSILON_MIL`. `#retainsPositiveSourceOffset`
must require both offsets to be finite, source `dzMil > 0`, and equality within
`POSITION_EPSILON_MIL`.

- [ ] **Step 3: Run the focused test and verify green**

Run:

```bash
node --test tests/ui/pcb-scene-builder-late-owner-seating.test.mjs
```

Expected: all assertions pass.

- [ ] **Step 4: Format and run relevant 3D tests**

Run:

```bash
npx prettier --write src/convergence/PcbScene3dBuilder.mjs tests/ui/pcb-scene-builder-late-owner-seating.test.mjs
node --test tests/ui/pcb-scene-builder-late-owner-seating.test.mjs tests/ui/pcb-scene-builder-bottom-half-turn.test.mjs tests/ui/altium-scene3d-external-placement.test.mjs
```

Expected: all selected tests pass.

### Task 3: Verify the exact board and release the toolkit

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/release-notes-v1.4.8.md`

**Interfaces:**
- Consumes: the exact supplied PCB only as local verification input, never as a committed fixture.
- Produces: published `altium-toolkit@1.4.8` and GitHub release `v1.4.8`.

- [ ] **Step 1: Probe the exact board through the public convergence path**

Parse the local PCB with `Parser` and `AltiumExtensionResolver`, create a
`PcbScene3dModelRegistry`, and build with the convergence
`PcbScene3dBuilder`. Assert the supplied late-owner placement has
`modelTransform.dzMil === 0`. Assert the two previously corrected bottom STEP
connectors retain `modelTransform.rotationDeg.x === -180`.

- [ ] **Step 2: Run full toolkit gates**

Run:

```bash
npm test
npm run check:format
```

Expected: zero failures and format check success. If concurrent unrelated work
keeps the suite red, do not publish until that work is either completed or
isolated without discarding it.

- [ ] **Step 3: Bump and package**

Run:

```bash
npm version patch --no-git-tag-version
npm publish --dry-run --cache /private/tmp/altium-toolkit-npm-cache
```

Expected: package version `1.4.8`; dry-run tarball contains convergence source,
tests remain excluded, and no secret or local test input appears.

- [ ] **Step 4: Commit and push**

Stage only the IC12 design, plan, source, test, release notes, and package
version files. Commit with `fix: release late-owner model seating 1.4.8`, then
push `main`.

- [ ] **Step 5: Create the GitHub release and publish npm**

Create GitHub release `v1.4.8` targeting the release commit. Publish with:

```bash
npm publish --auth-type=web --browser=/usr/bin/open --cache /private/tmp/altium-toolkit-npm-cache
```

Verify `npm view altium-toolkit version`, npm dist-tags, the GitHub release, and
remote tag.

### Task 4: Release ECAD Forge with the published toolkit

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: generated `src/*.html` structured-data version fields
- Create: `docs/release-notes-v1.13.27.md`

**Interfaces:**
- Consumes: published `altium-toolkit@1.4.8`.
- Produces: ECAD Forge `1.13.27`, GitHub release `v1.13.27`, and successful FTP deployment workflow.

- [ ] **Step 1: Install published toolkit and bump the app**

Run:

```bash
npm install altium-toolkit@latest
npm version patch --no-git-tag-version
npm run sync:structured-data
```

Verify `package.json` and lockfile resolve registry `altium-toolkit@1.4.8`, not
a local link.

- [ ] **Step 2: Run app release gates**

Run:

```bash
npm test
npm run check:structured-data
npm run build:static
```

Expected: all tests pass, structured data is synchronized, and the static build
completes.

- [ ] **Step 3: Commit, push, and create release**

Stage only the dependency/version, generated HTML, and release-note files;
preserve unrelated user changes. Commit `chore: release ECAD Forge 1.13.27`,
push `main`, and create GitHub release `v1.13.27`.

- [ ] **Step 4: Verify deployment and exact route**

Watch the `Deploy to FTP (main)` workflow for the pushed commit until conclusion
`success`. Open the exact local route in a fresh browser context and capture
visual evidence that the late-owner model is seated while the two bottom STEP
connectors remain correctly oriented. Verify the deployed app version before
reporting the release complete.
