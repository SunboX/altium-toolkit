/**
 * Preserves Altium component-body anchors that intentionally differ from the
 * resolved footprint owner origin.
 */
export class AltiumScene3dAuthoredBodyAnchorAdapter {
    static #MIN_OWNER_OFFSET_MIL = 25
    static #BODY_ANCHOR_TOLERANCE_MIL = 5
    static #AUTHORED_SOURCE = 'authored-body-anchor'
    static #AUTHORED_ANCHOR_IDENTITY_PATTERN =
        /(?:^|[^a-z0-9])(?:antenna|coax|connector|edge|header|jack|mechanical|module|mount|shield|sma|socket)(?:$|[^a-z0-9])/i
    static #USB_ANCHOR_IDENTITY_PATTERN = /(?:^|[^a-z0-9])usb(?:$|[^a-z0-9])/i
    static #INTEGRATED_CIRCUIT_PACKAGE_PATTERN =
        /(?:^|[^a-z0-9])(?:u?qfn|v?qfn|dfn|qfp|lqfp|tqfp|bga|lga|sop|soic|ssop|tssop|msop|so[-_ ]?\d+)(?:[-_ ]?\d+)?(?:$|[^a-z0-9])/i

    /**
     * Marks off-anchor explicit Altium body placements so the runtime does not
     * recenter them by loaded model bounds.
     * @param {object} sceneDescription Built scene description.
     * @returns {object}
     */
    static apply(sceneDescription) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !Array.isArray(sceneDescription?.externalPlacements)
        ) {
            return sceneDescription
        }

        const componentByDesignator =
            AltiumScene3dAuthoredBodyAnchorAdapter.#componentByDesignator(
                sceneDescription?.components
            )
        if (!componentByDesignator.size) {
            return sceneDescription
        }

        const repeatedPlacementKeys =
            AltiumScene3dAuthoredBodyAnchorAdapter.#repeatedPlacementKeys(
                sceneDescription.externalPlacements
            )
        const pads = Array.isArray(sceneDescription?.detail?.pads)
            ? sceneDescription.detail.pads
            : []
        let changed = false
        const externalPlacements = sceneDescription.externalPlacements.map(
            (placement) => {
                const component = componentByDesignator.get(
                    String(placement?.designator || '')
                )
                if (
                    !AltiumScene3dAuthoredBodyAnchorAdapter.#shouldMarkPlacement(
                        placement,
                        component,
                        sceneDescription?.board
                    )
                ) {
                    return placement
                }

                changed = true
                const preservesSourceOriginRepair =
                    AltiumScene3dAuthoredBodyAnchorAdapter.#isRepeatedOwnedDrilledPadAnchor(
                        placement,
                        component,
                        pads,
                        repeatedPlacementKeys
                    )
                return AltiumScene3dAuthoredBodyAnchorAdapter.#markPlacement(
                    placement,
                    component,
                    sceneDescription?.board,
                    { preservesSourceOriginRepair }
                )
            }
        )

        return changed
            ? {
                  ...sceneDescription,
                  externalPlacements
              }
            : sceneDescription
    }

    /**
     * Builds a designator lookup for scene components.
     * @param {object[] | undefined} components Scene components.
     * @returns {Map<string, object>}
     */
    static #componentByDesignator(components) {
        return new Map(
            (Array.isArray(components) ? components : [])
                .map((component) => [
                    String(component?.designator || ''),
                    component
                ])
                .filter(([designator]) => designator)
        )
    }

    /**
     * Finds repeated external-model identities within one built scene.
     * @param {object[]} placements Scene external placements.
     * @returns {Set<string>}
     */
    static #repeatedPlacementKeys(placements) {
        const counts = new Map()
        const placementList = Array.isArray(placements) ? placements : []

        placementList.forEach((placement) => {
            const key =
                AltiumScene3dAuthoredBodyAnchorAdapter.#placementIdentityKey(
                    placement
                )
            if (!key) {
                return
            }

            counts.set(key, Number(counts.get(key) || 0) + 1)
        })

        return new Set(
            [...counts.entries()]
                .filter(([, count]) => count > 1)
                .map(([key]) => key)
        )
    }

    /**
     * Builds a stable model-placement identity for repeated body detection.
     * @param {object} placement External placement.
     * @returns {string}
     */
    static #placementIdentityKey(placement) {
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
            ? [designator, ...modelParts].join('::')
            : ''
    }

    /**
     * Checks whether one placement should bypass runtime pad-fallback
     * recentering.
     * @param {object} placement External placement.
     * @param {object | undefined} component Matched scene component.
     * @param {object | undefined} board Scene board.
     * @returns {boolean}
     */
    static #shouldMarkPlacement(placement, component, board) {
        if (
            !component ||
            String(placement?.projection?.source || '').toLowerCase() !==
                'pad-fallback' ||
            placement?.projection?.preservePadFallbackCentering ||
            !placement?.positionMil ||
            !placement?.bodyPositionMil
        ) {
            return false
        }

        const bodyPosition = AltiumScene3dAuthoredBodyAnchorAdapter.#point(
            placement.bodyPositionMil
        )
        const placementPosition =
            AltiumScene3dAuthoredBodyAnchorAdapter.#absolutePlacementPosition(
                placement,
                board
            )
        const ownerPosition =
            AltiumScene3dAuthoredBodyAnchorAdapter.#ownerPosition(
                component,
                board
            )
        const ownerOffset = AltiumScene3dAuthoredBodyAnchorAdapter.#distance(
            bodyPosition,
            ownerPosition
        )

        if (
            ownerOffset <
            AltiumScene3dAuthoredBodyAnchorAdapter.#MIN_OWNER_OFFSET_MIL
        ) {
            return false
        }

        if (
            AltiumScene3dAuthoredBodyAnchorAdapter.#distance(
                placementPosition,
                bodyPosition
            ) >
            AltiumScene3dAuthoredBodyAnchorAdapter.#BODY_ANCHOR_TOLERANCE_MIL
        ) {
            return false
        }

        return AltiumScene3dAuthoredBodyAnchorAdapter.#hasAuthoredAnchorIdentity(
            placement,
            component
        )
    }

    /**
     * Checks whether package metadata suggests the offset is an authored
     * connector/mechanical anchor instead of a package source-origin bias.
     * @param {object} placement External placement.
     * @param {object} component Matched scene component.
     * @returns {boolean}
     */
    static #hasAuthoredAnchorIdentity(placement, component) {
        const identityText =
            AltiumScene3dAuthoredBodyAnchorAdapter.#identityText(
                placement,
                component
            )

        return (
            AltiumScene3dAuthoredBodyAnchorAdapter.#AUTHORED_ANCHOR_IDENTITY_PATTERN.test(
                identityText
            ) ||
            AltiumScene3dAuthoredBodyAnchorAdapter.#hasUsbHardwareAnchorIdentity(
                identityText
            )
        )
    }

    /**
     * Allows USB connector-like anchors without treating USB interface ICs as
     * authored mechanical anchors.
     * @param {string} identityText Searchable package identity.
     * @returns {boolean}
     */
    static #hasUsbHardwareAnchorIdentity(identityText) {
        return (
            AltiumScene3dAuthoredBodyAnchorAdapter.#USB_ANCHOR_IDENTITY_PATTERN.test(
                identityText
            ) &&
            !AltiumScene3dAuthoredBodyAnchorAdapter.#INTEGRATED_CIRCUIT_PACKAGE_PATTERN.test(
                identityText
            )
        )
    }

    /**
     * Builds searchable package metadata for anchor-preservation checks.
     * @param {object} placement External placement.
     * @param {object} component Matched scene component.
     * @returns {string}
     */
    static #identityText(placement, component) {
        return [
            placement?.designator,
            placement?.externalModel?.name,
            placement?.externalModel?.relativePath,
            component?.pattern,
            component?.source,
            component?.description,
            component?.body?.family,
            ...Object.values(component?.parameters || {})
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Checks whether one placement is one member of a repeated drilled-pad
     * body set whose source-origin repair must remain enabled.
     * @param {object} placement External placement.
     * @param {object | undefined} component Matched scene component.
     * @param {object[]} pads Scene detail pads.
     * @param {Set<string>} repeatedPlacementKeys Repeated placement keys.
     * @returns {boolean}
     */
    static #isRepeatedOwnedDrilledPadAnchor(
        placement,
        component,
        pads,
        repeatedPlacementKeys
    ) {
        const key =
            AltiumScene3dAuthoredBodyAnchorAdapter.#placementIdentityKey(
                placement
            )

        return (
            repeatedPlacementKeys.has(key) &&
            AltiumScene3dAuthoredBodyAnchorAdapter.#isOwnedDrilledPadAnchor(
                placement,
                component,
                pads
            )
        )
    }

    /**
     * Checks whether the body anchor sits inside a drilled pad owned by the
     * resolved component.
     * @param {object} placement External placement.
     * @param {object | undefined} component Matched scene component.
     * @param {object[]} pads Scene detail pads.
     * @returns {boolean}
     */
    static #isOwnedDrilledPadAnchor(placement, component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return false
        }

        const bodyPosition = placement?.bodyPositionMil
        if (
            !AltiumScene3dAuthoredBodyAnchorAdapter.#hasFinitePoint(
                bodyPosition
            )
        ) {
            return false
        }

        return (Array.isArray(pads) ? pads : []).some(
            (pad) =>
                Number(pad?.componentIndex) === componentIndex &&
                AltiumScene3dAuthoredBodyAnchorAdapter.#hasDrilledPadOpening(
                    pad
                ) &&
                AltiumScene3dAuthoredBodyAnchorAdapter.#padContainsPoint(
                    pad,
                    bodyPosition
                )
        )
    }

    /**
     * Checks whether a pad contains a drilled or slotted board opening.
     * @param {object} pad Scene detail pad.
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
     * Checks whether one XY point falls inside the effective pad anchor span.
     * @param {object} pad Scene detail pad.
     * @param {{ x?: number, y?: number }} point Board-space point.
     * @returns {boolean}
     */
    static #padContainsPoint(pad, point) {
        if (!AltiumScene3dAuthoredBodyAnchorAdapter.#hasFinitePoint(pad)) {
            return false
        }

        const radius =
            AltiumScene3dAuthoredBodyAnchorAdapter.#padAnchorRadiusMil(pad)
        return (
            radius > 0 &&
            AltiumScene3dAuthoredBodyAnchorAdapter.#distance(pad, point) <=
                radius +
                    AltiumScene3dAuthoredBodyAnchorAdapter
                        .#BODY_ANCHOR_TOLERANCE_MIL
        )
    }

    /**
     * Resolves the effective XY radius around a drilled pad center.
     * @param {object} pad Scene detail pad.
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
     * Marks one placement as authored-anchor based.
     * @param {object} placement External placement.
     * @param {object} component Matched scene component.
     * @param {object | undefined} board Scene board.
     * @param {{ preservesSourceOriginRepair?: boolean }} [options] Marking options.
     * @returns {object}
     */
    static #markPlacement(placement, component, board, options = {}) {
        const reason = options.preservesSourceOriginRepair
            ? 'Altium repeated component body is anchored in an owned drilled pad, so the runtime preserves the body anchor while allowing embedded source-origin repair.'
            : 'Altium component body uses an authored model-origin anchor offset from the owner footprint.'

        return {
            ...placement,
            projection: {
                ...(placement.projection || {}),
                source: AltiumScene3dAuthoredBodyAnchorAdapter.#AUTHORED_SOURCE,
                reason
            },
            modelTransform: options.preservesSourceOriginRepair
                ? AltiumScene3dAuthoredBodyAnchorAdapter.#withoutOwnerAnchorOffset(
                      placement.modelTransform
                  )
                : {
                      ...(placement.modelTransform || {}),
                      ownerAnchorOffsetMil:
                          AltiumScene3dAuthoredBodyAnchorAdapter.#ownerAnchorOffset(
                              placement,
                              component,
                              board
                          )
                  }
        }
    }

    /**
     * Removes owner-anchor metadata while preserving renderable transforms.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @returns {object}
     */
    static #withoutOwnerAnchorOffset(modelTransform) {
        const { ownerAnchorOffsetMil, ...renderTransform } =
            modelTransform || {}

        return renderTransform
    }

    /**
     * Resolves the source body offset from its owner footprint anchor.
     * @param {object} placement External placement.
     * @param {object} component Matched scene component.
     * @param {object | undefined} board Scene board.
     * @returns {{ x: number, y: number }}
     */
    static #ownerAnchorOffset(placement, component, board) {
        const bodyPosition = AltiumScene3dAuthoredBodyAnchorAdapter.#point(
            placement.bodyPositionMil
        )
        const ownerPosition =
            AltiumScene3dAuthoredBodyAnchorAdapter.#ownerPosition(
                component,
                board
            )

        return {
            x: bodyPosition.x - ownerPosition.x,
            y: bodyPosition.y - ownerPosition.y
        }
    }

    /**
     * Resolves a placement position in board coordinates.
     * @param {object} placement External placement.
     * @param {object | undefined} board Scene board.
     * @returns {{ x: number, y: number }}
     */
    static #absolutePlacementPosition(placement, board) {
        return {
            x:
                Number(placement?.positionMil?.x || 0) +
                Number(board?.centerX || 0),
            y:
                Number(placement?.positionMil?.y || 0) +
                Number(board?.centerY || 0)
        }
    }

    /**
     * Resolves a scene component position in board coordinates.
     * @param {object} component Scene component.
     * @param {object | undefined} board Scene board.
     * @returns {{ x: number, y: number }}
     */
    static #ownerPosition(component, board) {
        const boardPosition = component?.boardPositionMil
        if (
            Number.isFinite(Number(boardPosition?.x)) &&
            Number.isFinite(Number(boardPosition?.y))
        ) {
            return {
                x: Number(boardPosition.x),
                y: Number(boardPosition.y)
            }
        }

        return {
            x:
                Number(component?.positionMil?.x || 0) +
                Number(board?.centerX || 0),
            y:
                Number(component?.positionMil?.y || 0) +
                Number(board?.centerY || 0)
        }
    }

    /**
     * Normalizes a partial point.
     * @param {object | undefined} point Source point.
     * @returns {{ x: number, y: number }}
     */
    static #point(point) {
        return {
            x: Number(point?.x || 0),
            y: Number(point?.y || 0)
        }
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
     * Measures XY distance between two points.
     * @param {{ x: number, y: number }} first First point.
     * @param {{ x: number, y: number }} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }
}
