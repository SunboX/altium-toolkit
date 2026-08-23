# Linear PCB Pad Copper Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render dense Altium PCB pad copper groups in linear space and publish the corrected toolkit and ECAD Forge app.

**Architecture:** `PcbSideResolvedRenderModel` continues to assign `copperRenderGroup`; the historical SVG renderer partitions pad fragments during its existing pad iteration and appends them directly to the matching copper groups. The convergence wrapper stops rewriting completed SVG strings. Releases proceed strictly from toolkit tests to npm publication, then registry-backed app integration and deployment.

**Tech Stack:** JavaScript ES modules, Node.js test runner, npm, GitHub CLI, Playwright CLI, GitHub Actions.

## Global Constraints

- Preserve pad element keys, per-group pad order, layer-only exports, and existing surface/subsurface styling.
- Treat missing or unknown `copperRenderGroup` values as `surface`.
- Use only repo-owned synthetic PCB models in tests; do not commit the public reproduction board.
- Publish `altium-toolkit` before installing it into ECAD Forge; no `file:` release dependencies.
- Do not call either release complete until registry, workflow, deployment, and live deep-link checks pass.

---

### Task 1: Add the bounded renderer regressions

**Files:**
- Create: `tests/helpers/DenseGroupedPadRendererProbe.mjs`
- Modify: `tests/ui/pcb-pad-copper-group.test.mjs`

**Interfaces:**
- Consumes: public convergence `PcbSvgRenderer.render(documentModel, options)` and historical `PcbSvgRenderer.render(documentModel, options)`.
- Produces: a child-process probe that exits successfully only when 1,000 grouped pads render within a 384 MiB heap.

- [ ] **Step 1: Create the dense fake-board probe**

```js
import { PcbSvgRenderer } from '../../src/extensions.mjs'

const PAD_COUNT = 1000
const TRACK_COUNT = 5000

/**
 * Builds a dense synthetic PCB that exercises grouped-pad rendering.
 * @returns {object}
 */
function buildDenseBoard() {
    const tracks = Array.from({ length: TRACK_COUNT }, (_value, index) => ({
        x1: index,
        y1: index % 200,
        x2: index + 10,
        y2: (index % 200) + 10,
        width: 5,
        layerId: 1,
        netName: 'N' + index,
        copperRenderGroup: index % 2 ? 'surface' : 'subsurface'
    }))
    const pads = Array.from({ length: PAD_COUNT }, (_value, index) => ({
        x: index,
        y: index % 200,
        sizeTopX: 20,
        sizeTopY: 20,
        shapeTop: 1,
        layerId: index % 2 ? 1 : 32,
        copperRenderGroup: index % 2 ? 'surface' : 'subsurface',
        designator: String(index)
    }))

    return {
        summary: { title: 'Dense grouped-pad fake board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 2000, y2: 0 },
                    { type: 'line', x1: 2000, y1: 0, x2: 2000, y2: 1000 },
                    { type: 'line', x1: 2000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 32, name: 'Bottom Layer' }
            ],
            polygons: [],
            fills: [],
            tracks,
            arcs: [],
            regions: [],
            vias: [],
            pads,
            texts: [],
            dimensions: [],
            components: []
        }
    }
}

const markup = PcbSvgRenderer.render(buildDenseBoard())
const padKeys = markup.match(/data-element-key="pcb-pad-\d+"/gu) || []
console.log(JSON.stringify({ markupLength: markup.length, padCount: padKeys.length }))
```

- [ ] **Step 2: Add direct-grouping and bounded-heap tests**

Add these imports:

```js
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PcbSvgRenderer as HistoricalPcbSvgRenderer } from '../../src/legacy-renderers.mjs'
```

Add the direct renderer contract test:

```js
test('historical PcbSvgRenderer places pads directly in copper groups', () => {
    const markup = HistoricalPcbSvgRenderer.render(buildGroupedPadBoard())
    const subsurfaceStart = markup.indexOf(
        '<g class="pcb-copper pcb-copper--subsurface">'
    )
    const surfaceStart = markup.indexOf(
        '<g class="pcb-copper pcb-copper--surface">'
    )
    const footprintStart = markup.indexOf('<g class="pcb-footprints">')
    const subsurfaceMarkup = markup.slice(subsurfaceStart, surfaceStart)
    const surfaceMarkup = markup.slice(surfaceStart, footprintStart)

    assert.match(subsurfaceMarkup, /data-element-key="pcb-pad-0"/u)
    assert.doesNotMatch(subsurfaceMarkup, /data-element-key="pcb-pad-1"/u)
    assert.match(surfaceMarkup, /data-element-key="pcb-pad-1"/u)
    assert.doesNotMatch(surfaceMarkup, /data-element-key="pcb-pad-0"/u)
})
```

Add this bounded probe test:

```js
test('PcbSvgRenderer renders dense grouped pads within a bounded heap', () => {
    const probePath = fileURLToPath(
        new URL('../helpers/DenseGroupedPadRendererProbe.mjs', import.meta.url)
    )
    const result = spawnSync(
        process.execPath,
        ['--max-old-space-size=384', probePath],
        { encoding: 'utf8', timeout: 20_000 }
    )

    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.padCount, 1000)
    assert.ok(output.markupLength > 1_000_000)
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --test tests/ui/pcb-pad-copper-group.test.mjs`

Expected: the direct historical grouping assertion fails and the bounded probe exits non-zero with V8 heap exhaustion.

---

### Task 2: Render pad groups structurally

**Files:**
- Modify: `src/ui/PcbSvgRenderer.mjs`
- Modify: `src/convergence/PcbSvgRenderer.mjs`
- Test: `tests/ui/pcb-pad-copper-group.test.mjs`

**Interfaces:**
- Consumes: `pad.copperRenderGroup` with supported value `subsurface`; every other value uses `surface`.
- Produces: identical public SVG semantics without completed-markup relocation.

- [ ] **Step 1: Partition pad fragments during rendering**

Replace the single `padMarkup` string with grouped fragment arrays:

```js
const padMarkup = pads.reduce(
    (groups, pad, index) => {
        const markup = PcbSvgRenderer.#renderPad(
            pad,
            PcbSvgRenderer.#primitiveIndex(
                semanticContext,
                'pads',
                pad,
                index
            ),
            semanticContext
        )
        const group =
            pad?.copperRenderGroup === 'subsurface'
                ? 'subsurface'
                : 'surface'
        groups[group].push(markup)
        return groups
    },
    { surface: [], subsurface: [] }
)
```

Insert `padMarkup.subsurface.join('')` before the subsurface copper group's closing tag and `padMarkup.surface.join('')` at the existing surface pad position.

- [ ] **Step 2: Remove the convergence markup relocation**

Reduce `src/convergence/PcbSvgRenderer.mjs` to direct delegation for `render()` and `renderLayerSvgs()`. Delete `#SUBSURFACE_GROUP`, `#SURFACE_GROUP`, `#subsurfacePadIndexes()`, `#movePadsToSubsurfaceGroup()`, and `#extractPadGroup()`.

- [ ] **Step 3: Run focused tests and verify GREEN**

Run: `node --test tests/ui/pcb-pad-copper-group.test.mjs`

Expected: all tests pass; the dense probe reports 1,000 pad keys under the 384 MiB heap.

- [ ] **Step 4: Run toolkit verification**

Run: `npm test && npm run check:format`

Expected: both commands exit `0` with no test failures or formatting differences.

- [ ] **Step 5: Commit the fix**

```bash
git add src/ui/PcbSvgRenderer.mjs src/convergence/PcbSvgRenderer.mjs tests/ui/pcb-pad-copper-group.test.mjs tests/helpers/DenseGroupedPadRendererProbe.mjs
git commit -m 'fix: render PCB pad copper groups linearly'
```

---

### Task 3: Release and publish altium-toolkit

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: verified toolkit commit from Task 2.
- Produces: `altium-toolkit@1.4.7`, Git tag/release `v1.4.7`, and npm `latest` pointing to `1.4.7`.

- [ ] **Step 1: Bump the patch version**

Run: `npm version patch --no-git-tag-version`

Expected: both package files report `1.4.7`.

- [ ] **Step 2: Verify the release artifact**

Run: `npm test && npm run check:format && npm publish --dry-run --cache /private/tmp/altium-toolkit-npm-cache`

Expected: tests and formatting pass; dry-run reports `altium-toolkit@1.4.7` with the expected `src/` entrypoints.

- [ ] **Step 3: Commit and push main**

```bash
git add package.json package-lock.json
git commit -m 'chore: prepare 1.4.7 release'
git push origin main
```

- [ ] **Step 4: Create and verify the GitHub release**

Create release notes describing linear grouped-pad rendering, dense bounded-heap coverage, `npm test`, format, and dry-run results. Run `gh release create v1.4.7 --target $(git rev-parse HEAD) --title 'v1.4.7' --notes-file /tmp/altium-toolkit-release-1.4.7.md`, then verify it with `gh release view v1.4.7 --json tagName,url,isDraft,isPrerelease,name`.

- [ ] **Step 5: Publish and verify npm**

Run the interactive TTY command `npm publish --auth-type=web --browser=/usr/bin/open --cache /private/tmp/altium-toolkit-npm-cache`, open the emitted challenge, and wait for `+ altium-toolkit@1.4.7`. Verify with `npm view altium-toolkit version` and `npm view altium-toolkit dist-tags --json`.

---

### Task 4: Integrate and release ECAD Forge

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify generated version/structured-data fields in `src/*.html`

**Interfaces:**
- Consumes: registry-published `altium-toolkit@1.4.7`.
- Produces: ECAD Forge `1.13.25` using a registry semver dependency and deployable static output.

- [ ] **Step 1: Install the published dependency and bump the app**

Run: `npm install altium-toolkit@1.4.7 && npm version patch --no-git-tag-version && npm run sync:structured-data`.

Expected: the app and lockfile report `1.13.25`, the toolkit dependency resolves from npm, and generated HTML versions are synchronized.

- [ ] **Step 2: Run focused and full release checks**

Run `node --test tests/core/ecad-renderer-pad-context.test.mjs tests/ui/pcb-opposite-side-pad-palette.test.mjs`, then `npm test`, `npm run check:structured-data`, and `npm run build:static`.

Expected: every command exits `0`.

- [ ] **Step 3: Verify the original deep link locally**

Open `http://localhost:3000/?url=https%3A%2F%2Fgithub.com%2Fmyriadrf%2FLimeSDR-Micro%2Ftree%2Fmain%2Fhardware%2FmPCIe%2F1v4&view=pcb&document=PCB%2FLimeSDR-Micro_mPCIe_1v4.PcbDoc` in a fresh Playwright CLI session, wait for the PCB view, assert an `svg.pcb-svg` exists, capture a screenshot, inspect console errors, and sample renderer memory to confirm it remains alive.

- [ ] **Step 4: Commit and push the app release**

```bash
git add package.json package-lock.json src/*.html
git commit -m 'chore: release ECAD Forge 1.13.25'
git push origin main
```

- [ ] **Step 5: Create the GitHub release**

Write `/tmp/ecadforge-release-1.13.25.md` from the actual diff and verification output, then run `gh release create v1.13.25 --target main --title 'ECAD Forge 1.13.25' --notes-file /tmp/ecadforge-release-1.13.25.md` and verify the release and remote tag.

- [ ] **Step 6: Watch deployment and verify production**

Resolve the workflow with `gh run list --branch main --commit <sha>`, watch it using `gh run watch <run-id> --exit-status`, then verify `https://ecadforge.app/` reports `1.13.25`. Open the live version of the original deep link in a fresh browser and confirm the PCB SVG renders without a crash or console error.

---

### Task 5: Final independent verification

**Files:**
- No changes expected.

**Interfaces:**
- Consumes: published package, GitHub releases, pushed app, completed deployment.
- Produces: final evidence for registry, releases, commits, workflows, live rendering, and clean repositories.

- [ ] **Step 1: Re-run repository gates**

Run toolkit `npm test && npm run check:format` and app `npm test && npm run check:structured-data && npm run build:static` from the final commits.

- [ ] **Step 2: Verify external state**

Verify npm version/dist-tags, both GitHub release records and tags, the ECAD Forge workflow conclusion, and the live version/deep link.

- [ ] **Step 3: Verify clean synchronized repositories**

Run `git status -sb` and `git rev-list --left-right --count main...origin/main` in both repositories. Expected: clean status and `0 0` divergence.
