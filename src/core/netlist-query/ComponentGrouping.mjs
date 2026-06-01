// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

export const MPN_MISSING_NOTE =
    'MPN not found in loaded design metadata. Add a part number to the symbol properties or provide a BOM.'

/**
 * Component grouping helpers for compact netlist query responses.
 */
export class ComponentGrouping {
    /**
     * Compacts a single-element array to its scalar value.
     * @template T
     * @param {T[]} values Values to compact.
     * @returns {T | T[]}
     */
    static compactArray(values) {
        return values.length === 1 ? values[0] : values
    }

    /**
     * Groups components by MPN while leaving no-MPN components separate.
     * @param {[string, object][]} entries Component entries.
     * @param {boolean} includeDns Whether DNS components are included.
     * @returns {object[]}
     */
    static groupComponentsByMpn(entries, includeDns = false) {
        const groups = new Map()

        for (const [refdes, component] of entries || []) {
            const normalizedComponent =
                ComponentGrouping.#normalizeComponent(component)
            const dns = ComponentGrouping.isDnsComponent(normalizedComponent)
            if (!includeDns && dns) {
                continue
            }

            const groupKey = ComponentGrouping.#componentGroupKey(
                refdes,
                normalizedComponent,
                dns
            )
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    ...ComponentGrouping.#componentMetadata(
                        normalizedComponent
                    ),
                    dns: dns || undefined,
                    notes: normalizedComponent.mpn
                        ? undefined
                        : [MPN_MISSING_NOTE],
                    refdes: []
                })
            }

            groups.get(groupKey).refdes.push(String(refdes || ''))
        }

        return [...groups.values()]
            .map((group) => ComponentGrouping.#buildComponentGroup(group))
            .sort((left, right) =>
                String(left.mpn || '').localeCompare(String(right.mpn || ''))
            )
    }

    /**
     * Aggregates circuit components by MPN or description.
     * @param {object[]} components Circuit components.
     * @returns {object[]}
     */
    static aggregateCircuitByMpn(components) {
        const groups = new Map()

        for (const component of components || []) {
            const normalized = ComponentGrouping.#normalizeComponent(component)
            const key = ComponentGrouping.#circuitGroupKey(normalized)
            if (!groups.has(key)) {
                groups.set(key, {
                    ...ComponentGrouping.#componentMetadata(normalized),
                    dns: normalized.dns || undefined,
                    notes: normalized.mpn ? undefined : [MPN_MISSING_NOTE],
                    orientations: new Map()
                })
            }

            const group = groups.get(key)
            const orientationKey = ComponentGrouping.#orientationKey(
                normalized.connections || []
            )
            if (!group.orientations.has(orientationKey)) {
                group.orientations.set(orientationKey, {
                    count: 0,
                    refdes: [],
                    connections: normalized.connections || []
                })
            }

            const orientation = group.orientations.get(orientationKey)
            orientation.count += 1
            orientation.refdes.push(normalized.refdes)
        }

        return [...groups.values()]
            .map((group) => ComponentGrouping.#buildAggregatedGroup(group))
            .sort((left, right) => right.total_count - left.total_count)
    }

    /**
     * Returns true when a component carries a DNS marker.
     * @param {object} component Component metadata.
     * @returns {boolean}
     */
    static isDnsComponent(component) {
        if (component?.dns === true || component?.excludeFromBom === true) {
            return true
        }

        const haystack = [
            component?.mpn,
            component?.description,
            component?.comment,
            component?.value
        ]
            .map((value) => String(value || ''))
            .join(' ')

        return ComponentGrouping.#dnsPattern().test(haystack)
    }

    /**
     * Returns a natural sort comparator.
     * @param {string} left Left value.
     * @param {string} right Right value.
     * @returns {number}
     */
    static naturalSort(left, right) {
        const leftKey = ComponentGrouping.#naturalSortKey(left)
        const rightKey = ComponentGrouping.#naturalSortKey(right)
        const length = Math.min(leftKey.length, rightKey.length)

        for (let index = 0; index < length; index += 1) {
            if (leftKey[index] < rightKey[index]) return -1
            if (leftKey[index] > rightKey[index]) return 1
        }

        return leftKey.length - rightKey.length
    }

    /**
     * Builds one grouped component response.
     * @param {object} group Internal group.
     * @returns {object}
     */
    static #buildComponentGroup(group) {
        const refdes = group.refdes
            .filter(Boolean)
            .sort(ComponentGrouping.naturalSort)
        const result = {
            ...ComponentGrouping.#componentMetadata(group),
            count: refdes.length,
            refdes: ComponentGrouping.compactArray(refdes)
        }

        if (group.dns) result.dns = true
        if (group.notes) result.notes = group.notes

        return ComponentGrouping.#withoutUndefined(result)
    }

    /**
     * Builds one aggregated circuit response group.
     * @param {object} group Internal circuit group.
     * @returns {object}
     */
    static #buildAggregatedGroup(group) {
        const orientations = [...group.orientations.values()]
        const totalCount = orientations.reduce(
            (sum, orientation) => sum + orientation.count,
            0
        )
        const result = {
            ...ComponentGrouping.#componentMetadata(group),
            total_count: totalCount
        }

        if (group.dns) result.dns = true
        if (group.notes) result.notes = group.notes

        if (orientations.length === 1) {
            result.refdes = ComponentGrouping.compactArray(
                orientations[0].refdes.sort(ComponentGrouping.naturalSort)
            )
            result.connections = ComponentGrouping.#compactConnections(
                orientations[0].connections
            )
        } else {
            result.orientations = orientations.map((orientation) => ({
                count: orientation.count,
                refdes: ComponentGrouping.compactArray(
                    orientation.refdes.sort(ComponentGrouping.naturalSort)
                ),
                connections: ComponentGrouping.#compactConnections(
                    orientation.connections
                )
            }))
        }

        return ComponentGrouping.#withoutUndefined(result)
    }

    /**
     * Returns component metadata fields with empty values omitted.
     * @param {object} component Component metadata.
     * @returns {object}
     */
    static #componentMetadata(component) {
        return ComponentGrouping.#withoutUndefined({
            mpn: ComponentGrouping.#trim(component?.mpn),
            description: ComponentGrouping.#trim(component?.description),
            comment: ComponentGrouping.#trim(component?.comment),
            value: ComponentGrouping.#trim(component?.value)
        })
    }

    /**
     * Normalizes one component object.
     * @param {object} component Component metadata.
     * @returns {object}
     */
    static #normalizeComponent(component) {
        return component && typeof component === 'object' ? component : {}
    }

    /**
     * Builds a stable grouping key for component lists.
     * @param {string} refdes Reference designator.
     * @param {object} component Component metadata.
     * @param {boolean} dns DNS flag.
     * @returns {string}
     */
    static #componentGroupKey(refdes, component, dns) {
        const mpn = ComponentGrouping.#trim(component?.mpn)
        return [
            mpn ? 'mpn:' + mpn : 'refdes:' + String(refdes || ''),
            dns ? 'dns:1' : 'dns:0'
        ].join('|')
    }

    /**
     * Builds a stable grouping key for circuit components.
     * @param {object} component Circuit component.
     * @returns {string}
     */
    static #circuitGroupKey(component) {
        const metadata =
            ComponentGrouping.#trim(component?.mpn) ||
            ComponentGrouping.#trim(component?.description) ||
            String(component?.refdes || '')
        const nets = (component?.connections || [])
            .map((connection) => String(connection.net || ''))
            .sort()
            .join(',')

        return [metadata, nets, component?.dns ? 'dns:1' : 'dns:0'].join('|')
    }

    /**
     * Builds a stable orientation key for pin-to-net connections.
     * @param {object[]} connections Circuit connections.
     * @returns {string}
     */
    static #orientationKey(connections) {
        return (connections || [])
            .map((connection) => {
                const pins = Array.isArray(connection.pins)
                    ? connection.pins
                    : [connection.pins]
                return (
                    pins
                        .map(String)
                        .sort(ComponentGrouping.naturalSort)
                        .join(',') +
                    ':' +
                    String(connection.net || '')
                )
            })
            .join('|')
    }

    /**
     * Compacts circuit pin arrays in response connections.
     * @param {object[]} connections Circuit connections.
     * @returns {object[]}
     */
    static #compactConnections(connections) {
        return (connections || []).map((connection) => ({
            net: String(connection.net || ''),
            pins: ComponentGrouping.compactArray(
                (Array.isArray(connection.pins)
                    ? connection.pins
                    : [connection.pins]
                )
                    .filter((pin) => pin !== undefined && pin !== null)
                    .map(String)
                    .sort(ComponentGrouping.naturalSort)
            )
        }))
    }

    /**
     * Returns the DNS marker pattern.
     * @returns {RegExp}
     */
    static #dnsPattern() {
        return /(?:^|[_,\s])(DNS|DNP|DNF|DNI|DNM|NF|NC)(?:$|[_,\s])|DO\s*NOT\s*(STUFF|POPULATE|INSTALL|FIT|MOUNT)|NOT\s*(POPULATED|FITTED|CONNECTED|MOUNTED)|NO\s*POP/i
    }

    /**
     * Returns a string without surrounding whitespace or undefined.
     * @param {unknown} value Raw value.
     * @returns {string | undefined}
     */
    static #trim(value) {
        const trimmed = String(value || '').trim()
        return trimmed || undefined
    }

    /**
     * Removes undefined values from an object.
     * @param {object} value Object value.
     * @returns {object}
     */
    static #withoutUndefined(value) {
        return Object.fromEntries(
            Object.entries(value).filter(([, entryValue]) => {
                return entryValue !== undefined
            })
        )
    }

    /**
     * Builds a natural sort key from a string.
     * @param {string | number} value Sort value.
     * @returns {(string | number)[]}
     */
    static #naturalSortKey(value) {
        return String(value)
            .split(/(\d+)/)
            .map((part) => {
                const numeric = Number.parseInt(part, 10)
                return Number.isNaN(numeric) ? part.toLowerCase() : numeric
            })
    }
}
