// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Helpers for synthesized schematic annotations recovered from source metadata.
 */
export class SchematicAnnotationParser {
    /**
     * Builds synthesized schematic text annotations from non-visible component
     * metadata that is still recoverable from the source file.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[]} pins
     * @param {Record<string, { size: number, family: string, bold: boolean, rotation: number }>} fonts
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, anchor: 'start' | 'middle' | 'end' }[]}
     */
    static buildSchematicSyntheticTexts(records, pins, fonts) {
        const connectorGroups =
            SchematicAnnotationParser.#buildConnectorPinGroups(pins)
        const connectorComponents = records
            .filter(
                (record) =>
                    ParserUtils.getField(record.fields, 'RECORD') === '1'
            )
            .map((record) =>
                SchematicAnnotationParser.#normalizeConnectorComponent(
                    record.fields
                )
            )
            .filter(Boolean)

        if (!connectorGroups.length || !connectorComponents.length) {
            return []
        }

        const font =
            fonts['1'] || SchematicAnnotationParser.#defaultAnnotationFont()
        const availableGroups = connectorGroups.slice()
        const texts = []

        for (const component of connectorComponents) {
            const closestIndex =
                SchematicAnnotationParser.#findClosestConnectorGroupIndex(
                    component,
                    availableGroups
                )
            if (closestIndex === -1) continue

            const [group] = availableGroups.splice(closestIndex, 1)

            texts.push({
                x: group.centerX,
                y: group.minY - 20,
                text: component.annotation,
                color: '#000080',
                hidden: false,
                name: 'Comment',
                recordType: 'annotation',
                style: 0,
                fontSize: SchematicAnnotationParser.#toSvgFontSize(font.size),
                fontFamily: font.family,
                fontWeight: 400,
                rotation: 0,
                anchor: 'middle'
            })
        }

        return texts
    }

    /**
     * Collects the number-only dual-row connector pin groups used by J6/J8.
     * @param {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[]} pins
     * @returns {{ ownerIndex: string, centerX: number, centerY: number, minY: number }[]}
     */
    static #buildConnectorPinGroups(pins) {
        const groups = new Map()

        for (const pin of pins) {
            if (!groups.has(pin.ownerIndex)) {
                groups.set(pin.ownerIndex, [])
            }

            groups.get(pin.ownerIndex).push(pin)
        }

        return [...groups.values()]
            .filter(
                (group) =>
                    group.length === 6 &&
                    group[0].labelMode === 'number-only' &&
                    group.every((pin) => /^\d+$/.test(pin.name))
            )
            .map((group) => {
                const xs = group.map((pin) => pin.x)
                const ys = group.map((pin) => pin.y)

                return {
                    ownerIndex: group[0].ownerIndex,
                    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
                    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
                    minY: Math.min(...ys)
                }
            })
            .sort((left, right) => right.centerY - left.centerY)
    }

    /**
     * Normalizes one connector component record when it should emit a
     * synthesized schematic annotation.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number, annotation: string } | null}
     */
    static #normalizeConnectorComponent(fields) {
        const libReference = ParserUtils.getField(fields, 'LibReference')
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')
        const annotation =
            SchematicAnnotationParser.#formatConnectorAnnotation(libReference)

        if (!annotation || x === null || y === null) {
            return null
        }

        return { x, y, annotation }
    }

    /**
     * Formats a closer-to-Altium connector note from the library reference.
     * @param {string} libReference
     * @returns {string}
     */
    static #formatConnectorAnnotation(libReference) {
        const normalized = String(libReference || '').trim()
        const upper = normalized.toUpperCase()
        const hasConnectorKeyword =
            /\b(CON|CONN|CONNECTOR|HDR|HEADER)\b/.test(upper) ||
            /\b\d+X\d+P\b/.test(upper)

        if (!hasConnectorKeyword) {
            return ''
        }

        const notes = ['HEADER']
        const pitch =
            /PH\s*([0-9.]+)/i.exec(normalized)?.[1] ||
            /PITCH[_ =-]*([0-9.]+)/i.exec(normalized)?.[1]
        const pinFormat = /\b(\d+X\d+P)\b/i.exec(upper)?.[1]
        const length = /L=([0-9.]+)/i.exec(normalized)?.[1] || ''

        if (pitch) {
            notes.push('P' + pitch)
        }

        if (pinFormat) {
            notes.push(pinFormat)
        }

        if (/\b(straight|vertical)\b/i.test(normalized)) {
            notes.push('VERTICAL')
        } else if (/\b(right angle|horizontal)\b/i.test(normalized)) {
            notes.push('RIGHT-ANGLE')
        }

        if (length) {
            notes.push('L=' + length)
        }

        return notes.join(' ')
    }

    /**
     * Finds the nearest available connector pin group for one component record.
     * @param {{ x: number, y: number, annotation: string }} component
     * @param {{ ownerIndex: string, centerX: number, centerY: number, minY: number }[]} groups
     * @returns {number}
     */
    static #findClosestConnectorGroupIndex(component, groups) {
        let closestIndex = -1
        let closestDistance = Number.POSITIVE_INFINITY

        for (let index = 0; index < groups.length; index += 1) {
            const group = groups[index]
            const distance =
                Math.abs(group.centerX - component.x) +
                Math.abs(group.centerY - component.y)

            if (distance < closestDistance) {
                closestDistance = distance
                closestIndex = index
            }
        }

        return closestIndex
    }

    /**
     * Returns the default sheet font used for synthetic annotations.
     * @returns {{ size: number, family: string, bold: boolean, rotation: number }}
     */
    static #defaultAnnotationFont() {
        return {
            size: 10,
            family: 'Times New Roman',
            bold: false,
            rotation: 0
        }
    }

    /**
     * Converts Altium point sizes into SVG font units.
     * @param {number} size
     * @returns {number}
     */
    static #toSvgFontSize(size) {
        return Number(size || 10)
    }
}
