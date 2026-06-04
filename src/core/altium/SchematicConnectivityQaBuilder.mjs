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
     * @param {{ nets?: object[], texts?: object[], pins?: object[], ports?: object[], junctions?: object[] }} schematic Normalized schematic fragments.
     * @returns {object}
     */
    static build(schematic) {
        const nets = Array.isArray(schematic?.nets) ? schematic.nets : []
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
        return {
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
