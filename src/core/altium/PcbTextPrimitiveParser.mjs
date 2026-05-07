// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Decodes Altium PCB text primitive streams.
 */
export class PcbTextPrimitiveParser {
    static #TEXT_OBJECT_ID = 5

    static #TEXT_RECORD_MIN_BYTE_LENGTH = 64

    static #TEXT_RECORD_MAX_BYTE_LENGTH = 2048

    /**
     * Decodes one variable-length PCB text stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {{ wideStrings?: Map<number | string, string> | Record<string, string> | { byIndex?: Record<string, string> } }} [options]
     * @returns {{ text: string, x: number, y: number, height: number, layerId: number, ownerIndex: number | null, kind: number, visibilityFlags: number, rotation: number, strokeFontType?: number, strokeWidth?: number, fontType?: number, fontTypeName?: string, fontName?: string, fontFamily?: string, isBold?: boolean, isItalic?: boolean, fontWeight?: number, fontStyle?: string, wideStringIndex?: number, textSource?: string, role?: string, isDesignator?: boolean, componentIndex?: number }[]}
     */
    static parseTextStream(headerBytes, dataBytes, options = {}) {
        const count = PcbTextPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbTextPrimitiveParser.#toUint8Array(dataBytes)
        const wideStrings = PcbTextPrimitiveParser.#normalizeWideStrings(
            options.wideStrings
        )

        if (!count) {
            return []
        }

        let offset = 0
        const texts = []

        for (let index = 0; index < count; index += 1) {
            const record = PcbTextPrimitiveParser.#readTextRecordAt(
                normalizedData,
                offset,
                index === count - 1,
                wideStrings
            )

            if (!record) {
                return texts
            }

            if (record.text) {
                texts.push(record.text)
            }

            offset = record.nextOffset
        }

        return texts
    }

    /**
     * Reads one text record and its trailing string bytes at an offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {boolean} isLastRecord
     * @param {Map<string, string>} wideStrings
     * @returns {{ text: { text: string, x: number, y: number, height: number, layerId: number, ownerIndex: number | null, kind: number, visibilityFlags: number, rotation: number } | null, nextOffset: number } | null}
     */
    static #readTextRecordAt(bytes, offset, isLastRecord, wideStrings) {
        if (!PcbTextPrimitiveParser.#isTextRecordStart(bytes, offset)) {
            return null
        }

        const payloadLength = PcbTextPrimitiveParser.#readUint32FromBytes(
            bytes,
            offset + 1
        )
        const payloadOffset = offset + 5
        const payloadEnd = payloadOffset + payloadLength

        if (payloadEnd > bytes.byteLength) {
            return null
        }

        const nextOffset = isLastRecord
            ? bytes.byteLength
            : PcbTextPrimitiveParser.#findNextTextRecordOffset(
                  bytes,
                  payloadEnd
              )
        const text = PcbTextPrimitiveParser.#parseTextRecord(
            new DataView(
                bytes.buffer,
                bytes.byteOffset + payloadOffset,
                payloadLength
            ),
            bytes.slice(payloadEnd, nextOffset),
            wideStrings
        )

        return {
            text,
            nextOffset
        }
    }

    /**
     * Parses one fixed PCB text payload and its variable string tail.
     * @param {DataView} payload
     * @param {Uint8Array} textBytes
     * @param {Map<string, string>} wideStrings
     * @returns {{ text: string, x: number, y: number, height: number, layerId: number, ownerIndex: number | null, kind: number, visibilityFlags: number, rotation: number, strokeFontType?: number, strokeWidth?: number, fontType?: number, fontTypeName?: string, fontName?: string, fontFamily?: string, isBold?: boolean, isItalic?: boolean, fontWeight?: number, fontStyle?: string, wideStringIndex?: number, textSource?: string, role?: string, isDesignator?: boolean, componentIndex?: number } | null}
     */
    static #parseTextRecord(payload, textBytes, wideStrings) {
        if (
            payload.byteLength <
            PcbTextPrimitiveParser.#TEXT_RECORD_MIN_BYTE_LENGTH
        ) {
            return null
        }

        const extendedText =
            PcbTextPrimitiveParser.#parseExtendedTextFields(payload)
        const resolvedText = PcbTextPrimitiveParser.#resolveTextContent(
            PcbTextPrimitiveParser.#decodeTextBytes(textBytes),
            extendedText.wideStringIndex,
            wideStrings
        )

        if (!resolvedText.text) {
            return null
        }

        const ownerIndex = payload.getInt16(7, true)
        const normalizedOwnerIndex = ownerIndex === -1 ? null : ownerIndex
        const hasExtendedFontFields = payload.byteLength >= 110
        const visibilityFlags = hasExtendedFontFields
            ? 0
            : payload.getUint32(41, true)

        return {
            text: resolvedText.text,
            layerId: payload.getUint8(0),
            ownerIndex: normalizedOwnerIndex,
            x: PcbTextPrimitiveParser.#readMil(payload, 13),
            y: PcbTextPrimitiveParser.#readMil(payload, 17),
            height: PcbTextPrimitiveParser.#readMil(payload, 21),
            kind: hasExtendedFontFields
                ? payload.getUint16(25, true)
                : payload.getUint32(25, true),
            visibilityFlags,
            rotation: PcbTextPrimitiveParser.#resolveTextRotation(
                payload,
                visibilityFlags,
                hasExtendedFontFields
            ),
            ...extendedText,
            ...resolvedText.metadata,
            ...PcbTextPrimitiveParser.#parseTextRole(
                payload,
                normalizedOwnerIndex,
                hasExtendedFontFields
            )
        }
    }

    /**
     * Parses extended TrueType/barcode font metadata when the payload carries
     * the modern PCB text field block.
     * @param {DataView} payload
     * @returns {{ strokeFontType?: number, strokeWidth?: number, fontType?: number, fontTypeName?: string, fontName?: string, fontFamily?: string, isBold?: boolean, isItalic?: boolean, fontWeight?: number, fontStyle?: string, wideStringIndex?: number }}
     */
    static #parseExtendedTextFields(payload) {
        if (payload.byteLength < 110) {
            return {}
        }

        const fontType = payload.getUint8(43)
        const isBold = payload.getUint8(44) !== 0
        const isItalic = payload.getUint8(45) !== 0
        const fontName = PcbTextPrimitiveParser.#decodeFixedUtf16(
            payload,
            46,
            64
        )
        const extendedFields = {
            strokeFontType: payload.getUint16(25, true),
            strokeWidth: PcbTextPrimitiveParser.#readMil(payload, 36),
            fontType,
            fontTypeName: PcbTextPrimitiveParser.#fontTypeName(fontType),
            fontName,
            fontFamily:
                fontName ||
                PcbTextPrimitiveParser.#fallbackFontFamily(fontType),
            isBold,
            isItalic,
            fontWeight: isBold ? 700 : 400,
            fontStyle: isItalic ? 'italic' : 'normal'
        }

        if (payload.byteLength >= 119) {
            extendedFields.wideStringIndex = payload.getUint32(115, true)
        }

        return extendedFields
    }

    /**
     * Decodes one fixed-length UTF-16LE field from a payload view.
     * @param {DataView} payload
     * @param {number} offset
     * @param {number} byteLength
     * @returns {string}
     */
    static #decodeFixedUtf16(payload, offset, byteLength) {
        if (offset + byteLength > payload.byteLength) {
            return ''
        }

        return new TextDecoder('utf-16le')
            .decode(
                new Uint8Array(
                    payload.buffer,
                    payload.byteOffset + offset,
                    byteLength
                )
            )
            .replace(/\u0000+$/gu, '')
            .trim()
    }

    /**
     * Resolves inline text first, then WideStrings6 text-table references.
     * @param {string} inlineText
     * @param {number | undefined} wideStringIndex
     * @param {Map<string, string>} wideStrings
     * @returns {{ text: string, metadata: { textSource?: string } }}
     */
    static #resolveTextContent(inlineText, wideStringIndex, wideStrings) {
        if (inlineText) {
            return { text: inlineText, metadata: {} }
        }

        if (!Number.isInteger(wideStringIndex)) {
            return { text: '', metadata: {} }
        }

        const wideText = wideStrings.get(String(wideStringIndex)) || ''

        return wideText
            ? {
                  text: wideText,
                  metadata: { textSource: 'WideStrings6/Data' }
              }
            : { text: '', metadata: {} }
    }

    /**
     * Parses explicit modern Texts6 role metadata.
     * @param {DataView} payload
     * @param {number | null} ownerIndex
     * @param {boolean} hasExtendedFontFields
     * @returns {{ role?: string, isDesignator?: boolean, componentIndex?: number }}
     */
    static #parseTextRole(payload, ownerIndex, hasExtendedFontFields) {
        if (
            !hasExtendedFontFields ||
            payload.byteLength < 42 ||
            payload.getUint8(41) === 0 ||
            !Number.isInteger(ownerIndex)
        ) {
            return {}
        }

        return {
            role: 'designator',
            isDesignator: true,
            componentIndex: ownerIndex
        }
    }

    /**
     * Resolves a public label for one PCB text font type.
     * @param {number} fontType
     * @returns {'Stroke' | 'TrueType' | 'BarCode' | 'Unknown'}
     */
    static #fontTypeName(fontType) {
        return (
            {
                0: 'Stroke',
                1: 'TrueType',
                2: 'BarCode'
            }[Number(fontType)] || 'Unknown'
        )
    }

    /**
     * Returns a generic fallback family for text records without a font name.
     * @param {number} fontType
     * @returns {string}
     */
    static #fallbackFontFamily(fontType) {
        return Number(fontType) === 0 ? 'Stroke' : 'Arial'
    }

    /**
     * Decodes the printable text payload that trails a fixed text record.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #decodeTextBytes(bytes) {
        const start = bytes.findIndex((byte) => byte >= 0x20 && byte <= 0x7e)

        if (start < 0) {
            return ''
        }

        return new TextDecoder()
            .decode(bytes.slice(start))
            .replace(/\u0000/gu, '')
            .replace(/\r\n?/gu, '\n')
            .replace(/^[\u0000-\u001f\u007f-\u009f]+/gu, '')
            .trim()
    }

    /**
     * Finds the next length-prefixed PCB text record after one string tail.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #findNextTextRecordOffset(bytes, offset) {
        for (let cursor = offset; cursor < bytes.byteLength - 5; cursor += 1) {
            if (PcbTextPrimitiveParser.#isTextRecordStart(bytes, cursor)) {
                return cursor
            }
        }

        return bytes.byteLength
    }

    /**
     * Returns true when a byte offset looks like a text record boundary.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {boolean}
     */
    static #isTextRecordStart(bytes, offset) {
        if (offset + 5 > bytes.byteLength) {
            return false
        }

        if (bytes[offset] !== PcbTextPrimitiveParser.#TEXT_OBJECT_ID) {
            return false
        }

        const payloadLength = PcbTextPrimitiveParser.#readUint32FromBytes(
            bytes,
            offset + 1
        )
        const payloadEnd = offset + 5 + payloadLength

        return (
            payloadLength >=
                PcbTextPrimitiveParser.#TEXT_RECORD_MIN_BYTE_LENGTH &&
            payloadLength <=
                PcbTextPrimitiveParser.#TEXT_RECORD_MAX_BYTE_LENGTH &&
            payloadEnd <= bytes.byteLength
        )
    }

    /**
     * Resolves the text rotation encoded in the visibility/options bit field.
     * @param {number} visibilityFlags
     * @returns {number}
     */
    static #textRotationFromFlags(visibilityFlags) {
        return (Number(visibilityFlags) & 0x00010000) !== 0 ? 90 : 0
    }

    /**
     * Resolves text rotation from modern double fields with legacy flag
     * fallback.
     * @param {DataView} payload
     * @param {number} visibilityFlags
     * @param {boolean} hasExtendedFontFields
     * @returns {number}
     */
    static #resolveTextRotation(
        payload,
        visibilityFlags,
        hasExtendedFontFields
    ) {
        if (hasExtendedFontFields && payload.byteLength >= 35) {
            const rotation = payload.getFloat64(27, true)
            if (Number.isFinite(rotation) && Math.abs(rotation) > 0.000001) {
                return rotation
            }
        }

        return PcbTextPrimitiveParser.#textRotationFromFlags(visibilityFlags)
    }

    /**
     * Normalizes supported WideStrings6 lookup shapes into a string-keyed map.
     * @param {Map<number | string, string> | Record<string, string> | { byIndex?: Record<string, string> } | undefined} wideStrings
     * @returns {Map<string, string>}
     */
    static #normalizeWideStrings(wideStrings) {
        const normalized = new Map()
        const lookup = wideStrings?.byIndex || wideStrings || {}

        if (lookup instanceof Map) {
            for (const [index, text] of lookup.entries()) {
                normalized.set(String(index), String(text || ''))
            }
            return normalized
        }

        for (const [index, text] of Object.entries(lookup)) {
            normalized.set(String(index), String(text || ''))
        }

        return normalized
    }

    /**
     * Reads one little-endian record count from a binary stream header.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @returns {number}
     */
    static #readRecordCount(headerBytes) {
        const normalizedHeader =
            PcbTextPrimitiveParser.#toUint8Array(headerBytes)

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
     * Reads one little-endian unsigned integer from a byte view.
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
     * Reads one signed fixed-point mil coordinate.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readMil(view, offset) {
        return view.getInt32(offset, true) / 10000
    }

    /**
     * Normalizes one byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }
}
