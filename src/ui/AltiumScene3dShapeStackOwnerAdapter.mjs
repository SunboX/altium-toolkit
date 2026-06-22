const TIMING_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:clock|crystal|osc|oscillator|resonator|tcxo|txco|xtal)(?:$|[^a-z0-9])/i
const TIMING_DESIGNATOR_PATTERN = /^(?:y|xo)\d+[a-z]?$/i

/**
 * Keeps authored shape-based sub-bodies grouped under their carrier owner.
 */
export class AltiumScene3dShapeStackOwnerAdapter {
    static #BASE_OWNER_TOLERANCE_MIL = 60
    static #STACK_BODY_RADIUS_MIL = 220
    static #HEIGHT_TOLERANCE_MIL = 0.1

    /**
     * Applies authored stack ownership to static and external placements.
     * @param {object} sceneDescription Built scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
            'altium'
        ) {
            return sceneDescription
        }

        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const componentBodies = Array.isArray(
            documentModel?.pcb?.componentBodies
        )
            ? documentModel.pcb.componentBodies
            : []
        if (!components.length || !componentBodies.length) {
            return sceneDescription
        }

        const assignments =
            AltiumScene3dShapeStackOwnerAdapter.#carrierAssignments(
                componentBodies,
                components
            )
        if (!assignments.length) {
            return sceneDescription
        }

        const ownerGroupKeys = new Map(
            assignments.map((assignment) => [
                String(assignment.owner.designator || ''),
                assignment.groupKey
            ])
        )

        return {
            ...sceneDescription,
            components: AltiumScene3dShapeStackOwnerAdapter.#markComponents(
                sceneDescription.components,
                ownerGroupKeys
            ),
            externalPlacements:
                AltiumScene3dShapeStackOwnerAdapter.#repairExternalPlacements(
                    sceneDescription.externalPlacements,
                    componentBodies,
                    assignments,
                    sceneDescription.board
                ),
            staticBodyPlacements:
                AltiumScene3dShapeStackOwnerAdapter.#repairStaticPlacements(
                    sceneDescription.staticBodyPlacements,
                    componentBodies,
                    assignments
                )
        }
    }

    /**
     * Marks stack owners so the viewer skips their generated fallback body.
     * @param {object[] | undefined} components Scene components.
     * @param {Map<string, string>} ownerGroupKeys Authored stack owners.
     * @returns {object[]}
     */
    static #markComponents(components, ownerGroupKeys) {
        return (Array.isArray(components) ? components : []).map((component) =>
            ownerGroupKeys.has(String(component?.designator || ''))
                ? {
                      ...component,
                      renderFallbackBody: false,
                      coLocatedVariantGroupKey: ownerGroupKeys.get(
                          String(component?.designator || '')
                      )
                  }
                : component
        )
    }

    /**
     * Repairs external model ownership for authored stack sub-bodies.
     * @param {object[] | undefined} placements Scene external placements.
     * @param {object[]} componentBodies Source component-body rows.
     * @param {object[]} assignments Carrier assignments.
     * @param {object | undefined} board Scene board metadata.
     * @returns {object[]}
     */
    static #repairExternalPlacements(
        placements,
        componentBodies,
        assignments,
        board
    ) {
        const usedComponentBodies = new Set()

        return (Array.isArray(placements) ? placements : []).map(
            (placement) => {
                const componentBody =
                    AltiumScene3dShapeStackOwnerAdapter.#resolveComponentBody(
                        placement,
                        componentBodies,
                        usedComponentBodies
                    )
                if (componentBody) {
                    usedComponentBodies.add(componentBody)
                }

                const assignment =
                    AltiumScene3dShapeStackOwnerAdapter.#assignmentForBody(
                        componentBody,
                        assignments
                    )
                if (!assignment) {
                    return placement
                }

                return AltiumScene3dShapeStackOwnerAdapter.#withOwner(
                    placement,
                    componentBody,
                    assignment,
                    board
                )
            }
        )
    }

    /**
     * Repairs carrier static body ownership.
     * @param {object[] | undefined} placements Scene static body placements.
     * @param {object[]} componentBodies Source component-body rows.
     * @param {object[]} assignments Carrier assignments.
     * @returns {object[]}
     */
    static #repairStaticPlacements(placements, componentBodies, assignments) {
        return (Array.isArray(placements) ? placements : []).map(
            (placement) => {
                const assignment = assignments.find((candidate) =>
                    AltiumScene3dShapeStackOwnerAdapter.#isSameStaticBody(
                        placement,
                        candidate.base
                    )
                )
                if (!assignment) {
                    return placement
                }

                return {
                    ...placement,
                    designator: String(assignment.owner.designator || ''),
                    coLocatedVariantGroupKey: assignment.groupKey
                }
            }
        )
    }

    /**
     * Builds carrier-base to owner-component assignments.
     * @param {object[]} componentBodies Source component-body rows.
     * @param {object[]} components Source components.
     * @returns {{ base: object, owner: object, heightMil: number, groupKey: string }[]}
     */
    static #carrierAssignments(componentBodies, components) {
        const bases = componentBodies.filter((body) =>
            AltiumScene3dShapeStackOwnerAdapter.#isCarrierBase(body)
        )
        const timingComponents = components.filter((component) =>
            AltiumScene3dShapeStackOwnerAdapter.#isTimingComponent(component)
        )
        const groups =
            AltiumScene3dShapeStackOwnerAdapter.#groupCarrierBases(bases)

        return groups.flatMap((group) => {
            const owners = timingComponents
                .filter(
                    (component) =>
                        AltiumScene3dShapeStackOwnerAdapter.#distance(
                            group.anchor,
                            component
                        ) <=
                        AltiumScene3dShapeStackOwnerAdapter
                            .#BASE_OWNER_TOLERANCE_MIL
                )
                .sort(
                    (left, right) =>
                        AltiumScene3dShapeStackOwnerAdapter.#ownerRank(right) -
                            AltiumScene3dShapeStackOwnerAdapter.#ownerRank(
                                left
                            ) ||
                        String(left?.designator || '').localeCompare(
                            String(right?.designator || '')
                        )
                )
            if (!owners.length) {
                return []
            }
            const groupKey = AltiumScene3dShapeStackOwnerAdapter.#groupKey(
                group.anchor
            )

            return group.bases
                .slice()
                .sort(
                    (left, right) =>
                        Number(
                            left?.staticGeometry?.heightMil ??
                                left?.overallHeightMil ??
                                0
                        ) -
                        Number(
                            right?.staticGeometry?.heightMil ??
                                right?.overallHeightMil ??
                                0
                        )
                )
                .map((base, index) => ({
                    base,
                    owner: owners[Math.min(index, owners.length - 1)],
                    groupKey,
                    heightMil: Number(
                        base?.staticGeometry?.heightMil ??
                            base?.overallHeightMil ??
                            0
                    )
                }))
        })
    }

    /**
     * Groups carrier bases that share one source anchor.
     * @param {object[]} bases Candidate carrier bases.
     * @returns {{ anchor: { x: number, y: number }, bases: object[] }[]}
     */
    static #groupCarrierBases(bases) {
        const groups = []

        bases.forEach((base) => {
            const anchor = AltiumScene3dShapeStackOwnerAdapter.#point(
                base?.positionMil
            )
            const group = groups.find(
                (candidate) =>
                    AltiumScene3dShapeStackOwnerAdapter.#distance(
                        candidate.anchor,
                        anchor
                    ) <= 1
            )
            if (group) {
                group.bases.push(base)
            } else {
                groups.push({ anchor, bases: [base] })
            }
        })

        return groups
    }

    /**
     * Checks whether one body row describes an authored carrier base.
     * @param {object} componentBody Source component-body row.
     * @returns {boolean}
     */
    static #isCarrierBase(componentBody) {
        const geometry = componentBody?.staticGeometry || {}
        return (
            AltiumScene3dShapeStackOwnerAdapter.#isShapeBasedBody(
                componentBody
            ) &&
            !componentBody?.embedded &&
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            String(geometry?.status || '').toLowerCase() === 'complete' &&
            Number(geometry?.heightMil ?? componentBody?.overallHeightMil) > 0
        )
    }

    /**
     * Finds a carrier assignment for one positive-height sub-body.
     * @param {object | null} componentBody Source component-body row.
     * @param {object[]} assignments Carrier assignments.
     * @returns {object | null}
     */
    static #assignmentForBody(componentBody, assignments) {
        if (
            !componentBody ||
            !AltiumScene3dShapeStackOwnerAdapter.#isShapeBasedBody(
                componentBody
            ) ||
            Number(componentBody?.standoffHeightMil || 0) <= 0
        ) {
            return null
        }

        const standoff = Number(componentBody.standoffHeightMil)
        const bodyPosition = AltiumScene3dShapeStackOwnerAdapter.#point(
            componentBody.positionMil
        )

        return (
            assignments
                .map((assignment) => ({
                    assignment,
                    heightError: Math.abs(
                        Number(assignment.heightMil || 0) - standoff
                    ),
                    distance: AltiumScene3dShapeStackOwnerAdapter.#distance(
                        bodyPosition,
                        assignment.owner
                    )
                }))
                .filter(
                    (candidate) =>
                        candidate.heightError <=
                            AltiumScene3dShapeStackOwnerAdapter
                                .#HEIGHT_TOLERANCE_MIL &&
                        candidate.distance <=
                            AltiumScene3dShapeStackOwnerAdapter
                                .#STACK_BODY_RADIUS_MIL
                )
                .sort(
                    (left, right) =>
                        left.heightError - right.heightError ||
                        left.distance - right.distance
                )[0]?.assignment || null
        )
    }

    /**
     * Applies one owner component to an external placement.
     * @param {object} placement External placement.
     * @param {object} componentBody Source component-body row.
     * @param {{ owner: object, groupKey: string }} assignment Stack assignment.
     * @param {object | undefined} board Scene board metadata.
     * @returns {object}
     */
    static #withOwner(placement, componentBody, assignment, board) {
        const owner = assignment.owner
        const mountSide =
            AltiumScene3dShapeStackOwnerAdapter.#mountSide(owner) ||
            placement.mountSide
        const rotationDeg = AltiumScene3dShapeStackOwnerAdapter.#normalizeAngle(
            owner.rotation
        )
        const ownerOffset = {
            x:
                Number(componentBody?.positionMil?.x || 0) -
                Number(owner?.x || 0),
            y:
                Number(componentBody?.positionMil?.y || 0) -
                Number(owner?.y || 0)
        }
        const standoff = Number(componentBody?.standoffHeightMil || 0)
        const renderableOffset =
            AltiumScene3dShapeStackOwnerAdapter.#renderableOffset(
                { mountSide, rotationDeg },
                ownerOffset,
                standoff
            )

        return {
            ...placement,
            designator: String(owner?.designator || placement.designator),
            mountSide,
            rotationDeg,
            positionMil: {
                ...(placement.positionMil || {}),
                x: Number(owner?.x || 0) - Number(board?.centerX || 0),
                y: Number(owner?.y || 0) - Number(board?.centerY || 0),
                z: AltiumScene3dShapeStackOwnerAdapter.#faceZ(mountSide, board)
            },
            projection: {
                ...(placement.projection || {}),
                source: 'authored-shape-stack',
                reason: 'Altium shape-based sub-body is seated on an authored carrier stack.'
            },
            coLocatedVariantGroupKey: assignment.groupKey,
            modelTransform: {
                ...(placement.modelTransform || {}),
                dzMil: standoff,
                offsetMil: renderableOffset,
                ownerAnchorOffsetMil: ownerOffset
            }
        }
    }

    /**
     * Converts a board-space owner offset into render local coordinates.
     * @param {{ mountSide?: string, rotationDeg?: number }} placement Placement.
     * @param {{ x: number, y: number }} offset Board-space offset.
     * @param {number} standoff Vertical stack offset.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #renderableOffset(placement, offset, standoff) {
        const rotationRad =
            (-AltiumScene3dShapeStackOwnerAdapter.#normalizeAngle(
                placement.rotationDeg
            ) *
                Math.PI) /
            180
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)
        const sourceY =
            String(placement?.mountSide || '').toLowerCase() === 'bottom'
                ? Number(offset.y || 0)
                : -Number(offset.y || 0)
        const x = Number(offset.x || 0) * cos - sourceY * sin
        const y = Number(offset.x || 0) * sin + sourceY * cos

        return {
            x: AltiumScene3dShapeStackOwnerAdapter.#round(x),
            y:
                String(placement?.mountSide || '').toLowerCase() === 'bottom'
                    ? AltiumScene3dShapeStackOwnerAdapter.#round(-y)
                    : AltiumScene3dShapeStackOwnerAdapter.#round(y),
            z: AltiumScene3dShapeStackOwnerAdapter.#round(standoff)
        }
    }

    /**
     * Checks whether one static placement came from one carrier base row.
     * @param {object} placement Static placement.
     * @param {object} base Source base row.
     * @returns {boolean}
     */
    static #isSameStaticBody(placement, base) {
        return (
            AltiumScene3dShapeStackOwnerAdapter.#distance(
                placement?.bodyPositionMil,
                base?.positionMil
            ) <= 0.01 &&
            Math.abs(
                Number(placement?.geometry?.heightMil || 0) -
                    Number(
                        base?.staticGeometry?.heightMil ??
                            base?.overallHeightMil ??
                            0
                    )
            ) <= AltiumScene3dShapeStackOwnerAdapter.#HEIGHT_TOLERANCE_MIL
        )
    }

    /**
     * Resolves the source component body row for one external placement.
     * @param {object} placement External placement.
     * @param {object[]} componentBodies Source body rows.
     * @param {Set<object>} usedComponentBodies Already consumed body rows.
     * @returns {object | null}
     */
    static #resolveComponentBody(
        placement,
        componentBodies,
        usedComponentBodies
    ) {
        return (
            componentBodies
                .filter(
                    (componentBody) => !usedComponentBodies.has(componentBody)
                )
                .map((componentBody) => ({
                    componentBody,
                    distance: AltiumScene3dShapeStackOwnerAdapter.#distance(
                        placement?.bodyPositionMil,
                        componentBody?.positionMil
                    ),
                    standoffError:
                        AltiumScene3dShapeStackOwnerAdapter.#standoffError(
                            placement,
                            componentBody
                        ),
                    score: AltiumScene3dShapeStackOwnerAdapter.#identityScore(
                        placement,
                        componentBody
                    )
                }))
                .filter((candidate) => candidate.distance <= 0.01)
                .sort(
                    (left, right) =>
                        right.score - left.score ||
                        left.standoffError - right.standoffError ||
                        left.distance - right.distance
                )[0]?.componentBody || null
        )
    }

    /**
     * Scores whether a source body row matches an already-known stack height.
     * @param {object} placement External placement.
     * @param {object} componentBody Source body row.
     * @returns {number}
     */
    static #standoffError(placement, componentBody) {
        const placementHeight = Number(
            placement?.modelTransform?.offsetMil?.z ??
                placement?.modelTransform?.dzMil
        )
        const bodyStandoff = Number(componentBody?.standoffHeightMil)
        if (
            !Number.isFinite(placementHeight) ||
            !Number.isFinite(bodyStandoff) ||
            placementHeight <= 0
        ) {
            return 0
        }

        return Math.abs(placementHeight - bodyStandoff)
    }

    /**
     * Scores whether a source body row belongs to one placement.
     * @param {object} placement External placement.
     * @param {object} componentBody Source body row.
     * @returns {number}
     */
    static #identityScore(placement, componentBody) {
        const placementText = AltiumScene3dShapeStackOwnerAdapter.#identityText(
            [placement?.externalModel?.name, placement?.designator]
        )
        const bodyText = AltiumScene3dShapeStackOwnerAdapter.#identityText([
            componentBody?.name,
            componentBody?.identifier
        ])

        return placementText && bodyText && placementText.includes(bodyText)
            ? bodyText.length
            : 0
    }

    /**
     * Checks whether a component is a timing-package owner.
     * @param {object} component Source component.
     * @returns {boolean}
     */
    static #isTimingComponent(component) {
        const designator = String(component?.designator || '').trim()

        return (
            TIMING_DESIGNATOR_PATTERN.test(designator) ||
            TIMING_PACKAGE_PATTERN.test(
                [
                    component?.pattern,
                    component?.source,
                    component?.description,
                    component?.provenance?.footprintDescription,
                    ...Object.values(component?.parameters || {})
                ]
                    .map((value) => String(value || ''))
                    .join(' ')
            )
        )
    }

    /**
     * Scores how strongly a component looks like the fitted stack owner.
     * @param {object} component Source component.
     * @returns {number}
     */
    static #ownerRank(component) {
        const parameters = Object.values(component?.parameters || {}).filter(
            (value) => String(value || '').trim()
        )
        return (
            parameters.length * 10 +
            (TIMING_DESIGNATOR_PATTERN.test(component?.designator) ? 5 : 0) +
            (TIMING_PACKAGE_PATTERN.test(
                [
                    component?.pattern,
                    component?.source,
                    component?.description,
                    component?.provenance?.footprintDescription
                ]
                    .map((value) => String(value || ''))
                    .join(' ')
            )
                ? 3
                : 0)
        )
    }

    /**
     * Checks whether one body row came from shape-based component metadata.
     * @param {object | null | undefined} componentBody Source body row.
     * @returns {boolean}
     */
    static #isShapeBasedBody(componentBody) {
        return String(componentBody?.sourceStream || '').includes(
            'ShapeBasedComponentBodies'
        )
    }

    /**
     * Resolves one component's mount side.
     * @param {object} component Source component.
     * @returns {'top' | 'bottom'}
     */
    static #mountSide(component) {
        const layer = String(component?.layer || '').toUpperCase()
        return layer.includes('BOTTOM') || layer === 'BOT' ? 'bottom' : 'top'
    }

    /**
     * Resolves one board face Z coordinate.
     * @param {string} mountSide Mount side.
     * @param {object | undefined} board Scene board metadata.
     * @returns {number}
     */
    static #faceZ(mountSide, board) {
        const thickness = Number(board?.thicknessMil) || 63
        return String(mountSide || '').toLowerCase() === 'bottom'
            ? -thickness / 2
            : thickness / 2
    }

    /**
     * Normalizes an angle into [0, 360).
     * @param {number} angle Candidate angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360
        return normalized < 0 ? normalized + 360 : normalized
    }

    /**
     * Measures the XY distance between two board points.
     * @param {object | undefined} first First point.
     * @param {object | undefined} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }

    /**
     * Normalizes one point.
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
     * Builds a stable key for co-located authored stack variants.
     * @param {{ x?: number, y?: number }} point Stack anchor.
     * @returns {string}
     */
    static #groupKey(point) {
        return [
            'altium-shape-stack',
            AltiumScene3dShapeStackOwnerAdapter.#round(point?.x || 0),
            AltiumScene3dShapeStackOwnerAdapter.#round(point?.y || 0)
        ].join(':')
    }

    /**
     * Builds normalized identity text.
     * @param {unknown[]} values Identity values.
     * @returns {string}
     */
    static #identityText(values) {
        return values
            .map((value) =>
                String(value || '')
                    .replace(/\.[^.]+$/, '')
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/gu, '')
            )
            .filter(Boolean)
            .join(' ')
    }

    /**
     * Rounds one mil value for stable scene output.
     * @param {number} value Candidate value.
     * @returns {number}
     */
    static #round(value) {
        const rounded = Math.round(Number(value) * 10000) / 10000
        return Object.is(rounded, -0) ? 0 : rounded
    }
}
