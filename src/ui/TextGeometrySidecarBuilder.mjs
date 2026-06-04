// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic estimated text geometry sidecars for SVG exports.
 */
export class TextGeometrySidecarBuilder {
    static SCHEMA_ID = 'altium-toolkit.text-geometry.a1'
    static #DEFAULT_WIDTH_RATIO = 0.6
    static #HEIGHT_PADDING = 2

    /**
     * Builds sidecar metadata for schematic text rows.
     * @param {object[]} texts Text rows.
     * @param {Map<object, number>} textIndexes Stable text index map.
     * @returns {{ schema: string, entries: object[] }}
     */
    static buildSchematic(texts, textIndexes) {
        return TextGeometrySidecarBuilder.#build(texts, textIndexes, {
            prefix: 'schematic-text-',
            defaultFontSize: 10,
            defaultFontFamily: ''
        })
    }

    /**
     * Builds sidecar metadata for PCB text rows.
     * @param {object[]} texts Text rows.
     * @param {Map<object, number>} textIndexes Stable text index map.
     * @returns {{ schema: string, entries: object[] }}
     */
    static buildPcb(texts, textIndexes) {
        return TextGeometrySidecarBuilder.#build(texts, textIndexes, {
            prefix: 'pcb-text-',
            defaultFontSize: 10,
            defaultFontFamily: ''
        })
    }

    /**
     * Builds generic text sidecar metadata.
     * @param {object[]} texts Text rows.
     * @param {Map<object, number>} textIndexes Stable text index map.
     * @param {{ prefix: string, defaultFontSize: number, defaultFontFamily: string }} options Build options.
     * @returns {{ schema: string, entries: object[] }}
     */
    static #build(texts, textIndexes, options) {
        return {
            schema: TextGeometrySidecarBuilder.SCHEMA_ID,
            entries: (texts || [])
                .map((text, fallbackIndex) =>
                    TextGeometrySidecarBuilder.#entry(
                        text,
                        textIndexes,
                        fallbackIndex,
                        options
                    )
                )
                .filter(Boolean)
        }
    }

    /**
     * Builds one text sidecar entry.
     * @param {object} text Text row.
     * @param {Map<object, number>} textIndexes Stable text index map.
     * @param {number} fallbackIndex Fallback text index.
     * @param {{ prefix: string, defaultFontSize: number, defaultFontFamily: string }} options Build options.
     * @returns {object | null}
     */
    static #entry(text, textIndexes, fallbackIndex, options) {
        const value = String(text?.resolvedText || text?.text || '')
        if (!value.trim()) {
            return null
        }

        const index = textIndexes?.get(text) ?? fallbackIndex
        const fontSize = Number(text?.fontSize || text?.height || 0) || 10
        const width = value.length * fontSize * this.#DEFAULT_WIDTH_RATIO
        const height = fontSize + this.#HEIGHT_PADDING
        const x = Number(text?.x || 0)
        const y = Number(text?.y || 0)

        return TextGeometrySidecarBuilder.#stripEmpty({
            elementKey: options.prefix + index,
            recordId: TextGeometrySidecarBuilder.#recordId(text),
            text: value,
            fontFamily: text?.fontFamily || options.defaultFontFamily,
            fontSize,
            fontWeight: Number(text?.fontWeight || 400),
            geometryKind: 'estimated-bounds-polygon',
            polygon: [
                { x, y },
                { x: TextGeometrySidecarBuilder.#round(x + width), y },
                {
                    x: TextGeometrySidecarBuilder.#round(x + width),
                    y: TextGeometrySidecarBuilder.#round(y - height)
                },
                { x, y: TextGeometrySidecarBuilder.#round(y - height) }
            ]
        })
    }

    /**
     * Resolves a stable source record id for one text row.
     * @param {object} text Text row.
     * @returns {string}
     */
    static #recordId(text) {
        const recordId =
            text?.recordId ?? text?.sourceRecordId ?? text?.sourceRecordIndex

        return recordId === null || recordId === undefined
            ? ''
            : String(recordId)
    }

    /**
     * Rounds numbers to a concise JSON-friendly precision.
     * @param {number} value Raw number.
     * @returns {number}
     */
    static #round(value) {
        return Number(Number(value).toFixed(4))
    }

    /**
     * Removes empty fields while preserving zero and false.
     * @param {Record<string, unknown>} value Candidate entry.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) {
                    return entryValue.length > 0
                }
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
