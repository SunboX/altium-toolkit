// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { OleConstants } from './OleConstants.mjs'

const sectorSize = 512
const directoryEntrySize = 128
const regularEntriesPerFatSector = sectorSize / 4
const rootEntryType = 5
const storageEntryType = 1
const streamEntryType = 2
const emptyEntryType = 0

/**
 * Writes compact OLE Compound Document files for generated Altium libraries.
 */
export class OleCompoundDocumentWriter {
    /**
     * Writes one compound document from a map of stream paths.
     * @param {{ streams?: Map<string, Uint8Array> | [string, Uint8Array][] }} options Writer options.
     * @returns {Uint8Array}
     */
    static write(options = {}) {
        const streams = OleCompoundDocumentWriter.#normalizeStreams(
            options.streams
        )
        const entries =
            OleCompoundDocumentWriter.#buildDirectoryEntries(streams)
        const directorySectorCount = Math.ceil(
            (OleCompoundDocumentWriter.#paddedDirectoryEntries(entries).length *
                directoryEntrySize) /
                sectorSize
        )
        const streamSectorCounts = streams.map((stream) =>
            Math.ceil(stream.bytes.byteLength / sectorSize)
        )
        const dataSectorCount =
            directorySectorCount +
            streamSectorCounts.reduce((sum, count) => sum + count, 0)
        const fatSectorCount =
            OleCompoundDocumentWriter.#resolveFatSectorCount(dataSectorCount)
        const totalSectorCount = dataSectorCount + fatSectorCount
        const bytes = new Uint8Array(
            OleConstants.HEADER_BYTE_LENGTH + totalSectorCount * sectorSize
        )
        const dataView = new DataView(bytes.buffer)
        const fatEntries = new Array(totalSectorCount).fill(
            OleConstants.FREE_SECTOR
        )
        const fatSectorStart = dataSectorCount

        let nextSector = directorySectorCount
        streams.forEach((stream, index) => {
            const sectorCount = streamSectorCounts[index]
            stream.startSector = sectorCount
                ? nextSector
                : OleConstants.END_OF_CHAIN
            nextSector += sectorCount
        })

        OleCompoundDocumentWriter.#writeHeader(
            dataView,
            fatSectorStart,
            fatSectorCount
        )
        OleCompoundDocumentWriter.#writeDirectory(
            bytes,
            fatEntries,
            entries,
            directorySectorCount
        )
        OleCompoundDocumentWriter.#writeStreams(
            bytes,
            fatEntries,
            streams,
            streamSectorCounts
        )
        OleCompoundDocumentWriter.#writeFat(
            bytes,
            dataView,
            fatEntries,
            fatSectorStart,
            fatSectorCount
        )

        return bytes
    }

    /**
     * Normalizes caller-provided streams into sorted byte entries.
     * @param {Map<string, Uint8Array> | [string, Uint8Array][] | undefined} streams Stream map.
     * @returns {{ path: string, bytes: Uint8Array, startSector: number }[]}
     */
    static #normalizeStreams(streams) {
        return [...new Map(streams || []).entries()]
            .map(([path, bytes]) => ({
                path: OleCompoundDocumentWriter.#normalizePath(path),
                bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(0),
                startSector: OleConstants.END_OF_CHAIN
            }))
            .filter((entry) => entry.path)
            .sort((left, right) => left.path.localeCompare(right.path))
    }

    /**
     * Normalizes one stream path.
     * @param {any} path Stream path.
     * @returns {string}
     */
    static #normalizePath(path) {
        return String(path || '')
            .split('/')
            .map((part) => part.trim())
            .filter(Boolean)
            .join('/')
    }

    /**
     * Builds directory entries and a simple right-sibling tree.
     * @param {{ path: string, bytes: Uint8Array }[]} streams Stream entries.
     * @returns {object[]}
     */
    static #buildDirectoryEntries(streams) {
        const entries = [
            OleCompoundDocumentWriter.#createDirectoryEntry('Root Entry', {
                type: rootEntryType
            })
        ]
        const childrenByParent = new Map([[0, []]])
        const storageIdsByPath = new Map([['', 0]])

        for (const stream of streams) {
            const parts = stream.path.split('/')
            let parentPath = ''
            let parentId = 0

            for (const part of parts.slice(0, -1)) {
                const storagePath = parentPath ? parentPath + '/' + part : part
                if (!storageIdsByPath.has(storagePath)) {
                    const storageId = entries.length
                    storageIdsByPath.set(storagePath, storageId)
                    entries.push(
                        OleCompoundDocumentWriter.#createDirectoryEntry(part, {
                            type: storageEntryType
                        })
                    )
                    OleCompoundDocumentWriter.#appendChild(
                        childrenByParent,
                        parentId,
                        storageId
                    )
                }
                parentPath = storagePath
                parentId = storageIdsByPath.get(storagePath)
            }

            const streamId = entries.length
            entries.push(
                OleCompoundDocumentWriter.#createDirectoryEntry(parts.at(-1), {
                    type: streamEntryType,
                    stream
                })
            )
            OleCompoundDocumentWriter.#appendChild(
                childrenByParent,
                parentId,
                streamId
            )
        }

        OleCompoundDocumentWriter.#linkSiblingTrees(entries, childrenByParent)

        return entries
    }

    /**
     * Creates one mutable directory entry.
     * @param {string} name Entry name.
     * @param {{ type: number, stream?: object }} options Entry options.
     * @returns {object}
     */
    static #createDirectoryEntry(name, options) {
        return {
            name,
            type: options.type,
            leftSiblingId: OleConstants.NO_STREAM,
            rightSiblingId: OleConstants.NO_STREAM,
            childId: OleConstants.NO_STREAM,
            stream: options.stream || null
        }
    }

    /**
     * Appends a child entry id to the parent lookup table.
     * @param {Map<number, number[]>} childrenByParent Child lookup.
     * @param {number} parentId Parent entry id.
     * @param {number} childId Child entry id.
     * @returns {void}
     */
    static #appendChild(childrenByParent, parentId, childId) {
        if (!childrenByParent.has(parentId)) {
            childrenByParent.set(parentId, [])
        }
        childrenByParent.get(parentId).push(childId)
        childrenByParent.set(childId, [])
    }

    /**
     * Links child lists into deterministic right-sibling chains.
     * @param {object[]} entries Directory entries.
     * @param {Map<number, number[]>} childrenByParent Child lookup.
     * @returns {void}
     */
    static #linkSiblingTrees(entries, childrenByParent) {
        for (const [parentId, childIds] of childrenByParent.entries()) {
            const sortedChildIds = [...childIds].sort((left, right) =>
                entries[left].name.localeCompare(entries[right].name)
            )
            if (!sortedChildIds.length) {
                continue
            }
            entries[parentId].childId = sortedChildIds[0]
            sortedChildIds.slice(0, -1).forEach((childId, index) => {
                entries[childId].rightSiblingId = sortedChildIds[index + 1]
            })
        }
    }

    /**
     * Pads directory entries to a full sector boundary.
     * @param {object[]} entries Directory entries.
     * @returns {object[]}
     */
    static #paddedDirectoryEntries(entries) {
        const padded = [...entries]
        while ((padded.length * directoryEntrySize) % sectorSize !== 0) {
            padded.push(
                OleCompoundDocumentWriter.#createDirectoryEntry('', {
                    type: emptyEntryType
                })
            )
        }
        return padded
    }

    /**
     * Resolves the number of FAT sectors required by this file.
     * @param {number} dataSectorCount Non-FAT sector count.
     * @returns {number}
     */
    static #resolveFatSectorCount(dataSectorCount) {
        let fatSectorCount = 1
        while (
            dataSectorCount + fatSectorCount >
            fatSectorCount * regularEntriesPerFatSector
        ) {
            fatSectorCount += 1
        }
        return fatSectorCount
    }

    /**
     * Writes the OLE header.
     * @param {DataView} dataView Output view.
     * @param {number} fatSectorStart First FAT sector id.
     * @param {number} fatSectorCount FAT sector count.
     * @returns {void}
     */
    static #writeHeader(dataView, fatSectorStart, fatSectorCount) {
        OleConstants.HEADER_SIGNATURE.forEach((value, index) => {
            dataView.setUint8(index, value)
        })
        dataView.setUint16(24, 0x003e, true)
        dataView.setUint16(26, 0x0003, true)
        dataView.setUint16(28, 0xfffe, true)
        dataView.setUint16(30, 9, true)
        dataView.setUint16(32, 6, true)
        dataView.setUint32(40, 0, true)
        dataView.setUint32(44, fatSectorCount, true)
        dataView.setInt32(48, 0, true)
        dataView.setUint32(56, 0, true)
        dataView.setInt32(60, OleConstants.END_OF_CHAIN, true)
        dataView.setUint32(64, 0, true)
        dataView.setInt32(68, OleConstants.END_OF_CHAIN, true)
        dataView.setUint32(72, 0, true)
        for (let index = 0; index < 109; index += 1) {
            dataView.setInt32(76 + index * 4, OleConstants.FREE_SECTOR, true)
        }
        for (let index = 0; index < fatSectorCount; index += 1) {
            dataView.setInt32(76 + index * 4, fatSectorStart + index, true)
        }
    }

    /**
     * Writes the directory stream.
     * @param {Uint8Array} bytes Output bytes.
     * @param {number[]} fatEntries FAT entries.
     * @param {object[]} entries Directory entries.
     * @param {number} directorySectorCount Directory sector count.
     * @returns {void}
     */
    static #writeDirectory(bytes, fatEntries, entries, directorySectorCount) {
        OleCompoundDocumentWriter.#linkFatChain(
            fatEntries,
            0,
            directorySectorCount
        )
        OleCompoundDocumentWriter.#paddedDirectoryEntries(entries).forEach(
            (entry, index) => {
                OleCompoundDocumentWriter.#writeDirectoryEntry(
                    bytes,
                    index,
                    entry
                )
            }
        )
    }

    /**
     * Writes all regular stream payloads.
     * @param {Uint8Array} bytes Output bytes.
     * @param {number[]} fatEntries FAT entries.
     * @param {object[]} streams Stream entries.
     * @param {number[]} streamSectorCounts Sector counts.
     * @returns {void}
     */
    static #writeStreams(bytes, fatEntries, streams, streamSectorCounts) {
        streams.forEach((stream, index) => {
            const sectorCount = streamSectorCounts[index]
            if (!sectorCount) {
                return
            }
            OleCompoundDocumentWriter.#linkFatChain(
                fatEntries,
                stream.startSector,
                sectorCount
            )
            bytes.set(
                stream.bytes,
                OleConstants.HEADER_BYTE_LENGTH +
                    stream.startSector * sectorSize
            )
        })
    }

    /**
     * Links a FAT sector chain.
     * @param {number[]} fatEntries FAT entries.
     * @param {number} startSector Start sector.
     * @param {number} sectorCount Sector count.
     * @returns {void}
     */
    static #linkFatChain(fatEntries, startSector, sectorCount) {
        for (let offset = 0; offset < sectorCount; offset += 1) {
            fatEntries[startSector + offset] =
                offset === sectorCount - 1
                    ? OleConstants.END_OF_CHAIN
                    : startSector + offset + 1
        }
    }

    /**
     * Writes FAT sectors.
     * @param {Uint8Array} bytes Output bytes.
     * @param {DataView} dataView Output view.
     * @param {number[]} fatEntries FAT entries.
     * @param {number} fatSectorStart First FAT sector id.
     * @param {number} fatSectorCount FAT sector count.
     * @returns {void}
     */
    static #writeFat(
        bytes,
        dataView,
        fatEntries,
        fatSectorStart,
        fatSectorCount
    ) {
        for (let index = 0; index < fatSectorCount; index += 1) {
            fatEntries[fatSectorStart + index] = OleConstants.FAT_SECTOR
        }
        for (
            let index = 0;
            index < fatSectorCount * regularEntriesPerFatSector;
            index += 1
        ) {
            dataView.setInt32(
                OleConstants.HEADER_BYTE_LENGTH +
                    fatSectorStart * sectorSize +
                    index * 4,
                fatEntries[index] ?? OleConstants.FREE_SECTOR,
                true
            )
        }
    }

    /**
     * Writes one directory entry.
     * @param {Uint8Array} bytes Output bytes.
     * @param {number} index Directory entry index.
     * @param {object} entry Directory entry.
     * @returns {void}
     */
    static #writeDirectoryEntry(bytes, index, entry) {
        const offset =
            OleConstants.HEADER_BYTE_LENGTH + index * directoryEntrySize
        const dataView = new DataView(bytes.buffer)
        const encodedName = OleCompoundDocumentWriter.#encodeDirectoryName(
            entry.name
        )
        const nameByteLength = Math.min(encodedName.byteLength, 64)

        bytes.set(encodedName.slice(0, nameByteLength), offset)
        dataView.setUint16(offset + 64, nameByteLength, true)
        dataView.setUint8(offset + 66, entry.type)
        dataView.setUint8(offset + 67, 1)
        dataView.setInt32(offset + 68, entry.leftSiblingId, true)
        dataView.setInt32(offset + 72, entry.rightSiblingId, true)
        dataView.setInt32(offset + 76, entry.childId, true)
        dataView.setInt32(
            offset + 116,
            entry.stream?.startSector ?? OleConstants.END_OF_CHAIN,
            true
        )
        dataView.setUint32(
            offset + 120,
            entry.stream?.bytes?.byteLength || 0,
            true
        )
        dataView.setUint32(offset + 124, 0, true)
    }

    /**
     * Encodes a directory name as UTF-16LE with a null terminator.
     * @param {string} name Directory entry name.
     * @returns {Uint8Array}
     */
    static #encodeDirectoryName(name) {
        const characters = Array.from(String(name || '')).slice(0, 31)
        const bytes = new Uint8Array((characters.length + 1) * 2)
        const dataView = new DataView(bytes.buffer)

        characters.concat('\u0000').forEach((character, index) => {
            dataView.setUint16(index * 2, character.charCodeAt(0), true)
        })

        return bytes
    }
}
