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
        return (components || []).map((component) => {
            const componentIndex = Number(component.componentIndex)

            return {
                componentIndex,
                designator: component.designator,
                pads: PcbComponentPrimitiveIndexer.#primitivesForComponent(
                    pcb.pads,
                    componentIndex
                ),
                tracks: PcbComponentPrimitiveIndexer.#primitivesForComponent(
                    pcb.tracks,
                    componentIndex
                ),
                arcs: PcbComponentPrimitiveIndexer.#primitivesForComponent(
                    pcb.arcs,
                    componentIndex
                ),
                fills: PcbComponentPrimitiveIndexer.#primitivesForComponent(
                    pcb.fills,
                    componentIndex
                ),
                vias: PcbComponentPrimitiveIndexer.#primitivesForComponent(
                    pcb.vias,
                    componentIndex
                ),
                regions: PcbComponentPrimitiveIndexer.#primitivesForComponent(
                    pcb.regions,
                    componentIndex
                ),
                shapeBasedRegions:
                    PcbComponentPrimitiveIndexer.#primitivesForComponent(
                        pcb.shapeBasedRegions,
                        componentIndex
                    ),
                texts: (pcb.texts || []).filter(
                    (text) => Number(text?.ownerIndex) === componentIndex
                ),
                componentBodies:
                    PcbComponentPrimitiveIndexer.#primitivesForComponent(
                        componentBodies,
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
     * Returns primitives linked to a component by native Altium index.
     * @param {{ componentIndex?: number | null }[] | undefined} primitives
     * @param {number} componentIndex
     * @returns {object[]}
     */
    static #primitivesForComponent(primitives, componentIndex) {
        return (primitives || []).filter((primitive) => {
            const rawComponentIndex = primitive?.componentIndex
            if (
                rawComponentIndex === null ||
                rawComponentIndex === undefined ||
                rawComponentIndex === ''
            ) {
                return false
            }

            return Number(rawComponentIndex) === componentIndex
        })
    }
}
