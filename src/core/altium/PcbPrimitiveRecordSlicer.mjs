// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Splits mixed-format PCB primitive streams.
 */
export class PcbPrimitiveRecordSlicer {
    /**
     * Splits a primitive stream, preferring object-id/length-prefixed records
     * and falling back to legacy fixed-layout records.
     * @param {{ headerBytes: Uint8Array | ArrayBuffer, dataBytes: Uint8Array | ArrayBuffer, objectId: number, fixedRecordByteLength: number, minimumPayloadByteLength: number, lengthPrefixedView?: 'payload' | 'record' }} options
     * @returns {{ view: DataView, viewBytes: Uint8Array, recordBytes: Uint8Array, offset: number, byteLength: number, payloadByteLength: number | null, encoding: 'length-prefixed' | 'fixed', objectId: number | null, recordIndex: number }[]}
     */
    static slicePrimitiveRecords(options) {
        const lengthPrefixedRecords =
            PcbPrimitiveRecordSlicer.#sliceLengthPrefixedRecords(options)

        if (lengthPrefixedRecords.length) {
            return lengthPrefixedRecords
        }

        return PcbPrimitiveRecordSlicer.#sliceFixedRecords(
            options.headerBytes,
            options.dataBytes,
            options.fixedRecordByteLength
        )
    }

    /**
     * Splits object-id/length-prefixed records when the full stream matches
     * the expected object id, count, payload lengths, and byte length exactly.
     * @param {{ headerBytes: Uint8Array | ArrayBuffer, dataBytes: Uint8Array | ArrayBuffer, objectId: number, minimumPayloadByteLength: number, lengthPrefixedView?: 'payload' | 'record' }} options
     * @returns {{ view: DataView, viewBytes: Uint8Array, recordBytes: Uint8Array, offset: number, byteLength: number, payloadByteLength: number | null, encoding: 'length-prefixed' | 'fixed', objectId: number | null, recordIndex: number }[]}
     */
    static #sliceLengthPrefixedRecords(options) {
        const normalizedData = PcbPrimitiveRecordSlicer.#toUint8Array(
            options.dataBytes
        )
        const count = PcbPrimitiveRecordSlicer.#readRecordCount(
            options.headerBytes
        )

        if (!count) {
            return []
        }

        let offset = 0
        const records = []

        for (let index = 0; index < count; index += 1) {
            const record = PcbPrimitiveRecordSlicer.#readLengthPrefixedRecordAt(
                normalizedData,
                offset,
                options
            )

            if (!record) {
                return []
            }

            records.push({ ...record, recordIndex: index })
            offset += record.byteLength
        }

        return offset === normalizedData.byteLength ? records : []
    }

    /**
     * Reads one length-prefixed record at a byte offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {{ objectId: number, minimumPayloadByteLength: number, lengthPrefixedView?: 'payload' | 'record' }} options
     * @returns {{ view: DataView, viewBytes: Uint8Array, recordBytes: Uint8Array, offset: number, byteLength: number, payloadByteLength: number | null, encoding: 'length-prefixed', objectId: number, recordIndex: number } | null}
     */
    static #readLengthPrefixedRecordAt(bytes, offset, options) {
        if (
            offset + 5 > bytes.byteLength ||
            bytes[offset] !== options.objectId
        ) {
            return null
        }

        const payloadLength = PcbPrimitiveRecordSlicer.#readUint32FromBytes(
            bytes,
            offset + 1
        )
        const byteLength = 5 + payloadLength

        if (
            payloadLength < options.minimumPayloadByteLength ||
            offset + byteLength > bytes.byteLength
        ) {
            return null
        }

        const viewOffset =
            options.lengthPrefixedView === 'record' ? offset : offset + 5
        const viewByteLength =
            options.lengthPrefixedView === 'record' ? byteLength : payloadLength

        return PcbPrimitiveRecordSlicer.#createRecord(
            bytes,
            offset,
            viewOffset,
            viewByteLength,
            byteLength,
            {
                encoding: 'length-prefixed',
                objectId: options.objectId,
                payloadByteLength: payloadLength
            }
        )
    }

    /**
     * Splits one legacy fixed-layout primitive stream into record views.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {number} recordByteLength
     * @returns {{ view: DataView, viewBytes: Uint8Array, recordBytes: Uint8Array, offset: number, byteLength: number, payloadByteLength: number | null, encoding: 'fixed', objectId: null, recordIndex: number }[]}
     */
    static #sliceFixedRecords(headerBytes, dataBytes, recordByteLength) {
        const normalizedData = PcbPrimitiveRecordSlicer.#toUint8Array(dataBytes)
        const count = PcbPrimitiveRecordSlicer.#readRecordCount(headerBytes)

        if (!count) {
            return []
        }

        if (normalizedData.byteLength < count * recordByteLength) {
            return []
        }

        const records = []

        for (let index = 0; index < count; index += 1) {
            records.push(
                PcbPrimitiveRecordSlicer.#createRecord(
                    normalizedData,
                    index * recordByteLength,
                    index * recordByteLength,
                    recordByteLength,
                    recordByteLength,
                    {
                        encoding: 'fixed',
                        objectId: null,
                        payloadByteLength: null,
                        recordIndex: index
                    }
                )
            )
        }

        return records
    }

    /**
     * Creates one record view tuple over a source byte array.
     * @param {Uint8Array} bytes
     * @param {number} recordOffset
     * @param {number} viewOffset
     * @param {number} viewByteLength
     * @param {number} byteLength
     * @param {{ encoding: 'length-prefixed' | 'fixed', objectId: number | null, payloadByteLength: number | null, recordIndex?: number }} metadata
     * @returns {{ view: DataView, viewBytes: Uint8Array, recordBytes: Uint8Array, offset: number, byteLength: number, payloadByteLength: number | null, encoding: 'length-prefixed' | 'fixed', objectId: number | null, recordIndex: number }}
     */
    static #createRecord(
        bytes,
        recordOffset,
        viewOffset,
        viewByteLength,
        byteLength,
        metadata
    ) {
        return {
            view: new DataView(
                bytes.buffer,
                bytes.byteOffset + viewOffset,
                viewByteLength
            ),
            viewBytes: new Uint8Array(
                bytes.buffer,
                bytes.byteOffset + viewOffset,
                viewByteLength
            ),
            recordBytes: new Uint8Array(
                bytes.buffer,
                bytes.byteOffset + recordOffset,
                byteLength
            ),
            offset: recordOffset,
            byteLength,
            payloadByteLength: metadata.payloadByteLength,
            encoding: metadata.encoding,
            objectId: metadata.objectId,
            recordIndex: metadata.recordIndex ?? 0
        }
    }

    /**
     * Reads one primitive record count from a stream header.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @returns {number}
     */
    static #readRecordCount(headerBytes) {
        const normalizedHeader =
            PcbPrimitiveRecordSlicer.#toUint8Array(headerBytes)

        if (normalizedHeader.byteLength < 4) {
            return 0
        }

        return new DataView(
            normalizedHeader.buffer,
            normalizedHeader.byteOffset,
            4
        ).getUint32(0, true)
    }

    /**
     * Reads one little-endian unsigned 32-bit value from a byte array.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32FromBytes(bytes, offset) {
        return new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            4
        ).getUint32(0, true)
    }

    /**
     * Normalizes a byte source to Uint8Array.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    }
}
