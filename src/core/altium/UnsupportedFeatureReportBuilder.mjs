// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds summaries of preserved parser data that is not modeled yet.
 */
export class UnsupportedFeatureReportBuilder {
    static SCHEMA = 'altium-toolkit.unsupported-features.a1'

    /**
     * Builds an unsupported feature report.
     * @param {{ models?: object[], recordTypes?: object[], rawRecords?: object[], opaqueRecords?: object[], diagnostics?: object[] }} [input] Report input.
     * @returns {object}
     */
    static build(input = {}) {
        const models = UnsupportedFeatureReportBuilder.#models(input)
        const recordTypes =
            UnsupportedFeatureReportBuilder.#unsupportedRecordTypes(
                input,
                models
            )
        const rawRecords = UnsupportedFeatureReportBuilder.#rawRecords(
            input,
            models
        )
        const opaqueRecords = UnsupportedFeatureReportBuilder.#opaqueRecords(
            input,
            models
        )
        const diagnostics = UnsupportedFeatureReportBuilder.#diagnostics(
            input,
            models
        )
        const itemCount =
            recordTypes.length +
            rawRecords.length +
            opaqueRecords.length +
            diagnostics.length

        return {
            schema: UnsupportedFeatureReportBuilder.SCHEMA,
            summary: {
                modelCount: models.length,
                unsupportedRecordTypeCount: recordTypes.length,
                rawRecordCount: rawRecords.length,
                opaqueRecordCount: opaqueRecords.length,
                diagnosticCount: diagnostics.length,
                itemCount,
                status: itemCount ? 'unsupported' : 'supported'
            },
            recordTypes,
            rawRecords,
            opaqueRecords,
            diagnostics
        }
    }

    /**
     * Normalizes model input.
     * @param {object} input Report input.
     * @returns {object[]}
     */
    static #models(input) {
        return Array.isArray(input?.models) ? input.models : []
    }

    /**
     * Collects unsupported record type summaries.
     * @param {object} input Report input.
     * @param {object[]} models Parser roots.
     * @returns {object[]}
     */
    static #unsupportedRecordTypes(input, models) {
        return [
            ...(Array.isArray(input?.recordTypes)
                ? input.recordTypes.map((recordType) => ({
                      row: recordType || {},
                      fileName: recordType?.fileName || '',
                      domain: recordType?.domain || ''
                  }))
                : []),
            ...models.flatMap((model) =>
                UnsupportedFeatureReportBuilder.#modelRecordTypes(model)
            )
        ]
            .filter(({ row }) => row?.supported === false)
            .map(({ row, fileName, domain }) =>
                UnsupportedFeatureReportBuilder.#stripUndefined({
                    fileName,
                    domain,
                    recordType:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            row.recordType
                        ),
                    name: row.name,
                    family: row.family,
                    count: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                        row.count
                    )
                })
            )
    }

    /**
     * Collects record type rows from one parser root.
     * @param {object} model Parser root.
     * @returns {{ row: object, fileName: string, domain: string }[]}
     */
    static #modelRecordTypes(model) {
        const fileName = String(model?.fileName || '')
        return [
            ...UnsupportedFeatureReportBuilder.#domainRows(
                model?.schematic?.recordTypes,
                fileName,
                'schematic'
            ),
            ...UnsupportedFeatureReportBuilder.#domainRows(
                model?.schematicLibrary?.recordTypes,
                fileName,
                'schematic-library'
            )
        ]
    }

    /**
     * Wraps domain rows with file and domain metadata.
     * @param {object[] | undefined} rows Rows.
     * @param {string} fileName Source file name.
     * @param {string} domain Parser domain.
     * @returns {{ row: object, fileName: string, domain: string }[]}
     */
    static #domainRows(rows, fileName, domain) {
        return (Array.isArray(rows) ? rows : []).map((row) => ({
            row,
            fileName,
            domain
        }))
    }

    /**
     * Collects unsupported or unparsed raw record rows.
     * @param {object} input Report input.
     * @param {object[]} models Parser roots.
     * @returns {object[]}
     */
    static #rawRecords(input, models) {
        return [
            ...(Array.isArray(input?.rawRecords)
                ? input.rawRecords.map((record) => ({
                      record: record || {},
                      fileName: record?.fileName || '',
                      domain: record?.domain || 'pcb'
                  }))
                : []),
            ...models.flatMap((model) =>
                UnsupportedFeatureReportBuilder.#modelRawRecords(model)
            )
        ]
            .filter(
                ({ record }) =>
                    record?.supported === false || record?.parsed === false
            )
            .map(({ record, fileName, domain }) =>
                UnsupportedFeatureReportBuilder.#stripUndefined({
                    fileName,
                    domain,
                    sourceStream: record.sourceStream,
                    sourceStorage: record.sourceStorage,
                    recordIndex:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            record.recordIndex
                        ),
                    family: record.family,
                    type: record.type,
                    typeId: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                        record.typeId
                    ),
                    byteLength:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            record.byteLength
                        ),
                    supported: record.supported,
                    parsed: record.parsed
                })
            )
    }

    /**
     * Collects raw records from one parser root.
     * @param {object} model Parser root.
     * @returns {{ record: object, fileName: string, domain: string }[]}
     */
    static #modelRawRecords(model) {
        const fileName = String(model?.fileName || '')
        return [
            ...UnsupportedFeatureReportBuilder.#rawDomainRows(
                model?.pcb?.rawRecords,
                fileName,
                'pcb'
            ),
            ...UnsupportedFeatureReportBuilder.#rawDomainRows(
                (model?.pcbLibrary?.footprints || []).flatMap(
                    (footprint) => footprint.rawRecords || []
                ),
                fileName,
                'pcb-library'
            ),
            ...UnsupportedFeatureReportBuilder.#rawDomainRows(
                model?.schematic?.rawRecords,
                fileName,
                'schematic'
            ),
            ...UnsupportedFeatureReportBuilder.#rawDomainRows(
                (model?.schematicLibrary?.components || []).flatMap(
                    (component) => component.rawRecords || []
                ),
                fileName,
                'schematic-library'
            )
        ]
    }

    /**
     * Wraps raw record rows with source metadata.
     * @param {object[] | undefined} records Raw records.
     * @param {string} fileName Source file name.
     * @param {string} domain Parser domain.
     * @returns {{ record: object, fileName: string, domain: string }[]}
     */
    static #rawDomainRows(records, fileName, domain) {
        return (Array.isArray(records) ? records : []).map((record) => ({
            record,
            fileName,
            domain
        }))
    }

    /**
     * Collects opaque preserved rows.
     * @param {object} input Report input.
     * @param {object[]} models Parser roots.
     * @returns {object[]}
     */
    static #opaqueRecords(input, models) {
        return [
            ...(Array.isArray(input?.opaqueRecords)
                ? input.opaqueRecords.map((record) => ({
                      record: record || {},
                      fileName: record?.fileName || '',
                      domain: record?.domain || 'schematic'
                  }))
                : []),
            ...models.flatMap((model) =>
                UnsupportedFeatureReportBuilder.#modelOpaqueRecords(model)
            )
        ].map(({ record, fileName, domain }) =>
            UnsupportedFeatureReportBuilder.#stripUndefined({
                fileName,
                domain,
                sourceStream: record.sourceStream,
                sourceStorage: record.sourceStorage,
                frameType: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                    record.frameType
                ),
                recordIndex: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                    record.recordIndex
                ),
                byteLength: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                    record.byteLength
                )
            })
        )
    }

    /**
     * Collects opaque rows from one parser root.
     * @param {object} model Parser root.
     * @returns {{ record: object, fileName: string, domain: string }[]}
     */
    static #modelOpaqueRecords(model) {
        const fileName = String(model?.fileName || '')
        return [
            ...UnsupportedFeatureReportBuilder.#rawDomainRows(
                model?.schematic?.opaqueRecords,
                fileName,
                'schematic'
            ),
            ...UnsupportedFeatureReportBuilder.#rawDomainRows(
                (model?.schematicLibrary?.components || []).flatMap(
                    (component) => component.opaqueRecords || []
                ),
                fileName,
                'schematic-library'
            )
        ].map(({ record, ...metadata }) => ({ record, ...metadata }))
    }

    /**
     * Collects unsupported diagnostics.
     * @param {object} input Report input.
     * @param {object[]} models Parser roots.
     * @returns {object[]}
     */
    static #diagnostics(input, models) {
        return [
            ...(Array.isArray(input?.diagnostics)
                ? input.diagnostics.map((diagnostic) => ({
                      diagnostic: diagnostic || {},
                      fileName: diagnostic?.fileName || ''
                  }))
                : []),
            ...models.flatMap((model) =>
                (model?.diagnostics || []).map((diagnostic) => ({
                    diagnostic,
                    fileName: model.fileName || diagnostic.fileName || ''
                }))
            )
        ]
            .filter(({ diagnostic }) =>
                UnsupportedFeatureReportBuilder.#isUnsupportedDiagnostic(
                    diagnostic
                )
            )
            .map(({ diagnostic, fileName }) =>
                UnsupportedFeatureReportBuilder.#stripUndefined({
                    fileName,
                    code: diagnostic.code,
                    severity: diagnostic.severity,
                    message: diagnostic.message,
                    source: diagnostic.source,
                    sourceStream: diagnostic.sourceStream,
                    sourceStorage: diagnostic.sourceStorage,
                    recordIndex:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            diagnostic.recordIndex
                        ),
                    recordType:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            diagnostic.recordType
                        ),
                    errorKind: diagnostic.errorKind
                })
            )
    }

    /**
     * Returns true for unsupported-feature diagnostics.
     * @param {object} diagnostic Diagnostic row.
     * @returns {boolean}
     */
    static #isUnsupportedDiagnostic(diagnostic) {
        if (!diagnostic || typeof diagnostic !== 'object') return false
        if (diagnostic.errorKind === 'unsupported-feature') return true
        return String(diagnostic.code || '')
            .toLowerCase()
            .includes('unsupported')
    }

    /**
     * Returns a finite number or undefined.
     * @param {unknown} value Candidate value.
     * @returns {number | undefined}
     */
    static #finiteOrUndefined(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number : undefined
    }

    /**
     * Removes undefined values from one row.
     * @param {object} row Row to clean.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
