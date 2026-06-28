import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a scene with an off-origin mixed-pad connector body.
 * @returns {object}
 */
function createConnectorScene() {
    return {
        sourceFormat: 'altium',
        board: {
            centerX: 500,
            centerY: 250,
            thicknessMil: 63
        },
        components: [
            {
                designator: 'J1',
                mountSide: 'top',
                positionMil: { x: 0, y: 0, z: 50 },
                boardPositionMil: { x: 500, y: 250, z: 50 }
            }
        ],
        externalPlacements: [
            {
                designator: 'J1',
                mountSide: 'top',
                rotationDeg: 90,
                positionMil: { x: -350, y: 0, z: 31.5 },
                bodyPositionMil: { x: 150, y: 250 },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    dzMil: -60
                },
                projection: {
                    source: 'model-bounds',
                    boundsMil: { width: 460, depth: 1300, height: 1800 }
                },
                externalModel: {
                    origin: 'embedded',
                    name: 'fake-usb-a-body.step',
                    format: 'step'
                }
            }
        ]
    }
}

/**
 * Builds a source PCB document with signal pads plus large mechanical locks.
 * @returns {object}
 */
function createConnectorDocument() {
    return {
        pcb: {
            components: [
                {
                    componentIndex: 7,
                    designator: 'J1',
                    x: 500,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'FAKE_USB_A_CONNECTOR',
                    source: 'FAKE_USB_CONNECTOR_SOURCE',
                    rotation: 270,
                    parameters: {
                        'Connector Type': 'USB - A',
                        Features: 'Board Guide, Board Lock'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_USB_A_CONNECTOR',
                    name: 'fake-usb-a-body.step',
                    positionMil: { x: 150, y: 250 },
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    overallHeightMil: 80
                }
            ],
            pads: [
                ...createSignalPads(),
                createMechanicalLockPad(452, 22),
                createMechanicalLockPad(452, -22),
                createSlottedMechanicalPad(452, 228),
                createSlottedMechanicalPad(452, -228)
            ]
        }
    }
}

/**
 * Builds one row of signal pads for a right-angle connector.
 * @returns {object[]}
 */
function createSignalPads() {
    return [-160, -120, -80, -40, 0, 40, 80, 120, 160].map((yOffset) => ({
        componentIndex: 7,
        x: 548,
        y: 250 + yOffset,
        sizeTopX: 28,
        sizeTopY: 72,
        sizeMidX: 28,
        sizeMidY: 72,
        hasTopPasteMaskOpening: true
    }))
}

/**
 * Builds one round through-hole connector lock pad.
 * @param {number} x Pad X.
 * @param {number} yOffset Pad Y offset from the connector center.
 * @returns {object}
 */
function createMechanicalLockPad(x, yOffset) {
    return {
        componentIndex: 7,
        x,
        y: 250 + yOffset,
        sizeTopX: 44,
        sizeTopY: 44,
        sizeMidX: 44,
        sizeMidY: 44,
        holeDiameter: 44,
        layerCode: 74,
        hasTopPasteMaskOpening: false
    }
}

/**
 * Builds one slotted through-hole connector lock pad.
 * @param {number} x Pad X.
 * @param {number} yOffset Pad Y offset from the connector center.
 * @returns {object}
 */
function createSlottedMechanicalPad(x, yOffset) {
    return {
        componentIndex: 7,
        x,
        y: 250 + yOffset,
        sizeTopX: 64,
        sizeTopY: 158,
        sizeMidX: 64,
        sizeMidY: 158,
        holeDiameter: 40,
        holeShape: 2,
        holeSlotLength: 98,
        layerCode: 74,
        hasTopPasteMaskOpening: false
    }
}

test('AltiumScene3dExternalPlacementAdapter uses footprint yaw for mixed-pad off-origin connectors', () => {
    const scene = AltiumScene3dExternalPlacementAdapter.apply(
        createConnectorScene(),
        createConnectorDocument()
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].rotationDeg, 270)
    assert.deepEqual(
        scene.externalPlacements[0].modelTransform.ownerAnchorOffsetMil,
        {
            x: -350,
            y: 0
        }
    )
    assert.deepEqual(scene.externalPlacements[0].modelTransform.offsetMil, {
        x: 0,
        y: -350,
        z: -60
    })
    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, -60)
})
