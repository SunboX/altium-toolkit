// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicRecordTypeRegistry } from './SchematicRecordTypeRegistry.mjs'

const SCHEMATIC_FIELD_MAPS = Object.freeze({
    label: {
        Text: 'schematic.texts[].text',
        'Location.X': 'schematic.texts[].x',
        'Location.Y': 'schematic.texts[].y',
        Color: 'schematic.texts[].color'
    },
    line: {
        'Location.X': 'schematic.lines[].x1',
        'Location.Y': 'schematic.lines[].y1',
        'Corner.X': 'schematic.lines[].x2',
        'Corner.Y': 'schematic.lines[].y2',
        LineWidth: 'schematic.lines[].width',
        Color: 'schematic.lines[].color',
        LineStyle: 'schematic.lines[].lineStyle'
    },
    rectangle: {
        'Location.X': 'schematic.rectangles[].x',
        'Location.Y': 'schematic.rectangles[].y',
        'Corner.X': 'schematic.rectangles[].width',
        'Corner.Y': 'schematic.rectangles[].height',
        LineWidth: 'schematic.rectangles[].lineWidth',
        AreaColor: 'schematic.rectangles[].fill',
        Color: 'schematic.rectangles[].color'
    },
    pin: {
        Name: 'schematic.pins[].name',
        Designator: 'schematic.pins[].designator',
        'Location.X': 'schematic.pins[].x',
        'Location.Y': 'schematic.pins[].y',
        PinLength: 'schematic.pins[].length',
        Electrical: 'schematic.pins[].electrical'
    },
    wire: {
        LocationCount: 'schematic.lines[].pointCount',
        LineWidth: 'schematic.lines[].width',
        Color: 'schematic.lines[].color',
        LineStyle: 'schematic.lines[].lineStyle'
    },
    component: {
        LibReference: 'schematic.components[].libReference',
        DesignItemId: 'schematic.components[].designItemId',
        'Location.X': 'schematic.components[].x',
        'Location.Y': 'schematic.components[].y',
        CurrentPartID: 'schematic.components[].currentPartId',
        PartCount: 'schematic.components[].partCount'
    },
    'net-label': {
        Text: 'schematic.nets[].labels[].text',
        'Location.X': 'schematic.nets[].labels[].x',
        'Location.Y': 'schematic.nets[].labels[].y'
    },
    port: {
        Name: 'schematic.ports[].name',
        'Location.X': 'schematic.ports[].x',
        'Location.Y': 'schematic.ports[].y',
        Width: 'schematic.ports[].width',
        Height: 'schematic.ports[].height'
    },
    'power-port': {
        Text: 'schematic.texts[].text',
        'Location.X': 'schematic.texts[].x',
        'Location.Y': 'schematic.texts[].y',
        Style: 'schematic.texts[].powerPortDirection'
    },
    junction: {
        'Location.X': 'schematic.junctions[].x',
        'Location.Y': 'schematic.junctions[].y',
        Color: 'schematic.junctions[].color'
    },
    sheet: {
        CustomX: 'schematic.sheet.width',
        CustomY: 'schematic.sheet.height',
        BorderOn: 'schematic.sheet.borderOn',
        TitleBlockOn: 'schematic.sheet.titleBlockOn'
    },
    image: {
        'Location.X': 'schematic.images[].x',
        'Location.Y': 'schematic.images[].y',
        'Corner.X': 'schematic.images[].width',
        'Corner.Y': 'schematic.images[].height',
        FileName: 'schematic.images[].fileName'
    },
    hyperlink: {
        URL: 'schematic.hyperlinks[].url',
        Text: 'schematic.hyperlinks[].text',
        'Location.X': 'schematic.hyperlinks[].x',
        'Location.Y': 'schematic.hyperlinks[].y',
        FontID: 'schematic.hyperlinks[].fontId',
        Color: 'schematic.hyperlinks[].color',
        AreaColor: 'schematic.hyperlinks[].areaColor',
        OwnerIndex: 'schematic.hyperlinks[].ownerIndex',
        OwnerPartID: 'schematic.hyperlinks[].ownerPartId',
        UniqueID: 'schematic.hyperlinks[].uniqueId',
        IndexInSheet: 'schematic.hyperlinks[].indexInSheet',
        Orientation: 'schematic.hyperlinks[].orientation',
        Justification: 'schematic.hyperlinks[].justification',
        IsNotAccesible: 'schematic.hyperlinks[].isNotAccessible',
        IsNotAccessible: 'schematic.hyperlinks[].isNotAccessible'
    }
})

const PCB_FIELD_MAPS = Object.freeze({
    tracks: {
        X1: 'pcb.tracks[].x1',
        Y1: 'pcb.tracks[].y1',
        X2: 'pcb.tracks[].x2',
        Y2: 'pcb.tracks[].y2',
        WIDTH: 'pcb.tracks[].width',
        LAYER: 'pcb.tracks[].layerId',
        NET: 'pcb.tracks[].netName',
        UNIQUEID: 'pcb.tracks[].uniqueId'
    },
    pads: {
        NAME: 'pcb.pads[].designator',
        X: 'pcb.pads[].x',
        Y: 'pcb.pads[].y',
        HOLESIZE: 'pcb.pads[].holeSize',
        LAYER: 'pcb.pads[].layerId',
        NET: 'pcb.pads[].netName',
        UNIQUEID: 'pcb.pads[].uniqueId'
    },
    vias: {
        X: 'pcb.vias[].x',
        Y: 'pcb.vias[].y',
        SIZE: 'pcb.vias[].diameter',
        HOLESIZE: 'pcb.vias[].holeSize',
        LOWLAYER: 'pcb.vias[].layerStartId',
        HIGHLAYER: 'pcb.vias[].layerEndId',
        NET: 'pcb.vias[].netName',
        UNIQUEID: 'pcb.vias[].uniqueId'
    },
    arcs: {
        X: 'pcb.arcs[].x',
        Y: 'pcb.arcs[].y',
        RADIUS: 'pcb.arcs[].radius',
        STARTANGLE: 'pcb.arcs[].startAngle',
        ENDANGLE: 'pcb.arcs[].endAngle',
        WIDTH: 'pcb.arcs[].width',
        LAYER: 'pcb.arcs[].layerId',
        UNIQUEID: 'pcb.arcs[].uniqueId'
    },
    fills: {
        X1: 'pcb.fills[].x1',
        Y1: 'pcb.fills[].y1',
        X2: 'pcb.fills[].x2',
        Y2: 'pcb.fills[].y2',
        LAYER: 'pcb.fills[].layerId',
        UNIQUEID: 'pcb.fills[].uniqueId'
    },
    regions: {
        LAYER: 'pcb.regions[].layerId',
        KIND: 'pcb.regions[].kind',
        NAME: 'pcb.regions[].name',
        UNIQUEID: 'pcb.regions[].uniqueId'
    },
    texts: {
        TEXT: 'pcb.texts[].text',
        X: 'pcb.texts[].x',
        Y: 'pcb.texts[].y',
        HEIGHT: 'pcb.texts[].height',
        ROTATION: 'pcb.texts[].rotation',
        LAYER: 'pcb.texts[].layerId',
        FONTNAME: 'pcb.texts[].fontName',
        UNIQUEID: 'pcb.texts[].uniqueId'
    }
})

/**
 * Builds field-level parser coverage reports from native-style records.
 */
export class ParserFieldCoverageReportBuilder {
    static SCHEMA = 'altium-toolkit.parser-field-coverage.a1'

    /**
     * Builds a parser field coverage report.
     * @param {{ models?: object[], schematicRecords?: object[], pcbRecords?: object[] }} [input]
     * @returns {object}
     */
    static build(input = {}) {
        const families = [
            ...ParserFieldCoverageReportBuilder.#schematicFamilies(input),
            ...ParserFieldCoverageReportBuilder.#pcbFamilies(input)
        ].sort(
            (left, right) =>
                ParserFieldCoverageReportBuilder.#domainRank(left.domain) -
                    ParserFieldCoverageReportBuilder.#domainRank(
                        right.domain
                    ) || left.family.localeCompare(right.family)
        )

        return {
            schema: ParserFieldCoverageReportBuilder.SCHEMA,
            summary: {
                familyCount: families.length,
                observedFieldCount:
                    ParserFieldCoverageReportBuilder.#sumFieldCount(
                        families,
                        'observedFields'
                    ),
                mappedFieldCount:
                    ParserFieldCoverageReportBuilder.#sumFieldCount(
                        families,
                        'mappedFields'
                    ),
                missingFieldCount:
                    ParserFieldCoverageReportBuilder.#sumFieldCount(
                        families,
                        'missingFields'
                    ),
                unsupportedFieldCount:
                    ParserFieldCoverageReportBuilder.#sumFieldCount(
                        families,
                        'unsupportedFields'
                    ),
                supportedFamilyCount: families.filter(
                    (family) => family.supported
                ).length,
                unsupportedFamilyCount: families.filter(
                    (family) => !family.supported
                ).length,
                completeFamilyCount: families.filter(
                    (family) => family.coverage.status === 'complete'
                ).length,
                partialFamilyCount: families.filter(
                    (family) => family.coverage.status === 'partial'
                ).length,
                mappedFieldCoverageRatio:
                    ParserFieldCoverageReportBuilder.#ratio(
                        ParserFieldCoverageReportBuilder.#sumFieldCount(
                            families,
                            'mappedFields'
                        ),
                        ParserFieldCoverageReportBuilder.#sumFieldCount(
                            families,
                            'mappedFields'
                        ) +
                            ParserFieldCoverageReportBuilder.#sumFieldCount(
                                families,
                                'missingFields'
                            )
                    )
            },
            matrix: ParserFieldCoverageReportBuilder.#matrix(families),
            families
        }
    }

    /**
     * Builds schematic coverage family rows.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #schematicFamilies(input) {
        const groups = new Map()
        for (const record of ParserFieldCoverageReportBuilder.#schematicRecords(
            input
        )) {
            const descriptor = SchematicRecordTypeRegistry.get(
                ParserFieldCoverageReportBuilder.#fieldValue(
                    record.fields,
                    'RECORD'
                )
            )
            const family = descriptor.name
            const key = 'schematic:' + family
            const group =
                groups.get(key) ||
                ParserFieldCoverageReportBuilder.#createGroup({
                    domain: 'schematic',
                    family,
                    supported: descriptor.supported,
                    source: record.sourceStream || ''
                })

            group.count += 1
            group.sources.add(record.sourceStream || '')
            ParserFieldCoverageReportBuilder.#collectFields({
                group,
                fields: record.fields || {},
                mapping: SCHEMATIC_FIELD_MAPS[family] || {},
                supported: descriptor.supported,
                ignoredFields: descriptor.supported ? new Set(['RECORD']) : null
            })
            groups.set(key, group)
        }

        return [...groups.values()].map((group) =>
            ParserFieldCoverageReportBuilder.#finalizeGroup(group)
        )
    }

    /**
     * Builds PCB coverage family rows.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #pcbFamilies(input) {
        const groups = new Map()
        for (const record of ParserFieldCoverageReportBuilder.#pcbRecords(
            input
        )) {
            const family =
                ParserFieldCoverageReportBuilder.#pcbFamilyForRecord(record)
            const key = 'pcb:' + family
            const group =
                groups.get(key) ||
                ParserFieldCoverageReportBuilder.#createGroup({
                    domain: 'pcb',
                    family,
                    supported: Boolean(PCB_FIELD_MAPS[family]),
                    source: record.sourceStream || ''
                })

            group.count += 1
            group.sources.add(record.sourceStream || '')
            ParserFieldCoverageReportBuilder.#collectFields({
                group,
                fields: record.fields || {},
                mapping: PCB_FIELD_MAPS[family] || {},
                supported: Boolean(PCB_FIELD_MAPS[family]),
                ignoredFields: new Set(['RECORD', 'KIND'])
            })
            groups.set(key, group)
        }

        return [...groups.values()].map((group) =>
            ParserFieldCoverageReportBuilder.#finalizeGroup(group)
        )
    }

    /**
     * Collects schematic source records from direct input and parser roots.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #schematicRecords(input) {
        return [
            ...(Array.isArray(input?.schematicRecords)
                ? input.schematicRecords
                : []),
            ...ParserFieldCoverageReportBuilder.#models(input).flatMap(
                (model) => model?.schematic?.sourceRecords || []
            )
        ]
    }

    /**
     * Collects PCB source records from direct input and parser roots.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #pcbRecords(input) {
        return [
            ...(Array.isArray(input?.pcbRecords) ? input.pcbRecords : []),
            ...ParserFieldCoverageReportBuilder.#models(input).flatMap(
                (model) => model?.pcb?.sourceRecords || []
            )
        ]
    }

    /**
     * Normalizes models input.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #models(input) {
        return Array.isArray(input?.models) ? input.models : []
    }

    /**
     * Creates one mutable family group.
     * @param {{ domain: string, family: string, supported: boolean, source: string }} options Group options.
     * @returns {object}
     */
    static #createGroup(options) {
        return {
            domain: options.domain,
            family: options.family,
            source: options.source,
            supported: options.supported,
            count: 0,
            sources: new Set(options.source ? [options.source] : []),
            observedFields: new Set(),
            mappedFields: new Map(),
            missingFields: new Set(),
            unsupportedFields: new Set()
        }
    }

    /**
     * Adds fields from one record to a family group.
     * @param {{ group: object, fields: object, mapping: object, supported: boolean, ignoredFields: Set<string> | null }} options Collection options.
     * @returns {void}
     */
    static #collectFields(options) {
        const mappingByLower = ParserFieldCoverageReportBuilder.#lowercaseMap(
            options.mapping
        )
        const ignored = ParserFieldCoverageReportBuilder.#lowercaseSet(
            options.ignoredFields || new Set()
        )

        for (const field of Object.keys(options.fields || {})) {
            if (ignored.has(field.toLowerCase())) continue
            options.group.observedFields.add(field)

            if (!options.supported) {
                options.group.unsupportedFields.add(field)
                continue
            }

            const modelField = mappingByLower.get(field.toLowerCase())
            if (modelField) {
                options.group.mappedFields.set(field, modelField)
            } else {
                options.group.missingFields.add(field)
            }
        }
    }

    /**
     * Builds a case-insensitive mapping from source field to model field.
     * @param {Record<string, string>} mapping Field mapping.
     * @returns {Map<string, string>}
     */
    static #lowercaseMap(mapping) {
        return new Map(
            Object.entries(mapping || {}).map(([sourceField, modelField]) => [
                sourceField.toLowerCase(),
                modelField
            ])
        )
    }

    /**
     * Builds a case-insensitive lookup set.
     * @param {Set<string>} values Source values.
     * @returns {Set<string>}
     */
    static #lowercaseSet(values) {
        return new Set(
            [...(values || new Set())].map((value) =>
                String(value || '').toLowerCase()
            )
        )
    }

    /**
     * Finalizes one mutable group into a JSON-friendly row.
     * @param {object} group Mutable group.
     * @returns {object}
     */
    static #finalizeGroup(group) {
        const sources = ParserFieldCoverageReportBuilder.#sortedStrings([
            ...group.sources
        ])
        const observedFields = ParserFieldCoverageReportBuilder.#sortedStrings([
            ...group.observedFields
        ])
        const mappedFields = [...group.mappedFields.entries()]
            .map(([sourceField, modelField]) => ({
                sourceField,
                modelField
            }))
            .sort((left, right) =>
                left.sourceField.localeCompare(right.sourceField)
            )
        const missingFields = ParserFieldCoverageReportBuilder.#sortedStrings([
            ...group.missingFields
        ])
        const unsupportedFields =
            ParserFieldCoverageReportBuilder.#sortedStrings([
                ...group.unsupportedFields
            ])
        const coverage = ParserFieldCoverageReportBuilder.#coverage({
            supported: group.supported,
            observedFields,
            mappedFields,
            missingFields,
            unsupportedFields
        })

        return ParserFieldCoverageReportBuilder.#stripEmpty({
            domain: group.domain,
            family: group.family,
            source: sources[0] || group.source,
            sources: sources.length > 1 ? sources : undefined,
            supported: group.supported,
            count: group.count,
            coverage,
            observedFields,
            mappedFields,
            missingFields,
            unsupportedFields
        })
    }

    /**
     * Builds compact coverage counts for one family.
     * @param {{ supported: boolean, observedFields: string[], mappedFields: object[], missingFields: string[], unsupportedFields: string[] }} options Coverage inputs.
     * @returns {object}
     */
    static #coverage(options) {
        const mappedFieldCount = options.mappedFields.length
        const missingFieldCount = options.missingFields.length
        const unsupportedFieldCount = options.unsupportedFields.length
        const supportedFieldCount = mappedFieldCount + missingFieldCount
        const status = !options.supported
            ? 'unsupported'
            : missingFieldCount === 0
              ? 'complete'
              : 'partial'

        return {
            status,
            observedFieldCount: options.observedFields.length,
            mappedFieldCount,
            missingFieldCount,
            unsupportedFieldCount,
            mappedRatio: options.supported
                ? ParserFieldCoverageReportBuilder.#ratio(
                      mappedFieldCount,
                      supportedFieldCount
                  )
                : null
        }
    }

    /**
     * Builds a matrix view of family coverage.
     * @param {object[]} families Coverage family rows.
     * @returns {object}
     */
    static #matrix(families) {
        return {
            columns: [
                'domain',
                'family',
                'status',
                'observedFieldCount',
                'mappedFieldCount',
                'missingFieldCount',
                'unsupportedFieldCount',
                'mappedRatio'
            ],
            rows: families.map((family) => ({
                domain: family.domain,
                family: family.family,
                status: family.coverage.status,
                observedFieldCount: family.coverage.observedFieldCount,
                mappedFieldCount: family.coverage.mappedFieldCount,
                missingFieldCount: family.coverage.missingFieldCount,
                unsupportedFieldCount: family.coverage.unsupportedFieldCount,
                mappedRatio: family.coverage.mappedRatio
            }))
        }
    }

    /**
     * Resolves the PCB family for one source record.
     * @param {object} record Source record.
     * @returns {string}
     */
    static #pcbFamilyForRecord(record) {
        const stream = String(record?.sourceStream || '').toLowerCase()
        for (const family of Object.keys(PCB_FIELD_MAPS)) {
            if (stream.startsWith(family.toLowerCase())) return family
        }
        return 'unknown'
    }

    /**
     * Reads one case-insensitive field value.
     * @param {object} fields Field map.
     * @param {string} key Field key.
     * @returns {unknown}
     */
    static #fieldValue(fields, key) {
        if (!fields) return undefined
        if (key in fields) return fields[key]
        const normalized = key.toLowerCase()
        const match = Object.keys(fields).find(
            (field) => field.toLowerCase() === normalized
        )
        return match ? fields[match] : undefined
    }

    /**
     * Sums one array field length across family rows.
     * @param {object[]} families Family rows.
     * @param {string} field Field name.
     * @returns {number}
     */
    static #sumFieldCount(families, field) {
        return families.reduce(
            (sum, family) => sum + (family[field] || []).length,
            0
        )
    }

    /**
     * Computes a stable four-decimal ratio.
     * @param {number} numerator Ratio numerator.
     * @param {number} denominator Ratio denominator.
     * @returns {number}
     */
    static #ratio(numerator, denominator) {
        if (!denominator) {
            return 0
        }

        return Math.round((numerator / denominator) * 10000) / 10000
    }

    /**
     * Returns the sort rank for a parser domain.
     * @param {string} domain Parser domain.
     * @returns {number}
     */
    static #domainRank(domain) {
        return domain === 'schematic' ? 0 : 1
    }

    /**
     * Sorts strings deterministically.
     * @param {string[]} values Values to sort.
     * @returns {string[]}
     */
    static #sortedStrings(values) {
        return values
            .filter((value) => value !== '')
            .sort((left, right) => left.localeCompare(right))
    }

    /**
     * Removes empty optional arrays and undefined values.
     * @param {object} row Row to strip.
     * @returns {object}
     */
    static #stripEmpty(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => {
                if (value === undefined) return false
                if (Array.isArray(value) && value.length === 0) return false
                return true
            })
        )
    }
}
