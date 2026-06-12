// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'
import { SchematicNoErcSymbolResolver } from './SchematicNoErcSymbolResolver.mjs'

/**
 * Helpers for normalized schematic directive primitives.
 */
export class SchematicDirectiveParser {
    /**
     * Normalizes schematic directive records into drawable directive metadata.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, color: string, name: string, orientation: number }[]}
     */
    static parseSchematicDirectives(records) {
        return records
            .map((record) => {
                const x = ParserUtils.parseNumericField(
                    record.fields,
                    'Location.X'
                )
                const y = ParserUtils.parseNumericField(
                    record.fields,
                    'Location.Y'
                )
                const name = ParserUtils.getField(record.fields, 'Name')

                if (x === null || y === null || !name) {
                    return null
                }

                return {
                    x,
                    y,
                    color: ParserUtils.toColor(record.fields.Color, '#ff0000'),
                    name,
                    orientation:
                        ParserUtils.parseNumericField(
                            record.fields,
                            'Orientation'
                        ) || 0
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes directive-like schematic records into first-class semantic
     * groups for project analysis and downstream highlighting.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records
     * @returns {{ noErc: object[], parameterSets: object[], differentialPairs: object[], compileMasks: object[], blankets: object[] }}
     */
    static parseDirectiveSemantics(records) {
        const childrenByOwner =
            SchematicDirectiveParser.#buildParameterChildren(records)
        const parameterSets = (records || [])
            .filter(
                (record) =>
                    ParserUtils.getField(record.fields, 'RECORD') === '43'
            )
            .map((record) =>
                SchematicDirectiveParser.#parseParameterSet(
                    record,
                    childrenByOwner
                )
            )
            .filter(Boolean)

        return {
            noErc: (records || [])
                .filter(
                    (record) =>
                        ParserUtils.getField(record.fields, 'RECORD') === '22'
                )
                .map((record) => SchematicDirectiveParser.#parseNoErc(record))
                .filter(Boolean),
            parameterSets,
            differentialPairs: parameterSets.filter(
                (parameterSet) => parameterSet.isDifferentialPair
            ),
            compileMasks: (records || [])
                .filter(
                    (record) =>
                        ParserUtils.getField(record.fields, 'RECORD') === '211'
                )
                .map((record) =>
                    SchematicDirectiveParser.#parseCompileMask(record)
                )
                .filter(Boolean),
            blankets: (records || [])
                .filter(
                    (record) =>
                        ParserUtils.getField(record.fields, 'RECORD') === '225'
                )
                .map((record) => SchematicDirectiveParser.#parseBlanket(record))
                .filter(Boolean)
        }
    }

    /**
     * Builds child parameter rows keyed by their owning record index.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Map<string, object[]>}
     */
    static #buildParameterChildren(records) {
        const childrenByOwner = new Map()
        for (const record of records || []) {
            if (ParserUtils.getField(record.fields, 'RECORD') !== '41') {
                continue
            }

            const parameter =
                SchematicDirectiveParser.#parseChildParameter(record)
            if (!parameter.ownerIndex) continue
            if (!childrenByOwner.has(parameter.ownerIndex)) {
                childrenByOwner.set(parameter.ownerIndex, [])
            }
            childrenByOwner.get(parameter.ownerIndex).push(parameter)
        }
        return childrenByOwner
    }

    /**
     * Parses one child parameter record.
     * @param {{ fields: Record<string, string | string[]> }} record Record row.
     * @returns {{ name: string, value: string, isHidden: boolean, ownerIndex: string }}
     */
    static #parseChildParameter(record) {
        return {
            name: ParserUtils.getField(record.fields, 'Name'),
            value: ParserUtils.getDisplayText(record.fields),
            isHidden: ParserUtils.parseBoolean(record.fields.IsHidden),
            ownerIndex: ParserUtils.getField(record.fields, 'OwnerIndex')
        }
    }

    /**
     * Parses one No ERC marker.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Record row.
     * @returns {object | null}
     */
    static #parseNoErc(record) {
        const x = ParserUtils.parseNumericField(record.fields, 'Location.X')
        const y = ParserUtils.parseNumericField(record.fields, 'Location.Y')
        if (x === null || y === null) return null
        const rawSymbol = ParserUtils.getField(record.fields, 'Symbol')
        const symbol = ParserUtils.parseNumericField(record.fields, 'Symbol')

        return {
            recordId: SchematicDirectiveParser.#recordId(record),
            recordType: '22',
            recordIndex: record.recordIndex,
            indexInSheet:
                ParserUtils.parseNumericField(record.fields, 'IndexInSheet') ??
                null,
            x,
            y,
            color: ParserUtils.toColor(record.fields.Color, '#ff0000'),
            orientation:
                ParserUtils.parseNumericField(record.fields, 'Orientation') ||
                0,
            symbol,
            symbolName: SchematicNoErcSymbolResolver.resolveSymbolName(
                rawSymbol || symbol
            )
        }
    }

    /**
     * Parses one parameter-set directive and its child parameter records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Record row.
     * @param {Map<string, object[]>} childrenByOwner Child parameter map.
     * @returns {object | null}
     */
    static #parseParameterSet(record, childrenByOwner) {
        const x = ParserUtils.parseNumericField(record.fields, 'Location.X')
        const y = ParserUtils.parseNumericField(record.fields, 'Location.Y')
        const name = ParserUtils.getField(record.fields, 'Name')
        if (x === null || y === null || !name) return null
        const parameters = SchematicDirectiveParser.#childrenForRecord(
            record,
            childrenByOwner
        )
        const parameterMap = {}
        for (const parameter of parameters) {
            if (!parameter.name) continue
            parameterMap[parameter.name] = parameter.value
        }
        const isDifferentialPair =
            /diff(?:erential)?pair/i.test(name) ||
            SchematicDirectiveParser.#booleanText(parameterMap.DifferentialPair)
        const differentialPairClassName =
            parameterMap.DifferentialPairClassName ||
            parameterMap.ClassName ||
            ''

        return {
            recordId: SchematicDirectiveParser.#recordId(record),
            recordType: '43',
            recordIndex: record.recordIndex,
            indexInSheet:
                ParserUtils.parseNumericField(record.fields, 'IndexInSheet') ??
                null,
            x,
            y,
            color: ParserUtils.toColor(record.fields.Color, '#ff0000'),
            name,
            orientation:
                ParserUtils.parseNumericField(record.fields, 'Orientation') ||
                0,
            parameters,
            parameterMap,
            isDifferentialPair,
            differentialPairClassName
        }
    }

    /**
     * Parses one compile-mask rectangle.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Record row.
     * @returns {object | null}
     */
    static #parseCompileMask(record) {
        const x = ParserUtils.parseNumericField(record.fields, 'Location.X')
        const y = ParserUtils.parseNumericField(record.fields, 'Location.Y')
        const cornerX = ParserUtils.parseNumericField(record.fields, 'Corner.X')
        const cornerY = ParserUtils.parseNumericField(record.fields, 'Corner.Y')
        if (x === null || y === null || cornerX === null || cornerY === null) {
            return null
        }

        return {
            recordId: SchematicDirectiveParser.#recordId(record),
            recordType: '211',
            recordIndex: record.recordIndex,
            indexInSheet:
                ParserUtils.parseNumericField(record.fields, 'IndexInSheet') ??
                null,
            x: Math.min(x, cornerX),
            y: Math.min(y, cornerY),
            width: Math.abs(cornerX - x),
            height: Math.abs(cornerY - y),
            color: ParserUtils.toColor(record.fields.Color, '#ff0000'),
            fillColor: ParserUtils.toColor(record.fields.AreaColor, '#ffffff'),
            isSolid: ParserUtils.parseBoolean(record.fields.IsSolid)
        }
    }

    /**
     * Parses one blanket polygon record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Record row.
     * @returns {object | null}
     */
    static #parseBlanket(record) {
        const points = SchematicDirectiveParser.#parsePoints(record.fields)
        if (!points.length) return null

        return {
            recordId: SchematicDirectiveParser.#recordId(record),
            recordType: '225',
            recordIndex: record.recordIndex,
            indexInSheet:
                ParserUtils.parseNumericField(record.fields, 'IndexInSheet') ??
                null,
            points,
            color: ParserUtils.toColor(record.fields.Color, '#000080'),
            fillColor: ParserUtils.toColor(record.fields.AreaColor, '#ffffff'),
            isSolid: ParserUtils.parseBoolean(record.fields.IsSolid)
        }
    }

    /**
     * Returns child parameters for one owning directive record.
     * @param {{ fields: Record<string, string | string[]> }} record Record row.
     * @param {Map<string, object[]>} childrenByOwner Child parameter map.
     * @returns {object[]}
     */
    static #childrenForRecord(record, childrenByOwner) {
        for (const key of SchematicDirectiveParser.#ownerKeys(record)) {
            const children = childrenByOwner.get(key)
            if (children?.length) return children
        }
        return []
    }

    /**
     * Builds possible owner keys for directive child-parameter records.
     * @param {{ fields: Record<string, string | string[]> }} record Record row.
     * @returns {string[]}
     */
    static #ownerKeys(record) {
        const keys = []
        const indexInSheet = ParserUtils.parseNumericField(
            record.fields,
            'IndexInSheet'
        )
        if (indexInSheet !== null) {
            keys.push(String(indexInSheet), String(indexInSheet + 1))
        }
        const ownerIndex = ParserUtils.getField(record.fields, 'OwnerIndex')
        if (ownerIndex) keys.push(ownerIndex)
        return [...new Set(keys)]
    }

    /**
     * Parses numbered point fields from a polygon-like record.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @returns {{ x: number, y: number }[]}
     */
    static #parsePoints(fields) {
        const count =
            ParserUtils.parseNumericField(fields, 'LocationCount') || 0
        const points = []
        for (let index = 1; index <= count; index += 1) {
            const x = ParserUtils.parseNumericField(fields, 'X' + index)
            const y = ParserUtils.parseNumericField(fields, 'Y' + index)
            if (x === null || y === null) continue
            points.push({ x, y })
        }
        return points
    }

    /**
     * Builds a stable record id.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Record row.
     * @returns {string}
     */
    static #recordId(record) {
        const indexInSheet = ParserUtils.parseNumericField(
            record.fields,
            'IndexInSheet'
        )
        if (indexInSheet !== null) return 'record-' + indexInSheet
        return 'record-' + String(record.recordIndex ?? 0)
    }

    /**
     * Parses one boolean-ish directive parameter value.
     * @param {unknown} value Raw parameter value.
     * @returns {boolean}
     */
    static #booleanText(value) {
        return /^(1|t|true|yes)$/i.test(String(value || '').trim())
    }
}
