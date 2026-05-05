import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders grouped BOM rows into HTML tables.
 */
export class BomTableRenderer {
    /**
     * Renders grouped BOM rows into an HTML table.
     * @param {{ designators: string[], quantity: number, pattern: string, source: string, value: string }[]} rows
     * @returns {string}
     */
    static render(rows) {
        if (!rows.length) {
            return '<section class="altium-renderer-empty">No BOM rows were recovered from this file.</section>'
        }

        const bodyMarkup = rows
            .map(
                (row) =>
                    '<tr><td>' +
                    SchematicSvgUtils.escapeHtml(row.designators.join(', ')) +
                    '</td><td>' +
                    SchematicSvgUtils.escapeHtml(String(row.quantity)) +
                    '</td><td>' +
                    SchematicSvgUtils.escapeHtml(row.pattern || 'Unknown') +
                    '</td><td>' +
                    SchematicSvgUtils.escapeHtml(row.value || '') +
                    '</td><td>' +
                    SchematicSvgUtils.escapeHtml(row.source || '') +
                    '</td></tr>'
            )
            .join('')

        return (
            '<section class="bom-panel"><header class="bom-panel__header"><h3>BOM</h3><p>' +
            rows.length +
            ' grouped rows</p></header><table class="bom-table"><thead><tr><th>Designators</th><th>Qty</th><th>Pattern</th><th>Value</th><th>Source</th></tr></thead><tbody>' +
            bodyMarkup +
            '</tbody></table></section>'
        )
    }
}
