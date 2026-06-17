// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds source-neutral package model suggestion rows for library compatibility.
 */
export class LibraryCompatibilityModelHintBuilder {
    /**
     * Builds model suggestion rows from package-like footprint names.
     * @param {object[]} pcbLibraries PCB library models.
     * @returns {object[]}
     */
    static build(pcbLibraries) {
        const suggestions = []

        for (const library of pcbLibraries || []) {
            const libraryFileName = String(library?.fileName || '')
            for (const footprint of library?.pcbLibrary?.footprints || []) {
                const suggestion =
                    LibraryCompatibilityModelHintBuilder.#modelSuggestion(
                        libraryFileName,
                        footprint
                    )
                if (suggestion) suggestions.push(suggestion)
            }
        }

        return suggestions
    }

    /**
     * Builds one footprint model suggestion row.
     * @param {string} libraryFileName Source library file name.
     * @param {object} footprint Footprint row.
     * @returns {object | null}
     */
    static #modelSuggestion(libraryFileName, footprint) {
        if (
            (footprint?.embeddedModels || []).length ||
            (footprint?.componentBodies || []).length ||
            (footprint?.componentModels || []).length
        ) {
            return null
        }

        const name = String(footprint?.name || '').trim()
        const keys = LibraryCompatibilityModelHintBuilder.#packageKeys(name)
        const packageClass = keys[0]
        if (
            !LibraryCompatibilityModelHintBuilder.#knownPackageClass(
                packageClass
            )
        ) {
            return null
        }

        return {
            libraryFileName,
            footprintName: name,
            packageClass,
            keys,
            ...LibraryCompatibilityModelHintBuilder.#modelRotationHint(
                footprint
            ),
            reason: 'footprint has no embedded or body-level model reference'
        }
    }

    /**
     * Builds package matching keys from one footprint name.
     * @param {string} name Footprint name.
     * @returns {string[]}
     */
    static #packageKeys(name) {
        const keys = []

        for (const rawToken of String(name || '').split(/[_()\s]+/u)) {
            const token = rawToken.trim().toUpperCase()
            if (!token) continue
            LibraryCompatibilityModelHintBuilder.#appendPackageToken(
                keys,
                token
            )
        }

        return keys
    }

    /**
     * Appends one package token and useful derived token fragments.
     * @param {string[]} keys Destination keys.
     * @param {string} token Source token.
     * @returns {void}
     */
    static #appendPackageToken(keys, token) {
        const parts = token.includes('-')
            ? token.split('-').filter(Boolean)
            : [token]

        for (const part of parts) {
            if (!LibraryCompatibilityModelHintBuilder.#isPitchToken(part)) {
                LibraryCompatibilityModelHintBuilder.#appendUnique(keys, part)
            }
            LibraryCompatibilityModelHintBuilder.#appendDerivedKeys(keys, part)
        }

        LibraryCompatibilityModelHintBuilder.#appendCompoundPackageKeys(
            keys,
            token
        )
    }

    /**
     * Appends package-derived keys for one token.
     * @param {string[]} keys Destination keys.
     * @param {string} token Source token.
     * @returns {void}
     */
    static #appendDerivedKeys(keys, token) {
        if (/^\d+X\d+$/u.test(token)) {
            LibraryCompatibilityModelHintBuilder.#appendUnique(keys, 'ARRAY')
        }

        const pitch = /^(?:PITCH|P)?(\d+(?:\.\d+)?)P?$/u.exec(token)
        if (pitch && token.includes('P')) {
            LibraryCompatibilityModelHintBuilder.#appendUnique(
                keys,
                'PITCH-' + pitch[1]
            )
        }

        if (token.endsWith('1EP')) {
            LibraryCompatibilityModelHintBuilder.#appendUnique(keys, 'EP')
        }

        const pinCount = /^(\d+)PIN$/u.exec(token)
        if (pinCount) {
            LibraryCompatibilityModelHintBuilder.#appendUnique(
                keys,
                pinCount[1]
            )
            LibraryCompatibilityModelHintBuilder.#appendUnique(
                keys,
                pinCount[1] + 'P'
            )
        }
    }

    /**
     * Appends derived keys that need the original compound token.
     * @param {string[]} keys Destination keys.
     * @param {string} token Source token.
     * @returns {void}
     */
    static #appendCompoundPackageKeys(keys, token) {
        const smd = /^(SMD)-(\d+)$/u.exec(token)
        if (smd) {
            LibraryCompatibilityModelHintBuilder.#appendUnique(keys, smd[1])
            LibraryCompatibilityModelHintBuilder.#appendUnique(keys, smd[2])
        }

        const pinRange = /^(\d+)-(\d+)PIN$/u.exec(token)
        if (pinRange) {
            LibraryCompatibilityModelHintBuilder.#appendUnique(
                keys,
                pinRange[1]
            )
            LibraryCompatibilityModelHintBuilder.#appendUnique(
                keys,
                pinRange[2] + 'P'
            )
        }
    }

    /**
     * Builds optional 3D model rotation metadata from pin-one pad position.
     * @param {object} footprint Footprint row.
     * @returns {object}
     */
    static #modelRotationHint(footprint) {
        const pad = LibraryCompatibilityModelHintBuilder.#pinOnePad(footprint)
        const position = LibraryCompatibilityModelHintBuilder.#point(pad)
        if (!pad || !position) return {}

        return {
            pinOneDesignator: String(pad.designator || ''),
            pinOnePosition: position,
            rotationHint:
                LibraryCompatibilityModelHintBuilder.#rotationHintFromPosition(
                    position
                )
        }
    }

    /**
     * Finds the pad most likely to define package model orientation.
     * @param {object} footprint Footprint row.
     * @returns {object | null}
     */
    static #pinOnePad(footprint) {
        const pinOneNames = new Set(['1', 'A1', 'A2', 'A3', 'K'])

        return (
            (footprint?.pads || []).find((pad) =>
                pinOneNames.has(String(pad?.designator || '').toUpperCase())
            ) || null
        )
    }

    /**
     * Derives a package rotation hint from pin-one quadrant.
     * @param {{ x: number, y: number }} position Pin-one position.
     * @returns {number}
     */
    static #rotationHintFromPosition(position) {
        if (position.x < 0) {
            if (position.y > 0) return -90
            return 0
        }
        if (position.x > 0) {
            if (position.y < 0) return 90
            return 180
        }

        return position.y > 0 ? 180 : 0
    }

    /**
     * Returns true when one token can be represented as a pitch key.
     * @param {string} token Source token.
     * @returns {boolean}
     */
    static #isPitchToken(token) {
        return /^(?:PITCH|P)\d+(?:\.\d+)?P?$|^\d+(?:\.\d+)?P$/u.test(token)
    }

    /**
     * Returns true for common package family tokens.
     * @param {string} value Package class token.
     * @returns {boolean}
     */
    static #knownPackageClass(value) {
        return new Set([
            'BGA',
            'CSP',
            'DFN',
            'DIP',
            'LGA',
            'LQFP',
            'QFN',
            'QFP',
            'SO',
            'SOIC',
            'SOP',
            'SOT',
            'SSOP',
            'TQFP',
            'TSSOP'
        ]).has(value)
    }

    /**
     * Appends a value once.
     * @param {string[]} rows Destination rows.
     * @param {string} value Candidate value.
     * @returns {void}
     */
    static #appendUnique(rows, value) {
        if (value && !rows.includes(value)) rows.push(value)
    }

    /**
     * Returns one finite point from a row with x/y fields.
     * @param {object} value Candidate row.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        const x = LibraryCompatibilityModelHintBuilder.#finiteNumber(value?.x)
        const y = LibraryCompatibilityModelHintBuilder.#finiteNumber(value?.y)

        if (x === null || y === null) return null

        return { x, y }
    }

    /**
     * Converts one value to a finite number.
     * @param {unknown} value Candidate number.
     * @returns {number | null}
     */
    static #finiteNumber(value) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : null
    }
}
