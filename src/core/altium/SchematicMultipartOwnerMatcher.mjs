// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

/**
 * Resolves which multipart symbol section is visible for one schematic owner.
 */
export class SchematicMultipartOwnerMatcher {
    /**
     * Matches multipart owner indexes to the currently visible part id stored
     * on their component placements.
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} records
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} componentRecords
     * @returns {Map<string, string>}
     */
    static collectActiveMultipartOwnerParts(records, componentRecords) {
        const partBounds = new Map()
        const ownerBounds = new Map()
        const directOwnerIndexesByRecord = new WeakMap()

        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            const ownerPartId = getField(record.fields, 'OwnerPartId')

            if (!ownerIndex || !ownerPartId || ownerPartId === '-1') {
                continue
            }

            const points =
                SchematicMultipartOwnerMatcher.#collectSchematicRecordPoints(
                    record.fields
                )
            if (!points.length) {
                continue
            }

            const key = ownerIndex + '::' + ownerPartId
            const existingBounds = partBounds.get(key) || {
                ownerIndex,
                ownerPartId,
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY,
                leftPinLength: 0,
                rightPinLength: 0
            }

            SchematicMultipartOwnerMatcher.#expandBounds(existingBounds, points)

            existingBounds.leftPinLength = Math.max(
                existingBounds.leftPinLength,
                SchematicMultipartOwnerMatcher.#collectLeftPinLength(
                    record.fields
                )
            )
            existingBounds.rightPinLength = Math.max(
                existingBounds.rightPinLength,
                SchematicMultipartOwnerMatcher.#collectRightPinLength(
                    record.fields
                )
            )

            partBounds.set(key, existingBounds)

            const existingOwnerBounds = ownerBounds.get(ownerIndex) || {
                ownerIndex,
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY
            }

            SchematicMultipartOwnerMatcher.#expandBounds(
                existingOwnerBounds,
                points
            )
            ownerBounds.set(ownerIndex, existingOwnerBounds)
        }

        for (let index = 0; index < records.length; index += 1) {
            const record = records[index]
            if (getField(record.fields, 'RECORD') !== '1') {
                continue
            }

            const currentPartId = String(
                parseNumericField(record.fields, 'CurrentPartId') || ''
            )
            const partCount = parseNumericField(record.fields, 'PartCount') || 0

            if (!currentPartId || partCount <= 1) {
                continue
            }

            const directOwnerIndex =
                SchematicMultipartOwnerMatcher.#findSerializedOwnerIndex(
                    records,
                    index
                )

            if (!directOwnerIndex) {
                continue
            }

            directOwnerIndexesByRecord.set(record, directOwnerIndex)
        }

        const activeOwnerParts = new Map()

        for (const record of componentRecords) {
            const currentPartId = String(
                parseNumericField(record.fields, 'CurrentPartId') || ''
            )
            const partCount = parseNumericField(record.fields, 'PartCount') || 0
            const x = parseNumericField(record.fields, 'Location.X')
            const y = parseNumericField(record.fields, 'Location.Y')
            const isMirrored = parseBoolean(record.fields.IsMirrored)

            if (!currentPartId || partCount <= 1 || x === null || y === null) {
                continue
            }

            const directOwnerIndex = directOwnerIndexesByRecord.get(record)

            if (directOwnerIndex) {
                activeOwnerParts.set(directOwnerIndex, currentPartId)
                continue
            }

            const bestPartMatch =
                SchematicMultipartOwnerMatcher.#findBestPartBoundsMatch(
                    partBounds,
                    currentPartId,
                    x,
                    y,
                    isMirrored
                )

            if (bestPartMatch && bestPartMatch.score <= 4) {
                activeOwnerParts.set(
                    bestPartMatch.ownerIndex,
                    bestPartMatch.ownerPartId
                )
                continue
            }

            const bestOwnerMatch =
                SchematicMultipartOwnerMatcher.#findBestOwnerBoundsMatch(
                    ownerBounds,
                    x,
                    y
                )

            if (bestOwnerMatch && bestOwnerMatch.score <= 4) {
                activeOwnerParts.set(bestOwnerMatch.ownerIndex, currentPartId)
            }
        }

        return activeOwnerParts
    }

    /**
     * Resolves the dominant owner index serialized after one component record.
     * This preserves multipart selection when library origins do not align with
     * the current geometric anchor heuristics.
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} records
     * @param {number} componentIndex
     * @returns {string}
     */
    static #findSerializedOwnerIndex(records, componentIndex) {
        const ownerCounts = new Map()
        const firstSeenOrder = new Map()

        for (
            let index = componentIndex + 1;
            index < records.length;
            index += 1
        ) {
            const record = records[index]
            if (getField(record.fields, 'RECORD') === '1') {
                break
            }

            if (
                !SchematicMultipartOwnerMatcher.#isSerializedOwnerCandidate(
                    record.fields
                )
            ) {
                continue
            }

            const ownerIndex = getField(record.fields, 'OwnerIndex')

            if (!firstSeenOrder.has(ownerIndex)) {
                firstSeenOrder.set(ownerIndex, firstSeenOrder.size)
            }

            ownerCounts.set(ownerIndex, (ownerCounts.get(ownerIndex) || 0) + 1)
        }

        const bestOwner = [...ownerCounts.entries()].sort((left, right) => {
            if (left[1] !== right[1]) {
                return right[1] - left[1]
            }

            return firstSeenOrder.get(left[0]) - firstSeenOrder.get(right[0])
        })[0]

        if (!bestOwner) {
            return ''
        }

        const secondBestCount =
            [...ownerCounts.values()].sort((left, right) => right - left)[1] ||
            0
        const [ownerIndex, bestCount] = bestOwner

        if (
            bestCount < 3 ||
            (secondBestCount > 0 && bestCount < secondBestCount * 3)
        ) {
            return ''
        }

        return ownerIndex
    }

    /**
     * Returns true when one serialized record contributes to the dominant
     * owner block for a placed component.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #isSerializedOwnerCandidate(fields) {
        const ownerIndex = getField(fields, 'OwnerIndex')
        const recordType = getField(fields, 'RECORD')

        if (!ownerIndex) {
            return false
        }

        if (['45', '46', '48'].includes(recordType)) {
            return false
        }

        return !(
            recordType === '41' && getField(fields, 'Name') === 'PinUniqueId'
        )
    }

    /**
     * Returns true when one schematic record belongs to the selected visible
     * part for a multipart owner.
     * @param {Record<string, string | string[]>} fields
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {boolean}
     */
    static isActiveOwnerPartRecord(fields, activeMultipartOwnerParts) {
        const ownerIndex = getField(fields, 'OwnerIndex')
        if (!ownerIndex) {
            return true
        }

        const activePartId = activeMultipartOwnerParts.get(ownerIndex)
        if (!activePartId) {
            return true
        }

        const ownerPartId = getField(fields, 'OwnerPartId')
        if (!ownerPartId || ownerPartId === '-1') {
            return true
        }

        return ownerPartId === activePartId
    }

    /**
     * Collects the coordinate points embedded in one schematic record.
     * @param {Record<string, string | string[]>} fields
     * @returns {[number, number][]}
     */
    static #collectSchematicRecordPoints(fields) {
        const points = []
        const locationX = parseNumericField(fields, 'Location.X')
        const locationY = parseNumericField(fields, 'Location.Y')
        const cornerX = parseNumericField(fields, 'Corner.X')
        const cornerY = parseNumericField(fields, 'Corner.Y')
        const locationCount = parseNumericField(fields, 'LocationCount') || 0

        if (locationX !== null && locationY !== null) {
            points.push([locationX, locationY])
        }

        if (cornerX !== null && cornerY !== null) {
            points.push([cornerX, cornerY])
        }

        for (let index = 1; index <= locationCount; index += 1) {
            const x = parseNumericField(fields, 'X' + index)
            const y = parseNumericField(fields, 'Y' + index)

            if (x === null || y === null) {
                break
            }

            points.push([x, y])
        }

        return points
    }

    /**
     * Expands one accumulated bounds box to include a list of points.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {[number, number][]} points
     * @returns {void}
     */
    static #expandBounds(bounds, points) {
        for (const [x, y] of points) {
            bounds.minX = Math.min(bounds.minX, x)
            bounds.minY = Math.min(bounds.minY, y)
            bounds.maxX = Math.max(bounds.maxX, x)
            bounds.maxY = Math.max(bounds.maxY, y)
        }
    }

    /**
     * Finds the closest part-specific multipart bounds match for one component
     * placement using the existing per-part anchor heuristics.
     * @param {Map<string, { ownerIndex: string, ownerPartId: string, minX: number, minY: number, maxX: number, maxY: number, leftPinLength: number, rightPinLength: number }>} partBounds
     * @param {string} currentPartId
     * @param {number} x
     * @param {number} y
     * @param {boolean} isMirrored
     * @returns {{ ownerIndex: string, ownerPartId: string, minX: number, minY: number, maxX: number, maxY: number, leftPinLength: number, rightPinLength: number, score: number } | undefined}
     */
    static #findBestPartBoundsMatch(
        partBounds,
        currentPartId,
        x,
        y,
        isMirrored
    ) {
        return [...partBounds.values()]
            .filter((bounds) => bounds.ownerPartId === currentPartId)
            .map((bounds) => ({
                ...bounds,
                score: SchematicMultipartOwnerMatcher.#scoreBoundsAnchor(
                    bounds,
                    x,
                    y,
                    isMirrored,
                    currentPartId
                )
            }))
            .sort((left, right) => left.score - right.score)[0]
    }

    /**
     * Finds the closest owner-level multipart bounds match for one component
     * placement when the part-specific corner anchors do not line up.
     * @param {Map<string, { ownerIndex: string, minX: number, minY: number, maxX: number, maxY: number }>} ownerBounds
     * @param {number} x
     * @param {number} y
     * @returns {{ ownerIndex: string, minX: number, minY: number, maxX: number, maxY: number, score: number, centerScore: number, area: number } | undefined}
     */
    static #findBestOwnerBoundsMatch(ownerBounds, x, y) {
        return [...ownerBounds.values()]
            .map((bounds) => ({
                ...bounds,
                score: SchematicMultipartOwnerMatcher.#scoreOwnerBoundsMatch(
                    bounds,
                    x,
                    y
                ),
                centerScore:
                    SchematicMultipartOwnerMatcher.#scoreOwnerBoundsCenter(
                        bounds,
                        x,
                        y
                    ),
                area: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
            }))
            .sort((left, right) => {
                if (left.score !== right.score) {
                    return left.score - right.score
                }
                if (left.centerScore !== right.centerScore) {
                    return left.centerScore - right.centerScore
                }
                return left.area - right.area
            })[0]
    }

    /**
     * Scores how far one component placement sits outside an owner's overall
     * multipart bounds. Points inside the box score zero.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    static #scoreOwnerBoundsMatch(bounds, x, y) {
        const distanceX =
            x < bounds.minX ? bounds.minX - x : Math.max(0, x - bounds.maxX)
        const distanceY =
            y < bounds.minY ? bounds.minY - y : Math.max(0, y - bounds.maxY)

        return distanceX + distanceY
    }

    /**
     * Scores how close one component placement is to the center of an owner's
     * overall bounds so overlapping matches prefer the most local owner.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    static #scoreOwnerBoundsCenter(bounds, x, y) {
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2

        return Math.abs(centerX - x) + Math.abs(centerY - y)
    }

    /**
     * Scores how closely one component placement matches the corners of one
     * multipart part bounds box. Altium mirrored units can anchor on the
     * right-hand side instead of the default top-left corner.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} x
     * @param {number} y
     * @param {boolean} isMirrored
     * @param {string} currentPartId
     * @returns {number}
     */
    static #scoreBoundsAnchor(bounds, x, y, isMirrored, currentPartId) {
        const midpointY = (bounds.minY + bounds.maxY) / 2
        const scores = []

        scores.push(Math.abs(bounds.minX - x) + Math.abs(bounds.minY - y))

        if (
            SchematicMultipartOwnerMatcher.#isCompactHorizontalMultipart(
                bounds
            ) &&
            bounds.leftPinLength > 0
        ) {
            scores.push(
                Math.abs(bounds.minX - bounds.leftPinLength - x) +
                    Math.abs(midpointY - y)
            )
        }

        if (isMirrored) {
            scores.push(
                Math.abs(bounds.maxX - x) + Math.abs(bounds.minY - y),
                Math.abs(bounds.maxX - x) + Math.abs(bounds.maxY - y)
            )

            if (bounds.rightPinLength > 0) {
                scores.push(
                    Math.abs(bounds.maxX + bounds.rightPinLength - x) +
                        Math.abs(midpointY - y)
                )
            }
        }

        return Math.min(...scores)
    }

    /**
     * Collects the left pin length for one raw schematic pin record.
     * @param {Record<string, string | string[]>} fields
     * @returns {number}
     */
    static #collectLeftPinLength(fields) {
        if (getField(fields, 'RECORD') !== '2') {
            return 0
        }

        const pinLength = parseNumericField(fields, 'PinLength')
        const orientation =
            SchematicMultipartOwnerMatcher.#inferSchematicPinOrientation(
                parseNumericField(fields, 'PinConglomerate')
            )

        if (pinLength === null || pinLength <= 0 || orientation !== 'left') {
            return 0
        }

        return pinLength
    }

    /**
     * Collects the right pin length for one raw schematic pin record.
     * @param {Record<string, string | string[]>} fields
     * @returns {number}
     */
    static #collectRightPinLength(fields) {
        if (getField(fields, 'RECORD') !== '2') {
            return 0
        }

        const pinLength = parseNumericField(fields, 'PinLength')
        const orientation =
            SchematicMultipartOwnerMatcher.#inferSchematicPinOrientation(
                parseNumericField(fields, 'PinConglomerate')
            )

        if (pinLength === null || pinLength <= 0 || orientation !== 'right') {
            return 0
        }

        return pinLength
    }

    /**
     * Returns true when one owner bounds box looks like a compact horizontal
     * passive multipart unit anchored from its left pin endpoint.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #isCompactHorizontalMultipart(bounds) {
        const width = bounds.maxX - bounds.minX
        const height = bounds.maxY - bounds.minY

        return width <= 30 && height <= 20 && width > height
    }

    /**
     * Maps raw pin conglomerates into schematic pin orientations.
     * @param {number | null} conglomerate
     * @returns {'left' | 'right' | 'top' | 'bottom' | null}
     */
    static #inferSchematicPinOrientation(conglomerate) {
        switch (conglomerate) {
            case 34:
            case 42:
            case 50:
            case 58:
                return 'left'
            case 32:
            case 40:
            case 48:
            case 56:
                return 'right'
            case 35:
            case 51:
            case 59:
                return 'top'
            case 33:
            case 49:
            case 57:
                return 'bottom'
            default:
                return null
        }
    }
}
