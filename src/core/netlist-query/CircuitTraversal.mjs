// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ComponentGrouping } from './ComponentGrouping.mjs'

/**
 * Circuit traversal helpers for loaded query netlists.
 */
export class CircuitTraversal {
    /**
     * Returns true when a net is a recognized ground rail.
     * @param {string} name Net name.
     * @returns {boolean}
     */
    static isGroundNet(name) {
        return /^(GND|VSS|AGND|DGND|PGND|SGND|CGND)$/i.test(String(name || ''))
    }

    /**
     * Returns true when a net is a recognized power rail.
     * @param {string} name Net name.
     * @returns {boolean}
     */
    static isPowerNet(name) {
        return /^(VCC\w*|VDD\w*|VIN\w*|VOUT\w*|VBAT\w*|VBUS\w*|VSYS\w*|PWR_\w+|RAIL_\w+|PP\w*|PN\w*|LD_PP\w*|LD_PN\w*|[+-]?\d+V\d*\w*|[+-].+)$/i.test(
            String(name || '')
        )
    }

    /**
     * Returns true when traversal should stop at a net.
     * @param {string} name Net name.
     * @returns {boolean}
     */
    static isStopNet(name) {
        return (
            CircuitTraversal.isGroundNet(name) ||
            CircuitTraversal.isPowerNet(name)
        )
    }

    /**
     * Returns the alphabetic reference-designator prefix.
     * @param {string} refdes Reference designator.
     * @returns {string}
     */
    static getRefdesPrefix(refdes) {
        return (
            String(refdes || '')
                .match(/^[A-Za-z]+/)?.[0]
                ?.toUpperCase() || ''
        )
    }

    /**
     * Traverses connectivity from one net.
     * @param {string} startNet Starting net.
     * @param {object} nets Net-to-pin map.
     * @param {object} components Component map.
     * @param {{ skipTypes?: string[], includeDns?: boolean }} [options] Options.
     * @returns {{ components: object[], visited_nets: string[], skipped: Record<string, number> }}
     */
    static traverseCircuitFromNet(startNet, nets, components, options = {}) {
        const queue = [String(startNet || '')]
        const queued = new Set(queue)
        const visitedNets = []
        const componentMap = new Map()
        const skipped = {}
        const skipTypes = new Set(
            (options.skipTypes || []).map((type) =>
                String(type || '').toUpperCase()
            )
        )

        while (queue.length) {
            const netName = queue.shift()
            if (!netName || visitedNets.includes(netName)) {
                continue
            }

            visitedNets.push(netName)
            const connections = nets?.[netName] || {}

            for (const [refdes, pinValue] of Object.entries(connections)) {
                const component = components?.[refdes] || { pins: {} }
                const prefix = CircuitTraversal.getRefdesPrefix(refdes)

                if (
                    !options.includeDns &&
                    ComponentGrouping.isDnsComponent(component)
                ) {
                    CircuitTraversal.#countSkipped(skipped, prefix)
                    continue
                }

                if (skipTypes.has(prefix)) {
                    CircuitTraversal.#countSkipped(skipped, prefix)
                    continue
                }

                const passive = CircuitTraversal.#isTraversablePassive(
                    refdes,
                    component
                )
                const componentPins = passive
                    ? CircuitTraversal.#componentPinEntries(component)
                    : CircuitTraversal.#netPinEntries(pinValue, netName)

                CircuitTraversal.#addComponent(
                    componentMap,
                    refdes,
                    component,
                    componentPins
                )

                if (passive) {
                    CircuitTraversal.#enqueuePassiveNets(
                        componentPins,
                        netName,
                        queue,
                        queued,
                        visitedNets
                    )
                }
            }
        }

        return {
            components: [...componentMap.values()],
            visited_nets: visitedNets,
            skipped
        }
    }

    /**
     * Computes a stable short hash for a circuit component list.
     * @param {object[]} components Circuit components.
     * @returns {string}
     */
    static computeCircuitHash(components) {
        if (!Array.isArray(components) || !components.length) {
            return '0000000000000000'
        }

        const canonical = [...components]
            .sort((left, right) =>
                ComponentGrouping.naturalSort(left.refdes, right.refdes)
            )
            .map((component) => ({
                refdes: component.refdes,
                mpn: component.mpn,
                value: component.value,
                connections: (component.connections || [])
                    .map((connection) => ({
                        net: connection.net,
                        pins: [...(connection.pins || [])].sort(
                            ComponentGrouping.naturalSort
                        )
                    }))
                    .sort((left, right) => left.net.localeCompare(right.net))
            }))

        return CircuitTraversal.#hashString(JSON.stringify(canonical))
    }

    /**
     * Adds one component to the traversal result map.
     * @param {Map<string, object>} componentMap Component map.
     * @param {string} refdes Reference designator.
     * @param {object} component Source component.
     * @param {{ pin: string, net: string }[]} pinEntries Pin entries.
     */
    static #addComponent(componentMap, refdes, component, pinEntries) {
        if (!componentMap.has(refdes)) {
            componentMap.set(refdes, {
                refdes,
                type: CircuitTraversal.getRefdesPrefix(refdes),
                mpn: component.mpn,
                description: component.description,
                comment: component.comment,
                value: component.value,
                dns: component.dns || undefined,
                connections: []
            })
        }

        const result = componentMap.get(refdes)
        for (const entry of pinEntries) {
            if (!entry.pin || !entry.net) continue
            let connection = result.connections.find(
                (candidate) => candidate.net === entry.net
            )
            if (!connection) {
                connection = { net: entry.net, pins: [] }
                result.connections.push(connection)
            }
            if (!connection.pins.includes(entry.pin)) {
                connection.pins.push(entry.pin)
                connection.pins.sort(ComponentGrouping.naturalSort)
            }
        }
    }

    /**
     * Enqueues non-stop nets reachable through one passive component.
     * @param {{ pin: string, net: string }[]} pinEntries Passive pins.
     * @param {string} currentNet Current net.
     * @param {string[]} queue Net queue.
     * @param {Set<string>} queued Queued nets.
     * @param {string[]} visitedNets Visited nets.
     */
    static #enqueuePassiveNets(
        pinEntries,
        currentNet,
        queue,
        queued,
        visitedNets
    ) {
        for (const entry of pinEntries) {
            if (!entry.net || entry.net === currentNet) continue
            if (visitedNets.includes(entry.net)) continue

            if (CircuitTraversal.isStopNet(entry.net)) {
                if (!visitedNets.includes(entry.net)) {
                    visitedNets.push(entry.net)
                }
                continue
            }

            if (!queued.has(entry.net)) {
                queued.add(entry.net)
                queue.push(entry.net)
            }
        }
    }

    /**
     * Counts one skipped component by type.
     * @param {Record<string, number>} skipped Skipped map.
     * @param {string} prefix Component prefix.
     */
    static #countSkipped(skipped, prefix) {
        skipped[prefix] = (skipped[prefix] || 0) + 1
    }

    /**
     * Returns true when a component can be traversed as a two-pin passive.
     * @param {string} refdes Reference designator.
     * @param {object} component Component metadata.
     * @returns {boolean}
     */
    static #isTraversablePassive(refdes, component) {
        return (
            CircuitTraversal.#passivePrefixes().has(
                CircuitTraversal.getRefdesPrefix(refdes)
            ) && CircuitTraversal.#componentPinEntries(component).length === 2
        )
    }

    /**
     * Returns all component pin entries.
     * @param {object} component Component metadata.
     * @returns {{ pin: string, net: string }[]}
     */
    static #componentPinEntries(component) {
        return Object.entries(component?.pins || []).map(([pin, entry]) => ({
            pin: String(pin),
            net: CircuitTraversal.#pinNet(entry)
        }))
    }

    /**
     * Builds pin entries for the current net connection.
     * @param {string | string[]} pinValue Pin value.
     * @param {string} netName Net name.
     * @returns {{ pin: string, net: string }[]}
     */
    static #netPinEntries(pinValue, netName) {
        const pins = Array.isArray(pinValue) ? pinValue : [pinValue]
        return pins.map((pin) => ({
            pin: String(pin || ''),
            net: netName
        }))
    }

    /**
     * Extracts a net name from a pin entry.
     * @param {string | { net?: string }} entry Pin entry.
     * @returns {string}
     */
    static #pinNet(entry) {
        return typeof entry === 'string' ? entry : String(entry?.net || '')
    }

    /**
     * Returns traversable passive prefixes.
     * @returns {Set<string>}
     */
    static #passivePrefixes() {
        return new Set(['R', 'RS', 'FR', 'C', 'L', 'FB'])
    }

    /**
     * Hashes a string with a deterministic browser-safe FNV-1a variant.
     * @param {string} value Input value.
     * @returns {string}
     */
    static #hashString(value) {
        let left = 0x811c9dc5
        let right = 0x01000193

        for (let index = 0; index < value.length; index += 1) {
            left ^= value.charCodeAt(index)
            left = Math.imul(left, 0x01000193) >>> 0
            right ^= value.charCodeAt(value.length - index - 1)
            right = Math.imul(right, 0x811c9dc5) >>> 0
        }

        return (
            left.toString(16).padStart(8, '0') +
            right.toString(16).padStart(8, '0')
        ).slice(0, 16)
    }
}
