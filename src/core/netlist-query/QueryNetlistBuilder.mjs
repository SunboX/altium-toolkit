// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ComponentGrouping } from './ComponentGrouping.mjs'

/**
 * Builds compact query netlists from normalized toolkit document models.
 */
export class QueryNetlistBuilder {
    /**
     * Builds the query netlist for one document model.
     * @param {object} documentModel Document model.
     * @returns {{ nets: object, components: object }}
     */
    static build(documentModel) {
        const components =
            QueryNetlistBuilder.#buildComponentDetails(documentModel)
        const nets = {}

        for (const net of documentModel?.schematic?.nets || []) {
            const netName = String(net?.name || '').trim()
            if (!netName) continue

            for (const pin of net.pins || []) {
                const refdes = QueryNetlistBuilder.#resolvePinRefdes(
                    pin,
                    components
                )
                const pinNumber = QueryNetlistBuilder.#resolvePinNumber(pin)
                if (!refdes || !pinNumber) continue

                nets[netName] ||= {}
                const existing = nets[netName][refdes]
                nets[netName][refdes] = QueryNetlistBuilder.#appendPin(
                    existing,
                    pinNumber
                )
                components[refdes] ||= { pins: {} }
                components[refdes].pins[pinNumber] =
                    QueryNetlistBuilder.#pinEntry(pinNumber, pin?.name, netName)
            }
        }

        return { nets, components }
    }

    /**
     * Builds component metadata from schematic, PCB, and BOM records.
     * @param {object} documentModel Document model.
     * @returns {object}
     */
    static #buildComponentDetails(documentModel) {
        const components = {}

        for (const component of documentModel?.schematic?.components || []) {
            const refdes = String(component?.designator || '').trim()
            if (!refdes) continue
            components[refdes] = {
                ...components[refdes],
                value: component.value || components[refdes]?.value,
                description:
                    component.description || components[refdes]?.description,
                comment: component.comment || components[refdes]?.comment,
                ownerIndex:
                    component.ownerIndex || components[refdes]?.ownerIndex,
                dns:
                    component.dns ||
                    component.excludeFromBom ||
                    components[refdes]?.dns,
                excludeFromBom:
                    component.excludeFromBom ||
                    components[refdes]?.excludeFromBom,
                pins: components[refdes]?.pins || {}
            }
        }

        for (const component of documentModel?.pcb?.components || []) {
            const refdes = String(component?.designator || '').trim()
            if (!refdes) continue
            components[refdes] = {
                ...components[refdes],
                description:
                    component.description ||
                    component.pattern ||
                    components[refdes]?.description,
                value: component.value || components[refdes]?.value,
                comment: component.comment || components[refdes]?.comment,
                pins: components[refdes]?.pins || {}
            }
        }

        for (const row of documentModel?.bom || []) {
            for (const refdes of row.designators || []) {
                const normalizedRefdes = String(refdes || '').trim()
                if (!normalizedRefdes) continue
                components[normalizedRefdes] = {
                    ...components[normalizedRefdes],
                    mpn: row.pattern || components[normalizedRefdes]?.mpn,
                    description:
                        row.source || components[normalizedRefdes]?.description,
                    value: row.value || components[normalizedRefdes]?.value,
                    pins: components[normalizedRefdes]?.pins || {}
                }
            }
        }

        return components
    }

    /**
     * Resolves a pin's owning reference designator.
     * @param {object} pin Net pin.
     * @param {object} components Component details.
     * @returns {string}
     */
    static #resolvePinRefdes(pin, components) {
        const direct = String(
            pin?.refdes ||
                pin?.componentRefdes ||
                pin?.componentDesignator ||
                pin?.ownerDesignator ||
                ''
        ).trim()
        if (direct) return direct

        const ownerIndex = String(pin?.ownerIndex || '').trim()
        if (!ownerIndex) return ''

        return (
            Object.entries(components).find(([, component]) => {
                return String(component.ownerIndex || '') === ownerIndex
            })?.[0] || ''
        )
    }

    /**
     * Resolves a pin number.
     * @param {object} pin Net pin.
     * @returns {string}
     */
    static #resolvePinNumber(pin) {
        return String(
            pin?.pinNumber || pin?.number || pin?.designator || ''
        ).trim()
    }

    /**
     * Appends a pin to a compact net connection value.
     * @param {string | string[] | undefined} existing Existing pins.
     * @param {string} pinNumber Pin number.
     * @returns {string | string[]}
     */
    static #appendPin(existing, pinNumber) {
        if (!existing) return pinNumber
        const pins = Array.isArray(existing) ? existing : [existing]
        if (!pins.includes(pinNumber)) {
            pins.push(pinNumber)
        }
        return ComponentGrouping.compactArray(
            pins.sort(ComponentGrouping.naturalSort)
        )
    }

    /**
     * Builds a compact pin entry.
     * @param {string} pinNumber Pin number.
     * @param {string | undefined} pinName Pin name.
     * @param {string} netName Net name.
     * @returns {string | { name: string, net: string }}
     */
    static #pinEntry(pinNumber, pinName, netName) {
        const normalizedName = String(pinName || '').trim()
        if (normalizedName && normalizedName !== pinNumber) {
            return { name: normalizedName, net: netName }
        }

        return netName
    }
}
