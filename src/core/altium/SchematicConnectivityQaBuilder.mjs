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
     * @param {{ nets?: object[], texts?: object[], pins?: object[], ports?: object[], junctions?: object[], lines?: object[] }} schematic Normalized schematic fragments.
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
            )
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

        if (unjunctionedTeeContactCount) {
            summary.unjunctionedTeeContactCount = unjunctionedTeeContactCount
        }

        return summary
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
     * Counts findings with one code.
     * @param {object[]} findings QA findings.
     * @param {string} code Diagnostic code.
     * @returns {number}
     */
    static #countCode(findings, code) {
        return findings.filter((finding) => finding.code === code).length
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
