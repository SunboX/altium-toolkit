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
