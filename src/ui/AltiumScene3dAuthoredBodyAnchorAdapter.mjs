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
                return AltiumScene3dAuthoredBodyAnchorAdapter.#markPlacement(
                    placement,
                    component,
                    sceneDescription?.board
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
     * Marks one placement as authored-anchor based.
     * @param {object} placement External placement.
     * @param {object} component Matched scene component.
     * @param {object | undefined} board Scene board.
     * @returns {object}
     */
    static #markPlacement(placement, component, board) {
        return {
            ...placement,
            projection: {
                ...(placement.projection || {}),
                source: AltiumScene3dAuthoredBodyAnchorAdapter.#AUTHORED_SOURCE,
                reason: 'Altium component body uses an authored model-origin anchor offset from the owner footprint.'
            },
            modelTransform: {
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
