import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Verifies the browser example starts by loading credited source documents.
 */
test('Arduino example page starts in an automatic loading state', async () => {
    const html = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/index.html'),
        'utf8'
    )

    assert.doesNotMatch(html, />No document loaded</)
    assert.match(html, /Loading credited source document/)
})

/**
 * Verifies the local document picker is shown without decorative preview art.
 */
test('Arduino example page omits the decorative board preview', async () => {
    const html = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/index.html'),
        'utf8'
    )

    assert.match(html, /Load local Altium document/)
    assert.doesNotMatch(html, /class="board-preview"/)
})

/**
 * Verifies credited source documents are loaded without a manual source picker.
 */
test('Arduino example page omits credited source document picker controls', async () => {
    const html = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/index.html'),
        'utf8'
    )

    assert.doesNotMatch(html, /class="source-picker"/)
    assert.doesNotMatch(html, /data-source-document=/)
    assert.doesNotMatch(html, />\s*Source schematic\s*</)
    assert.doesNotMatch(html, />\s*Source PCB\s*</)
})

/**
 * Verifies the example page exposes the interactive Three.js PCB view.
 */
test('Arduino example page wires a Three.js PCB view', async () => {
    const html = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/index.html'),
        'utf8'
    )
    const script = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/example.mjs'),
        'utf8'
    )

    assert.match(html, /"three": "\.\.\/\.\.\/node_modules\/three\//)
    assert.match(html, /"three\/addons\/": "\.\.\/\.\.\/node_modules\/three\//)
    assert.match(html, /data-view="3d"/)
    assert.match(script, /PcbThreeSceneRenderer/)
    assert.match(script, /data-three-scene-3d-viewport/)
})

/**
 * Verifies 3D controls read their digit-bearing data attributes explicitly.
 */
test('Arduino Three.js control script avoids dataset camel-casing for 3d attributes', async () => {
    const script = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/PcbThreeSceneRenderer.mjs'),
        'utf8'
    )

    assert.match(script, /getAttribute\('data-three-scene-3d-preset'\)/)
    assert.match(script, /getAttribute\('data-three-scene-3d-toggle'\)/)
    assert.doesNotMatch(script, /dataset\.threeScene3d/)
})

/**
 * Verifies the example constrains the 3D scene within narrow viewports.
 */
test('Arduino example constrains the Three.js layout to the viewport width', async () => {
    const css = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/styles.css'),
        'utf8'
    )

    assert.match(css, /\.viewer-panel\s*\{[^}]*overflow:\s*hidden;/s)
    assert.match(css, /\.viewer-toolbar\s*\{[^}]*width:\s*100%;/s)
    assert.match(css, /\.output\s*\{[^}]*width:\s*100%;/s)
    assert.match(css, /\.scene-3d\s*\{[^}]*max-width:\s*100%;/s)
    assert.match(css, /\.scene-3d__stage\s*\{[^}]*max-width:\s*100%;/s)
})

/**
 * Verifies the example script fetches every credited source document on boot.
 */
test('Arduino example script loads all credited source documents automatically', async () => {
    const script = await readFile(
        resolve(REPO_ROOT, 'examples/arduino-uno/example.mjs'),
        'utf8'
    )

    assert.match(script, /Promise\.all\(\s*SOURCE_DOCUMENTS\.map/)
    assert.doesNotMatch(
        script,
        /querySelectorAll\('\[data-source-document\]'\)/
    )
    assert.doesNotMatch(script, /dataset\.sourceDocument/)
})
