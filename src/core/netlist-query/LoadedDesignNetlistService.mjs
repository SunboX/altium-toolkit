// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ComponentGrouping, MPN_MISSING_NOTE } from './ComponentGrouping.mjs'
import { CircuitTraversal } from './CircuitTraversal.mjs'
import { QueryNetlistBuilder } from './QueryNetlistBuilder.mjs'
import { RegexPattern } from './RegexPattern.mjs'

/**
 * Builds query responses from loaded toolkit document models.
 */
export class LoadedDesignNetlistService {
    /** @type {() => object[]} */
    #getDocuments

    /**
     * @param {{ getDocuments: () => object[] }} dependencies Dependencies.
     */
    constructor(dependencies = {}) {
        this.#getDocuments =
            typeof dependencies.getDocuments === 'function'
                ? dependencies.getDocuments
                : () => []
    }

    /**
     * Lists loaded session designs.
     * @param {{ pattern?: string, max_results?: number }} [args] Query args.
     * @returns {object[] | { error: string }}
     */
    listDesigns(args = {}) {
        const loaded = this.#loadedEntries()
        const pattern = String(args.pattern || '.*')
        const parsed = RegexPattern.parse(pattern)
        if (parsed.error) return parsed

        return loaded
            .filter((entry) => parsed.regex.test(entry.name))
            .slice(0, LoadedDesignNetlistService.#maxResults(args.max_results))
            .map((entry) => ({
                id: entry.id,
                name: entry.name,
                fileName: entry.fileName,
                kind: entry.kind,
                active: entry.active,
                hasConnectivity: entry.hasConnectivity
            }))
    }

    /**
     * Lists components matching one reference-designator prefix.
     * @param {{ design?: string, type?: string, include_dns?: boolean }} [args] Query args.
     * @returns {{ components: object[] } | { error: string }}
     */
    listComponents(args = {}) {
        const resolved = this.#resolveDesign(args.design)
        if (resolved.error) return resolved

        const prefix = String(args.type || '')
            .trim()
            .toUpperCase()
        if (!prefix) {
            return { error: 'Component type prefix is required.' }
        }

        const entries = Object.entries(resolved.netlist.components).filter(
            ([refdes]) =>
                LoadedDesignNetlistService.#refdesPrefix(refdes) === prefix
        )
        if (!entries.length) {
            return {
                error:
                    "No components with prefix '" +
                    prefix +
                    "' found in design '" +
                    resolved.entry.name +
                    "'. Available prefixes: [" +
                    this.#availablePrefixes(resolved.netlist).join(', ') +
                    ']'
            }
        }

        return {
            components: ComponentGrouping.groupComponentsByMpn(
                entries,
                args.include_dns === true
            )
        }
    }

    /**
     * Lists net names for one loaded design.
     * @param {{ design?: string }} [args] Query args.
     * @returns {{ nets: string[] } | { error: string }}
     */
    listNets(args = {}) {
        const resolved = this.#resolveDesignWithConnectivity(args.design)
        if (resolved.error) return resolved

        return {
            nets: Object.keys(resolved.netlist.nets).sort((left, right) =>
                left.localeCompare(right)
            )
        }
    }

    /**
     * Searches net names by regex.
     * @param {{ design?: string, pattern?: string }} [args] Query args.
     * @returns {{ results: Record<string, string[]>, notes?: string[] } | { error: string }}
     */
    searchNets(args = {}) {
        const resolved = this.#resolveDesignWithConnectivity(args.design)
        if (resolved.error) return resolved

        const parsed = RegexPattern.parse(args.pattern)
        if (parsed.error) return parsed

        const allNets = Object.keys(resolved.netlist.nets)
        if (RegexPattern.rejectsBroadMatch(args.pattern, allNets)) {
            return {
                error: 'Pattern matches every net. Use list_nets for full net lists.'
            }
        }

        const matches = allNets
            .filter((net) => {
                parsed.regex.lastIndex = 0
                return parsed.regex.test(net)
            })
            .sort((left, right) => left.localeCompare(right))
        const response = {
            results: {
                [resolved.entry.name]: matches
            }
        }

        if (!matches.length) {
            response.notes = [
                "No nets matched pattern '" + String(args.pattern || '') + "'"
            ]
        }

        return response
    }

    /**
     * Searches components by reference designator.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} [args] Query args.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    searchComponentsByRefdes(args = {}) {
        return this.#searchComponents(args, 'refdes')
    }

    /**
     * Searches components by MPN.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} [args] Query args.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    searchComponentsByMpn(args = {}) {
        return this.#searchComponents(args, 'mpn')
    }

    /**
     * Searches components by description.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} [args] Query args.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    searchComponentsByDescription(args = {}) {
        return this.#searchComponents(args, 'description')
    }

    /**
     * Queries one component and all known pin connections.
     * @param {{ design?: string, refdes?: string }} [args] Query args.
     * @returns {object | { error: string }}
     */
    queryComponent(args = {}) {
        const resolved = this.#resolveDesign(args.design)
        if (resolved.error) return resolved

        const refdes = String(args.refdes || '').trim()
        const entry = Object.entries(resolved.netlist.components).find(
            ([candidate]) => candidate.toLowerCase() === refdes.toLowerCase()
        )
        if (!entry) {
            return {
                error:
                    "Component '" +
                    refdes +
                    "' not found in design '" +
                    resolved.entry.name +
                    "'. Use list_components or search_components_by_refdes."
            }
        }

        return LoadedDesignNetlistService.#componentDetails(entry)
    }

    /**
     * Queries extended connectivity starting from a net name.
     * @param {{ design?: string, net_name?: string, skip_types?: string[], include_dns?: boolean }} [args] Query args.
     * @returns {object | { error: string }}
     */
    queryXnetByNetName(args = {}) {
        const resolved = this.#resolveDesignWithConnectivity(args.design)
        if (resolved.error) return resolved

        const netName = this.#resolveNetName(resolved.netlist, args.net_name)
        if (!netName) {
            return {
                error:
                    "Net '" +
                    String(args.net_name || '') +
                    "' not found in design '" +
                    resolved.entry.name +
                    "'. Use search_nets to find available nets."
            }
        }
        if (CircuitTraversal.isStopNet(netName)) {
            return {
                error:
                    netName + ' is a power or ground net and cannot be queried.'
            }
        }

        return this.#buildTraversalResponse(
            netName,
            netName,
            '',
            resolved.netlist,
            args
        )
    }

    /**
     * Queries extended connectivity starting from a component pin.
     * @param {{ design?: string, pin_name?: string, skip_types?: string[], include_dns?: boolean }} [args] Query args.
     * @returns {object | { error: string }}
     */
    queryXnetByPinName(args = {}) {
        const resolved = this.#resolveDesignWithConnectivity(args.design)
        if (resolved.error) return resolved

        const pinSpec = LoadedDesignNetlistService.#parsePinSpec(args.pin_name)
        if (pinSpec.error) return pinSpec

        const componentEntry = Object.entries(resolved.netlist.components).find(
            ([refdes]) => refdes.toLowerCase() === pinSpec.refdes.toLowerCase()
        )
        if (!componentEntry) {
            return {
                error:
                    "Component '" +
                    pinSpec.refdes +
                    "' not found in design '" +
                    resolved.entry.name +
                    "'. Use list_components or search_components_by_refdes."
            }
        }

        const [resolvedRefdes, component] = componentEntry
        const pinKey = Object.keys(component.pins || {}).find((candidate) => {
            return candidate.toLowerCase() === pinSpec.pin.toLowerCase()
        })
        if (!pinKey) {
            return {
                error:
                    "Pin '" +
                    resolvedRefdes +
                    '.' +
                    pinSpec.pin +
                    "' not found. Component " +
                    resolvedRefdes +
                    ' has pins: [' +
                    Object.keys(component.pins || {})
                        .sort(ComponentGrouping.naturalSort)
                        .join(', ') +
                    ']'
            }
        }

        const netName = LoadedDesignNetlistService.#pinNet(
            component.pins[pinKey]
        )
        if (netName === 'NC') {
            const startingPoint = resolvedRefdes + '.' + pinKey
            return {
                starting_point: startingPoint,
                net: netName,
                total_components: 0,
                unique_configurations: 0,
                components_by_mpn: [],
                visited_nets: ['NC'],
                circuit_hash: 'nc-' + startingPoint
            }
        }
        if (CircuitTraversal.isStopNet(netName)) {
            return {
                error:
                    'Pin ' +
                    resolvedRefdes +
                    '.' +
                    pinKey +
                    ' is connected to ' +
                    netName +
                    ' and cannot be queried.'
            }
        }

        return this.#buildTraversalResponse(
            resolvedRefdes + '.' + pinKey,
            netName,
            netName,
            resolved.netlist,
            args
        )
    }

    /**
     * Searches components on one metadata field.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} args Query args.
     * @param {'refdes' | 'mpn' | 'description'} field Search field.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    #searchComponents(args, field) {
        const resolved = this.#resolveDesign(args.design)
        if (resolved.error) return resolved

        const parsed = RegexPattern.parse(args.pattern)
        if (parsed.error) return parsed

        const allEntries = Object.entries(resolved.netlist.components)
        const searchableEntries = allEntries.filter(([refdes, component]) => {
            return LoadedDesignNetlistService.#searchValue(
                refdes,
                component,
                field
            )
        })
        const matches = searchableEntries.filter(([refdes, component]) => {
            parsed.regex.lastIndex = 0
            return parsed.regex.test(
                LoadedDesignNetlistService.#searchValue(
                    refdes,
                    component,
                    field
                )
            )
        })

        if (
            RegexPattern.rejectsBroadMatch(
                args.pattern,
                searchableEntries.map(([refdes, component]) =>
                    LoadedDesignNetlistService.#searchValue(
                        refdes,
                        component,
                        field
                    )
                )
            )
        ) {
            return {
                error: 'Pattern matches every component. Use list_components for prefix-based lists.'
            }
        }

        const response = {
            results: {
                [resolved.entry.name]: ComponentGrouping.groupComponentsByMpn(
                    matches,
                    args.include_dns === true
                )
            }
        }

        if (!response.results[resolved.entry.name].length) {
            response.notes = [
                "No components matched pattern '" +
                    String(args.pattern || '') +
                    "'."
            ]
        }

        return response
    }

    /**
     * Resolves one design and requires schematic connectivity.
     * @param {string | undefined} design Design selector.
     * @returns {object | { error: string }}
     */
    #resolveDesignWithConnectivity(design) {
        const resolved = this.#resolveDesign(design)
        if (resolved.error) return resolved
        if (!Object.keys(resolved.netlist.nets).length) {
            return {
                error: 'No schematic connectivity is available for this loaded design.'
            }
        }

        return resolved
    }

    /**
     * Builds an aggregated traversal response.
     * @param {string} startingPoint Response starting point.
     * @param {string} netName Starting net.
     * @param {string} responseNet Optional response net field.
     * @param {{ nets: object, components: object }} netlist Query netlist.
     * @param {{ skip_types?: string[], include_dns?: boolean }} args Query args.
     * @returns {object}
     */
    #buildTraversalResponse(
        startingPoint,
        netName,
        responseNet,
        netlist,
        args
    ) {
        const traversal = CircuitTraversal.traverseCircuitFromNet(
            netName,
            netlist.nets,
            netlist.components,
            {
                skipTypes: Array.isArray(args.skip_types)
                    ? args.skip_types
                    : [],
                includeDns: args.include_dns === true
            }
        )
        const componentsByMpn = ComponentGrouping.aggregateCircuitByMpn(
            traversal.components
        )
        const response = {
            starting_point: startingPoint,
            net: responseNet || undefined,
            total_components: traversal.components.length,
            unique_configurations:
                LoadedDesignNetlistService.#uniqueConfigurations(
                    componentsByMpn
                ),
            components_by_mpn: componentsByMpn,
            visited_nets: traversal.visited_nets,
            circuit_hash: CircuitTraversal.computeCircuitHash(
                traversal.components
            )
        }

        if (Object.keys(traversal.skipped || {}).length) {
            response.skipped = traversal.skipped
        }

        return LoadedDesignNetlistService.#withoutUndefined(response)
    }

    /**
     * Resolves a loaded design selector.
     * @param {string | undefined} design Design selector.
     * @returns {object | { error: string }}
     */
    #resolveDesign(design) {
        const entries = this.#loadedEntries()
        if (!entries.length) {
            return { error: 'No design is loaded in the current session.' }
        }

        const selector = String(design || 'active').trim()
        if (!selector || selector.toLowerCase() === 'active') {
            const activeEntry =
                entries.find((entry) => entry.active) || entries[0]
            return {
                entry: activeEntry,
                netlist: QueryNetlistBuilder.build(activeEntry.documentModel)
            }
        }

        const matches = entries.filter((entry) =>
            LoadedDesignNetlistService.#entryMatchesSelector(entry, selector)
        )
        if (matches.length > 1) {
            return {
                error:
                    "Design selector '" +
                    selector +
                    "' is ambiguous. Use a loaded document id."
            }
        }
        if (!matches.length) {
            return {
                error:
                    "Design selector '" +
                    selector +
                    "' did not match a loaded design."
            }
        }

        return {
            entry: matches[0],
            netlist: QueryNetlistBuilder.build(matches[0].documentModel)
        }
    }

    /**
     * Returns loaded design entries with derived metadata.
     * @returns {object[]}
     */
    #loadedEntries() {
        return (Array.isArray(this.#getDocuments()) ? this.#getDocuments() : [])
            .map((entry) => LoadedDesignNetlistService.#normalizeEntry(entry))
            .filter((entry) => entry.id && entry.documentModel)
            .map((entry) => {
                const netlist = QueryNetlistBuilder.build(entry.documentModel)
                return {
                    ...entry,
                    name:
                        String(entry.documentModel?.summary?.title || '') ||
                        LoadedDesignNetlistService.#baseName(
                            entry.documentModel?.fileName
                        ),
                    fileName: String(entry.documentModel?.fileName || ''),
                    baseName: LoadedDesignNetlistService.#baseName(
                        entry.documentModel?.fileName
                    ),
                    kind: String(entry.documentModel?.kind || 'document'),
                    hasConnectivity: Boolean(Object.keys(netlist.nets).length)
                }
            })
    }

    /**
     * Returns available reference-designator prefixes.
     * @param {{ components: object }} netlist Query netlist.
     * @returns {string[]}
     */
    #availablePrefixes(netlist) {
        return [
            ...new Set(
                Object.keys(netlist.components)
                    .map((refdes) =>
                        LoadedDesignNetlistService.#refdesPrefix(refdes)
                    )
                    .filter(Boolean)
            )
        ].sort()
    }

    /**
     * Resolves an exact net name case-insensitively.
     * @param {{ nets: object }} netlist Query netlist.
     * @param {string | undefined} netName Requested net.
     * @returns {string}
     */
    #resolveNetName(netlist, netName) {
        const requested = String(netName || '')
            .trim()
            .toLowerCase()
        return (
            Object.keys(netlist.nets).find((candidate) => {
                return candidate.toLowerCase() === requested
            }) || ''
        )
    }

    /**
     * Normalizes a loaded document entry.
     * @param {object} entry Raw entry.
     * @returns {object}
     */
    static #normalizeEntry(entry) {
        const documentModel = entry?.documentModel || entry
        return {
            id: String(entry?.id || documentModel?.id || ''),
            active: entry?.active === true,
            documentModel
        }
    }

    /**
     * Returns one component query response from an entry.
     * @param {[string, object]} entry Component entry.
     * @returns {object}
     */
    static #componentDetails(entry) {
        const [refdes, component] = entry
        const dns = ComponentGrouping.isDnsComponent(component)
        const result = {
            refdes,
            mpn: LoadedDesignNetlistService.#trim(component.mpn),
            description: LoadedDesignNetlistService.#trim(
                component.description
            ),
            comment: LoadedDesignNetlistService.#trim(component.comment),
            value: LoadedDesignNetlistService.#trim(component.value),
            dns: dns || undefined,
            pins: component.pins || {},
            notes: component.mpn ? undefined : [MPN_MISSING_NOTE]
        }

        return LoadedDesignNetlistService.#withoutUndefined(result)
    }

    /**
     * Returns the searchable field value for a component.
     * @param {string} refdes Component refdes.
     * @param {object} component Component metadata.
     * @param {'refdes' | 'mpn' | 'description'} field Search field.
     * @returns {string}
     */
    static #searchValue(refdes, component, field) {
        if (field === 'refdes') return String(refdes || '')
        return String(component?.[field] || '')
    }

    /**
     * Returns true when an entry matches a design selector.
     * @param {object} entry Loaded entry.
     * @param {string} selector Selector.
     * @returns {boolean}
     */
    static #entryMatchesSelector(entry, selector) {
        const normalized = selector.toLowerCase()
        return (
            entry.id.toLowerCase() === normalized ||
            entry.fileName.toLowerCase() === normalized ||
            entry.baseName.toLowerCase() === normalized
        )
    }

    /**
     * Parses a `REFDES.PIN` pin spec.
     * @param {string | undefined} value Pin spec.
     * @returns {{ refdes: string, pin: string } | { error: string }}
     */
    static #parsePinSpec(value) {
        const raw = String(value || '').trim()
        const separator = raw.indexOf('.')
        if (separator <= 0 || separator === raw.length - 1) {
            return {
                error: "Invalid pin name '" + raw + "'. Expected 'REFDES.PIN'."
            }
        }

        return {
            refdes: raw.slice(0, separator),
            pin: raw.slice(separator + 1)
        }
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
     * Counts unique component orientation configurations.
     * @param {object[]} groups Aggregated groups.
     * @returns {number}
     */
    static #uniqueConfigurations(groups) {
        return (groups || []).reduce((count, group) => {
            return (
                count +
                (Array.isArray(group.orientations)
                    ? group.orientations.length
                    : 1)
            )
        }, 0)
    }

    /**
     * Resolves a file base name.
     * @param {string | undefined} fileName File name.
     * @returns {string}
     */
    static #baseName(fileName) {
        return String(fileName || '').replace(/\.[^.]+$/, '')
    }

    /**
     * Resolves a reference-designator prefix.
     * @param {string} refdes Reference designator.
     * @returns {string}
     */
    static #refdesPrefix(refdes) {
        return (
            String(refdes || '')
                .match(/^[A-Za-z]+/)?.[0]
                ?.toUpperCase() || ''
        )
    }

    /**
     * Resolves a max-results limit.
     * @param {unknown} value Raw value.
     * @returns {number}
     */
    static #maxResults(value) {
        const parsed = Number.parseInt(String(value || ''), 10)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : 50
    }

    /**
     * Returns a trimmed string or undefined.
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
}
