// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves Altium No ERC marker symbol identifiers into stable names.
 */
export class SchematicNoErcSymbolResolver {
    /**
     * Converts common No ERC symbol ids and names into public labels.
     * @param {number | string | null | undefined} symbol Symbol id or source name.
     * @returns {string}
     */
    static resolveSymbolName(symbol) {
        const text = String(symbol ?? '')
            .trim()
            .toLowerCase()

        if (text) {
            if (/check\s*box/.test(text)) return 'checkbox'
            if (/cross/.test(text)) return 'cross'
            if (/triangle/.test(text)) return 'triangle'
            if (/box/.test(text)) return 'box'
            if (/generic/.test(text)) return 'generic'
        }

        return (
            {
                0: 'generic',
                1: 'box',
                2: 'cross',
                3: 'triangle'
            }[Number(symbol)] || 'unknown'
        )
    }
}
