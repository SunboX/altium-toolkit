// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Renders a non-interactive summary of recovered PCB 3D scene inputs.
 */
export class PcbScene3dSummaryRenderer {
    /**
     * Renders static 3D summary markup for a parsed PCB document.
     * @param {{ pcb?: { boardOutline?: { widthMil?: number, heightMil?: number }, components?: any[] }, bom?: any[] }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return '<section class="altium-3d-summary altium-3d-summary--empty">3D summary is available after parsing a PCB document.</section>'
        }

        const widthMil = PcbScene3dSummaryRenderer.#roundMil(
            pcb.boardOutline?.widthMil
        )
        const heightMil = PcbScene3dSummaryRenderer.#roundMil(
            pcb.boardOutline?.heightMil
        )
        const componentCount = Array.isArray(pcb.components)
            ? pcb.components.length
            : 0
        const bomRows = Array.isArray(documentModel?.bom)
            ? documentModel.bom.length
            : 0

        return (
            '<section class="altium-3d-summary">' +
            '<header class="altium-3d-summary__header"><h3>3D summary</h3><p>' +
            widthMil +
            ' x ' +
            heightMil +
            ' mil board envelope</p></header>' +
            '<dl class="altium-3d-summary__stats"><div><dt>Footprint</dt><dd>' +
            widthMil +
            ' x ' +
            heightMil +
            ' mil</dd></div><div><dt>Placements</dt><dd>' +
            componentCount +
            ' components</dd></div><div><dt>BOM groups</dt><dd>' +
            bomRows +
            '</dd></div></dl></section>'
        )
    }

    /**
     * Rounds a recovered mil dimension for display.
     * @param {unknown} value
     * @returns {number}
     */
    static #roundMil(value) {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue)) {
            return 0
        }

        return Math.round(numericValue)
    }
}
