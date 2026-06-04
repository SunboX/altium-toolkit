// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPrimitiveRecordSlicer } from './PcbPrimitiveRecordSlicer.mjs'

/**
 * Provides a read-only PCB primitive record registry and raw record
 * preservation helpers.
 */
export class PcbRawRecordRegistry {
    static #PCB_DOC_DESCRIPTORS = Object.freeze(
        [
            {
                sourceStream: 'Arcs6/Data',
                headerStream: 'Arcs6/Header',
                family: 'arcs',
                collection: 'arcs',
                type: 'arc',
                typeId: 1,
                fixedRecordByteLength: 60,
                minimumPayloadByteLength: 45,
                lengthPrefixedView: 'payload',
                parser: 'PcbArcPrimitiveParser',
                strategy: 'slicer'
            },
            {
                sourceStream: 'Tracks6/Data',
                headerStream: 'Tracks6/Header',
                family: 'tracks',
                collection: 'tracks',
                type: 'track',
                typeId: 4,
                fixedRecordByteLength: 49,
                minimumPayloadByteLength: 33,
                lengthPrefixedView: 'payload',
                parser: 'PcbTrackPrimitiveParser',
                strategy: 'slicer'
            },
            {
                sourceStream: 'Vias6/Data',
                headerStream: 'Vias6/Header',
                family: 'vias',
                collection: 'vias',
                type: 'via',
                typeId: 3,
                fixedRecordByteLength: 326,
                minimumPayloadByteLength: 209,
                lengthPrefixedView: 'record',
                parser: 'PcbViaPrimitiveParser',
                strategy: 'slicer'
            },
            {
                sourceStream: 'Fills6/Data',
                headerStream: 'Fills6/Header',
                family: 'fills',
                collection: 'fills',
                type: 'fill',
                typeId: 6,
                fixedRecordByteLength: 55,
                minimumPayloadByteLength: 50,
                lengthPrefixedView: 'record',
                parser: 'PcbFillPrimitiveParser',
                strategy: 'slicer'
            },
            {
                sourceStream: 'Pads6/Data',
                headerStream: 'Pads6/Header',
                family: 'pads',
                collection: 'pads',
                type: 'pad',
                typeId: 2,
                minimumSubrecordCount: 6,
                validatedSubrecordIndex: 4,
                minimumPayloadByteLength: 61,
                parser: 'PcbPadPrimitiveParser',
                strategy: 'subrecord-list'
            },
            {
                sourceStream: 'Texts6/Data',
                headerStream: 'Texts6/Header',
                family: 'texts',
                collection: 'texts',
                type: 'text',
                typeId: 5,
                minimumPayloadByteLength: 64,
                maximumPayloadByteLength: 2048,
                parser: 'PcbTextPrimitiveParser',
                strategy: 'text-tail'
            },
            {
                sourceStream: 'Texts/Data',
                headerStream: 'Texts/Header',
                family: 'texts',
                collection: 'texts',
                type: 'text',
                typeId: 5,
                minimumPayloadByteLength: 64,
                maximumPayloadByteLength: 2048,
                parser: 'PcbTextPrimitiveParser',
                strategy: 'text-tail'
            },
            {
                sourceStream: 'Regions6/Data',
                headerStream: 'Regions6/Header',
                family: 'regions',
                collection: 'regions',
                type: 'region',
                typeId: 11,
                minimumPayloadByteLength: 18,
                parser: 'PcbRegionPrimitiveParser',
                strategy: 'length-prefixed'
            },
            {
                sourceStream: 'ShapeBasedRegions6/Data',
                headerStream: 'ShapeBasedRegions6/Header',
                family: 'shapeBasedRegions',
                collection: 'shapeBasedRegions',
                type: 'region',
                typeId: 11,
                minimumPayloadByteLength: 18,
                parser: 'PcbRegionPrimitiveParser',
                strategy: 'length-prefixed'
            },
            {
                sourceStream: 'BoardRegions/Data',
                headerStream: 'BoardRegions/Header',
                family: 'boardRegions',
                collection: 'boardRegions',
                type: 'region',
                typeId: 11,
                minimumPayloadByteLength: 18,
                parser: 'PcbRegionPrimitiveParser',
                strategy: 'length-prefixed'
            }
        ].map((descriptor) => Object.freeze(descriptor))
    )

    /**
     * Returns immutable copies of the registered PcbDoc primitive descriptors.
     * @returns {object[]}
     */
    static pcbDocDescriptors() {
        return PcbRawRecordRegistry.#PCB_DOC_DESCRIPTORS.map((descriptor) =>
            Object.freeze({ ...descriptor })
        )
    }

    /**
     * Returns the descriptor registered for one PcbDoc data stream.
     * @param {string} sourceStream
     * @returns {object | null}
     */
    static descriptorForPcbDocStream(sourceStream) {
        const descriptor = PcbRawRecordRegistry.#PCB_DOC_DESCRIPTORS.find(
            (candidate) => candidate.sourceStream === sourceStream
        )

        return descriptor ? Object.freeze({ ...descriptor }) : null
    }

    /**
     * Collects raw records from registered PcbDoc primitive streams.
     * @param {Map<string, Uint8Array>} streams
     * @param {Record<string, object[]>} [binaryPrimitives]
     * @returns {object[]}
     */
    static collectPcbDocRecords(streams, binaryPrimitives = {}) {
        const rawRecords = []

        for (const descriptor of PcbRawRecordRegistry.#PCB_DOC_DESCRIPTORS) {
            const headerBytes = streams.get(descriptor.headerStream)
            const dataBytes = streams.get(descriptor.sourceStream)

            if (!headerBytes || !dataBytes) {
                continue
            }

            const slices = PcbRawRecordRegistry.#slicePcbDocRecords(
                descriptor,
                headerBytes,
                dataBytes
            )
            const parsedCount =
                binaryPrimitives?.[descriptor.collection]?.length || 0

            if (!slices.length) {
                if (
                    PcbRawRecordRegistry.#readRecordCount(headerBytes) > 0 &&
                    PcbRawRecordRegistry.#toUint8Array(dataBytes).byteLength > 0
                ) {
                    rawRecords.push(
                        PcbRawRecordRegistry.#createUnparsedPcbDocRecord(
                            descriptor,
                            dataBytes
                        )
                    )
                }
                continue
            }

            for (const slice of slices) {
                rawRecords.push(
                    PcbRawRecordRegistry.#normalizePcbDocRecord(
                        descriptor,
                        slice,
                        parsedCount
                    )
                )
            }
        }

        return rawRecords
    }

    /**
     * Creates one raw PcbLib footprint record descriptor.
     * @param {{ sourceStorage: string, record: { typeId: number, descriptor: object | null, recordBytes: Uint8Array, offset: number, byteLength: number }, recordIndex: number, parsed: boolean }} options
     * @returns {object}
     */
    static createPcbLibRecord(options) {
        const descriptor = options.record.descriptor
        const sourceStream = options.sourceStorage + '/Data'

        return {
            registryId: 'pcblib:' + sourceStream + ':' + options.recordIndex,
            source: 'pcblib',
            sourceStorage: options.sourceStorage,
            sourceStream,
            family: descriptor?.collection || 'unknown',
            type: descriptor?.type || 'unknown',
            typeId: options.record.typeId,
            recordIndex: options.recordIndex,
            offset: options.record.offset,
            byteLength: options.record.byteLength,
            payloadByteLength: null,
            encoding: 'mixed-footprint',
            supported: Boolean(descriptor),
            parsed: Boolean(options.parsed),
            rawBase64: PcbRawRecordRegistry.#toBase64(
                options.record.recordBytes
            )
        }
    }

    /**
     * Selects the slicing strategy for one registered PcbDoc stream.
     * @param {object} descriptor
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {object[]}
     */
    static #slicePcbDocRecords(descriptor, headerBytes, dataBytes) {
        if (descriptor.strategy === 'slicer') {
            return PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
                headerBytes,
                dataBytes,
                objectId: descriptor.typeId,
                fixedRecordByteLength: descriptor.fixedRecordByteLength,
                minimumPayloadByteLength: descriptor.minimumPayloadByteLength,
                lengthPrefixedView: descriptor.lengthPrefixedView
            })
        }

        if (descriptor.strategy === 'subrecord-list') {
            return PcbRawRecordRegistry.#sliceSubrecordListRecords(
                descriptor,
                headerBytes,
                dataBytes
            )
        }

        if (descriptor.strategy === 'text-tail') {
            return PcbRawRecordRegistry.#sliceTextTailRecords(
                descriptor,
                headerBytes,
                dataBytes
            )
        }

        return PcbRawRecordRegistry.#sliceLengthPrefixedRecords(
            descriptor,
            headerBytes,
            dataBytes
        )
    }

    /**
     * Slices exact object-id/payload-length records.
     * @param {object} descriptor
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {object[]}
     */
    static #sliceLengthPrefixedRecords(descriptor, headerBytes, dataBytes) {
        const count = PcbRawRecordRegistry.#readRecordCount(headerBytes)
        const bytes = PcbRawRecordRegistry.#toUint8Array(dataBytes)
        const records = []
        let offset = 0

        for (let index = 0; index < count; index += 1) {
            const record = PcbRawRecordRegistry.#readLengthPrefixedRecordAt(
                bytes,
                offset,
                descriptor
            )

            if (!record) {
                return []
            }

            records.push({ ...record, recordIndex: index })
            offset += record.byteLength
        }

        return offset === bytes.byteLength ? records : []
    }

    /**
     * Reads one object-id/payload-length record at an offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @returns {object | null}
     */
    static #readLengthPrefixedRecordAt(bytes, offset, descriptor) {
        if (
            offset + 5 > bytes.byteLength ||
            bytes[offset] !== descriptor.typeId
        ) {
            return null
        }

        const payloadByteLength = PcbRawRecordRegistry.#readUint32(
            bytes,
            offset + 1
        )
        const byteLength = 5 + payloadByteLength

        if (
            payloadByteLength < descriptor.minimumPayloadByteLength ||
            offset + byteLength > bytes.byteLength
        ) {
            return null
        }

        return {
            recordBytes: bytes.slice(offset, offset + byteLength),
            offset,
            byteLength,
            payloadByteLength,
            encoding: 'length-prefixed',
            objectId: descriptor.typeId,
            recordIndex: 0
        }
    }

    /**
     * Slices subrecord-list primitives such as PcbDoc pads.
     * @param {object} descriptor
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {object[]}
     */
    static #sliceSubrecordListRecords(descriptor, headerBytes, dataBytes) {
        const count = PcbRawRecordRegistry.#readRecordCount(headerBytes)
        const bytes = PcbRawRecordRegistry.#toUint8Array(dataBytes)
        const boundaries = PcbRawRecordRegistry.#findSubrecordListBoundaries(
            bytes,
            0,
            descriptor,
            count
        )

        if (!boundaries) {
            return []
        }

        return boundaries.map((boundary, index) => {
            const endOffset = boundaries[index + 1]?.offset ?? bytes.byteLength

            return {
                recordBytes: bytes.slice(boundary.offset, endOffset),
                offset: boundary.offset,
                byteLength: endOffset - boundary.offset,
                payloadByteLength: null,
                encoding: 'subrecord-list',
                objectId: descriptor.typeId,
                recordIndex: index
            }
        })
    }

    /**
     * Finds all subrecord-list record boundaries without recursive validation.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @param {number} count
     * @returns {{ offset: number, minimumEnd: number }[] | null}
     */
    static #findSubrecordListBoundaries(bytes, offset, descriptor, count) {
        if (!count) {
            return []
        }

        const firstMinimumEnd =
            PcbRawRecordRegistry.#readMinimumSubrecordListEnd(
                bytes,
                offset,
                descriptor
            )

        if (!firstMinimumEnd) {
            return null
        }

        const boundaries = [{ offset, minimumEnd: firstMinimumEnd }]
        const alternativeScanOffsets = [null]
        let depth = 1
        let scanOffset = firstMinimumEnd

        while (depth < count) {
            const candidate =
                PcbRawRecordRegistry.#findNextSubrecordListCandidate(
                    bytes,
                    scanOffset,
                    descriptor
                )

            if (!candidate) {
                let foundAlternative = false

                while (depth > 1 && !foundAlternative) {
                    depth -= 1
                    boundaries.length = depth

                    const alternativeOffset = alternativeScanOffsets[depth]
                    alternativeScanOffsets.length = depth

                    if (alternativeOffset !== null) {
                        scanOffset = alternativeOffset
                        foundAlternative = true
                    }
                }

                if (!foundAlternative) {
                    return null
                }

                continue
            }

            boundaries[depth] = {
                offset: candidate.offset,
                minimumEnd: candidate.minimumEnd
            }
            alternativeScanOffsets[depth] = candidate.alternativeOffset
            depth += 1
            scanOffset = candidate.minimumEnd
        }

        return boundaries
    }

    /**
     * Finds the next plausible subrecord-list record boundary.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @returns {{ offset: number, minimumEnd: number, alternativeOffset: number | null } | null}
     */
    static #findNextSubrecordListCandidate(bytes, offset, descriptor) {
        let cursor = offset

        while (cursor < bytes.byteLength) {
            const minimumEnd =
                PcbRawRecordRegistry.#readMinimumSubrecordListEnd(
                    bytes,
                    cursor,
                    descriptor
                )
            const unknownSubrecord = PcbRawRecordRegistry.#readSubrecordAt(
                bytes,
                cursor
            )

            if (minimumEnd) {
                const alternativeOffset =
                    unknownSubrecord?.nextOffset ?? cursor + 1

                return {
                    offset: cursor,
                    minimumEnd,
                    alternativeOffset:
                        alternativeOffset < bytes.byteLength
                            ? alternativeOffset
                            : null
                }
            }

            if (!unknownSubrecord) {
                cursor += 1
                continue
            }

            cursor = unknownSubrecord.nextOffset
        }

        return null
    }

    /**
     * Reads the minimum byte boundary for one subrecord-list record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @returns {number | null}
     */
    static #readMinimumSubrecordListEnd(bytes, offset, descriptor) {
        let cursor = offset + 1

        for (
            let subrecordIndex = 0;
            subrecordIndex < descriptor.minimumSubrecordCount;
            subrecordIndex += 1
        ) {
            const subrecord = PcbRawRecordRegistry.#readSubrecordAt(
                bytes,
                cursor
            )

            if (!subrecord) {
                return null
            }

            const shouldValidate =
                descriptor.validatedSubrecordIndex === undefined ||
                descriptor.validatedSubrecordIndex === subrecordIndex
            if (
                shouldValidate &&
                subrecord.payloadByteLength <
                    descriptor.minimumPayloadByteLength
            ) {
                return null
            }

            cursor = subrecord.nextOffset
        }

        return cursor
    }

    /**
     * Slices PCB text records including their variable string tails.
     * @param {object} descriptor
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {object[]}
     */
    static #sliceTextTailRecords(descriptor, headerBytes, dataBytes) {
        const count = PcbRawRecordRegistry.#readRecordCount(headerBytes)
        const bytes = PcbRawRecordRegistry.#toUint8Array(dataBytes)
        const records = []
        let offset = 0

        for (let index = 0; index < count; index += 1) {
            const record = PcbRawRecordRegistry.#readTextTailRecordAt(
                bytes,
                offset,
                descriptor,
                index === count - 1
            )

            if (!record) {
                return []
            }

            records.push({ ...record, recordIndex: index })
            offset += record.byteLength
        }

        return records
    }

    /**
     * Reads one PCB text-tail record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @param {boolean} isLastRecord
     * @returns {object | null}
     */
    static #readTextTailRecordAt(bytes, offset, descriptor, isLastRecord) {
        if (
            !PcbRawRecordRegistry.#isTextTailRecordStart(
                bytes,
                offset,
                descriptor
            )
        ) {
            return null
        }

        const payloadByteLength = PcbRawRecordRegistry.#readUint32(
            bytes,
            offset + 1
        )
        const payloadEnd = offset + 5 + payloadByteLength
        const nextOffset = isLastRecord
            ? bytes.byteLength
            : PcbRawRecordRegistry.#findNextTextTailRecordOffset(
                  bytes,
                  payloadEnd,
                  descriptor
              )

        if (!nextOffset) {
            return null
        }

        return {
            recordBytes: bytes.slice(offset, nextOffset),
            offset,
            byteLength: nextOffset - offset,
            payloadByteLength,
            encoding: 'text-tail',
            objectId: descriptor.typeId,
            recordIndex: 0
        }
    }

    /**
     * Finds the next plausible PCB text-tail record start.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @returns {number | null}
     */
    static #findNextTextTailRecordOffset(bytes, offset, descriptor) {
        for (let cursor = offset; cursor < bytes.byteLength - 5; cursor += 1) {
            if (
                PcbRawRecordRegistry.#isTextTailRecordStart(
                    bytes,
                    cursor,
                    descriptor
                )
            ) {
                return cursor
            }
        }

        return null
    }

    /**
     * Returns true when an offset looks like a PCB text-tail record start.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {object} descriptor
     * @returns {boolean}
     */
    static #isTextTailRecordStart(bytes, offset, descriptor) {
        if (
            offset + 5 > bytes.byteLength ||
            bytes[offset] !== descriptor.typeId
        ) {
            return false
        }

        const payloadByteLength = PcbRawRecordRegistry.#readUint32(
            bytes,
            offset + 1
        )
        const payloadEnd = offset + 5 + payloadByteLength

        return (
            payloadByteLength >= descriptor.minimumPayloadByteLength &&
            payloadByteLength <= descriptor.maximumPayloadByteLength &&
            payloadEnd <= bytes.byteLength
        )
    }

    /**
     * Reads one length-prefixed subrecord.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ payloadByteLength: number, nextOffset: number } | null}
     */
    static #readSubrecordAt(bytes, offset) {
        if (offset + 4 > bytes.byteLength) {
            return null
        }

        const payloadByteLength = PcbRawRecordRegistry.#readUint32(
            bytes,
            offset
        )
        const nextOffset = offset + 4 + payloadByteLength

        if (nextOffset > bytes.byteLength) {
            return null
        }

        return { payloadByteLength, nextOffset }
    }

    /**
     * Creates one normalized PcbDoc raw record.
     * @param {object} descriptor
     * @param {object} slice
     * @param {number} parsedCount
     * @returns {object}
     */
    static #normalizePcbDocRecord(descriptor, slice, parsedCount) {
        return {
            registryId:
                'pcbdoc:' + descriptor.sourceStream + ':' + slice.recordIndex,
            source: 'pcbdoc',
            sourceStream: descriptor.sourceStream,
            headerStream: descriptor.headerStream,
            family: descriptor.family,
            type: descriptor.type,
            typeId: descriptor.typeId,
            recordIndex: slice.recordIndex,
            offset: slice.offset,
            byteLength: slice.byteLength,
            payloadByteLength: slice.payloadByteLength,
            encoding: slice.encoding,
            supported: true,
            parsed: slice.recordIndex < parsedCount,
            rawBase64: PcbRawRecordRegistry.#toBase64(slice.recordBytes)
        }
    }

    /**
     * Creates one fallback raw record for a registered but unparsed stream.
     * @param {object} descriptor
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {object}
     */
    static #createUnparsedPcbDocRecord(descriptor, dataBytes) {
        const bytes = PcbRawRecordRegistry.#toUint8Array(dataBytes)

        return {
            registryId: 'pcbdoc:' + descriptor.sourceStream + ':0',
            source: 'pcbdoc',
            sourceStream: descriptor.sourceStream,
            headerStream: descriptor.headerStream,
            family: descriptor.family,
            type: descriptor.type,
            typeId: descriptor.typeId,
            recordIndex: 0,
            offset: 0,
            byteLength: bytes.byteLength,
            payloadByteLength: null,
            encoding: 'unparsed-stream',
            supported: true,
            parsed: false,
            rawBase64: PcbRawRecordRegistry.#toBase64(bytes)
        }
    }

    /**
     * Reads one little-endian record count.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @returns {number}
     */
    static #readRecordCount(headerBytes) {
        const bytes = PcbRawRecordRegistry.#toUint8Array(headerBytes)

        if (bytes.byteLength < 4) {
            return 0
        }

        return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(
            0,
            true
        )
    }

    /**
     * Reads one little-endian unsigned 32-bit value.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32(bytes, offset) {
        return new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            4
        ).getUint32(0, true)
    }

    /**
     * Normalizes one byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    }

    /**
     * Encodes raw bytes as base64 without assuming a Node-only runtime.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #toBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64')
        }

        let binary = ''
        for (const byte of bytes) {
            binary += String.fromCharCode(byte)
        }

        return btoa(binary)
    }
}
