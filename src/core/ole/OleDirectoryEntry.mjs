import { BinaryReader } from '../BinaryReader.mjs'
import { OleConstants } from './OleConstants.mjs'

/**
 * Represents one decoded OLE directory entry.
 */
export class OleDirectoryEntry {
    /**
     * @param {{ id: number, name: string, type: number, leftSiblingId: number, rightSiblingId: number, childId: number, startSector: number, streamSize: number }} options
     */
    constructor(options) {
        this.id = options.id
        this.name = options.name
        this.type = options.type
        this.leftSiblingId = options.leftSiblingId
        this.rightSiblingId = options.rightSiblingId
        this.childId = options.childId
        this.startSector = options.startSector
        this.streamSize = options.streamSize
    }

    /**
     * Decodes one raw directory-entry buffer.
     * @param {Uint8Array} bytes
     * @param {number} id
     * @returns {OleDirectoryEntry}
     */
    static fromBytes(bytes, id) {
        const reader = new BinaryReader(
            bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
            )
        )
        const nameByteLength = Math.max(
            Math.min(reader.readUint16(64), 64) - 2,
            0
        )
        const name = new TextDecoder('utf-16le')
            .decode(reader.readBytes(0, nameByteLength))
            .replace(/\u0000+$/g, '')

        return new OleDirectoryEntry({
            id,
            name,
            type: reader.readUint8(66),
            leftSiblingId: reader.readInt32(68),
            rightSiblingId: reader.readInt32(72),
            childId: reader.readInt32(76),
            startSector: reader.readInt32(116),
            streamSize: reader.readUint64(120)
        })
    }

    /**
     * Returns true when this entry stores stream bytes.
     * @returns {boolean}
     */
    isStream() {
        return this.type === 2
    }

    /**
     * Returns true when this entry is the root storage.
     * @returns {boolean}
     */
    isRootStorage() {
        return this.type === 5
    }

    /**
     * Returns true when this entry is a non-root storage.
     * @returns {boolean}
     */
    isStorage() {
        return this.type === 1 || this.type === 5
    }

    /**
     * Returns true when the entry has no useful payload.
     * @returns {boolean}
     */
    isEmpty() {
        return (
            !this.name &&
            this.type === 0 &&
            this.startSector === OleConstants.NO_STREAM &&
            this.streamSize === 0
        )
    }
}
