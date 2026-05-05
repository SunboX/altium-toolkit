import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Renders normalized schematic sheet symbols and sheet entries.
 */
export class SchematicSheetSymbolRenderer {
    /**
     * Builds markup for normalized sheet symbols.
     * @param {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean }[]} sheetSymbols
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildSheetSymbolMarkup(sheetSymbols, sheetHeight) {
        return sheetSymbols
            .map((sheetSymbol) =>
                SchematicSheetSymbolRenderer.#buildSingleSheetSymbolMarkup(
                    sheetSymbol,
                    sheetHeight
                )
            )
            .join('')
    }

    /**
     * Builds markup for normalized sheet entries.
     * @param {{ name: string, side: 'left' | 'right' | 'top' | 'bottom', x: number, y: number, color: string, fill: string, textColor: string }} sheetEntries
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildSheetEntryMarkup(sheetEntries, sheetHeight) {
        return sheetEntries
            .map((sheetEntry) =>
                SchematicSheetSymbolRenderer.#buildSingleSheetEntryMarkup(
                    sheetEntry,
                    sheetHeight
                )
            )
            .join('')
    }

    /**
     * Builds one sheet symbol rectangle.
     * @param {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean }} sheetSymbol
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSingleSheetSymbolMarkup(sheetSymbol, sheetHeight) {
        const fill =
            sheetSymbol.transparent || !sheetSymbol.isSolid
                ? 'none'
                : SchematicColorResolver.resolveFill(
                      sheetSymbol.fill,
                      '--schematic-fill-color'
                  )

        return (
            '<rect class="schematic-sheet-symbol" x="' +
            formatNumber(sheetSymbol.x) +
            '" y="' +
            formatNumber(projectSchematicY(sheetHeight, sheetSymbol.y)) +
            '" width="' +
            formatNumber(sheetSymbol.width) +
            '" height="' +
            formatNumber(sheetSymbol.height) +
            '" fill="' +
            escapeHtml(fill) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    sheetSymbol.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="1" />'
        )
    }

    /**
     * Builds one sheet entry shape and label.
     * @param {{ name: string, side: 'left' | 'right' | 'top' | 'bottom', x: number, y: number, color: string, fill: string, textColor: string }} sheetEntry
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSingleSheetEntryMarkup(sheetEntry, sheetHeight) {
        const points =
            SchematicSheetSymbolRenderer.#buildSheetEntryPoints(sheetEntry)
        const projectedPoints = points
            .map(
                (point) =>
                    formatNumber(point.x) +
                    ',' +
                    formatNumber(projectSchematicY(sheetHeight, point.y))
            )
            .join(' ')
        const labelPlacement =
            SchematicSheetSymbolRenderer.#resolveSheetEntryLabelPlacement(
                sheetEntry,
                sheetHeight
            )

        return (
            '<g class="schematic-sheet-entry">' +
            '<polygon class="schematic-sheet-entry-shape" points="' +
            escapeHtml(projectedPoints) +
            '" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveFill(
                    sheetEntry.fill,
                    '--schematic-fill-color'
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    sheetEntry.color,
                    '--schematic-port-color'
                )
            ) +
            '" stroke-width="1" />' +
            createSvgText(
                'schematic-sheet-entry-label',
                labelPlacement.x,
                labelPlacement.y,
                sheetEntry.name,
                SchematicColorResolver.resolveColor(
                    sheetEntry.textColor,
                    '--schematic-text-color'
                ),
                labelPlacement.anchor,
                {
                    fontSize: 10,
                    fontFamily: 'Times New Roman'
                }
            ) +
            '</g>'
        )
    }

    /**
     * Builds one simple entry polygon from its edge anchor.
     * @param {{ side: 'left' | 'right' | 'top' | 'bottom', x: number, y: number }} sheetEntry
     * @returns {{ x: number, y: number }[]}
     */
    static #buildSheetEntryPoints(sheetEntry) {
        const arm = 25
        const halfHeight = 5

        switch (sheetEntry.side) {
            case 'right':
                return [
                    { x: sheetEntry.x, y: sheetEntry.y },
                    { x: sheetEntry.x + 8, y: sheetEntry.y - halfHeight },
                    { x: sheetEntry.x + arm, y: sheetEntry.y - halfHeight },
                    { x: sheetEntry.x + arm, y: sheetEntry.y + halfHeight },
                    { x: sheetEntry.x + 8, y: sheetEntry.y + halfHeight }
                ]
            case 'top':
                return [
                    { x: sheetEntry.x, y: sheetEntry.y },
                    { x: sheetEntry.x - halfHeight, y: sheetEntry.y + 8 },
                    { x: sheetEntry.x - halfHeight, y: sheetEntry.y + arm },
                    { x: sheetEntry.x + halfHeight, y: sheetEntry.y + arm },
                    { x: sheetEntry.x + halfHeight, y: sheetEntry.y + 8 }
                ]
            case 'bottom':
                return [
                    { x: sheetEntry.x, y: sheetEntry.y },
                    { x: sheetEntry.x - halfHeight, y: sheetEntry.y - 8 },
                    { x: sheetEntry.x - halfHeight, y: sheetEntry.y - arm },
                    { x: sheetEntry.x + halfHeight, y: sheetEntry.y - arm },
                    { x: sheetEntry.x + halfHeight, y: sheetEntry.y - 8 }
                ]
            case 'left':
            default:
                return [
                    { x: sheetEntry.x, y: sheetEntry.y },
                    { x: sheetEntry.x - 8, y: sheetEntry.y - halfHeight },
                    { x: sheetEntry.x - arm, y: sheetEntry.y - halfHeight },
                    { x: sheetEntry.x - arm, y: sheetEntry.y + halfHeight },
                    { x: sheetEntry.x - 8, y: sheetEntry.y + halfHeight }
                ]
        }
    }

    /**
     * Resolves sheet-entry label placement.
     * @param {{ side: 'left' | 'right' | 'top' | 'bottom', x: number, y: number }} sheetEntry
     * @param {number} sheetHeight
     * @returns {{ x: number, y: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #resolveSheetEntryLabelPlacement(sheetEntry, sheetHeight) {
        switch (sheetEntry.side) {
            case 'right':
                return {
                    x: sheetEntry.x + 30,
                    y: projectSchematicY(sheetHeight, sheetEntry.y) + 3,
                    anchor: 'start'
                }
            case 'top':
                return {
                    x: sheetEntry.x + 8,
                    y: projectSchematicY(sheetHeight, sheetEntry.y + 30),
                    anchor: 'start'
                }
            case 'bottom':
                return {
                    x: sheetEntry.x + 8,
                    y: projectSchematicY(sheetHeight, sheetEntry.y - 12),
                    anchor: 'start'
                }
            case 'left':
            default:
                return {
                    x: sheetEntry.x - 30,
                    y: projectSchematicY(sheetHeight, sheetEntry.y) + 3,
                    anchor: 'end'
                }
        }
    }
}
