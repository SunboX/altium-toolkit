// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds compact reports for preserved raw and unknown parser data.
 */
export class RawDataPreservationReportBuilder {
    static SCHEMA = 'altium-toolkit.raw-data-preservation.a1'

    /**
     * Builds a raw-data preservation report.
     * @param {{ models?: object[], rawRecords?: object[], unknownRecords?: object[], opaqueRecords?: object[], nativeStreams?: object[] }} [input]
     * @returns {object}
     */
    static build(input = {}) {
        const rawRecords = RawDataPreservationReportBuilder.#rawRecords(input)
        const unknownRecords =
            RawDataPreservationReportBuilder.#unknownRecords(input)
        const opaqueRecords =
            RawDataPreservationReportBuilder.#opaqueRecords(input)
        const nativeStreams =
            RawDataPreservationReportBuilder.#nativeStreams(input)
        const records = rawRecords.map((record) =>
            RawDataPreservationReportBuilder.#recordRow(record)
        )
        const unknownRows = unknownRecords.map((record) =>
            RawDataPreservationReportBuilder.#unknownRecordRow(record)
        )
        const opaqueRows = opaqueRecords.map((record) =>
            RawDataPreservationReportBuilder.#opaqueRecordRow(record)
        )
        const nativeStreamRows = nativeStreams.map((stream) =>
            RawDataPreservationReportBuilder.#nativeStreamRow(stream)
        )
        const preservedByteCount = [
            ...records,
            ...unknownRows,
            ...opaqueRows
        ].reduce((sum, record) => sum + Number(record.byteLength || 0), 0)
        const nativeStreamSummary = nativeStreamRows.length
            ? {
                  nativeStreamCount: nativeStreamRows.length,
                  unknownNativeStreamCount: nativeStreamRows.filter(
                      (stream) => !stream.known
                  ).length,
                  unconsumedNativeStreamCount: nativeStreamRows.filter(
                      (stream) => !stream.consumed
                  ).length,
                  nativeStreamByteCount: nativeStreamRows.reduce(
                      (sum, stream) => sum + Number(stream.byteLength || 0),
                      0
                  )
              }
            : {}

        return {
            schema: RawDataPreservationReportBuilder.SCHEMA,
            summary: {
                rawRecordCount: records.length,
                unknownRecordCount: unknownRows.length,
                opaqueRecordCount: opaqueRows.length,
                supportedRawRecordCount: records.filter(
                    (record) => record.supported
                ).length,
                unsupportedRawRecordCount: records.filter(
                    (record) => !record.supported
                ).length,
                parsedRawRecordCount: records.filter((record) => record.parsed)
                    .length,
                unparsedRawRecordCount: records.filter(
                    (record) => !record.parsed
                ).length,
                ...nativeStreamSummary,
                preservedByteCount
            },
            records,
            unknownRecords: unknownRows,
            opaqueRecords: opaqueRows,
            nativeStreams: nativeStreamRows,
            families: RawDataPreservationReportBuilder.#familyRows(records)
        }
    }

    /**
     * Collects raw records from direct input and parser roots.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #rawRecords(input) {
        return [
            ...(Array.isArray(input?.rawRecords) ? input.rawRecords : []),
            ...RawDataPreservationReportBuilder.#models(input).flatMap(
                (model) => [
                    ...(model?.pcb?.rawRecords || []),
                    ...((model?.pcbLibrary?.footprints || []).flatMap(
                        (footprint) => footprint.rawRecords || []
                    ) || [])
                ]
            )
        ]
    }

    /**
     * Collects unknown records from direct input and parser roots.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #unknownRecords(input) {
        return [
            ...(Array.isArray(input?.unknownRecords)
                ? input.unknownRecords
                : []),
            ...RawDataPreservationReportBuilder.#models(input).flatMap(
                (model) =>
                    (model?.pcbLibrary?.footprints || []).flatMap(
                        (footprint) => footprint.unknownRecords || []
                    )
            )
        ]
    }

    /**
     * Collects opaque records from direct input and parser roots.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #opaqueRecords(input) {
        return [
            ...(Array.isArray(input?.opaqueRecords) ? input.opaqueRecords : []),
            ...RawDataPreservationReportBuilder.#models(input).flatMap(
                (model) => [
                    ...(model?.schematic?.opaqueRecords || []),
                    ...(model?.schematicLibrary?.opaqueRecords || []),
                    ...((model?.schematicLibrary?.components || []).flatMap(
                        (component) => component.opaqueRecords || []
                    ) || []),
                    ...((model?.integratedLibrary?.sources || []).flatMap(
                        (source) => source.opaqueRecords || []
                    ) || [])
                ]
            )
        ]
    }

    /**
     * Collects native stream inventory rows from direct input and parser roots.
     * @param {object} input Build input.
     * @returns {object[]}
     */
    static #nativeStreams(input) {
        return [
            ...(Array.isArray(input?.nativeStreams) ? input.nativeStreams : []),
            ...RawDataPreservationReportBuilder.#models(input).flatMap(
                (model) => [
                    ...(model?.schematic?.nativeStreams?.streams || []),
                    ...(model?.pcb?.nativeStreams?.streams || []),
                    ...(model?.schematicLibrary?.nativeStreams?.streams || []),
                    ...(model?.pcbLibrary?.nativeStreams?.streams || []),
                    ...((model?.integratedLibrary?.sources || []).flatMap(
                        (source) => source.nativeStreams?.streams || []
                    ) || [])
                ]
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
     * Builds a public raw-record row without copying raw payload bytes.
     * @param {object} record Raw record.
     * @returns {object}
     */
    static #recordRow(record) {
        return RawDataPreservationReportBuilder.#stripUndefined({
            source: record?.source,
            sourceStorage: record?.sourceStorage,
            sourceStream: record?.sourceStream,
            family: record?.family || 'unknown',
            type: record?.type || 'unknown',
            typeId: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.typeId
            ),
            recordIndex: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.recordIndex
            ),
            byteLength: RawDataPreservationReportBuilder.#byteLength(record),
            supported: Boolean(record?.supported),
            parsed: Boolean(record?.parsed),
            hasRawPayload: Boolean(record?.rawBase64)
        })
    }

    /**
     * Builds a public unknown-record row.
     * @param {object} record Unknown record.
     * @returns {object}
     */
    static #unknownRecordRow(record) {
        return RawDataPreservationReportBuilder.#stripUndefined({
            sourceStorage: record?.sourceStorage,
            sourceStream: record?.sourceStream,
            typeId: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.typeId
            ),
            recordIndex: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.recordIndex
            ),
            byteLength: RawDataPreservationReportBuilder.#byteLength(record)
        })
    }

    /**
     * Builds a public opaque-record row.
     * @param {object} record Opaque record.
     * @returns {object}
     */
    static #opaqueRecordRow(record) {
        return RawDataPreservationReportBuilder.#stripUndefined({
            source: record?.source,
            sourceStorage: record?.sourceStorage,
            sourceStream: record?.sourceStream,
            frameType: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.frameType
            ),
            typeId: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.typeId
            ),
            recordIndex: RawDataPreservationReportBuilder.#finiteOrUndefined(
                record?.recordIndex
            ),
            byteLength: RawDataPreservationReportBuilder.#byteLength(record),
            hasRawPayload: Boolean(record?.rawBase64)
        })
    }

    /**
     * Builds a public native-stream inventory row.
     * @param {object} stream Native stream row.
     * @returns {object}
     */
    static #nativeStreamRow(stream) {
        return RawDataPreservationReportBuilder.#stripUndefined({
            source: stream?.source,
            sourceStorage: stream?.sourceStorage,
            sourceStream: stream?.sourceStream,
            leafName: stream?.leafName,
            byteLength: RawDataPreservationReportBuilder.#finiteOrUndefined(
                stream?.byteLength
            ),
            known: Boolean(stream?.known),
            consumed: Boolean(stream?.consumed),
            classification: stream?.classification,
            consumedBy: stream?.consumedBy,
            checksum: stream?.checksum
        })
    }

    /**
     * Builds per-family summary rows.
     * @param {object[]} records Raw record rows.
     * @returns {object[]}
     */
    static #familyRows(records) {
        const byFamily = new Map()
        for (const record of records) {
            const key = record.family || 'unknown'
            const row = byFamily.get(key) || {
                family: key,
                rawRecordCount: 0,
                supportedRawRecordCount: 0,
                unsupportedRawRecordCount: 0,
                preservedByteCount: 0
            }
            row.rawRecordCount += 1
            row.preservedByteCount += Number(record.byteLength || 0)
            if (record.supported) row.supportedRawRecordCount += 1
            else row.unsupportedRawRecordCount += 1
            byFamily.set(key, row)
        }

        return [...byFamily.values()].sort((left, right) =>
            left.family.localeCompare(right.family)
        )
    }

    /**
     * Resolves a byte length from explicit metadata or payload size.
     * @param {object} record Raw record.
     * @returns {number}
     */
    static #byteLength(record) {
        const explicit = Number(record?.byteLength)
        if (Number.isFinite(explicit) && explicit >= 0) return explicit
        if (typeof record?.rawBase64 === 'string') {
            return RawDataPreservationReportBuilder.#base64ByteLength(
                record.rawBase64
            )
        }
        return 0
    }

    /**
     * Computes decoded byte length for a base64 payload without decoding it.
     * @param {string} value Base64 payload.
     * @returns {number}
     */
    static #base64ByteLength(value) {
        const normalized = String(value || '').replace(/\s/gu, '')
        if (!normalized) return 0

        const padding = normalized.endsWith('==')
            ? 2
            : normalized.endsWith('=')
              ? 1
              : 0
        return Math.max(Math.floor((normalized.length * 3) / 4) - padding, 0)
    }

    /**
     * Returns a finite number or undefined.
     * @param {unknown} value Numeric value.
     * @returns {number | undefined}
     */
    static #finiteOrUndefined(value) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    /**
     * Removes undefined values from a row.
     * @param {object} row Row to strip.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
