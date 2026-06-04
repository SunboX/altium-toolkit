// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField } = ParserUtils
const COMPONENT_OWNER_AXIS_THRESHOLD = 160

/**
 * Resolves native owner-linked text records for schematic components.
 */
export class SchematicComponentOwnerTextResolver {
    /**
     * Resolves raw text records belonging to one schematic component.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} componentRecord Component placement record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Indexed schematic records.
     * @param {Map<string, { fields: Record<string, string | string[]> }[]>} relatedTexts Text records grouped by native OwnerIndex.
     * @returns {{ fields: Record<string, string | string[]> }[]}
     */
    static resolveOwnerTexts(componentRecord, records, relatedTexts) {
        const ownerIndexes =
            SchematicComponentOwnerTextResolver.#resolveOwnerIndexes(
                componentRecord,
                records
            )

        for (const ownerIndex of ownerIndexes) {
            const ownerTexts = relatedTexts.get(ownerIndex) || []
            if (
                SchematicComponentOwnerTextResolver.#hasComponentLabelText(
                    ownerTexts
                )
            ) {
                return ownerTexts
            }
        }

        return []
    }

    /**
     * Returns true when a schematic primitive participates in owner display
     * mode selection.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static isDisplayModeSelectablePrimitive(fields) {
        const recordType = getField(fields, 'RECORD')

        return (
            recordType === '2' ||
            recordType === '6' ||
            recordType === '11' ||
            recordType === '12' ||
            recordType === '13' ||
            recordType === '27' ||
            (SchematicComponentOwnerTextResolver.#hasCoordinatePair(
                fields,
                'Location'
            ) &&
                SchematicComponentOwnerTextResolver.#hasCoordinatePair(
                    fields,
                    'Corner'
                ))
        )
    }

    /**
     * Resolves candidate owner indexes for one schematic component record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} componentRecord Component placement record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Indexed schematic records.
     * @returns {string[]}
     */
    static #resolveOwnerIndexes(componentRecord, records) {
        return SchematicComponentOwnerTextResolver.#dedupeStrings([
            SchematicComponentOwnerTextResolver.#inferFollowingOwnerIndex(
                componentRecord,
                records
            ),
            ...SchematicComponentOwnerTextResolver.#legacyOwnerIndexes(
                componentRecord
            )
        ])
    }

    /**
     * Infers the owner id used by the display primitives following a component.
     * @param {{ recordIndex?: number }} componentRecord Component placement record.
     * @param {{ fields: Record<string, string | string[]> }[]} records Indexed schematic records.
     * @returns {string}
     */
    static #inferFollowingOwnerIndex(componentRecord, records) {
        if (!Number.isInteger(componentRecord?.recordIndex)) {
            return ''
        }

        let labelOwnerIndex = ''

        for (
            let index = componentRecord.recordIndex + 1;
            index < records.length;
            index += 1
        ) {
            const fields = records[index]?.fields
            const recordType = getField(fields, 'RECORD')
            if (recordType === '1' || recordType === '45') {
                break
            }

            const ownerIndex = getField(fields, 'OwnerIndex')
            if (!ownerIndex) {
                continue
            }

            if (
                SchematicComponentOwnerTextResolver.#isDisplayOwnerRecord(
                    fields
                ) &&
                SchematicComponentOwnerTextResolver.#isNearComponent(
                    fields,
                    componentRecord
                )
            ) {
                return ownerIndex
            }

            if (
                !labelOwnerIndex &&
                SchematicComponentOwnerTextResolver.#isComponentLabelRecord(
                    fields
                ) &&
                SchematicComponentOwnerTextResolver.#isNearComponent(
                    fields,
                    componentRecord
                )
            ) {
                labelOwnerIndex = ownerIndex
            }
        }

        return labelOwnerIndex
    }

    /**
     * Resolves legacy owner keys used by older printable schematic records.
     * @param {{ fields: Record<string, string | string[]> }} componentRecord Component placement record.
     * @returns {string[]}
     */
    static #legacyOwnerIndexes(componentRecord) {
        const indexInSheet = parseNumericField(
            componentRecord?.fields,
            'IndexInSheet'
        )
        const ownerIndex = getField(componentRecord?.fields, 'OwnerIndex')
        const keys = []

        if (indexInSheet !== null) {
            keys.push(String(indexInSheet + 1), String(indexInSheet))
        }

        keys.push(ownerIndex)

        return keys
    }

    /**
     * Returns true when one record can identify a component display owner.
     * @param {Record<string, string | string[]>} fields Raw record fields.
     * @returns {boolean}
     */
    static #isDisplayOwnerRecord(fields) {
        const ownerPartId = getField(fields, 'OwnerPartId')

        return (
            ownerPartId !== '-1' &&
            SchematicComponentOwnerTextResolver.isDisplayModeSelectablePrimitive(
                fields
            )
        )
    }

    /**
     * Returns true when a related text group contains a component label.
     * @param {{ fields: Record<string, string | string[]> }[]} records Text records.
     * @returns {boolean}
     */
    static #hasComponentLabelText(records) {
        return records.some((record) =>
            SchematicComponentOwnerTextResolver.#isComponentLabelRecord(
                record.fields
            )
        )
    }

    /**
     * Returns true when one text record is a component designator or comment.
     * @param {Record<string, string | string[]>} fields Raw record fields.
     * @returns {boolean}
     */
    static #isComponentLabelRecord(fields) {
        const name = getField(fields, 'Name').trim().toLowerCase()

        return name === 'designator' || name === 'comment' || name === 'value'
    }

    /**
     * Returns true when one owner record is plausibly part of a component's
     * display group.
     * @param {Record<string, string | string[]>} fields Raw record fields.
     * @param {{ fields: Record<string, string | string[]> }} componentRecord Component record.
     * @returns {boolean}
     */
    static #isNearComponent(fields, componentRecord) {
        const componentX = parseNumericField(
            componentRecord?.fields,
            'Location.X'
        )
        const componentY = parseNumericField(
            componentRecord?.fields,
            'Location.Y'
        )
        const bounds = SchematicComponentOwnerTextResolver.#recordBounds(fields)

        if (componentX === null || componentY === null || !bounds) {
            return true
        }

        return (
            SchematicComponentOwnerTextResolver.#axisDistance(
                componentX,
                bounds.minX,
                bounds.maxX
            ) <= COMPONENT_OWNER_AXIS_THRESHOLD &&
            SchematicComponentOwnerTextResolver.#axisDistance(
                componentY,
                bounds.minY,
                bounds.maxY
            ) <= COMPONENT_OWNER_AXIS_THRESHOLD
        )
    }

    /**
     * Resolves a loose coordinate envelope for one schematic record.
     * @param {Record<string, string | string[]>} fields Raw record fields.
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number } | null}
     */
    static #recordBounds(fields) {
        const points = [
            {
                x: parseNumericField(fields, 'Location.X'),
                y: parseNumericField(fields, 'Location.Y')
            },
            {
                x: parseNumericField(fields, 'Corner.X'),
                y: parseNumericField(fields, 'Corner.Y')
            }
        ].filter((point) => point.x !== null && point.y !== null)

        if (!points.length) {
            return null
        }

        return {
            minX: Math.min(...points.map((point) => point.x)),
            maxX: Math.max(...points.map((point) => point.x)),
            minY: Math.min(...points.map((point) => point.y)),
            maxY: Math.max(...points.map((point) => point.y))
        }
    }

    /**
     * Measures how far a coordinate is from an inclusive axis interval.
     * @param {number} value Coordinate value.
     * @param {number} min Axis interval minimum.
     * @param {number} max Axis interval maximum.
     * @returns {number}
     */
    static #axisDistance(value, min, max) {
        if (value < min) return min - value
        if (value > max) return value - max
        return 0
    }

    /**
     * Removes duplicate and empty string values while preserving order.
     * @param {string[]} values Candidate values.
     * @returns {string[]}
     */
    static #dedupeStrings(values) {
        return [
            ...new Set(
                values
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
            )
        ]
    }

    /**
     * Returns true when both X and Y exist for a point prefix.
     * @param {Record<string, string | string[]>} fields
     * @param {string} prefix
     * @returns {boolean}
     */
    static #hasCoordinatePair(fields, prefix) {
        return (
            parseNumericField(fields, prefix + '.X') !== null &&
            parseNumericField(fields, prefix + '.Y') !== null
        )
    }
}
