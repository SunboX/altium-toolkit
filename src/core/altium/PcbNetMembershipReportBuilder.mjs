// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic per-net primitive ownership summaries for PCB models.
 */
export class PcbNetMembershipReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.net-membership.a1'

    /**
     * Builds a PCB net-membership report from normalized PCB primitives.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static build(pcb = {}) {
        const declaredNetNames =
            PcbNetMembershipReportBuilder.#declaredNetNames(pcb)
        const rowsByNet = new Map()
        const unownedPrimitives = []
        let primitiveCount = 0

        for (const family of PcbNetMembershipReportBuilder.#families()) {
            const rows = Array.isArray(pcb?.[family]) ? pcb[family] : []
            primitiveCount += rows.length

            rows.forEach((primitive, index) => {
                const row = PcbNetMembershipReportBuilder.#primitiveRow(
                    family,
                    primitive,
                    index
                )

                if (!row.netName) {
                    unownedPrimitives.push(
                        PcbNetMembershipReportBuilder.#stripEmpty({
                            primitiveKey: row.primitiveKey,
                            family,
                            index,
                            layerId: row.layerId
                        })
                    )
                    return
                }

                if (!rowsByNet.has(row.netName)) {
                    rowsByNet.set(row.netName, [])
                }
                rowsByNet.get(row.netName).push(row)
            })
        }

        const observedNetNames = new Set(rowsByNet.keys())
        const byNet = [...rowsByNet.entries()]
            .map(([netName, rows]) =>
                PcbNetMembershipReportBuilder.#netRow(
                    netName,
                    rows,
                    declaredNetNames.has(netName)
                )
            )
            .sort((left, right) =>
                PcbNetMembershipReportBuilder.#naturalCompare(
                    left.netName,
                    right.netName
                )
            )
        const emptyDeclaredNets = [...declaredNetNames]
            .filter((netName) => !observedNetNames.has(netName))
            .sort(PcbNetMembershipReportBuilder.#naturalCompare)
        const undeclaredNets = [...observedNetNames]
            .filter((netName) => !declaredNetNames.has(netName))
            .sort(PcbNetMembershipReportBuilder.#naturalCompare)
        const possibleUnroutedNets = byNet
            .filter(
                (net) =>
                    net.declared &&
                    net.padCount >= 2 &&
                    net.trackCount + net.arcCount + net.viaCount === 0
            )
            .map((net) => net.netName)

        return {
            schema: PcbNetMembershipReportBuilder.SCHEMA,
            summary: {
                declaredNetCount: declaredNetNames.size,
                observedNetCount: observedNetNames.size,
                matchedNetCount: [...observedNetNames].filter((netName) =>
                    declaredNetNames.has(netName)
                ).length,
                undeclaredNetCount: undeclaredNets.length,
                emptyDeclaredNetCount: emptyDeclaredNets.length,
                netCount: new Set([...declaredNetNames, ...observedNetNames])
                    .size,
                primitiveCount,
                ownedPrimitiveCount: primitiveCount - unownedPrimitives.length,
                unownedPrimitiveCount: unownedPrimitives.length,
                possibleUnroutedNetCount: possibleUnroutedNets.length
            },
            byNet,
            emptyDeclaredNets,
            undeclaredNets,
            possibleUnroutedNets,
            unownedPrimitives
        }
    }

    /**
     * Returns primitive families that can carry net ownership.
     * @returns {string[]}
     */
    static #families() {
        return [
            'pads',
            'tracks',
            'arcs',
            'vias',
            'fills',
            'regions',
            'shapeBasedRegions',
            'polygons'
        ]
    }

    /**
     * Collects declared net names from the normalized net table.
     * @param {object} pcb Normalized PCB model.
     * @returns {Set<string>}
     */
    static #declaredNetNames(pcb) {
        return new Set(
            (Array.isArray(pcb?.nets) ? pcb.nets : [])
                .map((net) => String(net?.name || '').trim())
                .filter(Boolean)
        )
    }

    /**
     * Builds one normalized primitive membership row.
     * @param {string} family Primitive family name.
     * @param {object} primitive Primitive row.
     * @param {number} index Primitive index within its family.
     * @returns {object}
     */
    static #primitiveRow(family, primitive, index) {
        return PcbNetMembershipReportBuilder.#stripEmpty({
            primitiveKey: family + '-' + index,
            family,
            index,
            netName: PcbNetMembershipReportBuilder.#netName(primitive),
            layerId: PcbNetMembershipReportBuilder.#layerId(primitive),
            padDesignator:
                family === 'pads'
                    ? PcbNetMembershipReportBuilder.#padDesignator(primitive)
                    : undefined
        })
    }

    /**
     * Builds one per-net aggregate row.
     * @param {string} netName Net name.
     * @param {object[]} rows Primitive rows owned by the net.
     * @param {boolean} declared Whether the net is declared in the net table.
     * @returns {object}
     */
    static #netRow(netName, rows, declared) {
        const counts = Object.fromEntries(
            PcbNetMembershipReportBuilder.#families().map((family) => [
                family,
                0
            ])
        )
        const layerIds = new Set()
        const padDesignators = new Set()
        const memberKeys = []

        for (const row of rows) {
            counts[row.family] = Number(counts[row.family] || 0) + 1
            memberKeys.push(row.primitiveKey)
            if (Number.isInteger(row.layerId)) {
                layerIds.add(row.layerId)
            }
            if (row.padDesignator) {
                padDesignators.add(row.padDesignator)
            }
        }

        return {
            netName,
            declared,
            totalPrimitiveCount: rows.length,
            padCount: counts.pads,
            trackCount: counts.tracks,
            arcCount: counts.arcs,
            viaCount: counts.vias,
            fillCount: counts.fills,
            regionCount: counts.regions,
            shapeBasedRegionCount: counts.shapeBasedRegions,
            polygonCount: counts.polygons,
            layers: [...layerIds].sort((left, right) => left - right),
            padDesignators: [...padDesignators].sort(
                PcbNetMembershipReportBuilder.#naturalCompare
            ),
            memberKeys
        }
    }

    /**
     * Resolves a primitive net name from normalized field spellings.
     * @param {object} primitive Primitive row.
     * @returns {string}
     */
    static #netName(primitive) {
        return String(
            primitive?.netName || primitive?.net || primitive?.netLabel || ''
        ).trim()
    }

    /**
     * Resolves a primitive layer id from normalized field spellings.
     * @param {object} primitive Primitive row.
     * @returns {number | undefined}
     */
    static #layerId(primitive) {
        for (const key of ['layerId', 'layerCode', 'id', 'index']) {
            const number = Number(primitive?.[key])
            if (Number.isInteger(number)) {
                return number
            }
        }

        return undefined
    }

    /**
     * Resolves a pad designator from normalized field spellings.
     * @param {object} pad Pad row.
     * @returns {string}
     */
    static #padDesignator(pad) {
        return String(
            pad?.designator || pad?.padNumber || pad?.pinName || pad?.name || ''
        ).trim()
    }

    /**
     * Sorts strings with numeric chunks in human order.
     * @param {string} left Left value.
     * @param {string} right Right value.
     * @returns {number}
     */
    static #naturalCompare(left, right) {
        return String(left).localeCompare(String(right), undefined, {
            numeric: true
        })
    }

    /**
     * Removes undefined and blank-string values from a shallow object.
     * @param {Record<string, unknown>} row Input row.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(row) {
        return Object.fromEntries(
            Object.entries(row).filter(
                ([, value]) => value !== undefined && value !== ''
            )
        )
    }
}
