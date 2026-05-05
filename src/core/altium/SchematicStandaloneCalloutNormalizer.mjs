/**
 * Normalizes tiny free-standing dashed note callouts recovered from Altium.
 */
export class SchematicStandaloneCalloutNormalizer {
    /**
     * Expands and repositions tiny standalone dashed callouts so the frame
     * encloses the nearby circuit and the title sits in the top band.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[]} lines
     * @param {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @returns {{ lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[], texts: { x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' }[] }}
     */
    static normalize(lines, texts) {
        const dashedFrames =
            SchematicStandaloneCalloutNormalizer.#collectDashedFrameGroups(
                lines
            )
        const consumedLineIndexes = new Set()
        const replacementLines = []
        const replacementTexts = new Map()

        for (const frame of dashedFrames) {
            const normalizedCallout =
                SchematicStandaloneCalloutNormalizer.#normalizeStandaloneDashedCallout(
                    frame,
                    lines,
                    texts
                )

            if (!normalizedCallout) {
                continue
            }

            frame.indexes.forEach((index) => consumedLineIndexes.add(index))
            replacementLines.push(...normalizedCallout.lines)
            replacementTexts.set(
                normalizedCallout.noteIndex,
                normalizedCallout.noteText
            )
        }

        return {
            lines:
                replacementLines.length > 0
                    ? lines
                          .filter((_, index) => !consumedLineIndexes.has(index))
                          .concat(replacementLines)
                    : lines,
            texts:
                replacementTexts.size > 0
                    ? texts.map(
                          (text, index) => replacementTexts.get(index) || text
                      )
                    : texts
        }
    }

    /**
     * Groups dashed line segments into rectangular frame bounds.
     * @param {{ x1: number, y1: number, x2: number, y2: number, lineStyle?: number }[]} lines
     * @returns {{ bounds: { minX: number, minY: number, maxX: number, maxY: number }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[], indexes: number[] }[]}
     */
    static #collectDashedFrameGroups(lines) {
        const dashedLines = lines.filter(
            (line) => Number(line.lineStyle || 0) === 1
        )
        const dashedIndexes = lines
            .map((line, index) => ({ line, index }))
            .filter(({ line }) => Number(line.lineStyle || 0) === 1)
        const groups = []
        const visited = new Set()

        for (let index = 0; index < dashedLines.length; index += 1) {
            if (visited.has(index)) {
                continue
            }

            const queue = [index]
            const group = []
            visited.add(index)

            while (queue.length > 0) {
                const currentIndex = queue.shift()
                const currentLine = dashedLines[currentIndex]
                group.push(currentLine)

                for (
                    let candidateIndex = 0;
                    candidateIndex < dashedLines.length;
                    candidateIndex += 1
                ) {
                    if (
                        visited.has(candidateIndex) ||
                        !SchematicStandaloneCalloutNormalizer.#linesTouch(
                            currentLine,
                            dashedLines[candidateIndex]
                        )
                    ) {
                        continue
                    }

                    visited.add(candidateIndex)
                    queue.push(candidateIndex)
                }
            }

            const minX = Math.min(
                ...group.flatMap((line) => [line.x1, line.x2])
            )
            const maxX = Math.max(
                ...group.flatMap((line) => [line.x1, line.x2])
            )
            const minY = Math.min(
                ...group.flatMap((line) => [line.y1, line.y2])
            )
            const maxY = Math.max(
                ...group.flatMap((line) => [line.y1, line.y2])
            )

            if (group.length >= 4 && maxX > minX && maxY > minY) {
                groups.push({
                    bounds: { minX, minY, maxX, maxY },
                    lines: group,
                    indexes: group.map(
                        (line) =>
                            dashedIndexes.find(
                                ({ line: candidate }) => candidate === line
                            )?.index
                    )
                })
            }
        }

        return groups
    }

    /**
     * Returns a normalized callout replacement for one tiny free-standing
     * dashed frame, or null when the frame is not the bootstrap-note pattern.
     * @param {{ bounds: { minX: number, minY: number, maxX: number, maxY: number }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[], indexes: number[] }} frame
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[]} lines
     * @param {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @returns {{ lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[], noteIndex: number, noteText: { x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' } } | null}
     */
    static #normalizeStandaloneDashedCallout(frame, lines, texts) {
        const frameWidth = frame.bounds.maxX - frame.bounds.minX
        const frameHeight = frame.bounds.maxY - frame.bounds.minY

        if (
            frameWidth > 120 ||
            frameHeight > 60 ||
            frame.lines.some((line) => line.ownerIndex)
        ) {
            return null
        }

        const noteIndex = texts.findIndex(
            (text) =>
                text &&
                text.recordType === '4' &&
                !text.ownerIndex &&
                Number(text.fontSize || 0) <= 10 &&
                text.x >= frame.bounds.minX - 2 &&
                text.x <= frame.bounds.maxX + 2 &&
                text.y >= frame.bounds.minY - 2 &&
                text.y <= frame.bounds.maxY + 2
        )

        if (noteIndex < 0) {
            return null
        }

        const noteText = texts[noteIndex]
        const relatedOwnerIndexes =
            SchematicStandaloneCalloutNormalizer.#collectNearbyCalloutOwnerIndexes(
                noteText,
                frame.bounds,
                texts
            )

        if (!relatedOwnerIndexes.size) {
            return null
        }

        const contentBounds =
            SchematicStandaloneCalloutNormalizer.#collectStandaloneCalloutContentBounds(
                noteText,
                frame.bounds,
                relatedOwnerIndexes,
                lines,
                texts
            )

        if (!contentBounds) {
            return null
        }

        const titleBounds =
            SchematicStandaloneCalloutNormalizer.#estimateTextBounds(noteText)
        const horizontalCenter = (contentBounds.minX + contentBounds.maxX) / 2
        const calloutWidth = Math.max(
            frameWidth + 20,
            contentBounds.maxX - contentBounds.minX + 40,
            titleBounds.maxX - titleBounds.minX + 16
        )
        const minX = Math.round(horizontalCenter - calloutWidth / 2)
        const maxX = Math.round(horizontalCenter + calloutWidth / 2)
        const maxY = Math.round(
            Math.max(
                contentBounds.maxY + 18,
                noteText.y + Number(noteText.fontSize || 8) * 2 + 14
            )
        )
        const normalizedNoteText = {
            ...noteText,
            x: Math.round((minX + maxX) / 2),
            y: Math.round(maxY - (Number(noteText.fontSize || 8) + 6)),
            anchor: 'middle'
        }
        const minY = Math.round(contentBounds.minY - 10)
        const prototype = frame.lines[0]

        return {
            lines: [
                {
                    ...prototype,
                    x1: minX,
                    y1: maxY,
                    x2: maxX,
                    y2: maxY
                },
                {
                    ...prototype,
                    x1: maxX,
                    y1: maxY,
                    x2: maxX,
                    y2: minY
                },
                {
                    ...prototype,
                    x1: maxX,
                    y1: minY,
                    x2: minX,
                    y2: minY
                },
                {
                    ...prototype,
                    x1: minX,
                    y1: minY,
                    x2: minX,
                    y2: maxY
                }
            ],
            noteIndex,
            noteText: normalizedNoteText
        }
    }

    /**
     * Collects owner indexes for designator/value texts immediately below a
     * tiny standalone dashed note.
     * @param {{ x: number, y: number }} noteText
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} frameBounds
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string }[]} texts
     * @returns {Set<string>}
     */
    static #collectNearbyCalloutOwnerIndexes(noteText, frameBounds, texts) {
        const relatedTexts = texts.filter((text) => {
            const normalizedName = String(text?.name || '')
                .trim()
                .toLowerCase()

            return (
                text &&
                text.ownerIndex &&
                (normalizedName === 'designator' ||
                    normalizedName === 'value') &&
                text.x >= frameBounds.minX - 20 &&
                text.x <= noteText.x + 40 &&
                text.y >= frameBounds.minY - 20 &&
                text.y <= frameBounds.maxY + 20
            )
        })

        return new Set(relatedTexts.map((text) => text.ownerIndex))
    }

    /**
     * Collects the visible content bounds a standalone dashed callout should
     * enclose.
     * @param {{ x: number, y: number }} noteText
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} frameBounds
     * @param {Set<string>} relatedOwnerIndexes
     * @param {{ x1: number, y1: number, x2: number, y2: number, lineStyle?: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, text: string, ownerIndex?: string, recordType?: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #collectStandaloneCalloutContentBounds(
        noteText,
        frameBounds,
        relatedOwnerIndexes,
        lines,
        texts
    ) {
        const localWindow = {
            minX: frameBounds.minX - 20,
            minY: frameBounds.minY - 6,
            maxX: frameBounds.maxX + 20,
            maxY: frameBounds.maxY + 10
        }
        const contentLines = lines.filter((line) => {
            if (Number(line.lineStyle || 0) === 1) {
                return false
            }

            const lineBounds = {
                minX: Math.min(line.x1, line.x2),
                minY: Math.min(line.y1, line.y2),
                maxX: Math.max(line.x1, line.x2),
                maxY: Math.max(line.y1, line.y2)
            }

            if (
                !SchematicStandaloneCalloutNormalizer.#boundsOverlap(
                    lineBounds,
                    localWindow
                )
            ) {
                return false
            }

            if (relatedOwnerIndexes.has(String(line.ownerIndex || ''))) {
                return true
            }

            return (
                !line.ownerIndex &&
                SchematicStandaloneCalloutNormalizer.#lineEndpointsStayWithinBounds(
                    line,
                    localWindow
                )
            )
        })
        const contentTexts = texts.filter((text) => {
            if (!text || text.recordType === '4') {
                return false
            }

            if (
                text.ownerIndex &&
                !relatedOwnerIndexes.has(String(text.ownerIndex || ''))
            ) {
                return false
            }

            const normalizedName = String(text.name || '')
                .trim()
                .toLowerCase()
            if (
                text.ownerIndex &&
                (normalizedName === 'value' || normalizedName === 'comment') &&
                Number(text.y) < frameBounds.minY
            ) {
                return false
            }

            return SchematicStandaloneCalloutNormalizer.#boundsOverlap(
                SchematicStandaloneCalloutNormalizer.#estimateTextBounds(text),
                localWindow
            )
        })

        return SchematicStandaloneCalloutNormalizer.#collectPrimitiveBounds(
            contentLines,
            contentTexts
        )
    }

    /**
     * Collects one union bounds object from line and text primitives.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, text: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #collectPrimitiveBounds(lines, texts) {
        if (!lines.length && !texts.length) {
            return null
        }

        const bounds = {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY
        }

        for (const line of lines) {
            bounds.minX = Math.min(bounds.minX, line.x1, line.x2)
            bounds.minY = Math.min(bounds.minY, line.y1, line.y2)
            bounds.maxX = Math.max(bounds.maxX, line.x1, line.x2)
            bounds.maxY = Math.max(bounds.maxY, line.y1, line.y2)
        }

        for (const text of texts) {
            const textBounds =
                SchematicStandaloneCalloutNormalizer.#estimateTextBounds(text)
            bounds.minX = Math.min(bounds.minX, textBounds.minX)
            bounds.minY = Math.min(bounds.minY, textBounds.minY)
            bounds.maxX = Math.max(bounds.maxX, textBounds.maxX)
            bounds.maxY = Math.max(bounds.maxY, textBounds.maxY)
        }

        return bounds
    }

    /**
     * Returns true when both endpoints stay inside the provided local window.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #lineEndpointsStayWithinBounds(line, bounds) {
        return (
            (SchematicStandaloneCalloutNormalizer.#boundsContainPoint(bounds, {
                x: line.x1,
                y: line.y1
            }) ||
                false) &&
            SchematicStandaloneCalloutNormalizer.#boundsContainPoint(bounds, {
                x: line.x2,
                y: line.y2
            })
        )
    }

    /**
     * Returns true when one point lies inside axis-aligned bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #boundsContainPoint(bounds, point) {
        return (
            point.x >= bounds.minX &&
            point.x <= bounds.maxX &&
            point.y >= bounds.minY &&
            point.y <= bounds.maxY
        )
    }

    /**
     * Approximates schematic text bounds using the serif width factors already
     * used by the SVG renderers.
     * @param {{ x: number, y: number, text: string, fontSize?: number, anchor?: 'start' | 'middle' | 'end' }} text
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #estimateTextBounds(text) {
        const fontSize = Number(text.fontSize || 10)
        const width = SchematicStandaloneCalloutNormalizer.#estimateTextWidth(
            text.text,
            fontSize
        )
        let minX = Number(text.x)
        let maxX = Number(text.x)

        if (text.anchor === 'middle') {
            minX -= width / 2
            maxX += width / 2
        } else if (text.anchor === 'end') {
            minX -= width
        } else {
            maxX += width
        }

        return {
            minX,
            minY: Number(text.y) - fontSize * 0.4,
            maxX,
            maxY: Number(text.y) + fontSize * 0.8
        }
    }

    /**
     * Estimates serif text width for one recovered schematic label.
     * @param {string} text
     * @param {number} fontSize
     * @returns {number}
     */
    static #estimateTextWidth(text, fontSize) {
        let width = 0

        for (const character of String(text || '')) {
            width +=
                SchematicStandaloneCalloutNormalizer.#measureCharacterWidth(
                    character
                ) * fontSize
        }

        return width
    }

    /**
     * Returns a rough Times New Roman width factor for one character.
     * @param {string} character
     * @returns {number}
     */
    static #measureCharacterWidth(character) {
        if (/\s/.test(character)) return 0.32
        if (/[.,;:!|]/.test(character)) return 0.24
        if (/[()[\]{}]/.test(character)) return 0.32
        if (/[-+/\\]/.test(character)) return 0.36
        if (/[MW@#%&]/.test(character)) return 0.82
        if (/[A-Z]/.test(character)) return 0.62
        if (/[a-z0-9]/.test(character)) return 0.5
        if (/[^ -~]/.test(character)) return 0.92

        return 0.56
    }

    /**
     * Returns true when two axis-aligned bounds overlap.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} left
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} right
     * @returns {boolean}
     */
    static #boundsOverlap(left, right) {
        return !(
            left.maxX < right.minX ||
            left.minX > right.maxX ||
            left.maxY < right.minY ||
            left.minY > right.maxY
        )
    }

    /**
     * Clips one axis-aligned bounds object to an enclosing window.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} window
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #clipBoundsToWindow(bounds, window) {
        return {
            minX: Math.max(bounds.minX, window.minX),
            minY: Math.max(bounds.minY, window.minY),
            maxX: Math.min(bounds.maxX, window.maxX),
            maxY: Math.min(bounds.maxY, window.maxY)
        }
    }

    /**
     * Returns true when two line segments touch at any endpoint.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} left
     * @param {{ x1: number, y1: number, x2: number, y2: number }} right
     * @returns {boolean}
     */
    static #linesTouch(left, right) {
        return (
            SchematicStandaloneCalloutNormalizer.#pointsMatch(
                { x: left.x1, y: left.y1 },
                { x: right.x1, y: right.y1 }
            ) ||
            SchematicStandaloneCalloutNormalizer.#pointsMatch(
                { x: left.x1, y: left.y1 },
                { x: right.x2, y: right.y2 }
            ) ||
            SchematicStandaloneCalloutNormalizer.#pointsMatch(
                { x: left.x2, y: left.y2 },
                { x: right.x1, y: right.y1 }
            ) ||
            SchematicStandaloneCalloutNormalizer.#pointsMatch(
                { x: left.x2, y: left.y2 },
                { x: right.x2, y: right.y2 }
            )
        )
    }

    /**
     * Returns true when two points coincide within schematic tolerance.
     * @param {{ x: number, y: number }} left
     * @param {{ x: number, y: number }} right
     * @returns {boolean}
     */
    static #pointsMatch(left, right) {
        return (
            Math.abs(Number(left.x) - Number(right.x)) <= 2 &&
            Math.abs(Number(left.y) - Number(right.y)) <= 2
        )
    }
}
