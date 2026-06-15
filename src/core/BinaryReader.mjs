// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Reads sequential little-endian primitive values from a BinaryReader.
 */
export class BinaryReaderCursor {
    #offset

    #reader

    /**
     * @param {BinaryReader} reader
     * @param {number} [offset]
     */
    constructor(reader, offset = 0) {
        const normalizedOffset = Number(offset)
        if (
            !Number.isInteger(normalizedOffset) ||
            normalizedOffset < 0 ||
            normalizedOffset > reader.byteLength
        ) {
            throw new RangeError(
                'BinaryReader cursor offset is out of bounds: ' +
                    normalizedOffset
            )
        }

        this.#reader = reader
        this.#offset = normalizedOffset
    }

    /**
     * Returns the current cursor offset.
     * @returns {number}
     */
    get offset() {
        return this.#offset
    }

    /**
     * Reads one unsigned byte and advances the cursor.
     * @returns {number}
     */
    readUint8() {
        return this.#readNumber(1, (offset) => this.#reader.readUint8(offset))
    }

    /**
     * Reads one signed 16-bit integer and advances the cursor.
     * @returns {number}
     */
    readInt16() {
        return this.#readNumber(2, (offset) => this.#reader.readInt16(offset))
    }

    /**
     * Reads one unsigned 16-bit integer and advances the cursor.
     * @returns {number}
     */
    readUint16() {
        return this.#readNumber(2, (offset) => this.#reader.readUint16(offset))
    }

    /**
     * Reads one unsigned 32-bit integer and advances the cursor.
     * @returns {number}
     */
    readUint32() {
        return this.#readNumber(4, (offset) => this.#reader.readUint32(offset))
    }

    /**
     * Reads one signed 32-bit integer and advances the cursor.
     * @returns {number}
     */
    readInt32() {
        return this.#readNumber(4, (offset) => this.#reader.readInt32(offset))
    }

    /**
     * Reads one unsigned 64-bit integer and advances the cursor.
     * @returns {number}
     */
    readUint64() {
        return this.#readNumber(8, (offset) => this.#reader.readUint64(offset))
    }

    /**
     * Reads one 64-bit floating-point value and advances the cursor.
     * @returns {number}
     */
    readFloat64() {
        return this.#readNumber(8, (offset) => this.#reader.readFloat64(offset))
    }

    /**
     * Reads one byte slice and advances the cursor.
     * @param {number} length
     * @returns {Uint8Array}
     */
    readBytes(length) {
        const bytes = this.#reader.readBytes(this.#offset, length)
        this.#offset += Number(length)
        return bytes
    }

    /**
     * Reads one length-prefixed string and advances the cursor.
     * @param {string} [encoding]
     * @returns {string}
     */
    readPascalString(encoding = 'utf-8') {
        const length = this.#reader.readUint8(this.#offset)
        const value = this.#reader.readPascalString(this.#offset, encoding)
        this.#offset += 1 + length
        return value
    }

    /**
     * Reads one length-prefixed block and advances the cursor.
     * @returns {{ byteLength: number, flags: number, dataOffset: number, nextOffset: number, bytes: Uint8Array }}
     */
    readSizedBlock() {
        const block = this.#reader.readSizedBlock(this.#offset)
        this.#offset = block.nextOffset
        return block
    }

    /**
     * Reads one fixed-width numeric value and advances the cursor.
     * @param {number} size
     * @param {(offset: number) => number} reader
     * @returns {number}
     */
    #readNumber(size, reader) {
        const value = reader(this.#offset)
        this.#offset += size
        return value
    }
}

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
     * Reads one signed 16-bit integer.
     * @param {number} offset
     * @returns {number}
     */
    readInt16(offset) {
        this.#assertReadable(offset, 2)
        return this.#dataView.getInt16(offset, true)
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
     * Reads one 64-bit floating-point value.
     * @param {number} offset
     * @returns {number}
     */
    readFloat64(offset) {
        this.#assertReadable(offset, 8)
        return this.#dataView.getFloat64(offset, true)
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
        const normalizedOffset = Number(offset)
        const normalizedLength = Number(length)
        this.#assertReadable(normalizedOffset, normalizedLength)
        return new Uint8Array(
            this.#arrayBuffer.slice(
                normalizedOffset,
                normalizedOffset + normalizedLength
            )
        )
    }

    /**
     * Reads one one-byte length-prefixed string.
     * @param {number} offset
     * @param {string} [encoding]
     * @returns {string}
     */
    readPascalString(offset, encoding = 'utf-8') {
        const length = this.readUint8(offset)
        const bytes = this.readBytes(offset + 1, length)
        return new TextDecoder(encoding).decode(bytes)
    }

    /**
     * Reads one 32-bit length-prefixed byte block.
     * @param {number} offset
     * @returns {{ byteLength: number, flags: number, dataOffset: number, nextOffset: number, bytes: Uint8Array }}
     */
    readSizedBlock(offset) {
        const normalizedOffset = Number(offset)
        const rawLength = this.readUint32(normalizedOffset)
        const byteLength = rawLength & 0x00ffffff
        const flags = rawLength >>> 24
        const dataOffset = normalizedOffset + 4
        const bytes = this.readBytes(dataOffset, byteLength)

        return {
            byteLength,
            flags,
            dataOffset,
            nextOffset: dataOffset + byteLength,
            bytes
        }
    }

    /**
     * Creates a sequential cursor over this reader.
     * @param {number} [offset]
     * @returns {BinaryReaderCursor}
     */
    cursor(offset = 0) {
        return new BinaryReaderCursor(this, offset)
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
            !Number.isInteger(normalizedSize) ||
            normalizedOffset < 0 ||
            normalizedSize < 0 ||
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
