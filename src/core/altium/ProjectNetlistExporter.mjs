// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic netlist exports from normalized project bundles.
 */
export class ProjectNetlistExporter {
    /**
     * Builds a line-oriented wirelist for CI and downstream tooling.
     * @param {object} bundle Normalized design bundle or effective variant.
     * @returns {string}
     */
    static buildWirelist(bundle) {
        const netlist = ProjectNetlistExporter.buildNetlistJson(bundle)
        const lines = [
            '# altium-toolkit wirelist v1',
            'project ' + netlist.project
        ]

        for (const net of netlist.nets) {
            lines.push('net ' + net.name)
            for (const pin of net.pins) {
                lines.push('  ' + pin.component + '.' + pin.pin)
            }
        }

        lines.push('')
        return lines.join('\n')
    }

    /**
     * Builds a deterministic JSON netlist contract.
     * @param {object} bundle Normalized design bundle or effective variant.
     * @returns {{ schema: string, project: string, nets: object[] }}
     */
    static buildNetlistJson(bundle) {
        const projectName =
            bundle?.project?.name ||
            bundle?.projectName ||
            bundle?.name ||
            bundle?.summary?.title ||
            ''
        const nets = (bundle?.nets || [])
            .map((net) => ({
                name: String(net?.name || ''),
                aliases: ProjectNetlistExporter.#netAliases(net),
                autoNamed: ProjectNetlistExporter.#isAutoNamedNet(net?.name),
                signal: ProjectNetlistExporter.#signalDescriptor(net),
                pins: ProjectNetlistExporter.#netPins(net),
                sources: ProjectNetlistExporter.#netSources(net),
                pcb: ProjectNetlistExporter.#pcbSources(net)
            }))
            .filter((net) => net.name)
            .sort((left, right) =>
                left.name.localeCompare(right.name, undefined, {
                    numeric: true
                })
            )

        return {
            schema: 'altium-toolkit.netlist.a1',
            project: projectName,
            nets
        }
    }

    /**
     * Extracts deterministic pins from one normalized net row.
     * @param {object} net Net row.
     * @returns {object[]}
     */
    static #netPins(net) {
        const endpointsByPin = ProjectNetlistExporter.#pinEndpointMap(net)
        const pins = (net?.pins || [])
            .map((pin) =>
                ProjectNetlistExporter.#pinDescriptor(pin, endpointsByPin)
            )
            .filter((pin) => pin.component && pin.pin)

        return ProjectNetlistExporter.#dedupePins(pins).sort((left, right) => {
            const componentOrder = left.component.localeCompare(
                right.component,
                undefined,
                { numeric: true }
            )
            return (
                componentOrder ||
                left.pin.localeCompare(right.pin, undefined, { numeric: true })
            )
        })
    }

    /**
     * Deduplicates pins while preserving first-seen data.
     * @param {object[]} pins Candidate pins.
     * @returns {object[]}
     */
    static #dedupePins(pins) {
        const byKey = new Map()
        for (const pin of pins || []) {
            const key = pin.component + '\u0000' + pin.pin
            if (!byKey.has(key)) {
                byKey.set(key, pin)
                continue
            }

            const existing = byKey.get(key)
            existing.duplicateOccurrences ||= []
            existing.duplicateOccurrences.push(
                ProjectNetlistExporter.#duplicatePinDescriptor(pin)
            )
        }
        return [...byKey.values()]
    }

    /**
     * Builds one terminal descriptor from a normalized pin row.
     * @param {object} pin Pin row.
     * @param {Map<string, object[]>} endpointsByPin Endpoint lookup.
     * @returns {object}
     */
    static #pinDescriptor(pin, endpointsByPin) {
        const component = ProjectNetlistExporter.#pinComponent(pin)
        const pinNumber = ProjectNetlistExporter.#pinNumber(pin)
        const endpoints =
            endpointsByPin.get(
                ProjectNetlistExporter.#pinKey(component, pinNumber)
            ) || []
        const hierarchyPath = ProjectNetlistExporter.#dedupe(
            endpoints.flatMap((endpoint) => endpoint.hierarchyPath || [])
        )

        return ProjectNetlistExporter.#stripEmpty({
            component,
            pin: pinNumber,
            name: pin?.name && pin.name !== pinNumber ? String(pin.name) : '',
            hierarchyPath,
            ownerPartId: ProjectNetlistExporter.#ownerPartId(pin),
            partUniqueId: ProjectNetlistExporter.#partUniqueId(pin),
            isMultiPart: pin?.isMultiPart === true ? true : undefined,
            alternatePartSuffix:
                ProjectNetlistExporter.#alternatePartSuffix(pin),
            endpoints: endpoints.map(
                ({ hierarchyPath: _hierarchyPath, ...endpoint }) => endpoint
            )
        })
    }

    /**
     * Builds compact duplicate-pin provenance.
     * @param {object} pin Pin descriptor.
     * @returns {object}
     */
    static #duplicatePinDescriptor(pin) {
        return ProjectNetlistExporter.#stripEmpty({
            component: pin.component,
            pin: pin.pin,
            name: pin.name,
            ownerPartId: pin.ownerPartId,
            partUniqueId: pin.partUniqueId,
            isMultiPart: pin.isMultiPart,
            alternatePartSuffix: pin.alternatePartSuffix
        })
    }

    /**
     * Builds schematic endpoint lookup rows for all pins in one net.
     * @param {object} net Net row.
     * @returns {Map<string, object[]>}
     */
    static #pinEndpointMap(net) {
        const endpointsByPin = new Map()

        for (const source of net?.schematic || []) {
            const sheet = String(source?.fileName || '')
            const hierarchyPath = ProjectNetlistExporter.#hierarchyPath(source)
            for (const pin of source?.pins || []) {
                const component = ProjectNetlistExporter.#pinComponent(pin)
                const pinNumber = ProjectNetlistExporter.#pinNumber(pin)
                if (!component || !pinNumber) {
                    continue
                }

                const key = ProjectNetlistExporter.#pinKey(component, pinNumber)
                if (!endpointsByPin.has(key)) {
                    endpointsByPin.set(key, [])
                }
                endpointsByPin.get(key).push({
                    kind: 'schematic-pin',
                    key: sheet + ':pin:' + component + '.' + pinNumber,
                    sheet,
                    component,
                    pin: pinNumber,
                    hierarchyPath
                })
            }
        }

        return endpointsByPin
    }

    /**
     * Builds graphical source groups for one net.
     * @param {object} net Net row.
     * @returns {object[]}
     */
    static #netSources(net) {
        return (net?.schematic || []).map((source) => {
            const sheet = String(source?.fileName || '')

            return ProjectNetlistExporter.#stripEmpty({
                sheet,
                hierarchyPath: ProjectNetlistExporter.#hierarchyPath(source),
                aliases: ProjectNetlistExporter.#sourceAliases(source),
                graphicalElements: ProjectNetlistExporter.#graphicalElements(
                    source,
                    sheet
                )
            })
        })
    }

    /**
     * Builds graphical element rows for one schematic net source.
     * @param {object} source Schematic net source.
     * @param {string} sheet Sheet file name.
     * @returns {object[]}
     */
    static #graphicalElements(source, sheet) {
        return [
            ...(source?.segments || []).map((segment, index) =>
                ProjectNetlistExporter.#stripEmpty({
                    kind: 'segment',
                    key: sheet + ':segment:' + index,
                    x1: segment.x1,
                    y1: segment.y1,
                    x2: segment.x2,
                    y2: segment.y2
                })
            ),
            ...(source?.labels || []).map((label, index) =>
                ProjectNetlistExporter.#stripEmpty({
                    kind: 'label',
                    key: sheet + ':label:' + index,
                    text: label.text,
                    x: label.x,
                    y: label.y
                })
            ),
            ...(source?.ports || []).map((port, index) =>
                ProjectNetlistExporter.#stripEmpty({
                    kind: 'port',
                    key: sheet + ':port:' + index,
                    text: port.name,
                    x: port.x,
                    y: port.y
                })
            ),
            ...(source?.sheetEntries || []).map((entry, index) =>
                ProjectNetlistExporter.#stripEmpty({
                    kind: 'sheet-entry',
                    key: sheet + ':sheet-entry:' + index,
                    text: entry.name,
                    x: entry.x,
                    y: entry.y
                })
            )
        ]
    }

    /**
     * Extracts PCB net provenance rows.
     * @param {object} net Net row.
     * @returns {object[]}
     */
    static #pcbSources(net) {
        return (net?.pcb || []).map((entry) =>
            ProjectNetlistExporter.#stripEmpty({
                fileName: entry.fileName,
                netIndex: entry.netIndex,
                uniqueId: entry.uniqueId
            })
        )
    }

    /**
     * Collects known aliases for one net.
     * @param {object} net Net row.
     * @returns {string[]}
     */
    static #netAliases(net) {
        return ProjectNetlistExporter.#dedupe(
            (net?.schematic || []).flatMap((source) =>
                ProjectNetlistExporter.#sourceAliases(source)
            )
        )
    }

    /**
     * Collects aliases visible in one schematic net source.
     * @param {object} source Schematic net source.
     * @returns {string[]}
     */
    static #sourceAliases(source) {
        return ProjectNetlistExporter.#dedupe([
            ...(source?.labels || []).map((label) => label.text),
            ...(source?.powerPorts || []).map((port) => port.text),
            ...(source?.ports || []).map((port) => port.name),
            ...(source?.sheetEntries || []).map((entry) => entry.name)
        ])
    }

    /**
     * Resolves a source hierarchy path.
     * @param {object} source Schematic source row.
     * @returns {string[]}
     */
    static #hierarchyPath(source) {
        if (
            Array.isArray(source?.hierarchyPath) &&
            source.hierarchyPath.length
        ) {
            return source.hierarchyPath.map((part) => String(part))
        }

        return source?.fileName ? [String(source.fileName)] : []
    }

    /**
     * Builds signal shape metadata for one net.
     * @param {object} net Net row.
     * @returns {{ type: string, baseName: string, suffix: string, sourceHints: string[] }}
     */
    static #signalDescriptor(net) {
        const name = String(net?.name || '')
        const bracket = name.match(/^(.+?)(\[[^\]]+\])$/u)
        const sourceHints = ProjectNetlistExporter.#signalSourceHints(net)
        const baseName = bracket ? bracket[1] : name
        const suffix = bracket ? bracket[2] : ''
        let type = 'normal'

        if (sourceHints.includes('harness')) {
            type = 'harness'
        } else if (suffix && /(?:\.\.|:|,)/u.test(suffix)) {
            type = 'wide'
        } else if (suffix) {
            type = 'sub'
        } else if (sourceHints.includes('bus')) {
            type = 'bus'
        }

        return {
            type,
            baseName,
            suffix,
            sourceHints
        }
    }

    /**
     * Collects source-derived signal hints.
     * @param {object} net Net row.
     * @returns {string[]}
     */
    static #signalSourceHints(net) {
        const hints = []
        const schematicSources = net?.schematic || []
        const hasHarness = schematicSources.some(
            (source) =>
                (source?.harnesses || []).length ||
                (source?.sheetEntries || []).some(
                    (entry) => entry?.harnessType
                ) ||
                (source?.ports || []).some((port) => port?.harnessType)
        )
        const hasBus = schematicSources.some(
            (source) =>
                (source?.busEntries || []).length ||
                (source?.segments || []).some(
                    (segment) => segment?.isBus === true
                )
        )

        if (hasHarness) hints.push('harness')
        if (hasBus) hints.push('bus')

        return hints
    }

    /**
     * Resolves native owner-part provenance from a pin row.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #ownerPartId(pin) {
        return String(
            pin?.ownerPartId ||
                pin?.ownerPartUniqueId ||
                pin?.ownerPartUid ||
                ''
        ).trim()
    }

    /**
     * Resolves the native part unique id from a pin row.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #partUniqueId(pin) {
        return String(pin?.partUniqueId || pin?.partUid || '').trim()
    }

    /**
     * Returns an alternate-part suffix from a variant-qualified part id.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #alternatePartSuffix(pin) {
        const partUniqueId = ProjectNetlistExporter.#partUniqueId(pin)
        return partUniqueId.includes('@')
            ? partUniqueId.split('@').slice(1).join('@')
            : ''
    }

    /**
     * Resolves a component designator from a pin row.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #pinComponent(pin) {
        return String(pin?.componentDesignator || pin?.ownerIndex || '').trim()
    }

    /**
     * Resolves a pin number from a pin row.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #pinNumber(pin) {
        return String(
            pin?.pin || pin?.designator || pin?.number || pin?.name || ''
        ).trim()
    }

    /**
     * Builds a stable pin lookup key.
     * @param {string} component Component designator.
     * @param {string} pin Pin number.
     * @returns {string}
     */
    static #pinKey(component, pin) {
        return component + '\u0000' + pin
    }

    /**
     * Returns true when a net name was synthesized.
     * @param {unknown} name Net name.
     * @returns {boolean}
     */
    static #isAutoNamedNet(name) {
        return /^UnknownNet\d+$/u.test(String(name || ''))
    }

    /**
     * Deduplicates non-empty strings.
     * @param {unknown[]} values Candidate values.
     * @returns {string[]}
     */
    static #dedupe(values) {
        return [
            ...new Set(
                (values || [])
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
            )
        ]
    }

    /**
     * Drops empty object fields while preserving zero and false.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) {
                    return entryValue.length > 0
                }
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
