// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { CircuitJsonModelAdapterPrimitives } from '../core/circuit-json/CircuitJsonModelAdapterPrimitives.mjs'
import { CircuitJsonSchematicGraphicBuilder } from '../core/circuit-json/CircuitJsonSchematicGraphicBuilder.mjs'
import { AltiumSchematicCoordinateProjection } from './AltiumSchematicCoordinateProjection.mjs'

const Primitives = CircuitJsonModelAdapterPrimitives
const LEGACY_SCHEMATIC_DRAWING_TYPES = new Set([
    'schematic_line',
    'schematic_net_label',
    'schematic_text',
    'schematic_trace'
])

/**
 * Enriches the frozen native adapter output at the common API boundary.
 */
export class AltiumCircuitJsonProjection {
    /**
     * Replaces the legacy minimal drawing subset with the rich common model.
     * @param {object[]} adapted Historical adapter output.
     * @param {Record<string, any>} native Native renderer model.
     * @returns {object[]} Canonical CircuitJSON rows.
     */
    static project(adapted, native) {
        const elementsWithProjectedPadShapes =
            AltiumCircuitJsonProjection.#projectPcbSmtPadShapes(
                adapted,
                native?.pcb
            )
        const nativeSchematic = native?.schematic
        if (!nativeSchematic) return elementsWithProjectedPadShapes
        const schematic =
            AltiumCircuitJsonProjection.#schematicWithSourceTypes(
                nativeSchematic
            )

        const sourceFormat = Primitives.sourceFormat(native)
        const idScope = Primitives.idScope(native, sourceFormat)
        const componentIds = AltiumCircuitJsonProjection.#componentIds(
            schematic,
            idScope
        )
        const hiddenComponentIds = new Set(
            Primitives.array(schematic.components)
                .filter(
                    (component) =>
                        component?.schematicDesignatorVisible === false
                )
                .map((component) => componentIds.get(component))
                .filter(Boolean)
        )
        const nativeComponentsById = new Map(
            Primitives.array(schematic.components).map((component) => [
                componentIds.get(component),
                component
            ])
        )
        const legacySchematicSourceTraceIds = new Set(
            elementsWithProjectedPadShapes
                .filter((element) => element?.type === 'schematic_trace')
                .map((element) => String(element.source_trace_id || ''))
                .filter(Boolean)
        )
        const protectedPcbSourceTraceIds = new Set(
            elementsWithProjectedPadShapes
                .filter((element) => element?.type === 'pcb_trace')
                .map((element) => String(element.source_trace_id || ''))
                .filter(Boolean)
        )
        const model = elementsWithProjectedPadShapes
            .filter((element) =>
                AltiumCircuitJsonProjection.#preservesAdaptedElement(
                    element,
                    legacySchematicSourceTraceIds,
                    protectedPcbSourceTraceIds
                )
            )
            .map((element) => {
                if (element?.type !== 'schematic_component') return element
                const component = nativeComponentsById.get(
                    element.schematic_component_id
                )
                return {
                    ...element,
                    rotation: -(
                        Primitives.number(
                            component?.rotation,
                            element.rotation
                        ) || 0
                    ),
                    ...(hiddenComponentIds.has(element.schematic_component_id)
                        ? { show_label: false }
                        : {})
                }
            })
        const netIds = AltiumCircuitJsonProjection.#netIds(model)

        model.push(
            AltiumCircuitJsonProjection.#rootSheet(schematic, native, idScope)
        )

        CircuitJsonSchematicGraphicBuilder.append(
            model,
            schematic,
            idScope,
            componentIds,
            netIds
        )
        return AltiumSchematicCoordinateProjection.project(
            model,
            schematic?.sheet?.height
        )
    }

    /**
     * Restores anisotropic Altium ROUND pads as CircuitJSON pills while the
     * historical native adapter remains byte-for-byte frozen.
     * @param {object[]} adapted Historical adapter output.
     * @param {Record<string, any> | undefined} pcb Native PCB model.
     * @returns {object[]} PCB-shape-corrected canonical rows.
     */
    static #projectPcbSmtPadShapes(adapted, pcb) {
        const nativeSmtPads = Primitives.array(pcb?.pads).filter(
            (pad) => !Primitives.isThroughHolePad(pad)
        )
        let smtPadIndex = 0

        return adapted.map((element) => {
            if (element?.type !== 'pcb_smtpad') return element

            const nativePad = nativeSmtPads[smtPadIndex]
            smtPadIndex += 1
            if (
                !AltiumCircuitJsonProjection.#isAnisotropicRoundPad(nativePad)
            ) {
                return element
            }

            const width = Primitives.milNumber(
                nativePad.sizeTopX || nativePad.sizeX || nativePad.width,
                0
            )
            const height = Primitives.milNumber(
                nativePad.sizeTopY || nativePad.sizeY || nativePad.height,
                0
            )
            const rotation =
                Primitives.number(
                    nativePad.rotation || nativePad.holeRotation,
                    0
                ) || 0

            return {
                ...element,
                shape: rotation === 0 ? 'pill' : 'rotated_pill',
                width,
                height,
                radius: Primitives.round(Math.min(width, height) / 2),
                ...(rotation === 0 ? {} : { ccw_rotation: rotation })
            }
        })
    }

    /**
     * Returns whether one native ROUND pad has distinct X and Y dimensions.
     * @param {Record<string, any> | undefined} pad Native PCB pad.
     * @returns {boolean} Whether canonical output requires pill geometry.
     */
    static #isAnisotropicRoundPad(pad) {
        const shape = String(
            pad?.shapeTopName || pad?.shapeName || pad?.shape || ''
        )
            .trim()
            .toLowerCase()
        if (shape !== 'round' && shape !== 'circle') return false

        const width =
            Primitives.number(pad?.sizeTopX ?? pad?.sizeX ?? pad?.width, 0) || 0
        const height =
            Primitives.number(pad?.sizeTopY ?? pad?.sizeY ?? pad?.height, 0) ||
            0

        return width > 0 && height > 0 && width !== height
    }

    /**
     * Classifies native Altium record-27 wire segments at the convergence
     * boundary while preserving explicit source-neutral classifications.
     * @param {Record<string, any>} schematic Historical native schematic.
     * @returns {Record<string, any>} Projection-owned schematic view.
     */
    static #schematicWithSourceTypes(schematic) {
        return {
            ...schematic,
            lines: Primitives.array(schematic.lines).map((line) =>
                Object.hasOwn(line || {}, 'sourceType')
                    ? line
                    : {
                          ...line,
                          sourceType:
                              String(line?.recordType || '') === '27'
                                  ? 'wire'
                                  : 'graphic'
                      }
            )
        }
    }

    /**
     * Keeps source traces unless they exclusively back the legacy schematic
     * projection. PCB and unrelated source relations remain byte-for-byte.
     * @param {Record<string, any>} element Adapted CircuitJSON row.
     * @param {Set<string>} legacySchematicSourceTraceIds Schematic trace ids.
     * @param {Set<string>} protectedPcbSourceTraceIds PCB trace ids.
     * @returns {boolean} Whether the adapted row belongs in the rich model.
     */
    static #preservesAdaptedElement(
        element,
        legacySchematicSourceTraceIds,
        protectedPcbSourceTraceIds
    ) {
        const type = String(element?.type || '')
        if (LEGACY_SCHEMATIC_DRAWING_TYPES.has(type)) return false
        if (type !== 'source_trace') return true

        const id = String(element.source_trace_id || '')
        return (
            !legacySchematicSourceTraceIds.has(id) ||
            protectedPcbSourceTraceIds.has(id)
        )
    }

    /**
     * Projects the source page as the root sheet, not a child-sheet symbol.
     * @param {Record<string, any>} schematic Native schematic.
     * @param {Record<string, any>} native Native document.
     * @param {string} idScope Document id scope.
     * @returns {object} Canonical root-sheet row.
     */
    static #rootSheet(schematic, native, idScope) {
        return {
            type: 'schematic_sheet',
            schematic_sheet_id: Primitives.id(idScope, [
                'schematic_sheet',
                'root'
            ]),
            name: Primitives.string(
                native?.summary?.title || native?.fileName,
                'Main'
            ),
            sheet_index: 0,
            width: Math.max(
                Primitives.number(schematic?.sheet?.width, 0) || 0,
                0
            ),
            height: Math.max(
                Primitives.number(schematic?.sheet?.height, 0) || 0,
                0
            )
        }
    }

    /**
     * Reconstructs historical deterministic component ids without mutation.
     * @param {Record<string, any>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @returns {Map<object, string>} Native component id lookup.
     */
    static #componentIds(schematic, idScope) {
        const ids = new Map()
        for (const [index, component] of Primitives.array(
            schematic?.components
        ).entries()) {
            ids.set(
                component,
                Primitives.id(idScope, [
                    'schematic_component',
                    component?.designator || component?.name || index
                ])
            )
        }
        return ids
    }

    /**
     * Indexes canonical source nets by their native names.
     * @param {object[]} model Canonical rows.
     * @returns {Map<string, string>} Source-net id lookup.
     */
    static #netIds(model) {
        return new Map(
            model
                .filter((element) => element?.type === 'source_net')
                .map((element) => [
                    String(element.name || ''),
                    String(element.source_net_id || '')
                ])
                .filter(([name, id]) => name && id)
        )
    }
}

Object.freeze(AltiumCircuitJsonProjection.prototype)
Object.freeze(AltiumCircuitJsonProjection)
