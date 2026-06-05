// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic PCB QA and statistics summaries.
 */
export class PcbStatisticsBuilder {
    /**
     * Builds statistics for one normalized PCB object.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static build(pcb) {
        return {
            schema: 'altium-toolkit.pcb.statistics.a1',
            units: {
                coordinate: 'mil',
                length: 'mil',
                board: 'mil',
                drill: 'mil',
                thickness: 'mil',
                copperWeight: 'oz',
                angle: 'deg'
            },
            board: PcbStatisticsBuilder.#boardStats(pcb?.boardOutline || {}),
            drills: PcbStatisticsBuilder.#drillStats(
                pcb?.pads || [],
                pcb?.vias || []
            ),
            primitiveWidths: PcbStatisticsBuilder.#primitiveWidthStats(pcb),
            layers: PcbStatisticsBuilder.#layerStats(pcb),
            planning: PcbStatisticsBuilder.#planningStats(pcb)
        }
    }

    /**
     * Builds board outline statistics.
     * @param {object} boardOutline Board outline object.
     * @returns {object}
     */
    static #boardStats(boardOutline) {
        const widthMil = PcbStatisticsBuilder.#round(boardOutline.widthMil)
        const heightMil = PcbStatisticsBuilder.#round(boardOutline.heightMil)
        const minX = Number(boardOutline.minX || 0)
        const minY = Number(boardOutline.minY || 0)

        return {
            widthMil,
            heightMil,
            centroidMil: {
                x: PcbStatisticsBuilder.#round(minX + widthMil / 2),
                y: PcbStatisticsBuilder.#round(minY + heightMil / 2)
            },
            outlineSegmentCount: Array.isArray(boardOutline.segments)
                ? boardOutline.segments.length
                : 0,
            cutoutCount: Array.isArray(boardOutline.cutouts)
                ? boardOutline.cutouts.length
                : 0
        }
    }

    /**
     * Builds drill and slot counters.
     * @param {object[]} pads Pad primitives.
     * @param {object[]} vias Via primitives.
     * @returns {object}
     */
    static #drillStats(pads, vias) {
        const padHoles = (pads || []).filter((pad) =>
            PcbStatisticsBuilder.#hasHole(pad)
        )
        const viaHoles = (vias || []).filter((via) =>
            PcbStatisticsBuilder.#hasHole(via)
        )
        const holes = [...padHoles, ...viaHoles]

        return {
            totalHoleCount: holes.length,
            padHoleCount: padHoles.length,
            viaHoleCount: viaHoles.length,
            platedHoleCount: holes.filter((hole) => hole.isPlated !== false)
                .length,
            nonPlatedHoleCount: holes.filter((hole) => hole.isPlated === false)
                .length,
            slotCount: holes.filter((hole) =>
                PcbStatisticsBuilder.#hasSlot(hole)
            ).length,
            holeDiameterMil: PcbStatisticsBuilder.#histogram(
                holes.map((hole) => hole.holeDiameter)
            ),
            slotLengthMil: PcbStatisticsBuilder.#histogram(
                holes
                    .filter((hole) => PcbStatisticsBuilder.#hasSlot(hole))
                    .map((hole) => hole.holeSlotLength || hole.slotLength)
            )
        }
    }

    /**
     * Builds primitive-width histograms.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static #primitiveWidthStats(pcb) {
        return {
            tracksMil: PcbStatisticsBuilder.#histogram(
                (pcb?.tracks || []).map((track) => track.width)
            ),
            arcsMil: PcbStatisticsBuilder.#histogram(
                (pcb?.arcs || []).map((arc) => arc.width)
            ),
            viasMil: PcbStatisticsBuilder.#histogram(
                (pcb?.vias || []).map((via) => via.diameter)
            ),
            padsTopXMil: PcbStatisticsBuilder.#histogram(
                (pcb?.pads || []).map((pad) => pad.sizeTopX)
            )
        }
    }

    /**
     * Builds a layer-stack and per-layer primitive summary.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static #layerStats(pcb) {
        const layerIds = PcbStatisticsBuilder.#collectLayerIds(pcb)
        const entries = layerIds.map((layerId) => {
            const layer = PcbStatisticsBuilder.#findLayer(pcb, layerId)

            return PcbStatisticsBuilder.#stripUndefined({
                layerId,
                name:
                    layer?.name ||
                    PcbStatisticsBuilder.#primitiveLayerName(pcb, layerId) ||
                    'L' + layerId,
                role: PcbStatisticsBuilder.#layerRole(layer),
                material: layer?.material,
                thicknessMil: PcbStatisticsBuilder.#optionalRound(
                    layer?.thicknessMil
                ),
                copperThicknessMil: PcbStatisticsBuilder.#optionalRound(
                    layer?.copperThicknessMil
                ),
                copperWeight: layer?.copperWeight,
                dielectricConstant: PcbStatisticsBuilder.#optionalRound(
                    layer?.dielectricConstant
                ),
                dissipationFactor: PcbStatisticsBuilder.#optionalRound(
                    layer?.dissipationFactor
                ),
                primitiveCounts: PcbStatisticsBuilder.#primitiveCountsForLayer(
                    pcb,
                    layerId
                )
            })
        })

        return {
            count: entries.length,
            summary: PcbStatisticsBuilder.#layerMaterialSummary(
                pcb?.layers || []
            ),
            entries
        }
    }

    /**
     * Builds board-planning statistics for keepouts, rooms, and rigid-flex regions.
     * @param {object} pcb Normalized PCB model.
     * @returns {{ keepouts: object, rooms: object, boardRegions: object }}
     */
    static #planningStats(pcb) {
        const regions = pcb?.regions || []
        const shapeBasedRegions = pcb?.shapeBasedRegions || []
        const boardRegions = pcb?.boardRegions || []
        const roomNames = PcbStatisticsBuilder.#collectRoomNames(
            pcb?.rules || []
        )

        return {
            keepouts: {
                totalCount:
                    PcbStatisticsBuilder.#keepoutCount(regions) +
                    PcbStatisticsBuilder.#keepoutCount(shapeBasedRegions) +
                    PcbStatisticsBuilder.#keepoutCount(boardRegions),
                regionCount: PcbStatisticsBuilder.#keepoutCount(regions),
                shapeBasedRegionCount:
                    PcbStatisticsBuilder.#keepoutCount(shapeBasedRegions),
                boardRegionCount:
                    PcbStatisticsBuilder.#keepoutCount(boardRegions)
            },
            rooms: {
                ruleCount: PcbStatisticsBuilder.#roomRuleCount(
                    pcb?.rules || []
                ),
                namedRoomCount: roomNames.length,
                names: roomNames
            },
            boardRegions: {
                boardRegionCount: boardRegions.length,
                flexRegionCount: boardRegions.filter(
                    (region) => region?.isFlexRegion === true
                ).length,
                rigidRegionCount: boardRegions.filter(
                    (region) => region?.isRigidRegion === true
                ).length,
                locked3dCount: boardRegions.filter(
                    (region) => region?.locked3d === true
                ).length,
                bendingLineCount: boardRegions.reduce(
                    (total, region) =>
                        total + Number(region?.bendingLineCount || 0),
                    0
                ),
                layerStacks:
                    PcbStatisticsBuilder.#boardRegionLayerStacks(boardRegions)
            }
        }
    }

    /**
     * Counts primitives marked as keepouts.
     * @param {object[]} regions Region-like primitives.
     * @returns {number}
     */
    static #keepoutCount(regions) {
        return (regions || []).filter((region) => region?.isKeepout === true)
            .length
    }

    /**
     * Counts room-related design rules.
     * @param {object[]} rules Parsed design rules.
     * @returns {number}
     */
    static #roomRuleCount(rules) {
        return (rules || []).filter((rule) =>
            PcbStatisticsBuilder.#isRoomRule(rule)
        ).length
    }

    /**
     * Returns true when a rule references a placement room.
     * @param {object} rule Parsed design rule.
     * @returns {boolean}
     */
    static #isRoomRule(rule) {
        const fields = [
            rule?.ruleKind,
            rule?.ruleType?.kind,
            rule?.ruleType?.displayName,
            rule?.scope1Expression,
            rule?.scope2Expression
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

        return fields.includes('room')
    }

    /**
     * Collects named placement rooms from rule scopes.
     * @param {object[]} rules Parsed design rules.
     * @returns {string[]}
     */
    static #collectRoomNames(rules) {
        const names = new Set()

        for (const rule of rules || []) {
            for (const scope of [rule?.scope1, rule?.scope2]) {
                if (scope?.predicate !== 'WithinRoom') {
                    continue
                }

                for (const roomName of scope.arguments || []) {
                    const normalized = String(roomName || '').trim()
                    if (normalized) {
                        names.add(normalized)
                    }
                }
            }
        }

        return [...names].sort((left, right) => left.localeCompare(right))
    }

    /**
     * Builds a histogram of board-region layer-stack identities.
     * @param {object[]} boardRegions Parsed board-region primitives.
     * @returns {Record<string, number>}
     */
    static #boardRegionLayerStacks(boardRegions) {
        const histogram = {}

        for (const region of boardRegions || []) {
            const layerStack = String(
                region?.substackName || region?.layerStackId || ''
            ).trim()
            if (!layerStack) {
                continue
            }

            histogram[layerStack] = (histogram[layerStack] || 0) + 1
        }

        return histogram
    }

    /**
     * Collects layer ids mentioned by stack entries or primitives.
     * @param {object} pcb Normalized PCB model.
     * @returns {number[]}
     */
    static #collectLayerIds(pcb) {
        const layerIds = new Set()

        for (const layer of pcb?.layers || []) {
            if (Number.isInteger(layer.layerId)) {
                layerIds.add(layer.layerId)
            }
        }

        for (const family of PcbStatisticsBuilder.#primitiveFamilies()) {
            for (const primitive of pcb?.[family] || []) {
                if (Number.isInteger(primitive?.layerId)) {
                    layerIds.add(primitive.layerId)
                }
            }
        }

        return [...layerIds].sort((left, right) => left - right)
    }

    /**
     * Counts primitives on one layer.
     * @param {object} pcb Normalized PCB model.
     * @param {number} layerId Numeric layer id.
     * @returns {Record<string, number>}
     */
    static #primitiveCountsForLayer(pcb, layerId) {
        return Object.fromEntries(
            PcbStatisticsBuilder.#primitiveFamilies().map((family) => [
                family,
                (pcb?.[family] || []).filter(
                    (primitive) => primitive?.layerId === layerId
                ).length
            ])
        )
    }

    /**
     * Returns primitive families included in layer summaries.
     * @returns {string[]}
     */
    static #primitiveFamilies() {
        return [
            'tracks',
            'arcs',
            'vias',
            'pads',
            'fills',
            'texts',
            'regions',
            'shapeBasedRegions'
        ]
    }

    /**
     * Finds a layer-stack entry by id.
     * @param {object} pcb Normalized PCB model.
     * @param {number} layerId Numeric layer id.
     * @returns {object | null}
     */
    static #findLayer(pcb, layerId) {
        return (
            (pcb?.layers || []).find((layer) => layer?.layerId === layerId) ||
            null
        )
    }

    /**
     * Finds a primitive-layer display name by id.
     * @param {object} pcb Normalized PCB model.
     * @param {number} layerId Numeric layer id.
     * @returns {string}
     */
    static #primitiveLayerName(pcb, layerId) {
        return String(
            (pcb?.primitiveLayers || []).find(
                (layer) => layer?.layerId === layerId
            )?.name || ''
        )
    }

    /**
     * Resolves a compact layer role.
     * @param {object | null} layer Layer-stack entry.
     * @returns {string}
     */
    static #layerRole(layer) {
        const name = String(layer?.name || '').toLowerCase()
        const kind = String(layer?.kind || layer?.role || '').toLowerCase()

        if (kind.includes('dielectric')) return 'dielectric'
        if (name.includes('mask')) return 'mask'
        if (name.includes('paste')) return 'paste'
        if (name.includes('silk') || name.includes('overlay')) return 'overlay'
        if (name.includes('mechanical')) return 'mechanical'

        return 'signal'
    }

    /**
     * Builds aggregate layer-stack material and role statistics.
     * @param {object[]} layers Layer-stack entries.
     * @returns {object}
     */
    static #layerMaterialSummary(layers) {
        const summary = {
            signalLayerCount: 0,
            dielectricLayerCount: 0,
            copperLayerCount: 0,
            dielectricThicknessMil: 0,
            materials: {}
        }

        for (const layer of layers || []) {
            const role = PcbStatisticsBuilder.#layerRole(layer)
            const material = String(layer?.material || '').trim()
            const kind = String(layer?.kind || '').toLowerCase()

            if (role === 'signal') {
                summary.signalLayerCount += 1
            }
            if (role === 'dielectric') {
                summary.dielectricLayerCount += 1
                summary.dielectricThicknessMil += Number(
                    layer?.thicknessMil || 0
                )
            }
            if (
                /copper/u.test(material.toLowerCase()) ||
                /copper/u.test(kind)
            ) {
                summary.copperLayerCount += 1
            }
            if (material) {
                summary.materials[material] =
                    (summary.materials[material] || 0) + 1
            }
        }

        summary.dielectricThicknessMil = PcbStatisticsBuilder.#round(
            summary.dielectricThicknessMil
        )

        return summary
    }

    /**
     * Returns true when a primitive has a drill.
     * @param {object} primitive Primitive object.
     * @returns {boolean}
     */
    static #hasHole(primitive) {
        return Number(primitive?.holeDiameter || 0) > 0
    }

    /**
     * Returns true when a drill is a slot.
     * @param {object} primitive Primitive object.
     * @returns {boolean}
     */
    static #hasSlot(primitive) {
        return (
            Number(primitive?.holeSlotLength || primitive?.slotLength || 0) >
                0 || Number(primitive?.holeShape || 0) === 2
        )
    }

    /**
     * Builds a numeric histogram from values.
     * @param {unknown[]} values Numeric values.
     * @returns {Record<string, number>}
     */
    static #histogram(values) {
        const histogram = {}

        for (const value of values || []) {
            const number = PcbStatisticsBuilder.#round(value)
            if (!Number.isFinite(number) || number === 0) {
                continue
            }

            histogram[String(number)] = (histogram[String(number)] || 0) + 1
        }

        return histogram
    }

    /**
     * Rounds numeric values for stable JSON output.
     * @param {unknown} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        const number = Number(value || 0)

        return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0
    }

    /**
     * Rounds a numeric value only when it is present and finite.
     * @param {unknown} value Candidate numeric value.
     * @returns {number | undefined}
     */
    static #optionalRound(value) {
        const number = Number(value)

        return Number.isFinite(number)
            ? Math.round(number * 1000) / 1000
            : undefined
    }

    /**
     * Removes undefined values from one statistics object.
     * @param {object} value Source object.
     * @returns {object}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }
}
