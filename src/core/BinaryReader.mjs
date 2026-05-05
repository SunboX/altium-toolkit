// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Reads little-endian primitive values from an ArrayBuffer with bounds checks.
 */
export class BinaryReader {
    #arrayBuffer

    #byteLength

    #dataView

    /**
     * @param {ArrayBuffer} arrayBuffer
     */
    constructor(arrayBuffer) {
        this.#arrayBuffer = arrayBuffer
        this.#dataView = new DataView(arrayBuffer)
        this.#byteLength = arrayBuffer.byteLength
    }

    /**
     * Returns the underlying byte length.
     * @returns {number}
     */
    get byteLength() {
        return this.#byteLength
    }

    /**
     * Reads one unsigned byte.
     * @param {number} offset
     * @returns {number}
     */
    readUint8(offset) {
        this.#assertReadable(offset, 1)
        return this.#dataView.getUint8(offset)
    }

    /**
     * Reads one unsigned 16-bit integer.
     * @param {number} offset
     * @returns {number}
     */
    readUint16(offset) {
        this.#assertReadable(offset, 2)
        return this.#dataView.getUint16(offset, true)
    }

    /**
     * Reads one unsigned 32-bit integer.
     * @param {number} offset
     * @returns {number}
     */
    readUint32(offset) {
        this.#assertReadable(offset, 4)
        return this.#dataView.getUint32(offset, true)
    }

    /**
     * Reads one signed 32-bit integer.
     * @param {number} offset
     * @returns {number}
     */
    readInt32(offset) {
        this.#assertReadable(offset, 4)
        return this.#dataView.getInt32(offset, true)
    }

    /**
     * Reads one unsigned 64-bit integer as a JavaScript number.
     * @param {number} offset
     * @returns {number}
     */
    readUint64(offset) {
        this.#assertReadable(offset, 8)

        const low = this.#dataView.getUint32(offset, true)
        const high = this.#dataView.getUint32(offset + 4, true)
        const value = high * 0x100000000 + low

        if (!Number.isSafeInteger(value)) {
            throw new RangeError(
                'BinaryReader cannot represent an unsafe 64-bit integer.'
            )
        }

        return value
    }

    /**
     * Reads one byte slice.
     * @param {number} offset
     * @param {number} length
     * @returns {Uint8Array}
     */
    readBytes(offset, length) {
        this.#assertReadable(offset, length)
        return new Uint8Array(this.#arrayBuffer.slice(offset, offset + length))
    }

    /**
     * Ensures one read stays inside the buffer.
     * @param {number} offset
     * @param {number} size
     */
    #assertReadable(offset, size) {
        const normalizedOffset = Number(offset)
        const normalizedSize = Number(size)

        if (
            !Number.isInteger(normalizedOffset) ||
            normalizedOffset < 0 ||
            normalizedOffset + normalizedSize > this.#byteLength
        ) {
            throw new RangeError(
                'BinaryReader read is out of bounds at offset ' +
                    normalizedOffset +
                    ' for ' +
                    normalizedSize +
                    ' byte(s).'
            )
        }
    }
}
