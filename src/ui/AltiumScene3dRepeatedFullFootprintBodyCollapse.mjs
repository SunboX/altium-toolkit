import { PcbScene3dPadLocalSpanResolver } from './PcbScene3dPadLocalSpanResolver.mjs'

const PASSIVE_BODY_PATTERN =
    /(?:^|[^a-z0-9])(?:cap|capacitor|res|resistor|ind|inductor|ferrite|bead|lqw|lqg)(?:$|[^a-z0-9])/i
const PAD_FALLBACK_AUTHORED_ANCHOR_PATTERN =
    /(?:^|[^a-z0-9])(?:antenna|coax|conn|connector|edge|flex|fpc|frame|hardware|header|jack|mechanical|module|shield|sma|socket)(?:$|[^a-z0-9])/i
const USB_ANCHOR_IDENTITY_PATTERN = /(?:^|[^a-z0-9])usb(?:$|[^a-z0-9])/i
const INTEGRATED_CIRCUIT_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:u?qfn|v?qfn|dfn|qfp|lqfp|tqfp|bga|lga|sop|soic|ssop|tssop|msop|so[-_ ]?\d+)(?:[-_ ]?\d+)?(?:$|[^a-z0-9])/i

/**
 * Collapses repeated Altium shape rows that duplicate one full-footprint body.
 */
export class AltiumScene3dRepeatedFullFootprintBodyCollapse {
    static #PAD_ANCHOR_TOLERANCE_MIL = 5

    /**
     * Collapses duplicate shape rows that all describe one full footprint body.
     * @param {object[]} placements Scene placements.
     * @param {Map<string, object>} componentByDesignator Components by designator.
     * @param {object[]} pads Source PCB pads.
     * @returns {object[]}
     */
    static apply(placements, componentByDesignator, pads) {
        const groups = AltiumScene3dRepeatedFullFootprintBodyCollapse.#groups(
            placements,
            componentByDesignator
        )
        const replacements = new Map()
        const removedIndexes = new Set()

        groups.forEach((records) => {
            const representativePlacement = records[0]?.placement
            const component = componentByDesignator.get(
                String(representativePlacement?.designator || '')
            )
            if (
                !AltiumScene3dRepeatedFullFootprintBodyCollapse.#shouldCollapse(
                    records,
                    component,
                    pads
                )
            ) {
                return
            }

            const representative =
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#representative(
                    records,
                    component
                )
            replacements.set(
                representative.index,
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#withCollapsedProjection(
                    representative.placement,
                    records.length
                )
            )
            records.forEach((record) => {
                if (record.index !== representative.index) {
                    removedIndexes.add(record.index)
                }
            })
        })

        if (!replacements.size && !removedIndexes.size) {
            return placements
        }

        return placements
            .map((placement, index) => {
                if (removedIndexes.has(index)) {
                    return null
                }

                return replacements.get(index) || placement
            })
            .filter(Boolean)
    }

    /**
     * Groups pad-fallback placements that share one owner and model identity.
     * @param {object[]} placements Scene placements.
     * @param {Map<string, object>} componentByDesignator Components by designator.
     * @returns {{ index: number, placement: object }[][]}
     */
    static #groups(placements, componentByDesignator) {
        const groups = new Map()

        placements.forEach((placement, index) => {
            if (
                !AltiumScene3dRepeatedFullFootprintBodyCollapse.#isCandidate(
                    placement,
                    componentByDesignator
                )
            ) {
                return
            }

            const key =
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#groupKey(
                    placement
                )
            if (!key) {
                return
            }

            const records = groups.get(key) || []
            records.push({ index, placement })
            groups.set(key, records)
        })

        return [...groups.values()].filter((records) => records.length > 1)
    }

    /**
     * Checks whether one placement can participate in full-footprint collapse.
     * @param {object} placement Scene placement.
     * @param {Map<string, object>} componentByDesignator Components by designator.
     * @returns {boolean}
     */
    static #isCandidate(placement, componentByDesignator) {
        const projectionSource = String(
            placement?.projection?.source || ''
        ).toLowerCase()

        return (
            (projectionSource === 'pad-fallback' ||
                projectionSource === 'model-bounds') &&
            Boolean(placement?.externalModel) &&
            Boolean(placement?.positionMil) &&
            Boolean(placement?.bodyPositionMil) &&
            Boolean(placement?.projection?.boundsMil) &&
            componentByDesignator.has(String(placement?.designator || ''))
        )
    }

    /**
     * Builds a stable duplicate full-footprint model key.
     * @param {object} placement Scene placement.
     * @returns {string}
     */
    static #groupKey(placement) {
        const designator = String(placement?.designator || '').trim()
        const model = placement?.externalModel || {}
        const modelParts = [
            model?.origin,
            model?.sourceStream,
            model?.relativePath,
            model?.name,
            model?.format
        ].map((value) => String(value || '').trim())

        return designator && modelParts.some(Boolean)
            ? [
                  designator,
                  String(placement?.mountSide || '').toLowerCase(),
                  AltiumScene3dRepeatedFullFootprintBodyCollapse.#normalizeAngle(
                      placement?.rotationDeg
                  ),
                  ...modelParts
              ].join('::')
            : ''
    }

    /**
     * Checks whether a repeated group describes duplicate rows of one body.
     * @param {{ placement: object }[]} records Group records.
     * @param {object | undefined} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #shouldCollapse(records, component, pads) {
        if (!component || records.length < 2) {
            return false
        }

        const identityText =
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#identityText(
                records[0]?.placement,
                component
            )
        if (
            PASSIVE_BODY_PATTERN.test(identityText) ||
            !AltiumScene3dRepeatedFullFootprintBodyCollapse.#hasAuthoredAnchorIdentity(
                identityText
            )
        ) {
            return false
        }

        const ownedDrilledPads =
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#ownedDrilledPads(
                component,
                pads
            )
        if (ownedDrilledPads.length <= records.length) {
            return false
        }

        const mountSide =
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#mountSide(
                component
            ) ||
            String(records[0]?.placement?.mountSide || '').toLowerCase() ||
            'top'
        const padSpan = PcbScene3dPadLocalSpanResolver.resolve(
            component,
            ownedDrilledPads,
            mountSide
        )

        return (
            Boolean(padSpan) &&
            records.every((record) =>
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#isOwnedDrilledPadAnchor(
                    record.placement,
                    ownedDrilledPads
                )
            ) &&
            records.every((record) =>
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#projectionMatchesPadSpan(
                    record.placement?.projection,
                    padSpan
                )
            )
        )
    }

    /**
     * Checks whether identity text describes an authored hardware anchor.
     * @param {string} identityText Searchable package identity.
     * @returns {boolean}
     */
    static #hasAuthoredAnchorIdentity(identityText) {
        return (
            PAD_FALLBACK_AUTHORED_ANCHOR_PATTERN.test(identityText) ||
            (USB_ANCHOR_IDENTITY_PATTERN.test(identityText) &&
                !INTEGRATED_CIRCUIT_PACKAGE_PATTERN.test(identityText))
        )
    }

    /**
     * Builds searchable package metadata for collapse policy checks.
     * @param {object} placement Scene placement.
     * @param {object} component Source component.
     * @returns {string}
     */
    static #identityText(placement, component) {
        return [
            placement?.designator,
            placement?.externalModel?.name,
            placement?.externalModel?.relativePath,
            placement?.externalModel?.sourceStream,
            component?.pattern,
            component?.source,
            component?.description,
            ...Object.values(component?.parameters || {})
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Resolves drilled pads owned by one component.
     * @param {object} component Source component.
     * @param {object[]} pads Source PCB pads.
     * @returns {object[]}
     */
    static #ownedDrilledPads(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return []
        }

        return (Array.isArray(pads) ? pads : []).filter(
            (pad) =>
                Number(pad?.componentIndex) === componentIndex &&
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#hasDrilledPadOpening(
                    pad
                )
        )
    }

    /**
     * Checks whether one pad contains a through-hole opening.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #hasDrilledPadOpening(pad) {
        const holeGeometry = pad?.holeGeometry || {}

        return [
            pad?.holeDiameter,
            pad?.drillDiameter,
            pad?.holeSize,
            pad?.holeSlotLength,
            pad?.slotLength,
            holeGeometry?.diameter,
            holeGeometry?.length,
            holeGeometry?.slotLength
        ].some((value) => Number(value || 0) > 0)
    }

    /**
     * Checks whether a placement anchor occupies an owned drilled pad.
     * @param {object} placement Scene placement.
     * @param {object[]} ownedDrilledPads Drilled pads owned by the component.
     * @returns {boolean}
     */
    static #isOwnedDrilledPadAnchor(placement, ownedDrilledPads) {
        const bodyPosition = placement?.bodyPositionMil
        if (
            !AltiumScene3dRepeatedFullFootprintBodyCollapse.#hasFinitePoint(
                bodyPosition
            )
        ) {
            return false
        }

        return ownedDrilledPads.some((pad) =>
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#padContainsPoint(
                pad,
                bodyPosition
            )
        )
    }

    /**
     * Checks whether one pad contains a board-space point.
     * @param {object} pad Source PCB pad.
     * @param {{ x?: number, y?: number }} point Board-space point.
     * @returns {boolean}
     */
    static #padContainsPoint(pad, point) {
        if (
            !AltiumScene3dRepeatedFullFootprintBodyCollapse.#hasFinitePoint(pad)
        ) {
            return false
        }

        const radius =
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#padAnchorRadiusMil(
                pad
            )
        return (
            radius > 0 &&
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#distance(
                pad,
                point
            ) <=
                radius +
                    AltiumScene3dRepeatedFullFootprintBodyCollapse
                        .#PAD_ANCHOR_TOLERANCE_MIL
        )
    }

    /**
     * Resolves the effective drilled pad anchor radius.
     * @param {object} pad Source PCB pad.
     * @returns {number}
     */
    static #padAnchorRadiusMil(pad) {
        const holeGeometry = pad?.holeGeometry || {}
        const diameter = Math.max(
            Number(pad?.sizeTopX || 0),
            Number(pad?.sizeTopY || 0),
            Number(pad?.sizeMidX || 0),
            Number(pad?.sizeMidY || 0),
            Number(pad?.sizeBottomX || 0),
            Number(pad?.sizeBottomY || 0),
            Number(pad?.holeDiameter || 0),
            Number(pad?.drillDiameter || 0),
            Number(pad?.holeSize || 0),
            Number(pad?.holeSlotLength || 0),
            Number(pad?.slotLength || 0),
            Number(holeGeometry?.diameter || 0),
            Number(holeGeometry?.length || 0),
            Number(holeGeometry?.slotLength || 0)
        )

        return Number.isFinite(diameter) && diameter > 0 ? diameter / 2 : 0
    }

    /**
     * Checks whether projection bounds match the full owned drilled-pad span.
     * @param {object | undefined} projection Placement projection metadata.
     * @param {{ width: number, depth: number }} padSpan Owned drilled-pad span.
     * @returns {boolean}
     */
    static #projectionMatchesPadSpan(projection, padSpan) {
        const bounds = projection?.boundsMil || {}

        return (
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#matchesDimension(
                Number(bounds?.width),
                Number(padSpan?.width)
            ) &&
            AltiumScene3dRepeatedFullFootprintBodyCollapse.#matchesDimension(
                Number(bounds?.depth),
                Number(padSpan?.depth)
            )
        )
    }

    /**
     * Checks whether two dimensions are close enough for source-origin repair.
     * @param {number} actual Actual dimension.
     * @param {number} expected Expected dimension.
     * @returns {boolean}
     */
    static #matchesDimension(actual, expected) {
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
            return false
        }

        const tolerance = Math.max(35, Math.abs(expected) * 0.08)
        return Math.abs(actual - expected) <= tolerance
    }

    /**
     * Picks a source-origin representative that cannot be mistaken for center.
     * @param {{ index: number, placement: object }[]} records Group records.
     * @param {object} component Owning component.
     * @returns {{ index: number, placement: object }}
     */
    static #representative(records, component) {
        return [...records].sort(
            (left, right) =>
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#distance(
                    right.placement?.bodyPositionMil,
                    component
                ) -
                AltiumScene3dRepeatedFullFootprintBodyCollapse.#distance(
                    left.placement?.bodyPositionMil,
                    component
                )
        )[0]
    }

    /**
     * Marks one representative as the collapsed pad-fallback source origin.
     * @param {object} placement Representative placement.
     * @param {number} duplicateBodyCount Number of collapsed body rows.
     * @returns {object}
     */
    static #withCollapsedProjection(placement, duplicateBodyCount) {
        const { ownerAnchorOffsetMil, ...renderTransform } =
            placement?.modelTransform || {}
        const projectionSource = String(
            placement?.projection?.source || ''
        ).toLowerCase()
        const collapsedProjection = {
            ...(placement.projection || {}),
            reason:
                projectionSource === 'model-bounds'
                    ? 'Repeated Altium body rows share one full-footprint model-bounds projection, so duplicate rows were collapsed while preserving the authored source origin.'
                    : 'Repeated Altium body rows share one full-footprint pad projection, so duplicate rows were collapsed while preserving source-origin centering.',
            duplicateBodyCount
        }
        if (projectionSource === 'pad-fallback') {
            collapsedProjection.preservePadFallbackCentering = true
        }

        return {
            ...placement,
            projection: collapsedProjection,
            modelTransform: renderTransform
        }
    }

    /**
     * Resolves one component's mount side.
     * @param {object} component PCB component.
     * @returns {'top' | 'bottom' | ''}
     */
    static #mountSide(component) {
        const layer = String(component?.layer || '').toUpperCase()

        return layer.includes('BOTTOM') || layer === 'BOT' ? 'bottom' : 'top'
    }

    /**
     * Checks whether a value has finite XY coordinates.
     * @param {object | undefined} point Source point.
     * @returns {boolean}
     */
    static #hasFinitePoint(point) {
        return (
            Number.isFinite(Number(point?.x)) &&
            Number.isFinite(Number(point?.y))
        )
    }

    /**
     * Measures XY distance between two board points.
     * @param {object} first First point.
     * @param {object} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }

    /**
     * Normalizes an angle into [0, 360).
     * @param {number} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
