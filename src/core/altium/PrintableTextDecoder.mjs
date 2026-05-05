// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Extracts long printable runs from binary Altium documents.
 */
export class PrintableTextDecoder {
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
     * Decodes one byte slice using UTF-8 first, then GB18030 for non-UTF-8
     * payloads such as legacy PCB library text.
     * @param {Uint8Array} bytes
     * @param {{ encoding?: string }} [options]
     * @returns {string}
     */
    static decodeBytes(bytes, options = {}) {
        const preferredEncoding = String(options.encoding || '').toLowerCase()

        if (preferredEncoding === 'utf-8') {
            return (
                PrintableTextDecoder.#tryDecode(bytes, 'utf-8') ||
                new TextDecoder('utf-8').decode(bytes)
            )
        }

        return (
            PrintableTextDecoder.#tryDecode(bytes, 'utf-8') ||
            PrintableTextDecoder.#tryDecode(bytes, 'gb18030') ||
            new TextDecoder('utf-8').decode(bytes)
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
        const length = end - start
        if (length < minLength) return

        const slice = bytes.slice(start, end)
        const normalized = PrintableTextDecoder.#normalizeRun(
            PrintableTextDecoder.decodeBytes(slice)
        )

        if (normalized.length < minLength) return
        if (!normalized.includes('|') || !normalized.includes('=')) return

        runs.push(slice)
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
     * Tries one strict decode and returns null when bytes are invalid for it.
     * @param {Uint8Array} bytes
     * @param {string} encoding
     * @returns {string | null}
     */
    static #tryDecode(bytes, encoding) {
        try {
            return new TextDecoder(encoding, { fatal: true }).decode(bytes)
        } catch {
            return null
        }
    }
}
