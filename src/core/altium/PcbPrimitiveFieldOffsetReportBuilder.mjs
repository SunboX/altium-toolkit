// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds byte-offset evidence for preserved PCB primitive records.
 */
export class PcbPrimitiveFieldOffsetReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.primitive-field-offsets.a1'

    static #DEFAULT_FIELD_MAPS = Object.freeze([
        PcbPrimitiveFieldOffsetReportBuilder.#fieldMap(
            'Tracks6/Data',
            'payload',
            [
                ['layerId', 0, 1, 'uint8'],
                ['flags', 1, 1, 'uint8'],
                ['keepout', 2, 1, 'uint8'],
                ['netIndex', 3, 2, 'int16-le'],
                ['polygonIndex', 5, 2, 'int16-le'],
                ['componentIndex', 7, 2, 'int16-le'],
                ['x1', 13, 4, 'mil-int32-le'],
                ['y1', 17, 4, 'mil-int32-le'],
                ['x2', 21, 4, 'mil-int32-le'],
                ['y2', 25, 4, 'mil-int32-le'],
                ['width', 29, 4, 'mil-int32-le'],
                ['unionIndex', 36, 1, 'uint8'],
                ['lengthTuning', 37, 1, 'uint8'],
                ['userRouted', 44, 1, 'uint8']
            ]
        ),
        PcbPrimitiveFieldOffsetReportBuilder.#fieldMap(
            'Arcs6/Data',
            'payload',
            [
                ['layerId', 0, 1, 'uint8'],
                ['netIndex', 3, 2, 'int16-le'],
                ['polygonIndex', 5, 2, 'int16-le'],
                ['componentIndex', 7, 2, 'int16-le'],
                ['x', 13, 4, 'mil-int32-le'],
                ['y', 17, 4, 'mil-int32-le'],
                ['radius', 21, 4, 'mil-int32-le'],
                ['startAngle', 25, 8, 'float64-le'],
                ['endAngle', 33, 8, 'float64-le'],
                ['width', 41, 4, 'mil-int32-le']
            ]
        ),
        PcbPrimitiveFieldOffsetReportBuilder.#fieldMap(
            'Fills6/Data',
            'record',
            [
                ['layerId', 5, 1, 'uint8'],
                ['netIndex', 8, 2, 'int16-le'],
                ['polygonIndex', 10, 2, 'int16-le'],
                ['componentIndex', 12, 2, 'int16-le'],
                ['x1', 18, 4, 'mil-int32-le'],
                ['y1', 22, 4, 'mil-int32-le'],
                ['x2', 26, 4, 'mil-int32-le'],
                ['y2', 30, 4, 'mil-int32-le'],
                ['layerCode', 46, 2, 'uint16-le']
            ]
        ),
        PcbPrimitiveFieldOffsetReportBuilder.#fieldMap('Vias6/Data', 'record', [
            ['layerId', 5, 1, 'uint8'],
            ['netIndex', 8, 2, 'int16-le'],
            ['polygonIndex', 10, 2, 'int16-le'],
            ['componentIndex', 12, 2, 'int16-le'],
            ['x', 18, 4, 'mil-int32-le'],
            ['y', 22, 4, 'mil-int32-le'],
            ['diameter', 26, 4, 'mil-int32-le'],
            ['holeDiameter', 30, 4, 'mil-int32-le'],
            ['layerStartId', 34, 1, 'uint8'],
            ['layerEndId', 35, 1, 'uint8']
        ])
    ])

    /**
     * Builds a field-offset report for preserved primitive records.
     * @param {{ fileName?: string, rawRecords?: object[], records?: object[], fieldMaps?: object[] }} [input]
     * @returns {object}
     */
    static build(input = {}) {
        const records = PcbPrimitiveFieldOffsetReportBuilder.#records(input)
        const fieldMaps = [
            ...PcbPrimitiveFieldOffsetReportBuilder.#DEFAULT_FIELD_MAPS,
            ...PcbPrimitiveFieldOffsetReportBuilder.#normalizeFieldMaps(
                input.fieldMaps || []
            )
        ]
        const fields = []
        const unmatchedRecords = []

        for (const record of records) {
            const fieldMap =
                PcbPrimitiveFieldOffsetReportBuilder.#matchingFieldMap(
                    record,
                    fieldMaps
                )

            if (!fieldMap) {
                unmatchedRecords.push(
                    PcbPrimitiveFieldOffsetReportBuilder.#recordKey(record)
                )
                continue
            }

            for (const field of fieldMap.fields) {
                fields.push(
                    PcbPrimitiveFieldOffsetReportBuilder.#fieldRow(
                        record,
                        fieldMap,
                        field
                    )
                )
            }
        }

        const streams =
            PcbPrimitiveFieldOffsetReportBuilder.#streamSummaries(fields)

        return PcbPrimitiveFieldOffsetReportBuilder.#stripUndefined({
            schema: PcbPrimitiveFieldOffsetReportBuilder.SCHEMA,
            sourceDocument: input.fileName || undefined,
            summary: {
                recordCount: records.length,
                mappedRecordCount: records.length - unmatchedRecords.length,
                fieldCount: fields.length,
                streamCount: streams.length,
                unmatchedRecordCount: unmatchedRecords.length
            },
            streams,
            fields,
            unmatchedRecords
        })
    }

    /**
     * Creates one built-in field-map descriptor.
     * @param {string} sourceStream Native stream path.
     * @param {'record' | 'payload'} relativeTo Offset origin.
     * @param {Array<[string, number, number, string]>} fieldRows Field rows.
     * @returns {object}
     */
    static #fieldMap(sourceStream, relativeTo, fieldRows) {
        return Object.freeze({
            sourceStream,
            relativeTo,
            fields: Object.freeze(
                fieldRows.map(([name, offset, byteLength, encoding]) =>
                    Object.freeze({
                        name,
                        offset,
                        byteLength,
                        encoding
                    })
                )
            )
        })
    }

    /**
     * Normalizes record input.
     * @param {object} input Report input.
     * @returns {object[]}
     */
    static #records(input) {
        if (Array.isArray(input.rawRecords)) return input.rawRecords
        if (Array.isArray(input.records)) return input.records
        return []
    }

    /**
     * Normalizes caller-provided field maps.
     * @param {object[]} fieldMaps Field maps.
     * @returns {object[]}
     */
    static #normalizeFieldMaps(fieldMaps) {
        return fieldMaps
            .filter((fieldMap) => fieldMap?.sourceStream)
            .map((fieldMap) => ({
                sourceStream: String(fieldMap.sourceStream),
                family: fieldMap.family ? String(fieldMap.family) : undefined,
                type: fieldMap.type ? String(fieldMap.type) : undefined,
                relativeTo:
                    fieldMap.relativeTo === 'record' ? 'record' : 'payload',
                fields: (Array.isArray(fieldMap.fields) ? fieldMap.fields : [])
                    .filter((field) => field?.name)
                    .map((field) =>
                        PcbPrimitiveFieldOffsetReportBuilder.#stripUndefined({
                            name: String(field.name),
                            offset: Number(field.offset || 0),
                            byteLength: Number(field.byteLength || 0),
                            encoding: field.encoding
                                ? String(field.encoding)
                                : undefined,
                            relativeTo:
                                field.relativeTo === 'record' ||
                                field.relativeTo === 'payload'
                                    ? field.relativeTo
                                    : undefined
                        })
                    )
            }))
    }

    /**
     * Finds the field-map matching one raw record.
     * @param {object} record Raw record row.
     * @param {object[]} fieldMaps Field-map descriptors.
     * @returns {object | undefined}
     */
    static #matchingFieldMap(record, fieldMaps) {
        return fieldMaps.find((fieldMap) => {
            if (fieldMap.sourceStream !== record.sourceStream) return false
            if (fieldMap.family && fieldMap.family !== record.family) {
                return false
            }
            if (fieldMap.type && fieldMap.type !== record.type) return false
            return true
        })
    }

    /**
     * Builds one field evidence row.
     * @param {object} record Raw record row.
     * @param {object} fieldMap Field-map descriptor.
     * @param {object} field Field descriptor.
     * @returns {object}
     */
    static #fieldRow(record, fieldMap, field) {
        const relativeTo = field.relativeTo || fieldMap.relativeTo
        const baseOffset =
            Number(record.offset || 0) +
            PcbPrimitiveFieldOffsetReportBuilder.#relativeOffset(
                record,
                relativeTo
            )
        const offset = Number(field.offset || 0)
        const byteLength = Number(field.byteLength || 0)
        const withinRecordOffset = baseOffset - Number(record.offset || 0)

        return PcbPrimitiveFieldOffsetReportBuilder.#stripUndefined({
            sourceStream: record.sourceStream,
            family: record.family,
            type: record.type,
            typeId: PcbPrimitiveFieldOffsetReportBuilder.#finiteOrUndefined(
                record.typeId
            ),
            recordIndex:
                PcbPrimitiveFieldOffsetReportBuilder.#finiteOrUndefined(
                    record.recordIndex
                ),
            name: field.name,
            relativeTo,
            offset,
            absoluteOffset: baseOffset + offset,
            byteLength,
            endOffset: baseOffset + offset + byteLength,
            encoding: field.encoding,
            available:
                byteLength > 0 &&
                withinRecordOffset + offset + byteLength <=
                    Number(record.byteLength || 0)
        })
    }

    /**
     * Returns the offset of a field origin within a raw record.
     * @param {object} record Raw record row.
     * @param {'record' | 'payload'} relativeTo Offset origin.
     * @returns {number}
     */
    static #relativeOffset(record, relativeTo) {
        if (relativeTo !== 'payload') return 0
        if (record.encoding === 'length-prefixed') return 5
        return 0
    }

    /**
     * Summarizes mapped fields by source stream.
     * @param {object[]} fields Field rows.
     * @returns {object[]}
     */
    static #streamSummaries(fields) {
        const byStream = new Map()

        for (const field of fields) {
            if (!byStream.has(field.sourceStream)) {
                byStream.set(field.sourceStream, {
                    sourceStream: field.sourceStream,
                    recordIndexes: new Set(),
                    fieldNames: [],
                    fieldNameSet: new Set()
                })
            }

            const summary = byStream.get(field.sourceStream)
            summary.recordIndexes.add(field.recordIndex)
            if (!summary.fieldNameSet.has(field.name)) {
                summary.fieldNameSet.add(field.name)
                summary.fieldNames.push(field.name)
            }
        }

        return [...byStream.values()].map((summary) => ({
            sourceStream: summary.sourceStream,
            recordCount: summary.recordIndexes.size,
            fieldCount: fields.filter(
                (field) => field.sourceStream === summary.sourceStream
            ).length,
            fieldNames: summary.fieldNames
        }))
    }

    /**
     * Builds a compact record key for unmatched records.
     * @param {object} record Raw record row.
     * @returns {object}
     */
    static #recordKey(record) {
        return PcbPrimitiveFieldOffsetReportBuilder.#stripUndefined({
            sourceStream: record.sourceStream,
            family: record.family,
            type: record.type,
            recordIndex:
                PcbPrimitiveFieldOffsetReportBuilder.#finiteOrUndefined(
                    record.recordIndex
                )
        })
    }

    /**
     * Returns a finite number or undefined.
     * @param {unknown} value Candidate number.
     * @returns {number | undefined}
     */
    static #finiteOrUndefined(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number : undefined
    }

    /**
     * Removes undefined values from a report row.
     * @param {object} row Report row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
