// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

const HEADER_BYTE_LENGTH = 512
const DIRECTORY_ENTRY_BYTE_LENGTH = 128
const END_OF_CHAIN = -2
const HEADER_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const VALID_SECTOR_SHIFTS = new Set([9, 12])

/**
 * Restores omitted physical padding only after proving every logical OLE byte
 * and structural sector is present.
 */
export class AltiumOleInputTailNormalizer {
    /**
     * Returns an aligned owned buffer when only unused final-sector padding is
     * absent, otherwise preserves the original input for strict native errors.
     * @param {ArrayBuffer} arrayBuffer OLE candidate bytes.
     * @returns {ArrayBuffer} Original or safely padded bytes.
     */
    static normalize(arrayBuffer) {
        if (!(arrayBuffer instanceof ArrayBuffer)) return arrayBuffer
        const bytes = new Uint8Array(arrayBuffer)
        if (!AltiumOleInputTailNormalizer.#hasOleSignature(bytes)) {
            return arrayBuffer
        }
        if (bytes.byteLength < HEADER_BYTE_LENGTH) return arrayBuffer

        const sourceView = new DataView(arrayBuffer)
        const sectorShift = sourceView.getUint16(30, true)
        if (!VALID_SECTOR_SHIFTS.has(sectorShift)) return arrayBuffer
        const miniSectorShift = sourceView.getUint16(32, true)
        if (miniSectorShift !== 6) return arrayBuffer
        const sectorByteLength = 2 ** sectorShift
        const miniSectorByteLength = 2 ** miniSectorShift
        const payloadByteLength = bytes.byteLength - HEADER_BYTE_LENGTH
        if (payloadByteLength % sectorByteLength === 0) return arrayBuffer

        const alignedPayloadByteLength =
            Math.ceil(payloadByteLength / sectorByteLength) * sectorByteLength
        const normalizedBytes = new Uint8Array(
            HEADER_BYTE_LENGTH + alignedPayloadByteLength
        )
        normalizedBytes.set(bytes)

        try {
            const isComplete =
                AltiumOleInputTailNormalizer.#isLogicallyComplete(
                    new DataView(normalizedBytes.buffer),
                    bytes.byteLength,
                    sectorByteLength,
                    miniSectorByteLength
                )
            return isComplete ? normalizedBytes.buffer : arrayBuffer
        } catch (_error) {
            return arrayBuffer
        }
    }

    /**
     * Checks the OLE header signature without parsing the document.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {boolean} Whether the signature matches.
     */
    static #hasOleSignature(bytes) {
        return (
            bytes.byteLength >= HEADER_SIGNATURE.length &&
            HEADER_SIGNATURE.every((value, index) => bytes[index] === value)
        )
    }

    /**
     * Verifies structural sectors and every regular logical stream byte.
     * @param {DataView} view Zero-padded aligned candidate view.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @param {number} miniSectorByteLength OLE mini-sector size.
     * @returns {boolean} Whether padding cannot synthesize declared data.
     */
    static #isLogicallyComplete(
        view,
        sourceByteLength,
        sectorByteLength,
        miniSectorByteLength
    ) {
        const fatSectorIds = AltiumOleInputTailNormalizer.#collectFatSectorIds(
            view,
            sourceByteLength,
            sectorByteLength
        )
        const numberOfFatSectors = view.getUint32(44, true)
        if (!numberOfFatSectors || fatSectorIds.length < numberOfFatSectors) {
            return false
        }
        const fatEntries = AltiumOleInputTailNormalizer.#readFatEntries(
            view,
            fatSectorIds.slice(0, numberOfFatSectors),
            sourceByteLength,
            sectorByteLength
        )
        if (fatEntries.length !== (numberOfFatSectors * sectorByteLength) / 4) {
            return false
        }
        const directorySectorIds =
            AltiumOleInputTailNormalizer.#readSectorChain(
                view.getInt32(48, true),
                fatEntries
            )
        if (
            !directorySectorIds.length ||
            !AltiumOleInputTailNormalizer.#hasFullSectors(
                directorySectorIds,
                sourceByteLength,
                sectorByteLength
            )
        ) {
            return false
        }

        const numberOfMiniFatSectors = view.getUint32(64, true)
        let miniFatEntries = []
        if (numberOfMiniFatSectors) {
            const miniFatSectorIds =
                AltiumOleInputTailNormalizer.#readSectorChain(
                    view.getInt32(60, true),
                    fatEntries
                )
            if (
                miniFatSectorIds.length !== numberOfMiniFatSectors ||
                !AltiumOleInputTailNormalizer.#hasFullSectors(
                    miniFatSectorIds.slice(0, numberOfMiniFatSectors),
                    sourceByteLength,
                    sectorByteLength
                )
            ) {
                return false
            }
            const miniFatBytes = AltiumOleInputTailNormalizer.#readFullSectors(
                view,
                miniFatSectorIds.slice(0, numberOfMiniFatSectors),
                sectorByteLength
            )
            miniFatEntries =
                AltiumOleInputTailNormalizer.#readInt32Entries(miniFatBytes)
        }

        const directoryBytes = AltiumOleInputTailNormalizer.#readFullSectors(
            view,
            directorySectorIds,
            sectorByteLength
        )
        return AltiumOleInputTailNormalizer.#areStreamsComplete(
            directoryBytes,
            fatEntries,
            miniFatEntries,
            view.getUint32(56, true),
            sourceByteLength,
            sectorByteLength,
            miniSectorByteLength,
            Math.floor(
                (sourceByteLength - HEADER_BYTE_LENGTH) / sectorByteLength
            )
        )
    }

    /**
     * Decodes little-endian signed integers from structural table bytes.
     * @param {Uint8Array} bytes Structural sector bytes.
     * @returns {number[]} Decoded table entries.
     */
    static #readInt32Entries(bytes) {
        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        )
        const entries = []
        for (let offset = 0; offset < bytes.byteLength; offset += 4) {
            entries.push(view.getInt32(offset, true))
        }
        return entries
    }

    /**
     * Collects FAT sector ids from the header and DIFAT chain.
     * @param {DataView} view Aligned candidate view.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {number[]} FAT sector ids.
     */
    static #collectFatSectorIds(view, sourceByteLength, sectorByteLength) {
        const sectorIds = []
        for (let index = 0; index < 109; index += 1) {
            const sectorId = view.getInt32(76 + index * 4, true)
            if (sectorId >= 0) sectorIds.push(sectorId)
        }

        const numberOfDifatSectors = view.getUint32(72, true)
        let currentSectorId = view.getInt32(68, true)
        const visited = new Set()
        const entriesPerSector = sectorByteLength / 4
        for (
            let index = 0;
            index < numberOfDifatSectors && currentSectorId >= 0;
            index += 1
        ) {
            if (visited.has(currentSectorId)) return []
            visited.add(currentSectorId)
            if (
                !AltiumOleInputTailNormalizer.#hasFullSector(
                    currentSectorId,
                    sourceByteLength,
                    sectorByteLength
                )
            ) {
                return []
            }
            const offset =
                HEADER_BYTE_LENGTH + currentSectorId * sectorByteLength
            for (let entry = 0; entry < entriesPerSector - 1; entry += 1) {
                const sectorId = view.getInt32(offset + entry * 4, true)
                if (sectorId >= 0) sectorIds.push(sectorId)
            }
            currentSectorId = view.getInt32(
                offset + (entriesPerSector - 1) * 4,
                true
            )
        }
        if (numberOfDifatSectors && visited.size !== numberOfDifatSectors) {
            return []
        }
        return sectorIds
    }

    /**
     * Reads every FAT entry from complete FAT sectors.
     * @param {DataView} view Aligned candidate view.
     * @param {number[]} sectorIds FAT sector ids.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {number[]} FAT entries.
     */
    static #readFatEntries(
        view,
        sectorIds,
        sourceByteLength,
        sectorByteLength
    ) {
        if (
            !AltiumOleInputTailNormalizer.#hasFullSectors(
                sectorIds,
                sourceByteLength,
                sectorByteLength
            )
        ) {
            return []
        }
        const entries = []
        for (const sectorId of sectorIds) {
            const offset = HEADER_BYTE_LENGTH + sectorId * sectorByteLength
            for (let index = 0; index < sectorByteLength / 4; index += 1) {
                entries.push(view.getInt32(offset + index * 4, true))
            }
        }
        return entries
    }

    /**
     * Reads one FAT chain with loop and bounds protection.
     * @param {number} startSectorId First sector id.
     * @param {number[]} fatEntries FAT entries.
     * @returns {number[]} Ordered sector ids, or an empty invalid chain.
     */
    static #readSectorChain(startSectorId, fatEntries) {
        if (startSectorId < 0) return []
        const sectorIds = []
        const visited = new Set()
        let currentSectorId = startSectorId
        while (currentSectorId >= 0) {
            if (
                currentSectorId >= fatEntries.length ||
                visited.has(currentSectorId)
            ) {
                return []
            }
            visited.add(currentSectorId)
            sectorIds.push(currentSectorId)
            const nextSectorId = fatEntries[currentSectorId]
            if (nextSectorId === END_OF_CHAIN) return sectorIds
            if (!Number.isInteger(nextSectorId) || nextSectorId < 0) return []
            currentSectorId = nextSectorId
        }
        return []
    }

    /**
     * Verifies regular, root, and mini-stream entries against source bytes.
     * @param {Uint8Array} directoryBytes Decoded directory sectors.
     * @param {number[]} fatEntries FAT entries.
     * @param {number[]} miniFatEntries Mini-FAT entries.
     * @param {number} miniStreamCutoff OLE mini-stream cutoff.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @param {number} miniSectorByteLength OLE mini-sector size.
     * @param {number} partialSectorId Physically partial final sector id.
     * @returns {boolean} Whether every declared stream is complete.
     */
    static #areStreamsComplete(
        directoryBytes,
        fatEntries,
        miniFatEntries,
        miniStreamCutoff,
        sourceByteLength,
        sectorByteLength,
        miniSectorByteLength,
        partialSectorId
    ) {
        const view = new DataView(
            directoryBytes.buffer,
            directoryBytes.byteOffset,
            directoryBytes.byteLength
        )
        const entryCount =
            directoryBytes.byteLength / DIRECTORY_ENTRY_BYTE_LENGTH
        const entries = []
        for (let index = 0; index < entryCount; index += 1) {
            const offset = index * DIRECTORY_ENTRY_BYTE_LENGTH
            const type = view.getUint8(offset + 66)
            const streamSize = Number(view.getBigUint64(offset + 120, true))
            if (!Number.isSafeInteger(streamSize)) return false
            entries.push({
                startSectorId: view.getInt32(offset + 116, true),
                streamSize,
                type
            })
        }

        const rootEntry = entries.find((entry) => entry.type === 5)
        const rootStreamByteLength = rootEntry?.streamSize ?? 0
        let containsDeclaredPartialSector = false
        for (const entry of entries) {
            const { startSectorId, streamSize, type } = entry
            const isRootStream = type === 5 && streamSize > 0
            const isRegularStream = type === 2 && streamSize >= miniStreamCutoff
            if (!isRootStream && !isRegularStream) continue
            const sectorIds = AltiumOleInputTailNormalizer.#readSectorChain(
                startSectorId,
                fatEntries
            )
            if (
                !AltiumOleInputTailNormalizer.#isStreamComplete(
                    sectorIds,
                    streamSize,
                    sourceByteLength,
                    sectorByteLength
                )
            ) {
                return false
            }
            if (sectorIds.includes(partialSectorId)) {
                containsDeclaredPartialSector = true
            }
        }

        for (const entry of entries) {
            const { startSectorId, streamSize, type } = entry
            const isMiniStream =
                type === 2 && streamSize > 0 && streamSize < miniStreamCutoff
            if (!isMiniStream) continue
            if (!rootEntry || !miniFatEntries.length) return false
            const miniSectorIds = AltiumOleInputTailNormalizer.#readSectorChain(
                startSectorId,
                miniFatEntries
            )
            if (
                !AltiumOleInputTailNormalizer.#isMiniStreamComplete(
                    miniSectorIds,
                    streamSize,
                    rootStreamByteLength,
                    miniSectorByteLength
                )
            ) {
                return false
            }
        }
        return containsDeclaredPartialSector
    }

    /**
     * Checks one mini-stream chain against its declared root stream container.
     * @param {number[]} miniSectorIds Ordered mini-sector ids.
     * @param {number} streamByteLength Declared mini-stream length.
     * @param {number} rootStreamByteLength Declared root stream length.
     * @param {number} miniSectorByteLength OLE mini-sector size.
     * @returns {boolean} Whether every mini-stream byte is contained.
     */
    static #isMiniStreamComplete(
        miniSectorIds,
        streamByteLength,
        rootStreamByteLength,
        miniSectorByteLength
    ) {
        const requiredSectorCount = Math.ceil(
            streamByteLength / miniSectorByteLength
        )
        if (miniSectorIds.length !== requiredSectorCount) {
            return false
        }
        for (let index = 0; index < miniSectorIds.length; index += 1) {
            const miniSectorId = miniSectorIds[index]
            const miniSectorOffset = miniSectorId * miniSectorByteLength
            if (!Number.isSafeInteger(miniSectorOffset)) return false
            const remaining = streamByteLength - index * miniSectorByteLength
            const required = Math.min(
                miniSectorByteLength,
                Math.max(0, remaining)
            )
            if (!required) continue
            const available = Math.max(
                0,
                Math.min(
                    miniSectorByteLength,
                    rootStreamByteLength - miniSectorOffset
                )
            )
            if (available < required) return false
        }
        return true
    }

    /**
     * Checks every declared byte of one regular stream chain.
     * @param {number[]} sectorIds Stream sector ids.
     * @param {number} streamByteLength Declared logical stream length.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {boolean} Whether the logical stream is physically complete.
     */
    static #isStreamComplete(
        sectorIds,
        streamByteLength,
        sourceByteLength,
        sectorByteLength
    ) {
        const requiredSectorCount = Math.ceil(
            streamByteLength / sectorByteLength
        )
        if (sectorIds.length !== requiredSectorCount) return false
        for (let index = 0; index < sectorIds.length; index += 1) {
            const remaining = streamByteLength - index * sectorByteLength
            const required = Math.min(sectorByteLength, Math.max(0, remaining))
            if (!required) continue
            const available =
                AltiumOleInputTailNormalizer.#availableSectorByteLength(
                    sectorIds[index],
                    sourceByteLength,
                    sectorByteLength
                )
            if (available < required) return false
        }
        return true
    }

    /**
     * Returns whether every sector is fully present in the original source.
     * @param {number[]} sectorIds Sector ids.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {boolean} Whether all sectors are complete.
     */
    static #hasFullSectors(sectorIds, sourceByteLength, sectorByteLength) {
        return sectorIds.every((sectorId) =>
            AltiumOleInputTailNormalizer.#hasFullSector(
                sectorId,
                sourceByteLength,
                sectorByteLength
            )
        )
    }

    /**
     * Returns whether one full sector is physically present.
     * @param {number} sectorId Sector id.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {boolean} Whether the sector is complete.
     */
    static #hasFullSector(sectorId, sourceByteLength, sectorByteLength) {
        return (
            Number.isInteger(sectorId) &&
            sectorId >= 0 &&
            AltiumOleInputTailNormalizer.#availableSectorByteLength(
                sectorId,
                sourceByteLength,
                sectorByteLength
            ) === sectorByteLength
        )
    }

    /**
     * Resolves physical source bytes available for one sector.
     * @param {number} sectorId Sector id.
     * @param {number} sourceByteLength Original physical byte length.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {number} Available bytes from zero through one full sector.
     */
    static #availableSectorByteLength(
        sectorId,
        sourceByteLength,
        sectorByteLength
    ) {
        const offset = HEADER_BYTE_LENGTH + sectorId * sectorByteLength
        return Math.max(
            0,
            Math.min(sectorByteLength, sourceByteLength - offset)
        )
    }

    /**
     * Concatenates complete structural sectors from the aligned view.
     * @param {DataView} view Aligned candidate view.
     * @param {number[]} sectorIds Sector ids.
     * @param {number} sectorByteLength OLE sector size.
     * @returns {Uint8Array} Concatenated bytes.
     */
    static #readFullSectors(view, sectorIds, sectorByteLength) {
        const bytes = new Uint8Array(sectorIds.length * sectorByteLength)
        const source = new Uint8Array(view.buffer)
        sectorIds.forEach((sectorId, index) => {
            const offset = HEADER_BYTE_LENGTH + sectorId * sectorByteLength
            bytes.set(
                source.slice(offset, offset + sectorByteLength),
                index * sectorByteLength
            )
        })
        return bytes
    }
}

Object.freeze(AltiumOleInputTailNormalizer.prototype)
Object.freeze(AltiumOleInputTailNormalizer)
