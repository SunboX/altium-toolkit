// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbBinaryPrimitiveParser } from './PcbBinaryPrimitiveParser.mjs'
import { PcbCustomPadShapeParser } from './PcbCustomPadShapeParser.mjs'
import { PcbEmbeddedFontExtractor } from './PcbEmbeddedFontExtractor.mjs'
import { PcbEmbeddedModelExtractor } from './PcbEmbeddedModelExtractor.mjs'
import { PcbExtendedPrimitiveInformationParser } from './PcbExtendedPrimitiveInformationParser.mjs'
import { PcbLibStorageNameResolver } from './PcbLibStorageNameResolver.mjs'
import { NativeStreamInventoryBuilder } from './NativeStreamInventoryBuilder.mjs'
import { PcbRawRecordRegistry } from './PcbRawRecordRegistry.mjs'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { OleConstants } from '../ole/OleConstants.mjs'

/**
 * Extracts footprint-oriented content from OLE-backed Altium PcbLib files.
 */
export class PcbLibStreamExtractor {
    static #FOOTPRINT_RECORD_TYPES = {
        1: {
            type: 'arc',
            collection: 'arcs',
            minimumSubrecordCount: 1,
            minimumPayloadByteLength: 45,
            parser: 'parseArcStream'
        },
        2: {
            type: 'pad',
            collection: 'pads',
            minimumSubrecordCount: 6,
            validatedSubrecordIndex: 4,
            minimumPayloadByteLength: 61,
            parser: 'parsePadStream'
        },
        3: {
            type: 'via',
            collection: 'vias',
            minimumSubrecordCount: 1,
            minimumPayloadByteLength: 209,
            parser: 'parseViaStream'
        },
        4: {
            type: 'track',
            collection: 'tracks',
            minimumSubrecordCount: 1,
            minimumPayloadByteLength: 33,
            parser: 'parseTrackStream'
        },
        5: {
            type: 'text',
            collection: 'texts',
            minimumSubrecordCount: 2,
            validatedSubrecordIndex: 0,
            minimumPayloadByteLength: 64,
            parser: 'parseTextStream'
        },
        6: {
            type: 'fill',
            collection: 'fills',
            minimumSubrecordCount: 1,
            minimumPayloadByteLength: 50,
            parser: 'parseFillStream'
        },
        11: {
            type: 'region',
            collection: 'regions',
            minimumSubrecordCount: 1,
            minimumPayloadByteLength: 18,
            parser: 'parseRegionStream'
        }
    }

    /**
     * Returns true when one buffer starts with the OLE compound-document
     * signature.
     * @param {ArrayBuffer} arrayBuffer
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
     * Extracts PcbLib content directly from one OLE-backed buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ libraryHeader: Record<string, string>, componentParamsToc: Record<string, object>, sectionKeys: Record<string, string>, footprints: object[], streamNames: string[], diagnostics: Record<string, number> } | null}
     */
    static extractFromArrayBuffer(arrayBuffer) {
        if (!PcbLibStreamExtractor.isCompoundDocument(arrayBuffer)) {
            return null
        }

        const compoundDocument =
            OleCompoundDocument.fromArrayBuffer(arrayBuffer)
        const streams = new Map()

        for (const name of compoundDocument.listStreams()) {
            streams.set(name, compoundDocument.getStream(name))
        }

        return PcbLibStreamExtractor.extractFromStreams(streams)
    }

    /**
     * Extracts all declared footprints from one PcbLib stream map.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ libraryHeader: Record<string, string>, componentParamsToc: Record<string, object>, sectionKeys: Record<string, string>, footprints: object[], streamNames: string[], diagnostics: Record<string, number | object[]> }}
     */
    static extractFromStreams(streams) {
        const libraryData = streams.get('Library/Data') || new Uint8Array()
        const parsedLibraryData =
            PcbLibStreamExtractor.#parseLibraryData(libraryData)
        const componentParamsToc =
            PcbLibStreamExtractor.#parseComponentParamsToc(
                streams.get('Library/ComponentParamsTOC/Data')
            )
        const sectionKeys = PcbLibStorageNameResolver.parseSectionKeys(
            streams.get('SectionKeys')
        )
        const storageResolution = PcbLibStorageNameResolver.resolveFootprints(
            streams,
            parsedLibraryData.footprintNames,
            sectionKeys
        )
        const footprints = storageResolution.resolvedFootprints.map(
            ({ name, storageName }) =>
                PcbLibStreamExtractor.#extractFootprint(
                    streams,
                    name,
                    storageName,
                    componentParamsToc[name] || {}
                )
        )
        const missingFootprints = storageResolution.missingFootprints
        const primitiveCount = footprints.reduce(
            (sum, footprint) => sum + footprint.primitiveCount,
            0
        )
        const rawRecordCount = footprints.reduce(
            (sum, footprint) => sum + footprint.rawRecords.length,
            0
        )
        const embeddedFonts =
            PcbEmbeddedFontExtractor.extractFromStreams(streams)
        const embeddedModels =
            PcbEmbeddedModelExtractor.extractFromStreams(streams)
        const usedStreamNames = PcbLibStreamExtractor.#collectUsedStreamNames(
            footprints,
            streams,
            embeddedFonts,
            embeddedModels
        )
        const nativeStreams = NativeStreamInventoryBuilder.buildFromStreams(
            streams,
            {
                source: 'pcblib',
                consumedStreamNames: usedStreamNames,
                knownStreamNames:
                    PcbLibStreamExtractor.#knownStreamNames(streams)
            }
        )

        return {
            libraryHeader: parsedLibraryData.libraryHeader,
            componentParamsToc,
            sectionKeys,
            footprints,
            streamNames: usedStreamNames,
            nativeStreams,
            embeddedFonts,
            embeddedModels,
            diagnostics: {
                declaredFootprintCount: parsedLibraryData.footprintNames.length,
                footprintCount: footprints.length,
                primitiveCount,
                rawRecordCount,
                embeddedFontCount: embeddedFonts.fonts.length,
                embeddedModelCount: embeddedModels.models.length,
                componentBodyCount: embeddedModels.componentBodies.length,
                missingFootprintCount: missingFootprints.length,
                ...(missingFootprints.length ? { missingFootprints } : {})
            }
        }
    }

    /**
     * Parses one PcbLib Library/Data stream.
     * @param {Uint8Array} bytes
     * @returns {{ libraryHeader: Record<string, string>, footprintNames: string[] }}
     */
    static #parseLibraryData(bytes) {
        const header = PcbLibStreamExtractor.#readLengthPrefixedTextAt(bytes, 0)
        const libraryHeader = header
            ? PcbLibStreamExtractor.#parsePipeProperties(header.text)
            : {}
        let offset = header ? header.nextOffset : 0

        if (offset + 4 > bytes.byteLength) {
            return { libraryHeader, footprintNames: [] }
        }

        const count = PcbLibStreamExtractor.#readUint32(bytes, offset)
        offset += 4

        const footprintNames = []
        for (let index = 0; index < count; index += 1) {
            const block = PcbLibStreamExtractor.#readStringBlockAt(
                bytes,
                offset
            )
            if (!block) {
                break
            }
            footprintNames.push(block.text)
            offset = block.nextOffset
        }

        return { libraryHeader, footprintNames }
    }

    /**
     * Parses the optional ComponentParamsTOC stream into entries keyed by name.
     * @param {Uint8Array | undefined} bytes
     * @returns {Record<string, { name: string, padCount: number, height: string, description: string, properties: Record<string, string> }>}
     */
    static #parseComponentParamsToc(bytes) {
        const entries = {}
        let offset = 0

        while (bytes && offset + 4 <= bytes.byteLength) {
            const record = PcbLibStreamExtractor.#readLengthPrefixedTextAt(
                bytes,
                offset
            )
            if (!record) {
                break
            }

            const properties = PcbLibStreamExtractor.#parsePipeProperties(
                record.text
            )
            const name = properties.Name || properties.NAME || ''
            if (name) {
                entries[name] = {
                    name,
                    padCount: Number(
                        properties['Pad Count'] || properties.PADCOUNT || 0
                    ),
                    height: properties.Height || properties.HEIGHT || '',
                    description:
                        properties.Description || properties.DESCRIPTION || '',
                    properties
                }
            }

            offset = record.nextOffset
        }

        return entries
    }

    /**
     * Extracts one footprint storage into normalized primitive lists.
     * @param {Map<string, Uint8Array>} streams
     * @param {string} name
     * @param {string} storageName
     * @param {object} componentParams
     * @returns {object}
     */
    static #extractFootprint(streams, name, storageName, componentParams) {
        const declaredPrimitiveCount = PcbLibStreamExtractor.#readCountHeader(
            streams.get(storageName + '/Header')
        )
        const parameters = PcbLibStreamExtractor.#parsePropertyStream(
            streams.get(storageName + '/Parameters')
        )
        const wideStrings = PcbLibStreamExtractor.#parseWideStrings(
            streams.get(storageName + '/WideStrings')
        )
        const extendedPrimitiveInformation =
            PcbExtendedPrimitiveInformationParser.parse(
                PcbLibStreamExtractor.#firstStream(streams, [
                    storageName + '/ExtendedPrimitiveInformation/Data',
                    storageName + '/ExtendedPrimitiveInformation'
                ]),
                storageName + '/ExtendedPrimitiveInformation/Data'
            )
        const customPadShapes = PcbCustomPadShapeParser.parse(
            PcbLibStreamExtractor.#firstStream(streams, [
                storageName + '/CustomShapes/Data',
                storageName + '/CustomShapes'
            ]),
            storageName + '/CustomShapes/Data'
        )
        const parsedData = PcbLibStreamExtractor.#parseFootprintData(
            streams.get(storageName + '/Data') || new Uint8Array(),
            declaredPrimitiveCount,
            wideStrings,
            storageName
        )

        return {
            name,
            dataName: parsedData.dataName || name,
            sourceStorage: storageName,
            declaredPrimitiveCount,
            parameters,
            componentParams,
            wideStrings,
            primitiveCount: parsedData.primitiveOrder.length,
            primitiveOrder: parsedData.primitiveOrder,
            unknownRecords: parsedData.unknownRecords,
            rawRecords: parsedData.rawRecords,
            pads: parsedData.pads,
            tracks: parsedData.tracks,
            arcs: parsedData.arcs,
            vias: parsedData.vias,
            fills: parsedData.fills,
            texts: parsedData.texts,
            regions: parsedData.regions,
            extendedPrimitiveInformation,
            customPadShapes
        }
    }

    /**
     * Returns the first present stream from a candidate list.
     * @param {Map<string, Uint8Array>} streams Stream map.
     * @param {string[]} candidates Candidate stream names.
     * @returns {Uint8Array | undefined}
     */
    static #firstStream(streams, candidates) {
        return candidates.map((name) => streams.get(name)).find(Boolean)
    }

    /**
     * Parses one footprint Data stream after its leading name block.
     * @param {Uint8Array} bytes
     * @param {number} declaredPrimitiveCount
     * @param {Record<number, string>} wideStrings
     * @param {string} sourceStorage
     * @returns {{ dataName: string, primitiveOrder: object[], unknownRecords: object[], rawRecords: object[], pads: object[], tracks: object[], arcs: object[], vias: object[], fills: object[], texts: object[], regions: object[] }}
     */
    static #parseFootprintData(
        bytes,
        declaredPrimitiveCount,
        wideStrings,
        sourceStorage
    ) {
        const collections = PcbLibStreamExtractor.#createPrimitiveCollections()
        const dataName = PcbLibStreamExtractor.#readStringBlockAt(bytes, 0)
        let offset = dataName ? dataName.nextOffset : 0
        let parsedCount = 0

        while (
            offset < bytes.byteLength &&
            (!declaredPrimitiveCount || parsedCount < declaredPrimitiveCount)
        ) {
            if (bytes[offset] === 0) {
                break
            }

            const remainingCount = declaredPrimitiveCount
                ? declaredPrimitiveCount - parsedCount - 1
                : null
            const record = PcbLibStreamExtractor.#readFootprintRecordAt(
                bytes,
                offset,
                remainingCount
            )

            if (!record) {
                break
            }

            PcbLibStreamExtractor.#appendFootprintRecord(
                collections,
                record,
                wideStrings,
                sourceStorage,
                parsedCount
            )
            offset += record.byteLength
            parsedCount += 1
        }

        return {
            dataName: dataName?.text || '',
            ...collections
        }
    }

    /**
     * Creates the mutable primitive collection object used while parsing one
     * footprint.
     * @returns {{ primitiveOrder: object[], unknownRecords: object[], rawRecords: object[], pads: object[], tracks: object[], arcs: object[], vias: object[], fills: object[], texts: object[], regions: object[] }}
     */
    static #createPrimitiveCollections() {
        return {
            primitiveOrder: [],
            unknownRecords: [],
            rawRecords: [],
            pads: [],
            tracks: [],
            arcs: [],
            vias: [],
            fills: [],
            texts: [],
            regions: []
        }
    }

    /**
     * Reads one mixed-format PcbLib footprint record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number | null} remainingCount
     * @returns {{ typeId: number, descriptor: object | null, recordBytes: Uint8Array, byteLength: number, offset: number } | null}
     */
    static #readFootprintRecordAt(bytes, offset, remainingCount) {
        if (offset >= bytes.byteLength) {
            return null
        }

        const typeId = bytes[offset]
        const descriptor =
            PcbLibStreamExtractor.#FOOTPRINT_RECORD_TYPES[typeId] || null

        if (!descriptor) {
            return {
                typeId,
                descriptor: null,
                recordBytes: bytes.slice(offset, offset + 1),
                byteLength: 1,
                offset
            }
        }

        const minimumEnd = PcbLibStreamExtractor.#readMinimumRecordEnd(
            bytes,
            offset,
            descriptor
        )

        if (!minimumEnd) {
            return {
                typeId,
                descriptor: null,
                recordBytes: bytes.slice(offset, offset + 1),
                byteLength: 1,
                offset
            }
        }

        const nextRecordOffset =
            remainingCount && remainingCount > 0
                ? PcbLibStreamExtractor.#findNextKnownRecordOffset(
                      bytes,
                      minimumEnd
                  )
                : null
        const endOffset = nextRecordOffset || minimumEnd

        return {
            typeId,
            descriptor,
            recordBytes: bytes.slice(offset, endOffset),
            byteLength: endOffset - offset,
            offset
        }
    }

    /**
     * Reads the minimum byte boundary for a known footprint record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {{ minimumSubrecordCount: number, minimumPayloadByteLength: number, validatedSubrecordIndex?: number }} descriptor
     * @returns {number | null}
     */
    static #readMinimumRecordEnd(bytes, offset, descriptor) {
        let cursor = offset + 1

        for (
            let subrecordIndex = 0;
            subrecordIndex < descriptor.minimumSubrecordCount;
            subrecordIndex += 1
        ) {
            const subrecord = PcbLibStreamExtractor.#readSubrecordAt(
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
     * Finds the next plausible known primitive record after optional extra
     * subrecords attached to the current primitive.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number | null}
     */
    static #findNextKnownRecordOffset(bytes, offset) {
        let cursor = offset

        while (cursor < bytes.byteLength) {
            if (PcbLibStreamExtractor.#isKnownRecordStart(bytes, cursor)) {
                return cursor
            }

            const unknownSubrecord = PcbLibStreamExtractor.#readSubrecordAt(
                bytes,
                cursor
            )
            if (unknownSubrecord && unknownSubrecord.nextOffset > cursor) {
                cursor = unknownSubrecord.nextOffset
                continue
            }

            cursor += 1
        }

        return null
    }

    /**
     * Returns true when an offset can start a known footprint primitive record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {boolean}
     */
    static #isKnownRecordStart(bytes, offset) {
        const descriptor =
            PcbLibStreamExtractor.#FOOTPRINT_RECORD_TYPES[bytes[offset]]

        return Boolean(
            descriptor &&
            PcbLibStreamExtractor.#readMinimumRecordEnd(
                bytes,
                offset,
                descriptor
            )
        )
    }

    /**
     * Appends one parsed record to the appropriate footprint primitive list.
     * @param {object} collections
     * @param {{ typeId: number, descriptor: object | null, recordBytes: Uint8Array, offset: number, byteLength: number }} record
     * @param {Record<number, string>} wideStrings
     * @param {string} sourceStorage
     * @param {number} recordIndex
     */
    static #appendFootprintRecord(
        collections,
        record,
        wideStrings,
        sourceStorage,
        recordIndex
    ) {
        if (!record.descriptor) {
            collections.rawRecords.push(
                PcbRawRecordRegistry.createPcbLibRecord({
                    sourceStorage,
                    record,
                    recordIndex,
                    parsed: false
                })
            )
            collections.unknownRecords.push({
                typeId: record.typeId,
                offset: record.offset,
                byteLength: record.byteLength
            })
            return
        }

        const primitives = PcbLibStreamExtractor.#parsePrimitiveRecord(
            record,
            wideStrings
        )

        if (!primitives.length) {
            collections.rawRecords.push(
                PcbRawRecordRegistry.createPcbLibRecord({
                    sourceStorage,
                    record,
                    recordIndex,
                    parsed: false
                })
            )
            collections.unknownRecords.push({
                typeId: record.typeId,
                offset: record.offset,
                byteLength: record.byteLength
            })
            return
        }

        collections.rawRecords.push(
            PcbRawRecordRegistry.createPcbLibRecord({
                sourceStorage,
                record,
                recordIndex,
                parsed: true
            })
        )

        for (const primitive of primitives) {
            const collection = collections[record.descriptor.collection]
            const index = collection.length
            collection.push(primitive)
            collections.primitiveOrder.push({
                type: record.descriptor.type,
                collection: record.descriptor.collection,
                index
            })
        }
    }

    /**
     * Parses one primitive record using the existing PcbDoc binary primitive
     * parsers with an artificial one-record header.
     * @param {{ descriptor: { parser: string }, recordBytes: Uint8Array }} record
     * @param {Record<number, string>} wideStrings
     * @returns {object[]}
     */
    static #parsePrimitiveRecord(record, wideStrings) {
        const headerBytes = PcbLibStreamExtractor.#createCountHeader(1)
        const parser = PcbBinaryPrimitiveParser[record.descriptor.parser]
        const primitives = parser.call(
            PcbBinaryPrimitiveParser,
            headerBytes,
            record.recordBytes
        )

        if (record.descriptor.type === 'text') {
            return primitives.map((primitive) =>
                PcbLibStreamExtractor.#resolveTextWideString(
                    primitive,
                    wideStrings
                )
            )
        }

        return primitives
    }

    /**
     * Resolves text through the footprint WideStrings table when the parser
     * exposes a numeric text index.
     * @param {object} primitive
     * @param {Record<number, string>} wideStrings
     * @returns {object}
     */
    static #resolveTextWideString(primitive, wideStrings) {
        const wideText = wideStrings[primitive.wideStringIndex]

        return wideText ? { ...primitive, text: wideText } : primitive
    }

    /**
     * Parses one length-prefixed property stream.
     * @param {Uint8Array | undefined} bytes
     * @returns {Record<string, string>}
     */
    static #parsePropertyStream(bytes) {
        if (!bytes) {
            return {}
        }

        const record = PcbLibStreamExtractor.#readLengthPrefixedTextAt(bytes, 0)

        return record
            ? PcbLibStreamExtractor.#parsePipeProperties(record.text)
            : {}
    }

    /**
     * Parses one PcbLib WideStrings stream.
     * @param {Uint8Array | undefined} bytes
     * @returns {Record<number, string>}
     */
    static #parseWideStrings(bytes) {
        const properties = PcbLibStreamExtractor.#parsePropertyStream(bytes)
        const wideStrings = {}

        for (const [key, value] of Object.entries(properties)) {
            const match = key.match(/^ENCODEDTEXT(\d+)$/u)
            if (!match) {
                continue
            }
            wideStrings[Number(match[1])] =
                PcbLibStreamExtractor.#decodeCsvCharCodes(value)
        }

        return wideStrings
    }

    /**
     * Parses pipe-delimited Altium properties.
     * @param {string} text
     * @returns {Record<string, string>}
     */
    static #parsePipeProperties(text) {
        const properties = {}

        for (const part of String(text || '')
            .replace(/\u0000+$/u, '')
            .split('|')) {
            const separator = part.indexOf('=')
            if (separator <= 0) {
                continue
            }
            properties[part.slice(0, separator)] = part
                .slice(separator + 1)
                .replace(/\r?\n$/u, '')
        }

        return properties
    }

    /**
     * Decodes comma-separated character codes into text.
     * @param {string} value
     * @returns {string}
     */
    static #decodeCsvCharCodes(value) {
        return String(value || '')
            .split(',')
            .filter(Boolean)
            .map((part) => String.fromCharCode(Number(part)))
            .join('')
    }

    /**
     * Reads one length-prefixed UTF-8/ASCII text block.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ text: string, nextOffset: number } | null}
     */
    static #readLengthPrefixedTextAt(bytes, offset) {
        if (!bytes || offset + 4 > bytes.byteLength) {
            return null
        }

        const byteLength = PcbLibStreamExtractor.#readUint32(bytes, offset)
        const payloadOffset = offset + 4
        const nextOffset = payloadOffset + byteLength

        if (nextOffset > bytes.byteLength) {
            return null
        }

        return {
            text: new TextDecoder().decode(
                bytes.slice(payloadOffset, nextOffset)
            ),
            nextOffset
        }
    }

    /**
     * Reads one PCB string block with a four-byte block length and Pascal text
     * payload.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ text: string, nextOffset: number } | null}
     */
    static #readStringBlockAt(bytes, offset) {
        if (!bytes || offset + 5 > bytes.byteLength) {
            return null
        }

        const blockByteLength = PcbLibStreamExtractor.#readUint32(bytes, offset)
        const payloadOffset = offset + 4
        const nextOffset = payloadOffset + blockByteLength

        if (blockByteLength < 1 || nextOffset > bytes.byteLength) {
            return null
        }

        const textByteLength = Math.min(
            bytes[payloadOffset],
            blockByteLength - 1
        )

        return {
            text: new TextDecoder().decode(
                bytes.slice(
                    payloadOffset + 1,
                    payloadOffset + 1 + textByteLength
                )
            ),
            nextOffset
        }
    }

    /**
     * Reads one length-prefixed primitive subrecord at an offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ payloadByteLength: number, payloadOffset: number, nextOffset: number } | null}
     */
    static #readSubrecordAt(bytes, offset) {
        if (offset + 4 > bytes.byteLength) {
            return null
        }

        const payloadByteLength = PcbLibStreamExtractor.#readUint32(
            bytes,
            offset
        )
        const payloadOffset = offset + 4
        const nextOffset = payloadOffset + payloadByteLength

        if (nextOffset > bytes.byteLength) {
            return null
        }

        return { payloadByteLength, payloadOffset, nextOffset }
    }

    /**
     * Reads one count from a four-byte Header stream.
     * @param {Uint8Array | undefined} bytes
     * @returns {number}
     */
    static #readCountHeader(bytes) {
        if (!bytes || bytes.byteLength < 4) {
            return 0
        }

        return PcbLibStreamExtractor.#readUint32(bytes, 0)
    }

    /**
     * Creates one little-endian four-byte count header.
     * @param {number} count
     * @returns {Uint8Array}
     */
    static #createCountHeader(count) {
        const bytes = new Uint8Array(4)
        new DataView(bytes.buffer).setUint32(0, count, true)
        return bytes
    }

    /**
     * Returns all stream names that contributed to the extraction.
     * @param {object[]} footprints
     * @param {Map<string, Uint8Array>} streams
     * @param {{ fonts?: { sourceStream: string }[] }} embeddedFonts
     * @param {{ models?: { sourceStream: string }[], componentBodies?: { sourceStream: string }[] }} embeddedModels
     * @returns {string[]}
     */
    static #collectUsedStreamNames(
        footprints,
        streams,
        embeddedFonts,
        embeddedModels
    ) {
        const names = new Set()

        for (const baseName of [
            'Library/Data',
            'Library/ComponentParamsTOC/Data',
            'SectionKeys'
        ]) {
            if (streams.has(baseName)) {
                names.add(baseName)
            }
        }

        for (const footprint of footprints) {
            for (const suffix of [
                'Header',
                'Data',
                'Parameters',
                'WideStrings',
                'ExtendedPrimitiveInformation/Data',
                'ExtendedPrimitiveInformation',
                'CustomShapes/Data',
                'CustomShapes'
            ]) {
                const name = footprint.sourceStorage + '/' + suffix
                if (streams.has(name)) {
                    names.add(name)
                }
            }
        }

        for (const font of embeddedFonts.fonts || []) {
            if (streams.has(font.sourceStream)) {
                names.add(font.sourceStream)
            }
        }

        for (const model of embeddedModels.models || []) {
            if (streams.has(model.sourceStream)) {
                names.add(model.sourceStream)
            }
        }

        for (const componentBody of embeddedModels.componentBodies || []) {
            if (streams.has(componentBody.sourceStream)) {
                names.add(componentBody.sourceStream)
            }
        }

        return [...names].sort((left, right) => left.localeCompare(right))
    }

    /**
     * Builds recognized PcbLib stream names from one stream map.
     * @param {Map<string, Uint8Array>} streams Native stream map.
     * @returns {string[]}
     */
    static #knownStreamNames(streams) {
        return [...(streams || new Map()).keys()].filter((streamName) => {
            if (
                [
                    'Library/Data',
                    'Library/ComponentParamsTOC/Data',
                    'SectionKeys'
                ].includes(streamName)
            ) {
                return true
            }

            const leafName = String(streamName || '')
                .split('/')
                .at(-1)
            return [
                'Header',
                'Data',
                'Parameters',
                'WideStrings',
                'ExtendedPrimitiveInformation',
                'CustomShapes'
            ].includes(leafName)
        })
    }

    /**
     * Reads a little-endian unsigned 32-bit value from one byte array.
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
}
