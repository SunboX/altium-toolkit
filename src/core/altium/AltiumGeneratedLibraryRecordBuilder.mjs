// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds generated schematic and PCB primitive records for compact libraries.
 */
export class AltiumGeneratedLibraryRecordBuilder {
    /**
     * Builds a full schematic component record stream.
     * @param {object} bundle Normalized component bundle.
     * @returns {string}
     */
    static buildSchematicComponentData(bundle) {
        return [
            AltiumGeneratedLibraryRecordBuilder.#pipeRecord({
                RECORD: 'Component',
                Name: bundle.symbol.name,
                SourceId: bundle.id,
                DisplayName: bundle.name,
                PinCount: String(bundle.symbol.pins.length),
                PrimitiveCount: String(bundle.symbol.primitives.length)
            }),
            ...bundle.symbol.pins.map((pin) =>
                AltiumGeneratedLibraryRecordBuilder.#schematicPinRecord(pin)
            ),
            ...bundle.symbol.primitives.map((primitive) =>
                AltiumGeneratedLibraryRecordBuilder.#schematicPrimitiveRecord(
                    primitive
                )
            )
        ].join('')
    }

    /**
     * Counts generated footprint primitives.
     * @param {object} footprint Normalized footprint.
     * @returns {number}
     */
    static footprintPrimitiveCount(footprint) {
        return (
            AltiumGeneratedLibraryRecordBuilder.#array(footprint.pads).length +
            AltiumGeneratedLibraryRecordBuilder.#array(footprint.tracks)
                .length +
            AltiumGeneratedLibraryRecordBuilder.#array(footprint.arcs).length +
            AltiumGeneratedLibraryRecordBuilder.#array(footprint.fills).length +
            AltiumGeneratedLibraryRecordBuilder.#array(footprint.texts).length
        )
    }

    /**
     * Builds binary PcbLib footprint data after the leading name block.
     * @param {object} footprint Normalized footprint.
     * @returns {Uint8Array[]}
     */
    static buildFootprintPrimitiveRecords(footprint) {
        return [
            ...AltiumGeneratedLibraryRecordBuilder.#array(footprint.pads).map(
                (pad) => AltiumGeneratedLibraryRecordBuilder.#padRecord(pad)
            ),
            ...AltiumGeneratedLibraryRecordBuilder.#array(footprint.tracks).map(
                (track) =>
                    AltiumGeneratedLibraryRecordBuilder.#trackRecord(track)
            ),
            ...AltiumGeneratedLibraryRecordBuilder.#array(footprint.arcs).map(
                (arc) => AltiumGeneratedLibraryRecordBuilder.#arcRecord(arc)
            ),
            ...AltiumGeneratedLibraryRecordBuilder.#array(footprint.fills).map(
                (fill) => AltiumGeneratedLibraryRecordBuilder.#fillRecord(fill)
            ),
            ...AltiumGeneratedLibraryRecordBuilder.#array(footprint.texts).map(
                (text) => AltiumGeneratedLibraryRecordBuilder.#textRecord(text)
            )
        ]
    }

    /**
     * Builds one schematic pin record.
     * @param {object} pin Normalized pin.
     * @returns {string}
     */
    static #schematicPinRecord(pin) {
        return AltiumGeneratedLibraryRecordBuilder.#pipeRecord({
            RECORD: 'Pin',
            Designator:
                pin.number || pin.pinNumber || pin.designator || pin.name,
            Name: pin.name || pin.pinName || pin.designator,
            ElectricalType:
                AltiumGeneratedLibraryRecordBuilder.#schematicElectricalType(
                    pin
                ),
            'Location.X': AltiumGeneratedLibraryRecordBuilder.#numberText(
                pin.x,
                0
            ),
            'Location.Y': AltiumGeneratedLibraryRecordBuilder.#numberText(
                pin.y,
                0
            ),
            PinLength: AltiumGeneratedLibraryRecordBuilder.#numberText(
                pin.length,
                10
            )
        })
    }

    /**
     * Resolves one schematic pin electrical type label.
     * @param {object} pin Normalized pin.
     * @returns {string}
     */
    static #schematicElectricalType(pin) {
        if (typeof pin.electrical === 'string') return pin.electrical

        return (
            {
                0: 'input',
                1: 'io',
                2: 'output',
                3: 'open-collector',
                4: 'passive',
                5: 'hi-z',
                6: 'open-emitter',
                7: 'power'
            }[Number(pin.electrical)] || 'passive'
        )
    }

    /**
     * Builds one schematic primitive record.
     * @param {object} primitive Normalized primitive.
     * @returns {string}
     */
    static #schematicPrimitiveRecord(primitive) {
        const type =
            AltiumGeneratedLibraryRecordBuilder.#primitiveType(primitive)

        return AltiumGeneratedLibraryRecordBuilder.#pipeRecord({
            RECORD: type,
            'Location.X': AltiumGeneratedLibraryRecordBuilder.#numberText(
                primitive.x ?? primitive.x1,
                0
            ),
            'Location.Y': AltiumGeneratedLibraryRecordBuilder.#numberText(
                primitive.y ?? primitive.y1,
                0
            ),
            'Corner.X': AltiumGeneratedLibraryRecordBuilder.#numberText(
                primitive.cornerX ??
                    primitive.x2 ??
                    Number(primitive.x || 0) + Number(primitive.width || 0),
                0
            ),
            'Corner.Y': AltiumGeneratedLibraryRecordBuilder.#numberText(
                primitive.cornerY ??
                    primitive.y2 ??
                    Number(primitive.y || 0) + Number(primitive.height || 0),
                0
            )
        })
    }

    /**
     * Resolves a schematic primitive record type.
     * @param {object} primitive Normalized primitive.
     * @returns {string}
     */
    static #primitiveType(primitive) {
        const type = String(primitive.type || primitive.recordType || '')
            .trim()
            .toLowerCase()
        if (type === 'line' || ('x1' in primitive && 'x2' in primitive)) {
            return 'Line'
        }
        if (type === 'arc') return 'Arc'
        if (type === 'ellipse') return 'Ellipse'
        if (type === 'polygon') return 'Polygon'

        return 'Rectangle'
    }

    /**
     * Builds one pad primitive record.
     * @param {object} pad Normalized pad.
     * @returns {Uint8Array}
     */
    static #padRecord(pad) {
        const main = new Uint8Array(118)
        const view = new DataView(main.buffer)
        const width = AltiumGeneratedLibraryRecordBuilder.#number(
            pad.width ?? pad.sizeTopX ?? pad.sizeMidX ?? pad.sizeBottomX,
            1
        )
        const height = AltiumGeneratedLibraryRecordBuilder.#number(
            pad.height ?? pad.sizeTopY ?? pad.sizeMidY ?? pad.sizeBottomY,
            1
        )
        const layerId = AltiumGeneratedLibraryRecordBuilder.#layerId(pad, 1)
        const shape = AltiumGeneratedLibraryRecordBuilder.#padShape(pad)

        view.setUint8(0, layerId)
        view.setUint16(1, 8, true)
        AltiumGeneratedLibraryRecordBuilder.#writeOwnerIndexes(view, pad, {
            net: 3,
            polygon: 5,
            component: 7
        })
        view.setUint32(9, 0xffffffff, true)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 13, pad.x, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 17, pad.y, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 21, width, 1)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 25, height, 1)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 29, width, 1)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 33, height, 1)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 37, width, 1)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 41, height, 1)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(
            view,
            45,
            pad.holeDiameter,
            0
        )
        view.setUint8(49, shape)
        view.setUint8(50, shape)
        view.setUint8(51, shape)
        view.setFloat64(
            52,
            AltiumGeneratedLibraryRecordBuilder.#number(pad.rotation, 0),
            true
        )
        view.setUint8(60, pad.isPlated === false ? 0 : 1)
        view.setUint8(62, 0)
        view.setUint8(101, 1)
        view.setUint8(102, 1)

        return AltiumGeneratedLibraryRecordBuilder.#concatBytes([
            new Uint8Array([2]),
            ...[0, 1, 2, 3].map(() =>
                AltiumGeneratedLibraryRecordBuilder.#lengthPrefixed(
                    new Uint8Array()
                )
            ),
            AltiumGeneratedLibraryRecordBuilder.#lengthPrefixed(main),
            AltiumGeneratedLibraryRecordBuilder.#lengthPrefixed(
                new Uint8Array()
            )
        ])
    }

    /**
     * Builds one track primitive record.
     * @param {object} track Normalized track.
     * @returns {Uint8Array}
     */
    static #trackRecord(track) {
        const payload = new Uint8Array(49)
        const view = new DataView(payload.buffer)

        view.setUint8(0, AltiumGeneratedLibraryRecordBuilder.#layerId(track, 1))
        AltiumGeneratedLibraryRecordBuilder.#writeOwnerIndexes(view, track, {
            net: 3,
            polygon: 5,
            component: 7
        })
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 13, track.x1, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 17, track.y1, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 21, track.x2, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 25, track.y2, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 29, track.width, 1)

        return AltiumGeneratedLibraryRecordBuilder.#objectRecord(4, payload)
    }

    /**
     * Builds one arc primitive record.
     * @param {object} arc Normalized arc.
     * @returns {Uint8Array}
     */
    static #arcRecord(arc) {
        const payload = new Uint8Array(45)
        const view = new DataView(payload.buffer)

        view.setUint8(0, AltiumGeneratedLibraryRecordBuilder.#layerId(arc, 1))
        AltiumGeneratedLibraryRecordBuilder.#writeOwnerIndexes(view, arc, {
            net: 3,
            polygon: 5,
            component: 7
        })
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 13, arc.x, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 17, arc.y, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 21, arc.radius, 1)
        view.setFloat64(
            25,
            AltiumGeneratedLibraryRecordBuilder.#number(arc.startAngle, 0),
            true
        )
        view.setFloat64(
            33,
            AltiumGeneratedLibraryRecordBuilder.#number(arc.endAngle, 360),
            true
        )
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 41, arc.width, 1)

        return AltiumGeneratedLibraryRecordBuilder.#objectRecord(1, payload)
    }

    /**
     * Builds one fill primitive record.
     * @param {object} fill Normalized fill.
     * @returns {Uint8Array}
     */
    static #fillRecord(fill) {
        const bytes = new Uint8Array(55)
        const view = new DataView(bytes.buffer)
        const layerId = AltiumGeneratedLibraryRecordBuilder.#layerId(fill, 1)

        bytes[0] = 6
        view.setUint32(1, 50, true)
        view.setUint8(5, layerId)
        AltiumGeneratedLibraryRecordBuilder.#writeOwnerIndexes(view, fill, {
            net: 8,
            polygon: 10,
            component: 12
        })
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 18, fill.x1, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 22, fill.y1, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 26, fill.x2, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 30, fill.y2, 0)
        view.setUint16(46, layerId, true)

        return bytes
    }

    /**
     * Builds one PCB text primitive record.
     * @param {object} text Normalized text.
     * @returns {Uint8Array}
     */
    static #textRecord(text) {
        const payload = new Uint8Array(64)
        const view = new DataView(payload.buffer)
        const textBytes = new TextEncoder().encode(String(text.text || ''))

        view.setUint8(0, AltiumGeneratedLibraryRecordBuilder.#layerId(text, 21))
        view.setInt16(
            7,
            AltiumGeneratedLibraryRecordBuilder.#nullableIndex(
                text.ownerIndex ?? text.componentIndex
            ),
            true
        )
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 13, text.x, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 17, text.y, 0)
        AltiumGeneratedLibraryRecordBuilder.#writeMil(view, 21, text.height, 10)
        view.setUint32(25, 0, true)
        view.setUint32(41, 0, true)

        return AltiumGeneratedLibraryRecordBuilder.#concatBytes([
            AltiumGeneratedLibraryRecordBuilder.#objectRecord(5, payload),
            AltiumGeneratedLibraryRecordBuilder.#lengthPrefixed(textBytes)
        ])
    }

    /**
     * Creates one object-id and payload-length prefixed primitive record.
     * @param {number} objectId Primitive object id.
     * @param {Uint8Array} payload Payload bytes.
     * @returns {Uint8Array}
     */
    static #objectRecord(objectId, payload) {
        const bytes = new Uint8Array(5 + payload.byteLength)
        const view = new DataView(bytes.buffer)

        bytes[0] = Number(objectId)
        view.setUint32(1, payload.byteLength, true)
        bytes.set(payload, 5)

        return bytes
    }

    /**
     * Creates one four-byte length-prefixed byte block.
     * @param {Uint8Array} payload Payload bytes.
     * @returns {Uint8Array}
     */
    static #lengthPrefixed(payload) {
        const bytes = new Uint8Array(4 + payload.byteLength)
        const view = new DataView(bytes.buffer)

        view.setUint32(0, payload.byteLength, true)
        bytes.set(payload, 4)

        return bytes
    }

    /**
     * Writes owner indexes at the supplied offsets.
     * @param {DataView} view Target view.
     * @param {object} primitive Source primitive.
     * @param {{ component: number, net: number, polygon: number }} offsets Field offsets.
     * @returns {void}
     */
    static #writeOwnerIndexes(view, primitive, offsets) {
        view.setUint16(
            offsets.component,
            AltiumGeneratedLibraryRecordBuilder.#nullableIndex(
                primitive.componentIndex ?? primitive.ownerIndex
            ),
            true
        )
        view.setUint16(
            offsets.net,
            AltiumGeneratedLibraryRecordBuilder.#nullableIndex(
                primitive.netIndex
            ),
            true
        )
        view.setUint16(
            offsets.polygon,
            AltiumGeneratedLibraryRecordBuilder.#nullableIndex(
                primitive.polygonIndex
            ),
            true
        )
    }

    /**
     * Converts one optional index into Altium's nullable index encoding.
     * @param {unknown} value Source value.
     * @returns {number}
     */
    static #nullableIndex(value) {
        const number = Number(value)
        return Number.isInteger(number) && number >= 0 ? number : 0xffff
    }

    /**
     * Writes one mil value as Altium fixed-point integer.
     * @param {DataView} view Target view.
     * @param {number} offset Byte offset.
     * @param {unknown} value Source value.
     * @param {number} fallback Fallback value.
     * @returns {void}
     */
    static #writeMil(view, offset, value, fallback) {
        view.setInt32(
            offset,
            Math.round(
                AltiumGeneratedLibraryRecordBuilder.#number(value, fallback) *
                    10000
            ),
            true
        )
    }

    /**
     * Resolves one layer id.
     * @param {object} primitive Source primitive.
     * @param {number} fallback Fallback layer id.
     * @returns {number}
     */
    static #layerId(primitive, fallback) {
        return AltiumGeneratedLibraryRecordBuilder.#number(
            primitive.layerId ?? primitive.layerCode ?? primitive.legacyLayerId,
            fallback
        )
    }

    /**
     * Resolves one pad shape id.
     * @param {object} pad Source pad.
     * @returns {number}
     */
    static #padShape(pad) {
        const shape = String(
            pad.shapeTopName || pad.shape || pad.padShape || ''
        ).toLowerCase()
        if (shape.includes('round')) return 1
        if (shape.includes('oct')) return 3

        return Number(pad.shapeTop || pad.shapeMid || pad.shapeBottom || 2)
    }

    /**
     * Returns a finite number or fallback.
     * @param {unknown} value Source value.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #number(value, fallback) {
        const number = Number(value)
        return Number.isFinite(number) ? number : fallback
    }

    /**
     * Returns one numeric field as a compact string.
     * @param {unknown} value Source value.
     * @param {number} fallback Fallback value.
     * @returns {string}
     */
    static #numberText(value, fallback) {
        return String(
            AltiumGeneratedLibraryRecordBuilder.#number(value, fallback)
        )
    }

    /**
     * Builds one pipe-delimited record.
     * @param {Record<string, string>} fields Record fields.
     * @returns {string}
     */
    static #pipeRecord(fields) {
        return (
            '|' +
            Object.entries(fields)
                .filter(([, value]) => String(value ?? '') !== '')
                .map(([key, value]) => key + '=' + String(value))
                .join('|')
        )
    }

    /**
     * Concatenates byte chunks.
     * @param {Uint8Array[]} chunks Byte chunks.
     * @returns {Uint8Array}
     */
    static #concatBytes(chunks) {
        const byteLength = chunks.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0
        )
        const bytes = new Uint8Array(byteLength)
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes
    }

    /**
     * Normalizes an unknown value to an array.
     * @param {unknown} value Source value.
     * @returns {Array}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
