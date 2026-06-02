// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shared typography helpers for synthetic schematic SVG labels.
 */
export class SchematicTypography {
    /**
     * Returns true when the schematic already contains a visible designator text
     * close to one component origin.
     * @param {{ x?: number, y?: number }} component
     * @param {{ x: number, y: number, name?: string }[]} texts
     * @returns {boolean}
     */
    static hasNearbyVisibleDesignatorText(component, texts) {
        return texts.some(
            (text) =>
                String(text.name || '')
                    .trim()
                    .toLowerCase() === 'designator' &&
                Math.abs(Number(text.x) - Number(component.x)) <= 80 &&
                Math.abs(Number(text.y) - Number(component.y)) <= 80
        )
    }

    /**
     * Builds the default font options used for synthetic schematic labels.
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean, italic?: boolean }> }} sheet
     * @returns {{ fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }}
     */
    static buildDefaultSchematicFontOptions(sheet) {
        const font = sheet?.fonts?.['1'] || {
            size: 10,
            family: 'Times New Roman',
            bold: false,
            italic: false
        }

        return {
            fontSize: SchematicTypography.#toSvgFontSize(font.size),
            fontFamily: font.family || 'Times New Roman',
            fontWeight: font.bold ? 700 : 400,
            fontStyle: font.italic ? 'italic' : undefined
        }
    }

    /**
     * Builds default font options with the viewer-wide one-point reduction
     * already applied.
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean, italic?: boolean }> }} sheet
     * @returns {{ fontSize: number | undefined, fontFamily: string, fontWeight: number, fontStyle?: string }}
     */
    static buildViewerSchematicFontOptions(sheet) {
        return SchematicTypography.withViewerFontSize(
            SchematicTypography.buildDefaultSchematicFontOptions(sheet)
        )
    }

    /**
     * Builds render options for one schematic text label, including the signed
     * SVG rotation derived from the original Altium orientation and mirrored
     * source state.
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number, sourceOrientation?: number, isMirrored?: boolean }} text
     * @returns {{ fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number }}
     */
    static buildSchematicTextRenderOptions(text) {
        return {
            fontSize: SchematicTypography.resolveViewerFontSize(text.fontSize),
            fontFamily: text.fontFamily,
            fontWeight: text.fontWeight,
            fontStyle: text.fontStyle,
            rotation: SchematicTypography.#resolveSignedTextRotation(
                text.rotation,
                text.sourceOrientation,
                text.isMirrored
            )
        }
    }

    /**
     * Applies the viewer-wide one-point text reduction to one option bag.
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number }} options
     * @returns {{ fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number }}
     */
    static withViewerFontSize(options) {
        return {
            ...options,
            fontSize: SchematicTypography.resolveViewerFontSize(
                options?.fontSize
            )
        }
    }

    /**
     * Returns the one-point-smaller font size used for viewer text.
     * @param {number | undefined} size
     * @returns {number | undefined}
     */
    static resolveViewerFontSize(size) {
        const numericSize = Number(size)

        if (!Number.isFinite(numericSize) || numericSize <= 0) {
            return undefined
        }

        return Math.max(numericSize - 1, 1)
    }

    /**
     * Collects number-only owner groups whose top pin numbers should rotate
     * along the vertical pin axis.
     * @param {{ ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @returns {Set<string>}
     */
    static collectRotatedVerticalNumberOwners(pins) {
        const ownerPins = new Map()

        for (const pin of pins) {
            const ownerIndex = String(pin.ownerIndex || '').trim()
            if (!ownerIndex) continue
            if (!ownerPins.has(ownerIndex)) ownerPins.set(ownerIndex, [])
            ownerPins.get(ownerIndex).push(pin)
        }

        return new Set(
            [...ownerPins.entries()]
                .filter(([, groupedPins]) => {
                    const hasTopPin = groupedPins.some(
                        (pin) => pin.orientation === 'top'
                    )
                    const hasHorizontalPins = groupedPins.some(
                        (pin) =>
                            pin.orientation === 'left' ||
                            pin.orientation === 'right'
                    )
                    return (
                        groupedPins.length >= 4 &&
                        hasTopPin &&
                        hasHorizontalPins &&
                        groupedPins.every(
                            (pin) =>
                                (pin.labelMode || 'name-and-number') ===
                                'number-only'
                        )
                    )
                })
                .map(([ownerIndex]) => ownerIndex)
        )
    }

    /**
     * Collects owner/text pairs that already expose explicit pin-name labels as
     * free text primitives, so the pin renderer can avoid duplicating them.
     * @param {{ ownerIndex?: string, recordType?: string, text?: string }[]} texts
     * @returns {Set<string>}
     */
    static collectExplicitOwnerPinNameLabels(texts) {
        return new Set(
            texts
                .filter(
                    (text) =>
                        text &&
                        text.recordType === '4' &&
                        String(text.ownerIndex || '').trim() &&
                        String(text.text || '').trim()
                )
                .map(
                    (text) =>
                        String(text.ownerIndex || '').trim() +
                        '::' +
                        String(text.text || '').trim()
                )
        )
    }

    /**
     * Converts Altium point sizes into SVG font units.
     * @param {number} size
     * @returns {number}
     */
    static #toSvgFontSize(size) {
        return Number(size || 10)
    }

    /**
     * Resolves the signed SVG rotation for one schematic text label.
     * @param {number | undefined} rotation
     * @param {number | undefined} sourceOrientation
     * @param {boolean | undefined} isMirrored
     * @returns {number}
     */
    static #resolveSignedTextRotation(rotation, sourceOrientation, isMirrored) {
        const normalizedRotation = Number(rotation || 0)

        if (!normalizedRotation) {
            return 0
        }

        const signedRotation =
            Number(sourceOrientation || 0) === 3
                ? normalizedRotation
                : -normalizedRotation

        return isMirrored ? -signedRotation : signedRotation
    }
}
