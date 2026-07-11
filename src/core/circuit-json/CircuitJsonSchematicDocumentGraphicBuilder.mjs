// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { CircuitJsonModelAdapterPrimitives } from './CircuitJsonModelAdapterPrimitives.mjs'
import { CircuitJsonSchematicImageProjection } from './CircuitJsonSchematicImageProjection.mjs'
import { CircuitJsonSchematicStrokeStyle } from './CircuitJsonSchematicStrokeStyle.mjs'

const Primitives = CircuitJsonModelAdapterPrimitives
const FAMILY_ORDER = Object.freeze({
    textBox: 7,
    table: 8,
    sheet: 9,
    image: 10,
    text: 11
})

/**
 * Projects document-level schematic graphics onto shared CircuitJSON rows.
 */
export class CircuitJsonSchematicDocumentGraphicBuilder {
    /**
     * Appends text boxes, tables, hierarchical sheets, and ordinary text.
     * @param {object[]} groups Destination render groups.
     * @param {Record<string, unknown>} schematic Native schematic read model.
     * @param {string} idScope Deterministic document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static append(groups, schematic, idScope, ownerIds) {
        CircuitJsonSchematicDocumentGraphicBuilder.#appendTextFrames(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicDocumentGraphicBuilder.#appendTables(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicDocumentGraphicBuilder.#appendSheets(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicDocumentGraphicBuilder.#appendImages(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicDocumentGraphicBuilder.#appendTexts(
            groups,
            schematic,
            idScope,
            ownerIds
        )
    }

    /**
     * Appends boxed notes as one outline and one positioned text row.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendTextFrames(groups, schematic, idScope, ownerIds) {
        for (const [index, frame] of Primitives.array(
            schematic.textFrames
        ).entries()) {
            const left = Math.min(
                Primitives.number(frame?.x, 0) || 0,
                Primitives.number(frame?.cornerX, frame?.x) || 0
            )
            const firstY = Primitives.number(frame?.y, 0) || 0
            const secondY =
                Primitives.number(frame?.cornerY, frame?.y) || firstY
            const bottom = Math.min(firstY, secondY)
            const top = Math.max(firstY, secondY)
            const width = Math.abs(
                Primitives.number(
                    frame?.width,
                    (Primitives.number(frame?.cornerX, 0) || 0) - left
                ) || 0
            )
            const height = Math.abs(
                Primitives.number(frame?.height, top - bottom) || 0
            )
            const margin = Math.max(
                Primitives.number(frame?.textMargin, 0) || 0,
                0
            )
            const identity =
                CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                    frame,
                    index
                )
            const owner =
                CircuitJsonSchematicDocumentGraphicBuilder.#ownerField(
                    frame,
                    ownerIds
                )
            CircuitJsonSchematicDocumentGraphicBuilder.#group(
                groups,
                frame,
                FAMILY_ORDER.textBox,
                index,
                [
                    {
                        type: 'schematic_rect',
                        schematic_rect_id: Primitives.id(idScope, [
                            'schematic_rect',
                            'text_box',
                            identity
                        ]),
                        center: Primitives.point(
                            left + width / 2,
                            bottom + height / 2
                        ),
                        width,
                        height,
                        stroke_width:
                            frame?.showBorder === false
                                ? 0
                                : Primitives.number(frame?.borderWidth, 1),
                        color: Primitives.string(
                            frame?.borderColor || frame?.color,
                            '#000000'
                        ),
                        fill_color: Primitives.string(frame?.fill, '#ffffff'),
                        ...CircuitJsonSchematicStrokeStyle.fields(
                            frame,
                            frame?.borderWidth ?? frame?.lineWidth
                        ),
                        is_filled: frame?.isSolid === true,
                        ...owner
                    },
                    {
                        type: 'schematic_text',
                        schematic_text_id: Primitives.id(idScope, [
                            'schematic_text',
                            'text_box',
                            identity
                        ]),
                        text: Primitives.string(frame?.text, ''),
                        position: Primitives.point(left + margin, top - margin),
                        font_size: Primitives.number(frame?.font?.size, 0.18),
                        rotation:
                            CircuitJsonSchematicDocumentGraphicBuilder.#textRotation(
                                frame
                            ),
                        anchor: 'top_left',
                        color: Primitives.string(frame?.color, '#000000'),
                        ...owner
                    }
                ]
            )
        }
    }

    /**
     * Appends generic native table read models when supplied by a parser.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendTables(groups, schematic, idScope, ownerIds) {
        for (const [index, table] of Primitives.array(
            schematic.tables
        ).entries()) {
            const tableId = Primitives.id(idScope, [
                'schematic_table',
                CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                    table,
                    index
                )
            ])
            const rows = [
                {
                    type: 'schematic_table',
                    schematic_table_id: tableId,
                    anchor_position: Primitives.point(
                        table?.anchorPosition?.x ?? table?.x,
                        table?.anchorPosition?.y ?? table?.y
                    ),
                    anchor: CircuitJsonSchematicDocumentGraphicBuilder.#tableAnchor(
                        table?.anchor
                    ),
                    column_widths: Primitives.array(
                        table?.columnWidths ?? table?.column_widths
                    ).map((width) => Primitives.number(width, 0)),
                    row_heights: Primitives.array(
                        table?.rowHeights ?? table?.row_heights
                    ).map((height) => Primitives.number(height, 0)),
                    border_width: Primitives.number(
                        table?.borderWidth ?? table?.border_width,
                        0
                    ),
                    ...CircuitJsonSchematicDocumentGraphicBuilder.#ownerField(
                        table,
                        ownerIds
                    )
                }
            ]
            for (const [cellIndex, cell] of Primitives.array(
                table?.cells
            ).entries()) {
                rows.push(
                    CircuitJsonSchematicDocumentGraphicBuilder.#tableCell(
                        cell,
                        cellIndex,
                        table,
                        tableId,
                        idScope
                    )
                )
            }
            CircuitJsonSchematicDocumentGraphicBuilder.#group(
                groups,
                table,
                FAMILY_ORDER.table,
                index,
                rows
            )
        }
    }

    /**
     * Appends hierarchical sheet boxes and entry ports.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendSheets(groups, schematic, idScope, ownerIds) {
        const sheets = Primitives.array(schematic.sheetSymbols)
        const sheetRows = new Map()
        for (const [index, sheet] of sheets.entries()) {
            const identity =
                CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                    sheet,
                    index
                )
            const sheetSymbolId = Primitives.id(idScope, [
                'schematic_sheet_symbol',
                identity
            ])
            const sourceComponentId = Primitives.id(idScope, [
                'source_component',
                'sheet',
                identity
            ])
            const height = Math.abs(Primitives.number(sheet?.height, 0) || 0)
            const y = Primitives.number(sheet?.y, 0) || 0
            const width = Math.abs(Primitives.number(sheet?.width, 0) || 0)
            const x = Primitives.number(sheet?.x, 0) || 0
            sheetRows.set(sheet, { sheetSymbolId, sourceComponentId })
            CircuitJsonSchematicDocumentGraphicBuilder.#group(
                groups,
                sheet,
                FAMILY_ORDER.sheet,
                index,
                [
                    {
                        type: 'source_component',
                        source_component_id: sourceComponentId,
                        name: Primitives.string(
                            sheet?.name || sheet?.fileName,
                            `Sheet ${index + 1}`
                        ),
                        ftype: 'simple_chip'
                    },
                    {
                        type: 'schematic_sheet_symbol',
                        schematic_sheet_symbol_id: sheetSymbolId,
                        name: Primitives.string(
                            sheet?.name || sheet?.fileName,
                            `Sheet ${index + 1}`
                        ),
                        ...(sheet?.fileName
                            ? { source_file_name: String(sheet.fileName) }
                            : {}),
                        center: Primitives.point(x + width / 2, y - height / 2),
                        width,
                        height,
                        stroke_width: Primitives.number(sheet?.lineWidth, 1),
                        color: Primitives.string(sheet?.color, '#000000'),
                        fill_color: Primitives.string(sheet?.fill, '#ffffff'),
                        ...CircuitJsonSchematicStrokeStyle.fields(
                            sheet,
                            sheet?.lineWidth
                        ),
                        is_filled:
                            sheet?.isSolid === true &&
                            sheet?.transparent !== true,
                        render_order:
                            CircuitJsonSchematicDocumentGraphicBuilder.#renderOrder(
                                sheet,
                                index
                            ),
                        ...CircuitJsonSchematicDocumentGraphicBuilder.#ownerField(
                            sheet,
                            ownerIds
                        )
                    }
                ]
            )
        }

        for (const [index, entry] of Primitives.array(
            schematic.sheetEntries
        ).entries()) {
            const sheet =
                CircuitJsonSchematicDocumentGraphicBuilder.#sheetForEntry(
                    entry,
                    sheets
                )
            const parent = sheetRows.get(sheet)
            if (!parent) continue
            const identity =
                CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                    entry,
                    index
                )
            const sourcePortId = Primitives.id(idScope, [
                'source_port',
                'sheet',
                parent.sheetSymbolId,
                identity
            ])
            const side = CircuitJsonSchematicDocumentGraphicBuilder.#sheetSide(
                entry?.side
            )
            CircuitJsonSchematicDocumentGraphicBuilder.#group(
                groups,
                entry,
                FAMILY_ORDER.sheet,
                sheets.length + index,
                [
                    {
                        type: 'source_port',
                        source_port_id: sourcePortId,
                        source_component_id: parent.sourceComponentId,
                        name: Primitives.string(
                            entry?.name,
                            `PORT_${index + 1}`
                        )
                    },
                    {
                        type: 'schematic_port',
                        schematic_port_id: Primitives.id(idScope, [
                            'schematic_port',
                            'sheet',
                            parent.sheetSymbolId,
                            identity
                        ]),
                        source_port_id: sourcePortId,
                        schematic_sheet_symbol_id: parent.sheetSymbolId,
                        display_pin_label: Primitives.string(entry?.name, ''),
                        center: Primitives.point(entry?.x, entry?.y),
                        side_of_component: side,
                        facing_direction:
                            side === 'top'
                                ? 'up'
                                : side === 'bottom'
                                  ? 'down'
                                  : side,
                        has_input_arrow:
                            entry?.direction === 'input' ||
                            entry?.direction === 'bidirectional',
                        has_output_arrow:
                            entry?.direction === 'output' ||
                            entry?.direction === 'bidirectional'
                    }
                ]
            )
        }
    }

    /**
     * Appends asset-backed schematic image placements.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendImages(groups, schematic, idScope, ownerIds) {
        for (const [index, image] of Primitives.array(
            schematic.images
        ).entries()) {
            const row = CircuitJsonSchematicImageProjection.element(
                image,
                index,
                idScope,
                ownerIds
            )
            if (!row) continue
            CircuitJsonSchematicDocumentGraphicBuilder.#group(
                groups,
                image,
                FAMILY_ORDER.image,
                index,
                [row]
            )
        }
    }

    /**
     * Appends non-frame schematic text and net labels.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendTexts(groups, schematic, idScope, ownerIds) {
        const hasTextFrames = Primitives.array(schematic.textFrames).length > 0
        for (const [index, text] of Primitives.array(
            schematic.texts
        ).entries()) {
            if (hasTextFrames && String(text?.recordType || '') === '28') {
                continue
            }
            const textValue = Primitives.string(
                text?.text || text?.value || text?.name,
                ''
            )
            const center = Primitives.point(text?.x, text?.y)
            const row = Primitives.isNetLabel(text)
                ? {
                      type: 'schematic_net_label',
                      schematic_net_label_id: Primitives.id(idScope, [
                          'schematic_net_label',
                          CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                              text,
                              index
                          )
                      ]),
                      source_net_id: Primitives.sourceNetId(
                          idScope,
                          textValue || index
                      ),
                      text: textValue,
                      center,
                      anchor_position: center,
                      anchor_side: 'top',
                      rotation:
                          CircuitJsonSchematicDocumentGraphicBuilder.#textRotation(
                              text
                          )
                  }
                : {
                      type: 'schematic_text',
                      schematic_text_id: Primitives.id(idScope, [
                          'schematic_text',
                          CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                              text,
                              index
                          )
                      ]),
                      text: textValue,
                      position: center,
                      font_size: Primitives.number(
                          text?.fontSize || text?.size,
                          0.18
                      ),
                      rotation:
                          CircuitJsonSchematicDocumentGraphicBuilder.#textRotation(
                              text
                          ),
                      anchor: CircuitJsonSchematicDocumentGraphicBuilder.#textAnchor(
                          text
                      ),
                      color: Primitives.string(text?.color, '#000000'),
                      ...CircuitJsonSchematicDocumentGraphicBuilder.#ownerField(
                          text,
                          ownerIds
                      )
                  }
            CircuitJsonSchematicDocumentGraphicBuilder.#group(
                groups,
                text,
                FAMILY_ORDER.text,
                index,
                [row]
            )
        }
    }

    /**
     * Builds one table cell from explicit or derived geometry.
     * @param {Record<string, unknown>} cell Native table cell.
     * @param {number} index Cell index.
     * @param {Record<string, unknown>} table Native table.
     * @param {string} tableId Canonical table id.
     * @param {string} idScope Document id scope.
     * @returns {object}
     */
    static #tableCell(cell, index, table, tableId, idScope) {
        const startRow = Math.max(
            Math.trunc(
                Primitives.number(
                    cell?.startRowIndex ?? cell?.row ?? cell?.start_row_index,
                    0
                ) || 0
            ),
            0
        )
        const endRow = Math.max(
            Math.trunc(
                Primitives.number(
                    cell?.endRowIndex ?? cell?.end_row_index,
                    startRow
                ) || startRow
            ),
            startRow
        )
        const startColumn = Math.max(
            Math.trunc(
                Primitives.number(
                    cell?.startColumnIndex ??
                        cell?.column ??
                        cell?.start_column_index,
                    0
                ) || 0
            ),
            0
        )
        const endColumn = Math.max(
            Math.trunc(
                Primitives.number(
                    cell?.endColumnIndex ?? cell?.end_column_index,
                    startColumn
                ) || startColumn
            ),
            startColumn
        )
        const columnWidths = Primitives.array(
            table?.columnWidths ?? table?.column_widths
        )
        const rowHeights = Primitives.array(
            table?.rowHeights ?? table?.row_heights
        )
        const anchor = Primitives.point(
            table?.anchorPosition?.x ?? table?.x,
            table?.anchorPosition?.y ?? table?.y
        )
        const beforeX = CircuitJsonSchematicDocumentGraphicBuilder.#sum(
            columnWidths.slice(0, startColumn)
        )
        const width = CircuitJsonSchematicDocumentGraphicBuilder.#sum(
            columnWidths.slice(startColumn, endColumn + 1)
        )
        const beforeY = CircuitJsonSchematicDocumentGraphicBuilder.#sum(
            rowHeights.slice(0, startRow)
        )
        const height = CircuitJsonSchematicDocumentGraphicBuilder.#sum(
            rowHeights.slice(startRow, endRow + 1)
        )
        return {
            type: 'schematic_table_cell',
            schematic_table_cell_id: Primitives.id(idScope, [
                'schematic_table_cell',
                tableId,
                CircuitJsonSchematicDocumentGraphicBuilder.#identity(
                    cell,
                    index
                )
            ]),
            schematic_table_id: tableId,
            text: Primitives.string(cell?.text, ''),
            center: Primitives.point(
                cell?.center?.x ?? anchor.x + beforeX + width / 2,
                cell?.center?.y ?? anchor.y + beforeY + height / 2
            ),
            width: Primitives.number(cell?.width, width),
            height: Primitives.number(cell?.height, height),
            start_column_index: startColumn,
            end_column_index: endColumn,
            start_row_index: startRow,
            end_row_index: endRow,
            horizontal_align:
                CircuitJsonSchematicDocumentGraphicBuilder.#horizontalAlign(
                    cell?.horizontalAlign ?? cell?.alignment
                ),
            vertical_align:
                CircuitJsonSchematicDocumentGraphicBuilder.#verticalAlign(
                    cell?.verticalAlign
                )
        }
    }

    /**
     * Sums numeric size values.
     * @param {unknown[]} values Size values.
     * @returns {number}
     */
    static #sum(values) {
        return values.reduce(
            (sum, value) => sum + (Primitives.number(value, 0) || 0),
            0
        )
    }

    /**
     * Adds one sortable group descriptor.
     * @param {object[]} groups Group list.
     * @param {Record<string, unknown>} source Native source row.
     * @param {number} familyOrder Graphic family order.
     * @param {number} index Family-local index.
     * @param {object[]} rows Canonical rows.
     * @returns {void}
     */
    static #group(groups, source, familyOrder, index, rows) {
        const renderOrder = Primitives.number(source?.renderOrder, index)
        groups.push({
            order: Number.isFinite(renderOrder) ? renderOrder : index,
            familyOrder,
            index,
            rows
        })
    }

    /**
     * Returns a deterministic native identity.
     * @param {Record<string, unknown>} source Native row.
     * @param {number} index Family-local index.
     * @returns {unknown}
     */
    static #identity(source, index) {
        return (
            source?.recordId ||
            source?.uniqueId ||
            source?.uuid ||
            source?.id ||
            source?.renderOrder ||
            index
        )
    }

    /**
     * Resolves one safe authored render order.
     * @param {Record<string, unknown>} source Native row.
     * @param {number} fallback Fallback order.
     * @returns {number}
     */
    static #renderOrder(source, fallback) {
        const order = Primitives.number(source?.renderOrder, fallback)
        return Number.isSafeInteger(order) ? order : fallback
    }

    /**
     * Returns optional component ownership.
     * @param {Record<string, unknown>} source Native row.
     * @param {Map<string, string>} ownerIds Owner lookup.
     * @returns {{ schematic_component_id?: string }}
     */
    static #ownerField(source, ownerIds) {
        const ownerId = ownerIds.get(String(source?.ownerIndex || ''))
        return ownerId ? { schematic_component_id: ownerId } : {}
    }

    /**
     * Finds the parent sheet whose perimeter contains an entry.
     * @param {Record<string, unknown>} entry Native sheet entry.
     * @param {Record<string, unknown>[]} sheets Native sheets.
     * @returns {Record<string, unknown> | undefined}
     */
    static #sheetForEntry(entry, sheets) {
        const x = Primitives.number(entry?.x, 0) || 0
        const y = Primitives.number(entry?.y, 0) || 0
        const epsilon = 0.000001
        return sheets.find((sheet) => {
            const left = Primitives.number(sheet?.x, 0) || 0
            const top = Primitives.number(sheet?.y, 0) || 0
            const right = left + (Primitives.number(sheet?.width, 0) || 0)
            const bottom = top - (Primitives.number(sheet?.height, 0) || 0)
            const withinX = x >= left - epsilon && x <= right + epsilon
            const withinY = y >= bottom - epsilon && y <= top + epsilon
            const onVertical =
                Math.abs(x - left) <= epsilon || Math.abs(x - right) <= epsilon
            const onHorizontal =
                Math.abs(y - top) <= epsilon || Math.abs(y - bottom) <= epsilon
            return withinX && withinY && (onVertical || onHorizontal)
        })
    }

    /**
     * Normalizes a sheet-entry side.
     * @param {unknown} side Native side.
     * @returns {'left' | 'right' | 'top' | 'bottom'}
     */
    static #sheetSide(side) {
        const normalized = String(side || '').toLowerCase()
        return ['left', 'right', 'top', 'bottom'].includes(normalized)
            ? normalized
            : 'left'
    }

    /**
     * Normalizes one text anchor.
     * @param {Record<string, unknown>} text Native text.
     * @returns {string}
     */
    static #textAnchor(text) {
        if (text?.verticalAnchor === 'top') {
            if (text?.anchor === 'end') return 'top_right'
            if (text?.anchor === 'middle') return 'top_center'
            return 'top_left'
        }
        if (text?.anchor === 'end') return 'right'
        if (text?.anchor === 'start') return 'left'
        return 'center'
    }

    /**
     * Preserves the historical signed SVG rotation for Altium text.
     * @param {Record<string, unknown>} text Native text.
     * @returns {number} Signed canonical rotation.
     */
    static #textRotation(text) {
        const rotation = Primitives.number(text?.rotation, 0) || 0
        if (!rotation) return 0
        const signed =
            Number(text?.sourceOrientation || 0) === 3 ? rotation : -rotation
        return text?.isMirrored === true ? -signed : signed
    }

    /**
     * Normalizes one table anchor.
     * @param {unknown} anchor Native anchor.
     * @returns {string}
     */
    static #tableAnchor(anchor) {
        const normalized = String(anchor || '').toLowerCase()
        return [
            'top_left',
            'top_center',
            'top_right',
            'center_left',
            'center',
            'center_right',
            'bottom_left',
            'bottom_center',
            'bottom_right'
        ].includes(normalized)
            ? normalized
            : 'top_left'
    }

    /**
     * Normalizes horizontal table-cell alignment.
     * @param {unknown} alignment Native alignment.
     * @returns {'left' | 'center' | 'right'}
     */
    static #horizontalAlign(alignment) {
        const normalized = String(alignment || '').toLowerCase()
        return ['left', 'center', 'right'].includes(normalized)
            ? normalized
            : 'left'
    }

    /**
     * Normalizes vertical table-cell alignment.
     * @param {unknown} alignment Native alignment.
     * @returns {'top' | 'middle' | 'bottom'}
     */
    static #verticalAlign(alignment) {
        const normalized = String(alignment || '').toLowerCase()
        return ['top', 'middle', 'bottom'].includes(normalized)
            ? normalized
            : 'middle'
    }
}

Object.freeze(CircuitJsonSchematicDocumentGraphicBuilder.prototype)
Object.freeze(CircuitJsonSchematicDocumentGraphicBuilder)
