// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Groups PCB primitives by native Altium component ownership indexes.
 */
export class PcbComponentPrimitiveIndexer {
    /**
     * Groups normalized primitives by their native component index.
     * @param {{ componentIndex: number, designator: string }[]} components
     * @param {{ fills?: object[], tracks?: object[], arcs?: object[], vias?: object[], pads?: object[], regions?: object[], shapeBasedRegions?: object[], texts?: object[] }} pcb
     * @param {{ componentIndex?: number | null }[]} componentBodies
     * @returns {{ componentIndex: number, designator: string, pads: object[], tracks: object[], arcs: object[], fills: object[], vias: object[], regions: object[], shapeBasedRegions: object[], texts: object[], componentBodies: object[] }[]}
     */
    static buildGroups(components, pcb, componentBodies) {
        const primitiveGroups =
            PcbComponentPrimitiveIndexer.#primitiveGroupsByComponent(
                pcb,
                componentBodies
            )

        return (components || []).map((component) => {
            const componentIndex = Number(component.componentIndex)

            return {
                componentIndex,
                designator: component.designator,
                pads: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.pads,
                    componentIndex
                ),
                tracks: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.tracks,
                    componentIndex
                ),
                arcs: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.arcs,
                    componentIndex
                ),
                fills: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.fills,
                    componentIndex
                ),
                vias: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.vias,
                    componentIndex
                ),
                regions: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.regions,
                    componentIndex
                ),
                shapeBasedRegions:
                    PcbComponentPrimitiveIndexer.#groupForComponent(
                        primitiveGroups.shapeBasedRegions,
                        componentIndex
                    ),
                texts: PcbComponentPrimitiveIndexer.#groupForComponent(
                    primitiveGroups.texts,
                    componentIndex
                ),
                componentBodies:
                    PcbComponentPrimitiveIndexer.#groupForComponent(
                        primitiveGroups.componentBodies,
                        componentIndex
                    )
            }
        })
    }

    /**
     * Indexes component primitive groups by their native component index.
     * @param {{ componentIndex: number, designator: string, pads: object[], tracks: object[], arcs: object[], fills: object[], vias: object[], regions: object[], shapeBasedRegions: object[], texts: object[], componentBodies: object[] }[]} componentPrimitiveGroups
     * @returns {({ componentIndex: number, designator: string, pads: object[], tracks: object[], arcs: object[], fills: object[], vias: object[], regions: object[], shapeBasedRegions: object[], texts: object[], componentBodies: object[] } | null)[]}
     */
    static indexGroups(componentPrimitiveGroups) {
        const indexedGroups = []

        for (const group of componentPrimitiveGroups || []) {
            const componentIndex = Number(group.componentIndex)

            if (!Number.isInteger(componentIndex) || componentIndex < 0) {
                continue
            }

            while (indexedGroups.length <= componentIndex) {
                indexedGroups.push(null)
            }

            indexedGroups[componentIndex] = group
        }

        return indexedGroups
    }

    /**
     * Builds primitive maps by native component ownership index.
     * @param {{ fills?: object[], tracks?: object[], arcs?: object[], vias?: object[], pads?: object[], regions?: object[], shapeBasedRegions?: object[], texts?: object[] }} pcb
     * @param {{ componentIndex?: number | null }[]} componentBodies
     * @returns {{ pads: Map<number, object[]>, tracks: Map<number, object[]>, arcs: Map<number, object[]>, fills: Map<number, object[]>, vias: Map<number, object[]>, regions: Map<number, object[]>, shapeBasedRegions: Map<number, object[]>, texts: Map<number, object[]>, componentBodies: Map<number, object[]> }}
     */
    static #primitiveGroupsByComponent(pcb, componentBodies) {
        return {
            pads: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.pads
            ),
            tracks: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.tracks
            ),
            arcs: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.arcs
            ),
            fills: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.fills
            ),
            vias: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.vias
            ),
            regions: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.regions
            ),
            shapeBasedRegions:
                PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                    pcb?.shapeBasedRegions
                ),
            texts: PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                pcb?.texts,
                'ownerIndex'
            ),
            componentBodies:
                PcbComponentPrimitiveIndexer.#groupPrimitivesByIndex(
                    componentBodies
                )
        }
    }

    /**
     * Groups primitives by one numeric owner-index field.
     * @param {object[] | undefined} primitives Source primitives.
     * @param {string} key Owner-index field name.
     * @returns {Map<number, object[]>}
     */
    static #groupPrimitivesByIndex(primitives, key = 'componentIndex') {
        const groupedPrimitives = new Map()

        for (const primitive of primitives || []) {
            const componentIndex = PcbComponentPrimitiveIndexer.#optionalIndex(
                primitive?.[key]
            )
            if (componentIndex === null) continue
            if (!groupedPrimitives.has(componentIndex)) {
                groupedPrimitives.set(componentIndex, [])
            }
            groupedPrimitives.get(componentIndex).push(primitive)
        }

        return groupedPrimitives
    }

    /**
     * Returns primitives linked to one component index.
     * @param {Map<number, object[]>} groupedPrimitives Grouped primitives.
     * @param {number} componentIndex Component index.
     * @returns {object[]}
     */
    static #groupForComponent(groupedPrimitives, componentIndex) {
        return groupedPrimitives.get(componentIndex) || []
    }

    /**
     * Parses one optional component owner index.
     * @param {unknown} value Candidate index value.
     * @returns {number | null}
     */
    static #optionalIndex(value) {
        if (value === null || value === undefined || value === '') return null
        const index = Number(value)
        return Number.isFinite(index) ? index : null
    }
}
