const GENERIC_IDENTITY_TOKENS = new Set([
    'body',
    'component',
    'crystal',
    'footprint',
    'library',
    'metric',
    'model',
    'package',
    'series'
])
const GENERIC_PACKAGE_PREFIX_TOKENS = new Set([
    ...GENERIC_IDENTITY_TOKENS,
    'user'
])

/**
 * Builds normalized Altium 3D body identity tokens for metadata matching.
 */
export class AltiumScene3dIdentityTokens {
    /**
     * Creates both full and delimiter-split identity tokens from one source.
     * @param {string} value Source text.
     * @returns {string[]}
     */
    static fromText(value) {
        const baseText = String(value || '')
            .replace(/\.[^.]+$/, '')
            .trim()
        const fullToken = AltiumScene3dIdentityTokens.#normalize([baseText])
        const normalizedParts = baseText
            .split(/[^a-zA-Z0-9]+/g)
            .map((part) => AltiumScene3dIdentityTokens.#normalize([part]))
        const packageTokens =
            AltiumScene3dIdentityTokens.#packageTokensForParts(normalizedParts)

        return [
            ...new Set([
                ...[fullToken, ...normalizedParts].filter((token) =>
                    AltiumScene3dIdentityTokens.#isMeaningful(token)
                ),
                ...packageTokens
            ])
        ]
    }

    /**
     * Creates compact package-code tokens after generic library words are
     * removed.
     * @param {string[]} parts Normalized identity parts.
     * @returns {string[]}
     */
    static #packageTokensForParts(parts) {
        const meaningfulParts = (Array.isArray(parts) ? parts : []).filter(
            (part) => part && !GENERIC_PACKAGE_PREFIX_TOKENS.has(part)
        )
        const tokens = []

        for (let index = 0; index < meaningfulParts.length - 1; index += 1) {
            const token = meaningfulParts.slice(index).join('')
            if (AltiumScene3dIdentityTokens.#isMeaningfulPackageCode(token)) {
                tokens.push(token)
            }
        }

        return tokens
    }

    /**
     * Checks whether one compact package code is strong enough for metadata
     * matching.
     * @param {string} token Normalized token.
     * @returns {boolean}
     */
    static #isMeaningfulPackageCode(token) {
        return (
            token.length >= 4 &&
            /[a-z]/u.test(token) &&
            /\d/u.test(token) &&
            !GENERIC_IDENTITY_TOKENS.has(token)
        )
    }

    /**
     * Checks whether one identity token is strong enough for metadata matching.
     * @param {string} token Normalized token.
     * @returns {boolean}
     */
    static #isMeaningful(token) {
        return token.length >= 6 && !GENERIC_IDENTITY_TOKENS.has(token)
    }

    /**
     * Normalizes identity strings for exact substring matching.
     * @param {unknown[]} values Source values.
     * @returns {string}
     */
    static #normalize(values) {
        return values
            .map((value) => String(value || '').toLowerCase())
            .join(' ')
            .replace(/\.[a-z0-9]+\\b/g, '')
            .replace(/[^a-z0-9]+/g, '')
    }
}
