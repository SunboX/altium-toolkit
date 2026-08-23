import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PcbSvgRenderer } from '../../src/extensions.mjs'

/**
 * Builds a minimal renderer model containing one pad in each copper group.
 * @returns {object}
 */
function buildGroupedPadBoard() {
    return {
        summary: { title: 'Grouped pad board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 32, name: 'Bottom Layer' }
            ],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [],
            vias: [],
            pads: [
                {
                    id: 'context-pad',
                    x: 250,
                    y: 250,
                    sizeTopX: 80,
                    sizeTopY: 40,
                    shapeTop: 2,
                    layerId: 1,
                    copperRenderGroup: 'subsurface'
                },
                {
                    id: 'active-pad',
                    x: 750,
                    y: 250,
                    sizeTopX: 80,
                    sizeTopY: 40,
                    shapeTop: 2,
                    layerId: 32,
                    copperRenderGroup: 'surface'
                }
            ],
            components: []
        }
    }
}

/**
 * Verifies opposite-side pads share the subsurface group opacity with their
 * connected traces instead of being faded independently in the surface group.
 */
test('PcbSvgRenderer places contextual pads in their copper render group', () => {
    const markup = PcbSvgRenderer.render(buildGroupedPadBoard())
    const subsurfaceStart = markup.indexOf(
        '<g class="pcb-copper pcb-copper--subsurface">'
    )
    const surfaceStart = markup.indexOf(
        '<g class="pcb-copper pcb-copper--surface">'
    )
    const footprintStart = markup.indexOf('<g class="pcb-footprints">')
    const subsurfaceMarkup = markup.slice(subsurfaceStart, surfaceStart)
    const surfaceMarkup = markup.slice(surfaceStart, footprintStart)

    assert.ok(subsurfaceStart >= 0)
    assert.ok(surfaceStart > subsurfaceStart)
    assert.ok(footprintStart > surfaceStart)
    assert.match(subsurfaceMarkup, /data-layer-id="1"/u)
    assert.doesNotMatch(subsurfaceMarkup, /data-layer-id="32"/u)
    assert.match(surfaceMarkup, /data-layer-id="32"/u)
    assert.doesNotMatch(surfaceMarkup, /data-layer-id="1"/u)
})

/**
 * Verifies grouping preserves pad order and keeps unknown values on surface.
 */
test('PcbSvgRenderer preserves grouped pad order and surface defaults', () => {
    const board = buildGroupedPadBoard()
    board.pcb.pads = [
        {
            ...board.pcb.pads[0],
            id: 'context-a',
            x: 100,
            holeDiameter: 20,
            holeShape: 2,
            holeSlotLength: 40
        },
        { ...board.pcb.pads[1], id: 'surface-a', x: 300 },
        { ...board.pcb.pads[0], id: 'context-b', x: 500 },
        {
            ...board.pcb.pads[1],
            id: 'surface-default',
            x: 700,
            copperRenderGroup: 'unknown'
        }
    ]

    const markup = PcbSvgRenderer.render(board)
    const subsurfaceStart = markup.indexOf(
        '<g class="pcb-copper pcb-copper--subsurface">'
    )
    const surfaceStart = markup.indexOf(
        '<g class="pcb-copper pcb-copper--surface">'
    )
    const footprintStart = markup.indexOf('<g class="pcb-footprints">')
    const subsurfaceMarkup = markup.slice(subsurfaceStart, surfaceStart)
    const surfaceMarkup = markup.slice(surfaceStart, footprintStart)
    const elementKeyPattern = /data-element-key="pcb-pad-(\d+)"/gu

    assert.deepEqual(
        [...subsurfaceMarkup.matchAll(elementKeyPattern)].map(
            (match) => match[1]
        ),
        ['0', '2']
    )
    assert.deepEqual(
        [...surfaceMarkup.matchAll(elementKeyPattern)].map((match) => match[1]),
        ['1', '3']
    )
    assert.equal(
        (subsurfaceMarkup.match(/<g\b/gu) || []).length,
        (subsurfaceMarkup.match(/<\/g>/gu) || []).length
    )
})

/**
 * Verifies dense grouped-pad rendering remains within a browser-sized heap.
 */
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

/**
 * Verifies subsurface SMD pads inherit the same copper token as traces in the
 * shared renderer stylesheet.
 */
test('renderer stylesheet colors contextual SMD pads like traces', async () => {
    const css = await readFile(
        new URL('../../src/styles/altium-renderers.css', import.meta.url),
        'utf8'
    )

    assert.match(
        css,
        /\.pcb-copper--subsurface \.pcb-pad--smd \.pcb-pad__ring\s*\{[\s\S]*?fill:\s*var\(--pcb-subsurface-track-color\);[\s\S]*?\}/u
    )
})
