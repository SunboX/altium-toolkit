// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'
import { SchematicRecordTypeRegistry } from './SchematicRecordTypeRegistry.mjs'

/**
 * Builds deterministic schematic parser field-coverage reports.
 */
export class SchematicFieldCoverageReportBuilder {
    static SCHEMA_ID = 'altium-toolkit.schematic.field-coverage.a1'

    static #COMMON_FIELDS = new Set([
        'Alignment',
        'AreaColor',
        'Color',
        'Corner.X',
        'Corner.Y',
        'GraphicallyLocked',
        'HEADER',
        'IndexInSheet',
        'IsHidden',
        'IsMirrored',
        'IsNotAccesible',
        'IsNotAccessible',
        'LineStyle',
        'LineWidth',
        'Location.X',
        'Location.Y',
        'Name',
        'Orientation',
        'OwnerIndex',
        'OwnerPartDisplayMode',
        'OwnerPartID',
        'OwnerPartId',
        'RECORD',
        'ReadOnlyState',
        'Text',
        'TextColor',
        'UniqueID',
        'UniqueId'
    ])

    static #COMMON_FIELD_KEYS =
        SchematicFieldCoverageReportBuilder.#normalizedFieldSet(
            SchematicFieldCoverageReportBuilder.#COMMON_FIELDS
        )

    static #TEXT_FIELDS = new Set([
        'ClipToRect',
        'FontID',
        'IsSolid',
        'Justification',
        'NotAutoposition',
        'ShowBorder',
        'ShowName',
        'TextMargin',
        'WordWrap'
    ])

    static #FIELDS_BY_RECORD_TYPE = new Map([
        [
            '1',
            new Set([
                'AreaColor',
                'ComponentDescription',
                'ComponentKind',
                'CurrentPartId',
                'DesignItemId',
                'DesignatorLocked',
                'DisplayMode',
                'DisplayModeCount',
                'LibReference',
                'PartCount',
                'PartIdLocked',
                'PinsMoveable',
                'SourceLibraryName'
            ])
        ],
        [
            '2',
            new Set([
                'Description',
                'Designator',
                'Electrical',
                'FormalType',
                'Name',
                'PinConglomerate',
                'PinLength',
                'PinName_CustomPositionMargin',
                'PinName_PositionMode',
                'PinPackageLength',
                'ShowDesignator',
                'ShowName',
                'SwapIdPart',
                'SwapIdPin',
                'Symbol_Inner',
                'Symbol_Outer',
                'SymBol_Inner',
                'SymBol_Outer'
            ])
        ],
        ['4', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        ['5', new Set(['LocationCount', 'ShowMarker', 'StartLineShape'])],
        [
            '6',
            new Set([
                'EndLineShape',
                'EndLineShapeSize',
                'LocationCount',
                'StartLineShape',
                'StartLineShapeSize'
            ])
        ],
        [
            '7',
            new Set([
                'EndLineShape',
                'EndLineShapeSize',
                'IsSolid',
                'LocationCount',
                'StartLineShape',
                'StartLineShapeSize',
                'Transparent'
            ])
        ],
        ['8', new Set(['IsSolid', 'Radius', 'SecondaryRadius', 'Transparent'])],
        [
            '9',
            new Set([
                'EndAngle',
                'IsSolid',
                'Radius',
                'SecondaryRadius',
                'StartAngle',
                'Transparent'
            ])
        ],
        [
            '10',
            new Set([
                'CornerXRadius',
                'CornerYRadius',
                'IsSolid',
                'Transparent'
            ])
        ],
        [
            '11',
            new Set(['EndAngle', 'Radius', 'SecondaryRadius', 'StartAngle'])
        ],
        ['12', new Set(['EndAngle', 'Radius', 'StartAngle'])],
        ['14', new Set(['IsSolid', 'Transparent'])],
        ['15', new Set(['AreaColor', 'Style', 'UniqueId', 'XSize', 'YSize'])],
        [
            '16',
            new Set([
                'DistanceFromTop',
                'DistanceFromTop_Frac',
                'DistanceFromTop_Frac1',
                'IOType',
                'Side',
                'Style'
            ])
        ],
        ['17', new Set(['FontID', 'ShowNetName', 'Style'])],
        [
            '18',
            new Set(['Alignment', 'AreaColor', 'FontID', 'IOType', 'Style'])
        ],
        ['22', new Set(['Symbol'])],
        ['25', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        ['26', new Set(['LocationCount'])],
        ['27', new Set(['LocationCount'])],
        [
            '28',
            new Set([
                ...SchematicFieldCoverageReportBuilder.#TEXT_FIELDS,
                'AreaColor'
            ])
        ],
        ['29', new Set([])],
        [
            '30',
            new Set([
                'EmbedImage',
                'FileName',
                'ImageIndex',
                'KeepAspect',
                'Storage'
            ])
        ],
        [
            '31',
            new Set([
                'BorderOn',
                'CustomMarginWidth',
                'CustomX',
                'CustomXZones',
                'CustomY',
                'CustomYZones',
                'FontIdCount',
                'SheetStyle',
                'ShowTemplateGraphics',
                'SnapGridSize',
                'TemplateFileName',
                'TemplateItemGUID',
                'TemplateRevisionGUID',
                'TemplateRevisionHRID',
                'TemplateVaultGUID',
                'TemplateVaultHRID',
                'TitleBlockOn',
                'VisibleGridSize',
                'WorkspaceOrientation'
            ])
        ],
        ['34', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        ['37', new Set([])],
        ['39', new Set(['TemplateFileName', 'UniqueID', 'UniqueId'])],
        [
            '41',
            new Set([
                ...SchematicFieldCoverageReportBuilder.#TEXT_FIELDS,
                'DataType',
                'ParameterName'
            ])
        ],
        ['43', new Set(['FontID', 'Justification', 'ShowName', 'Symbol'])],
        ['44', new Set([])],
        [
            '45',
            new Set([
                'DatafileCount',
                'Description',
                'IsCurrent',
                'ModelName',
                'ModelType',
                'SearchPathCount'
            ])
        ],
        ['46', new Set([])],
        ['47', new Set(['DesImpCount', 'DesIntf'])],
        ['48', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        [
            '209',
            new Set([
                ...SchematicFieldCoverageReportBuilder.#TEXT_FIELDS,
                'AreaColor'
            ])
        ],
        ['210', new Set([])],
        ['211', new Set(['IsSolid'])],
        ['215', new Set(['AreaColor', 'UniqueId', 'XSize', 'YSize'])],
        [
            '216',
            new Set([
                'DistanceFromTop',
                'DistanceFromTop_Frac',
                'DistanceFromTop_Frac1',
                'IOType',
                'Side',
                'Style'
            ])
        ],
        ['217', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        ['218', new Set(['LocationCount'])],
        [
            '220',
            new Set([
                'ExportedRoutineCount',
                'ExternalMemoryCount',
                'InternalMemoryAddressWidth',
                'InternalMemoryCount',
                'InternalMemoryDataWidth',
                'InternalMemoryInterface',
                'InternalMemorySize',
                'IsSolid',
                'SymbolType',
                'XSize',
                'YSize'
            ])
        ],
        [
            '221',
            new Set([
                'DataIdentifier',
                'DataType',
                'DataWidth',
                'DistanceFromTop',
                'DistanceFromTop_Frac',
                'DistanceFromTop_Frac1',
                'EntryType',
                'IOType',
                'OwnerIndexAdditionalList',
                'ParentRoutine',
                'Side',
                'Style',
                'TextFontID'
            ])
        ],
        ['222', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        ['223', SchematicFieldCoverageReportBuilder.#TEXT_FIELDS],
        ['225', new Set(['IsSolid', 'LocationCount', 'Transparent'])],
        [
            '226',
            new Set([
                ...SchematicFieldCoverageReportBuilder.#TEXT_FIELDS,
                'AreaColor',
                'URL'
            ])
        ]
    ])

    static #FIELDS_BY_RECORD_TYPE_KEYS =
        SchematicFieldCoverageReportBuilder.#normalizedFieldsByRecordType(
            SchematicFieldCoverageReportBuilder.#FIELDS_BY_RECORD_TYPE
        )

    static #KNOWN_PATTERNS = [
        /^UTF8:/iu,
        /^[XY]\d+$/iu,
        /^(?:Size|FontName|Bold|Italic|Rotation)\d+$/iu,
        /^(?:ModelDatafileEntity|ModelDatafileKind|SearchPath|DesImp)\d+$/iu,
        /^(?:RoutineName|InterfaceMode|DataWidth|AddressWidth|Scope|Mau|NoWait|IsLinked)\d+$/iu,
        /^ExternalMemory_(?:Name|Interface|DataWidth|AddressWidth|Scope|Mau|IsReserved)\d+$/iu,
        /^DistanceFromTop_Frac\d+$/iu
    ]

    /**
     * Builds a read-only field-coverage report grouped by native record type.
     * @param {{ fields?: Record<string, string | string[]>, recordIndex?: number }[]} records Parsed schematic records.
     * @returns {{ schema: string, summary: object, recordTypes: object[] }}
     */
    static build(records) {
        const rowsByRecordType =
            SchematicFieldCoverageReportBuilder.#collectRowsByRecordType(
                records
            )
        const recordTypes = [...rowsByRecordType.values()]
            .filter((row) => row.unrecognizedFields.length)
            .sort(
                (left, right) =>
                    left.recordType - right.recordType ||
                    left.name.localeCompare(right.name)
            )
        const unrecognizedFieldCount = recordTypes.reduce(
            (total, row) => total + row.unrecognizedFields.length,
            0
        )
        const unrecognizedOccurrenceCount = recordTypes.reduce(
            (total, row) =>
                total +
                row.unrecognizedFields.reduce(
                    (fieldTotal, field) => fieldTotal + field.count,
                    0
                ),
            0
        )

        return {
            schema: SchematicFieldCoverageReportBuilder.SCHEMA_ID,
            summary: {
                recordTypeCount: recordTypes.length,
                unrecognizedFieldCount,
                unrecognizedOccurrenceCount
            },
            recordTypes
        }
    }

    /**
     * Collects per-record-type coverage rows.
     * @param {{ fields?: Record<string, string | string[]>, recordIndex?: number }[]} records Parsed schematic records.
     * @returns {Map<number, object>}
     */
    static #collectRowsByRecordType(records) {
        const rows = new Map()

        for (const record of records || []) {
            const recordType = ParserUtils.getField(record.fields, 'RECORD')
            const descriptor = SchematicRecordTypeRegistry.get(recordType)
            if (
                !Number.isInteger(descriptor.recordType) ||
                descriptor.recordType < 0
            ) {
                continue
            }

            if (!rows.has(descriptor.recordType)) {
                rows.set(
                    descriptor.recordType,
                    SchematicFieldCoverageReportBuilder.#emptyRow(descriptor)
                )
            }

            const row = rows.get(descriptor.recordType)
            row.recordCount += 1
            SchematicFieldCoverageReportBuilder.#collectUnrecognizedFields(
                row,
                record,
                String(descriptor.recordType)
            )
        }

        for (const row of rows.values()) {
            row.unrecognizedFields = [...row.unrecognizedFields.values()]
                .map((field) => ({
                    ...field,
                    recordKeys: [...field.recordKeys].sort()
                }))
                .sort((left, right) => left.name.localeCompare(right.name))
        }

        return rows
    }

    /**
     * Builds an empty coverage row for one record descriptor.
     * @param {{ recordType: number, name: string, family: string, supported: boolean }} descriptor Record descriptor.
     * @returns {object}
     */
    static #emptyRow(descriptor) {
        return {
            recordType: descriptor.recordType,
            name: descriptor.name,
            family: descriptor.family,
            supported: descriptor.supported,
            recordCount: 0,
            unrecognizedFields: new Map()
        }
    }

    /**
     * Adds unrecognized fields from one record to its coverage row.
     * @param {{ unrecognizedFields: Map<string, object> }} row Coverage row.
     * @param {{ fields?: Record<string, string | string[]>, recordIndex?: number }} record Parsed record.
     * @param {string} recordType Native record type.
     * @returns {void}
     */
    static #collectUnrecognizedFields(row, record, recordType) {
        for (const key of Object.keys(record?.fields || {})) {
            if (
                SchematicFieldCoverageReportBuilder.#isKnownField(
                    recordType,
                    key
                )
            ) {
                continue
            }

            if (!row.unrecognizedFields.has(key)) {
                row.unrecognizedFields.set(key, {
                    name: key,
                    count: 0,
                    recordKeys: new Set()
                })
            }

            const field = row.unrecognizedFields.get(key)
            field.count += 1
            field.recordKeys.add(
                SchematicFieldCoverageReportBuilder.#recordKey(record)
            )
        }
    }

    /**
     * Returns true when a field is known for one record type.
     * @param {string} recordType Native record type.
     * @param {string} key Native field name.
     * @returns {boolean}
     */
    static #isKnownField(recordType, key) {
        const normalizedKey =
            SchematicFieldCoverageReportBuilder.#normalizeFieldKey(key)

        if (
            SchematicFieldCoverageReportBuilder.#COMMON_FIELD_KEYS.has(
                normalizedKey
            )
        ) {
            return true
        }

        if (
            SchematicFieldCoverageReportBuilder.#KNOWN_PATTERNS.some(
                (pattern) => pattern.test(key)
            )
        ) {
            return true
        }

        return Boolean(
            SchematicFieldCoverageReportBuilder.#FIELDS_BY_RECORD_TYPE_KEYS
                .get(recordType)
                ?.has(normalizedKey)
        )
    }

    /**
     * Builds a case-normalized set of known field keys.
     * @param {Set<string>} fields Known fields.
     * @returns {Set<string>}
     */
    static #normalizedFieldSet(fields) {
        return new Set(
            [...(fields || [])].map((field) =>
                SchematicFieldCoverageReportBuilder.#normalizeFieldKey(field)
            )
        )
    }

    /**
     * Builds case-normalized known-field sets by record type.
     * @param {Map<string, Set<string>>} fieldsByRecordType Known fields.
     * @returns {Map<string, Set<string>>}
     */
    static #normalizedFieldsByRecordType(fieldsByRecordType) {
        return new Map(
            [...(fieldsByRecordType || new Map()).entries()].map(
                ([recordType, fields]) => [
                    recordType,
                    SchematicFieldCoverageReportBuilder.#normalizedFieldSet(
                        fields
                    )
                ]
            )
        )
    }

    /**
     * Normalizes a native schematic field key for catalog comparisons.
     * @param {string} key Native field key.
     * @returns {string}
     */
    static #normalizeFieldKey(key) {
        return String(key || '').toLocaleLowerCase('en-US')
    }

    /**
     * Builds a stable schematic record key.
     * @param {{ recordIndex?: number }} record Schematic record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }
}
