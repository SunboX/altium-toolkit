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
                    {
                        type: 'line',
                        x1: 2000,
                        y1: 0,
                        x2: 2000,
                        y2: 1000
                    },
                    {
                        type: 'line',
                        x1: 2000,
                        y1: 1000,
                        x2: 0,
                        y2: 1000
                    },
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
console.log(
    JSON.stringify({ markupLength: markup.length, padCount: padKeys.length })
)
