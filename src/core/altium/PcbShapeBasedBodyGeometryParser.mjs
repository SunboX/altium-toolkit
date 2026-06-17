// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Parses shape-based 3D component-body geometry from native PCB streams.
 */
export class PcbShapeBasedBodyGeometryParser {
    /**
     * Parses binary shape-based body records from a native stream.
     * @param {Uint8Array | undefined} bytes Stream bytes.
     * @returns {{ fields: Record<string, string | string[]>, staticGeometry?: object }[]}
     */
    static parse(bytes) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return []
        }

        const records = []
        let offset = 0

        while (offset + 22 <= bytes.byteLength) {
            const parsed = PcbShapeBasedBodyGeometryParser.#parseRecordAt(
                bytes,
                offset
            )

            if (parsed) {
                records.push({
                    fields: parsed.fields,
                    staticGeometry: parsed.staticGeometry
                })
                offset = Math.max(parsed.nextOffset, offset + 1)
                continue
            }

            offset += 1
        }

        return records
    }

    /**
     * Builds a static geometry description from printable body fields.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {{ x: number, y: number }[]} [verticesMil] Extracted vertices.
     * @returns {object | undefined}
     */
    static buildStaticGeometry(fields, verticesMil = []) {
        const modelType = PcbShapeBasedBodyGeometryParser.#parseIntegerField(
            fields,
            'MODEL.MODELTYPE'
        )

        if (modelType === null) {
            return undefined
        }

        const standoffHeightMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'STANDOFFHEIGHT'
            ) || 0

        switch (modelType) {
            case 0:
                return PcbShapeBasedBodyGeometryParser.#extrudedPolygonGeometry(
                    fields,
                    verticesMil,
                    standoffHeightMil
                )
            case 1:
                return PcbShapeBasedBodyGeometryParser.#roundBodyGeometry(
                    fields,
                    'cone',
                    standoffHeightMil
                )
            case 2:
                return PcbShapeBasedBodyGeometryParser.#roundBodyGeometry(
                    fields,
                    'cylinder',
                    standoffHeightMil
                )
            case 3:
                return PcbShapeBasedBodyGeometryParser.#sphereGeometry(
                    fields,
                    standoffHeightMil
                )
            default:
                return {
                    kind: 'unknown-' + modelType,
                    status: 'incomplete',
                    units: 'mil',
                    standoffHeightMil
                }
        }
    }

    /**
     * Parses one possible shape-based body record at a byte offset.
     * @param {Uint8Array} bytes Stream bytes.
     * @param {number} offset Candidate offset.
     * @returns {{ fields: Record<string, string | string[]>, staticGeometry?: object, nextOffset: number } | null}
     */
    static #parseRecordAt(bytes, offset) {
        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        )
        const textLength = view.getInt32(offset + 18, true)

        if (
            textLength <= 0 ||
            textLength > 65536 ||
            offset + 22 + textLength > bytes.byteLength
        ) {
            return null
        }

        const textBytes = bytes.subarray(offset + 22, offset + 22 + textLength)
        const text = PrintableTextDecoder.decodeBytes(textBytes).replaceAll(
            '\u0000',
            ''
        )

        if (
            !text.includes('MODEL.') ||
            (!text.includes('MODELID=') && !text.includes('MODEL.NAME='))
        ) {
            return null
        }

        const fields =
            PcbShapeBasedBodyGeometryParser.#parseFieldRecordBytes(textBytes)
        const vertexBlock = PcbShapeBasedBodyGeometryParser.#parseVertexBlock(
            bytes,
            offset + 22 + textLength
        )

        return {
            fields,
            staticGeometry: PcbShapeBasedBodyGeometryParser.buildStaticGeometry(
                fields,
                vertexBlock.verticesMil
            ),
            nextOffset:
                vertexBlock.nextOffset > offset
                    ? vertexBlock.nextOffset
                    : offset + 22 + textLength
        }
    }

    /**
     * Parses the optional coordinate block after a shape-body field record.
     * @param {Uint8Array} bytes Stream bytes.
     * @param {number} offset Coordinate-count offset.
     * @returns {{ verticesMil: { x: number, y: number }[], nextOffset: number }}
     */
    static #parseVertexBlock(bytes, offset) {
        if (offset + 4 > bytes.byteLength) {
            return {
                verticesMil: [],
                nextOffset: offset
            }
        }

        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        )
        const vertexCount = view.getInt32(offset, true)
        const dataOffset = offset + 4

        if (
            vertexCount < 0 ||
            vertexCount > 10000 ||
            dataOffset + vertexCount * 37 > bytes.byteLength
        ) {
            return {
                verticesMil: [],
                nextOffset: offset
            }
        }

        const verticesMil = []

        for (let index = 0; index < vertexCount; index += 1) {
            const vertexOffset = dataOffset + index * 37
            verticesMil.push({
                x: PcbShapeBasedBodyGeometryParser.#roundMil(
                    view.getInt32(vertexOffset + 1, true) / 10000
                ),
                y: PcbShapeBasedBodyGeometryParser.#roundMil(
                    view.getInt32(vertexOffset + 5, true) / 10000
                )
            })
        }

        return {
            verticesMil,
            nextOffset: dataOffset + vertexCount * 37
        }
    }

    /**
     * Parses one printable field record.
     * @param {Uint8Array} bytes Record bytes.
     * @returns {Record<string, string | string[]>}
     */
    static #parseFieldRecordBytes(bytes) {
        const fields = {}
        const text = PrintableTextDecoder.decodeBytes(bytes)
            .replaceAll('\u0000', '')
            .trim()

        for (const segment of text.split('|')) {
            const trimmedSegment = segment.trim()
            if (!trimmedSegment) {
                continue
            }

            const separatorIndex = trimmedSegment.indexOf('=')
            if (separatorIndex === -1) {
                continue
            }

            const key = trimmedSegment.slice(0, separatorIndex).trim()
            const value = trimmedSegment.slice(separatorIndex + 1).trim()

            if (!key) {
                continue
            }

            PcbShapeBasedBodyGeometryParser.#appendFieldValue(
                fields,
                key,
                value
            )
        }

        return fields
    }

    /**
     * Builds extruded-polygon static geometry.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {{ x: number, y: number }[]} verticesMil Extracted vertices.
     * @param {number} standoffHeightMil Standoff height.
     * @returns {object}
     */
    static #extrudedPolygonGeometry(fields, verticesMil, standoffHeightMil) {
        const minZMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.EXTRUDED.MINZ'
            ) || 0
        const maxZMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.EXTRUDED.MAXZ'
            ) ||
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'OVERALLHEIGHT'
            ) ||
            0
        const heightMil = PcbShapeBasedBodyGeometryParser.#positiveNumber(
            maxZMil - minZMil
        )
        const hasCompleteGeometry =
            Array.isArray(verticesMil) && verticesMil.length >= 3 && heightMil

        return PcbShapeBasedBodyGeometryParser.#stripUndefined({
            kind: 'extruded-polygon',
            status: hasCompleteGeometry ? 'complete' : 'incomplete',
            units: 'mil',
            minZMil: PcbShapeBasedBodyGeometryParser.#roundMil(minZMil),
            maxZMil: PcbShapeBasedBodyGeometryParser.#roundMil(maxZMil),
            heightMil,
            standoffHeightMil,
            verticesMil: verticesMil?.length ? verticesMil : undefined
        })
    }

    /**
     * Builds cone or cylinder static geometry.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {'cone' | 'cylinder'} kind Body kind.
     * @param {number} standoffHeightMil Standoff height.
     * @returns {object}
     */
    static #roundBodyGeometry(fields, kind, standoffHeightMil) {
        const upperKind = kind.toUpperCase()
        const radiusMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.' + upperKind + '.RADIUS'
            ) ||
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.CYLINDER.RADIUS'
            )
        const heightMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.' + upperKind + '.HEIGHT'
            ) ||
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.CYLINDER.HEIGHT'
            ) ||
            PcbShapeBasedBodyGeometryParser.#heightFromOverall(fields)
        const complete =
            PcbShapeBasedBodyGeometryParser.#positiveNumber(radiusMil) &&
            PcbShapeBasedBodyGeometryParser.#positiveNumber(heightMil)

        return PcbShapeBasedBodyGeometryParser.#stripUndefined({
            kind,
            status: complete ? 'complete' : 'incomplete',
            units: 'mil',
            radiusMil:
                PcbShapeBasedBodyGeometryParser.#positiveNumber(radiusMil),
            heightMil:
                PcbShapeBasedBodyGeometryParser.#positiveNumber(heightMil),
            standoffHeightMil
        })
    }

    /**
     * Builds sphere static geometry.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {number} standoffHeightMil Standoff height.
     * @returns {object}
     */
    static #sphereGeometry(fields, standoffHeightMil) {
        const heightFromOverall =
            PcbShapeBasedBodyGeometryParser.#heightFromOverall(fields)
        const radiusMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.SPHERE.RADIUS'
            ) ||
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'MODEL.CYLINDER.RADIUS'
            ) ||
            (heightFromOverall ? heightFromOverall / 2 : undefined)
        const complete =
            PcbShapeBasedBodyGeometryParser.#positiveNumber(radiusMil)

        return PcbShapeBasedBodyGeometryParser.#stripUndefined({
            kind: 'sphere',
            status: complete ? 'complete' : 'incomplete',
            units: 'mil',
            radiusMil:
                PcbShapeBasedBodyGeometryParser.#positiveNumber(radiusMil),
            standoffHeightMil
        })
    }

    /**
     * Derives body height from overall and standoff fields.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @returns {number | undefined}
     */
    static #heightFromOverall(fields) {
        const overallHeightMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'OVERALLHEIGHT'
            ) || 0
        const standoffHeightMil =
            PcbShapeBasedBodyGeometryParser.#parseMilLikeField(
                fields,
                'STANDOFFHEIGHT'
            ) || 0

        return PcbShapeBasedBodyGeometryParser.#positiveNumber(
            overallHeightMil - standoffHeightMil
        )
    }

    /**
     * Returns the latest meaningful field value from one parsed field map.
     * @param {Record<string, string | string[]>} fields Field map.
     * @param {string} key Field key.
     * @returns {string}
     */
    static #getField(fields, key) {
        const raw = fields[key]
        const values = Array.isArray(raw) ? raw : [raw]

        return (
            values
                .map((value) => String(value || '').trim())
                .findLast((value) => value.length > 0) || ''
        )
    }

    /**
     * Appends one field value while preserving duplicate keys.
     * @param {Record<string, string | string[]>} fields Field map.
     * @param {string} key Field key.
     * @param {string} value Field value.
     * @returns {void}
     */
    static #appendFieldValue(fields, key, value) {
        if (!(key in fields)) {
            fields[key] = value
            return
        }

        const previous = fields[key]
        if (Array.isArray(previous)) {
            previous.push(value)
            return
        }

        fields[key] = [previous, value]
    }

    /**
     * Parses one floating-point field.
     * @param {Record<string, string | string[]>} fields Field map.
     * @param {string} key Field key.
     * @returns {number | null}
     */
    static #parseNumberField(fields, key) {
        const raw = PcbShapeBasedBodyGeometryParser.#getField(fields, key)
        const match = raw.match(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/i)

        if (!match) {
            return null
        }

        const parsed = Number(match[0])
        return Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Parses one integer-like field.
     * @param {Record<string, string | string[]>} fields Field map.
     * @param {string} key Field key.
     * @returns {number | null}
     */
    static #parseIntegerField(fields, key) {
        const parsed = PcbShapeBasedBodyGeometryParser.#parseNumberField(
            fields,
            key
        )
        if (!Number.isFinite(parsed)) {
            return null
        }

        return Math.trunc(parsed)
    }

    /**
     * Parses one mil-like field from text or raw fixed-point storage.
     * @param {Record<string, string | string[]>} fields Field map.
     * @param {string} key Field key.
     * @returns {number | null}
     */
    static #parseMilLikeField(fields, key) {
        const raw = PcbShapeBasedBodyGeometryParser.#getField(fields, key)
        const parsed = PcbShapeBasedBodyGeometryParser.#parseNumberField(
            fields,
            key
        )

        if (!Number.isFinite(parsed)) {
            return null
        }

        return /mil/i.test(raw) ? parsed : parsed / 10000
    }

    /**
     * Returns a rounded positive number or undefined.
     * @param {unknown} value Candidate value.
     * @returns {number | undefined}
     */
    static #positiveNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) && number > 0
            ? PcbShapeBasedBodyGeometryParser.#roundMil(number)
            : undefined
    }

    /**
     * Rounds one mil value for stable JSON output.
     * @param {number} value Candidate value.
     * @returns {number}
     */
    static #roundMil(value) {
        const rounded = Math.round(Number(value) * 10000) / 10000
        return Object.is(rounded, -0) ? 0 : rounded
    }

    /**
     * Removes undefined values from a row.
     * @param {object} row Row to clean.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
