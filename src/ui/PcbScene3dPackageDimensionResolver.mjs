/**
 * Resolves package dimensions from structured component metadata.
 */
export class PcbScene3dPackageDimensionResolver {
    static #MIL_PER_MM = 39.3700787402

    /**
     * Resolves explicit planar package dimensions in mils.
     * @param {{ parameters?: Record<string, unknown> } | null | undefined} component Source component.
     * @returns {{ width: number, depth: number } | null}
     */
    static resolvePlanarSize(component) {
        const parameters = component?.parameters
        if (
            !parameters ||
            typeof parameters !== 'object' ||
            Array.isArray(parameters)
        ) {
            return null
        }

        const length = PcbScene3dPackageDimensionResolver.#dimensionByKeys(
            parameters,
            ['length', 'package length', 'body length']
        )
        const width = PcbScene3dPackageDimensionResolver.#dimensionByKeys(
            parameters,
            ['width', 'package width', 'body width']
        )
        if (!length || !width) {
            return null
        }

        return { width: length, depth: width }
    }

    /**
     * Finds a dimension parameter by normalized key.
     * @param {Record<string, unknown>} parameters Component parameters.
     * @param {string[]} keys Accepted keys.
     * @returns {number | null}
     */
    static #dimensionByKeys(parameters, keys) {
        const acceptedKeys = new Set(
            keys.map((key) =>
                PcbScene3dPackageDimensionResolver.#normalizeKey(key)
            )
        )

        for (const [key, value] of Object.entries(parameters)) {
            if (
                acceptedKeys.has(
                    PcbScene3dPackageDimensionResolver.#normalizeKey(key)
                )
            ) {
                const dimension =
                    PcbScene3dPackageDimensionResolver.#parseDimensionMil(value)
                if (dimension) {
                    return dimension
                }
            }
        }

        return null
    }

    /**
     * Parses one dimension string into mils.
     * @param {unknown} value Source parameter value.
     * @returns {number | null}
     */
    static #parseDimensionMil(value) {
        const text = String(value || '').replace(/,/gu, '.')
        const match = text.match(
            /(-?\d+(?:\.\d+)?)\s*(mm|millimeters?|mils?|in(?:ch(?:es)?)?|")/iu
        )
        if (!match) {
            return null
        }

        const amount = Number(match[1])
        if (!Number.isFinite(amount) || amount <= 0) {
            return null
        }

        const unit = String(match[2] || '').toLowerCase()
        if (unit === 'mm' || unit.startsWith('millimeter')) {
            return amount * PcbScene3dPackageDimensionResolver.#MIL_PER_MM
        }
        if (unit === 'mil' || unit === 'mils') {
            return amount
        }
        return amount * 1000
    }

    /**
     * Normalizes one parameter key.
     * @param {unknown} key Source key.
     * @returns {string}
     */
    static #normalizeKey(key) {
        return String(key || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/gu, ' ')
    }
}
