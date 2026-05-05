import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField, toColor } = ParserUtils

/**
 * Normalizes authored schematic bus-entry records.
 */
export class SchematicBusEntryParser {
    /**
     * Parses schematic bus-entry markers from `RECORD=37`.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }[]} records
     * @returns {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, renderOrder: number }[]}
     */
    static parseSchematicBusEntries(records) {
        return records
            .map((record) => {
                if (getField(record.fields, 'RECORD') !== '37') {
                    return null
                }

                const x1 = parseNumericField(record.fields, 'Location.X')
                const y1 = parseNumericField(record.fields, 'Location.Y')
                const x2 = parseNumericField(record.fields, 'Corner.X')
                const y2 = parseNumericField(record.fields, 'Corner.Y')

                if (x1 === null || y1 === null || x2 === null || y2 === null) {
                    return null
                }

                return {
                    x1,
                    y1,
                    x2,
                    y2,
                    color: toColor(record.fields.Color, '#000080'),
                    width: parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder:
                        parseNumericField(record.fields, 'IndexInSheet') ??
                        record.recordIndex
                }
            })
            .filter(Boolean)
    }
}
