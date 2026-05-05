import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateSync } from 'node:zlib'
import { PcbEmbeddedModelExtractor } from '../../src/core/altium/PcbEmbeddedModelExtractor.mjs'

/**
 * Builds synthetic embedded-model streams for PCB extractor tests.
 */
class PcbEmbeddedModelTestFactory {
    /**
     * Creates one synthetic stream map with one embedded STEP model and one
     * component-body placement.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMap() {
        const streams = new Map()
        const stepText = [
            'ISO-10303-21;',
            'HEADER;',
            "FILE_DESCRIPTION(('STEP AP214'),'1');",
            'ENDSEC;',
            'DATA;',
            'ENDSEC;',
            'END-ISO-10303-21;'
        ].join('\n')

        streams.set(
            'Models/Data',
            PcbEmbeddedModelTestFactory.#createLengthPrefixedTextStream([
                'EMBED=TRUE|MODELSOURCE=Undefined|ID={7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}|ROTX=0.000|ROTY=0.000|ROTZ=270.000|DZ=118110|CHECKSUM=-827837266|NAME=SOT-23_Y.stp'
            ])
        )
        streams.set(
            'Models/0',
            Uint8Array.from(deflateSync(new TextEncoder().encode(stepText)))
        )
        streams.set(
            'ComponentBodies6/Data',
            new TextEncoder().encode(
                [
                    'V7_LAYER=MECHANICAL1',
                    'NAME=',
                    'KIND=0',
                    'SUBPOLYINDEX=-1',
                    'UNIONINDEX=0',
                    'ISSHAPEBASED=FALSE',
                    'STANDOFFHEIGHT=-0.0684mil',
                    'OVERALLHEIGHT=39.3701mil',
                    'IDENTIFIER=83,79,84,45,50,51,95,89',
                    'MODELID={7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
                    'MODEL.CHECKSUM=3467130030',
                    'MODEL.EMBED=TRUE',
                    'MODEL.NAME=SOT-23_Y.stp',
                    'MODEL.2D.X=250mil',
                    'MODEL.2D.Y=300mil',
                    'MODEL.2D.ROTATION=45.000',
                    'MODEL.3D.ROTX=0.000',
                    'MODEL.3D.ROTY=0.000',
                    'MODEL.3D.ROTZ=270.000',
                    'MODEL.3D.DZ=11.811mil',
                    'MODEL.MODELTYPE=1',
                    'MODEL.MODELSOURCE=Undefined'
                ].join('|')
            )
        )

        return streams
    }

    /**
     * Encodes one little-endian length-prefixed text stream.
     * @param {string[]} records
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedTextStream(records) {
        const encodedRecords = records.map((record) =>
            new TextEncoder().encode(record + '\u0000')
        )
        const totalLength = encodedRecords.reduce(
            (sum, bytes) => sum + 4 + bytes.byteLength,
            0
        )
        const output = new Uint8Array(totalLength)
        const view = new DataView(output.buffer)
        let offset = 0

        for (const bytes of encodedRecords) {
            view.setUint32(offset, bytes.byteLength, true)
            offset += 4
            output.set(bytes, offset)
            offset += bytes.byteLength
        }

        return output
    }
}

/**
 * Verifies embedded STEP payloads and component-body transforms are recovered
 * from OLE PCB model streams.
 */
test('PcbEmbeddedModelExtractor extracts embedded STEP payloads and body placements', () => {
    const extracted = PcbEmbeddedModelExtractor.extractFromStreams(
        PcbEmbeddedModelTestFactory.createStreamMap()
    )

    assert.deepEqual(extracted.models, [
        {
            id: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
            checksum: 3467130030,
            name: 'SOT-23_Y.stp',
            format: 'step',
            payloadText: [
                'ISO-10303-21;',
                'HEADER;',
                "FILE_DESCRIPTION(('STEP AP214'),'1');",
                'ENDSEC;',
                'DATA;',
                'ENDSEC;',
                'END-ISO-10303-21;'
            ].join('\n'),
            sourceStream: 'Models/0',
            transform: {
                rotationDeg: { x: 0, y: 0, z: 270 },
                dzMil: 11.811
            }
        }
    ])
    assert.deepEqual(extracted.componentBodies, [
        {
            sourceStream: 'ComponentBodies6/Data',
            layer: 'MECHANICAL1',
            identifier: 'SOT-23_Y',
            modelId: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
            checksum: 3467130030,
            embedded: true,
            name: 'SOT-23_Y.stp',
            positionMil: { x: 250, y: 300 },
            rotationDeg: 45,
            modelRotationDeg: { x: 0, y: 0, z: 270 },
            dzMil: 11.811,
            overallHeightMil: 39.3701,
            standoffHeightMil: -0.0684
        }
    ])
})
