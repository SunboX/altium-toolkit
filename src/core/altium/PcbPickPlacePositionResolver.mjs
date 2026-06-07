// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const DEFAULT_POSITION_MODE = 'altium-pick-place'
const COMPONENT_ORIGIN_MODE = 'component-origin'

/**
 * Resolves PCB pick-and-place coordinates from component origins and owned pad
 * anchors.
 */
export class PcbPickPlacePositionResolver {
    /**
     * Builds the public PnP model with the default mode and alternatives.
     * @param {{ componentIndex: number, designator: string, pattern: string, layer: string, rotation: number, x: number, y: number }[]} components
     * @param {{ componentIndex: number, pads?: { x?: number, y?: number }[] }[]} componentPrimitiveGroups
     * @param {{ sourceComponents?: { componentIndex: number, rotation?: number }[] }} [options] Resolver options.
     * @returns {{ units: object, positionMode: string, entries: object[], modes: { componentOrigin: { units: object, positionMode: string, entries: object[] } } }}
     */
    static buildModel(components, componentPrimitiveGroups, options = {}) {
        const units = {
            coordinate: 'mil',
            angle: 'deg'
        }

        return {
            units,
            positionMode: DEFAULT_POSITION_MODE,
            entries: PcbPickPlacePositionResolver.buildEntries(
                components,
                componentPrimitiveGroups,
                DEFAULT_POSITION_MODE,
                options
            ),
            modes: {
                componentOrigin: {
                    units,
                    positionMode: COMPONENT_ORIGIN_MODE,
                    entries: PcbPickPlacePositionResolver.buildEntries(
                        components,
                        componentPrimitiveGroups,
                        COMPONENT_ORIGIN_MODE,
                        options
                    )
                }
            }
        }
    }

    /**
     * Builds PnP entries for one coordinate mode.
     * @param {{ componentIndex: number, designator: string, pattern: string, layer: string, rotation: number, x: number, y: number }[]} components
     * @param {{ componentIndex: number, pads?: { x?: number, y?: number }[] }[]} componentPrimitiveGroups
     * @param {'altium-pick-place' | 'component-origin' | string} mode
     * @param {{ sourceComponents?: { componentIndex: number, rotation?: number }[] }} [options] Resolver options.
     * @returns {{ designator: string, pattern: string, layer: string, rotation: number, x: number, y: number, componentOriginX: number, componentOriginY: number, padAnchorCount: number, positionSource: string }[]}
     */
    static buildEntries(
        components,
        componentPrimitiveGroups,
        mode,
        options = {}
    ) {
        const groupsByIndex = PcbPickPlacePositionResolver.#buildGroupLookup(
            componentPrimitiveGroups
        )
        const sourceComponentsByIndex =
            PcbPickPlacePositionResolver.#buildGroupLookup(
                options.sourceComponents || []
            )
        const normalizedMode =
            PcbPickPlacePositionResolver.normalizePositionMode(mode)

        return (components || []).map((component) =>
            PcbPickPlacePositionResolver.#buildEntry(
                component,
                groupsByIndex.get(Number(component.componentIndex)),
                normalizedMode,
                sourceComponentsByIndex.get(Number(component.componentIndex))
            )
        )
    }

    /**
     * Normalizes one public PnP coordinate-mode token.
     * @param {string | null | undefined} mode
     * @returns {'altium-pick-place' | 'component-origin'}
     */
    static normalizePositionMode(mode) {
        const normalized = String(mode || DEFAULT_POSITION_MODE)
            .trim()
            .toLowerCase()
            .replace(/_/gu, '-')

        if (
            normalized === '' ||
            normalized === 'altium' ||
            normalized === 'altium-pick-place' ||
            normalized === 'pick-place'
        ) {
            return DEFAULT_POSITION_MODE
        }

        if (
            normalized === 'component-origin' ||
            normalized === 'origin' ||
            normalized === 'part-origin' ||
            normalized === 'footprint-origin'
        ) {
            return COMPONENT_ORIGIN_MODE
        }

        return DEFAULT_POSITION_MODE
    }

    /**
     * Builds one PnP entry.
     * @param {{ designator: string, pattern: string, layer: string, rotation: number, x: number, y: number }} component
     * @param {{ pads?: { x?: number, y?: number }[] } | undefined} group
     * @param {'altium-pick-place' | 'component-origin'} mode
     * @param {{ rotation?: number } | undefined} sourceComponent Source component row.
     * @returns {{ designator: string, pattern: string, layer: string, rotation: number, x: number, y: number, componentOriginX: number, componentOriginY: number, padAnchorCount: number, positionSource: string }}
     */
    static #buildEntry(component, group, mode, sourceComponent) {
        const componentOriginX = Number(component.x || 0)
        const componentOriginY = Number(component.y || 0)
        const rotation = Number.isFinite(Number(sourceComponent?.rotation))
            ? Number(sourceComponent.rotation)
            : Number(component.rotation || 0)
        const padAnchors = PcbPickPlacePositionResolver.#padAnchors(group?.pads)
        const padCenter =
            mode === DEFAULT_POSITION_MODE
                ? PcbPickPlacePositionResolver.#padAnchorBoundsCenter(
                      padAnchors
                  )
                : null
        const position = padCenter || {
            x: componentOriginX,
            y: componentOriginY,
            source: 'component-origin'
        }

        return {
            designator: component.designator || '',
            pattern: component.pattern || '',
            layer: component.layer || '',
            ...(component.componentKind
                ? { componentKind: component.componentKind }
                : {}),
            rotation: PcbPickPlacePositionResolver.#roundCoordinate(rotation),
            x: PcbPickPlacePositionResolver.#roundCoordinate(position.x),
            y: PcbPickPlacePositionResolver.#roundCoordinate(position.y),
            componentOriginX:
                PcbPickPlacePositionResolver.#roundCoordinate(componentOriginX),
            componentOriginY:
                PcbPickPlacePositionResolver.#roundCoordinate(componentOriginY),
            padAnchorCount: padAnchors.length,
            positionSource:
                mode === COMPONENT_ORIGIN_MODE
                    ? 'component-origin'
                    : position.source
        }
    }

    /**
     * Builds a lookup of component primitive groups by native component index.
     * @param {{ componentIndex: number }[]} componentPrimitiveGroups
     * @returns {Map<number, object>}
     */
    static #buildGroupLookup(componentPrimitiveGroups) {
        const groupsByIndex = new Map()

        for (const group of componentPrimitiveGroups || []) {
            const componentIndex = Number(group?.componentIndex)
            if (Number.isInteger(componentIndex)) {
                groupsByIndex.set(componentIndex, group)
            }
        }

        return groupsByIndex
    }

    /**
     * Returns pad anchor points with finite coordinates.
     * @param {{ x?: number, y?: number }[] | undefined} pads
     * @returns {{ x: number, y: number }[]}
     */
    static #padAnchors(pads) {
        return (pads || [])
            .map((pad) => ({
                x: Number(pad?.x),
                y: Number(pad?.y)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
    }

    /**
     * Resolves the center of the owned pad-anchor bounds.
     * @param {{ x: number, y: number }[]} padAnchors
     * @returns {{ x: number, y: number, source: string } | null}
     */
    static #padAnchorBoundsCenter(padAnchors) {
        if (!padAnchors.length) {
            return null
        }

        const xs = padAnchors.map((point) => point.x)
        const ys = padAnchors.map((point) => point.y)

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2,
            source: 'pad-anchor-bounds'
        }
    }

    /**
     * Rounds one PnP coordinate for deterministic JSON output.
     * @param {number} value
     * @returns {number}
     */
    static #roundCoordinate(value) {
        return Number(Number(value || 0).toFixed(6))
    }
}
