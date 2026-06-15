// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { EmbeddedFileInventoryBuilder } from './EmbeddedFileInventoryBuilder.mjs'
import { AsciiRecordParser } from './AsciiRecordParser.mjs'
import { NativeStreamInventoryBuilder } from './NativeStreamInventoryBuilder.mjs'
import { SchematicRecordStreamParser } from './SchematicRecordStreamParser.mjs'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { OleConstants } from '../ole/OleConstants.mjs'
import { unzlibSync } from 'fflate'

const PIN_SIDECAR_STREAMS = Object.freeze([
    'PinFrac',
    'PinSymbolLineWidth',
    'PinDesc',
    'PinTextData',
    'PinPackageLength',
    'PinFunctionData'
])

/**
 * Extracts stream-scoped schematic-symbol library content from OLE containers.
 */
export class SchLibStreamExtractor {
    /**
     * Returns true when one buffer starts with the OLE compound-document
     * signature.
     * @param {ArrayBuffer} arrayBuffer Source bytes.
     * @returns {boolean}
     */
    static isCompoundDocument(arrayBuffer) {
        const bytes = new Uint8Array(
            arrayBuffer,
            0,
            Math.min(
                arrayBuffer.byteLength,
                OleConstants.HEADER_SIGNATURE.length
            )
        )

        if (bytes.byteLength < OleConstants.HEADER_SIGNATURE.length) {
            return false
        }

        return OleConstants.HEADER_SIGNATURE.every(
            (value, index) => bytes[index] === value
        )
    }

    /**
     * Extracts schematic-library streams from one OLE-backed SchLib buffer.
     * @param {ArrayBuffer} arrayBuffer Source bytes.
     * @returns {ReturnType<typeof SchLibStreamExtractor.extractFromStreams> | null}
     */
    static extractFromArrayBuffer(arrayBuffer) {
        if (!SchLibStreamExtractor.isCompoundDocument(arrayBuffer)) {
            return null
        }

        const compoundDocument =
            OleCompoundDocument.fromArrayBuffer(arrayBuffer)
        const streams = new Map()

        for (const name of compoundDocument.listStreams()) {
            streams.set(name, compoundDocument.getStream(name))
        }

        return SchLibStreamExtractor.extractFromStreams(streams)
    }

    /**
     * Extracts library-level and component-level schematic records.
     * @param {Map<string, Uint8Array>} streams Compound-document streams.
     * @returns {{ libraryRecords: object[], fileHeaderRecords: object[], sectionKeys: object[], symbols: object[], streamNames: string[], embeddedFiles: object, opaqueRecords: object[], diagnostics: object }}
     */
    static extractFromStreams(streams) {
        const streamNames = [...(streams || new Map()).keys()].sort()
        const libraryRecords = SchLibStreamExtractor.#parseRecordStream(
            streams.get('Library/Data'),
            {
                sourceStorage: 'Library',
                sourceStream: 'Library/Data'
            }
        ).records
        const fileHeaderRecords = SchLibStreamExtractor.#parseRecordStream(
            streams.get('FileHeader'),
            {
                sourceStorage: '',
                sourceStream: 'FileHeader'
            }
        ).records
        const sectionKeyParse = SchLibStreamExtractor.#parseRecordStream(
            streams.get('SectionKeys'),
            {
                sourceStorage: '',
                sourceStream: 'SectionKeys'
            }
        )
        const sectionKeys = SchLibStreamExtractor.#sectionKeys(
            sectionKeyParse.records
        )
        const symbolStorages = SchLibStreamExtractor.#componentStorages(
            streamNames,
            sectionKeys
        )
        const symbols = symbolStorages.map((sourceStorage) =>
            SchLibStreamExtractor.#symbolExtraction(
                streams,
                streamNames,
                sourceStorage
            )
        )
        const opaqueRecords = symbols.flatMap(
            (symbol) => symbol.opaqueRecords || []
        )
        const usedStreams = [
            'Library/Data',
            ...(fileHeaderRecords.length ? ['FileHeader'] : []),
            ...(sectionKeyParse.records.length ? ['SectionKeys'] : []),
            ...symbols.flatMap((symbol) => symbol.usedStreamNames || [])
        ]
        const embeddedFiles = EmbeddedFileInventoryBuilder.buildFromStreams(
            streams || new Map(),
            { skipStreamNames: usedStreams }
        )
        const consumedStreamNames = [
            ...usedStreams,
            ...embeddedFiles.files.map((file) => file.sourceStream),
            ...embeddedFiles.diagnostics.map(
                (diagnostic) => diagnostic.sourceStream
            )
        ]
        const nativeStreams = NativeStreamInventoryBuilder.buildFromStreams(
            streams || new Map(),
            {
                source: 'schlib',
                consumedStreamNames,
                knownStreamNames:
                    SchLibStreamExtractor.#knownStreamNames(streamNames)
            }
        )

        return {
            libraryRecords,
            fileHeaderRecords,
            sectionKeys,
            symbols,
            streamNames,
            nativeStreams,
            embeddedFiles,
            opaqueRecords,
            diagnostics: {
                symbolCount: symbols.length,
                streamCount: streamNames.length,
                sectionKeyCount: sectionKeys.length,
                opaqueRecordCount: opaqueRecords.length,
                embeddedFileCount: embeddedFiles.files.length
            }
        }
    }

    /**
     * Finds component storage paths that carry a Data stream.
     * @param {string[]} streamNames Stream names.
     * @param {object[]} sectionKeys Section-key mappings.
     * @returns {string[]}
     */
    static #componentStorages(streamNames, sectionKeys) {
        const storages = new Set()

        for (const streamName of streamNames || []) {
            if (
                /^Components\/[^/]+\/Data$/iu.test(streamName) ||
                (/^[^/]+\/Data$/iu.test(streamName) &&
                    streamName !== 'Library/Data')
            ) {
                storages.add(streamName.replace(/\/Data$/iu, ''))
            }
        }

        for (const sectionKey of sectionKeys || []) {
            if (
                sectionKey.sectionKey &&
                streamNames.includes(sectionKey.sectionKey + '/Data')
            ) {
                storages.add(sectionKey.sectionKey)
            }
        }

        const sectionOrder = new Map(
            (sectionKeys || []).map((sectionKey, index) => [
                sectionKey.sectionKey,
                index
            ])
        )

        return [...storages].sort((left, right) => {
            const leftOrder = sectionOrder.get(left)
            const rightOrder = sectionOrder.get(right)

            if (leftOrder !== undefined || rightOrder !== undefined) {
                return (
                    (leftOrder ?? Number.MAX_SAFE_INTEGER) -
                    (rightOrder ?? Number.MAX_SAFE_INTEGER)
                )
            }

            return left.localeCompare(right)
        })
    }

    /**
     * Extracts one component storage.
     * @param {Map<string, Uint8Array>} streams Stream map.
     * @param {string[]} streamNames All stream names.
     * @param {string} sourceStorage Component storage path.
     * @returns {object}
     */
    static #symbolExtraction(streams, streamNames, sourceStorage) {
        const dataStream = sourceStorage + '/Data'
        const dataParse = SchLibStreamExtractor.#parseRecordStream(
            streams.get(dataStream),
            { sourceStorage, sourceStream: dataStream }
        )
        const sidecarParses = streamNames
            .filter(
                (streamName) =>
                    streamName.startsWith(sourceStorage + '/') &&
                    streamName !== dataStream &&
                    !SchLibStreamExtractor.#isKnownPinSidecar(
                        streamName,
                        sourceStorage
                    ) &&
                    streamName !== sourceStorage + '/Storage'
            )
            .map((streamName) =>
                SchLibStreamExtractor.#parseRecordStream(
                    streams.get(streamName),
                    { sourceStorage, sourceStream: streamName }
                )
            )
        const pinSidecars = SchLibStreamExtractor.#pinSidecars(
            streams,
            sourceStorage
        )
        const storageAsset = SchLibStreamExtractor.#storageAsset(
            streams.get(sourceStorage + '/Storage'),
            sourceStorage + '/Storage'
        )
        const opaqueRecords = [
            ...dataParse.opaqueRecords,
            ...sidecarParses.flatMap((entry) => entry.opaqueRecords)
        ]

        return {
            sourceStorage,
            sourceStream: dataStream,
            records: dataParse.records,
            pinSidecars: pinSidecars.records,
            embeddedAssets: storageAsset ? [storageAsset] : [],
            opaqueRecords,
            usedStreamNames: [
                dataStream,
                ...pinSidecars.usedStreamNames,
                ...(storageAsset ? [storageAsset.sourceStream] : []),
                ...sidecarParses
                    .filter((entry) => entry.opaqueRecords.length)
                    .map((entry) => entry.sourceStream)
            ]
        }
    }

    /**
     * Parses a stream into records plus opaque native frames.
     * @param {Uint8Array | undefined} bytes Stream bytes.
     * @param {{ sourceStorage: string, sourceStream: string }} options Source metadata.
     * @returns {{ sourceStream: string, records: object[], opaqueRecords: object[] }}
     */
    static #parseRecordStream(bytes, options) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return {
                sourceStream: options.sourceStream,
                records: [],
                opaqueRecords: []
            }
        }

        const parsed = SchematicRecordStreamParser.parseWithOpaqueRecords(
            SchLibStreamExtractor.#toArrayBuffer(bytes),
            {
                source: 'schlib',
                sourceStorage: options.sourceStorage,
                sourceStream: options.sourceStream
            }
        )

        return {
            sourceStream: options.sourceStream,
            records: parsed.records.map((record, recordIndex) => ({
                ...record,
                recordIndex,
                sourceStorage: options.sourceStorage,
                sourceStream: options.sourceStream
            })),
            opaqueRecords: parsed.opaqueRecords
        }
    }

    /**
     * Builds section-key mappings from the native SectionKeys stream.
     * @param {object[]} records Parsed SectionKeys records.
     * @returns {{ libReference: string, sectionKey: string, sourceStream: string, recordIndex: number }[]}
     */
    static #sectionKeys(records) {
        return (records || [])
            .map((record, recordIndex) =>
                SchLibStreamExtractor.#stripUndefined({
                    libReference:
                        SchLibStreamExtractor.#field(
                            record.fields,
                            'LibReference'
                        ) ||
                        SchLibStreamExtractor.#field(record.fields, 'LibRef') ||
                        SchLibStreamExtractor.#field(record.fields, 'Name'),
                    sectionKey:
                        SchLibStreamExtractor.#field(
                            record.fields,
                            'SectionKey'
                        ) ||
                        SchLibStreamExtractor.#field(
                            record.fields,
                            'Storage'
                        ) ||
                        SchLibStreamExtractor.#field(record.fields, 'Key'),
                    sourceStream: record.sourceStream || 'SectionKeys',
                    recordIndex
                })
            )
            .filter((record) => record.libReference || record.sectionKey)
    }

    /**
     * Parses known per-pin side streams.
     * @param {Map<string, Uint8Array>} streams Source streams.
     * @param {string} sourceStorage Symbol storage path.
     * @returns {{ records: Record<string, object[]>, usedStreamNames: string[] }}
     */
    static #pinSidecars(streams, sourceStorage) {
        const records = {}
        const usedStreamNames = []

        for (const streamName of PIN_SIDECAR_STREAMS) {
            const sourceStream = sourceStorage + '/' + streamName
            const bytes = streams.get(sourceStream)
            if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
                continue
            }

            const parsed = SchLibStreamExtractor.#parseSidecarRecords(bytes, {
                sourceStorage,
                sourceStream
            })
            if (!parsed.length) {
                continue
            }

            records[streamName] = parsed
            usedStreamNames.push(sourceStream)
        }

        return { records, usedStreamNames }
    }

    /**
     * Parses one pin side stream, inflating zlib payloads when present.
     * @param {Uint8Array} bytes Side stream bytes.
     * @param {{ sourceStorage: string, sourceStream: string }} options Source metadata.
     * @returns {object[]}
     */
    static #parseSidecarRecords(bytes, options) {
        const decoded = SchLibStreamExtractor.#inflateIfPossible(bytes).bytes

        return AsciiRecordParser.parse(
            SchLibStreamExtractor.#toArrayBuffer(decoded)
        ).map((record, recordIndex) => ({
            ...record,
            recordIndex,
            sourceStorage: options.sourceStorage,
            sourceStream: options.sourceStream
        }))
    }

    /**
     * Extracts a compressed or raw storage payload as an embedded asset.
     * @param {Uint8Array | undefined} bytes Storage stream bytes.
     * @param {string} sourceStream Source stream name.
     * @returns {object | null}
     */
    static #storageAsset(bytes, sourceStream) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return null
        }

        const decoded = SchLibStreamExtractor.#inflateIfPossible(bytes)

        return {
            sourceStream,
            name: SchLibStreamExtractor.#basename(sourceStream),
            format: SchLibStreamExtractor.#format(decoded.bytes),
            byteLength: decoded.bytes.byteLength,
            ...(decoded.compression
                ? { compression: decoded.compression }
                : {}),
            checksum: {
                algorithm: 'fnv1a32',
                value: SchLibStreamExtractor.#fnv1a32(decoded.bytes)
            }
        }
    }

    /**
     * Returns true when a stream is a known pin side stream.
     * @param {string} streamName Stream path.
     * @param {string} sourceStorage Symbol storage path.
     * @returns {boolean}
     */
    static #isKnownPinSidecar(streamName, sourceStorage) {
        return PIN_SIDECAR_STREAMS.some(
            (sidecarName) => streamName === sourceStorage + '/' + sidecarName
        )
    }

    /**
     * Builds recognized SchLib stream names from one stream listing.
     * @param {string[]} streamNames Native stream names.
     * @returns {string[]}
     */
    static #knownStreamNames(streamNames) {
        return (streamNames || []).filter((streamName) => {
            if (
                ['FileHeader', 'SectionKeys', 'Library/Data'].includes(
                    streamName
                )
            ) {
                return true
            }

            const leafName = String(streamName || '')
                .split('/')
                .at(-1)
            return (
                leafName === 'Data' ||
                leafName === 'Storage' ||
                PIN_SIDECAR_STREAMS.includes(leafName)
            )
        })
    }

    /**
     * Inflates zlib data when possible and otherwise returns the raw bytes.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {{ bytes: Uint8Array, compression?: string }}
     */
    static #inflateIfPossible(bytes) {
        try {
            return {
                bytes: Uint8Array.from(unzlibSync(bytes)),
                compression: 'zlib'
            }
        } catch (_error) {
            return { bytes }
        }
    }

    /**
     * Reads one field case-insensitively from a parsed record.
     * @param {object | undefined} fields Source fields.
     * @param {string} key Requested key.
     * @returns {string}
     */
    static #field(fields, key) {
        if (!fields) return ''
        if (fields[key] !== undefined) return String(fields[key] || '')
        const normalizedKey = key.toLowerCase()
        const matchedKey = Object.keys(fields).find(
            (candidate) => candidate.toLowerCase() === normalizedKey
        )

        return matchedKey ? String(fields[matchedKey] || '') : ''
    }

    /**
     * Resolves the terminal path segment.
     * @param {string} value Path-like stream name.
     * @returns {string}
     */
    static #basename(value) {
        return String(value || '')
            .split('/')
            .filter(Boolean)
            .pop()
    }

    /**
     * Classifies a compact embedded payload format.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #format(bytes) {
        if (SchLibStreamExtractor.#hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47])) {
            return 'png'
        }
        if (SchLibStreamExtractor.#hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
            return 'jpeg'
        }
        if (SchLibStreamExtractor.#asciiPrefix(bytes).startsWith('GIF')) {
            return 'gif'
        }
        if (SchLibStreamExtractor.#asciiPrefix(bytes).startsWith('BM')) {
            return 'bmp'
        }

        return 'binary'
    }

    /**
     * Returns true when bytes start with one prefix.
     * @param {Uint8Array} bytes Payload bytes.
     * @param {number[]} prefix Prefix bytes.
     * @returns {boolean}
     */
    static #hasPrefix(bytes, prefix) {
        return prefix.every((value, index) => bytes[index] === value)
    }

    /**
     * Reads a short Latin-1 prefix.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #asciiPrefix(bytes) {
        return new TextDecoder('latin1').decode(bytes.slice(0, 8))
    }

    /**
     * Computes a stable FNV-1a checksum.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #fnv1a32(bytes) {
        let hash = 0x811c9dc5

        for (const value of bytes) {
            hash ^= value
            hash = Math.imul(hash, 0x01000193) >>> 0
        }

        return hash.toString(16).padStart(8, '0')
    }

    /**
     * Removes undefined and empty-string values.
     * @param {object} row Source row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(
                ([, value]) => value !== undefined && value !== ''
            )
        )
    }

    /**
     * Returns an ArrayBuffer view over one byte slice.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {ArrayBuffer}
     */
    static #toArrayBuffer(bytes) {
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }
}
