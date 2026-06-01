// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { CircuitJsonModelSchema } from './CircuitJsonModelSchema.mjs'
import { CircuitJsonModelAdapterPrimitives } from './CircuitJsonModelAdapterPrimitives.mjs'

const Primitives = CircuitJsonModelAdapterPrimitives

/**
 * Converts between legacy renderer models and Circuit JSON element arrays.
 */
export class CircuitJsonModelAdapter {
    /**
     * Converts a renderer model to a Circuit JSON array.
     * @param {Record<string, unknown> | object[]} rendererModel
     * @returns {object[]}
     */
    static fromRendererModel(rendererModel) {
        if (CircuitJsonModelSchema.isModel(rendererModel)) {
            return CircuitJsonModelSchema.attach(rendererModel)
        }

        const model = rendererModel || {}
        const circuitJson = []
        const sourceFormat = Primitives.sourceFormat(model)
        const idScope = Primitives.idScope(model, sourceFormat)

        CircuitJsonModelAdapter.#appendProjectMetadata(
            circuitJson,
            model,
            sourceFormat
        )

        if (model.schematic) {
            CircuitJsonModelAdapter.#appendSchematic(
                circuitJson,
                model,
                idScope
            )
        }

        if (model.pcb) {
            CircuitJsonModelAdapter.#appendPcb(circuitJson, model, idScope)
        }

        if (model.pcbLibrary) {
            CircuitJsonModelAdapter.#appendPcbLibrary(
                circuitJson,
                model,
                idScope
            )
        }

        CircuitJsonModelAdapter.#appendBom(circuitJson, model, idScope)
        CircuitJsonModelAdapter.#attachCompatibility(circuitJson, model)

        return CircuitJsonModelSchema.attach(circuitJson)
    }

    /**
     * Returns a renderer-compatible model for Circuit JSON parser output.
     * @param {object[] | Record<string, unknown>} circuitJson
     * @returns {Record<string, unknown>}
     */
    static toRendererModel(circuitJson) {
        if (
            circuitJson &&
            typeof circuitJson === 'object' &&
            !Array.isArray(circuitJson)
        ) {
            return circuitJson
        }

        if (
            circuitJson?.kind ||
            circuitJson?.schematic ||
            circuitJson?.pcb ||
            circuitJson?.pcbLibrary ||
            circuitJson?.project
        ) {
            return circuitJson
        }

        CircuitJsonModelSchema.assertModel(circuitJson)

        const metadata = circuitJson.find(
            (element) => element.type === 'source_project_metadata'
        )
        const hasPcb = circuitJson.some((element) =>
            String(element.type).startsWith('pcb_')
        )
        const hasSchematic = circuitJson.some((element) =>
            String(element.type).startsWith('schematic_')
        )

        return {
            schema: CircuitJsonModelSchema.CURRENT_SCHEMA_ID,
            kind: hasPcb ? 'pcb' : hasSchematic ? 'schematic' : 'project',
            fileType: 'CircuitJson',
            fileName: metadata?.name || 'circuit.json',
            summary: {
                title: metadata?.name || 'Circuit JSON',
                elementCount: circuitJson.length
            },
            diagnostics: [],
            circuitJson
        }
    }

    /**
     * Returns true when a value is a Circuit JSON model array.
     * @param {unknown} value
     * @returns {boolean}
     */
    static isCircuitJson(value) {
        return CircuitJsonModelSchema.isModel(value)
    }

    /**
     * Appends Circuit JSON project metadata.
     * @param {object[]} circuitJson
     * @param {Record<string, unknown>} model
     * @param {string} sourceFormat
     * @returns {void}
     */
    static #appendProjectMetadata(circuitJson, model, sourceFormat) {
        circuitJson.push({
            type: 'source_project_metadata',
            name:
                String(model.summary?.title || '').trim() ||
                Primitives.stripExtension(model.fileName) ||
                'Untitled circuit',
            software_used_string: sourceFormat
        })
    }

    /**
     * Appends schematic elements.
     * @param {object[]} circuitJson
     * @param {Record<string, unknown>} model
     * @param {string} idScope
     * @returns {void}
     */
    static #appendSchematic(circuitJson, model, idScope) {
        const schematic = model.schematic || {}
        const componentIds = new Map()
        const portIds = new Map()
        const netIds = new Map()

        for (const [componentIndex, component] of Primitives.array(
            schematic.components
        ).entries()) {
            const sourceComponentId = Primitives.id(idScope, [
                'source_component',
                component.designator || component.name || componentIndex
            ])
            componentIds.set(component, sourceComponentId)
            circuitJson.push(
                CircuitJsonModelAdapter.#sourceComponent(
                    sourceComponentId,
                    component,
                    componentIndex
                )
            )
            circuitJson.push({
                type: 'schematic_component',
                schematic_component_id: Primitives.id(idScope, [
                    'schematic_component',
                    component.designator || component.name || componentIndex
                ]),
                source_component_id: sourceComponentId,
                center: Primitives.point(component.x, component.y),
                size: {
                    width: Primitives.number(component.width, 0),
                    height: Primitives.number(component.height, 0)
                },
                rotation: Primitives.number(component.rotation, 0)
            })
        }

        for (const [pinIndex, pin] of Primitives.array(
            schematic.pins
        ).entries()) {
            const sourceComponentId =
                CircuitJsonModelAdapter.#sourceComponentIdForPin(
                    pin,
                    componentIds,
                    idScope,
                    circuitJson
                )
            const sourcePortId = Primitives.sourcePortId(
                idScope,
                pin,
                pinIndex,
                sourceComponentId
            )
            portIds.set(pin, sourcePortId)
            circuitJson.push({
                type: 'source_port',
                source_port_id: sourcePortId,
                source_component_id: sourceComponentId,
                name: Primitives.string(
                    pin.name || pin.designator || pinIndex,
                    String(pinIndex + 1)
                ),
                pin_number: Primitives.string(
                    pin.pinNumber || pin.designator || pin.name,
                    String(pinIndex + 1)
                )
            })
            circuitJson.push({
                type: 'schematic_port',
                schematic_port_id: Primitives.id(idScope, [
                    'schematic_port',
                    sourcePortId
                ]),
                source_port_id: sourcePortId,
                center: Primitives.point(pin.x, pin.y),
                facing_direction: Primitives.facingDirection(pin) || 'right'
            })
        }

        for (const [netIndex, net] of Primitives.array(
            schematic.nets
        ).entries()) {
            const sourceNetId = Primitives.sourceNetId(
                idScope,
                net.name || netIndex
            )
            netIds.set(net.name, sourceNetId)
            circuitJson.push({
                type: 'source_net',
                source_net_id: sourceNetId,
                name: Primitives.string(net.name, `NET_${netIndex + 1}`)
            })
        }

        for (const [lineIndex, line] of Primitives.array(
            schematic.lines
        ).entries()) {
            CircuitJsonModelAdapter.#appendSchematicLine(
                circuitJson,
                idScope,
                line,
                lineIndex,
                netIds
            )
        }

        for (const [textIndex, text] of Primitives.array(
            schematic.texts
        ).entries()) {
            CircuitJsonModelAdapter.#appendSchematicText(
                circuitJson,
                idScope,
                text,
                textIndex
            )
        }
    }

    /**
     * Appends PCB elements.
     * @param {object[]} circuitJson
     * @param {Record<string, unknown>} model
     * @param {string} idScope
     * @returns {void}
     */
    static #appendPcb(circuitJson, model, idScope) {
        const pcb = model.pcb || {}
        const componentIds = new Map()
        const sourceNetIds = new Map()
        const boardId = Primitives.id(idScope, ['pcb_board'])

        CircuitJsonModelAdapter.#appendPcbBoard(
            circuitJson,
            boardId,
            pcb.boardOutline,
            model
        )

        for (const [netIndex, net] of Primitives.array(pcb.nets).entries()) {
            const sourceNetId = Primitives.sourceNetId(
                idScope,
                net.name || net.netName || netIndex
            )
            sourceNetIds.set(
                String(net.name || net.netName || netIndex),
                sourceNetId
            )
            circuitJson.push({
                type: 'source_net',
                source_net_id: sourceNetId,
                name: Primitives.string(
                    net.name || net.netName,
                    `NET_${netIndex + 1}`
                )
            })
        }

        for (const [componentIndex, component] of Primitives.array(
            pcb.components
        ).entries()) {
            const sourceComponentId = Primitives.id(idScope, [
                'source_component',
                component.designator || component.name || componentIndex
            ])
            const pcbComponentId = Primitives.id(idScope, [
                'pcb_component',
                component.designator || component.name || componentIndex
            ])
            componentIds.set(
                Primitives.componentKey(component, componentIndex),
                sourceComponentId
            )
            circuitJson.push(
                CircuitJsonModelAdapter.#sourceComponent(
                    sourceComponentId,
                    component,
                    componentIndex
                )
            )
            circuitJson.push({
                type: 'pcb_component',
                pcb_component_id: pcbComponentId,
                source_component_id: sourceComponentId,
                center: Primitives.milPoint(component.x, component.y),
                layer: Primitives.side(component.layer),
                rotation: Primitives.number(component.rotation, 0),
                width: Primitives.milNumber(
                    component.width || component.widthMil,
                    0
                ),
                height: Primitives.milNumber(
                    component.height || component.heightMil,
                    0
                )
            })
        }

        for (const [padIndex, pad] of Primitives.array(pcb.pads).entries()) {
            CircuitJsonModelAdapter.#appendPcbPad(
                circuitJson,
                idScope,
                pad,
                padIndex,
                componentIds,
                sourceNetIds
            )
        }

        for (const [trackIndex, track] of Primitives.array(
            pcb.tracks
        ).entries()) {
            CircuitJsonModelAdapter.#appendPcbTrace(
                circuitJson,
                idScope,
                track,
                trackIndex,
                sourceNetIds
            )
        }

        for (const [viaIndex, via] of Primitives.array(pcb.vias).entries()) {
            CircuitJsonModelAdapter.#appendPcbVia(
                circuitJson,
                idScope,
                via,
                viaIndex,
                sourceNetIds
            )
        }
    }

    /**
     * Appends one PCB board element.
     * @param {object[]} circuitJson
     * @param {string} boardId
     * @param {Record<string, unknown>} boardOutline
     * @param {Record<string, unknown>} model
     * @returns {void}
     */
    static #appendPcbBoard(circuitJson, boardId, boardOutline, model) {
        const widthMil =
            Primitives.number(boardOutline?.widthMil, null) ??
            Primitives.number(model.summary?.boardWidthMil, 0)
        const heightMil =
            Primitives.number(boardOutline?.heightMil, null) ??
            Primitives.number(model.summary?.boardHeightMil, 0)
        const minX = Primitives.number(boardOutline?.minX, 0)
        const minY = Primitives.number(boardOutline?.minY, 0)
        const outline = Primitives.outlinePoints(boardOutline)

        circuitJson.push({
            type: 'pcb_board',
            pcb_board_id: boardId,
            center: Primitives.milPoint(
                minX + widthMil / 2,
                minY + heightMil / 2
            ),
            width: Primitives.milNumber(widthMil, 0),
            height: Primitives.milNumber(heightMil, 0),
            thickness: 1.6,
            num_layers: Primitives.number(model.summary?.layerCount, 2),
            material: 'fr4',
            outline,
            shape: 'rect'
        })
    }

    /**
     * Appends one PCB pad and related source port element.
     * @param {object[]} circuitJson
     * @param {string} idScope
     * @param {Record<string, unknown>} pad
     * @param {number} padIndex
     * @param {Map<string, string>} componentIds
     * @param {Map<string, string>} sourceNetIds
     * @returns {void}
     */
    static #appendPcbPad(
        circuitJson,
        idScope,
        pad,
        padIndex,
        componentIds,
        sourceNetIds
    ) {
        const sourceComponentId =
            componentIds.get(String(pad.componentIndex)) ||
            componentIds.get('0') ||
            Primitives.id(idScope, ['source_component', 'unassigned'])
        const sourcePortId = Primitives.sourcePortId(
            idScope,
            pad,
            padIndex,
            sourceComponentId
        )
        const pcbPortId = Primitives.id(idScope, ['pcb_port', sourcePortId])
        const common = {
            source_port_id: sourcePortId,
            pcb_port_id: pcbPortId,
            pcb_component_id: Primitives.id(idScope, [
                'pcb_component',
                pad.componentIndex ?? 'unassigned'
            ]),
            center: Primitives.milPoint(pad.x, pad.y),
            layer: Primitives.side(pad.layer),
            port_hints: [
                Primitives.string(
                    pad.name || pad.pinName || pad.designator,
                    String(padIndex + 1)
                )
            ]
        }
        const sourceNetId = Primitives.netIdForPrimitive(
            idScope,
            pad,
            sourceNetIds
        )

        circuitJson.push({
            type: 'source_port',
            source_port_id: sourcePortId,
            source_component_id: sourceComponentId,
            name: common.port_hints[0],
            pin_number: common.port_hints[0]
        })
        circuitJson.push({
            type: 'pcb_port',
            ...common,
            source_net_id: sourceNetId
        })

        if (Primitives.isThroughHolePad(pad)) {
            circuitJson.push({
                type: pad.isPlated === false ? 'pcb_hole' : 'pcb_plated_hole',
                ...common,
                outer_diameter: Primitives.milNumber(
                    pad.sizeTopX || pad.sizeX || pad.diameter,
                    0
                ),
                hole_diameter: Primitives.milNumber(pad.holeDiameter, 0),
                shape: Primitives.padShape(pad)
            })
            return
        }

        circuitJson.push({
            type: 'pcb_smtpad',
            ...common,
            shape: Primitives.padShape(pad),
            width: Primitives.milNumber(
                pad.sizeTopX || pad.sizeX || pad.width,
                0
            ),
            height: Primitives.milNumber(
                pad.sizeTopY || pad.sizeY || pad.height,
                0
            ),
            rotation: Primitives.number(pad.rotation || pad.holeRotation, 0)
        })
    }

    /**
     * Appends one PCB copper trace.
     * @param {object[]} circuitJson
     * @param {string} idScope
     * @param {Record<string, unknown>} track
     * @param {number} trackIndex
     * @param {Map<string, string>} sourceNetIds
     * @returns {void}
     */
    static #appendPcbTrace(
        circuitJson,
        idScope,
        track,
        trackIndex,
        sourceNetIds
    ) {
        const sourceTraceId = Primitives.id(idScope, [
            'source_trace',
            track.netName || track.netIndex || trackIndex
        ])
        circuitJson.push({
            type: 'source_trace',
            source_trace_id: sourceTraceId,
            source_net_id: Primitives.netIdForPrimitive(
                idScope,
                track,
                sourceNetIds
            )
        })
        circuitJson.push({
            type: 'pcb_trace',
            pcb_trace_id: Primitives.id(idScope, ['pcb_trace', trackIndex]),
            source_trace_id: sourceTraceId,
            route: [
                {
                    route_type: 'wire',
                    x: Primitives.milNumber(track.x1, 0),
                    y: Primitives.milNumber(track.y1, 0),
                    width: Primitives.milNumber(track.width, 0),
                    layer: Primitives.layerName(track)
                },
                {
                    route_type: 'wire',
                    x: Primitives.milNumber(track.x2, 0),
                    y: Primitives.milNumber(track.y2, 0),
                    width: Primitives.milNumber(track.width, 0),
                    layer: Primitives.layerName(track)
                }
            ]
        })
    }

    /**
     * Appends one PCB via.
     * @param {object[]} circuitJson
     * @param {string} idScope
     * @param {Record<string, unknown>} via
     * @param {number} viaIndex
     * @param {Map<string, string>} sourceNetIds
     * @returns {void}
     */
    static #appendPcbVia(circuitJson, idScope, via, viaIndex, sourceNetIds) {
        circuitJson.push({
            type: 'pcb_via',
            pcb_via_id: Primitives.id(idScope, ['pcb_via', viaIndex]),
            source_net_id: Primitives.netIdForPrimitive(
                idScope,
                via,
                sourceNetIds
            ),
            x: Primitives.milNumber(via.x, 0),
            y: Primitives.milNumber(via.y, 0),
            outer_diameter: Primitives.milNumber(via.diameter, 0),
            hole_diameter: Primitives.milNumber(via.holeDiameter, 0),
            layers: ['top', 'bottom']
        })
    }

    /**
     * Appends minimal PCB library elements as metadata.
     * @param {object[]} circuitJson
     * @param {Record<string, unknown>} model
     * @param {string} idScope
     * @returns {void}
     */
    static #appendPcbLibrary(circuitJson, model, idScope) {
        for (const [footprintIndex, footprint] of Primitives.array(
            model.pcbLibrary?.footprints
        ).entries()) {
            circuitJson.push({
                type: 'source_component',
                source_component_id: Primitives.id(idScope, [
                    'library_footprint',
                    footprint.name || footprint.pattern || footprintIndex
                ]),
                name: Primitives.string(
                    footprint.name || footprint.pattern,
                    `FOOTPRINT_${footprintIndex + 1}`
                ),
                ftype: 'simple_chip'
            })
        }
    }

    /**
     * Appends BOM rows as source components when they are not already present.
     * @param {object[]} circuitJson
     * @param {Record<string, unknown>} model
     * @param {string} idScope
     * @returns {void}
     */
    static #appendBom(circuitJson, model, idScope) {
        const existingComponentIds = new Set(
            circuitJson
                .filter((element) => element.type === 'source_component')
                .map((element) => element.source_component_id)
        )

        for (const [rowIndex, row] of Primitives.array(model.bom).entries()) {
            for (const designator of Primitives.array(row.designators)) {
                const sourceComponentId = Primitives.id(idScope, [
                    'source_component',
                    designator
                ])
                if (existingComponentIds.has(sourceComponentId)) continue
                existingComponentIds.add(sourceComponentId)
                circuitJson.push({
                    type: 'source_component',
                    source_component_id: sourceComponentId,
                    name: Primitives.string(designator, `BOM_${rowIndex + 1}`),
                    display_value: Primitives.string(row.value, ''),
                    footprint: Primitives.string(row.pattern, ''),
                    manufacturer_part_number: Primitives.string(row.source, ''),
                    ftype: 'simple_chip'
                })
            }
        }
    }

    /**
     * Appends one schematic line or trace.
     * @param {object[]} circuitJson
     * @param {string} idScope
     * @param {Record<string, unknown>} line
     * @param {number} lineIndex
     * @param {Map<string, string>} netIds
     * @returns {void}
     */
    static #appendSchematicLine(circuitJson, idScope, line, lineIndex, netIds) {
        const schematicLineId = Primitives.id(idScope, [
            'schematic_line',
            lineIndex
        ])
        const lineElement = {
            type: 'schematic_line',
            schematic_line_id: schematicLineId,
            x1: Primitives.number(line.x1, 0),
            y1: Primitives.number(line.y1, 0),
            x2: Primitives.number(line.x2, 0),
            y2: Primitives.number(line.y2, 0),
            stroke_width: Primitives.number(line.width, 1),
            is_dashed: line.dashed === true
        }
        circuitJson.push(lineElement)

        if (line.kind === 'wire' || line.netName || line.netIndex) {
            circuitJson.push({
                type: 'schematic_trace',
                schematic_trace_id: Primitives.id(idScope, [
                    'schematic_trace',
                    lineIndex
                ]),
                source_trace_id: Primitives.id(idScope, [
                    'source_trace',
                    line.netName || line.netIndex || lineIndex
                ]),
                source_net_id:
                    netIds.get(String(line.netName)) ||
                    Primitives.sourceNetId(
                        idScope,
                        line.netName || line.netIndex || lineIndex
                    ),
                edges: [
                    {
                        x1: lineElement.x1,
                        y1: lineElement.y1,
                        x2: lineElement.x2,
                        y2: lineElement.y2
                    }
                ]
            })
        }
    }

    /**
     * Appends one schematic text or net label.
     * @param {object[]} circuitJson
     * @param {string} idScope
     * @param {Record<string, unknown>} text
     * @param {number} textIndex
     * @returns {void}
     */
    static #appendSchematicText(circuitJson, idScope, text, textIndex) {
        const textValue = Primitives.string(
            text.text || text.value || text.name,
            ''
        )
        const base = {
            text: textValue,
            anchor_position: Primitives.point(text.x, text.y),
            anchor_alignment: 'center'
        }

        if (Primitives.isNetLabel(text)) {
            circuitJson.push({
                type: 'schematic_net_label',
                schematic_net_label_id: Primitives.id(idScope, [
                    'schematic_net_label',
                    textIndex
                ]),
                source_net_id: Primitives.sourceNetId(
                    idScope,
                    textValue || textIndex
                ),
                ...base
            })
            return
        }

        circuitJson.push({
            type: 'schematic_text',
            schematic_text_id: Primitives.id(idScope, [
                'schematic_text',
                textIndex
            ]),
            ...base
        })
    }

    /**
     * Returns a source component id for one schematic pin.
     * @param {Record<string, unknown>} pin
     * @param {Map<object, string>} componentIds
     * @param {string} idScope
     * @param {object[]} circuitJson
     * @returns {string}
     */
    static #sourceComponentIdForPin(pin, componentIds, idScope, circuitJson) {
        const designator = pin.designator || pin.ownerDesignator || pin.owner
        if (designator) {
            const sourceComponentId = Primitives.id(idScope, [
                'source_component',
                designator
            ])
            if (
                !circuitJson.some(
                    (element) =>
                        element.type === 'source_component' &&
                        element.source_component_id === sourceComponentId
                )
            ) {
                circuitJson.push({
                    type: 'source_component',
                    source_component_id: sourceComponentId,
                    name: Primitives.string(designator, 'U?'),
                    ftype: 'simple_chip'
                })
            }
            return sourceComponentId
        }

        return (
            [...componentIds.values()][0] ||
            Primitives.id(idScope, ['source_component', 'unassigned'])
        )
    }

    /**
     * Builds a source component element.
     * @param {string} sourceComponentId
     * @param {Record<string, unknown>} component
     * @param {number} componentIndex
     * @returns {object}
     */
    static #sourceComponent(sourceComponentId, component, componentIndex) {
        return {
            type: 'source_component',
            source_component_id: sourceComponentId,
            name: Primitives.string(
                component.designator || component.name,
                `U${componentIndex + 1}`
            ),
            display_value: Primitives.string(
                component.value || component.comment,
                ''
            ),
            footprint: Primitives.string(
                component.pattern || component.footprint,
                ''
            ),
            manufacturer_part_number: Primitives.string(component.source, ''),
            ftype: 'simple_chip'
        }
    }

    /**
     * Attaches legacy renderer model fields to a Circuit JSON array.
     * @param {object[]} circuitJson
     * @param {Record<string, unknown>} rendererModel
     * @returns {void}
     */
    static #attachCompatibility(circuitJson, rendererModel) {
        Object.assign(circuitJson, rendererModel)
        Object.defineProperty(circuitJson, 'rendererModel', {
            configurable: true,
            enumerable: false,
            value: rendererModel,
            writable: true
        })
    }
}
