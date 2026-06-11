// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves standard schematic sheet-style display overrides.
 */
export class SchematicSheetStyleResolver {
    /**
     * Resolves the displayed horizontal sheet-zone count after the page size
     * has been normalized.
     * @param {{ width: number, height: number, xZones: number, paperSize?: string, sheetStyle?: number }} sheet
     * @returns {number}
     */
    static resolveXZones(sheet) {
        const configuredXZones = Math.max(Number(sheet?.xZones || 0), 1)
        const paperSize = String(sheet?.paperSize || '')
            .trim()
            .toUpperCase()

        if (Number(sheet?.sheetStyle || 0) !== 1 && !paperSize) {
            return configuredXZones
        }

        const width = Number(sheet?.width || 0)
        const height = Number(sheet?.height || 0)
        if (width < height) {
            return configuredXZones
        }

        if (
            paperSize === 'A2' ||
            (width === 2339 && height === 1654) ||
            paperSize === 'A3' ||
            (width === 1654 && height === 1169)
        ) {
            return 8
        }

        if (paperSize === 'A4' || (width === 1169 && height === 827)) {
            return 4
        }

        return configuredXZones
    }

    /**
     * Resolves the displayed vertical sheet-zone count after the page size
     * has been normalized.
     * @param {{ width: number, height: number, yZones: number, paperSize?: string, sheetStyle?: number }} sheet
     * @returns {number}
     */
    static resolveYZones(sheet) {
        const configuredYZones = Math.max(Number(sheet?.yZones || 0), 1)
        const paperSize = String(sheet?.paperSize || '')
            .trim()
            .toUpperCase()

        if (Number(sheet?.sheetStyle || 0) !== 1 && !paperSize) {
            return configuredYZones
        }

        const width = Number(sheet?.width || 0)
        const height = Number(sheet?.height || 0)
        if (height < width) {
            return configuredYZones
        }

        if (
            paperSize === 'A2' ||
            (width === 1654 && height === 2339) ||
            paperSize === 'A3' ||
            (width === 1169 && height === 1654)
        ) {
            return 8
        }

        if (paperSize === 'A4' || (width === 827 && height === 1169)) {
            return 4
        }

        return configuredYZones
    }
}
