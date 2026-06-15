// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Parses schematic text runs that use backslash suffix markers for overlines.
 */
export class SchematicTextRunParser {
    /**
     * Parses overline suffix markers into display text and contiguous runs.
     * @param {string} value Source text.
     * @returns {{ text: string, hasOverline: boolean, segments: { text: string, overline: boolean }[] }}
     */
    static parseOverlineRuns(value) {
        const characters = []

        for (const character of String(value || '').trim()) {
            if (character === '\\') {
                const previousCharacter = characters.at(-1)
                if (previousCharacter) {
                    previousCharacter.overline = true
                }
                continue
            }

            characters.push({
                text: character,
                overline: false
            })
        }

        const segments = SchematicTextRunParser.#segments(characters)

        return {
            text: characters.map((character) => character.text).join(''),
            hasOverline: segments.some((segment) => segment.overline),
            segments
        }
    }

    /**
     * Returns only overline segments when a value contains overlined runs.
     * @param {string} value Source text.
     * @returns {{ text: string, segments?: { text: string, overline: boolean }[] }}
     */
    static parseOptionalOverlineRuns(value) {
        const parsed = SchematicTextRunParser.parseOverlineRuns(value)

        return {
            text: parsed.text,
            segments: parsed.hasOverline ? parsed.segments : undefined
        }
    }

    /**
     * Merges character flags into contiguous text segments.
     * @param {{ text: string, overline: boolean }[]} characters Character rows.
     * @returns {{ text: string, overline: boolean }[]}
     */
    static #segments(characters) {
        const segments = []

        for (const character of characters) {
            const previousSegment = segments.at(-1)
            if (
                previousSegment &&
                previousSegment.overline === character.overline
            ) {
                previousSegment.text += character.text
                continue
            }

            segments.push({
                text: character.text,
                overline: character.overline
            })
        }

        return segments
    }
}
