// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const {
    basename,
    buildCurrentDateValue,
    createSvgText,
    formatNumber,
    projectSchematicY
} = SchematicSvgUtils

/**
 * Renders synthesized sheet border, zones, and title-block chrome.
 */
export class SchematicSheetChromeRenderer {
    /**
     * Builds page border and title-block chrome from sheet metadata.
     * @param {number} width
     * @param {number} height
     * @param {{ borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, paperSize?: string, sourceWidth?: number, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> } }} sheet
     * @param {string | undefined} fileName
     * @returns {string}
     */
    static buildMarkup(width, height, sheet, fileName) {
        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        let markup = SchematicSheetChromeRenderer.#buildSheetZoneMarkup(
            width,
            height,
            margin,
            sheet
        )

        if (sheet?.borderOn) {
            markup +=
                '<rect class="sheet-frame" x="' +
                formatNumber(margin) +
                '" y="' +
                formatNumber(margin) +
                '" width="' +
                formatNumber(Math.max(width - margin * 2, 10)) +
                '" height="' +
                formatNumber(Math.max(height - margin * 2, 10)) +
                '" />'
        }

        if (!sheet?.titleBlockOn) {
            return markup
        }

        const titleBlock = sheet?.titleBlock || {}
        const resolvedTitleBlock =
            SchematicSheetChromeRenderer.#resolveRenderedTitleBlock(
                width,
                sheet,
                titleBlock
            )
        const titleBlockLayout =
            SchematicSheetChromeRenderer.#resolveSheetTitleBlockLayout(
                width,
                height,
                margin,
                resolvedTitleBlock
            )
        const renderedFileName = basename(fileName)
        const renderedDate = resolvedTitleBlock.date || buildCurrentDateValue()

        const titleBlockMarkup =
            SchematicSheetChromeRenderer.#shouldUseHintedStandardLayout(
                sheet,
                resolvedTitleBlock
            )
                ? SchematicSheetChromeRenderer.#buildHintedStandardTitleBlockMarkup(
                      titleBlockLayout,
                      sheet,
                      height,
                      resolvedTitleBlock,
                      renderedDate,
                      renderedFileName
                  )
                : SchematicSheetChromeRenderer.#buildGenericTitleBlockMarkup(
                      titleBlockLayout,
                      sheet,
                      height,
                      resolvedTitleBlock,
                      renderedDate,
                      renderedFileName
                  )

        return markup + titleBlockMarkup
    }

    /**
     * Resolves the synthesized title-block bounds, using recovered footer
     * value hints when the source file exposes them.
     * @param {number} width
     * @param {{ sourceWidth?: number }} sheet
     * @param {{ title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }} titleBlock
     * @returns {{ title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }}
     */
    static #resolveRenderedTitleBlock(width, sheet, titleBlock) {
        const footerHints = titleBlock?.footerHints
        const sourceWidth = Number(sheet?.sourceWidth || 0)

        if (!footerHints || !sourceWidth || width <= sourceWidth) {
            return titleBlock
        }

        const maxHintX = Math.max(
            ...Object.values(footerHints).map((hint) => Number(hint?.x || 0))
        )

        if (maxHintX > sourceWidth) {
            return titleBlock
        }

        const footerOffsetX = width - sourceWidth

        return {
            ...titleBlock,
            footerHints: Object.fromEntries(
                Object.entries(footerHints).map(([key, hint]) => [
                    key,
                    hint
                        ? {
                              ...hint,
                              x: Number(hint.x || 0) + footerOffsetX
                          }
                        : hint
                ])
            )
        }
    }

    /**
     * Resolves the synthesized title-block bounds, using recovered footer
     * value hints when the source file exposes them.
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @param {{ footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number }>> }} titleBlock
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    static #resolveSheetTitleBlockLayout(width, height, margin, titleBlock) {
        const defaultWidth = Math.min(
            Math.max(width - margin * 2, 100),
            Math.max(Math.min(480, width * 0.34), 140)
        )
        const defaultHeight = Math.min(
            Math.max(height - margin * 2, 100),
            Math.max(Math.min(138, height * 0.18), 102)
        )
        const footerHints = Object.values(titleBlock?.footerHints || {})

        if (footerHints.length < 3) {
            return {
                x: width - margin - defaultWidth,
                y: height - margin - defaultHeight,
                width: defaultWidth,
                height: defaultHeight
            }
        }

        const minX = Math.min(...footerHints.map((hint) => Number(hint.x || 0)))
        const maxX = Math.max(...footerHints.map((hint) => Number(hint.x || 0)))
        const maxY = Math.max(...footerHints.map((hint) => Number(hint.y || 0)))
        const x = Math.max(minX - 120, margin)
        const titleBlockWidth = Math.max(width - margin - x, 280)
        const topDocY = Math.max(maxY + 18, margin + 52)
        const titleBlockHeight = Math.max(topDocY - margin, 72)

        return {
            x,
            y: projectSchematicY(height, topDocY),
            width: titleBlockWidth,
            height: titleBlockHeight
        }
    }

    /**
     * Returns true when the recovered footer hints expose enough of the
     * standard footer to rebuild the corrected compact footer chrome.
     * @param {{ paperSize?: string } | undefined} sheet
     * @param {{ footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number }>> }} titleBlock
     * @returns {boolean}
     */
    static #shouldUseHintedStandardLayout(sheet, titleBlock) {
        const footerHints = titleBlock?.footerHints || {}

        return Boolean(
            footerHints.title &&
            footerHints.revision &&
            (footerHints.documentNumber ||
                footerHints.sheetNumber ||
                footerHints.sheetTotal)
        )
    }

    /**
     * Builds the corrected compact title-block chrome from recovered footer
     * hints.
     * @param {{ x: number, y: number, width: number, height: number }} layout
     * @param {{ paperSize?: string }} sheet
     * @param {number} sheetHeight
     * @param {{ title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }} titleBlock
     * @param {string} renderedDate
     * @param {string} renderedFileName
     * @returns {string}
     */
    static #buildHintedStandardTitleBlockMarkup(
        layout,
        sheet,
        sheetHeight,
        titleBlock,
        renderedDate,
        renderedFileName
    ) {
        const x = layout.x
        const y = layout.y
        const titleBlockWidth = layout.width
        const titleBlockHeight = layout.height
        const titleLabelY = y + titleBlockHeight * 0.16
        const titleValueY = y + titleBlockHeight * 0.48
        const topRowBottomY = y + titleBlockHeight * 0.5
        const middleRowBottomY = y + titleBlockHeight * 0.75
        const footerRowDividerY = y + titleBlockHeight * 0.875
        const secondRowHeight = middleRowBottomY - topRowBottomY
        const footerTopRowHeight = footerRowDividerY - middleRowBottomY
        const footerBottomRowHeight = y + titleBlockHeight - footerRowDividerY
        const sectionLabelY = topRowBottomY + secondRowHeight * 0.25
        const sectionValueY = topRowBottomY + secondRowHeight * 0.625
        const paperSizeY = topRowBottomY + secondRowHeight * 0.75
        const footerDateY = middleRowBottomY + footerTopRowHeight * 0.65
        const footerFileY = footerRowDividerY + footerBottomRowHeight * 0.65
        const topDividerX = x + titleBlockWidth * 0.67
        const sizeDividerX = x + titleBlockWidth * 0.16
        const revisionDividerX = x + titleBlockWidth * 0.72
        const bottomRightDividerX = x + titleBlockWidth * 0.57
        const labelOptions =
            SchematicSheetChromeRenderer.#resolveTitleBlockLabelOptions(
                titleBlock
            )
        const footerValueOptions =
            SchematicSheetChromeRenderer.#resolveTitleBlockFooterValueOptions(
                titleBlock
            )
        const useLiteralSheetHints =
            String(sheet?.paperSize || '')
                .trim()
                .toUpperCase() === 'A3'
        const sheetTotalHint = useLiteralSheetHints
            ? titleBlock?.footerHints?.sheetTotal
            : undefined

        return (
            '<g class="sheet-title-block">' +
            '<rect x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" width="' +
            formatNumber(titleBlockWidth) +
            '" height="' +
            formatNumber(titleBlockHeight) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(topRowBottomY) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(topRowBottomY) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(middleRowBottomY) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(middleRowBottomY) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(footerRowDividerY) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(footerRowDividerY) +
            '" />' +
            '<line x1="' +
            formatNumber(topDividerX) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(topDividerX) +
            '" y2="' +
            formatNumber(topRowBottomY) +
            '" />' +
            '<line x1="' +
            formatNumber(sizeDividerX) +
            '" y1="' +
            formatNumber(topRowBottomY) +
            '" x2="' +
            formatNumber(sizeDividerX) +
            '" y2="' +
            formatNumber(middleRowBottomY) +
            '" />' +
            '<line x1="' +
            formatNumber(revisionDividerX) +
            '" y1="' +
            formatNumber(topRowBottomY) +
            '" x2="' +
            formatNumber(revisionDividerX) +
            '" y2="' +
            formatNumber(middleRowBottomY) +
            '" />' +
            '<line x1="' +
            formatNumber(bottomRightDividerX) +
            '" y1="' +
            formatNumber(middleRowBottomY) +
            '" x2="' +
            formatNumber(bottomRightDividerX) +
            '" y2="' +
            formatNumber(y + titleBlockHeight) +
            '" />' +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                x + titleBlockWidth * 0.03,
                titleLabelY,
                'Title',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                x + titleBlockWidth * 0.05,
                sectionLabelY,
                'Size',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                sizeDividerX + 12,
                sectionLabelY,
                'Number',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                revisionDividerX + 8,
                sectionLabelY,
                'Revision',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                x + 8,
                footerDateY,
                'Date:',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                x + 8,
                footerFileY,
                'File:',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                bottomRightDividerX + 8,
                footerDateY,
                'Sheet',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                sheetTotalHint
                    ? sheetTotalHint.x - 20
                    : bottomRightDividerX + titleBlockWidth * 0.28,
                footerDateY,
                'of',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockLabelMarkup(
                bottomRightDividerX + 8,
                footerFileY,
                'Drawn By:',
                labelOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.31,
                titleValueY,
                titleBlock.title || '',
                'var(--schematic-default-ink-color)',
                titleBlock.footerHints?.title,
                sheetHeight,
                useLiteralSheetHints
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.84,
                titleValueY,
                titleBlock.documentNumber || '',
                'var(--schematic-text-color)',
                titleBlock.footerHints?.documentNumber,
                sheetHeight,
                useLiteralSheetHints
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkupWithResolvedY(
                x + titleBlockWidth * 0.93,
                sectionValueY,
                titleBlock.revision || '',
                'var(--schematic-default-ink-color)',
                titleBlock.footerHints?.revision,
                sheetHeight,
                useLiteralSheetHints
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.08,
                paperSizeY,
                sheet?.paperSize || 'A4',
                'var(--schematic-text-color)',
                'middle',
                footerValueOptions
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkupWithResolvedY(
                x + titleBlockWidth * 0.8,
                footerDateY,
                titleBlock.sheetNumber || '',
                'var(--schematic-default-ink-color)',
                useLiteralSheetHints
                    ? titleBlock.footerHints?.sheetNumber
                    : undefined,
                sheetHeight
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkupWithResolvedY(
                x + titleBlockWidth * 0.88,
                footerDateY,
                titleBlock.sheetTotal || '',
                'var(--schematic-default-ink-color)',
                useLiteralSheetHints
                    ? titleBlock.footerHints?.sheetTotal
                    : undefined,
                sheetHeight
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.24,
                footerDateY,
                renderedDate,
                'var(--schematic-text-color)',
                'start',
                footerValueOptions
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.24,
                footerFileY,
                renderedFileName,
                'var(--schematic-text-color)',
                'start',
                footerValueOptions
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.93,
                footerFileY,
                titleBlock.drawnBy || '',
                'var(--schematic-default-ink-color)',
                'middle',
                footerValueOptions
            ) +
            '</g>'
        )
    }

    /**
     * Builds the generic fallback title-block chrome used when no corrected
     * footer-hint layout is available.
     * @param {{ x: number, y: number, width: number, height: number }} layout
     * @param {{ paperSize?: string }} sheet
     * @param {number} sheetHeight
     * @param {{ title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }} titleBlock
     * @param {string} renderedDate
     * @param {string} renderedFileName
     * @returns {string}
     */
    static #buildGenericTitleBlockMarkup(
        layout,
        sheet,
        sheetHeight,
        titleBlock,
        renderedDate,
        renderedFileName
    ) {
        const titleBlockWidth = layout.width
        const titleBlockHeight = layout.height
        const x = layout.x
        const y = layout.y
        const headerY = y + titleBlockHeight * 0.16
        const titleRowY = y + titleBlockHeight * 0.48
        const labelRowY = y + titleBlockHeight * 0.62
        const valueRowY = y + titleBlockHeight * 0.78
        const footerDateY = y + titleBlockHeight * 0.9
        const footerFileY = y + titleBlockHeight * 0.98
        const line1Y = y + titleBlockHeight * 0.18
        const line2Y = y + titleBlockHeight * 0.5
        const line3Y = y + titleBlockHeight * 0.66
        const line4Y = y + titleBlockHeight * 0.82
        const numberX = x + titleBlockWidth * 0.64
        const revisionX = x + titleBlockWidth * 0.84
        const sizeX = x + titleBlockWidth * 0.16
        const sheetX = x + titleBlockWidth * 0.67
        const drawnByX = x + titleBlockWidth * 0.82
        const sheetValue =
            SchematicSheetChromeRenderer.#buildSheetValue(titleBlock)
        const sheetValueHint =
            SchematicSheetChromeRenderer.#buildSheetValueFooterHint(titleBlock)

        return (
            '<g class="sheet-title-block">' +
            '<rect x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" width="' +
            formatNumber(titleBlockWidth) +
            '" height="' +
            formatNumber(titleBlockHeight) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line1Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line1Y) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line2Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line2Y) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line3Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line3Y) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line4Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line4Y) +
            '" />' +
            '<line x1="' +
            formatNumber(numberX) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(numberX) +
            '" y2="' +
            formatNumber(line2Y) +
            '" />' +
            '<line x1="' +
            formatNumber(revisionX) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(revisionX) +
            '" y2="' +
            formatNumber(line2Y) +
            '" />' +
            '<line x1="' +
            formatNumber(sizeX) +
            '" y1="' +
            formatNumber(line2Y) +
            '" x2="' +
            formatNumber(sizeX) +
            '" y2="' +
            formatNumber(y + titleBlockHeight) +
            '" />' +
            '<line x1="' +
            formatNumber(sheetX) +
            '" y1="' +
            formatNumber(line2Y) +
            '" x2="' +
            formatNumber(sheetX) +
            '" y2="' +
            formatNumber(line4Y) +
            '" />' +
            '<line x1="' +
            formatNumber(drawnByX) +
            '" y1="' +
            formatNumber(line4Y) +
            '" x2="' +
            formatNumber(drawnByX) +
            '" y2="' +
            formatNumber(y + titleBlockHeight) +
            '" />' +
            createSvgText(
                'sheet-title-label',
                x + titleBlockWidth * 0.03,
                headerY,
                'Title',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                numberX + titleBlockWidth * 0.03,
                headerY,
                'Number',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                revisionX + titleBlockWidth * 0.02,
                headerY,
                'Revision',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                x + titleBlockWidth * 0.05,
                labelRowY,
                'Size',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                sizeX + titleBlockWidth * 0.05,
                labelRowY,
                'Sheet',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                sizeX + 8,
                footerDateY,
                'Date:',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                sizeX + 8,
                footerFileY,
                'File:',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                drawnByX + 8,
                footerFileY,
                'Drawn By:',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.31,
                titleRowY,
                titleBlock.title || '',
                'var(--schematic-default-ink-color)',
                titleBlock.footerHints?.title,
                sheetHeight
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.74,
                titleRowY,
                titleBlock.documentNumber || '',
                'var(--schematic-text-color)',
                titleBlock.footerHints?.documentNumber,
                sheetHeight
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.92,
                titleRowY,
                titleBlock.revision || '',
                'var(--schematic-default-ink-color)',
                titleBlock.footerHints?.revision,
                sheetHeight
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.08,
                valueRowY,
                sheet?.paperSize || 'A4',
                'var(--schematic-text-color)',
                'middle'
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.415,
                valueRowY,
                sheetValue,
                'var(--schematic-default-ink-color)',
                sheetValueHint,
                sheetHeight
            ) +
            createSvgText(
                'sheet-title-value',
                sizeX + titleBlockWidth * 0.08,
                footerDateY,
                renderedDate,
                'var(--schematic-text-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-value',
                sizeX + titleBlockWidth * 0.08,
                footerFileY,
                renderedFileName,
                'var(--schematic-text-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.93,
                footerFileY,
                titleBlock.drawnBy || '',
                'var(--schematic-default-ink-color)',
                'middle'
            ) +
            '</g>'
        )
    }

    /**
     * Resolves serif label typography for corrected title-block labels.
     * @param {{ footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision', { fontFamily: string }>> }} titleBlock
     * @returns {{ fontSize: number, fontFamily: string, fontWeight: number }}
     */
    static #resolveTitleBlockLabelOptions(titleBlock) {
        return {
            fontSize: 10,
            fontFamily:
                titleBlock?.footerHints?.revision?.fontFamily ||
                titleBlock?.footerHints?.title?.fontFamily ||
                'Times New Roman',
            fontWeight: 400
        }
    }

    /**
     * Resolves default serif typography for synthesized footer values that do
     * not have their own recovered hint styling.
     * @param {{ footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision', { fontFamily: string }>> }} titleBlock
     * @returns {{ fontSize: number, fontFamily: string, fontWeight: number }}
     */
    static #resolveTitleBlockFooterValueOptions(titleBlock) {
        return {
            fontSize: 10,
            fontFamily:
                titleBlock?.footerHints?.revision?.fontFamily ||
                titleBlock?.footerHints?.title?.fontFamily ||
                'Times New Roman',
            fontWeight: 400
        }
    }

    /**
     * Builds one title-block label with explicit typography so the SVG does
     * not inherit the viewer stylesheet sans-serif fallback.
     * @param {number} x
     * @param {number} y
     * @param {string} text
     * @param {{ fontSize: number, fontFamily: string, fontWeight: number }} options
     * @returns {string}
     */
    static #buildTitleBlockLabelMarkup(x, y, text, options) {
        return createSvgText(
            'sheet-title-label',
            x,
            y,
            text,
            'var(--schematic-sheet-label-color)',
            'start',
            options
        )
    }
    /**
     * Builds one title-block value while preserving recovered X/color/font
     * hints and overriding the baseline to match the synthesized cell layout.
     * @param {number} fallbackX
     * @param {number} resolvedY
     * @param {string} text
     * @param {string} fallbackColor
     * @param {{ x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number } | undefined} footerHint
     * @param {number} sheetHeight
     * @param {boolean} [preserveHintX=true]
     * @returns {string}
     */
    static #buildTitleBlockValueMarkupWithResolvedY(
        fallbackX,
        resolvedY,
        text,
        fallbackColor,
        footerHint,
        sheetHeight,
        preserveHintX = true
    ) {
        if (!footerHint) {
            return createSvgText(
                'sheet-title-value',
                fallbackX,
                resolvedY,
                text,
                fallbackColor,
                'middle'
            )
        }

        return createSvgText(
            'sheet-title-value',
            preserveHintX ? footerHint.x : fallbackX,
            resolvedY,
            text,
            SchematicColorResolver.resolveColor(
                footerHint.color,
                fallbackColor.replace(/^var\((.+)\)$/, '$1')
            ),
            'middle',
            {
                fontSize: footerHint.fontSize,
                fontFamily: footerHint.fontFamily,
                fontWeight: footerHint.fontWeight
            }
        )
    }

    /**
     * Builds one title-block value, preferring recovered footer hint
     * placement, color, and typography when available.
     * @param {number} fallbackX
     * @param {number} fallbackY
     * @param {string} text
     * @param {string} fallbackColor
     * @param {{ x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number } | undefined} footerHint
     * @param {number} sheetHeight
     * @param {boolean} [preserveHintX=true]
     * @returns {string}
     */
    static #buildTitleBlockValueMarkup(
        fallbackX,
        fallbackY,
        text,
        fallbackColor,
        footerHint,
        sheetHeight,
        preserveHintX = true
    ) {
        if (!footerHint) {
            return createSvgText(
                'sheet-title-value',
                fallbackX,
                fallbackY,
                text,
                fallbackColor,
                'middle'
            )
        }

        return createSvgText(
            'sheet-title-value',
            preserveHintX ? footerHint.x : fallbackX,
            projectSchematicY(sheetHeight, footerHint.y),
            text,
            SchematicColorResolver.resolveColor(
                footerHint.color,
                fallbackColor.replace(/^var\((.+)\)$/, '$1')
            ),
            'middle',
            {
                fontSize: footerHint.fontSize,
                fontFamily: footerHint.fontFamily,
                fontWeight: footerHint.fontWeight
            }
        )
    }

    /**
     * Builds one combined sheet-value hint from the recovered sheet-number row.
     * @param {{ footerHints?: Partial<Record<'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }} titleBlock
     * @returns {{ x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number } | undefined}
     */
    static #buildSheetValueFooterHint(titleBlock) {
        const sheetNumberHint = titleBlock?.footerHints?.sheetNumber
        const sheetTotalHint = titleBlock?.footerHints?.sheetTotal

        if (!sheetNumberHint || !sheetTotalHint) {
            return undefined
        }

        return {
            x: (sheetNumberHint.x + sheetTotalHint.x) / 2,
            y: Math.max(sheetNumberHint.y, sheetTotalHint.y),
            color: sheetNumberHint.color,
            fontSize: sheetNumberHint.fontSize,
            fontFamily: sheetNumberHint.fontFamily,
            fontWeight: sheetNumberHint.fontWeight
        }
    }

    /**
     * Builds the border zone labels around the sheet frame.
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @param {{ borderOn?: boolean, xZones?: number, yZones?: number }} sheet
     * @returns {string}
     */
    static #buildSheetZoneMarkup(width, height, margin, sheet) {
        if (!sheet?.borderOn) return ''

        const xZones = Math.max(Number(sheet?.xZones || 0), 1)
        const yZones = Math.max(Number(sheet?.yZones || 0), 1)
        const innerWidth = Math.max(width - margin * 2, 10)
        const innerHeight = Math.max(height - margin * 2, 10)
        const separator = (x1, y1, x2, y2) =>
            '<line class="sheet-zone-separator" x1="' +
            formatNumber(x1) +
            '" y1="' +
            formatNumber(y1) +
            '" x2="' +
            formatNumber(x2) +
            '" y2="' +
            formatNumber(y2) +
            '" />'
        let markup = ''

        for (let index = 1; index < xZones; index += 1) {
            const x = margin + (innerWidth * index) / xZones

            markup +=
                separator(x, 0, x, margin) +
                separator(x, height - margin, x, height)
        }

        for (let index = 0; index < xZones; index += 1) {
            const label = String(index + 1)
            const x = margin + (innerWidth * (index + 0.5)) / xZones

            markup +=
                createSvgText(
                    'sheet-zone-label',
                    x,
                    margin - 6,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-zone-label',
                    x,
                    height - 4,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                )
        }

        for (let index = 1; index < yZones; index += 1) {
            const y = margin + (innerHeight * index) / yZones

            markup +=
                separator(0, y, margin, y) +
                separator(width - margin, y, width, y)
        }

        for (let index = 0; index < yZones; index += 1) {
            const label = String.fromCharCode(65 + index)
            const y = margin + (innerHeight * (index + 0.5)) / yZones

            markup +=
                createSvgText(
                    'sheet-zone-label',
                    8,
                    y + 2,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-zone-label',
                    width - 8,
                    y + 2,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                )
        }

        return markup
    }

    /**
     * Formats the sheet numbering shown in the title block.
     * @param {{ sheetNumber?: string, sheetTotal?: string }} titleBlock
     * @returns {string}
     */
    static #buildSheetValue(titleBlock) {
        const sheetNumber = String(titleBlock?.sheetNumber || '').trim()
        const sheetTotal = String(titleBlock?.sheetTotal || '').trim()

        if (sheetNumber && sheetTotal) {
            return 'Sheet ' + sheetNumber + ' of ' + sheetTotal
        }

        return sheetNumber || sheetTotal || ''
    }
}
