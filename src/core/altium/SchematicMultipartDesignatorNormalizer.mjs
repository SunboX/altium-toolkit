// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Normalizes visible designator labels for repeated multipart schematic units.
 */
export class SchematicMultipartDesignatorNormalizer {
    /**
     * Rewrites multipart designator labels from the active Altium part id.
     * @param {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]} texts
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]}
     */
    static normalize(texts, activeMultipartOwnerParts) {
        const repeatedStems =
            SchematicMultipartDesignatorNormalizer.#collectRepeatedStems(
                texts,
                activeMultipartOwnerParts
            )

        return texts.map((text) =>
            SchematicMultipartDesignatorNormalizer.#normalizeText(
                text,
                activeMultipartOwnerParts,
                repeatedStems
            )
        )
    }

    /**
     * Collects designator stems used by multiple active multipart owners.
     * @param {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]} texts
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {Set<string>}
     */
    static #collectRepeatedStems(texts, activeMultipartOwnerParts) {
        const counts = new Map()

        for (const text of texts) {
            if (
                !SchematicMultipartDesignatorNormalizer.#isActiveDesignator(
                    text,
                    activeMultipartOwnerParts
                )
            ) {
                continue
            }

            const parsed =
                SchematicMultipartDesignatorNormalizer.#parseDesignatorStem(
                    text.text
                )
            if (!parsed) {
                continue
            }

            counts.set(parsed.stem, (counts.get(parsed.stem) || 0) + 1)
        }

        return new Set(
            [...counts.entries()]
                .filter(([, count]) => count > 1)
                .map(([stem]) => stem)
        )
    }

    /**
     * Normalizes one designator text row.
     * @param {{ text: string, name?: string, ownerIndex?: string, recordType?: string }} text
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @param {Set<string>} repeatedStems
     * @returns {{ text: string, name?: string, ownerIndex?: string, recordType?: string }}
     */
    static #normalizeText(text, activeMultipartOwnerParts, repeatedStems) {
        if (
            !SchematicMultipartDesignatorNormalizer.#isActiveDesignator(
                text,
                activeMultipartOwnerParts
            )
        ) {
            return text
        }

        const parsed =
            SchematicMultipartDesignatorNormalizer.#parseDesignatorStem(
                text.text
            )
        if (!parsed || !repeatedStems.has(parsed.stem)) {
            return text
        }

        const suffix = SchematicMultipartDesignatorNormalizer.#formatPartSuffix(
            activeMultipartOwnerParts.get(String(text.ownerIndex || ''))
        )
        const normalizedText = parsed.stem + suffix

        return normalizedText === text.text
            ? text
            : {
                  ...text,
                  text: normalizedText
              }
    }

    /**
     * Returns true when a text row is an active multipart designator.
     * @param {{ name?: string, ownerIndex?: string, recordType?: string }} text
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {boolean}
     */
    static #isActiveDesignator(text, activeMultipartOwnerParts) {
        const ownerIndex = String(text?.ownerIndex || '')

        return (
            activeMultipartOwnerParts.has(ownerIndex) &&
            text?.recordType === '34' &&
            String(text?.name || '')
                .trim()
                .toLowerCase() === 'designator'
        )
    }

    /**
     * Parses a component stem before an optional multipart suffix.
     * @param {string} text Designator text.
     * @returns {{ stem: string, suffix: string } | null}
     */
    static #parseDesignatorStem(text) {
        const match = /^(?<stem>.*\d)(?<suffix>[A-Z]+)?$/u.exec(
            String(text || '').trim()
        )

        return match?.groups
            ? {
                  stem: match.groups.stem,
                  suffix: match.groups.suffix || ''
              }
            : null
    }

    /**
     * Converts one numeric multipart part id into an alphabetic suffix.
     * @param {string | undefined} partId
     * @returns {string}
     */
    static #formatPartSuffix(partId) {
        const numericPartId = Number.parseInt(String(partId || ''), 10)
        if (!Number.isInteger(numericPartId) || numericPartId <= 0) {
            return ''
        }

        let suffix = ''
        let remaining = numericPartId

        while (remaining > 0) {
            remaining -= 1
            suffix = String.fromCharCode(65 + (remaining % 26)) + suffix
            remaining = Math.floor(remaining / 26)
        }

        return suffix
    }
}
