// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getDisplayText, getField } = ParserUtils

/**
 * Resolves visible schematic component labels from owner-linked and nearby text.
 */
export class SchematicComponentTextResolver {
    /**
     * Resolves a component designator from owner-linked text or nearby labels.
     * @param {{ fields: Record<string, string | string[]> }[]} ownerTexts
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number, libReference: string }} component
     * @returns {string | null}
     */
    static resolveDesignator(ownerTexts, texts, component) {
        const ownerDesignator =
            SchematicComponentTextResolver.#findRelatedTextRecord(
                ownerTexts,
                'Designator'
            )
        if (
            ownerDesignator.found &&
            SchematicComponentTextResolver.#isResolvedComponentText(
                ownerDesignator.text
            )
        ) {
            return ownerDesignator.text
        }

        if (
            ownerDesignator.found &&
            SchematicComponentTextResolver.#isExplicitEmptyText(
                ownerDesignator.text
            )
        ) {
            return ''
        }

        return SchematicComponentTextResolver.#findNearbyComponentDesignator(
            texts,
            component
        )
    }

    /**
     * Resolves a component value from owner-linked text or nearby labels.
     * @param {{ fields: Record<string, string | string[]> }[]} ownerTexts
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number, libReference: string }} component
     * @returns {string}
     */
    static resolveValue(ownerTexts, texts, component) {
        const ownerValue =
            SchematicComponentTextResolver.#findFirstRelatedTextRecord(
                ownerTexts,
                ['Comment', 'VALUE']
            )
        if (
            ownerValue.found &&
            SchematicComponentTextResolver.#isResolvedComponentText(
                ownerValue.text
            )
        ) {
            return ownerValue.text
        }

        if (
            ownerValue.found &&
            SchematicComponentTextResolver.#isExplicitEmptyText(ownerValue.text)
        ) {
            return ''
        }

        return (
            SchematicComponentTextResolver.#findNearbyComponentText(
                texts,
                component,
                ['comment', 'value'],
                '',
                SchematicComponentTextResolver.#inferComponentValueHint(
                    component.libReference
                )
            ) ||
            ownerValue.text ||
            ''
        )
    }

    /**
     * Finds a related text value by name.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string} logicalName
     * @returns {{ found: boolean, text: string }}
     */
    static #findRelatedTextRecord(records, logicalName) {
        const match = records.find(
            (record) =>
                getField(record.fields, 'Name').toLowerCase() ===
                logicalName.toLowerCase()
        )
        return match
            ? { found: true, text: getDisplayText(match.fields) }
            : { found: false, text: '' }
    }

    /**
     * Finds the first related text value by logical name.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string[]} logicalNames Logical text names.
     * @returns {{ found: boolean, text: string }}
     */
    static #findFirstRelatedTextRecord(records, logicalNames) {
        for (const logicalName of logicalNames) {
            const match = SchematicComponentTextResolver.#findRelatedTextRecord(
                records,
                logicalName
            )
            if (match.found) {
                return match
            }
        }

        return { found: false, text: '' }
    }

    /**
     * Finds the closest nearby designator text for one component.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number, libReference: string }} component
     * @returns {string | null}
     */
    static #findNearbyComponentDesignator(texts, component) {
        const expectedPrefix =
            SchematicComponentTextResolver.#inferComponentDesignatorPrefix(
                component.libReference
            )
        const expectedValueHint =
            SchematicComponentTextResolver.#inferComponentValueHint(
                component.libReference
            )
        const candidates =
            SchematicComponentTextResolver.#collectNearbyComponentTextCandidates(
                texts,
                component,
                ['designator']
            )
        const scopedCandidates = expectedPrefix
            ? candidates.filter((candidate) =>
                  candidate.text
                      .toUpperCase()
                      .startsWith(expectedPrefix.toUpperCase())
              )
            : candidates
        const usableCandidates = scopedCandidates.length
            ? scopedCandidates
            : candidates
        const rankedCandidates = usableCandidates
            .map((candidate) => ({
                ...candidate,
                score:
                    candidate.distance +
                    SchematicComponentTextResolver.#scoreAssociatedValueMismatch(
                        texts,
                        candidate,
                        expectedValueHint
                    )
            }))
            .sort((left, right) => left.score - right.score)

        return rankedCandidates[0]?.text || null
    }

    /**
     * Finds the closest nearby visible text for one component.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number }} component
     * @param {string[]} logicalNames
     * @param {string} expectedPrefix
     * @param {string} expectedTextHint
     * @returns {string}
     */
    static #findNearbyComponentText(
        texts,
        component,
        logicalNames,
        expectedPrefix = '',
        expectedTextHint = ''
    ) {
        const candidates =
            SchematicComponentTextResolver.#collectNearbyComponentTextCandidates(
                texts,
                component,
                logicalNames
            )
        const prefixedCandidates = expectedPrefix
            ? candidates.filter((candidate) =>
                  candidate.text
                      .toUpperCase()
                      .startsWith(expectedPrefix.toUpperCase())
              )
            : candidates
        const scopedCandidates = prefixedCandidates.length
            ? prefixedCandidates
            : candidates
        const hintedCandidates = expectedTextHint
            ? scopedCandidates.filter((candidate) =>
                  SchematicComponentTextResolver.#normalizeTextMatch(
                      candidate.text
                  ).includes(
                      SchematicComponentTextResolver.#normalizeTextMatch(
                          expectedTextHint
                      )
                  )
              )
            : scopedCandidates
        const usableCandidates = hintedCandidates.length
            ? hintedCandidates
            : scopedCandidates

        return usableCandidates.sort(
            (left, right) => left.distance - right.distance
        )[0]?.text
    }

    /**
     * Collects nearby visible schematic text candidates around one component.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number }} component
     * @param {string[]} logicalNames
     * @returns {{ x: number, y: number, text: string, distance: number }[]}
     */
    static #collectNearbyComponentTextCandidates(
        texts,
        component,
        logicalNames
    ) {
        const allowedNames = new Set(
            logicalNames.map((name) => name.toLowerCase())
        )

        return texts
            .filter((text) =>
                allowedNames.has(
                    String(text.name || '')
                        .trim()
                        .toLowerCase()
                )
            )
            .map((text) => ({
                x: text.x,
                y: text.y,
                text: text.text,
                distance:
                    Math.abs(text.x - component.x) +
                    Math.abs(text.y - component.y)
            }))
            .filter(
                (text) =>
                    Math.abs(text.x - component.x) <= 80 &&
                    Math.abs(text.y - component.y) <= 80
            )
    }

    /**
     * Penalizes a designator candidate when nearby value text mismatches.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number }} candidate
     * @param {string} expectedValueHint
     * @returns {number}
     */
    static #scoreAssociatedValueMismatch(texts, candidate, expectedValueHint) {
        if (!expectedValueHint) {
            return 0
        }

        const associatedValue =
            SchematicComponentTextResolver.#findNearbyComponentText(
                texts,
                candidate,
                ['comment', 'value']
            )
        if (!associatedValue) {
            return 0
        }

        return SchematicComponentTextResolver.#normalizeTextMatch(
            associatedValue
        ).includes(
            SchematicComponentTextResolver.#normalizeTextMatch(
                expectedValueHint
            )
        )
            ? -30
            : 30
    }

    /**
     * Returns true when owner-linked text is usable as a display value.
     * @param {string} value
     * @returns {boolean}
     */
    static #isResolvedComponentText(value) {
        const normalized = String(value || '').trim()

        return Boolean(
            normalized && normalized !== '*' && !normalized.startsWith('=')
        )
    }

    /**
     * Returns true when owner-linked text intentionally contains no value.
     * @param {string} value Text value.
     * @returns {boolean}
     */
    static #isExplicitEmptyText(value) {
        return String(value ?? '') === ''
    }

    /**
     * Infers the visible designator prefix from a library reference.
     * @param {string} libReference
     * @returns {string}
     */
    static #inferComponentDesignatorPrefix(libReference) {
        const normalized = String(libReference || '')
            .trim()
            .toUpperCase()

        if (normalized.startsWith('RES/')) return 'R'
        if (normalized.startsWith('CAP/')) return 'C'
        if (normalized.startsWith('DIODE/')) return 'D'
        if (normalized.startsWith('CON/')) return 'J'
        if (normalized.startsWith('IC/')) return 'U'

        return ''
    }

    /**
     * Infers the visible value label from a library reference.
     * @param {string} libReference
     * @returns {string}
     */
    static #inferComponentValueHint(libReference) {
        const segments = String(libReference || '')
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean)

        for (let index = segments.length - 1; index >= 0; index -= 1) {
            const segment = segments[index]

            if (
                SchematicComponentTextResolver.#isPackageLikeComponentSegment(
                    segment
                ) ||
                /\s/.test(segment)
            ) {
                continue
            }

            if (
                /^(?:\d+(?:\.\d+)?(?:R|K|M|UF|NF|PF)|1N[A-Z0-9-]+)$/i.test(
                    segment
                )
            ) {
                return segment
            }

            if (
                /[A-Z]/i.test(segment) &&
                /\d/.test(segment) &&
                segment.length >= 6
            ) {
                return segment
            }
        }

        return ''
    }

    /**
     * Returns true when a library segment is package/rating-like.
     * @param {string} segment
     * @returns {boolean}
     */
    static #isPackageLikeComponentSegment(segment) {
        return /^(?:CE|\d{4}|SC\d+|SOD-\d+|\d+(?:\.\d+)?V|\d+(?:\.\d+)?[%％])$/i.test(
            String(segment || '').trim()
        )
    }

    /**
     * Normalizes a text fragment for proximity matching.
     * @param {string} value
     * @returns {string}
     */
    static #normalizeTextMatch(value) {
        return String(value || '')
            .toUpperCase()
            .replaceAll(/\s+/g, '')
            .replaceAll('％', '%')
    }
}
