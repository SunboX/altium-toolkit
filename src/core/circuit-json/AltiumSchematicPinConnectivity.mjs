import { CircuitJsonModelAdapterPrimitives as Primitives } from './CircuitJsonModelAdapterPrimitives.mjs'

/** Indexes the source model's electrical pin memberships for CircuitJSON. */
export class AltiumSchematicPinConnectivity {
    #ownersByIndex = new Map()
    #netIdsByPin = new Map()

    /**
     * Indexes the annotated copies of pins in native net groups.
     * @param {object[]} nets Native schematic nets.
     * @param {string} idScope CircuitJSON document identifier scope.
     */
    constructor(nets, idScope) {
        for (const [index, net] of nets.entries()) {
            const netId = Primitives.sourceNetId(idScope, net.name || index)
            for (const pin of Primitives.array(net.pins)) {
                const ownerIndex = String(pin.ownerIndex ?? '')
                if (ownerIndex && pin.componentDesignator) {
                    this.#ownersByIndex.set(ownerIndex, pin.componentDesignator)
                }
                const key = AltiumSchematicPinConnectivity.#key(pin)
                if (!this.#netIdsByPin.has(key)) {
                    this.#netIdsByPin.set(key, new Set())
                }
                this.#netIdsByPin.get(key).add(netId)
            }
        }
    }

    /**
     * Projects the ordered source-port and schematic-port pairs emitted by the adapter.
     * @param {object[]} model Canonical document elements.
     * @param {object} schematic Native schematic facts.
     * @param {string} idScope Document identifier scope.
     * @returns {object[]} Model with explicit pin ownership and membership.
     */
    static project(model, schematic, idScope) {
        const connectivity = new AltiumSchematicPinConnectivity(
            Primitives.array(schematic.nets),
            idScope
        )
        const pins = Primitives.array(schematic.pins)
        const componentIds = new Map(
            Primitives.array(schematic.components).map((component, index) => [
                component.designator,
                Primitives.id(idScope, [
                    'source_component',
                    component.designator || component.name || index
                ])
            ])
        )
        const replacedOwnerIds = new Set()
        const result = [...model]
        let pinIndex = 0
        for (const [index, element] of model.entries()) {
            if (element.type !== 'source_port' || pinIndex >= pins.length)
                continue
            const drawing = model[index + 1]
            if (
                drawing?.type !== 'schematic_port' ||
                drawing.source_port_id !== element.source_port_id
            )
                continue
            const pin = pins[pinIndex]
            const owner =
                pin.componentDesignator ||
                pin.ownerDesignator ||
                connectivity.#ownersByIndex.get(String(pin.ownerIndex ?? ''))
            const ownerId =
                componentIds.get(owner) ?? element.source_component_id
            const portId = Primitives.id(idScope, [
                'source_port',
                ownerId,
                pin.pinNumber || pin.designator || pin.name,
                pinIndex
            ])
            const memberships = connectivity.#netIdsByPin.get(
                AltiumSchematicPinConnectivity.#key(pin)
            )
            if (ownerId !== element.source_component_id)
                replacedOwnerIds.add(element.source_component_id)
            result[index] = {
                ...element,
                source_component_id: ownerId,
                source_port_id: portId,
                ...(memberships
                    ? { connected_source_net_ids: [...memberships] }
                    : {})
            }
            result[index + 1] = {
                ...drawing,
                source_port_id: portId,
                schematic_port_id: Primitives.id(idScope, [
                    'schematic_port',
                    portId
                ])
            }
            pinIndex += 1
        }

        const usedOwnerIds = new Set(componentIds.values())
        for (const element of result) {
            if (
                element.type !== 'source_component' &&
                element.source_component_id
            ) {
                usedOwnerIds.add(element.source_component_id)
            }
        }
        const netNames = new Set()
        return result.filter((element) => {
            if (element.type === 'source_net') {
                if (netNames.has(element.name)) return false
                netNames.add(element.name)
            }
            return (
                element.type !== 'source_component' ||
                !replacedOwnerIds.has(element.source_component_id) ||
                usedOwnerIds.has(element.source_component_id)
            )
        })
    }

    /**
     * Matches native pins with the annotated copies from net construction.
     * @param {object} pin Native schematic pin.
     * @returns {string} Source pin identity.
     */
    static #key(pin) {
        return JSON.stringify([
            String(
                pin.ownerIndex ??
                    pin.componentDesignator ??
                    pin.ownerDesignator ??
                    ''
            ),
            String(
                pin.pinNumber ?? pin.number ?? pin.designator ?? pin.name ?? ''
            ),
            pin.x,
            pin.y
        ])
    }
}
