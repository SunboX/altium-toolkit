// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic read-only schematic connectivity QA findings.
 */
export class SchematicConnectivityQaBuilder {
    static SCHEMA_ID = 'altium-toolkit.schematic.connectivity-qa.a1'

    /**
     * Builds connectivity QA from the normalized single-sheet net model.
     * @param {{ nets?: object[], texts?: object[], pins?: object[], ports?: object[], junctions?: object[], lines?: object[], sheetEntries?: object[], harnesses?: object | null }} schematic Normalized schematic fragments.
     * @returns {object}
     */
    static build(schematic) {
        const nets = Array.isArray(schematic?.nets) ? schematic.nets : []
        const lines = Array.isArray(schematic?.lines) ? schematic.lines : []
        const labels = (schematic?.texts || []).filter(
            (text) => text.recordType === '25'
        )
        const ports = Array.isArray(schematic?.ports) ? schematic.ports : []
        const pins = Array.isArray(schematic?.pins) ? schematic.pins : []
        const junctions = Array.isArray(schematic?.junctions)
            ? schematic.junctions
            : []
        const sheetEntries = Array.isArray(schematic?.sheetEntries)
            ? schematic.sheetEntries
            : []
        const harnesses = schematic?.harnesses || null
        const findings = [
            ...SchematicConnectivityQaBuilder.#implicitNetFindings(nets),
            ...SchematicConnectivityQaBuilder.#danglingLabelFindings(
                labels,
                nets
            ),
            ...SchematicConnectivityQaBuilder.#orphanPortFindings(ports, nets),
            ...SchematicConnectivityQaBuilder.#unconnectedPinFindings(
                pins,
                nets
            ),
            ...SchematicConnectivityQaBuilder.#ambiguousJunctionFindings(
                junctions,
                nets
            ),
            ...SchematicConnectivityQaBuilder.#unjunctionedTeeContactFindings(
                lines,
                junctions
            ),
            ...SchematicConnectivityQaBuilder.#harnessFindings(
                sheetEntries,
                harnesses
            ),
            ...SchematicConnectivityQaBuilder.#pinInterpretationFindings(pins)
        ]

        return {
            schema: SchematicConnectivityQaBuilder.SCHEMA_ID,
            summary: SchematicConnectivityQaBuilder.#summary(nets, findings),
            findings
        }
    }

    /**
     * Reports nets that received a synthesized name.
     * @param {object[]} nets Normalized nets.
     * @returns {object[]}
     */
    static #implicitNetFindings(nets) {
        return nets
            .filter((net) => /^UnknownNet\d+$/u.test(String(net.name || '')))
            .map((net) => ({
                code: 'schematic.connectivity.implicit-net-name',
                severity: 'info',
                netName: net.name,
                segmentCount: (net.segments || []).length
            }))
    }

    /**
     * Reports wire labels not assigned to any net.
     * @param {object[]} labels Wire labels.
     * @param {object[]} nets Normalized nets.
     * @returns {object[]}
     */
    static #danglingLabelFindings(labels, nets) {
        return labels
            .filter(
                (label) =>
                    !nets.some((net) =>
                        (net.labels || []).some((netLabel) =>
                            SchematicConnectivityQaBuilder.#sameTextPoint(
                                label,
                                netLabel
                            )
                        )
                    )
            )
            .map((label) => ({
                code: 'schematic.connectivity.dangling-label',
                severity: 'warning',
                text: label.text,
                x: label.x,
                y: label.y
            }))
    }

    /**
     * Reports ports not assigned to any net.
     * @param {object[]} ports Ports.
     * @param {object[]} nets Normalized nets.
     * @returns {object[]}
     */
    static #orphanPortFindings(ports, nets) {
        return ports
            .filter(
                (port) =>
                    !nets.some((net) =>
                        (net.ports || []).some((netPort) =>
                            SchematicConnectivityQaBuilder.#sameNamedPoint(
                                port,
                                netPort
                            )
                        )
                    )
            )
            .map((port) => ({
                code: 'schematic.connectivity.orphan-port',
                severity: 'warning',
                name: port.name,
                x: port.x,
                y: port.y
            }))
    }

    /**
     * Reports pins not assigned to any net.
     * @param {object[]} pins Pins.
     * @param {object[]} nets Normalized nets.
     * @returns {object[]}
     */
    static #unconnectedPinFindings(pins, nets) {
        return pins
            .filter(
                (pin) =>
                    !nets.some((net) =>
                        (net.pins || []).some((netPin) =>
                            SchematicConnectivityQaBuilder.#samePin(pin, netPin)
                        )
                    )
            )
            .map((pin) => ({
                code: 'schematic.connectivity.unconnected-pin',
                severity: 'warning',
                ownerIndex: pin.ownerIndex,
                designator: pin.designator,
                name: pin.name,
                x: pin.x,
                y: pin.y
            }))
    }

    /**
     * Reports authored junctions that do not participate in any net.
     * @param {object[]} junctions Authored junctions.
     * @param {object[]} nets Normalized nets.
     * @returns {object[]}
     */
    static #ambiguousJunctionFindings(junctions, nets) {
        return junctions
            .filter(
                (junction) =>
                    !nets.some((net) =>
                        (net.junctions || []).some((netJunction) =>
                            SchematicConnectivityQaBuilder.#samePoint(
                                junction,
                                netJunction
                            )
                        )
                    )
            )
            .map((junction) => ({
                code: 'schematic.connectivity.ambiguous-junction',
                severity: 'warning',
                x: junction.x,
                y: junction.y
            }))
    }

    /**
     * Builds finding counters.
     * @param {object[]} nets Normalized nets.
     * @param {object[]} findings QA findings.
     * @returns {object}
     */
    static #summary(nets, findings) {
        const unjunctionedTeeContactCount =
            SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.unjunctioned-tee-contact'
            )
        const summary = {
            netCount: nets.length,
            findingCount: findings.length,
            danglingLabelCount: SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.dangling-label'
            ),
            orphanPortCount: SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.orphan-port'
            ),
            unconnectedPinCount: SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.unconnected-pin'
            ),
            implicitNetCount: SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.implicit-net-name'
            ),
            ambiguousJunctionCount: SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.ambiguous-junction'
            )
        }
        const harnessFindingCount = SchematicConnectivityQaBuilder.#countCode(
            findings,
            'schematic.connectivity.harness-sheet-entry-unresolved-type'
        )
        const unlinkedHarnessEntryCount =
            SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.harness-entry-unlinked-signal'
            )
        const harnessTypeMismatchCount =
            SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.connectivity.harness-type-mismatch'
            )

        if (unjunctionedTeeContactCount) {
            summary.unjunctionedTeeContactCount = unjunctionedTeeContactCount
        }
        if (
            harnessFindingCount ||
            unlinkedHarnessEntryCount ||
            harnessTypeMismatchCount
        ) {
            summary.harnessFindingCount =
                harnessFindingCount +
                unlinkedHarnessEntryCount +
                harnessTypeMismatchCount
            summary.unresolvedHarnessTypeCount = harnessFindingCount
            summary.unlinkedHarnessEntryCount = unlinkedHarnessEntryCount
        }
        if (harnessTypeMismatchCount) {
            summary.harnessTypeMismatchCount = harnessTypeMismatchCount
        }
        SchematicConnectivityQaBuilder.#assignPinInterpretationCounts(
            summary,
            findings
        )

        return summary
    }

    /**
     * Adds pin interpretation counters to the summary when present.
     * @param {Record<string, number>} summary Mutable summary row.
     * @param {object[]} findings QA findings.
     * @returns {void}
     */
    static #assignPinInterpretationCounts(summary, findings) {
        const hiddenPinLabelCount = [
            'schematic.pin.hidden-labels',
            'schematic.pin.hidden-name',
            'schematic.pin.hidden-number'
        ].reduce(
            (count, code) =>
                count +
                SchematicConnectivityQaBuilder.#countCode(findings, code),
            0
        )
        const powerElectricalAmbiguityCount =
            SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.pin.power-like-name-non-power-electrical'
            )
        const pinEndpointSymbolCount =
            SchematicConnectivityQaBuilder.#countCode(
                findings,
                'schematic.pin.endpoint-symbol'
            )

        if (hiddenPinLabelCount) {
            summary.hiddenPinLabelCount = hiddenPinLabelCount
        }
        if (powerElectricalAmbiguityCount) {
            summary.powerElectricalAmbiguityCount =
                powerElectricalAmbiguityCount
        }
        if (pinEndpointSymbolCount) {
            summary.pinEndpointSymbolCount = pinEndpointSymbolCount
        }
    }

    /**
     * Builds QA findings for recovered pin display/electrical metadata.
     * @param {object[]} pins Normalized pins.
     * @returns {object[]}
     */
    static #pinInterpretationFindings(pins) {
        const findings = []

        for (const pin of pins || []) {
            findings.push(
                ...SchematicConnectivityQaBuilder.#pinLabelFindings(pin)
            )
            const powerFinding =
                SchematicConnectivityQaBuilder.#powerElectricalFinding(pin)
            if (powerFinding) {
                findings.push(powerFinding)
            }
            const endpointFinding =
                SchematicConnectivityQaBuilder.#endpointSymbolFinding(pin)
            if (endpointFinding) {
                findings.push(endpointFinding)
            }
        }

        return findings
    }

    /**
     * Builds findings for pin name/number display suppression.
     * @param {object} pin Normalized pin.
     * @returns {object[]}
     */
    static #pinLabelFindings(pin) {
        const labelMode = String(pin?.labelMode || 'name-and-number')
        const hasName = String(pin?.name || '').trim().length > 0
        const hasNumber = String(pin?.designator || '').trim().length > 0

        if (labelMode === 'hidden' && (hasName || hasNumber)) {
            return [
                SchematicConnectivityQaBuilder.#pinFinding(
                    'schematic.pin.hidden-labels',
                    'info',
                    pin
                )
            ]
        }
        if (labelMode === 'number-only' && hasName) {
            return [
                SchematicConnectivityQaBuilder.#pinFinding(
                    'schematic.pin.hidden-name',
                    'info',
                    pin
                )
            ]
        }
        if (labelMode === 'name-only' && hasNumber) {
            return [
                SchematicConnectivityQaBuilder.#pinFinding(
                    'schematic.pin.hidden-number',
                    'info',
                    pin
                )
            ]
        }

        return []
    }

    /**
     * Builds a finding when a power-like pin name does not use a power type.
     * @param {object} pin Normalized pin.
     * @returns {object | null}
     */
    static #powerElectricalFinding(pin) {
        if (
            !SchematicConnectivityQaBuilder.#isPowerLikePinName(pin?.name) ||
            SchematicConnectivityQaBuilder.#isPowerElectricalType(
                pin?.electrical
            )
        ) {
            return null
        }

        return SchematicConnectivityQaBuilder.#pinFinding(
            'schematic.pin.power-like-name-non-power-electrical',
            'warning',
            pin,
            {
                electrical: pin?.electrical
            }
        )
    }

    /**
     * Builds a finding when a pin carries an endpoint symbol marker.
     * @param {object} pin Normalized pin.
     * @returns {object | null}
     */
    static #endpointSymbolFinding(pin) {
        const symbolOuter = Number(pin?.symbolOuter)
        if (!Number.isFinite(symbolOuter) || symbolOuter === 0) {
            return null
        }

        return SchematicConnectivityQaBuilder.#pinFinding(
            'schematic.pin.endpoint-symbol',
            'info',
            pin,
            {
                symbolOuter
            }
        )
    }

    /**
     * Builds one pin finding row.
     * @param {string} code Stable finding code.
     * @param {'info' | 'warning'} severity Finding severity.
     * @param {object} pin Normalized pin.
     * @param {object} [details] Additional finding fields.
     * @returns {object}
     */
    static #pinFinding(code, severity, pin, details = {}) {
        return SchematicConnectivityQaBuilder.#stripEmpty({
            code,
            severity,
            ownerIndex: pin?.ownerIndex,
            designator: pin?.designator,
            name: pin?.name,
            x: pin?.x,
            y: pin?.y,
            labelMode: pin?.labelMode,
            ...details
        })
    }

    /**
     * Builds harness-specific connectivity findings.
     * @param {object[]} sheetEntries Sheet entry records.
     * @param {object | null} harnesses Harness read model.
     * @returns {object[]}
     */
    static #harnessFindings(sheetEntries, harnesses) {
        return [
            ...SchematicConnectivityQaBuilder.#unresolvedHarnessTypeFindings(
                sheetEntries,
                harnesses
            ),
            ...SchematicConnectivityQaBuilder.#unlinkedHarnessEntryFindings(
                harnesses
            ),
            ...SchematicConnectivityQaBuilder.#harnessTypeMismatchFindings(
                harnesses
            )
        ]
    }

    /**
     * Reports sheet entries that name a harness type not present locally.
     * @param {object[]} sheetEntries Sheet entry records.
     * @param {object | null} harnesses Harness read model.
     * @returns {object[]}
     */
    static #unresolvedHarnessTypeFindings(sheetEntries, harnesses) {
        const knownTypes =
            SchematicConnectivityQaBuilder.#knownHarnessTypes(harnesses)

        return (sheetEntries || [])
            .filter((entry) => {
                const harnessType =
                    SchematicConnectivityQaBuilder.#normalizeHarnessType(
                        entry?.harnessType
                    )
                return harnessType && !knownTypes.has(harnessType)
            })
            .map((entry) => ({
                code: 'schematic.connectivity.harness-sheet-entry-unresolved-type',
                severity: 'warning',
                name: entry.name,
                harnessType: entry.harnessType,
                x: entry.x,
                y: entry.y
            }))
    }

    /**
     * Reports harness entries that have no linked signal-harness geometry.
     * @param {object | null} harnesses Harness read model.
     * @returns {object[]}
     */
    static #unlinkedHarnessEntryFindings(harnesses) {
        const linksByConnector = new Map(
            (harnesses?.bundleLinks || []).map((link) => [
                link.connectorKey,
                link
            ])
        )
        const findings = []

        for (const connector of harnesses?.connectors || []) {
            const link = linksByConnector.get(connector.key)
            if (link?.signalHarnessKeys?.length) {
                continue
            }

            for (const entry of connector.entries || []) {
                findings.push({
                    code: 'schematic.connectivity.harness-entry-unlinked-signal',
                    severity: 'warning',
                    connectorKey: connector.key,
                    entryKey: entry.key,
                    name: entry.name,
                    harnessType: entry.harnessType
                })
            }
        }

        return findings
    }

    /**
     * Reports connectors whose type label disagrees with entry harness types.
     * @param {object | null} harnesses Harness read model.
     * @returns {object[]}
     */
    static #harnessTypeMismatchFindings(harnesses) {
        const findings = []

        for (const connector of harnesses?.connectors || []) {
            const labelType =
                SchematicConnectivityQaBuilder.#normalizeHarnessType(
                    connector.typeLabel?.text
                )
            if (!labelType) {
                continue
            }

            for (const entry of connector.entries || []) {
                const entryType =
                    SchematicConnectivityQaBuilder.#normalizeHarnessType(
                        entry.harnessType
                    )
                if (!entryType || entryType === labelType) {
                    continue
                }

                findings.push({
                    code: 'schematic.connectivity.harness-type-mismatch',
                    severity: 'warning',
                    connectorKey: connector.key,
                    entryKey: entry.key,
                    labelHarnessType: connector.typeLabel?.text,
                    entryHarnessType: entry.harnessType,
                    name: entry.name
                })
            }
        }

        return findings
    }

    /**
     * Collects known local harness type names.
     * @param {object | null} harnesses Harness read model.
     * @returns {Set<string>}
     */
    static #knownHarnessTypes(harnesses) {
        const knownTypes = new Set()

        for (const connector of harnesses?.connectors || []) {
            SchematicConnectivityQaBuilder.#addHarnessType(
                knownTypes,
                connector.typeLabel?.text
            )
            for (const entry of connector.entries || []) {
                SchematicConnectivityQaBuilder.#addHarnessType(
                    knownTypes,
                    entry.harnessType
                )
            }
        }
        for (const link of harnesses?.bundleLinks || []) {
            SchematicConnectivityQaBuilder.#addHarnessType(
                knownTypes,
                link.harnessType
            )
        }

        return knownTypes
    }

    /**
     * Adds one normalized harness type to a set.
     * @param {Set<string>} knownTypes Known type set.
     * @param {unknown} value Raw harness type.
     * @returns {void}
     */
    static #addHarnessType(knownTypes, value) {
        const normalized =
            SchematicConnectivityQaBuilder.#normalizeHarnessType(value)
        if (normalized) {
            knownTypes.add(normalized)
        }
    }

    /**
     * Normalizes one harness type for local comparisons.
     * @param {unknown} value Raw harness type.
     * @returns {string}
     */
    static #normalizeHarnessType(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
    }

    /**
     * Reports segment endpoints that touch another segment interior without an
     * authored junction at the contact point.
     * @param {object[]} lines Normalized line segments.
     * @param {object[]} junctions Authored junctions.
     * @returns {object[]}
     */
    static #unjunctionedTeeContactFindings(lines, junctions) {
        const findings = []
        const seen = new Set()

        for (
            let segmentIndex = 0;
            segmentIndex < lines.length;
            segmentIndex += 1
        ) {
            const segment = lines[segmentIndex]
            if (!SchematicConnectivityQaBuilder.#isUsableSegment(segment)) {
                continue
            }

            for (const point of SchematicConnectivityQaBuilder.#segmentEndpoints(
                segment
            )) {
                if (
                    junctions.some((junction) =>
                        SchematicConnectivityQaBuilder.#samePoint(
                            point,
                            junction
                        )
                    )
                ) {
                    continue
                }

                for (
                    let touchedSegmentIndex = 0;
                    touchedSegmentIndex < lines.length;
                    touchedSegmentIndex += 1
                ) {
                    if (touchedSegmentIndex === segmentIndex) {
                        continue
                    }

                    const touchedSegment = lines[touchedSegmentIndex]
                    if (
                        !SchematicConnectivityQaBuilder.#isUsableSegment(
                            touchedSegment
                        ) ||
                        SchematicConnectivityQaBuilder.#isSegmentEndpoint(
                            touchedSegment,
                            point
                        ) ||
                        !SchematicConnectivityQaBuilder.#segmentContainsPoint(
                            touchedSegment,
                            point
                        )
                    ) {
                        continue
                    }

                    const key =
                        SchematicConnectivityQaBuilder.#pointKey(point) +
                        ':' +
                        segmentIndex +
                        ':' +
                        touchedSegmentIndex
                    if (seen.has(key)) {
                        continue
                    }
                    seen.add(key)
                    findings.push({
                        code: 'schematic.connectivity.unjunctioned-tee-contact',
                        severity: 'warning',
                        x: point.x,
                        y: point.y,
                        segmentIndex,
                        touchedSegmentIndex
                    })
                }
            }
        }

        return findings
    }

    /**
     * Returns true when a pin name resembles a power rail label.
     * @param {unknown} value Pin name.
     * @returns {boolean}
     */
    static #isPowerLikePinName(value) {
        const name = String(value || '')
            .trim()
            .toUpperCase()

        return (
            /^(GND|AGND|DGND|PGND|VCC|VDD|VSS|VEE|VBAT|VBUS)$/u.test(name) ||
            /^[+-]?\d+(?:\.\d+)?V(?:_[A-Z0-9]+)?$/u.test(name) ||
            /^V(?:IN|OUT|REF|CORE|IO|A|D|P)(?:_[A-Z0-9]+)?$/u.test(name)
        )
    }

    /**
     * Returns true when an electrical type code represents a power pin.
     * @param {unknown} value Electrical type code.
     * @returns {boolean}
     */
    static #isPowerElectricalType(value) {
        const electrical = Number(value)

        return electrical === 7 || electrical === 8
    }

    /**
     * Counts findings with one code.
     * @param {object[]} findings QA findings.
     * @param {string} code Diagnostic code.
     * @returns {number}
     */
    static #countCode(findings, code) {
        return findings.filter((finding) => finding.code === code).length
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

    /**
     * Compares text rows by text and point.
     * @param {object} left First row.
     * @param {object} right Second row.
     * @returns {boolean}
     */
    static #sameTextPoint(left, right) {
        return (
            String(left.text || '') === String(right.text || '') &&
            SchematicConnectivityQaBuilder.#samePoint(left, right)
        )
    }

    /**
     * Compares named rows by name and point.
     * @param {object} left First row.
     * @param {object} right Second row.
     * @returns {boolean}
     */
    static #sameNamedPoint(left, right) {
        return (
            String(left.name || '') === String(right.name || '') &&
            SchematicConnectivityQaBuilder.#samePoint(left, right)
        )
    }

    /**
     * Compares pin rows by identity and point.
     * @param {object} left First pin.
     * @param {object} right Second pin.
     * @returns {boolean}
     */
    static #samePin(left, right) {
        return (
            String(left.ownerIndex || '') === String(right.ownerIndex || '') &&
            String(left.designator || '') === String(right.designator || '') &&
            SchematicConnectivityQaBuilder.#samePoint(left, right)
        )
    }

    /**
     * Returns true for a non-degenerate line segment.
     * @param {object} segment Line segment.
     * @returns {boolean}
     */
    static #isUsableSegment(segment) {
        return !SchematicConnectivityQaBuilder.#samePoint(
            { x: segment?.x1, y: segment?.y1 },
            { x: segment?.x2, y: segment?.y2 }
        )
    }

    /**
     * Lists the two endpoints of a segment.
     * @param {object} segment Line segment.
     * @returns {{ x: number, y: number }[]}
     */
    static #segmentEndpoints(segment) {
        return [
            { x: Number(segment.x1), y: Number(segment.y1) },
            { x: Number(segment.x2), y: Number(segment.y2) }
        ]
    }

    /**
     * Returns true when a point matches either segment endpoint.
     * @param {object} segment Line segment.
     * @param {{ x: number, y: number }} point Test point.
     * @returns {boolean}
     */
    static #isSegmentEndpoint(segment, point) {
        return SchematicConnectivityQaBuilder.#segmentEndpoints(segment).some(
            (endpoint) =>
                SchematicConnectivityQaBuilder.#samePoint(endpoint, point)
        )
    }

    /**
     * Returns true when a point lies on a segment.
     * @param {object} segment Line segment.
     * @param {{ x: number, y: number }} point Test point.
     * @returns {boolean}
     */
    static #segmentContainsPoint(segment, point) {
        const x1 = Number(segment.x1)
        const y1 = Number(segment.y1)
        const x2 = Number(segment.x2)
        const y2 = Number(segment.y2)
        const x = Number(point.x)
        const y = Number(point.y)
        const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)

        if (Math.abs(cross) > 0.01) {
            return false
        }

        return (
            x >= Math.min(x1, x2) - 0.01 &&
            x <= Math.max(x1, x2) + 0.01 &&
            y >= Math.min(y1, y2) - 0.01 &&
            y <= Math.max(y1, y2) + 0.01
        )
    }

    /**
     * Builds a stable key fragment for one point.
     * @param {{ x: number, y: number }} point Point.
     * @returns {string}
     */
    static #pointKey(point) {
        return Number(point.x).toFixed(2) + ',' + Number(point.y).toFixed(2)
    }

    /**
     * Compares points with a small parser-tolerance.
     * @param {object} left First point.
     * @param {object} right Second point.
     * @returns {boolean}
     */
    static #samePoint(left, right) {
        return (
            Math.abs(Number(left.x) - Number(right.x)) <= 0.01 &&
            Math.abs(Number(left.y) - Number(right.y)) <= 0.01
        )
    }
}
