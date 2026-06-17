// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic fabrication-readiness review items from PCB pads/vias.
 */
export class PcbFabricationReadinessReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.fabrication-readiness.a1'

    /**
     * Builds a fabrication-readiness report from a parser root or PCB model.
     * @param {object} input Parser root, PCB model, or options object.
     * @returns {object}
     */
    static build(input = {}) {
        const pcb = PcbFabricationReadinessReportBuilder.#pcb(input)
        const pads = Array.isArray(pcb?.pads) ? pcb.pads : []
        const vias = Array.isArray(pcb?.vias) ? pcb.vias : []
        const items = [
            ...PcbFabricationReadinessReportBuilder.#padItems(pads),
            ...PcbFabricationReadinessReportBuilder.#viaItems(vias)
        ]

        return {
            schema: PcbFabricationReadinessReportBuilder.SCHEMA,
            summary: PcbFabricationReadinessReportBuilder.#summary(
                pads,
                vias,
                items
            ),
            items,
            byCode: PcbFabricationReadinessReportBuilder.#byCode(items)
        }
    }

    /**
     * Resolves the PCB payload from a parser root or direct PCB model.
     * @param {object} input Parser root or PCB model.
     * @returns {object}
     */
    static #pcb(input) {
        return input?.pcb || input || {}
    }

    /**
     * Builds fabrication review items for pads.
     * @param {object[]} pads Normalized pad rows.
     * @returns {object[]}
     */
    static #padItems(pads) {
        return (pads || []).flatMap((pad, index) => {
            const items = []

            if (
                PcbFabricationReadinessReportBuilder.#hasNonSimplePadMode(pad)
            ) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.non-simple-mode',
                        'info',
                        'pad',
                        index,
                        pad,
                        {
                            padMode: pad.padMode,
                            padModeName: pad.padModeName
                        }
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#hasPadOffset(pad)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.offset-center',
                        'warning',
                        'pad',
                        index,
                        pad,
                        {
                            offsets:
                                PcbFabricationReadinessReportBuilder.#padOffsets(
                                    pad
                                )
                        }
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#hasSlotHole(pad)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.slotted-hole',
                        'info',
                        'pad',
                        index,
                        pad,
                        {
                            holeGeometry: pad.holeGeometry || null,
                            holeSlotLength: pad.holeSlotLength
                        }
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#hasNonPlatedHole(pad)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.non-plated-hole',
                        'warning',
                        'pad',
                        index,
                        pad,
                        {}
                    )
                )
            }
            if (
                PcbFabricationReadinessReportBuilder.#hasMaskOverride(
                    pad,
                    'paste'
                )
            ) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.paste-mask-override',
                        'info',
                        'pad',
                        index,
                        pad,
                        {
                            expansion: pad.pasteMaskExpansion,
                            mode: pad.pasteMaskExpansionMode,
                            source: pad.pasteMaskExpansionSource
                        }
                    )
                )
            }
            if (
                PcbFabricationReadinessReportBuilder.#hasMaskOverride(
                    pad,
                    'solder'
                )
            ) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.solder-mask-override',
                        'info',
                        'pad',
                        index,
                        pad,
                        {
                            expansion: pad.solderMaskExpansion,
                            mode: pad.solderMaskExpansionMode,
                            source: pad.solderMaskExpansionSource
                        }
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#hasThermalRelief(pad)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.pad.thermal-relief',
                        'info',
                        'pad',
                        index,
                        pad,
                        PcbFabricationReadinessReportBuilder.#thermalDetails(
                            pad
                        )
                    )
                )
            }

            return items
        })
    }

    /**
     * Builds fabrication review items for vias.
     * @param {object[]} vias Normalized via rows.
     * @returns {object[]}
     */
    static #viaItems(vias) {
        return (vias || []).flatMap((via, index) => {
            const items = []

            if (PcbFabricationReadinessReportBuilder.#hasViaSpan(via)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.via.layer-span',
                        'warning',
                        'via',
                        index,
                        via,
                        {
                            drillLayerPairType: via.drillLayerPairType,
                            diameterByLayer: via.diameterByLayer || [],
                            externalStackEntries: via.externalStackEntries || []
                        }
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#hasViaProtection(via)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.via.protected-hole',
                        'info',
                        'via',
                        index,
                        via,
                        {
                            ipc4761Type:
                                via.ipc4761Type ??
                                via.viaProtection?.ipc4761Type,
                            structureType: via.viaProtection?.structureType
                        }
                    )
                )
            }
            if (
                PcbFabricationReadinessReportBuilder.#hasMaskOverride(
                    via,
                    'solder'
                )
            ) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.via.solder-mask-override',
                        'info',
                        'via',
                        index,
                        via,
                        {
                            expansion: via.solderMaskExpansion,
                            mode: via.solderMaskExpansionMode,
                            fromHoleEdge: via.solderMaskExpansionFromHoleEdge
                        }
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#hasThermalRelief(via)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.via.thermal-relief',
                        'info',
                        'via',
                        index,
                        via,
                        PcbFabricationReadinessReportBuilder.#thermalDetails(
                            via
                        )
                    )
                )
            }
            if (PcbFabricationReadinessReportBuilder.#isMicroviaLike(via)) {
                items.push(
                    PcbFabricationReadinessReportBuilder.#item(
                        'pcb.fabrication.via.microvia-like',
                        'warning',
                        'via',
                        index,
                        via,
                        {
                            diameter: via.diameter,
                            holeDiameter: via.holeDiameter,
                            drillLayerPairType: via.drillLayerPairType
                        }
                    )
                )
            }

            return items
        })
    }

    /**
     * Builds the deterministic report summary.
     * @param {object[]} pads Normalized pad rows.
     * @param {object[]} vias Normalized via rows.
     * @param {object[]} items Review items.
     * @returns {object}
     */
    static #summary(pads, vias, items) {
        return {
            padCount: pads.length,
            viaCount: vias.length,
            reviewItemCount: items.length,
            nonSimplePadModeCount:
                PcbFabricationReadinessReportBuilder.#countCode(
                    items,
                    'pcb.fabrication.pad.non-simple-mode'
                ),
            offsetPadCount: PcbFabricationReadinessReportBuilder.#countCode(
                items,
                'pcb.fabrication.pad.offset-center'
            ),
            slottedHoleCount: PcbFabricationReadinessReportBuilder.#countCode(
                items,
                'pcb.fabrication.pad.slotted-hole'
            ),
            nonPlatedHoleCount: PcbFabricationReadinessReportBuilder.#countCode(
                items,
                'pcb.fabrication.pad.non-plated-hole'
            ),
            pasteOverrideCount:
                PcbFabricationReadinessReportBuilder.#countSuffix(
                    items,
                    '.paste-mask-override'
                ),
            maskOverrideCount:
                PcbFabricationReadinessReportBuilder.#countSuffix(
                    items,
                    '.solder-mask-override'
                ),
            thermalReliefCount:
                PcbFabricationReadinessReportBuilder.#countSuffix(
                    items,
                    '.thermal-relief'
                ),
            viaSpanCount: PcbFabricationReadinessReportBuilder.#countCode(
                items,
                'pcb.fabrication.via.layer-span'
            ),
            protectedViaCount: PcbFabricationReadinessReportBuilder.#countCode(
                items,
                'pcb.fabrication.via.protected-hole'
            ),
            microviaLikeCount: PcbFabricationReadinessReportBuilder.#countCode(
                items,
                'pcb.fabrication.via.microvia-like'
            )
        }
    }

    /**
     * Builds one normalized review item.
     * @param {string} code Stable issue code.
     * @param {'info' | 'warning'} severity Issue severity.
     * @param {'pad' | 'via'} ownerKind Primitive kind.
     * @param {number} index Primitive index.
     * @param {object} owner Primitive row.
     * @param {object} details Additional issue details.
     * @returns {object}
     */
    static #item(code, severity, ownerKind, index, owner, details) {
        return PcbFabricationReadinessReportBuilder.#stripEmpty({
            code,
            severity,
            ownerKind,
            ownerKey: ownerKind + '-' + index,
            index,
            designator: owner?.designator,
            netName: owner?.netName,
            layerId: owner?.layerId,
            ...details
        })
    }

    /**
     * Checks whether a pad uses a non-simple local stack mode.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasNonSimplePadMode(pad) {
        const modeName = String(pad?.padModeName || '').trim()
        if (modeName) {
            return modeName !== 'simple'
        }

        const mode = Number(pad?.padMode)
        return Number.isFinite(mode) && mode !== 0
    }

    /**
     * Checks whether a pad has non-zero per-layer center offsets.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasPadOffset(pad) {
        return PcbFabricationReadinessReportBuilder.#padOffsets(pad).length > 0
    }

    /**
     * Collects non-zero pad offsets from local-stack or extension metadata.
     * @param {object} pad Pad row.
     * @returns {object[]}
     */
    static #padOffsets(pad) {
        const offsets = []

        for (const layer of pad?.localStack?.layers || []) {
            const offsetX = Number(layer?.offsetX || 0)
            const offsetY = Number(layer?.offsetY || 0)
            if (offsetX || offsetY) {
                offsets.push(
                    PcbFabricationReadinessReportBuilder.#stripEmpty({
                        layerKey: layer.layerKey,
                        role: layer.role,
                        offsetX,
                        offsetY
                    })
                )
            }
        }
        for (const offset of pad?.layerOffsets || []) {
            const offsetX = Number(offset?.x || offset?.offsetX || 0)
            const offsetY = Number(offset?.y || offset?.offsetY || 0)
            if (offsetX || offsetY) {
                offsets.push(
                    PcbFabricationReadinessReportBuilder.#stripEmpty({
                        layerNumber: offset.layerNumber,
                        layerKey: offset.layerKey,
                        offsetX,
                        offsetY
                    })
                )
            }
        }
        for (const keyPair of [
            ['offsetTopX', 'offsetTopY'],
            ['offsetMidX', 'offsetMidY'],
            ['offsetBottomX', 'offsetBottomY']
        ]) {
            const offsetX = Number(pad?.[keyPair[0]] || 0)
            const offsetY = Number(pad?.[keyPair[1]] || 0)
            if (offsetX || offsetY) {
                offsets.push({
                    field: keyPair[0].replace(/X$/u, ''),
                    offsetX,
                    offsetY
                })
            }
        }

        return offsets
    }

    /**
     * Checks whether a pad has slot-hole geometry.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasSlotHole(pad) {
        return (
            pad?.holeGeometry?.shapeName === 'slot' ||
            pad?.holeShapeName === 'slot' ||
            Number(pad?.holeShape) === 2 ||
            Number(pad?.holeSlotLength || 0) > Number(pad?.holeDiameter || 0)
        )
    }

    /**
     * Checks whether a pad has a non-plated drilled hole.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasNonPlatedHole(pad) {
        const hasHole =
            Number(pad?.holeDiameter || 0) > 0 ||
            PcbFabricationReadinessReportBuilder.#hasSlotHole(pad)

        return hasHole && pad?.isPlated === false
    }

    /**
     * Checks whether a primitive has a manual mask expansion override.
     * @param {object} primitive Primitive row.
     * @param {'paste' | 'solder'} kind Mask kind.
     * @returns {boolean}
     */
    static #hasMaskOverride(primitive, kind) {
        const prefix = kind === 'paste' ? 'paste' : 'solder'
        const source = String(
            primitive?.[prefix + 'MaskExpansionSource'] || ''
        ).trim()
        const mode = Number(primitive?.[prefix + 'MaskExpansionMode'])
        const expansion = Number(primitive?.[prefix + 'MaskExpansion'])

        return (
            source === 'manual' ||
            mode === 2 ||
            (!Number.isNaN(expansion) && expansion !== 0 && !source)
        )
    }

    /**
     * Checks whether a pad or via has thermal-relief metadata.
     * @param {object} primitive Primitive row.
     * @returns {boolean}
     */
    static #hasThermalRelief(primitive) {
        return [
            'thermalReliefAirGap',
            'thermalReliefConductorWidth',
            'thermalReliefConductorCount',
            'powerPlaneReliefExpansion'
        ].some((key) => Number(primitive?.[key] || 0) !== 0)
    }

    /**
     * Builds compact thermal-relief details.
     * @param {object} primitive Primitive row.
     * @returns {object}
     */
    static #thermalDetails(primitive) {
        return PcbFabricationReadinessReportBuilder.#stripEmpty({
            planeConnectionStyle: primitive?.planeConnectionStyle,
            thermalReliefAirGap: primitive?.thermalReliefAirGap,
            thermalReliefConductorWidth: primitive?.thermalReliefConductorWidth,
            thermalReliefConductorCount: primitive?.thermalReliefConductorCount,
            powerPlaneReliefExpansion: primitive?.powerPlaneReliefExpansion
        })
    }

    /**
     * Checks whether a via carries non-default layer-span metadata.
     * @param {object} via Via row.
     * @returns {boolean}
     */
    static #hasViaSpan(via) {
        return (
            Number(via?.drillLayerPairType || 0) !== 0 ||
            (Array.isArray(via?.diameterByLayer) &&
                via.diameterByLayer.length > 0) ||
            (Array.isArray(via?.externalStackEntries) &&
                via.externalStackEntries.length > 0)
        )
    }

    /**
     * Checks whether a via has protection or filled/capped metadata.
     * @param {object} via Via row.
     * @returns {boolean}
     */
    static #hasViaProtection(via) {
        return (
            via?.viaProtection !== undefined ||
            via?.ipc4761Type !== undefined ||
            via?.drill?.renderState === 'covered' ||
            via?.drill?.renderState === 'filled' ||
            via?.drill?.renderState === 'capped'
        )
    }

    /**
     * Checks whether via geometry resembles a small layer-span microvia.
     * @param {object} via Via row.
     * @returns {boolean}
     */
    static #isMicroviaLike(via) {
        const holeDiameter = Number(via?.holeDiameter || 0)

        return (
            holeDiameter > 0 &&
            holeDiameter <= 6 &&
            PcbFabricationReadinessReportBuilder.#hasViaSpan(via)
        )
    }

    /**
     * Counts items with one exact issue code.
     * @param {object[]} items Review items.
     * @param {string} code Issue code.
     * @returns {number}
     */
    static #countCode(items, code) {
        return items.filter((item) => item.code === code).length
    }

    /**
     * Counts items whose code ends with a suffix.
     * @param {object[]} items Review items.
     * @param {string} suffix Issue-code suffix.
     * @returns {number}
     */
    static #countSuffix(items, suffix) {
        return items.filter((item) => item.code.endsWith(suffix)).length
    }

    /**
     * Builds code counters for report consumers.
     * @param {object[]} items Review items.
     * @returns {object[]}
     */
    static #byCode(items) {
        const counts = new Map()

        for (const item of items) {
            counts.set(item.code, Number(counts.get(item.code) || 0) + 1)
        }

        return [...counts.entries()].map(([code, count]) => ({ code, count }))
    }

    /**
     * Removes empty fields while preserving zeros and false.
     * @param {Record<string, unknown>} row Input row.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(row) {
        return Object.fromEntries(
            Object.entries(row || {}).filter(([, value]) => {
                if (Array.isArray(value)) return value.length > 0
                return value !== undefined && value !== null && value !== ''
            })
        )
    }
}
