// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'
import { PcbLayerStackFidelityReportBuilder } from './PcbLayerStackFidelityReportBuilder.mjs'
import { PcbLayerStackSourceMetadataParser } from './PcbLayerStackSourceMetadataParser.mjs'

const { parseNumericField } = ParserUtils

/**
 * Builds a source-aware PCB layer-stack read model from decoded board records.
 */
export class PcbLayerStackReadModelBuilder {
    static SCHEMA_ID = 'altium-toolkit.pcb.layer-stack.a1'

    static #fieldIndexes = new WeakMap()

    /**
     * Builds the layer-stack sidecar.
     * @param {{ fileName: string, boardRecords: { fields: Record<string, string | string[]>, sourceStream?: string }[], streamNames?: string[], layers: object[], primitiveLayers: object[], layerSubstacks: object[], boardRegions: object[] }} input Source model context.
     * @returns {object | undefined}
     */
    static build(input) {
        const fields = PcbLayerStackReadModelBuilder.#mergeFields(
            input.boardRecords || []
        )
        const layers = PcbLayerStackReadModelBuilder.#layers(
            input.layers || [],
            input.primitiveLayers || [],
            fields
        )
        const layerById = new Map(
            layers
                .filter((layer) => Number.isFinite(layer.layerId))
                .map((layer) => [layer.layerId, layer])
        )
        const substacks = PcbLayerStackReadModelBuilder.#substacks(
            input.layerSubstacks || [],
            fields,
            layerById,
            input.boardRegions || []
        )
        const branches = PcbLayerStackReadModelBuilder.#branches(fields)
        const topLevelBendLines =
            PcbLayerStackSourceMetadataParser.topLevelBendLines(fields)
        const cavityReport = PcbLayerStackSourceMetadataParser.cavityReport(
            layers,
            input.boardRegions || []
        )
        const impedanceProfiles =
            PcbLayerStackReadModelBuilder.#impedanceProfiles(fields)
        const transmissionLines =
            PcbLayerStackReadModelBuilder.#transmissionLines(fields, layerById)
        const viaSpans = PcbLayerStackReadModelBuilder.#layerSpans(
            fields,
            layerById,
            'via'
        )
        const backdrillSpans = PcbLayerStackReadModelBuilder.#layerSpans(
            fields,
            layerById,
            'backdrill'
        )
        const diagnostics = PcbLayerStackReadModelBuilder.#diagnostics({
            substacks,
            branches,
            impedanceProfiles,
            transmissionLines,
            viaSpans,
            backdrillSpans,
            layerById
        })
        const summary = {
            layerCount: layers.length,
            substackCount: substacks.length,
            boardRegionCount: (input.boardRegions || []).length,
            branchCount: branches.length,
            impedanceProfileCount: impedanceProfiles.length,
            transmissionLineCount: transmissionLines.length,
            viaSpanCount: viaSpans.length,
            backdrillSpanCount: backdrillSpans.length,
            topLevelBendLineCount: topLevelBendLines.length,
            cavityRegionCount: cavityReport.cavityRegionCount,
            stiffenerLayerCount: cavityReport.stiffenerLayerCount,
            adhesiveLayerCount: cavityReport.adhesiveLayerCount,
            diagnosticCount: diagnostics.length
        }

        if (!Object.values(summary).some((value) => value > 0)) {
            return undefined
        }

        const readModel = {
            schema: PcbLayerStackReadModelBuilder.SCHEMA_ID,
            summary,
            source: PcbLayerStackReadModelBuilder.#source(input),
            sourceMap: PcbLayerStackSourceMetadataParser.sourceMap(
                layers,
                topLevelBendLines,
                cavityReport
            ),
            layers,
            substacks,
            branches,
            topLevelBendLines,
            cavityReport,
            impedanceProfiles,
            transmissionLines,
            viaSpans,
            backdrillSpans,
            diagnostics
        }
        readModel.fidelityReport =
            PcbLayerStackFidelityReportBuilder.build(readModel)

        return readModel
    }

    /**
     * Merges board-record field maps for indexed sidecar scans.
     * @param {{ fields: Record<string, string | string[]> }[]} records Board records.
     * @returns {Record<string, string | string[]>}
     */
    static #mergeFields(records) {
        return Object.assign(
            {},
            ...records.map((record) => record.fields || {})
        )
    }

    /**
     * Builds source provenance for the sidecar.
     * @param {{ fileName: string, boardRecords: { sourceStream?: string }[], streamNames?: string[], boardRegions?: object[] }} input Source model context.
     * @returns {object}
     */
    static #source(input) {
        const nativeStreams = [
            ...new Set(
                (input.boardRecords || [])
                    .map((record) => record.sourceStream)
                    .filter(Boolean)
            )
        ]

        return {
            fileName: input.fileName,
            nativeStreams,
            hasNativeBoardData: nativeStreams.includes('Board6/Data'),
            hasBoardRegionsData:
                (input.streamNames || []).includes('BoardRegions/Data') ||
                (input.boardRegions || []).length > 0
        }
    }

    /**
     * Normalizes stack layers and primitive-layer fallbacks.
     * @param {object[]} layers Parsed physical layers.
     * @param {object[]} primitiveLayers Primitive layer map.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @returns {object[]}
     */
    static #layers(layers, primitiveLayers, fields) {
        if (layers.length) {
            return layers.map((layer) =>
                PcbLayerStackReadModelBuilder.#stripUndefined({
                    index: layer.index,
                    layerId: layer.layerId,
                    layerKey: PcbLayerStackReadModelBuilder.#layerKey(
                        layer.layerId
                    ),
                    name: layer.name,
                    kind: layer.kind,
                    material: layer.material,
                    thicknessMil: layer.thicknessMil,
                    copperThicknessMil: layer.copperThicknessMil,
                    copperWeight: layer.copperWeight,
                    dielectricConstant: layer.dielectricConstant,
                    dissipationFactor: layer.dissipationFactor,
                    ...PcbLayerStackSourceMetadataParser.layerSourceFields(
                        fields,
                        layer.index
                    )
                })
            )
        }

        return (primitiveLayers || []).map((layer, index) =>
            PcbLayerStackReadModelBuilder.#stripUndefined({
                index: index + 1,
                layerId: layer.layerId,
                layerKey: PcbLayerStackReadModelBuilder.#layerKey(
                    layer.layerId
                ),
                name: layer.name,
                kind: layer.kind || layer.role,
                ...PcbLayerStackSourceMetadataParser.layerSourceFields(
                    fields,
                    index + 1
                )
            })
        )
    }

    /**
     * Normalizes substacks and links them to board-region rows.
     * @param {object[]} layerSubstacks Parsed substacks.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {Map<number, object>} layerById Layer lookup.
     * @param {object[]} boardRegions Board regions.
     * @returns {object[]}
     */
    static #substacks(layerSubstacks, fields, layerById, boardRegions) {
        return layerSubstacks.map((substack) => {
            const layerIds = PcbLayerStackReadModelBuilder.#layerIdList(
                PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['V9_SUBSTACK', 'SUBSTACK', 'LAYERSUBSTACK_V8_'],
                    substack.index,
                    ['LAYERS', 'LAYERIDS', 'LAYER_IDS', 'STACKLAYERS']
                )
            )
            const regions = boardRegions
                .map((region, regionIndex) => ({ region, regionIndex }))
                .filter(
                    ({ region }) =>
                        region.layerStackId &&
                        region.layerStackId === substack.id
                )

            return PcbLayerStackReadModelBuilder.#stripUndefined({
                index: substack.index,
                id: substack.id,
                name: substack.name,
                isFlex: substack.isFlex,
                layerIds,
                layerKeys: layerIds
                    .map((layerId) => layerById.get(layerId)?.layerKey)
                    .filter(Boolean),
                boardRegionIndexes: regions.map(
                    ({ regionIndex }) => regionIndex
                ),
                boardRegionNames: regions
                    .map(({ region }) => region.name)
                    .filter(Boolean),
                bendingLineCount: regions.reduce(
                    (count, { region }) =>
                        count + (region.bendingLineCount || 0),
                    0
                )
            })
        })
    }

    /**
     * Parses layer-stack branch rows.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @returns {object[]}
     */
    static #branches(fields) {
        return PcbLayerStackReadModelBuilder.#indexedRows(fields, [
            /^STACKBRANCH(\d+)_ID$/iu,
            /^V9_STACKBRANCH(\d+)_ID$/iu
        ]).map((index) =>
            PcbLayerStackReadModelBuilder.#stripUndefined({
                index,
                id: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['STACKBRANCH', 'V9_STACKBRANCH'],
                    index,
                    ['ID']
                ),
                name: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['STACKBRANCH', 'V9_STACKBRANCH'],
                    index,
                    ['NAME']
                ),
                rootStackRef: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['STACKBRANCH', 'V9_STACKBRANCH'],
                    index,
                    ['ROOTSTACKREF', 'ROOT_STACK_REF', 'PARENTSTACKREF']
                ),
                stackRefs: PcbLayerStackReadModelBuilder.#list(
                    PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        ['STACKBRANCH', 'V9_STACKBRANCH'],
                        index,
                        ['STACKREFS', 'STACK_REFS', 'SECTIONSTACKREFS']
                    )
                ),
                description: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['STACKBRANCH', 'V9_STACKBRANCH'],
                    index,
                    ['DESCRIPTION']
                ),
                parentBranchId: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['STACKBRANCH', 'V9_STACKBRANCH'],
                    index,
                    ['PARENTBRANCHID', 'PARENT_BRANCH_ID']
                ),
                sections: PcbLayerStackSourceMetadataParser.optionalArray(
                    PcbLayerStackSourceMetadataParser.branchSections(
                        fields,
                        index
                    )
                )
            })
        )
    }

    /**
     * Parses impedance profile rows.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @returns {object[]}
     */
    static #impedanceProfiles(fields) {
        return PcbLayerStackReadModelBuilder.#indexedRows(fields, [
            /^IMPEDANCEPROFILE(\d+)_ID$/iu,
            /^V9_IMPEDANCEPROFILE(\d+)_ID$/iu
        ]).map((index) =>
            PcbLayerStackReadModelBuilder.#stripUndefined({
                index,
                id: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['ID']
                ),
                name: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['NAME']
                ),
                targetImpedanceOhm: PcbLayerStackReadModelBuilder.#number(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['TARGETIMPEDANCE', 'TARGET_IMPEDANCE', 'IMPEDANCE']
                ),
                kind: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['KIND', 'TYPE']
                ),
                profileTypeRaw: PcbLayerStackReadModelBuilder.#number(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['TYPERAW', 'TYPE_RAW', 'PROFILETYPERAW']
                ),
                tolerance: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['TOLERANCE']
                ),
                transmissionLineCount: PcbLayerStackReadModelBuilder.#number(
                    fields,
                    ['IMPEDANCEPROFILE', 'V9_IMPEDANCEPROFILE'],
                    index,
                    ['TRANSMISSIONLINECOUNT', 'TRANSMISSION_LINE_COUNT']
                )
            })
        )
    }

    /**
     * Parses transmission-line rows tied to impedance profiles.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {Map<number, object>} layerById Layer lookup.
     * @returns {object[]}
     */
    static #transmissionLines(fields, layerById) {
        return PcbLayerStackReadModelBuilder.#indexedRows(fields, [
            /^TRANSMISSIONLINE(\d+)_ID$/iu,
            /^V9_TRANSMISSIONLINE(\d+)_ID$/iu
        ]).map((index) => {
            const layerId = PcbLayerStackReadModelBuilder.#number(
                fields,
                ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                index,
                ['LAYERID', 'LAYER_ID', 'SIGNALLAYERID']
            )
            const referenceLayerId = PcbLayerStackReadModelBuilder.#number(
                fields,
                ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                index,
                [
                    'REFERENCE_LAYERID',
                    'REFERENCELAYERID',
                    'REFERENCE_LAYER_ID',
                    'REFERENCELAYER'
                ]
            )

            return PcbLayerStackReadModelBuilder.#stripUndefined({
                index,
                id: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['ID']
                ),
                name: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['NAME']
                ),
                profileId: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['PROFILEID', 'PROFILE_ID', 'IMPEDANCEPROFILEID']
                ),
                substackId: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['SUBSTACKID', 'SUBSTACK_ID']
                ),
                layerId,
                layerKey: layerById.get(layerId)?.layerKey,
                referenceLayerId,
                referenceLayerKey: layerById.get(referenceLayerId)?.layerKey,
                topRefId: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['TOPREFID', 'TOP_REF_ID']
                ),
                bottomRefId: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['BOTTOMREFID', 'BOTTOM_REF_ID']
                ),
                widthMil: PcbLayerStackReadModelBuilder.#number(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['WIDTH', 'TRACEWIDTH']
                ),
                gapMil: PcbLayerStackReadModelBuilder.#number(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['GAP', 'PAIRGAP']
                ),
                isDifferential: PcbLayerStackReadModelBuilder.#optionalBoolean(
                    PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                        index,
                        ['ISDIFFERENTIAL', 'IS_DIFFERENTIAL']
                    )
                ),
                calcMode: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['CALCMODE', 'CALC_MODE']
                ),
                calcModeRaw: PcbLayerStackReadModelBuilder.#number(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['CALCMODERAW', 'CALC_MODE_RAW']
                ),
                impedanceError: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['IMPEDANCEERROR', 'IMPEDANCE_ERROR']
                ),
                tlTypeName: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['TLTYPENAME', 'TL_TYPE_NAME']
                ),
                hasPlating: PcbLayerStackReadModelBuilder.#optionalBoolean(
                    PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                        index,
                        ['HASPLATING', 'HAS_PLATING']
                    )
                ),
                useSolderMask: PcbLayerStackReadModelBuilder.#optionalBoolean(
                    PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                        index,
                        ['USESOLDERMASK', 'USE_SOLDER_MASK']
                    )
                ),
                coatedHeight1: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['COATEDHEIGHT1', 'COATED_HEIGHT_1']
                ),
                coatedHeight2: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['COATEDHEIGHT2', 'COATED_HEIGHT_2']
                ),
                clearanceToPlane: PcbLayerStackReadModelBuilder.#indexedField(
                    fields,
                    ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                    index,
                    ['CLEARANCETOPLANE', 'CLEARANCE_TO_PLANE']
                ),
                electricParameters: PcbLayerStackReadModelBuilder.#keyValueMap(
                    PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        ['TRANSMISSIONLINE', 'V9_TRANSMISSIONLINE'],
                        index,
                        ['ELECTRICPARAMETERS', 'ELECTRIC_PARAMETERS']
                    )
                )
            })
        })
    }

    /**
     * Parses via/backdrill span rows.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {Map<number, object>} layerById Layer lookup.
     * @param {'via' | 'backdrill'} kind Span kind.
     * @returns {object[]}
     */
    static #layerSpans(fields, layerById, kind) {
        const prefixes =
            kind === 'via'
                ? ['VIASPAN', 'V9_VIASPAN']
                : ['BACKDRILLSPAN', 'V9_BACKDRILLSPAN']
        const patterns =
            kind === 'via'
                ? [/^VIASPAN(\d+)_ID$/iu, /^V9_VIASPAN(\d+)_ID$/iu]
                : [/^BACKDRILLSPAN(\d+)_ID$/iu, /^V9_BACKDRILLSPAN(\d+)_ID$/iu]

        return PcbLayerStackReadModelBuilder.#indexedRows(fields, patterns).map(
            (index) => {
                const startLayerId = PcbLayerStackReadModelBuilder.#number(
                    fields,
                    prefixes,
                    index,
                    ['STARTLAYER', 'STARTLAYERID', 'START_LAYERID', 'FROMLAYER']
                )
                const endLayerId = PcbLayerStackReadModelBuilder.#number(
                    fields,
                    prefixes,
                    index,
                    ['ENDLAYER', 'ENDLAYERID', 'END_LAYERID', 'TOLAYER']
                )

                return PcbLayerStackReadModelBuilder.#stripUndefined({
                    index,
                    id: PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        prefixes,
                        index,
                        ['ID']
                    ),
                    name: PcbLayerStackReadModelBuilder.#indexedField(
                        fields,
                        prefixes,
                        index,
                        ['NAME']
                    ),
                    startLayerId,
                    startLayerKey: layerById.get(startLayerId)?.layerKey,
                    endLayerId,
                    endLayerKey: layerById.get(endLayerId)?.layerKey,
                    targetStubMil: PcbLayerStackReadModelBuilder.#number(
                        fields,
                        prefixes,
                        index,
                        ['TARGETSTUB', 'TARGET_STUB', 'MAXSTUB']
                    )
                })
            }
        )
    }

    /**
     * Builds preservation-first diagnostics for unresolved references.
     * @param {object} input Sidecar sections.
     * @returns {object[]}
     */
    static #diagnostics(input) {
        const diagnostics = []
        const stackIds = new Set(
            input.substacks.map((substack) => substack.id).filter(Boolean)
        )
        const profileIds = new Set(
            input.impedanceProfiles.map((profile) => profile.id).filter(Boolean)
        )

        for (const branch of input.branches) {
            for (const stackRef of branch.stackRefs || []) {
                if (stackIds.has(stackRef)) continue
                diagnostics.push(
                    PcbLayerStackReadModelBuilder.#diagnostic(
                        'pcb.layer-stack.unresolved-branch-substack',
                        'Layer-stack branch references an unknown substack.',
                        { branchId: branch.id, stackRef }
                    )
                )
            }
        }

        for (const line of input.transmissionLines) {
            if (line.profileId && !profileIds.has(line.profileId)) {
                diagnostics.push(
                    PcbLayerStackReadModelBuilder.#diagnostic(
                        'pcb.layer-stack.unresolved-impedance-profile',
                        'Transmission-line metadata references an unknown impedance profile.',
                        {
                            transmissionLineId: line.id,
                            profileId: line.profileId
                        }
                    )
                )
            }
            PcbLayerStackReadModelBuilder.#layerDiagnostic(
                diagnostics,
                input.layerById,
                line.layerId,
                'pcb.layer-stack.unresolved-transmission-layer',
                { transmissionLineId: line.id, layerRole: 'signal' }
            )
            PcbLayerStackReadModelBuilder.#layerDiagnostic(
                diagnostics,
                input.layerById,
                line.referenceLayerId,
                'pcb.layer-stack.unresolved-reference-layer',
                { transmissionLineId: line.id, layerRole: 'reference' }
            )
        }

        for (const span of [...input.viaSpans, ...input.backdrillSpans]) {
            PcbLayerStackReadModelBuilder.#layerDiagnostic(
                diagnostics,
                input.layerById,
                span.startLayerId,
                'pcb.layer-stack.unresolved-span-start-layer',
                { spanId: span.id }
            )
            PcbLayerStackReadModelBuilder.#layerDiagnostic(
                diagnostics,
                input.layerById,
                span.endLayerId,
                'pcb.layer-stack.unresolved-span-end-layer',
                { spanId: span.id }
            )
        }

        return diagnostics
    }

    /**
     * Adds an unresolved-layer diagnostic when needed.
     * @param {object[]} diagnostics Diagnostic target.
     * @param {Map<number, object>} layerById Layer lookup.
     * @param {number | undefined} layerId Layer id.
     * @param {string} code Diagnostic code.
     * @param {object} extra Extra fields.
     * @returns {void}
     */
    static #layerDiagnostic(diagnostics, layerById, layerId, code, extra) {
        if (!Number.isFinite(layerId) || layerById.has(layerId)) return

        diagnostics.push(
            PcbLayerStackReadModelBuilder.#diagnostic(
                code,
                'Layer-stack metadata references an unknown layer.',
                { ...extra, layerId }
            )
        )
    }

    /**
     * Builds a structured diagnostic row.
     * @param {string} code Diagnostic code.
     * @param {string} message Diagnostic message.
     * @param {object} extra Extra fields.
     * @returns {object}
     */
    static #diagnostic(code, message, extra) {
        return {
            code,
            severity: 'warning',
            message,
            ...extra
        }
    }

    /**
     * Finds all indexes matching any row-id pattern.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {RegExp[]} patterns Index patterns.
     * @returns {number[]}
     */
    static #indexedRows(fields, patterns) {
        return [
            ...new Set(
                Object.keys(fields).flatMap((key) => {
                    for (const pattern of patterns) {
                        const match = pattern.exec(key)
                        if (match) return [Number.parseInt(match[1], 10)]
                    }
                    return []
                })
            )
        ].sort((left, right) => left - right)
    }

    /**
     * Finds nested indexes for fields with a common prefix and suffix.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string} prefix Field prefix before the nested index.
     * @param {string} suffix Field suffix after the nested index.
     * @returns {number[]}
     */
    static #nestedIndexes(fields, prefix, suffix) {
        const pattern = new RegExp(
            '^' +
                prefix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') +
                '(\\d+)' +
                suffix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') +
                '$',
            'iu'
        )

        return [
            ...new Set(
                Object.keys(fields).flatMap((key) => {
                    const match = pattern.exec(key)
                    return match ? [Number.parseInt(match[1], 10)] : []
                })
            )
        ].sort((left, right) => left - right)
    }

    /**
     * Reads the first matching indexed field.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} prefixes Row prefixes.
     * @param {number} index Row index.
     * @param {string[]} suffixes Field suffixes.
     * @returns {string}
     */
    static #indexedField(fields, prefixes, index, suffixes) {
        for (const prefix of prefixes) {
            for (const suffix of suffixes) {
                const value = PcbLayerStackReadModelBuilder.#field(
                    fields,
                    prefix + index + '_' + suffix
                )
                if (value) return value
            }
        }

        return ''
    }

    /**
     * Parses one indexed numeric field.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} prefixes Row prefixes.
     * @param {number} index Row index.
     * @param {string[]} suffixes Field suffixes.
     * @returns {number | undefined}
     */
    static #number(fields, prefixes, index, suffixes) {
        for (const prefix of prefixes) {
            for (const suffix of suffixes) {
                const key = prefix + index + '_' + suffix
                const parsed = parseNumericField(fields, key)
                if (parsed !== null) return parsed
            }
        }

        return undefined
    }

    /**
     * Reads a case-insensitive field value.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string} key Field key.
     * @returns {string}
     */
    static #field(fields, key) {
        if (Object.hasOwn(fields, key) || key in fields) {
            return ParserUtils.getField(fields, key)
        }
        const realKey = PcbLayerStackReadModelBuilder.#fieldIndex(fields).get(
            key.toUpperCase()
        )

        return realKey ? ParserUtils.getField(fields, realKey) : ''
    }

    /**
     * Builds or returns a cached case-insensitive field-key index.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @returns {Map<string, string>}
     */
    static #fieldIndex(fields) {
        const cached = PcbLayerStackReadModelBuilder.#fieldIndexes.get(fields)
        if (cached) return cached

        const fieldIndex = new Map()
        for (const fieldKey of Object.keys(fields)) {
            const upperKey = fieldKey.toUpperCase()
            if (!fieldIndex.has(upperKey)) {
                fieldIndex.set(upperKey, fieldKey)
            }
        }

        PcbLayerStackReadModelBuilder.#fieldIndexes.set(fields, fieldIndex)
        return fieldIndex
    }

    /**
     * Parses layer-id lists.
     * @param {string} value Raw list value.
     * @returns {number[]}
     */
    static #layerIdList(value) {
        return PcbLayerStackReadModelBuilder.#list(value)
            .map((item) => Number.parseInt(item, 10))
            .filter(Number.isFinite)
    }

    /**
     * Splits a native list field.
     * @param {string} value Raw list value.
     * @returns {string[]}
     */
    static #list(value) {
        return String(value || '')
            .split(/[;,]/u)
            .map((item) => item.trim())
            .filter(Boolean)
    }

    /**
     * Parses a native key-value property bag.
     * @param {string} value Raw value.
     * @returns {object | undefined}
     */
    static #keyValueMap(value) {
        const entries = String(value || '')
            .split(/[|;]/u)
            .map((item) => item.trim())
            .filter(Boolean)
            .flatMap((item) => {
                const separator = item.indexOf('=')
                if (separator < 0) return []
                return [
                    [
                        item.slice(0, separator).trim(),
                        item.slice(separator + 1).trim()
                    ]
                ]
            })
            .filter(([key]) => key)

        return entries.length ? Object.fromEntries(entries) : undefined
    }

    /**
     * Parses an optional boolean value.
     * @param {string} value Raw value.
     * @returns {boolean | undefined}
     */
    static #optionalBoolean(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
        if (!normalized) return undefined
        return ['true', 't', '1', 'yes'].includes(normalized)
    }

    /**
     * Parses a numeric token.
     * @param {string | undefined} value Raw token.
     * @returns {number | undefined}
     */
    static #numberToken(value) {
        const parsed = Number.parseFloat(String(value || '').trim())
        return Number.isFinite(parsed) ? parsed : undefined
    }

    /**
     * Builds a stable layer key.
     * @param {number | null | undefined} layerId Layer id.
     * @returns {string | undefined}
     */
    static #layerKey(layerId) {
        return Number.isFinite(layerId) ? 'L' + layerId : undefined
    }

    /**
     * Removes undefined and empty string values while keeping false and empty
     * arrays stable.
     * @param {Record<string, unknown>} object Source object.
     * @returns {object}
     */
    static #stripUndefined(object) {
        return Object.fromEntries(
            Object.entries(object).filter(
                ([, value]) => value !== undefined && value !== ''
            )
        )
    }
}
