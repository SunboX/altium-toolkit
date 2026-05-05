// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { BinaryReader } from '../BinaryReader.mjs'
import { OleConstants } from './OleConstants.mjs'
import { OleDirectoryEntry } from './OleDirectoryEntry.mjs'

/**
 * Reads OLE Compound Document streams.
 */
export class OleCompoundDocument {
    #directoryEntries

    #fatEntries

    #header

    #miniFatEntries

    #miniStreamBytes

    #reader

    #streamPaths

    /**
     * @param {ArrayBuffer} arrayBuffer
     */
    constructor(arrayBuffer) {
        this.#reader = new BinaryReader(arrayBuffer)
        this.#header = this.#parseHeader()
        this.#fatEntries = this.#parseFatEntries()
        this.#directoryEntries = this.#parseDirectoryEntries()
        this.#miniFatEntries = this.#parseMiniFatEntries()
        this.#miniStreamBytes = this.#parseMiniStreamBytes()
        this.#streamPaths = this.#collectStreamPaths()
    }

    /**
     * Creates one compound document reader from raw bytes.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {OleCompoundDocument}
     */
    static fromArrayBuffer(arrayBuffer) {
        return new OleCompoundDocument(arrayBuffer)
    }

    /**
     * Returns the sector size in bytes.
     * @returns {number}
     */
    get sectorByteLength() {
        return this.#header.sectorByteLength
    }

    /**
     * Returns the mini-sector size in bytes.
     * @returns {number}
     */
    get miniSectorByteLength() {
        return this.#header.miniSectorByteLength
    }

    /**
     * Lists all stream paths.
     * @returns {string[]}
     */
    listStreams() {
        return [...this.#streamPaths.keys()].sort((left, right) =>
            left.localeCompare(right)
        )
    }

    /**
     * Resolves one stream by path or unique leaf name.
     * @param {string} name
     * @returns {Uint8Array}
     */
    getStream(name) {
        const directMatch = this.#streamPaths.get(name)
        if (directMatch) {
            return this.#readEntryStream(directMatch)
        }

        const leafMatches = [...this.#streamPaths.entries()].filter(
            ([path]) => path.split('/').at(-1) === name
        )

        if (!leafMatches.length) {
            throw new Error('OLE stream not found: ' + name)
        }

        if (leafMatches.length > 1) {
            throw new Error('OLE stream name is ambiguous: ' + name)
        }

        return this.#readEntryStream(leafMatches[0][1])
    }

    /**
     * Parses and validates the OLE header.
     * @returns {{ sectorByteLength: number, miniSectorByteLength: number, numberOfFatSectors: number, firstDirectorySector: number, miniStreamCutoff: number, firstMiniFatSector: number, numberOfMiniFatSectors: number, firstDifatSector: number, numberOfDifatSectors: number, difatEntries: number[] }}
     */
    #parseHeader() {
        const signature = [
            ...this.#reader.readBytes(0, OleConstants.HEADER_SIGNATURE.length)
        ]

        if (
            signature.some(
                (value, index) => value !== OleConstants.HEADER_SIGNATURE[index]
            )
        ) {
            throw new Error('Invalid OLE header signature.')
        }

        const sectorByteLength = 2 ** this.#reader.readUint16(30)
        const miniSectorByteLength = 2 ** this.#reader.readUint16(32)
        const difatEntries = []

        for (let index = 0; index < 109; index += 1) {
            difatEntries.push(this.#reader.readInt32(76 + index * 4))
        }

        return {
            sectorByteLength,
            miniSectorByteLength,
            numberOfFatSectors: this.#reader.readUint32(44),
            firstDirectorySector: this.#reader.readInt32(48),
            miniStreamCutoff: this.#reader.readUint32(56),
            firstMiniFatSector: this.#reader.readInt32(60),
            numberOfMiniFatSectors: this.#reader.readUint32(64),
            firstDifatSector: this.#reader.readInt32(68),
            numberOfDifatSectors: this.#reader.readUint32(72),
            difatEntries
        }
    }

    /**
     * Parses all FAT entries.
     * @returns {number[]}
     */
    #parseFatEntries() {
        const fatSectorIds = this.#collectFatSectorIds()
        const entries = []
        const intsPerSector = this.#header.sectorByteLength / 4

        for (const sectorId of fatSectorIds) {
            const sectorBytes = this.#readSectorBytes(sectorId)
            const reader = new BinaryReader(sectorBytes.buffer)

            for (let index = 0; index < intsPerSector; index += 1) {
                entries.push(reader.readInt32(index * 4))
            }
        }

        return entries
    }

    /**
     * Collects all FAT sector identifiers from the header and optional DIFAT
     * sectors.
     * @returns {number[]}
     */
    #collectFatSectorIds() {
        const fatSectorIds = this.#header.difatEntries.filter(
            (sectorId) => sectorId >= 0
        )

        if (
            this.#header.firstDifatSector < 0 ||
            this.#header.numberOfDifatSectors === 0
        ) {
            return fatSectorIds.slice(0, this.#header.numberOfFatSectors)
        }

        const intsPerSector = this.#header.sectorByteLength / 4
        let currentSectorId = this.#header.firstDifatSector

        for (
            let difatIndex = 0;
            difatIndex < this.#header.numberOfDifatSectors &&
            currentSectorId >= 0;
            difatIndex += 1
        ) {
            const sectorReader = new BinaryReader(
                this.#readSectorBytes(currentSectorId).buffer
            )

            for (let index = 0; index < intsPerSector - 1; index += 1) {
                const fatSectorId = sectorReader.readInt32(index * 4)
                if (fatSectorId >= 0) {
                    fatSectorIds.push(fatSectorId)
                }
            }

            currentSectorId = sectorReader.readInt32((intsPerSector - 1) * 4)
        }

        return fatSectorIds.slice(0, this.#header.numberOfFatSectors)
    }

    /**
     * Parses all directory entries reachable from the directory stream chain.
     * @returns {OleDirectoryEntry[]}
     */
    #parseDirectoryEntries() {
        const directoryChain = this.#readRegularChain(
            this.#header.firstDirectorySector
        )
        const entryCount =
            directoryChain.length / OleConstants.DIRECTORY_ENTRY_BYTE_LENGTH
        const entries = []

        for (let index = 0; index < entryCount; index += 1) {
            const offset = index * OleConstants.DIRECTORY_ENTRY_BYTE_LENGTH
            entries.push(
                OleDirectoryEntry.fromBytes(
                    directoryChain.slice(
                        offset,
                        offset + OleConstants.DIRECTORY_ENTRY_BYTE_LENGTH
                    ),
                    index
                )
            )
        }

        return entries
    }

    /**
     * Parses all mini FAT entries.
     * @returns {number[]}
     */
    #parseMiniFatEntries() {
        if (
            this.#header.firstMiniFatSector < 0 ||
            this.#header.numberOfMiniFatSectors === 0
        ) {
            return []
        }

        const chain = this.#readRegularChain(this.#header.firstMiniFatSector)
        const reader = new BinaryReader(chain.buffer)
        const entryCount = chain.length / 4
        const entries = []

        for (let index = 0; index < entryCount; index += 1) {
            entries.push(reader.readInt32(index * 4))
        }

        return entries
    }

    /**
     * Reads the root mini-stream bytes.
     * @returns {Uint8Array}
     */
    #parseMiniStreamBytes() {
        const rootEntry = this.#directoryEntries.find((entry) =>
            entry.isRootStorage()
        )
        if (!rootEntry || rootEntry.startSector < 0 || !rootEntry.streamSize) {
            return new Uint8Array(0)
        }

        return this.#readRegularChain(rootEntry.startSector).slice(
            0,
            rootEntry.streamSize
        )
    }

    /**
     * Builds a path map for all reachable stream entries.
     * @returns {Map<string, OleDirectoryEntry>}
     */
    #collectStreamPaths() {
        const rootEntry = this.#directoryEntries.find((entry) =>
            entry.isRootStorage()
        )
        const paths = new Map()

        if (!rootEntry || rootEntry.childId < 0) {
            return paths
        }

        this.#walkDirectoryTree(rootEntry.childId, '', paths)

        return paths
    }

    /**
     * Traverses one directory sibling tree.
     * @param {number} entryId
     * @param {string} basePath
     * @param {Map<string, OleDirectoryEntry>} paths
     */
    #walkDirectoryTree(entryId, basePath, paths) {
        if (entryId < 0) {
            return
        }

        const entry = this.#directoryEntries[entryId]
        if (!entry) {
            return
        }

        this.#walkDirectoryTree(entry.leftSiblingId, basePath, paths)

        const path = basePath ? basePath + '/' + entry.name : entry.name

        if (entry.isStream()) {
            paths.set(path, entry)
        }

        if (entry.isStorage() && !entry.isRootStorage() && entry.childId >= 0) {
            this.#walkDirectoryTree(entry.childId, path, paths)
        }

        this.#walkDirectoryTree(entry.rightSiblingId, basePath, paths)
    }

    /**
     * Reads one stream entry using the standard or mini FAT.
     * @param {OleDirectoryEntry} entry
     * @returns {Uint8Array}
     */
    #readEntryStream(entry) {
        if (entry.streamSize < this.#header.miniStreamCutoff) {
            return this.#readMiniStream(entry)
        }

        return this.#readRegularChain(entry.startSector).slice(
            0,
            entry.streamSize
        )
    }

    /**
     * Reads one standard-sector chain.
     * @param {number} startSectorId
     * @returns {Uint8Array}
     */
    #readRegularChain(startSectorId) {
        return this.#concatenateSectors(
            this.#readSectorChain(startSectorId, this.#fatEntries),
            this.#header.sectorByteLength,
            (sectorId) => this.#readSectorBytes(sectorId)
        )
    }

    /**
     * Reads one mini-sector-backed stream.
     * @param {OleDirectoryEntry} entry
     * @returns {Uint8Array}
     */
    #readMiniStream(entry) {
        const sectorIds = this.#readSectorChain(
            entry.startSector,
            this.#miniFatEntries
        )
        const bytes = this.#concatenateSectors(
            sectorIds,
            this.#header.miniSectorByteLength,
            (miniSectorId) =>
                this.#miniStreamBytes.slice(
                    miniSectorId * this.#header.miniSectorByteLength,
                    (miniSectorId + 1) * this.#header.miniSectorByteLength
                )
        )

        return bytes.slice(0, entry.streamSize)
    }

    /**
     * Reads one chain of sector identifiers.
     * @param {number} startSectorId
     * @param {number[]} entries
     * @returns {number[]}
     */
    #readSectorChain(startSectorId, entries) {
        const sectorIds = []
        const visited = new Set()
        let currentSectorId = startSectorId

        while (currentSectorId >= 0) {
            if (visited.has(currentSectorId)) {
                throw new Error(
                    'OLE sector chain loop detected at sector ' +
                        currentSectorId +
                        '.'
                )
            }

            visited.add(currentSectorId)
            sectorIds.push(currentSectorId)

            const nextSectorId = entries[currentSectorId]
            if (nextSectorId === OleConstants.END_OF_CHAIN) {
                break
            }

            currentSectorId = nextSectorId
        }

        return sectorIds
    }

    /**
     * Concatenates sector bytes from one chain.
     * @param {number[]} sectorIds
     * @param {number} sectorByteLength
     * @param {(sectorId: number) => Uint8Array} byteResolver
     * @returns {Uint8Array}
     */
    #concatenateSectors(sectorIds, sectorByteLength, byteResolver) {
        const bytes = new Uint8Array(sectorIds.length * sectorByteLength)

        for (let index = 0; index < sectorIds.length; index += 1) {
            bytes.set(byteResolver(sectorIds[index]), index * sectorByteLength)
        }

        return bytes
    }

    /**
     * Reads one regular sector.
     * @param {number} sectorId
     * @returns {Uint8Array}
     */
    #readSectorBytes(sectorId) {
        const offset =
            OleConstants.HEADER_BYTE_LENGTH +
            sectorId * this.#header.sectorByteLength

        return this.#reader.readBytes(offset, this.#header.sectorByteLength)
    }
}
