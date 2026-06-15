// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { LibraryQaReportBuilder } from './LibraryQaReportBuilder.mjs'
import { LibraryRenderManifestBuilder } from './LibraryRenderManifestBuilder.mjs'
import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ParserUtils } from './ParserUtils.mjs'
import { SchematicImplementationParser } from './SchematicImplementationParser.mjs'

const { getField, parseBoolean, parseNumericField, stripExtension } =
    ParserUtils

/**
 * Normalizes extracted SchLib stream data into a read-only library model.
 */
export class SchLibModelParser {
    /**
     * Parses one extracted SchLib into a normalized read-only model.
     * @param {string} fileName Source file name.
     * @param {{ libraryRecords?: object[], fileHeaderRecords?: object[], sectionKeys?: object[], symbols?: object[], embeddedFiles?: object, nativeStreams?: object, streamNames?: string[], opaqueRecords?: object[], diagnostics?: object } | null} extraction Extracted streams.
     * @returns {object}
     */
    static parse(fileName, extraction = null) {
        const safeExtraction = extraction || {}
        const embeddedFiles = safeExtraction.embeddedFiles || {
            schema: 'altium-toolkit.embedded-files.a1',
            files: [],
            diagnostics: []
        }
        const symbols = (safeExtraction.symbols || []).map((entry, index) =>
            SchLibModelParser.#symbol(entry, index, embeddedFiles.files || [])
        )
        const schematicLibrary = {
            libraryHeader: SchLibModelParser.#libraryHeader(
                safeExtraction.libraryRecords || [],
                safeExtraction.fileHeaderRecords || []
            ),
            sectionKeys: safeExtraction.sectionKeys || [],
            streamNames: safeExtraction.streamNames || [],
            ...(safeExtraction.nativeStreams
                ? { nativeStreams: safeExtraction.nativeStreams }
                : {}),
            symbols,
            indexes: SchLibModelParser.#indexes(symbols),
            embeddedFiles,
            opaqueRecords: safeExtraction.opaqueRecords || []
        }
        schematicLibrary.renderManifest =
            LibraryRenderManifestBuilder.buildSchematicLibraryManifest(
                schematicLibrary
            )
        const model = NormalizedModelSchema.attach({
            kind: 'schematic-library',
            fileType: 'SchLib',
            fileName,
            summary: SchLibModelParser.#summary(
                fileName,
                symbols,
                schematicLibrary.opaqueRecords,
                safeExtraction.nativeStreams
            ),
            diagnostics: SchLibModelParser.#diagnostics(
                symbols,
                safeExtraction
            ),
            schematicLibrary,
            bom: []
        })
        model.schematicLibrary.qa = LibraryQaReportBuilder.build({
            schematicLibraries: [model]
        })

        return model
    }

    /**
     * Builds one symbol read-model row.
     * @param {object} entry Extracted symbol entry.
     * @param {number} index Symbol index.
     * @param {object[]} embeddedFiles Embedded file inventory rows.
     * @returns {object}
     */
    static #symbol(entry, index, embeddedFiles) {
        const records = Array.isArray(entry.records) ? entry.records : []
        const implementationRows =
            SchLibModelParser.#implementationRows(records)
        const componentRecord =
            records.find((record) =>
                ['component', 'symbol', '1'].includes(
                    SchLibModelParser.#recordType(record).toLowerCase()
                )
            ) || records[0]
        const sourceStorage = String(entry.sourceStorage || '')
        const name =
            getField(componentRecord?.fields, 'Name') ||
            getField(componentRecord?.fields, 'LibReference') ||
            getField(componentRecord?.fields, 'DesignItemId') ||
            SchLibModelParser.#basename(sourceStorage) ||
            'Symbol' + (index + 1)
        const pins = records
            .filter((record) =>
                ['pin', '2'].includes(
                    SchLibModelParser.#recordType(record).toLowerCase()
                )
            )
            .map((record, pinIndex) =>
                SchLibModelParser.#pin(record, pinIndex, entry.pinSidecars)
            )
        const parameters = SchLibModelParser.#parameters(records)
        const implementations = records
            .filter((record) =>
                ['implementation', '45'].includes(
                    SchLibModelParser.#recordType(record).toLowerCase()
                )
            )
            .map((record) =>
                SchLibModelParser.#implementation(record, implementationRows)
            )
        const primitives = records
            .filter((record) => !SchLibModelParser.#isSemanticRecord(record))
            .map((record) => SchLibModelParser.#primitive(record))
        const parts = SchLibModelParser.#parts(pins, primitives)
        const symbolEmbeddedAssets = [
            ...(entry.embeddedAssets || []),
            ...embeddedFiles.filter((file) =>
                String(file.sourceStream || '').startsWith(sourceStorage + '/')
            )
        ]

        return SchLibModelParser.#stripUndefined({
            name,
            displayName: getField(componentRecord?.fields, 'DisplayName'),
            sourceId: getField(componentRecord?.fields, 'SourceId'),
            sourceStorage,
            sourceStream: entry.sourceStream,
            declaredPinCount: SchLibModelParser.#optionalNumber(
                getField(componentRecord?.fields, 'PinCount')
            ),
            declaredPrimitiveCount: SchLibModelParser.#optionalNumber(
                getField(componentRecord?.fields, 'PrimitiveCount')
            ),
            pins,
            parts,
            parameters,
            implementations,
            primitives,
            embeddedAssets: symbolEmbeddedAssets,
            opaqueRecords: entry.opaqueRecords || []
        })
    }

    /**
     * Builds one pin row.
     * @param {object} record Pin source record.
     * @param {number} pinIndex Zero-based pin index.
     * @param {Record<string, object[]>} pinSidecars Parsed pin side streams.
     * @returns {object}
     */
    static #pin(record, pinIndex, pinSidecars = {}) {
        const fracFields = SchLibModelParser.#sidecarFields(
            pinSidecars,
            'PinFrac',
            pinIndex
        )
        const descFields = SchLibModelParser.#sidecarFields(
            pinSidecars,
            'PinDesc',
            pinIndex
        )
        const textFields = SchLibModelParser.#sidecarFields(
            pinSidecars,
            'PinTextData',
            pinIndex
        )
        const packageFields = SchLibModelParser.#sidecarFields(
            pinSidecars,
            'PinPackageLength',
            pinIndex
        )
        const functionFields = SchLibModelParser.#sidecarFields(
            pinSidecars,
            'PinFunctionData',
            pinIndex
        )
        const symbolLineFields = SchLibModelParser.#sidecarFields(
            pinSidecars,
            'PinSymbolLineWidth',
            pinIndex
        )
        const textStyle = SchLibModelParser.#pinTextStyle(textFields)

        return SchLibModelParser.#stripUndefined({
            designator:
                getField(record.fields, 'Designator') ||
                getField(record.fields, 'PinNumber'),
            name: getField(record.fields, 'Name'),
            partId: SchLibModelParser.#partId(record.fields),
            electricalType: SchLibModelParser.#lowerField(
                record.fields,
                'ElectricalType'
            ),
            formalType: SchLibModelParser.#lowerField(
                record.fields,
                'FormalType'
            ),
            description:
                SchLibModelParser.#firstField(descFields, [
                    'Description',
                    'PinDescription',
                    'Text'
                ]) || getField(record.fields, 'Description'),
            pinFunction: SchLibModelParser.#firstField(functionFields, [
                'PinFunction',
                'Function',
                'Text'
            ]),
            x:
                SchLibModelParser.#optionalNumber(
                    SchLibModelParser.#firstField(fracFields, [
                        'Location.X',
                        'X'
                    ])
                ) ?? parseNumericField(record.fields, 'Location.X'),
            y:
                SchLibModelParser.#optionalNumber(
                    SchLibModelParser.#firstField(fracFields, [
                        'Location.Y',
                        'Y'
                    ])
                ) ?? parseNumericField(record.fields, 'Location.Y'),
            length:
                SchLibModelParser.#optionalNumber(
                    SchLibModelParser.#firstField(fracFields, [
                        'PinLength',
                        'Length'
                    ])
                ) ??
                parseNumericField(record.fields, 'PinLength') ??
                parseNumericField(record.fields, 'Length'),
            pinPackageLength:
                SchLibModelParser.#optionalNumber(
                    SchLibModelParser.#firstField(packageFields, [
                        'PinPackageLength',
                        'PackageLength',
                        'Length'
                    ])
                ) ??
                parseNumericField(record.fields, 'PinPackageLength') ??
                parseNumericField(record.fields, 'PackageLength'),
            symbolInner: SchLibModelParser.#lowerFirstField(record.fields, [
                'Symbol_Inner',
                'SymbolInner',
                'SymbolInnerEdge'
            ]),
            symbolOuter: SchLibModelParser.#lowerFirstField(record.fields, [
                'Symbol_Outer',
                'SymbolOuter',
                'SymbolOuterEdge'
            ]),
            symbolInside: SchLibModelParser.#lowerFirstField(record.fields, [
                'Symbol_Inside',
                'SymbolInside'
            ]),
            symbolOutside: SchLibModelParser.#lowerFirstField(record.fields, [
                'Symbol_Outside',
                'SymbolOutside'
            ]),
            symbolLineWidth:
                SchLibModelParser.#optionalNumber(
                    SchLibModelParser.#firstField(symbolLineFields, [
                        'SymbolLineWidth',
                        'LineWidth',
                        'Width'
                    ])
                ) ?? parseNumericField(record.fields, 'SymbolLineWidth'),
            swapIdPart: parseNumericField(record.fields, 'SwapIdPart'),
            swapIdPair: parseNumericField(record.fields, 'SwapIdPair'),
            swapIdPartPin: parseNumericField(record.fields, 'SwapIdPartPin'),
            swapIdPin: parseNumericField(record.fields, 'SwapIdPin'),
            defaultValue: getField(record.fields, 'DefaultValue'),
            hidden: SchLibModelParser.#optionalBoolean(record.fields, [
                'IsHidden',
                'Hidden'
            ]),
            ...(Object.keys(textStyle).length ? { textStyle } : {})
        })
    }

    /**
     * Builds one implementation row.
     * @param {object} record Implementation source record.
     * @param {Map<number, object>} implementationRows Parsed implementation rows.
     * @returns {object}
     */
    static #implementation(record, implementationRows) {
        const implementationRow = implementationRows.get(record.recordIndex)
        const detailedTargetLibraries = (
            implementationRow?.targetLibraries || []
        )
            .map((target) => target.fileName || target.entity)
            .filter(Boolean)
        const targetLibraries = [
            ...new Set([
                ...SchLibModelParser.#targetLibraries(record.fields),
                ...detailedTargetLibraries
            ])
        ]

        return SchLibModelParser.#stripUndefined({
            modelName: getField(record.fields, 'ModelName'),
            modelType: SchLibModelParser.#lowerField(
                record.fields,
                'ModelType'
            ),
            targetLibraries,
            searchPaths: implementationRow?.searchPaths,
            mapDefiners: implementationRow?.mapDefiners,
            parameters: implementationRow?.parameters
        })
    }

    /**
     * Builds one primitive summary row.
     * @param {object} record Primitive source record.
     * @returns {object}
     */
    static #primitive(record) {
        return SchLibModelParser.#stripUndefined({
            recordType: SchLibModelParser.#recordType(record),
            recordIndex: record.recordIndex,
            partId: SchLibModelParser.#partId(record.fields)
        })
    }

    /**
     * Builds symbol parameters from parameter records.
     * @param {object[]} records Source records.
     * @returns {Record<string, string>}
     */
    static #parameters(records) {
        const parameters = {}

        for (const record of records) {
            if (
                !['parameter', '41'].includes(
                    SchLibModelParser.#recordType(record).toLowerCase()
                )
            ) {
                continue
            }

            const name = getField(record.fields, 'Name')
            const value =
                getField(record.fields, 'Text') ||
                getField(record.fields, 'Value')
            if (name) {
                parameters[name] = value
            }
        }

        return parameters
    }

    /**
     * Builds part summaries from pins and primitive rows.
     * @param {object[]} pins Pin rows.
     * @param {object[]} primitives Primitive rows.
     * @returns {object[]}
     */
    static #parts(pins, primitives) {
        const partIds = [
            ...new Set(
                [...pins, ...primitives]
                    .map((row) => String(row.partId || '').trim())
                    .filter(Boolean)
            )
        ].sort((left, right) => left.localeCompare(right))

        return partIds.map((partId) => ({
            partId,
            pinCount: pins.filter((pin) => pin.partId === partId).length,
            primitiveCount: primitives.filter(
                (primitive) => primitive.partId === partId
            ).length
        }))
    }

    /**
     * Builds library indexes.
     * @param {object[]} symbols Symbol rows.
     * @returns {object}
     */
    static #indexes(symbols) {
        return {
            symbolsByName: Object.fromEntries(
                symbols.map((symbol, index) => [
                    symbol.name,
                    {
                        index,
                        name: symbol.name,
                        sourceStorage: symbol.sourceStorage,
                        pinCount: symbol.pins.length,
                        partCount: symbol.parts.length,
                        keywordCount: SchLibModelParser.#keywords(symbol).length
                    }
                ])
            )
        }
    }

    /**
     * Builds a library header from Library/Data records.
     * @param {object[]} records Library records.
     * @param {object[]} fileHeaderRecords FileHeader records.
     * @returns {Record<string, string>}
     */
    static #libraryHeader(records, fileHeaderRecords) {
        const headerRecord = records.find((record) =>
            getField(record.fields, 'HEADER')
        )
        const header = headerRecord
            ? {
                  header: getField(headerRecord.fields, 'HEADER')
              }
            : {}
        const fileHeader = SchLibModelParser.#fileHeader(fileHeaderRecords)

        return SchLibModelParser.#stripUndefined({
            ...header,
            ...(fileHeader ? { fileHeader } : {})
        })
    }

    /**
     * Builds the parser summary.
     * @param {string} fileName Source file name.
     * @param {object[]} symbols Symbol rows.
     * @param {object[]} opaqueRecords Opaque records.
     * @param {object | undefined} nativeStreams Native stream inventory.
     * @returns {object}
     */
    static #summary(fileName, symbols, opaqueRecords, nativeStreams) {
        return {
            title: stripExtension(fileName),
            symbolCount: symbols.length,
            pinCount: symbols.reduce(
                (count, symbol) => count + symbol.pins.length,
                0
            ),
            partCount: symbols.reduce(
                (count, symbol) => count + symbol.parts.length,
                0
            ),
            embeddedAssetCount: symbols.reduce(
                (count, symbol) => count + (symbol.embeddedAssets || []).length,
                0
            ),
            ...(nativeStreams?.summary?.streamCount
                ? {
                      nativeStreamCount: nativeStreams.summary.streamCount
                  }
                : {}),
            opaqueRecordCount: opaqueRecords.length
        }
    }

    /**
     * Builds parser diagnostics.
     * @param {object[]} symbols Symbol rows.
     * @param {object} extraction Extraction metadata.
     * @returns {object[]}
     */
    static #diagnostics(symbols, extraction) {
        const diagnostics = [
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    symbols.length +
                    ' schematic library symbol definitions.'
            }
        ]

        if (Array.isArray(extraction.streamNames)) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    extraction.streamNames.length +
                    ' SchLib data streams from the compound document.'
            })
        }

        return diagnostics
    }

    /**
     * Returns true when the record has a dedicated semantic model row.
     * @param {object} record Source record.
     * @returns {boolean}
     */
    static #isSemanticRecord(record) {
        return [
            'component',
            'symbol',
            '1',
            'pin',
            '2',
            'parameter',
            '41',
            'implementation',
            '45'
        ].includes(SchLibModelParser.#recordType(record).toLowerCase())
    }

    /**
     * Resolves one record type string.
     * @param {object} record Source record.
     * @returns {string}
     */
    static #recordType(record) {
        return getField(record?.fields, 'RECORD') || 'unknown'
    }

    /**
     * Resolves one part id from common source fields.
     * @param {object} fields Source fields.
     * @returns {string | undefined}
     */
    static #partId(fields) {
        return (
            getField(fields, 'PartId') ||
            getField(fields, 'OwnerPartId') ||
            getField(fields, 'OwnerPartID') ||
            undefined
        )
    }

    /**
     * Resolves target library names from implementation fields.
     * @param {object} fields Source fields.
     * @returns {string[]}
     */
    static #targetLibraries(fields) {
        const directTargets = (
            getField(fields, 'TargetLibraries') ||
            getField(fields, 'TargetLibrary') ||
            ''
        )
            .split(/[;,]/u)
            .map((value) => value.trim())
            .filter(Boolean)
        const indexedTargets = []
        const count =
            parseNumericField(fields, 'DatafileCount') ??
            SchLibModelParser.#countIndexedFields(fields, 'ModelDatafileEntity')

        for (let index = 0; index < count; index += 1) {
            const entity = getField(fields, 'ModelDatafileEntity' + index)
            const kind = getField(fields, 'ModelDatafileKind' + index)
            const fileName = SchLibModelParser.#libraryFileName(entity, kind)
            if (fileName) {
                indexedTargets.push(fileName)
            }
        }

        return [...new Set([...directTargets, ...indexedTargets])]
    }

    /**
     * Builds parsed implementation rows keyed by source record index.
     * @param {object[]} records Symbol records.
     * @returns {Map<number, object>}
     */
    static #implementationRows(records) {
        const parsed = SchematicImplementationParser.parse(records)

        return new Map(
            (parsed?.implementations || []).map((implementation) => [
                Number(
                    String(implementation.recordKey || '').replace(
                        /^schematic-record-/u,
                        ''
                    )
                ),
                implementation
            ])
        )
    }

    /**
     * Builds one file-header summary.
     * @param {object[]} records FileHeader records.
     * @returns {object | null}
     */
    static #fileHeader(records) {
        const record = (records || []).find((entry) =>
            getField(entry.fields, 'HEADER')
        )
        if (!record) {
            return null
        }

        const fonts = SchLibModelParser.#fonts(record.fields)

        return SchLibModelParser.#stripUndefined({
            header: getField(record.fields, 'HEADER'),
            fonts: fonts.length ? fonts : undefined
        })
    }

    /**
     * Parses indexed font entries from FileHeader fields.
     * @param {object} fields FileHeader fields.
     * @returns {object[]}
     */
    static #fonts(fields) {
        return Object.keys(fields || {})
            .map((key) => /^FontName(\d+)$/iu.exec(key))
            .filter(Boolean)
            .map((match) => {
                const index = Number.parseInt(match[1], 10)
                return SchLibModelParser.#stripUndefined({
                    index,
                    name: getField(fields, 'FontName' + index),
                    size: SchLibModelParser.#optionalNumber(
                        getField(fields, 'FontSize' + index)
                    ),
                    id: SchLibModelParser.#optionalNumber(
                        getField(fields, 'FontId' + index)
                    )
                })
            })
            .sort((left, right) => left.index - right.index)
    }

    /**
     * Returns the sidecar fields for one pin index.
     * @param {Record<string, object[]>} pinSidecars Parsed sidecar records.
     * @param {string} sidecarName Sidecar stream basename.
     * @param {number} pinIndex Zero-based pin index.
     * @returns {object}
     */
    static #sidecarFields(pinSidecars, sidecarName, pinIndex) {
        const records = pinSidecars?.[sidecarName] || []

        return (
            records.find((record, recordIndex) => {
                const explicitIndex =
                    parseNumericField(record.fields, 'PinIndex') ??
                    parseNumericField(record.fields, 'Index') ??
                    parseNumericField(record.fields, 'RecordIndex')

                return explicitIndex === null
                    ? recordIndex === pinIndex
                    : explicitIndex === pinIndex
            })?.fields || {}
        )
    }

    /**
     * Builds text-style metadata from PinTextData fields.
     * @param {object} fields Pin text fields.
     * @returns {object}
     */
    static #pinTextStyle(fields) {
        return SchLibModelParser.#stripUndefined({
            nameFontId: parseNumericField(fields, 'NameFontId'),
            designatorFontId: parseNumericField(fields, 'DesignatorFontId'),
            namePosition: SchLibModelParser.#lowerField(fields, 'NamePosition'),
            designatorPosition: SchLibModelParser.#lowerField(
                fields,
                'DesignatorPosition'
            )
        })
    }

    /**
     * Returns the first non-empty field from a field set.
     * @param {object} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {string}
     */
    static #firstField(fields, keys) {
        for (const key of keys || []) {
            const value = getField(fields, key)
            if (value) {
                return value
            }
        }

        return ''
    }

    /**
     * Reads and lower-cases the first available field.
     * @param {object} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {string | undefined}
     */
    static #lowerFirstField(fields, keys) {
        const value = SchLibModelParser.#firstField(fields, keys)

        return value ? value.toLowerCase() : undefined
    }

    /**
     * Reads an optional boolean field.
     * @param {object} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {boolean | undefined}
     */
    static #optionalBoolean(fields, keys) {
        for (const key of keys || []) {
            const value = getField(fields, key)
            if (value) {
                return parseBoolean(value)
            }
        }

        return undefined
    }

    /**
     * Counts fields with an indexed prefix.
     * @param {object} fields Source fields.
     * @param {string} prefix Indexed field prefix.
     * @returns {number}
     */
    static #countIndexedFields(fields, prefix) {
        const normalizedPrefix = prefix.toLowerCase()

        return Object.keys(fields || {}).filter((key) =>
            key.toLowerCase().startsWith(normalizedPrefix)
        ).length
    }

    /**
     * Infers a native library file name from entity and kind fields.
     * @param {string} entity Library entity.
     * @param {string} kind Library kind.
     * @returns {string}
     */
    static #libraryFileName(entity, kind) {
        if (!entity) {
            return ''
        }

        if (/\.[^.]+$/u.test(entity)) {
            return entity
        }

        const extension =
            {
                pcblib: 'PcbLib',
                schlib: 'SchLib',
                intlib: 'IntLib',
                sim: 'SimModel'
            }[
                String(kind || '')
                    .trim()
                    .toLowerCase()
            ] || kind

        return extension ? entity + '.' + extension : entity
    }

    /**
     * Builds symbol search keywords.
     * @param {object} symbol Symbol row.
     * @returns {string[]}
     */
    static #keywords(symbol) {
        return [
            symbol.name,
            symbol.displayName,
            symbol.sourceId,
            ...Object.values(symbol.parameters || {})
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    }

    /**
     * Reads a lower-case field value.
     * @param {object} fields Source fields.
     * @param {string} key Field key.
     * @returns {string | undefined}
     */
    static #lowerField(fields, key) {
        const value = getField(fields, key)
        return value ? value.toLowerCase() : undefined
    }

    /**
     * Normalizes an optional numeric value.
     * @param {unknown} value Source value.
     * @returns {number | undefined}
     */
    static #optionalNumber(value) {
        if (value === undefined || value === null) {
            return undefined
        }
        if (String(value).trim() === '') {
            return undefined
        }

        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    /**
     * Resolves the final path component.
     * @param {string} value Path.
     * @returns {string}
     */
    static #basename(value) {
        return (
            String(value || '')
                .split('/')
                .filter(Boolean)
                .pop() || ''
        )
    }

    /**
     * Removes undefined values from an object.
     * @param {object} row Row to strip.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(
                ([, value]) =>
                    value !== undefined && value !== null && value !== ''
            )
        )
    }
}
