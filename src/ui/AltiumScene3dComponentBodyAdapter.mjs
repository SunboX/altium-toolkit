import { PcbScene3dPadLocalSpanResolver } from './PcbScene3dPadLocalSpanResolver.mjs'

const REFINABLE_FAMILIES = new Set(['chip', 'diode', 'generic', 'ic', 'sot'])

/**
 * Refines Altium procedural fallback body sizes from component-owned pads.
 */
export class AltiumScene3dComponentBodyAdapter {
    static #OVERSIZE_RATIO = 1.75

    /**
     * Applies owned-pad body refinement to an Altium scene description.
     * @param {object} sceneDescription Scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !Array.isArray(sceneDescription?.components)
        ) {
            return sceneDescription
        }

        const sourceComponents = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const pads = Array.isArray(documentModel?.pcb?.pads)
            ? documentModel.pcb.pads
            : []
        if (!sourceComponents.length || !pads.length) {
            return sceneDescription
        }

        const sourceByDesignator = new Map(
            sourceComponents.map((component) => [
                String(component?.designator || ''),
                component
            ])
        )

        return {
            ...sceneDescription,
            components: sceneDescription.components.map((component) =>
                AltiumScene3dComponentBodyAdapter.#refineComponent(
                    component,
                    sourceByDesignator.get(String(component?.designator || '')),
                    pads
                )
            )
        }
    }

    /**
     * Refines one procedural component body when nearby pads overinflated it.
     * @param {object} component Scene component.
     * @param {object | undefined} sourceComponent Source PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {object}
     */
    static #refineComponent(component, sourceComponent, pads) {
        const family = String(component?.body?.family || '')
        if (
            component?.externalModel ||
            !sourceComponent ||
            !REFINABLE_FAMILIES.has(family)
        ) {
            return component
        }

        const span = AltiumScene3dComponentBodyAdapter.#ownedPadSpan(
            sourceComponent,
            component.mountSide,
            pads
        )
        const size = component?.body?.sizeMil || {}
        if (
            !span ||
            !AltiumScene3dComponentBodyAdapter.#isOversized(size, span)
        ) {
            return component
        }

        return {
            ...component,
            body: {
                ...component.body,
                sizeMil: {
                    ...size,
                    width: span.width,
                    depth: span.depth
                }
            }
        }
    }

    /**
     * Resolves the owned surface-pad span for one source component.
     * @param {object} component Source component.
     * @param {string} mountSide Component mount side.
     * @param {object[]} pads Source PCB pads.
     * @returns {{ width: number, depth: number } | null}
     */
    static #ownedPadSpan(component, mountSide, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return null
        }

        const ownedPads = pads.filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
        )
        const surfacePads = ownedPads.filter((pad) =>
            AltiumScene3dComponentBodyAdapter.#isSurfacePad(pad, mountSide)
        )
        const spanPads = surfacePads.length ? surfacePads : ownedPads

        return PcbScene3dPadLocalSpanResolver.resolve(
            component,
            spanPads,
            mountSide
        )
    }

    /**
     * Checks whether one pad belongs to the component's mounted surface.
     * @param {object} pad Source pad.
     * @param {string} mountSide Component mount side.
     * @returns {boolean}
     */
    static #isSurfacePad(pad, mountSide) {
        return String(mountSide || '').toLowerCase() === 'bottom'
            ? Boolean(pad?.hasBottomPasteMaskOpening)
            : Boolean(pad?.hasTopPasteMaskOpening)
    }

    /**
     * Checks whether the current body is clearly larger than owned pads.
     * @param {object} size Current body size.
     * @param {{ width: number, depth: number }} span Owned pad span.
     * @returns {boolean}
     */
    static #isOversized(size, span) {
        return (
            Number(size?.width || 0) >
                span.width *
                    AltiumScene3dComponentBodyAdapter.#OVERSIZE_RATIO ||
            Number(size?.depth || 0) >
                span.depth * AltiumScene3dComponentBodyAdapter.#OVERSIZE_RATIO
        )
    }
}
