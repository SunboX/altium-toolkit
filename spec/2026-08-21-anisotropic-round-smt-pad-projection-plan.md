# Anisotropic ROUND SMT Pad Projection Implementation Plan

> **Execution note:** Follow the `superpowers:executing-plans` skill and verify each checkpoint before continuing.

**Goal:** Preserve anisotropic Altium ROUND/CIRCLE SMT pad dimensions by projecting them to Circuit JSON pill geometry, release the fix in `altium-toolkit`, and deploy ECAD Forge with current releases of all toolkit dependencies.

**Architecture:** Keep the vendored parser adapter unchanged. Add a convergence-layer projection after native schematic projection, pairing adapted pads with canonical renderer pads by stable order. Only zero-hole ROUND/CIRCLE pads with unequal positive dimensions are reclassified. Use a small angular epsilon so floating-point noise near zero does not turn a horizontal pill into a rotated pill.

**Tech stack:** Node.js ESM, Node test runner, npm, GitHub CLI, GitHub Actions.

---

## Task 1: Add a public-parser regression test

**Files:**

- Create: `tests/canonical-pcb-round-pad-projection.test.mjs`
- Reference: `src/Parser.mjs`
- Reference: `src/AltiumParser.mjs`

1. Add a synthetic renderer-model fixture by temporarily replacing `AltiumParser.parseArrayBufferToRendererModel`.
2. Exercise `Parser.parse()` rather than the convergence helper directly.
3. Include, in mixed renderer order:
   - an unequal ROUND SMT pad at zero rotation;
   - a through-hole ROUND pad between SMT pads;
   - an unequal ROUND SMT pad with near-zero rotation;
   - an unequal ROUND SMT pad at 90 degrees;
   - an equal-diameter ROUND SMT pad.
4. Assert the public Circuit JSON output contains `pill`, `pill`, `rotated_pill`, and `circle` respectively, with both anisotropic dimensions preserved.
5. Run the focused test and confirm it fails because the unequal pads are still circles.
6. Commit the failing regression test with contributor attribution.

## Task 2: Implement the convergence projection

**Files:**

- Modify: `src/convergence/AltiumCircuitJsonProjection.mjs`
- Test: `tests/canonical-pcb-round-pad-projection.test.mjs`

1. Add a private projection method that filters native renderer pads to SMT pads and pairs them with canonical SMT pads in stable order.
2. For renderer `ROUND`/`CIRCLE` pads with zero hole, positive unequal X/Y sizes, update the canonical pad shape:
   - `pill` when absolute rotation is at most `1e-6` degrees;
   - `rotated_pill` otherwise.
3. Set `radius = min(width, height) / 2`, preserve `width` and `height`, and leave IDs, layers, positions, rotations, and metadata untouched.
4. Call the projection after the existing native schematic projection and before model construction.
5. Run the focused test and confirm it passes.
6. Run `npm test`, `npm run check:format`, `npm run test:performance`, and `npm run test:features`.
7. Parse the noncommitted NodeMCU sample on main and on the fixed tree; verify all 16 previously circular unequal ROUND SMT pads become dimension-preserving pills without changing the total SMT-pad count.
8. Commit the implementation with `Co-authored-by: Ahmed Alshaybani`.

## Task 3: Review and release `altium-toolkit`

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/release-notes-v1.4.6.md`

1. Request an independent code review of the full change from the original main revision.
2. Address all valid findings and rerun affected tests.
3. Bump the package patch version to `1.4.6` without creating an automatic tag.
4. Add concise release notes describing the generalized ROUND/CIRCLE SMT projection, public-parser regression coverage, and contributor credit.
5. Run fresh release gates: `npm test`, `npm run check:format`, `npm run test:performance`, `npm run test:features`, and `npm publish --dry-run`.
6. Commit the release metadata and push `main`.
7. Create and verify GitHub release `v1.4.6`.
8. Publish `altium-toolkit@1.4.6` to npm through web authentication and verify the registry version and `latest` dist-tag.
9. Comment on PR #1 with the adapted release outcome and contributor credit.

## Task 4: Update and verify ECAD Forge

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify generated structured-data HTML under `src/` if the sync command changes it

1. Query npm for the latest versions of `gerber-toolkit`, `circuitjson-toolkit`, `altium-toolkit`, `kicad-toolkit`, and `pcb-scene3d-viewer`.
2. Install all five current releases explicitly, ensuring `altium-toolkit@1.4.6` is selected.
3. Bump the ECAD Forge patch version to `1.13.22` without creating an automatic tag.
4. Run `npm run sync:structured-data` and inspect the generated changes.
5. Run `npm test`, `npm run check:structured-data`, `npm run build:static`, and the repository format check if present.
6. Commit only the intended dependency, version, and generated structured-data changes.

## Task 5: Release, deploy, and verify ECAD Forge

1. Push ECAD Forge `main`.
2. Create and verify GitHub release `v1.13.22` with concise release notes.
3. Resolve the `Deploy to FTP (main)` workflow run associated with the pushed commit and watch it to a successful conclusion.
4. Verify the production site responds successfully and reports the new app version.
5. Load an Altium PCB through the production app and confirm the affected anisotropic ROUND SMT pads render as elongated pads rather than circles.
6. Confirm both repositories are clean and summarize exact commits, releases, npm versions, test results, deployment conclusion, and production evidence.
