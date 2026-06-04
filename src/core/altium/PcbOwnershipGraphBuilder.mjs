// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a read-only PCB primitive ownership graph from normalized indexes.
 */
export class PcbOwnershipGraphBuilder {
    static SCHEMA_ID = 'altium-toolkit.pcb.ownership.a1'

    /**
     * Builds primitive owner groups keyed by component, net, and polygon index.
     * @param {{ components?: object[], nets?: object[], fills?: object[], tracks?: object[], arcs?: object[], vias?: object[], pads?: object[], regions?: object[], shapeBasedRegions?: object[], texts?: object[] }} pcb Normalized PCB model.
     * @returns {{ schema: string, primitiveOwners: object[], componentsByIndex: Record<string, object>, netsByIndex: Record<string, object>, polygonsByIndex: Record<string, object> }}
     */
    static build(pcb) {
        const componentNames = PcbOwnershipGraphBuilder.#componentNames(
            pcb?.components || []
        )
        const netNames = PcbOwnershipGraphBuilder.#netNames(pcb?.nets || [])
        const componentsByIndex =
            PcbOwnershipGraphBuilder.#initialComponentGroups(
                pcb?.components || []
            )
        const netsByIndex = {}
        const polygonsByIndex = {}
        const primitiveOwners = []

        for (const item of PcbOwnershipGraphBuilder.#primitiveItems(pcb)) {
            const owner = PcbOwnershipGraphBuilder.#primitiveOwner(
                item,
                componentNames,
                netNames
            )
            if (!owner) {
                continue
            }

            primitiveOwners.push(owner)
            PcbOwnershipGraphBuilder.#addGroupKey(
                componentsByIndex,
                owner.componentIndex,
                {
                    componentIndex: owner.componentIndex,
                    designator: owner.component || '',
                    primitiveKeys: []
                },
                owner.primitiveKey
            )
            PcbOwnershipGraphBuilder.#addGroupKey(
                netsByIndex,
                owner.netIndex,
                {
                    netIndex: owner.netIndex,
                    name: owner.net || '',
                    primitiveKeys: []
                },
                owner.primitiveKey
            )
            PcbOwnershipGraphBuilder.#addGroupKey(
                polygonsByIndex,
                owner.polygonIndex,
                {
                    polygonIndex: owner.polygonIndex,
                    primitiveKeys: []
                },
                owner.primitiveKey
            )
        }

        return {
            schema: PcbOwnershipGraphBuilder.SCHEMA_ID,
            primitiveOwners,
            componentsByIndex,
            netsByIndex,
            polygonsByIndex
        }
    }

    /**
     * Builds primitive iterable entries in stable renderer collection order.
     * @param {object} pcb Normalized PCB model.
     * @returns {{ primitiveKind: string, primitiveKey: string, primitive: object }[]}
     */
    static #primitiveItems(pcb) {
        return [
            ['fill', pcb?.fills || []],
            ['track', pcb?.tracks || []],
            ['arc', pcb?.arcs || []],
            ['via', pcb?.vias || []],
            ['pad', pcb?.pads || []],
            ['region', pcb?.regions || []],
            ['shape-based-region', pcb?.shapeBasedRegions || []],
            ['text', pcb?.texts || []],
            ['polygon', pcb?.polygons || []]
        ].flatMap(([primitiveKind, primitives]) =>
            primitives.map((primitive, index) => ({
                primitiveKind,
                primitiveKey: primitiveKind + '-' + index,
                primitive
            }))
        )
    }

    /**
     * Builds a compact primitive owner row.
     * @param {{ primitiveKind: string, primitiveKey: string, primitive: object }} item Primitive item.
     * @param {Map<number, string>} componentNames Component names by native index.
     * @param {Map<number, string>} netNames Net names by native index.
     * @returns {object | null}
     */
    static #primitiveOwner(item, componentNames, netNames) {
        const componentIndex =
            PcbOwnershipGraphBuilder.#optionalInteger(
                item.primitive.componentIndex
            ) ??
            (item.primitiveKind === 'text'
                ? PcbOwnershipGraphBuilder.#optionalInteger(
                      item.primitive.ownerIndex
                  )
                : null)
        const netIndex = PcbOwnershipGraphBuilder.#optionalInteger(
            item.primitive.netIndex
        )
        const polygonIndex = PcbOwnershipGraphBuilder.#optionalInteger(
            item.primitive.polygonIndex
        )

        if (
            componentIndex === null &&
            netIndex === null &&
            polygonIndex === null
        ) {
            return null
        }

        return {
            primitiveKey: item.primitiveKey,
            primitiveKind: item.primitiveKind,
            componentIndex,
            component:
                componentIndex === null
                    ? ''
                    : componentNames.get(componentIndex) || '',
            netIndex,
            net: netIndex === null ? '' : netNames.get(netIndex) || '',
            polygonIndex
        }
    }

    /**
     * Builds component designator lookup by native component index.
     * @param {object[]} components Component rows.
     * @returns {Map<number, string>}
     */
    static #componentNames(components) {
        const names = new Map()

        for (const component of components || []) {
            const componentIndex = PcbOwnershipGraphBuilder.#optionalInteger(
                component?.componentIndex
            )
            if (componentIndex !== null) {
                names.set(componentIndex, String(component.designator || ''))
            }
        }

        return names
    }

    /**
     * Builds net name lookup by native net index.
     * @param {object[]} nets Net rows.
     * @returns {Map<number, string>}
     */
    static #netNames(nets) {
        const names = new Map()

        for (const net of nets || []) {
            const netIndex = PcbOwnershipGraphBuilder.#optionalInteger(
                net?.netIndex
            )
            if (netIndex !== null) {
                names.set(netIndex, String(net.name || ''))
            }
        }

        return names
    }

    /**
     * Creates empty component groups so consumers can inspect ownerless rows.
     * @param {object[]} components Component rows.
     * @returns {Record<string, object>}
     */
    static #initialComponentGroups(components) {
        const groups = {}

        for (const component of components || []) {
            const componentIndex = PcbOwnershipGraphBuilder.#optionalInteger(
                component?.componentIndex
            )
            if (componentIndex !== null) {
                groups[String(componentIndex)] = {
                    componentIndex,
                    designator: String(component.designator || ''),
                    primitiveKeys: []
                }
            }
        }

        return groups
    }

    /**
     * Adds one primitive key to a numeric owner group.
     * @param {Record<string, object>} groups Group map.
     * @param {number | null} index Owner index.
     * @param {object} fallbackGroup Group to create when missing.
     * @param {string} primitiveKey Primitive key to append.
     */
    static #addGroupKey(groups, index, fallbackGroup, primitiveKey) {
        if (index === null) {
            return
        }

        const key = String(index)
        if (!groups[key]) {
            groups[key] = fallbackGroup
        }
        if (!groups[key].primitiveKeys.includes(primitiveKey)) {
            groups[key].primitiveKeys.push(primitiveKey)
        }
    }

    /**
     * Parses an optional integer value.
     * @param {unknown} value Candidate value.
     * @returns {number | null}
     */
    static #optionalInteger(value) {
        const parsed = Number(value)
        return Number.isInteger(parsed) ? parsed : null
    }
}
