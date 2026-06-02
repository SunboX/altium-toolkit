// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders recovered PCB text primitives.
 */
export class PcbTextPrimitiveRenderer {
    static #DEFAULT_TRUETYPE_EM_SCALE = 0.895
    static #TEXTURE_PADDING_RATIO = 0.14
    static #MIN_CANVAS_PADDING = 2
    static #LINE_HEIGHT_RATIO = 1.16
    static #FONT_ASCENT_RATIO = 0.82
    static #FONT_DESCENT_RATIO = 0.18
    static #DEFAULT_GLYPH_WIDTH_RATIO = 0.56
    static #MONOSPACE_GLYPH_WIDTH_RATIO = 0.62
    static #DEFAULT_FONT_FAMILY = 'Arial'

    /**
     * Selects texts that belong to the requested board-side composite.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, visible?: boolean }[]} texts
     * @param {'top' | 'bottom'} [side]
     * @param {{ nativeTextKnockouts?: boolean }} [options] Selection options.
     * @returns {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, visible?: boolean }[]}
     */
    static select(primitiveLayers, texts, side = 'top', options = {}) {
        const layerIds = PcbTextPrimitiveRenderer.#resolveLayerIds(
            primitiveLayers || [],
            side
        )

        return (texts || []).filter((text) => {
            const layerId = Number(text?.layerId)
            return (
                text?.visible !== false &&
                String(text?.text || '').trim() &&
                !PcbTextPrimitiveRenderer.#isPlaceholderText(text) &&
                !PcbTextPrimitiveRenderer.#shouldSkipNativeTextKnockout(
                    text,
                    options
                ) &&
                Number.isInteger(layerId) &&
                layerIds.has(layerId)
            )
        })
    }

    /**
     * Renders selected PCB texts into SVG markup.
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string }[]} texts
     * @returns {string}
     */
    static render(texts) {
        return (texts || [])
            .map((text, index) =>
                PcbTextPrimitiveRenderer.#renderText(text, index)
            )
            .join('')
    }

    /**
     * Renders one PCB text primitive.
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string }} text
     * @param {number} index Text index for stable SVG resource ids.
     * @returns {string}
     */
    static #renderText(text, index) {
        const fontSize = PcbTextPrimitiveRenderer.#resolveFontSize(text)
        const rotation = Number(text.rotation || 0)
        const lines = PcbTextPrimitiveRenderer.#textLines(text)

        if (PcbTextPrimitiveRenderer.#isInvertedText(text)) {
            return PcbTextPrimitiveRenderer.#renderInvertedText(
                text,
                index,
                fontSize,
                rotation,
                lines
            )
        }

        const content = lines.length
            ? PcbTextPrimitiveRenderer.#renderTextLines(lines, fontSize)
            : SchematicSvgUtils.escapeHtml(String(text.text || ''))

        return (
            '<text class="pcb-text pcb-text--layer-' +
            SchematicSvgUtils.escapeHtml(String(Number(text.layerId || 0))) +
            '" transform="' +
            PcbTextPrimitiveRenderer.#renderTextTransform(text, rotation) +
            '" font-size="' +
            PcbTextPrimitiveRenderer.#formatTextNumber(fontSize) +
            '"' +
            PcbTextPrimitiveRenderer.#renderFontAttributes(text) +
            ' text-anchor="start" dominant-baseline="alphabetic">' +
            content +
            '</text>'
        )
    }

    /**
     * Renders one inverted PCB text primitive as filled artwork with glyph
     * cutouts, matching Altium's TrueType bottom overlay treatment.
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, isInverted?: boolean, marginBorderWidth?: number, textboxRectWidth?: number, textboxRectHeight?: number, textboxRectJustification?: number, useInvertedRectangle?: boolean }} text
     * @param {number} index Text index for stable SVG mask ids.
     * @param {number} fontSize Text font size in board units.
     * @param {number} rotation Text rotation in degrees.
     * @param {string[]} lines Text lines to render.
     * @returns {string}
     */
    static #renderInvertedText(text, index, fontSize, rotation, lines) {
        const metrics = PcbTextPrimitiveRenderer.#measureLines(
            text,
            lines,
            fontSize
        )
        const padding = PcbTextPrimitiveRenderer.#resolveTextPadding(
            text,
            fontSize
        )
        const layout = PcbTextPrimitiveRenderer.#resolveTextLayout(
            text,
            metrics,
            padding
        )
        const maskId = 'pcb-text-knockout-' + String(index)
        const content = PcbTextPrimitiveRenderer.#renderTextLines(
            lines,
            metrics.lineHeight
        )
        const rectX = -layout.anchorX
        const rectY = -layout.anchorY
        const cornerRadius = Math.min(
            padding,
            layout.width / 2,
            layout.height / 2
        )

        return (
            '<g class="pcb-text pcb-text--layer-' +
            SchematicSvgUtils.escapeHtml(String(Number(text.layerId || 0))) +
            ' pcb-text--inverted" transform="' +
            PcbTextPrimitiveRenderer.#renderTextTransform(text, rotation) +
            '">' +
            '<mask id="' +
            SchematicSvgUtils.escapeHtml(maskId) +
            '" maskUnits="userSpaceOnUse" mask-type="luminance" x="' +
            SchematicSvgUtils.formatNumber(rectX) +
            '" y="' +
            SchematicSvgUtils.formatNumber(rectY) +
            '" width="' +
            SchematicSvgUtils.formatNumber(layout.width) +
            '" height="' +
            SchematicSvgUtils.formatNumber(layout.height) +
            '">' +
            '<rect class="pcb-text__knockout-mask-fill" x="' +
            SchematicSvgUtils.formatNumber(rectX) +
            '" y="' +
            SchematicSvgUtils.formatNumber(rectY) +
            '" width="' +
            SchematicSvgUtils.formatNumber(layout.width) +
            '" height="' +
            SchematicSvgUtils.formatNumber(layout.height) +
            '" rx="' +
            SchematicSvgUtils.formatNumber(cornerRadius) +
            '" fill="#fff" />' +
            '<text class="pcb-text__knockout-glyphs" x="0" y="0" font-size="' +
            PcbTextPrimitiveRenderer.#formatTextNumber(fontSize) +
            '"' +
            PcbTextPrimitiveRenderer.#renderFontAttributes(text) +
            ' text-anchor="start" dominant-baseline="alphabetic" fill="#000">' +
            content +
            '</text>' +
            '</mask>' +
            '<rect class="pcb-text__knockout-fill" x="' +
            SchematicSvgUtils.formatNumber(rectX) +
            '" y="' +
            SchematicSvgUtils.formatNumber(rectY) +
            '" width="' +
            SchematicSvgUtils.formatNumber(layout.width) +
            '" height="' +
            SchematicSvgUtils.formatNumber(layout.height) +
            '" rx="' +
            SchematicSvgUtils.formatNumber(cornerRadius) +
            '" mask="url(#' +
            SchematicSvgUtils.escapeHtml(maskId) +
            ')" />' +
            '</g>'
        )
    }

    /**
     * Renders the local text transform, including authored PCB text mirroring.
     * @param {{ x?: number, y?: number, mirrored?: boolean }} text Text record.
     * @param {number} rotation Text rotation in degrees.
     * @returns {string}
     */
    static #renderTextTransform(text, rotation) {
        const mirrorTransform = text?.mirrored === true ? ' scale(-1 1)' : ''

        return (
            'translate(' +
            SchematicSvgUtils.formatNumber(Number(text.x || 0)) +
            ' ' +
            SchematicSvgUtils.formatNumber(Number(text.y || 0)) +
            ') rotate(' +
            SchematicSvgUtils.formatNumber(rotation) +
            ')' +
            mirrorTransform
        )
    }

    /**
     * Resolves the SVG font size from Altium text metadata.
     * @param {{ height?: number, sizeX?: number, sizeY?: number, trueTypeFontScale?: number, fontMetrics?: { emScaleFromPcbHeight?: number }, fontType?: number | string, fontTypeName?: string, isTrueType?: boolean }} text Text record.
     * @returns {number}
     */
    static #resolveFontSize(text) {
        const height = Math.max(
            Number(text?.sizeX) || Number(text?.height) || Number(text?.sizeY),
            1
        )

        if (PcbTextPrimitiveRenderer.#isTrueTypeText(text)) {
            return height * PcbTextPrimitiveRenderer.#fontScale(text)
        }

        return Math.max(height, 8)
    }

    /**
     * Checks whether a text primitive uses imported TrueType glyph geometry.
     * @param {{ fontType?: number | string, fontTypeName?: string, isTrueType?: boolean }} text Text record.
     * @returns {boolean}
     */
    static #isTrueTypeText(text) {
        const fontTypeName = String(text?.fontTypeName || '').toUpperCase()

        return (
            text?.isTrueType === true ||
            Number(text?.fontType) === 1 ||
            fontTypeName.includes('TRUETYPE')
        )
    }

    /**
     * Resolves the imported TrueType scale used by browser outline fonts.
     * @param {{ trueTypeFontScale?: number, fontMetrics?: { emScaleFromPcbHeight?: number } }} text Text record.
     * @returns {number}
     */
    static #fontScale(text) {
        if (Number.isFinite(Number(text?.trueTypeFontScale))) {
            return Math.max(Number(text.trueTypeFontScale), 0.01)
        }

        if (Number.isFinite(Number(text?.fontMetrics?.emScaleFromPcbHeight))) {
            return Math.max(Number(text.fontMetrics.emScaleFromPcbHeight), 0.01)
        }

        return PcbTextPrimitiveRenderer.#DEFAULT_TRUETYPE_EM_SCALE
    }

    /**
     * Checks whether a text primitive should draw as reversed knockout artwork.
     * @param {{ isInverted?: boolean }} text Text record.
     * @returns {boolean}
     */
    static #isInvertedText(text) {
        return Boolean(text?.isInverted)
    }

    /**
     * Splits one text record into drawable lines.
     * @param {{ value?: string, text?: string }} text Text record.
     * @returns {string[]}
     */
    static #textLines(text) {
        const lines = String(text?.value ?? text?.text ?? '').split(/\r?\n/u)

        return lines.length ? lines : ['']
    }

    /**
     * Estimates SVG text metrics using the same fallback ratios as the 3D text
     * texture path when browser canvas measurements are unavailable.
     * @param {{ fontFamily?: string, fontName?: string }} text Text record.
     * @param {string[]} lines Text lines.
     * @param {number} fontSize Text font size.
     * @returns {{ width: number, height: number, ascent: number, descent: number, lineHeight: number }}
     */
    static #measureLines(text, lines, fontSize) {
        const measured = PcbTextPrimitiveRenderer.#measureCanvasLines(
            text,
            lines,
            fontSize
        )
        if (measured) {
            return measured
        }

        const ascent = fontSize * PcbTextPrimitiveRenderer.#FONT_ASCENT_RATIO
        const descent = fontSize * PcbTextPrimitiveRenderer.#FONT_DESCENT_RATIO
        const glyphHeight = Math.max(ascent + descent, 1)
        const lineHeight = Math.max(
            glyphHeight * PcbTextPrimitiveRenderer.#LINE_HEIGHT_RATIO,
            glyphHeight
        )
        const glyphWidth =
            fontSize * PcbTextPrimitiveRenderer.#glyphWidthRatio(text)

        return {
            width: Math.max(
                ...lines.map((line) =>
                    Math.max(String(line || ' ').length * glyphWidth, 1)
                )
            ),
            height: glyphHeight + lineHeight * (lines.length - 1),
            ascent,
            descent,
            lineHeight
        }
    }

    /**
     * Resolves a stable glyph-width ratio for coarse SVG layout.
     * @param {{ fontFamily?: string, fontName?: string }} text Text record.
     * @returns {number}
     */
    static #glyphWidthRatio(text) {
        const metricsRatio =
            PcbTextPrimitiveRenderer.#fontMetricsAverageWidthRatio(text)
        if (metricsRatio) {
            return metricsRatio
        }

        const family = PcbTextPrimitiveRenderer.#cleanFontFamily(
            text?.fontFamily || text?.fontName
        )

        return PcbTextPrimitiveRenderer.#isMonospaceFamily(family)
            ? PcbTextPrimitiveRenderer.#MONOSPACE_GLYPH_WIDTH_RATIO
            : PcbTextPrimitiveRenderer.#DEFAULT_GLYPH_WIDTH_RATIO
    }

    /**
     * Measures text with a browser canvas when the renderer runs in the app.
     * @param {{ fontFamily?: string, fontName?: string, isBold?: boolean, fontWeight?: number, isItalic?: boolean }} text Text record.
     * @param {string[]} lines Text lines.
     * @param {number} fontSize Text font size.
     * @returns {{ width: number, height: number, ascent: number, descent: number, lineHeight: number } | null}
     */
    static #measureCanvasLines(text, lines, fontSize) {
        const canvas = globalThis.document?.createElement?.('canvas')
        const context = canvas?.getContext?.('2d')

        if (!context) {
            return null
        }

        const canvasFont = PcbTextPrimitiveRenderer.#buildCanvasFont(
            text,
            fontSize
        )
        if (
            !PcbTextPrimitiveRenderer.#canMeasureCanvasFont(
                text,
                canvasFont,
                fontSize
            )
        ) {
            return null
        }

        context.font = canvasFont

        const measured = lines.map((line) => context.measureText(line || ' '))
        const ascent = PcbTextPrimitiveRenderer.#resolveMeasuredExtent(
            measured,
            'actualBoundingBoxAscent',
            fontSize * PcbTextPrimitiveRenderer.#FONT_ASCENT_RATIO
        )
        const descent = PcbTextPrimitiveRenderer.#resolveMeasuredExtent(
            measured,
            'actualBoundingBoxDescent',
            fontSize * PcbTextPrimitiveRenderer.#FONT_DESCENT_RATIO
        )
        const glyphHeight = Math.max(ascent + descent, 1)
        const lineHeight = Math.max(
            glyphHeight * PcbTextPrimitiveRenderer.#LINE_HEIGHT_RATIO,
            glyphHeight
        )

        return {
            width: Math.max(...measured.map((metric) => Number(metric.width))),
            height: glyphHeight + lineHeight * (lines.length - 1),
            ascent,
            descent,
            lineHeight
        }
    }

    /**
     * Checks whether canvas text metrics can be trusted for the requested
     * imported font.
     * @param {{ fontMetrics?: { averageAdvanceWidth?: number, unitsPerEm?: number } }} text Text record.
     * @param {string} canvasFont Full canvas font shorthand.
     * @param {number} fontSize Text font size.
     * @returns {boolean}
     */
    static #canMeasureCanvasFont(text, canvasFont, fontSize) {
        const fonts = globalThis.document?.fonts
        if (typeof fonts?.check === 'function') {
            return fonts.check(
                PcbTextPrimitiveRenderer.#buildPrimaryCanvasFont(text, fontSize)
            )
        }

        if (PcbTextPrimitiveRenderer.#fontMetricsAverageWidthRatio(text)) {
            return false
        }

        return Boolean(canvasFont)
    }

    /**
     * Resolves a measured text extent with a stable fallback.
     * @param {TextMetrics[]} measured Browser text metrics.
     * @param {'actualBoundingBoxAscent' | 'actualBoundingBoxDescent'} field Extent field.
     * @param {number} fallback Fallback extent.
     * @returns {number}
     */
    static #resolveMeasuredExtent(measured, field, fallback) {
        const values = measured
            .map((metric) => Number(metric?.[field]))
            .filter((value) => Number.isFinite(value) && value > 0)

        return values.length ? Math.max(...values) : fallback
    }

    /**
     * Builds the CSS font string used for optional canvas measurement.
     * @param {{ fontFamily?: string, fontName?: string, isBold?: boolean, fontWeight?: number, isItalic?: boolean }} text Text record.
     * @param {number} fontSize Text font size.
     * @returns {string}
     */
    static #buildCanvasFont(text, fontSize) {
        const weight =
            text?.isBold || Number(text?.fontWeight) >= 600 ? '700' : '400'
        const style = text?.isItalic ? 'italic' : 'normal'
        const family = PcbTextPrimitiveRenderer.#buildCanvasFontFamily(
            text?.fontFamily || text?.fontName
        )

        return `${style} ${weight} ${fontSize}px ${family}`
    }

    /**
     * Builds a single-family font shorthand for readiness checks.
     * @param {{ fontFamily?: string, fontName?: string, isBold?: boolean, fontWeight?: number, isItalic?: boolean }} text Text record.
     * @param {number} fontSize Text font size.
     * @returns {string}
     */
    static #buildPrimaryCanvasFont(text, fontSize) {
        const weight =
            text?.isBold || Number(text?.fontWeight) >= 600 ? '700' : '400'
        const style = text?.isItalic ? 'italic' : 'normal'
        const family = PcbTextPrimitiveRenderer.#quoteFontFamily(
            PcbTextPrimitiveRenderer.#cleanFontFamily(
                text?.fontFamily || text?.fontName
            )
        )

        return `${style} ${weight} ${fontSize}px ${family}`
    }

    /**
     * Builds a browser font-family stack matching the 3D TrueType path.
     * @param {unknown} family Font family value.
     * @returns {string}
     */
    static #buildCanvasFontFamily(family) {
        const cleaned = PcbTextPrimitiveRenderer.#cleanFontFamily(family)
        const quoted = PcbTextPrimitiveRenderer.#quoteFontFamily(cleaned)

        if (PcbTextPrimitiveRenderer.#isMonospaceFamily(cleaned)) {
            return [
                quoted,
                '"Menlo"',
                '"Monaco"',
                '"Liberation Mono"',
                '"Courier New"',
                'monospace'
            ].join(', ')
        }

        if (PcbTextPrimitiveRenderer.#isArialFamily(cleaned)) {
            return [
                quoted,
                '"Helvetica Neue"',
                'Helvetica',
                'Arial',
                'sans-serif'
            ].join(', ')
        }

        return [quoted, 'Arial', 'sans-serif'].join(', ')
    }

    /**
     * Quotes one CSS font-family token.
     * @param {string} family Font family name.
     * @returns {string}
     */
    static #quoteFontFamily(family) {
        return `"${family.replace(/["\\]/gu, '\\$&')}"`
    }

    /**
     * Resolves embedded font average advance width when available.
     * @param {{ fontMetrics?: { averageAdvanceWidth?: number, unitsPerEm?: number } }} text Text record.
     * @returns {number | null}
     */
    static #fontMetricsAverageWidthRatio(text) {
        const averageAdvanceWidth = Number(
            text?.fontMetrics?.averageAdvanceWidth
        )
        const unitsPerEm = Number(text?.fontMetrics?.unitsPerEm)
        const ratio = averageAdvanceWidth / unitsPerEm

        return Number.isFinite(ratio) && ratio >= 0.3 && ratio <= 1.2
            ? ratio
            : null
    }

    /**
     * Resolves padding around one inverted text primitive.
     * @param {{ marginBorderWidth?: number }} text Text record.
     * @param {number} fontSize Text font size.
     * @returns {number}
     */
    static #resolveTextPadding(text, fontSize) {
        const basePadding = Math.max(
            fontSize * PcbTextPrimitiveRenderer.#TEXTURE_PADDING_RATIO,
            PcbTextPrimitiveRenderer.#MIN_CANVAS_PADDING
        )
        const marginBorderWidth = Number(text?.marginBorderWidth)

        return Number.isFinite(marginBorderWidth) && marginBorderWidth >= 0
            ? marginBorderWidth
            : basePadding
    }

    /**
     * Resolves the local rectangle and baseline used to anchor SVG text at the
     * Altium insertion point.
     * @param {{ useInvertedRectangle?: boolean, textboxRectWidth?: number, textboxRectHeight?: number, textboxRectJustification?: number }} text Text record.
     * @param {{ width: number, height: number, ascent: number }} metrics Text metrics.
     * @param {number} padding Background padding.
     * @returns {{ width: number, height: number, baselineX: number, baselineY: number, anchorX: number, anchorY: number }}
     */
    static #resolveTextLayout(text, metrics, padding) {
        const authoredRectangle =
            PcbTextPrimitiveRenderer.#resolveAuthoredRectangle(text)
        const width =
            authoredRectangle?.width ||
            Math.max(Number(metrics.width || 0), 1) + padding * 2
        const height =
            authoredRectangle?.height ||
            Math.max(Number(metrics.height || 0), 1) + padding * 2

        if (!authoredRectangle) {
            return {
                width,
                height,
                baselineX: padding,
                baselineY: padding + Number(metrics.ascent || 0),
                anchorX: padding,
                anchorY: padding + Number(metrics.ascent || 0)
            }
        }

        const baselineX = PcbTextPrimitiveRenderer.#authoredBaselineX(
            text,
            metrics,
            width,
            padding
        )
        const baselineY = PcbTextPrimitiveRenderer.#authoredBaselineY(
            text,
            metrics,
            height,
            padding
        )

        return {
            width,
            height,
            baselineX,
            baselineY,
            anchorX: baselineX,
            anchorY: baselineY
        }
    }

    /**
     * Resolves authored inverted rectangle dimensions from source metadata.
     * @param {{ useInvertedRectangle?: boolean, textboxRectWidth?: number, textboxRectHeight?: number }} text Text record.
     * @returns {{ width: number, height: number } | null}
     */
    static #resolveAuthoredRectangle(text) {
        const width = Number(text?.textboxRectWidth)
        const height = Number(text?.textboxRectHeight)

        if (
            !Boolean(text?.useInvertedRectangle) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return null
        }

        return { width, height }
    }

    /**
     * Resolves horizontal baseline placement inside an authored rectangle.
     * @param {{ textboxRectJustification?: number }} text Text record.
     * @param {{ width: number }} metrics Text metrics.
     * @param {number} width Rectangle width.
     * @param {number} padding Background padding.
     * @returns {number}
     */
    static #authoredBaselineX(text, metrics, width, padding) {
        const column = PcbTextPrimitiveRenderer.#justificationColumn(text)
        const remainingWidth = Math.max(width - Number(metrics.width || 0), 0)

        if (column === 1) {
            return remainingWidth / 2
        }

        if (column === 2) {
            return remainingWidth
        }

        return Math.min(padding, remainingWidth)
    }

    /**
     * Resolves vertical baseline placement inside an authored rectangle.
     * @param {{ textboxRectJustification?: number }} text Text record.
     * @param {{ height: number, ascent: number }} metrics Text metrics.
     * @param {number} height Rectangle height.
     * @param {number} padding Background padding.
     * @returns {number}
     */
    static #authoredBaselineY(text, metrics, height, padding) {
        const row = PcbTextPrimitiveRenderer.#justificationRow(text)
        const remainingHeight = Math.max(
            height - Number(metrics.height || 0),
            0
        )

        if (row === 1) {
            return remainingHeight / 2 + Number(metrics.ascent || 0)
        }

        if (row === 2) {
            return remainingHeight + Number(metrics.ascent || 0)
        }

        return Math.min(padding, remainingHeight) + Number(metrics.ascent || 0)
    }

    /**
     * Resolves the authored horizontal justification column.
     * @param {{ textboxRectJustification?: number }} text Text record.
     * @returns {0 | 1 | 2 | null}
     */
    static #justificationColumn(text) {
        const justification = Number(text?.textboxRectJustification)

        return Number.isInteger(justification) && justification > 0
            ? Math.max(0, Math.min(2, Math.floor((justification - 1) / 3)))
            : null
    }

    /**
     * Resolves the authored vertical justification row.
     * @param {{ textboxRectJustification?: number }} text Text record.
     * @returns {0 | 1 | 2 | null}
     */
    static #justificationRow(text) {
        const justification = Number(text?.textboxRectJustification)

        return Number.isInteger(justification) && justification > 0
            ? (justification - 1) % 3
            : null
    }

    /**
     * Removes fixed-field padding from one font family name.
     * @param {unknown} family Font family value.
     * @returns {string}
     */
    static #cleanFontFamily(family) {
        const cleaned = String(
            family || PcbTextPrimitiveRenderer.#DEFAULT_FONT_FAMILY
        )
            .split('\0')[0]
            ?.trim()

        return cleaned || PcbTextPrimitiveRenderer.#DEFAULT_FONT_FAMILY
    }

    /**
     * Checks whether one font family is a common monospace PCB font.
     * @param {unknown} family Font family value.
     * @returns {boolean}
     */
    static #isMonospaceFamily(family) {
        return /^(consolas|courier|courier new|menlo|monaco|liberation mono)$/iu.test(
            PcbTextPrimitiveRenderer.#cleanFontFamily(family)
        )
    }

    /**
     * Checks whether an imported family is Arial-like.
     * @param {unknown} family Font family value.
     * @returns {boolean}
     */
    static #isArialFamily(family) {
        return /^arial(?:\b|$)/iu.test(
            PcbTextPrimitiveRenderer.#cleanFontFamily(family)
        )
    }

    /**
     * Formats concise text metrics without keeping cosmetic trailing zeros.
     * @param {number} value Numeric metric value.
     * @returns {string}
     */
    static #formatTextNumber(value) {
        return SchematicSvgUtils.formatNumber(value)
            .replace(/(\.\d*?)0+$/u, '$1')
            .replace(/\.$/u, '')
    }

    /**
     * Renders optional SVG font attributes for TrueType text primitives.
     * @param {{ fontFamily?: string, fontWeight?: number, fontStyle?: string }} text
     * @returns {string}
     */
    static #renderFontAttributes(text) {
        let attributes = ''

        if (text.fontFamily && text.fontFamily !== 'Stroke') {
            attributes +=
                ' font-family="' +
                SchematicSvgUtils.escapeHtml(text.fontFamily) +
                '"'
        }

        if (text.fontWeight) {
            attributes +=
                ' font-weight="' +
                SchematicSvgUtils.escapeHtml(String(text.fontWeight)) +
                '"'
        }

        if (text.fontStyle && text.fontStyle !== 'normal') {
            attributes +=
                ' font-style="' +
                SchematicSvgUtils.escapeHtml(text.fontStyle) +
                '"'
        }

        return attributes
    }

    /**
     * Renders one or more text lines with SVG tspans.
     * @param {string[]} lines
     * @param {number} lineStep
     * @returns {string}
     */
    static #renderTextLines(lines, lineStep) {
        if (lines.length === 1) {
            return SchematicSvgUtils.escapeHtml(lines[0])
        }

        return lines
            .map(
                (line, index) =>
                    '<tspan x="0" dy="' +
                    SchematicSvgUtils.formatNumber(index === 0 ? 0 : lineStep) +
                    '">' +
                    SchematicSvgUtils.escapeHtml(line) +
                    '</tspan>'
            )
            .join('')
    }

    /**
     * Resolves candidate text layer ids from layer names, falling back to
     * standard Altium layer ids when legacy layer metadata is absent.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {'top' | 'bottom'} side
     * @returns {Set<number>}
     */
    static #resolveLayerIds(primitiveLayers, side) {
        const matchers = PcbTextPrimitiveRenderer.#resolveLayerMatchers(side)
        const layerIds = new Set(
            primitiveLayers
                .filter((layer) =>
                    matchers.some((matchesLayerName) =>
                        matchesLayerName(layer.name)
                    )
                )
                .map((layer) => Number(layer.layerId))
                .filter((layerId) => Number.isInteger(layerId))
        )

        if (layerIds.size) {
            return layerIds
        }

        return new Set(
            side === 'bottom' ? [32, 34, 36, 38, 73] : [1, 33, 35, 37, 73]
        )
    }

    /**
     * Resolves side-specific layer-name matchers.
     * @param {'top' | 'bottom'} side
     * @returns {((layerName: string) => boolean)[]}
     */
    static #resolveLayerMatchers(side) {
        if (side === 'bottom') {
            return [
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'BOTTOM OVERLAY'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'BOTTOM SOLDER'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'BOTTOM PASTE'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'L4_BOT'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'DRILL DRAWING'
                    )
            ]
        }

        return [
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'TOP OVERLAY'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'TOP SOLDER'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'TOP PASTE'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'L1_TOP'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'DRILL DRAWING'
                )
        ]
    }

    /**
     * Returns true when a layer name contains the target token.
     * @param {string} layerName
     * @param {string} needle
     * @returns {boolean}
     */
    static #includesLayerName(layerName, needle) {
        return String(layerName || '')
            .trim()
            .toUpperCase()
            .includes(needle)
    }

    /**
     * Returns true for unresolved Altium component annotation placeholders.
     * @param {{ isPlaceholder?: boolean }} text
     * @returns {boolean}
     */
    static #isPlaceholderText(text) {
        return text?.isPlaceholder === true
    }

    /**
     * Returns true when native overlay holes already contain inverted glyphs.
     * @param {{ isInverted?: boolean, fontType?: number | string, fontTypeName?: string, isTrueType?: boolean }} text Text record.
     * @param {{ nativeTextKnockouts?: boolean }} options Selection options.
     * @returns {boolean}
     */
    static #shouldSkipNativeTextKnockout(text, options) {
        return (
            Boolean(options?.nativeTextKnockouts) &&
            Boolean(text?.isInverted) &&
            PcbTextPrimitiveRenderer.#isTrueTypeText(text)
        )
    }
}
