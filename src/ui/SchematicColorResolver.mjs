// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const COLOR_TOKEN_BY_VALUE = new Map([
    ['#000080', '--schematic-default-ink-color'],
    ['#0000ff', '--schematic-accent-ink-color'],
    ['#000000', '--schematic-text-color'],
    ['#111111', '--schematic-text-color'],
    ['#1f1f1f', '--schematic-text-color'],
    ['#2c3134', '--schematic-text-color'],
    ['#4f4f4f', '--schematic-sheet-label-color'],
    ['#800000', '--schematic-power-color'],
    ['#8d2b2b', '--schematic-port-color'],
    ['#a44a1b', '--schematic-port-color'],
    ['#ff0000', '--schematic-alert-color'],
    ['#ffe16f', '--schematic-fill-color'],
    ['#ffff80', '--schematic-fill-color'],
    ['#ffffb0', '--schematic-fill-color'],
    ['#eceb94', '--schematic-note-fill-color'],
    ['#ffffff', '--schematic-fill-light-color'],
    ['#c0c0c0', '--schematic-note-border-color'],
    ['#7b7753', '--schematic-note-border-color']
])

/**
 * Maps recovered schematic source colors onto theme variables.
 */
export class SchematicColorResolver {
    /**
     * Resolves one SVG color value to a schematic theme variable.
     * @param {string | undefined} color
     * @param {string} fallbackVariable
     * @param {boolean} [preserveUnknown]
     * @returns {string}
     */
    static resolveColor(color, fallbackVariable, preserveUnknown = false) {
        const normalized = SchematicColorResolver.#normalizeColor(color)

        if (!normalized) {
            return SchematicColorResolver.#toVariable(fallbackVariable)
        }

        if (
            normalized === 'none' ||
            normalized === 'transparent' ||
            normalized.startsWith('var(')
        ) {
            return normalized
        }

        if (SchematicColorResolver.#isDefaultInkSourceColor(normalized)) {
            return SchematicColorResolver.#toVariable(
                '--schematic-default-ink-color'
            )
        }

        const token = COLOR_TOKEN_BY_VALUE.get(normalized)

        if (token) {
            return SchematicColorResolver.#toVariable(token)
        }

        return preserveUnknown
            ? normalized
            : SchematicColorResolver.#toVariable(fallbackVariable)
    }

    /**
     * Resolves one non-text primitive color, using the semantic fallback when
     * source artwork only supplies the default black text color.
     * @param {string | undefined} color
     * @param {string} fallbackVariable
     * @param {boolean} [preserveUnknown]
     * @returns {string}
     */
    static resolveNonTextColor(
        color,
        fallbackVariable,
        preserveUnknown = false
    ) {
        const normalized = SchematicColorResolver.#normalizeColor(color)

        if (SchematicColorResolver.#isNearBlackSourceColor(normalized)) {
            return SchematicColorResolver.#toVariable(fallbackVariable)
        }

        const resolved = SchematicColorResolver.resolveColor(
            color,
            fallbackVariable,
            preserveUnknown
        )

        return resolved ===
            SchematicColorResolver.#toVariable('--schematic-text-color')
            ? SchematicColorResolver.#toVariable(fallbackVariable)
            : resolved
    }

    /**
     * Resolves one SVG fill value to a schematic theme variable.
     * @param {string | undefined} fill
     * @param {string} fallbackVariable
     * @param {boolean} [preserveUnknown]
     * @returns {string}
     */
    static resolveFill(fill, fallbackVariable, preserveUnknown = false) {
        const normalized = SchematicColorResolver.#normalizeColor(fill)

        if (!normalized) {
            return SchematicColorResolver.#toVariable(fallbackVariable)
        }

        if (
            normalized === 'none' ||
            normalized === 'transparent' ||
            normalized.startsWith('var(')
        ) {
            return normalized
        }

        const token = COLOR_TOKEN_BY_VALUE.get(normalized)

        // Border colors such as neutral note gray should stay literal when they
        // appear as area fills so symbol bodies do not collapse to the darker
        // border theme token.
        if (token === '--schematic-note-border-color') {
            return preserveUnknown
                ? normalized
                : SchematicColorResolver.#toVariable(fallbackVariable)
        }

        if (token) {
            return SchematicColorResolver.#toVariable(token)
        }

        return preserveUnknown
            ? normalized
            : SchematicColorResolver.#toVariable(fallbackVariable)
    }

    /**
     * Resolves one non-text fill, using schematic ink when source artwork only
     * supplies the default black text color.
     * @param {string | undefined} fill
     * @param {string} fallbackVariable
     * @param {boolean} [preserveUnknown]
     * @returns {string}
     */
    static resolveNonTextFill(fill, fallbackVariable, preserveUnknown = false) {
        const resolved = SchematicColorResolver.resolveFill(
            fill,
            fallbackVariable,
            preserveUnknown
        )

        return resolved ===
            SchematicColorResolver.#toVariable('--schematic-text-color')
            ? SchematicColorResolver.#toVariable(
                  '--schematic-default-ink-color'
              )
            : resolved
    }

    /**
     * Resolves an explicitly authored source stroke color without mapping it to
     * a semantic theme token.
     * @param {string | undefined} color
     * @param {string} fallbackVariable
     * @returns {string}
     */
    static resolveSourceColor(color, fallbackVariable) {
        return SchematicColorResolver.#resolveSourcePaint(
            color,
            fallbackVariable
        )
    }

    /**
     * Resolves an explicitly authored source fill color without mapping it to a
     * semantic theme token.
     * @param {string | undefined} fill
     * @param {string} fallbackVariable
     * @returns {string}
     */
    static resolveSourceFill(fill, fallbackVariable) {
        return SchematicColorResolver.#resolveSourcePaint(
            fill,
            fallbackVariable
        )
    }

    /**
     * Resolves an authored source stroke through a muted source palette.
     * @param {string | undefined} color
     * @param {string} fallbackVariable
     * @returns {string}
     */
    static resolveMutedSourceColor(color, fallbackVariable) {
        return SchematicColorResolver.#resolveMutedSourcePaint(
            color,
            fallbackVariable
        )
    }

    /**
     * Resolves an authored source fill through a muted source palette.
     * @param {string | undefined} fill
     * @param {string} fallbackVariable
     * @returns {string}
     */
    static resolveMutedSourceFill(fill, fallbackVariable) {
        return SchematicColorResolver.#resolveMutedSourcePaint(
            fill,
            fallbackVariable
        )
    }

    /**
     * Resolves one literal source paint value while preserving SVG control
     * values and falling back only when no source paint exists.
     * @param {string | undefined} paint
     * @param {string} fallbackVariable
     * @returns {string}
     */
    static #resolveSourcePaint(paint, fallbackVariable) {
        const normalized = SchematicColorResolver.#normalizeColor(paint)

        if (!normalized) {
            return SchematicColorResolver.#toVariable(fallbackVariable)
        }

        if (
            normalized === 'none' ||
            normalized === 'transparent' ||
            normalized.startsWith('var(')
        ) {
            return normalized
        }

        return normalized
    }

    /**
     * Resolves one literal source paint while reducing vivid palette colors.
     * @param {string | undefined} paint
     * @param {string} fallbackVariable
     * @returns {string}
     */
    static #resolveMutedSourcePaint(paint, fallbackVariable) {
        const normalized = SchematicColorResolver.#normalizeColor(paint)

        if (!normalized) {
            return SchematicColorResolver.#toVariable(fallbackVariable)
        }

        if (
            normalized === 'none' ||
            normalized === 'transparent' ||
            normalized.startsWith('var(')
        ) {
            return normalized
        }

        const rgb = SchematicColorResolver.#parseHexColor(normalized)
        if (!rgb) {
            return normalized
        }

        const hsl = SchematicColorResolver.#rgbToHsl(rgb)
        const mutedRgb = SchematicColorResolver.#hslToRgb({
            h: hsl.h,
            s: Math.min(hsl.s, 45),
            l: Math.min(Math.max(hsl.l, 30), 68)
        })

        return SchematicColorResolver.#formatHexColor(mutedRgb)
    }

    /**
     * Normalizes one raw color string for token lookup.
     * @param {string | undefined} color
     * @returns {string}
     */
    static #normalizeColor(color) {
        return String(color || '')
            .trim()
            .toLowerCase()
    }

    /**
     * Parses a six-digit hex color.
     * @param {string} color
     * @returns {{ r: number, g: number, b: number } | null}
     */
    static #parseHexColor(color) {
        const match = /^#([0-9a-f]{6})$/u.exec(color)
        if (!match) {
            return null
        }

        const value = match[1]
        return {
            r: Number.parseInt(value.slice(0, 2), 16),
            g: Number.parseInt(value.slice(2, 4), 16),
            b: Number.parseInt(value.slice(4, 6), 16)
        }
    }

    /**
     * Returns true for very dark source colors that usually mean default
     * schematic text black rather than an intentional artwork color.
     * @param {string} color Normalized color.
     * @returns {boolean}
     */
    static #isNearBlackSourceColor(color) {
        const rgb = SchematicColorResolver.#parseHexColor(color)
        if (!rgb) {
            return false
        }

        return Math.max(rgb.r, rgb.g, rgb.b) <= 32
    }

    /**
     * Returns true for dark saturated blue source colors that represent
     * Altium's default schematic ink family rather than custom artwork color.
     * @param {string} color Normalized color.
     * @returns {boolean}
     */
    static #isDefaultInkSourceColor(color) {
        const rgb = SchematicColorResolver.#parseHexColor(color)
        if (!rgb) {
            return false
        }

        const hsl = SchematicColorResolver.#rgbToHsl(rgb)
        const hueDegrees = hsl.h * 360

        return (
            hueDegrees >= 220 &&
            hueDegrees <= 270 &&
            hsl.s >= 45 &&
            hsl.l >= 12 &&
            hsl.l <= 38
        )
    }

    /**
     * Converts RGB channels to HSL.
     * @param {{ r: number, g: number, b: number }} color
     * @returns {{ h: number, s: number, l: number }}
     */
    static #rgbToHsl(color) {
        const r = color.r / 255
        const g = color.g / 255
        const b = color.b / 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        let h = 0
        let s = 0
        const l = ((max + min) / 2) * 100

        if (max !== min) {
            const delta = max - min
            s =
                ((max + min) / 2 > 0.5
                    ? delta / (2 - max - min)
                    : delta / (max + min)) * 100

            switch (max) {
                case r:
                    h = (g - b) / delta + (g < b ? 6 : 0)
                    break
                case g:
                    h = (b - r) / delta + 2
                    break
                default:
                    h = (r - g) / delta + 4
                    break
            }

            h /= 6
        }

        return { h, s, l }
    }

    /**
     * Converts HSL channels to RGB.
     * @param {{ h: number, s: number, l: number }} color
     * @returns {{ r: number, g: number, b: number }}
     */
    static #hslToRgb(color) {
        const s = color.s / 100
        const l = color.l / 100

        if (s === 0) {
            const value = Math.round(l * 255)
            return { r: value, g: value, b: value }
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        const r = SchematicColorResolver.#hueToRgb(p, q, color.h + 1 / 3)
        const g = SchematicColorResolver.#hueToRgb(p, q, color.h)
        const b = SchematicColorResolver.#hueToRgb(p, q, color.h - 1 / 3)

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        }
    }

    /**
     * Converts one hue channel to RGB.
     * @param {number} p
     * @param {number} q
     * @param {number} t
     * @returns {number}
     */
    static #hueToRgb(p, q, t) {
        let value = t
        if (value < 0) value += 1
        if (value > 1) value -= 1
        if (value < 1 / 6) return p + (q - p) * 6 * value
        if (value < 1 / 2) return q
        if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
        return p
    }

    /**
     * Formats RGB channels as a hex color.
     * @param {{ r: number, g: number, b: number }} color
     * @returns {string}
     */
    static #formatHexColor(color) {
        return (
            '#' +
            [color.r, color.g, color.b]
                .map((channel) =>
                    Math.max(0, Math.min(255, channel))
                        .toString(16)
                        .padStart(2, '0')
                )
                .join('')
        )
    }

    /**
     * Wraps one CSS custom property name in `var(...)` markup.
     * @param {string} variableName
     * @returns {string}
     */
    static #toVariable(variableName) {
        const normalized = String(variableName || '').trim()

        if (!normalized) {
            return 'transparent'
        }

        if (normalized.startsWith('var(')) {
            return normalized
        }

        return 'var(' + normalized + ')'
    }
}
