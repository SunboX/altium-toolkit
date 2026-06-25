// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Extracts long printable runs from binary Altium documents.
 */
export class PrintableTextDecoder {
    static #decoderCache = new Map()
    static #decoderConstructor = null

    static #WINDOWS_1252_PRINTABLE_CONTROL_BYTES = new Set([
        0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c,
        0x8e, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b,
        0x9c, 0x9e, 0x9f
    ])

    static #WINDOWS_1252_CONTROL_CODE_POINTS = new Map([
        [0x80, 0x20ac],
        [0x82, 0x201a],
        [0x83, 0x0192],
        [0x84, 0x201e],
        [0x85, 0x2026],
        [0x86, 0x2020],
        [0x87, 0x2021],
        [0x88, 0x02c6],
        [0x89, 0x2030],
        [0x8a, 0x0160],
        [0x8b, 0x2039],
        [0x8c, 0x0152],
        [0x8e, 0x017d],
        [0x91, 0x2018],
        [0x92, 0x2019],
        [0x93, 0x201c],
        [0x94, 0x201d],
        [0x95, 0x2022],
        [0x96, 0x2013],
        [0x97, 0x2014],
        [0x98, 0x02dc],
        [0x99, 0x2122],
        [0x9a, 0x0161],
        [0x9b, 0x203a],
        [0x9c, 0x0153],
        [0x9e, 0x017e],
        [0x9f, 0x0178]
    ])

    /**
     * Returns printable ASCII-like runs from a binary buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @param {{ minLength?: number }} [options]
     * @returns {string[]}
     */
    static extractRuns(arrayBuffer, options = {}) {
        return PrintableTextDecoder.extractRunBytes(arrayBuffer, options).map(
            (runBytes) =>
                PrintableTextDecoder.#normalizeRun(
                    PrintableTextDecoder.decodeBytes(runBytes)
                )
        )
    }

    /**
     * Returns printable byte runs from a binary buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @param {{ minLength?: number }} [options]
     * @returns {Uint8Array[]}
     */
    static extractRunBytes(arrayBuffer, options = {}) {
        const minLength = Number(options.minLength) || 24
        const bytes = new Uint8Array(arrayBuffer)
        const runs = []
        let start = -1

        for (let index = 0; index < bytes.length; index += 1) {
            if (PrintableTextDecoder.#isPrintableByte(bytes[index])) {
                if (start === -1) {
                    start = index
                }
                continue
            }

            if (start !== -1) {
                PrintableTextDecoder.#pushRunBytes(
                    runs,
                    bytes,
                    start,
                    index,
                    minLength
                )
                start = -1
            }
        }

        if (start !== -1) {
            PrintableTextDecoder.#pushRunBytes(
                runs,
                bytes,
                start,
                bytes.length,
                minLength
            )
        }

        return runs
    }

    /**
     * Decodes one byte slice using UTF-8 first, then Windows-1252 or GB18030
     * for non-UTF-8 payloads such as legacy PCB library text.
     * @param {Uint8Array} bytes
     * @param {{ encoding?: string }} [options]
     * @returns {string}
     */
    static decodeBytes(bytes, options = {}) {
        const preferredEncoding = String(options.encoding || '').toLowerCase()

        if (preferredEncoding === 'utf-8') {
            return (
                PrintableTextDecoder.#tryDecode(bytes, 'utf-8') ||
                PrintableTextDecoder.#decode(bytes, 'utf-8')
            )
        }
        if (
            preferredEncoding === 'windows-1252' ||
            preferredEncoding === 'cp1252'
        ) {
            return (
                PrintableTextDecoder.#tryDecodeWindows1252(bytes) ||
                PrintableTextDecoder.#decode(bytes, 'utf-8')
            )
        }

        const utf8 = PrintableTextDecoder.#tryDecode(bytes, 'utf-8')
        if (utf8 !== null) {
            return utf8
        }

        if (PrintableTextDecoder.#hasWindows1252PreferredBytes(bytes)) {
            const windows1252 =
                PrintableTextDecoder.#tryDecodeWindows1252(bytes)
            if (windows1252 !== null) {
                return windows1252
            }
        }

        return (
            PrintableTextDecoder.#tryDecode(bytes, 'gb18030') ||
            PrintableTextDecoder.#tryDecodeWindows1252(bytes) ||
            PrintableTextDecoder.#decode(bytes, 'utf-8')
        )
    }

    /**
     * Normalizes one printable byte slice and appends it if meaningful.
     * @param {string[]} runs
     * @param {Uint8Array} bytes
     * @param {number} start
     * @param {number} end
     * @param {number} minLength
     */
    static #pushRunBytes(runs, bytes, start, end, minLength) {
        const bounds = PrintableTextDecoder.#trimAsciiByteRange(
            bytes,
            start,
            end
        )
        const length = bounds.end - bounds.start
        if (length < minLength) return

        if (
            !PrintableTextDecoder.#containsRecordDelimiterBytes(
                bytes,
                bounds.start,
                bounds.end
            )
        ) {
            return
        }

        runs.push(bytes.slice(start, end))
    }

    /**
     * Returns true for bytes commonly preserved in printable record runs.
     * @param {number} value
     * @returns {boolean}
     */
    static #isPrintableByte(value) {
        return (
            value === 9 ||
            value === 10 ||
            value === 13 ||
            (value >= 32 && value <= 126) ||
            value >= 128
        )
    }

    /**
     * Returns one normalized printable run.
     * @param {string} raw
     * @returns {string}
     */
    static #normalizeRun(raw) {
        return raw
            .replace(/\r/g, '\n')
            .replace(/\n{2,}/g, '\n')
            .trim()
    }

    /**
     * Returns true when bytes contain printable Windows-1252 control-range
     * punctuation that can otherwise be misread as GB18030 pairs.
     * @param {Uint8Array} bytes
     * @returns {boolean}
     */
    static #hasWindows1252PreferredBytes(bytes) {
        for (let index = 0; index < bytes.length; index += 1) {
            const byte = bytes[index]
            if (
                PrintableTextDecoder.#WINDOWS_1252_PRINTABLE_CONTROL_BYTES.has(
                    byte
                )
            ) {
                return true
            }

            if (
                byte >= 0xc0 &&
                byte <= 0xff &&
                (PrintableTextDecoder.#isAsciiLetter(bytes[index - 1]) ||
                    PrintableTextDecoder.#isAsciiLetter(bytes[index + 1]))
            ) {
                return true
            }
        }

        return false
    }

    /**
     * Returns true when one byte is an ASCII letter.
     * @param {number | undefined} byte Byte value.
     * @returns {boolean}
     */
    static #isAsciiLetter(byte) {
        return (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a)
    }

    /**
     * Trims ASCII whitespace from one byte range.
     * @param {Uint8Array} bytes
     * @param {number} start
     * @param {number} end
     * @returns {{ start: number, end: number }}
     */
    static #trimAsciiByteRange(bytes, start, end) {
        let trimmedStart = start
        let trimmedEnd = end

        while (
            trimmedStart < trimmedEnd &&
            PrintableTextDecoder.#isAsciiWhitespaceByte(bytes[trimmedStart])
        ) {
            trimmedStart += 1
        }

        while (
            trimmedEnd > trimmedStart &&
            PrintableTextDecoder.#isAsciiWhitespaceByte(bytes[trimmedEnd - 1])
        ) {
            trimmedEnd -= 1
        }

        return {
            start: trimmedStart,
            end: trimmedEnd
        }
    }

    /**
     * Returns true when one byte range contains Altium record delimiters.
     * @param {Uint8Array} bytes
     * @param {number} start
     * @param {number} end
     * @returns {boolean}
     */
    static #containsRecordDelimiterBytes(bytes, start, end) {
        let hasPipe = false
        let hasEquals = false

        for (let index = start; index < end; index += 1) {
            if (bytes[index] === 0x7c) {
                hasPipe = true
            } else if (bytes[index] === 0x3d) {
                hasEquals = true
            }

            if (hasPipe && hasEquals) {
                return true
            }
        }

        return false
    }

    /**
     * Returns true when a byte is ASCII whitespace normalized around runs.
     * @param {number} byte
     * @returns {boolean}
     */
    static #isAsciiWhitespaceByte(byte) {
        return byte === 9 || byte === 10 || byte === 13 || byte === 32
    }

    /**
     * Tries one strict decode and returns null when bytes are invalid for it.
     * @param {Uint8Array} bytes
     * @param {string} encoding
     * @returns {string | null}
     */
    static #tryDecode(bytes, encoding) {
        try {
            return PrintableTextDecoder.#decode(bytes, encoding, {
                fatal: true
            })
        } catch {
            return null
        }
    }

    /**
     * Decodes one byte slice with a cached runtime decoder.
     * @param {Uint8Array} bytes
     * @param {string} encoding
     * @param {{ fatal?: boolean }} [options]
     * @returns {string}
     */
    static #decode(bytes, encoding, options = {}) {
        return PrintableTextDecoder.#getTextDecoder(encoding, options).decode(
            bytes
        )
    }

    /**
     * Resolves a cached TextDecoder for one encoding and fatal mode.
     * @param {string} encoding
     * @param {{ fatal?: boolean }} options
     * @returns {TextDecoder}
     */
    static #getTextDecoder(encoding, options) {
        const Decoder = globalThis.TextDecoder
        if (PrintableTextDecoder.#decoderConstructor !== Decoder) {
            PrintableTextDecoder.#decoderCache = new Map()
            PrintableTextDecoder.#decoderConstructor = Decoder
        }

        const normalizedEncoding = String(encoding || 'utf-8').toLowerCase()
        const fatal = Boolean(options?.fatal)
        const cacheKey = `${normalizedEncoding}:${fatal ? 'fatal' : 'replace'}`
        const cached = PrintableTextDecoder.#decoderCache.get(cacheKey)
        if (cached) {
            return cached
        }

        const decoder = new Decoder(
            normalizedEncoding,
            fatal ? { fatal: true } : {}
        )
        PrintableTextDecoder.#decoderCache.set(cacheKey, decoder)
        return decoder
    }

    /**
     * Tries a Windows-1252 decode and normalizes runtimes that expose C1 bytes
     * as control characters instead of punctuation.
     * @param {Uint8Array} bytes
     * @returns {string | null}
     */
    static #tryDecodeWindows1252(bytes) {
        const decoded = PrintableTextDecoder.#tryDecode(bytes, 'windows-1252')
        if (decoded === null) return null

        return PrintableTextDecoder.#normalizeWindows1252Controls(decoded)
    }

    /**
     * Maps Windows-1252 control-range punctuation to stable Unicode code
     * points across Node/ICU builds.
     * @param {string} text
     * @returns {string}
     */
    static #normalizeWindows1252Controls(text) {
        let normalized = ''

        for (const character of text) {
            const codePoint = character.codePointAt(0)
            const windows1252CodePoint =
                PrintableTextDecoder.#WINDOWS_1252_CONTROL_CODE_POINTS.get(
                    codePoint
                )
            normalized += String.fromCodePoint(
                windows1252CodePoint || codePoint
            )
        }

        return normalized
    }
}
