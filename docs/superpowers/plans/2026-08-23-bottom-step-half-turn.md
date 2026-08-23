# Bottom STEP Source Half-Turn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve authored bottom-side X-axis half-turns when signed embedded STEP geometry proves that the solid occupies negative source Z.

**Architecture:** Wrap the byte-frozen historical registry and builder in `src/convergence`. The converged registry adds signed source bounds while preserving the native dimension-only contract; the converged builder applies one geometry-based correction after historical scene construction.

**Tech Stack:** JavaScript ES modules, Node.js test runner, Altium embedded STEP metadata, ECAD Forge integration tests.

## Global Constraints

- Fix the behavior in `altium-toolkit`; do not add an ECAD Forge or `pcb-scene3d-viewer` workaround.
- Derive behavior from signed STEP source geometry; do not match designators, filenames, packages, manufacturers, or projects.
- Preserve through-hole behavior and positive-Z surface-mount normalization.
- Add JSDoc for every new method.
- Use 4-space indentation, single quotes, no semicolons, and no trailing commas.
- Do not publish, push, update the ECAD Forge dependency, or deploy.
- Do not modify files covered by `spec/native-source-manifest-v1.1.41.json`.

---

### Task 1: Preserve signed embedded STEP bounds at the convergence boundary

**Files:**
- Add: `src/convergence/PcbScene3dModelRegistry.mjs`
- Modify: `src/extensions.mjs`
- Test: `tests/ui/pcb-scene-model-registry.test.mjs:119-156`

**Interfaces:**
- Consumes: resolved embedded STEP `payloadText` and STEP length-unit metadata.
- Produces: `resolvedModel.sourceBoundsMil` with finite `minX`, `maxX`, `minY`, `maxY`, `minZ`, and `maxZ` values in mils while leaving `resolvedModel.boundsMil` as `{ width, depth, height }`.

- [x] **Step 1: Extend the STEP registry regression with signed-bound assertions**

Add assertions after the current dimension checks:

```js
assert.ok(Math.abs(match.sourceBoundsMil.minX + 25) < 1e-9)
assert.ok(Math.abs(match.sourceBoundsMil.maxX - 75) < 1e-9)
assert.ok(Math.abs(match.sourceBoundsMil.minY + 47.2440944882) < 1e-9)
assert.ok(Math.abs(match.sourceBoundsMil.maxY - 47.2440944882) < 1e-9)
assert.ok(Math.abs(match.sourceBoundsMil.minZ + 90.5511811024) < 1e-9)
assert.ok(Math.abs(match.sourceBoundsMil.maxZ - 196.8503937008) < 1e-9)
assert.deepEqual(Object.keys(match.boundsMil).sort(), [
    'depth',
    'height',
    'width'
])
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/ui/pcb-scene-model-registry.test.mjs`

Expected: FAIL because `match.sourceBoundsMil` is undefined.

- [x] **Step 3: Return signed source bounds without changing dimension bounds**

Wrap the historical registry, delegate all native matching, and parse signed
Cartesian-point extents only for resolved inline STEP payloads. Add
`sourceBoundsMil` to the returned model without changing native `boundsMil`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/ui/pcb-scene-model-registry.test.mjs`

Expected: all model-registry tests pass, including signed millimetre and dimension-only assertions.

- [x] **Step 5: Commit the converged signed-bounds contract**

```bash
git add src/convergence/PcbScene3dModelRegistry.mjs src/extensions.mjs tests/ui/pcb-scene-model-registry.test.mjs
git commit -m "fix: preserve negative-Z bottom STEP orientation"
```

### Task 2: Replace package matching with source-geometry policy

**Files:**
- Add: `src/convergence/PcbScene3dBuilder.mjs`
- Add: `src/convergence/PcbScene3dScenePreparator.mjs`
- Modify: `src/extensions.mjs`
- Test: `tests/ui/pcb-scene-builder-bottom-half-turn.test.mjs:27-196`

**Interfaces:**
- Consumes: `externalModel.sourceBoundsMil` from Task 1 and the authored source X rotation from `componentBody.modelRotationDeg`.
- Produces: a converged external placement where a source with at least 80 percent of its Z span below the origin preserves X=180.

- [x] **Step 1: Make the positive-Z case explicit and add a negative-Z regression**

Change `buildModelRegistry` to accept and return optional signed bounds:

```js
function buildModelRegistry(sourceBoundsMil = null) {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: String(componentBody.name || ''),
                format: 'step',
                sourceStream: String(componentBody.sourceStream || ''),
                ...(sourceBoundsMil ? { sourceBoundsMil } : {})
            }
        }
    }
}
```

Pass `options.sourceBoundsMil` from `buildScene` and give the existing normalization case positive-Z bounds:

```js
sourceBoundsMil: {
    minX: -40,
    maxX: 40,
    minY: -30,
    maxY: 30,
    minZ: 0,
    maxZ: 80
}
```

Replace the package-family preservation case with a generic negative-Z body:

```js
test('PcbScene3dBuilder preserves bottom negative-Z source half-turns', () => {
    const scene = buildScene({
        componentIndex: 5,
        holeDiameter: 0,
        designator: 'U5',
        pattern: 'SURFACE_CONTACTS',
        source: 'CON/SURFACE_CONTACTS',
        modelName: 'negative-z-body.step',
        modelId: '{MODEL-NEGATIVE-Z}',
        modelRotationDeg: { x: 180, y: 0, z: 180 },
        sourceBoundsMil: {
            minX: -40,
            maxX: 40,
            minY: -30,
            maxY: 30,
            minZ: -79,
            maxZ: 1
        }
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'U5')
    assert.deepEqual(scene.externalPlacements[0].modelTransform.rotationDeg, {
        x: -180,
        y: -0,
        z: 0
    })
})
```

- [x] **Step 2: Run the focused scene test and verify RED**

Run: `node --test tests/ui/pcb-scene-builder-bottom-half-turn.test.mjs`

Expected: the negative-Z surface-mount case FAILS with X=0 instead of X=-180.

- [x] **Step 3: Implement the geometry-based policy**

Delegate to the historical builder, then structurally restore X=-180 for a
bottom placement only when its resolved model has dominant negative-Z signed
bounds and its matched source body carries an authored X half-turn. Export a
converged async scene preparator so worker preprocessing composes the same
registry and builder.

- [x] **Step 4: Run both focused suites and verify GREEN**

Run:

```bash
node --test tests/ui/pcb-scene-model-registry.test.mjs tests/ui/pcb-scene-builder-bottom-half-turn.test.mjs
```

Expected: both suites pass; the positive-Z body reports X=0, the negative-Z body reports X=-180, and through-hole behavior remains X=-180.

- [x] **Step 5: Run formatting verification**

Run: `npm run check:format`

Expected: exit 0 with no formatting differences.

- [x] **Step 6: Commit the structural policy**

```bash
git add src/convergence/PcbScene3dBuilder.mjs src/convergence/PcbScene3dModelRegistry.mjs src/extensions.mjs tests/ui/pcb-scene-builder-bottom-half-turn.test.mjs tests/ui/pcb-scene-model-registry.test.mjs
git commit -m "fix: preserve negative-Z bottom STEP orientation"
```

### Task 3: Verify toolkit, app integration, and the reported board

**Files:**
- Temporarily adjust only local dependency wiring under `ecadforge_app/node_modules`; do not modify package metadata.
- No committed fixture or production file is created from the reported board.

**Interfaces:**
- Consumes: the final toolkit scene builder from Tasks 1 and 2.
- Produces: fresh automated and visual evidence that both reported external placements retain X=-180 after a clean app reload.

- [ ] **Step 1: Run the complete toolkit suite**

Run: `npm test`

Expected: all toolkit tests pass with zero failures.

- [ ] **Step 2: Probe the reported board through the app-style path**

Temporarily move the installed package aside and link the sibling checkout:

```bash
ecad_altium_installed="$PWD/node_modules/altium-toolkit"
ecad_altium_backup_dir=$(mktemp -d /tmp/ecad-altium-installed.XXXXXX)
mv "$ecad_altium_installed" "$ecad_altium_backup_dir/altium-toolkit"
ln -s ../../altium-toolkit "$ecad_altium_installed"
```

Run the app-style parser and scene preparator, printing only the requested
placement fields:

```bash
ECAD_PROBE_BOARD=/private/tmp/ecadforge-j7j8.l3GpYs/repo/hardware/2v4/PCB/LimeSDR-Mini_2v4_Rounded.PcbDoc node --input-type=module -e "
import fs from 'node:fs'
import { EcadParserService } from './src/core/ecad/EcadParserService.mjs'
import { EcadScene3dService } from './src/core/ecad/EcadScene3dService.mjs'

const fileName = process.env.ECAD_PROBE_BOARD
const bytes = fs.readFileSync(fileName)
const data = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
)
const documentModel = EcadParserService.parseArrayBuffer(fileName, data)
const scene = await EcadScene3dService.prepare(documentModel)
const requested = new Set(['J7', 'J8'])
const placements = scene.externalPlacements
    .filter((placement) => requested.has(placement.designator))
    .map((placement) => ({
        designator: placement.designator,
        mountSide: placement.mountSide,
        rotationDeg: placement.rotationDeg,
        modelRotationDeg: placement.modelTransform?.rotationDeg,
        projection: placement.projection?.source,
        sourceZ: {
            min: placement.externalModel?.sourceBoundsMil?.minZ,
            max: placement.externalModel?.sourceBoundsMil?.maxZ
        }
    }))

console.log(JSON.stringify(placements, null, 2))
"
```

Expected for both placements:

```js
{
    mountSide: 'bottom',
    rotationDeg: 180,
    modelRotationDeg: { x: -180, y: 0, z: 0 },
    projection: 'model-bounds'
}
```

Their signed source bounds must show dominant negative Z.

- [ ] **Step 3: Run the complete ECAD Forge suite against the local toolkit**

With the temporary sibling link still active, run:

```bash
npm test
npm run check:structured-data
npm run build:static
```

Expected: every command exits 0. Restore normal local dependency wiring after
browser verification with:

```bash
unlink "$ecad_altium_installed"
mv "$ecad_altium_backup_dir/altium-toolkit" "$ecad_altium_installed"
rmdir "$ecad_altium_backup_dir"
```

- [ ] **Step 4: Reload and visually verify localhost**

Reload the exact localhost URL, select the underside/isometric view, and inspect
both connectors without saved component adjustments.

Expected: both models expose their component face away from the PCB and match
the corrected X=180 interactive comparison; browser console has no new errors.
Only after this capture, run the restoration commands from Step 3.

- [ ] **Step 5: Verify repository state and scope**

Run:

```bash
git status --short --branch
git log -3 --oneline
```

Expected: `altium-toolkit` contains only the scoped local commits; ECAD Forge
has no tracked changes. No push, package publication, dependency update, or
deployment has occurred.
