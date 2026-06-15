// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a normalized single-sheet schematic net model from recovered
 * geometry and named connectivity markers.
 */
export class SchematicNetlistBuilder {
    /**
     * Builds normalized nets and connectivity diagnostics.
     * @param {{ lines: { x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, isBus?: boolean }[], texts: { x: number, y: number, text: string, recordType?: string }[], pins?: { x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom', name: string, designator: string, ownerIndex?: string, componentDesignator?: string }[], ports?: { x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down', name: string }[], crossSheetConnectors?: { key: string, x: number, y: number, name: string, style?: string }[], junctions?: { x: number, y: number, color: string }[], busEntries?: { x1: number, y1: number, x2: number, y2: number }[], sheetEntries?: { x: number, y: number, name: string }[], componentDesignatorsByOwnerIndex?: Map<string, string> | Record<string, string> }} schematic
     * @returns {{ nets: { name: string, autoName?: string, autoNameSource?: string, aliasCandidates?: string[], segments: { x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, isBus?: boolean }[], labels: { x: number, y: number, text: string, recordType?: string }[], powerPorts: { x: number, y: number, text: string, recordType?: string }[], crossSheetConnectors: { key: string, name: string, x: number, y: number, style?: string }[], pins: { x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom', name: string, designator: string, ownerIndex?: string, componentDesignator?: string }[], ports: { x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down', name: string }[], junctions: { x: number, y: number, color: string }[], busEntries: { x1: number, y1: number, x2: number, y2: number }[], sheetEntries: { x: number, y: number, name: string }[] }[], diagnostics: { severity: 'warning', message: string }[] }}
     */
    static build(schematic) {
        const diagnostics = []
        const segments = (schematic.lines || []).filter(
            (line) => !line.ownerIndex && line.isBus !== true
        )

        if (!segments.length) {
            return { nets: [], diagnostics }
        }

        const groups = SchematicNetlistBuilder.#groupWireSegments(
            segments,
            schematic.junctions || []
        )
        let unknownNetIndex = 0
        const nets = groups.map((group) => {
            const labels = (schematic.texts || []).filter(
                (text) =>
                    text.recordType === '25' &&
                    SchematicNetlistBuilder.#groupContainsPoint(group, text)
            )
            const powerPorts = (schematic.texts || []).filter(
                (text) =>
                    text.recordType === '17' &&
                    SchematicNetlistBuilder.#groupContainsPoint(group, text)
            )
            const crossSheetConnectors = (
                schematic.crossSheetConnectors || []
            ).filter((connector) =>
                SchematicNetlistBuilder.#groupContainsPoint(group, connector)
            )
            const pins = (schematic.pins || [])
                .filter((pin) =>
                    SchematicNetlistBuilder.#groupContainsPoint(
                        group,
                        SchematicNetlistBuilder.#resolvePinConnectionPoint(pin)
                    )
                )
                .map((pin) =>
                    SchematicNetlistBuilder.#annotatePinComponentDesignator(
                        pin,
                        schematic.componentDesignatorsByOwnerIndex
                    )
                )
            const ports = (schematic.ports || []).filter((port) =>
                SchematicNetlistBuilder.#groupContainsPoint(
                    group,
                    SchematicNetlistBuilder.#resolvePortConnectionPoint(port)
                )
            )
            const junctions = (schematic.junctions || []).filter((junction) =>
                SchematicNetlistBuilder.#groupContainsPoint(group, junction)
            )
            const busEntries = (schematic.busEntries || []).filter((busEntry) =>
                group.some(
                    (segment) =>
                        SchematicNetlistBuilder.#lineContainsPoint(segment, {
                            x: busEntry.x1,
                            y: busEntry.y1
                        }) ||
                        SchematicNetlistBuilder.#lineContainsPoint(segment, {
                            x: busEntry.x2,
                            y: busEntry.y2
                        })
                )
            )
            const sheetEntries = (schematic.sheetEntries || []).filter(
                (sheetEntry) =>
                    SchematicNetlistBuilder.#groupContainsPoint(
                        group,
                        sheetEntry
                    )
            )
            const explicitNames = [
                ...new Set(
                    [
                        ...powerPorts.map((item) => item.text),
                        ...crossSheetConnectors.map((item) => item.name),
                        ...labels.map((item) => item.text)
                    ].filter(Boolean)
                )
            ]
            const name =
                explicitNames[0] || 'UnknownNet' + String(unknownNetIndex++)
            const implicitNaming =
                SchematicNetlistBuilder.#deriveImplicitNetNaming({
                    explicitNames,
                    pins
                })

            if (explicitNames.length > 1) {
                diagnostics.push({
                    severity: 'warning',
                    message:
                        'Multiple explicit net names were recovered for one schematic net: ' +
                        explicitNames.join(', ') +
                        '.'
                })
            }

            return {
                name,
                ...implicitNaming,
                segments: group,
                labels,
                powerPorts,
                crossSheetConnectors: crossSheetConnectors.map((connector) => ({
                    key: connector.key,
                    name: connector.name,
                    x: connector.x,
                    y: connector.y,
                    style: connector.style
                })),
                pins,
                ports,
                junctions,
                busEntries,
                sheetEntries
            }
        })

        return {
            nets: SchematicNetlistBuilder.#mergeMatchingPowerPortNets(nets),
            diagnostics
        }
    }

    /**
     * Adds a component designator to a net pin when owner metadata resolves it.
     * @param {object} pin Net pin.
     * @param {Map<string, string> | Record<string, string> | undefined} componentDesignatorsByOwnerIndex Component designators by native owner id.
     * @returns {object}
     */
    static #annotatePinComponentDesignator(
        pin,
        componentDesignatorsByOwnerIndex
    ) {
        const componentDesignator =
            pin?.componentDesignator ||
            SchematicNetlistBuilder.#lookupComponentDesignator(
                componentDesignatorsByOwnerIndex,
                pin?.ownerIndex
            )

        if (!componentDesignator) {
            return pin
        }

        return {
            ...pin,
            componentDesignator
        }
    }

    /**
     * Derives non-breaking names for unnamed nets from attached pins.
     * @param {{ explicitNames: string[], pins: object[] }} options Naming inputs.
     * @returns {{ autoName?: string, autoNameSource?: string, aliasCandidates?: string[] }}
     */
    static #deriveImplicitNetNaming(options) {
        if ((options.explicitNames || []).length) {
            return {}
        }

        const candidates = SchematicNetlistBuilder.#pinAliasCandidates(
            options.pins || []
        )

        if (!candidates.length) {
            return {}
        }

        return {
            autoName: candidates[0].name,
            autoNameSource: candidates[0].source,
            aliasCandidates: candidates.map((candidate) => candidate.name)
        }
    }

    /**
     * Builds deterministic alias candidates from connected pins.
     * @param {object[]} pins Connected pins.
     * @returns {{ name: string, source: string }[]}
     */
    static #pinAliasCandidates(pins) {
        const candidates = []

        for (const pin of pins || []) {
            const componentDesignator = String(
                pin?.componentDesignator || ''
            ).trim()
            const ownerIndex = String(pin?.ownerIndex || '').trim()
            const pinDesignator = String(pin?.designator || '').trim()
            const pinName = String(pin?.name || '').trim()

            if (componentDesignator) {
                SchematicNetlistBuilder.#pushPinAliasCandidate(
                    candidates,
                    componentDesignator,
                    pinDesignator,
                    'component-pin'
                )
                SchematicNetlistBuilder.#pushPinAliasCandidate(
                    candidates,
                    componentDesignator,
                    pinName,
                    'component-pin-name'
                )
                continue
            }

            if (ownerIndex) {
                SchematicNetlistBuilder.#pushPinAliasCandidate(
                    candidates,
                    'owner-' + ownerIndex,
                    pinDesignator,
                    'owner-pin'
                )
                SchematicNetlistBuilder.#pushPinAliasCandidate(
                    candidates,
                    'owner-' + ownerIndex,
                    pinName,
                    'owner-pin-name'
                )
                continue
            }

            if (pinName) {
                candidates.push({
                    name: 'pin.' + pinName,
                    source: 'pin-name'
                })
            }
        }

        return SchematicNetlistBuilder.#dedupeAliasCandidates(candidates)
    }

    /**
     * Adds one scoped pin alias candidate.
     * @param {{ name: string, source: string }[]} candidates Alias candidates.
     * @param {string} scope Alias scope.
     * @param {string} pinLabel Pin designator or name.
     * @param {string} source Alias source label.
     * @returns {void}
     */
    static #pushPinAliasCandidate(candidates, scope, pinLabel, source) {
        const trimmedScope = String(scope || '').trim()
        const trimmedPinLabel = String(pinLabel || '').trim()

        if (!trimmedScope || !trimmedPinLabel) {
            return
        }

        candidates.push({
            name: trimmedScope + '.' + trimmedPinLabel,
            source
        })
    }

    /**
     * Deduplicates alias candidates by visible alias name.
     * @param {{ name: string, source: string }[]} candidates Alias candidates.
     * @returns {{ name: string, source: string }[]}
     */
    static #dedupeAliasCandidates(candidates) {
        const seen = new Set()
        const uniqueCandidates = []

        for (const candidate of candidates || []) {
            if (!candidate.name || seen.has(candidate.name)) {
                continue
            }

            seen.add(candidate.name)
            uniqueCandidates.push(candidate)
        }

        return uniqueCandidates
    }

    /**
     * Looks up a component designator by native owner id.
     * @param {Map<string, string> | Record<string, string> | undefined} componentDesignatorsByOwnerIndex Component designators by native owner id.
     * @param {string | undefined} ownerIndex Native owner id.
     * @returns {string}
     */
    static #lookupComponentDesignator(
        componentDesignatorsByOwnerIndex,
        ownerIndex
    ) {
        const key = String(ownerIndex || '').trim()
        if (!key || !componentDesignatorsByOwnerIndex) {
            return ''
        }

        if (componentDesignatorsByOwnerIndex instanceof Map) {
            return String(componentDesignatorsByOwnerIndex.get(key) || '')
        }

        return String(componentDesignatorsByOwnerIndex[key] || '')
    }

    /**
     * Merges physically separate net groups that share one power-port label.
     * @param {{ name: string, powerPorts: { text?: string }[] }[]} nets Source nets.
     * @returns {object[]}
     */
    static #mergeMatchingPowerPortNets(nets) {
        const mergedNets = []
        const netsByPowerName = new Map()

        for (const net of nets) {
            const powerName =
                SchematicNetlistBuilder.#singlePowerPortNetName(net)

            if (!powerName) {
                mergedNets.push(net)
                continue
            }

            const existingNet = netsByPowerName.get(powerName)
            if (!existingNet) {
                netsByPowerName.set(powerName, net)
                mergedNets.push(net)
                continue
            }

            SchematicNetlistBuilder.#appendNet(existingNet, net)
        }

        return mergedNets
    }

    /**
     * Returns one normalized power-port name when every port agrees.
     * @param {{ powerPorts?: { text?: string }[] }} net Source net.
     * @returns {string}
     */
    static #singlePowerPortNetName(net) {
        const names = [
            ...new Set(
                (net.powerPorts || [])
                    .map((powerPort) => String(powerPort.text || '').trim())
                    .filter(Boolean)
                    .map((name) => name.toUpperCase())
            )
        ]

        return names.length === 1 ? names[0] : ''
    }

    /**
     * Appends one net's observable members to an existing logical net.
     * @param {object} target Existing logical net.
     * @param {object} source Source net to append.
     * @returns {void}
     */
    static #appendNet(target, source) {
        for (const key of [
            'segments',
            'labels',
            'powerPorts',
            'crossSheetConnectors',
            'pins',
            'ports',
            'junctions',
            'busEntries',
            'sheetEntries'
        ]) {
            target[key].push(...(source[key] || []))
        }
    }

    /**
     * Groups wire segments by direct endpoint contact or junction-mediated tee
     * contact.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} segments
     * @param {{ x: number, y: number }[]} junctions
     * @returns {{ x1: number, y1: number, x2: number, y2: number }[][]}
     */
    static #groupWireSegments(segments, junctions) {
        const parents = segments.map((_, index) => index)

        for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < segments.length;
                rightIndex += 1
            ) {
                if (
                    SchematicNetlistBuilder.#segmentsAreConnected(
                        segments[leftIndex],
                        segments[rightIndex],
                        junctions
                    )
                ) {
                    SchematicNetlistBuilder.#union(
                        parents,
                        leftIndex,
                        rightIndex
                    )
                }
            }
        }

        const groups = new Map()

        for (let index = 0; index < segments.length; index += 1) {
            const root = SchematicNetlistBuilder.#find(parents, index)

            if (!groups.has(root)) {
                groups.set(root, [])
            }

            groups.get(root).push(segments[index])
        }

        return [...groups.values()].sort((left, right) => {
            const leftMinX = Math.min(
                ...left.map((segment) => Math.min(segment.x1, segment.x2))
            )
            const leftMinY = Math.min(
                ...left.map((segment) => Math.min(segment.y1, segment.y2))
            )
            const rightMinX = Math.min(
                ...right.map((segment) => Math.min(segment.x1, segment.x2))
            )
            const rightMinY = Math.min(
                ...right.map((segment) => Math.min(segment.y1, segment.y2))
            )

            return leftMinY - rightMinY || leftMinX - rightMinX
        })
    }

    /**
     * Returns true when two segments share connectivity.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} left
     * @param {{ x1: number, y1: number, x2: number, y2: number }} right
     * @param {{ x: number, y: number }[]} junctions
     * @returns {boolean}
     */
    static #segmentsAreConnected(left, right, junctions) {
        const leftEndpoints = [
            { x: left.x1, y: left.y1 },
            { x: left.x2, y: left.y2 }
        ]
        const rightEndpoints = [
            { x: right.x1, y: right.y1 },
            { x: right.x2, y: right.y2 }
        ]

        if (
            leftEndpoints.some((leftPoint) =>
                rightEndpoints.some((rightPoint) =>
                    SchematicNetlistBuilder.#pointsEqual(leftPoint, rightPoint)
                )
            )
        ) {
            return true
        }

        for (const point of leftEndpoints) {
            if (
                SchematicNetlistBuilder.#lineContainsPoint(right, point) &&
                junctions.some((junction) =>
                    SchematicNetlistBuilder.#pointsEqual(junction, point)
                )
            ) {
                return true
            }
        }

        for (const point of rightEndpoints) {
            if (
                SchematicNetlistBuilder.#lineContainsPoint(left, point) &&
                junctions.some((junction) =>
                    SchematicNetlistBuilder.#pointsEqual(junction, point)
                )
            ) {
                return true
            }
        }

        return false
    }

    /**
     * Returns true when any segment in one group contains the candidate point.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} group
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #groupContainsPoint(group, point) {
        return group.some((segment) =>
            SchematicNetlistBuilder.#lineContainsPoint(segment, point)
        )
    }

    /**
     * Returns true when one point lies on the segment, including endpoints.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #lineContainsPoint(line, point) {
        const tolerance = 0.01
        const dx = Number(line.x2) - Number(line.x1)
        const dy = Number(line.y2) - Number(line.y1)
        const cross =
            (Number(point.y) - Number(line.y1)) * dx -
            (Number(point.x) - Number(line.x1)) * dy

        if (Math.abs(cross) > tolerance) {
            return false
        }

        const minX = Math.min(Number(line.x1), Number(line.x2)) - tolerance
        const maxX = Math.max(Number(line.x1), Number(line.x2)) + tolerance
        const minY = Math.min(Number(line.y1), Number(line.y2)) - tolerance
        const maxY = Math.max(Number(line.y1), Number(line.y2)) + tolerance

        return (
            Number(point.x) >= minX &&
            Number(point.x) <= maxX &&
            Number(point.y) >= minY &&
            Number(point.y) <= maxY
        )
    }

    /**
     * Resolves the wire-connection point for one normalized pin.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ x: number, y: number }}
     */
    static #resolvePinConnectionPoint(pin) {
        switch (pin.orientation) {
            case 'right':
                return { x: pin.x + pin.length, y: pin.y }
            case 'top':
                return { x: pin.x, y: pin.y + pin.length }
            case 'bottom':
                return { x: pin.x, y: pin.y - pin.length }
            case 'left':
            default:
                return { x: pin.x - pin.length, y: pin.y }
        }
    }

    /**
     * Resolves the wire-connection point for one normalized off-sheet port.
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }} port
     * @returns {{ x: number, y: number }}
     */
    static #resolvePortConnectionPoint(port) {
        switch (port.direction) {
            case 'right':
                return { x: port.x + port.width, y: port.y }
            case 'up':
                return { x: port.x, y: port.y + port.width }
            case 'down':
                return { x: port.x, y: port.y }
            case 'left':
            default:
                return { x: port.x, y: port.y }
        }
    }

    /**
     * Returns true when two points share the same schematic location.
     * @param {{ x: number, y: number }} left
     * @param {{ x: number, y: number }} right
     * @returns {boolean}
     */
    static #pointsEqual(left, right) {
        return (
            Math.abs(Number(left.x) - Number(right.x)) <= 0.01 &&
            Math.abs(Number(left.y) - Number(right.y)) <= 0.01
        )
    }

    /**
     * Finds one union-find root.
     * @param {number[]} parents
     * @param {number} index
     * @returns {number}
     */
    static #find(parents, index) {
        if (parents[index] === index) {
            return index
        }

        parents[index] = SchematicNetlistBuilder.#find(parents, parents[index])

        return parents[index]
    }

    /**
     * Unions two union-find roots.
     * @param {number[]} parents
     * @param {number} leftIndex
     * @param {number} rightIndex
     */
    static #union(parents, leftIndex, rightIndex) {
        const leftRoot = SchematicNetlistBuilder.#find(parents, leftIndex)
        const rightRoot = SchematicNetlistBuilder.#find(parents, rightIndex)

        if (leftRoot !== rightRoot) {
            parents[rightRoot] = leftRoot
        }
    }
}
