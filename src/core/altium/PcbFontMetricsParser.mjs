// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Parses minimal sfnt metric tables from recovered embedded PCB fonts.
 */
export class PcbFontMetricsParser {
    /**
     * Parses font-family metrics from a TrueType/OpenType sfnt payload.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {{ format: 'truetype' | 'opentype' | 'unknown', unitsPerEm?: number, ascent?: number, descent?: number, lineGap?: number, windowsAscent?: number, windowsDescent?: number, cellHeight?: number, emScaleFromPcbHeight?: number, capHeight?: number, averageAdvanceWidth?: number, weightClass?: number, widthClass?: number }}
     */
    static parse(bytes) {
        const normalizedBytes = PcbFontMetricsParser.#toUint8Array(bytes)
        const view = new DataView(
            normalizedBytes.buffer,
            normalizedBytes.byteOffset,
            normalizedBytes.byteLength
        )

        if (normalizedBytes.byteLength < 12) {
            return { format: 'unknown' }
        }

        const format = PcbFontMetricsParser.#parseFormat(normalizedBytes)
        if (format === 'unknown') {
            return { format }
        }

        const tables = PcbFontMetricsParser.#parseTableDirectory(view)
        const head = PcbFontMetricsParser.#readHeadTable(
            view,
            tables.get('head')
        )
        const hhea = PcbFontMetricsParser.#readHheaTable(
            view,
            tables.get('hhea')
        )
        const os2 = PcbFontMetricsParser.#readOs2Table(view, tables.get('OS/2'))
        const hmtx = PcbFontMetricsParser.#readHmtxTable(
            view,
            tables.get('hmtx'),
            hhea.numberOfHMetrics
        )
        const cellHeight = PcbFontMetricsParser.#resolvePcbCellHeight(hhea, os2)
        const metrics = {
            format,
            ...head,
            ...hhea,
            cellHeight,
            emScaleFromPcbHeight:
                head.unitsPerEm && cellHeight
                    ? head.unitsPerEm / cellHeight
                    : undefined,
            ...os2,
            averageAdvanceWidth:
                hmtx.averageAdvanceWidth || os2.averageAdvanceWidth
        }

        return Object.fromEntries(
            Object.entries(metrics).filter(
                ([key, value]) =>
                    key !== 'numberOfHMetrics' &&
                    value !== undefined &&
                    (typeof value === 'string' || Number.isFinite(value))
            )
        )
    }

    /**
     * Resolves the sfnt flavor from the first four bytes.
     * @param {Uint8Array} bytes
     * @returns {'truetype' | 'opentype' | 'unknown'}
     */
    static #parseFormat(bytes) {
        const signature = String.fromCharCode(...bytes.subarray(0, 4))

        if (
            bytes[0] === 0x00 &&
            bytes[1] === 0x01 &&
            bytes[2] === 0x00 &&
            bytes[3] === 0x00
        ) {
            return 'truetype'
        }

        if (signature === 'true' || signature === 'typ1') {
            return 'truetype'
        }

        if (signature === 'OTTO') {
            return 'opentype'
        }

        return 'unknown'
    }

    /**
     * Reads the sfnt table directory.
     * @param {DataView} view
     * @returns {Map<string, { offset: number, length: number }>}
     */
    static #parseTableDirectory(view) {
        const tables = new Map()
        const tableCount = PcbFontMetricsParser.#readUint16(view, 4)

        for (let index = 0; index < tableCount; index += 1) {
            const recordOffset = 12 + index * 16
            if (recordOffset + 16 > view.byteLength) {
                break
            }

            const tag = PcbFontMetricsParser.#readTag(view, recordOffset)
            const offset = PcbFontMetricsParser.#readUint32(
                view,
                recordOffset + 8
            )
            const length = PcbFontMetricsParser.#readUint32(
                view,
                recordOffset + 12
            )

            if (offset + length <= view.byteLength) {
                tables.set(tag, { offset, length })
            }
        }

        return tables
    }

    /**
     * Reads the units-per-em value from the `head` table.
     * @param {DataView} view
     * @param {{ offset: number, length: number } | undefined} table
     * @returns {{ unitsPerEm?: number }}
     */
    static #readHeadTable(view, table) {
        if (!PcbFontMetricsParser.#tableHasBytes(table, 20)) {
            return {}
        }

        return {
            unitsPerEm: PcbFontMetricsParser.#readUint16(
                view,
                table.offset + 18
            )
        }
    }

    /**
     * Reads ascent, descent, and metric-count data from the `hhea` table.
     * @param {DataView} view
     * @param {{ offset: number, length: number } | undefined} table
     * @returns {{ ascent?: number, descent?: number, lineGap?: number, numberOfHMetrics?: number }}
     */
    static #readHheaTable(view, table) {
        if (!PcbFontMetricsParser.#tableHasBytes(table, 36)) {
            return {}
        }

        return {
            ascent: PcbFontMetricsParser.#readInt16(view, table.offset + 4),
            descent: PcbFontMetricsParser.#readInt16(view, table.offset + 6),
            lineGap: PcbFontMetricsParser.#readInt16(view, table.offset + 8),
            numberOfHMetrics: PcbFontMetricsParser.#readUint16(
                view,
                table.offset + 34
            )
        }
    }

    /**
     * Reads typography metadata from the `OS/2` table.
     * @param {DataView} view
     * @param {{ offset: number, length: number } | undefined} table
     * @returns {{ averageAdvanceWidth?: number, weightClass?: number, widthClass?: number, windowsAscent?: number, windowsDescent?: number, capHeight?: number }}
     */
    static #readOs2Table(view, table) {
        if (!PcbFontMetricsParser.#tableHasBytes(table, 8)) {
            return {}
        }

        const version = PcbFontMetricsParser.#readUint16(view, table.offset)
        const metrics = {
            averageAdvanceWidth: PcbFontMetricsParser.#readInt16(
                view,
                table.offset + 2
            ),
            weightClass: PcbFontMetricsParser.#readUint16(
                view,
                table.offset + 4
            ),
            widthClass: PcbFontMetricsParser.#readUint16(view, table.offset + 6)
        }

        if (version >= 2 && PcbFontMetricsParser.#tableHasBytes(table, 90)) {
            metrics.capHeight = PcbFontMetricsParser.#readInt16(
                view,
                table.offset + 88
            )
        }
        if (PcbFontMetricsParser.#tableHasBytes(table, 78)) {
            metrics.windowsAscent = PcbFontMetricsParser.#readUint16(
                view,
                table.offset + 74
            )
            metrics.windowsDescent = PcbFontMetricsParser.#readUint16(
                view,
                table.offset + 76
            )
        }

        return metrics
    }

    /**
     * Resolves the TrueType cell height used by Altium PCB text placement.
     * @param {{ ascent?: number, descent?: number }} hhea
     * @param {{ windowsAscent?: number, windowsDescent?: number }} os2
     * @returns {number | undefined}
     */
    static #resolvePcbCellHeight(hhea, os2) {
        if (
            Number.isFinite(os2.windowsAscent) &&
            Number.isFinite(os2.windowsDescent) &&
            os2.windowsAscent + os2.windowsDescent > 0
        ) {
            return os2.windowsAscent + os2.windowsDescent
        }

        return Number.isFinite(hhea.ascent) && Number.isFinite(hhea.descent)
            ? hhea.ascent + Math.abs(hhea.descent)
            : undefined
    }

    /**
     * Reads horizontal advance data from the `hmtx` table.
     * @param {DataView} view
     * @param {{ offset: number, length: number } | undefined} table
     * @param {number | undefined} numberOfHMetrics
     * @returns {{ averageAdvanceWidth?: number }}
     */
    static #readHmtxTable(view, table, numberOfHMetrics) {
        if (!PcbFontMetricsParser.#tableHasBytes(table, 4)) {
            return {}
        }

        const metricCount = Math.max(Number(numberOfHMetrics) || 1, 1)
        const maxMetricCount = Math.min(
            metricCount,
            Math.floor(table.length / 4)
        )
        let totalAdvanceWidth = 0

        for (let index = 0; index < maxMetricCount; index += 1) {
            totalAdvanceWidth += PcbFontMetricsParser.#readUint16(
                view,
                table.offset + index * 4
            )
        }

        return {
            averageAdvanceWidth: Math.round(totalAdvanceWidth / maxMetricCount)
        }
    }

    /**
     * Returns true when a table record contains at least the requested length.
     * @param {{ offset: number, length: number } | undefined} table
     * @param {number} minimumLength
     * @returns {boolean}
     */
    static #tableHasBytes(table, minimumLength) {
        return Boolean(table && table.length >= minimumLength)
    }

    /**
     * Reads one four-character table tag.
     * @param {DataView} view
     * @param {number} offset
     * @returns {string}
     */
    static #readTag(view, offset) {
        return String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
        )
    }

    /**
     * Reads one big-endian unsigned 16-bit integer.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readUint16(view, offset) {
        return offset + 2 <= view.byteLength ? view.getUint16(offset, false) : 0
    }

    /**
     * Reads one big-endian signed 16-bit integer.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readInt16(view, offset) {
        return offset + 2 <= view.byteLength ? view.getInt16(offset, false) : 0
    }

    /**
     * Reads one big-endian unsigned 32-bit integer.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32(view, offset) {
        return offset + 4 <= view.byteLength ? view.getUint32(offset, false) : 0
    }

    /**
     * Normalizes byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes || new ArrayBuffer(0))
    }
}
