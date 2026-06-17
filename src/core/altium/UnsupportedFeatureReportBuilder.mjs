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
     * @param {{ models?: object[], recordTypes?: object[], rawRecords?: object[], opaqueRecords?: object[], diagnostics?: object[], edgeCases?: object[] }} [input] Report input.
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
        const edgeCases = UnsupportedFeatureReportBuilder.#edgeCases(
            input,
            models
        )
        const itemCount =
            recordTypes.length +
            rawRecords.length +
            opaqueRecords.length +
            diagnostics.length +
            edgeCases.length

        return {
            schema: UnsupportedFeatureReportBuilder.SCHEMA,
            summary: {
                modelCount: models.length,
                unsupportedRecordTypeCount: recordTypes.length,
                rawRecordCount: rawRecords.length,
                opaqueRecordCount: opaqueRecords.length,
                diagnosticCount: diagnostics.length,
                edgeCaseCount: edgeCases.length,
                itemCount,
                status: itemCount ? 'unsupported' : 'supported'
            },
            recordTypes,
            rawRecords,
            opaqueRecords,
            diagnostics,
            edgeCases
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
     * Collects parser edge-case coverage rows.
     * @param {object} input Report input.
     * @param {object[]} models Parser roots.
     * @returns {object[]}
     */
    static #edgeCases(input, models) {
        return UnsupportedFeatureReportBuilder.#dedupeEdgeCases(
            [
                ...(Array.isArray(input?.edgeCases)
                    ? input.edgeCases.map((edgeCase) => ({
                          edgeCase: edgeCase || {},
                          fileName: edgeCase?.fileName || '',
                          domain: edgeCase?.domain || ''
                      }))
                    : []),
                ...models.flatMap((model) =>
                    (model?.diagnostics || [])
                        .filter((diagnostic) =>
                            UnsupportedFeatureReportBuilder.#isEdgeCaseDiagnostic(
                                diagnostic
                            )
                        )
                        .map((diagnostic) => ({
                            edgeCase: diagnostic,
                            fileName:
                                model.fileName || diagnostic.fileName || '',
                            domain: diagnostic.domain || ''
                        }))
                ),
                ...models.flatMap((model) =>
                    UnsupportedFeatureReportBuilder.#modelDerivedEdgeCases(
                        model
                    )
                )
            ].map(({ edgeCase, fileName, domain }) =>
                UnsupportedFeatureReportBuilder.#stripUndefined({
                    fileName,
                    domain,
                    code: edgeCase.code,
                    feature: edgeCase.feature,
                    supportState: edgeCase.supportState,
                    severity: edgeCase.severity,
                    message: edgeCase.message,
                    source: edgeCase.source,
                    sourceStream: edgeCase.sourceStream,
                    sourceStorage: edgeCase.sourceStorage,
                    recordIndex:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            edgeCase.recordIndex
                        ),
                    recordType:
                        UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                            edgeCase.recordType
                        ),
                    errorKind: edgeCase.errorKind
                })
            )
        )
    }

    /**
     * Collects compatibility edge cases derivable from parsed model data.
     * @param {object} model Parser root.
     * @returns {{ edgeCase: object, fileName: string, domain: string }[]}
     */
    static #modelDerivedEdgeCases(model) {
        const fileName = String(model?.fileName || '')
        const pcb = model?.pcb || {}

        return [
            ...UnsupportedFeatureReportBuilder.#padEdgeCases(
                pcb.pads,
                fileName
            ),
            ...UnsupportedFeatureReportBuilder.#arcEdgeCases(
                pcb.arcs,
                fileName
            ),
            ...UnsupportedFeatureReportBuilder.#regionEdgeCases(
                pcb.regions,
                fileName
            ),
            ...UnsupportedFeatureReportBuilder.#componentBodyEdgeCases(
                pcb.componentBodies,
                fileName
            ),
            ...UnsupportedFeatureReportBuilder.#embeddedModelIntegrityEdgeCases(
                pcb.embeddedModelIntegrity?.issues,
                fileName
            )
        ]
    }

    /**
     * Collects pad compatibility rows.
     * @param {object[] | undefined} pads Pads.
     * @param {string} fileName Source file.
     * @returns {{ edgeCase: object, fileName: string, domain: string }[]}
     */
    static #padEdgeCases(pads, fileName) {
        return (Array.isArray(pads) ? pads : []).flatMap((pad) => {
            const rows = []

            if (UnsupportedFeatureReportBuilder.#hasOctagonalPadShape(pad)) {
                rows.push(
                    UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                        code: 'pcb.pad.octagonal',
                        feature: 'octagonal-pad',
                        supportState: 'inspection-required',
                        severity: 'warning',
                        message:
                            'Pad uses an octagonal shape that should be inspected in downstream views.',
                        ...UnsupportedFeatureReportBuilder.#recordLocation(pad)
                    })
                )
            }

            if (Number(pad?.padMode) > 0) {
                rows.push(
                    UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                        code: 'pcb.pad.non-simple-stack',
                        feature: 'non-simple-pad-stack',
                        supportState: 'inspection-required',
                        severity: 'warning',
                        message:
                            'Pad uses layer-specific pad-stack mode metadata.',
                        ...UnsupportedFeatureReportBuilder.#recordLocation(pad)
                    })
                )
            }

            if (
                UnsupportedFeatureReportBuilder.#hasLayerSpecificPadGeometry(
                    pad
                )
            ) {
                rows.push(
                    UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                        code: 'pcb.pad.layer-specific-geometry',
                        feature: 'layer-specific-pad-geometry',
                        supportState: 'preserved',
                        severity: 'info',
                        message:
                            'Pad has different top, middle, or bottom geometry.',
                        ...UnsupportedFeatureReportBuilder.#recordLocation(pad)
                    })
                )
            }

            if (UnsupportedFeatureReportBuilder.#hasSlotHole(pad)) {
                rows.push(
                    UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                        code: 'pcb.pad.slot-hole',
                        feature: 'slot-hole',
                        supportState: 'preserved',
                        severity: 'info',
                        message: 'Pad uses slot-hole geometry.',
                        ...UnsupportedFeatureReportBuilder.#recordLocation(pad)
                    })
                )
            }

            if (UnsupportedFeatureReportBuilder.#hasManualMaskPaste(pad)) {
                rows.push(
                    UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                        code: 'pcb.pad.manual-mask-paste',
                        feature: 'manual-mask-paste-expansion',
                        supportState: 'inspection-required',
                        severity: 'warning',
                        message:
                            'Pad carries manual solder-mask or paste-mask expansion metadata.',
                        ...UnsupportedFeatureReportBuilder.#recordLocation(pad)
                    })
                )
            }

            if (
                UnsupportedFeatureReportBuilder.#hasMissingCustomShapeGeometry(
                    pad
                )
            ) {
                rows.push(
                    UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                        code: 'pcb.custom-shape.missing-linked-geometry',
                        feature: 'custom-pad-shape-linkage',
                        supportState: 'inspection-required',
                        severity: 'warning',
                        message:
                            'Custom pad shape sidecar has no linked primitive geometry.',
                        ...UnsupportedFeatureReportBuilder.#recordLocation(pad)
                    })
                )
            }

            return rows
        })
    }

    /**
     * Collects arc compatibility rows.
     * @param {object[] | undefined} arcs Arcs.
     * @param {string} fileName Source file.
     * @returns {{ edgeCase: object, fileName: string, domain: string }[]}
     */
    static #arcEdgeCases(arcs, fileName) {
        return (Array.isArray(arcs) ? arcs : [])
            .filter((arc) => {
                const radius = Math.abs(Number(arc?.radius))
                const width = Math.abs(Number(arc?.width))
                return Number.isFinite(radius) && radius > 0 && width >= radius
            })
            .map((arc) =>
                UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                    code: 'pcb.arc.width-radius-conflict',
                    feature: 'wide-arc',
                    supportState: 'inspection-required',
                    severity: 'warning',
                    message:
                        'Arc stroke width is greater than or equal to its radius.',
                    ...UnsupportedFeatureReportBuilder.#recordLocation(arc)
                })
            )
    }

    /**
     * Collects region compatibility rows.
     * @param {object[] | undefined} regions Regions.
     * @param {string} fileName Source file.
     * @returns {{ edgeCase: object, fileName: string, domain: string }[]}
     */
    static #regionEdgeCases(regions, fileName) {
        return (Array.isArray(regions) ? regions : [])
            .filter(
                (region) =>
                    Number(region?.holeCount || region?.HOLECOUNT || 0) > 0
            )
            .map((region) =>
                UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                    code: 'pcb.region.holes',
                    feature: 'region-with-holes',
                    supportState: 'preserved',
                    severity: 'info',
                    message: 'Region contains one or more holes.',
                    ...UnsupportedFeatureReportBuilder.#recordLocation(region)
                })
            )
    }

    /**
     * Collects component-body compatibility rows.
     * @param {object[] | undefined} componentBodies Component bodies.
     * @param {string} fileName Source file.
     * @returns {{ edgeCase: object, fileName: string, domain: string }[]}
     */
    static #componentBodyEdgeCases(componentBodies, fileName) {
        return (Array.isArray(componentBodies) ? componentBodies : [])
            .filter((componentBody) =>
                UnsupportedFeatureReportBuilder.#missingStaticBodyGeometry(
                    componentBody
                )
            )
            .map((componentBody) =>
                UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                    code: 'pcb.model.shape-body-static-geometry-missing',
                    feature: 'shape-based-3d-body',
                    supportState: 'inspection-required',
                    severity: 'warning',
                    message:
                        'Shape-based 3D body has no complete static geometry description.',
                    ...UnsupportedFeatureReportBuilder.#recordLocation(
                        componentBody
                    )
                })
            )
    }

    /**
     * Collects embedded-model integrity rows.
     * @param {object[] | undefined} issues Integrity issues.
     * @param {string} fileName Source file.
     * @returns {{ edgeCase: object, fileName: string, domain: string }[]}
     */
    static #embeddedModelIntegrityEdgeCases(issues, fileName) {
        return (Array.isArray(issues) ? issues : []).map((issue) =>
            UnsupportedFeatureReportBuilder.#pcbEdgeCase(fileName, {
                code: issue.code,
                feature: 'embedded-model-integrity',
                supportState: 'diagnostic',
                severity: issue.severity || 'warning',
                message: issue.message,
                ...UnsupportedFeatureReportBuilder.#recordLocation(issue)
            })
        )
    }

    /**
     * Wraps one PCB edge-case row.
     * @param {string} fileName Source file.
     * @param {object} edgeCase Edge-case row.
     * @returns {{ edgeCase: object, fileName: string, domain: string }}
     */
    static #pcbEdgeCase(fileName, edgeCase) {
        return {
            edgeCase,
            fileName,
            domain: 'pcb'
        }
    }

    /**
     * Extracts common record location fields.
     * @param {object} row Source row.
     * @returns {object}
     */
    static #recordLocation(row) {
        return UnsupportedFeatureReportBuilder.#stripUndefined({
            source: row?.source,
            sourceStream: row?.sourceStream,
            sourceStorage: row?.sourceStorage,
            recordIndex: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                row?.recordIndex
            ),
            recordType: UnsupportedFeatureReportBuilder.#finiteOrUndefined(
                row?.recordType
            )
        })
    }

    /**
     * Returns true when one pad uses an octagonal pad shape.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasOctagonalPadShape(pad) {
        const shapeNames = [
            pad?.shapeTopName,
            pad?.shapeMidName,
            pad?.shapeBottomName,
            pad?.padShapeNames?.top,
            pad?.padShapeNames?.middle,
            pad?.padShapeNames?.bottom
        ].map((value) => String(value || '').toLowerCase())
        const shapeCodes = [pad?.shapeTop, pad?.shapeMid, pad?.shapeBottom].map(
            (value) => Number(value)
        )

        return (
            shapeNames.includes('octagonal') || shapeCodes.includes(Number(3))
        )
    }

    /**
     * Returns true when top, middle, or bottom pad geometry differs.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasLayerSpecificPadGeometry(pad) {
        const sizes = [
            [pad?.sizeTopX, pad?.sizeTopY],
            [pad?.sizeMidX, pad?.sizeMidY],
            [pad?.sizeBottomX, pad?.sizeBottomY]
        ].map(([x, y]) => [Number(x), Number(y)])
        const finiteSizes = sizes.filter(([x, y]) =>
            [x, y].every(Number.isFinite)
        )
        const shapes = [pad?.shapeTop, pad?.shapeMid, pad?.shapeBottom]
            .map((value) => Number(value))
            .filter(Number.isFinite)

        return (
            UnsupportedFeatureReportBuilder.#hasDistinctPairs(finiteSizes) ||
            new Set(shapes).size > 1
        )
    }

    /**
     * Returns true when an array of numeric pairs has more than one value.
     * @param {number[][]} pairs Numeric pairs.
     * @returns {boolean}
     */
    static #hasDistinctPairs(pairs) {
        return new Set(pairs.map((pair) => pair.join(','))).size > 1
    }

    /**
     * Returns true when one pad uses slot-hole geometry.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasSlotHole(pad) {
        return (
            String(
                pad?.holeShapeName || pad?.holeGeometry?.shapeName || ''
            ).toLowerCase() === 'slot'
        )
    }

    /**
     * Returns true when one pad uses manual mask or paste expansion metadata.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasManualMaskPaste(pad) {
        const sources = [
            pad?.pasteMaskExpansionSource,
            pad?.solderMaskExpansionSource
        ].map((value) => String(value || '').toLowerCase())
        const modes = [
            pad?.pasteMaskExpansionMode,
            pad?.solderMaskExpansionMode
        ].map((value) => Number(value))

        return sources.includes('manual') || modes.includes(Number(2))
    }

    /**
     * Returns true when custom-shape layers have no linked geometry.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasMissingCustomShapeGeometry(pad) {
        const layers = Array.isArray(pad?.customShape?.layers)
            ? pad.customShape.layers
            : []

        return (
            layers.length > 0 &&
            layers.some(
                (layer) =>
                    !UnsupportedFeatureReportBuilder.#customShapeLayerHasGeometry(
                        layer
                    )
            )
        )
    }

    /**
     * Returns true when a custom-shape layer links to any primitive geometry.
     * @param {object} layer Custom shape layer.
     * @returns {boolean}
     */
    static #customShapeLayerHasGeometry(layer) {
        return ['regions', 'shapeRegions', 'arcs', 'tracks', 'fills'].some(
            (key) => Array.isArray(layer?.[key]) && layer[key].length > 0
        )
    }

    /**
     * Returns true when a known shape body lacks complete static geometry.
     * @param {object} componentBody Component body.
     * @returns {boolean}
     */
    static #missingStaticBodyGeometry(componentBody) {
        const typeName = String(componentBody?.modelTypeName || '')
        const isShapeBody = [
            'extruded-polygon',
            'cone',
            'cylinder',
            'sphere'
        ].includes(typeName)

        if (!isShapeBody) {
            return false
        }

        return componentBody?.staticGeometry?.status !== 'complete'
    }

    /**
     * Removes repeated edge-case rows.
     * @param {object[]} edgeCases Edge cases.
     * @returns {object[]}
     */
    static #dedupeEdgeCases(edgeCases) {
        const seen = new Set()
        const deduped = []

        for (const edgeCase of edgeCases) {
            const row = edgeCase?.edgeCase || edgeCase || {}
            const key = [
                edgeCase?.fileName || row.fileName || '',
                edgeCase?.domain || row.domain || '',
                row.code || '',
                row.sourceStream || '',
                row.sourceStorage || '',
                row.recordIndex ?? ''
            ].join('\u0000')

            if (seen.has(key)) {
                continue
            }

            seen.add(key)
            deduped.push(edgeCase)
        }

        return deduped
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
     * Returns true for diagnostics that describe parser edge-case coverage.
     * @param {object} diagnostic Diagnostic row.
     * @returns {boolean}
     */
    static #isEdgeCaseDiagnostic(diagnostic) {
        if (!diagnostic || typeof diagnostic !== 'object') return false
        if (diagnostic.errorKind === 'edge-case') return true
        return String(diagnostic.code || '')
            .toLowerCase()
            .includes('edge-case')
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
