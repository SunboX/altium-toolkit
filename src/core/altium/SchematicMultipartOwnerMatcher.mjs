// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils
const WIRED_PART_MIN_SCORE = 2
const WIRED_PART_DOMINANCE_RATIO = 2

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
        const ownerlessConnectionPoints =
            SchematicMultipartOwnerMatcher.#collectOwnerlessConnectionPoints(
                records
            )

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
            const directOwnerIndex =
                SchematicMultipartOwnerMatcher.#findSerializedOwnerIndex(
                    records,
                    index
                )

            if (!directOwnerIndex) {
                continue
            }

            if (!currentPartId || partCount <= 1) {
                directOwnerIndexesByRecord.set(record, directOwnerIndex)
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
            const directOwnerIndex = directOwnerIndexesByRecord.get(record)

            if (!currentPartId || partCount <= 1 || x === null || y === null) {
                const inferredPartId =
                    SchematicMultipartOwnerMatcher.#inferWiredMultipartOwnerPart(
                        records,
                        directOwnerIndex,
                        ownerlessConnectionPoints
                    )
                if (directOwnerIndex && inferredPartId) {
                    activeOwnerParts.set(directOwnerIndex, inferredPartId)
                }
                continue
            }

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
     * Infers the visible part for malformed multipart owners from routed pin
     * endpoint evidence. This only applies when one part clearly owns the
     * external wire connections, avoiding guesses for ambiguous overlaps.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string | undefined} ownerIndex
     * @param {{ x: number, y: number }[]} ownerlessConnectionPoints
     * @returns {string}
     */
    static #inferWiredMultipartOwnerPart(
        records,
        ownerIndex,
        ownerlessConnectionPoints
    ) {
        const normalizedOwnerIndex = String(ownerIndex || '').trim()
        if (!normalizedOwnerIndex || !ownerlessConnectionPoints.length) {
            return ''
        }

        const scores =
            SchematicMultipartOwnerMatcher.#scoreWiredMultipartOwnerParts(
                records,
                normalizedOwnerIndex,
                ownerlessConnectionPoints
            )
        if (scores.size < 2) {
            return ''
        }

        const rankedScores = [...scores.entries()].sort((left, right) => {
            if (left[1] !== right[1]) {
                return right[1] - left[1]
            }

            return Number(left[0]) - Number(right[0])
        })
        const [bestPartId, bestScore] = rankedScores[0] || ['', 0]
        const secondScore = rankedScores[1]?.[1] || 0

        if (bestScore < WIRED_PART_MIN_SCORE) {
            return ''
        }

        if (
            secondScore > 0 &&
            bestScore < secondScore * WIRED_PART_DOMINANCE_RATIO
        ) {
            return ''
        }

        return bestPartId
    }

    /**
     * Scores owner parts by the number of pin endpoints touching ownerless
     * wire endpoints or vertices.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string} ownerIndex
     * @param {{ x: number, y: number }[]} ownerlessConnectionPoints
     * @returns {Map<string, number>}
     */
    static #scoreWiredMultipartOwnerParts(
        records,
        ownerIndex,
        ownerlessConnectionPoints
    ) {
        const scores = new Map()

        for (const record of records || []) {
            if (
                getField(record.fields, 'RECORD') !== '2' ||
                getField(record.fields, 'OwnerIndex') !== ownerIndex
            ) {
                continue
            }

            const ownerPartId = getField(record.fields, 'OwnerPartId')
            if (!ownerPartId || ownerPartId === '-1') {
                continue
            }

            if (!scores.has(ownerPartId)) {
                scores.set(ownerPartId, 0)
            }

            const endpoint =
                SchematicMultipartOwnerMatcher.#resolvePinConnectionPoint(
                    record.fields
                )
            if (
                endpoint &&
                SchematicMultipartOwnerMatcher.#pointTouchesAnyConnectionPoint(
                    endpoint,
                    ownerlessConnectionPoints
                )
            ) {
                scores.set(ownerPartId, scores.get(ownerPartId) + 1)
            }
        }

        return scores
    }

    /**
     * Collects ownerless schematic wire endpoints and vertices.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number }[]}
     */
    static #collectOwnerlessConnectionPoints(records) {
        const points = []

        for (const record of records || []) {
            if (getField(record.fields, 'OwnerIndex')) {
                continue
            }

            const recordType = getField(record.fields, 'RECORD')
            if (
                recordType === '6' ||
                recordType === '26' ||
                recordType === '27'
            ) {
                points.push(
                    ...SchematicMultipartOwnerMatcher.#collectSchematicWirePoints(
                        record.fields
                    )
                )
                continue
            }

            if (recordType !== '13') {
                continue
            }

            const locationX = parseNumericField(record.fields, 'Location.X')
            const locationY = parseNumericField(record.fields, 'Location.Y')
            const cornerX = parseNumericField(record.fields, 'Corner.X')
            const cornerY = parseNumericField(record.fields, 'Corner.Y')

            if (locationX !== null && locationY !== null) {
                points.push({ x: locationX, y: locationY })
            }

            if (cornerX !== null && cornerY !== null) {
                points.push({ x: cornerX, y: cornerY })
            }
        }

        return points
    }

    /**
     * Collects polyline vertices while preserving omitted unchanged axes.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number }[]}
     */
    static #collectSchematicWirePoints(fields) {
        const locationCount = parseNumericField(fields, 'LocationCount')
        const points = []
        let previousX = null
        let previousY = null

        if (locationCount === null || locationCount < 2) {
            return points
        }

        for (let index = 1; index <= locationCount; index += 1) {
            const x = parseNumericField(fields, 'X' + index)
            const y = parseNumericField(fields, 'Y' + index)

            if (x === null && y === null) {
                break
            }

            const pointX = x === null ? previousX : x
            const pointY = y === null ? previousY : y

            if (pointX === null || pointY === null) {
                break
            }

            points.push({ x: pointX, y: pointY })
            previousX = pointX
            previousY = pointY
        }

        return points
    }

    /**
     * Resolves the external route endpoint for one raw pin record.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number } | null}
     */
    static #resolvePinConnectionPoint(fields) {
        const x = parseNumericField(fields, 'Location.X')
        const y = parseNumericField(fields, 'Location.Y')
        const length = parseNumericField(fields, 'PinLength')
        const orientation =
            SchematicMultipartOwnerMatcher.#inferPinConnectionOrientation(
                parseNumericField(fields, 'PinConglomerate')
            )

        if (x === null || y === null || length === null || !orientation) {
            return null
        }

        switch (orientation) {
            case 'right':
                return { x: x + length, y }
            case 'left':
                return { x: x - length, y }
            case 'top':
                return { x, y: y + length }
            case 'bottom':
                return { x, y: y - length }
            default:
                return null
        }
    }

    /**
     * Returns true when one point matches any known connection point.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} connectionPoints
     * @returns {boolean}
     */
    static #pointTouchesAnyConnectionPoint(point, connectionPoints) {
        const tolerance = 0.01

        return connectionPoints.some(
            (connectionPoint) =>
                Math.abs(connectionPoint.x - point.x) <= tolerance &&
                Math.abs(connectionPoint.y - point.y) <= tolerance
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

    /**
     * Maps raw pin conglomerates into external endpoint orientations.
     * @param {number | null} conglomerate
     * @returns {'left' | 'right' | 'top' | 'bottom' | null}
     */
    static #inferPinConnectionOrientation(conglomerate) {
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
            case 33:
            case 49:
            case 57:
                return 'top'
            case 35:
            case 51:
            case 59:
                return 'bottom'
            default:
                return null
        }
    }
}
