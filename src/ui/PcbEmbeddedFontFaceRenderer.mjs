// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Renders recovered embedded PCB fonts as self-contained SVG font faces.
 */
export class PcbEmbeddedFontFaceRenderer {
    /**
     * Builds self-contained SVG @font-face rules for recovered embedded fonts.
     * @param {{ name?: string, style?: string, format?: string, mimeType?: string, payloadBase64?: string, metrics?: { weightClass?: number } }[]} embeddedFonts
     * @returns {string}
     */
    static buildMarkup(embeddedFonts) {
        const rules = (embeddedFonts || [])
            .filter((font) => font?.name && font?.payloadBase64)
            .map((font) => PcbEmbeddedFontFaceRenderer.#buildRule(font))

        return rules.length ? '<style>' + rules.join('') + '</style>' : ''
    }

    /**
     * Builds one CSS @font-face rule.
     * @param {{ name?: string, style?: string, format?: string, mimeType?: string, payloadBase64?: string, metrics?: { weightClass?: number } }} font
     * @returns {string}
     */
    static #buildRule(font) {
        const family = PcbEmbeddedFontFaceRenderer.#escapeCssString(font.name)
        const base64 = PcbEmbeddedFontFaceRenderer.#sanitizeBase64(
            font.payloadBase64
        )

        return (
            "@font-face{font-family: '" +
            family +
            "'; font-style: " +
            PcbEmbeddedFontFaceRenderer.#fontStyleForFont(font) +
            '; font-weight: ' +
            PcbEmbeddedFontFaceRenderer.#fontWeightForFont(font) +
            "; src: url('data:" +
            PcbEmbeddedFontFaceRenderer.#fontMimeType(font) +
            ';base64,' +
            base64 +
            "') format('" +
            PcbEmbeddedFontFaceRenderer.#fontFormat(font) +
            "');}"
        )
    }

    /**
     * Resolves a CSS font-style value from embedded font metadata.
     * @param {{ style?: string }} font
     * @returns {'normal' | 'italic'}
     */
    static #fontStyleForFont(font) {
        return /italic|oblique/iu.test(String(font.style || ''))
            ? 'italic'
            : 'normal'
    }

    /**
     * Resolves a CSS font-weight value from embedded font metadata.
     * @param {{ style?: string, metrics?: { weightClass?: number } }} font
     * @returns {number}
     */
    static #fontWeightForFont(font) {
        if (Number(font.metrics?.weightClass) >= 100) {
            return Number(font.metrics.weightClass)
        }

        return /bold/iu.test(String(font.style || '')) ? 700 : 400
    }

    /**
     * Resolves a CSS font source MIME type.
     * @param {{ mimeType?: string, format?: string }} font
     * @returns {string}
     */
    static #fontMimeType(font) {
        if (font.mimeType) {
            return PcbEmbeddedFontFaceRenderer.#escapeCssUrlToken(font.mimeType)
        }

        return font.format === 'opentype' ? 'font/otf' : 'font/ttf'
    }

    /**
     * Resolves a CSS font source format label.
     * @param {{ format?: string }} font
     * @returns {'opentype' | 'truetype'}
     */
    static #fontFormat(font) {
        return font.format === 'opentype' ? 'opentype' : 'truetype'
    }

    /**
     * Escapes a string for use inside a single-quoted CSS string.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #escapeCssString(value) {
        return String(value || '')
            .replace(/\\/gu, '\\\\')
            .replace(/'/gu, "\\'")
            .replace(/\r?\n/gu, ' ')
            .replace(/</gu, '\\3C ')
    }

    /**
     * Keeps a base64 font payload constrained to data-URI-safe characters.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #sanitizeBase64(value) {
        return String(value || '').replace(/[^A-Za-z0-9+/=]/gu, '')
    }

    /**
     * Escapes a short CSS URL token.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #escapeCssUrlToken(value) {
        return String(value || '').replace(/[^A-Za-z0-9./+-]/gu, '')
    }
}
