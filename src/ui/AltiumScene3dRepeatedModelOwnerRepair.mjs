const CONNECTOR_TOKENS = new Set([
    'antenna',
    'coax',
    'connector',
    'edge',
    'rf',
    'socket'
])
const PASSIVE_BODY_PATTERN =
    /(?:^|[^a-z0-9])(?:cap|capacitor|res|resistor|ind|inductor|ferrite|bead|lqw|lqg)(?:$|[^a-z0-9])/i
const TIMING_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:clock|crystal|osc|oscillator|resonator|tcxo|txco|xtal)(?:$|[^a-z0-9])/i
const TIMING_DESIGNATOR_PATTERN = /^(?:y|xo)\d+[a-z]?$/i

/**
 * Repairs repeated Altium model-anchor bodies by matching their shared source
 * origin offset to repeated compatible footprint owners.
 */
export class AltiumScene3dRepeatedModelOwnerRepair {
    static #OFFSET_TOLERANCE_MIL = 8
    static #MIN_OWNER_DISTANCE_MIL = 25

    /**
     * Applies repeated-model owner repair to an Altium scene.
     * @param {object} sceneDescription Scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !Array.isArray(sceneDescription?.externalPlacements)
        ) {
            return sceneDescription
        }

        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        if (!components.length) {
            return sceneDescription
        }

        const componentByDesignator = new Map(
            components.map((component) => [
                String(component?.designator || ''),
                component
            ])
        )
        const placements = sceneDescription.externalPlacements.map(
            (placement) =>
                AltiumScene3dRepeatedModelOwnerRepair.#withPassiveOwnerCenter(
                    placement,
                    componentByDesignator.get(
                        String(placement?.designator || '')
                    ),
                    sceneDescription.board
                )
        )

        for (const group of AltiumScene3dRepeatedModelOwnerRepair.#groups(
            placements,
            componentByDesignator
        )) {
            const matches =
                AltiumScene3dRepeatedModelOwnerRepair.#matchGroupOwners(
                    group.records,
                    components
                )
            if (!matches) {
                continue
            }

            for (const match of matches) {
                placements[match.record.index] =
                    AltiumScene3dRepeatedModelOwnerRepair.#withOwner(
                        match.record.placement,
                        match.component,
                        sceneDescription.board,
                        match.offset
                    )
            }
        }

        return { ...sceneDescription, externalPlacements: placements }
    }

    /**
     * Groups repairable repeated model-anchor placements.
     * @param {object[]} placements Scene placements.
     * @param {Map<string, object>} componentByDesignator Components by designator.
     * @returns {{ records: { index: number, placement: object }[] }[]}
     */
    static #groups(placements, componentByDesignator) {
        const groups = new Map()

        placements.forEach((placement, index) => {
            if (
                !AltiumScene3dRepeatedModelOwnerRepair.#isRepairablePlacement(
                    placement,
                    componentByDesignator
                )
            ) {
                return
            }

            const key =
                [
                    String(placement?.externalModel?.name || ''),
                    String(placement?.mountSide || '').toLowerCase(),
                    AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                        placement?.rotationDeg
                    )
                ].join('|') || 'model'
            const records = groups.get(key) || []
            records.push({ index, placement })
            groups.set(key, records)
        })

        return [...groups.values()]
            .filter((records) => records.length > 1)
            .map((records) => ({ records }))
    }

    /**
     * Checks whether one placement should participate in group owner repair.
     * @param {object} placement Scene placement.
     * @param {Map<string, object>} componentByDesignator Components by designator.
     * @returns {boolean}
     */
    static #isRepairablePlacement(placement, componentByDesignator) {
        if (
            String(placement?.projection?.source || '') !==
                'model-anchor-fallback' ||
            !placement?.bodyPositionMil ||
            !placement?.positionMil ||
            !placement?.externalModel
        ) {
            return false
        }

        const component = componentByDesignator.get(
            String(placement?.designator || '')
        )
        if (!component) {
            return true
        }

        return (
            AltiumScene3dRepeatedModelOwnerRepair.#distance(
                placement.bodyPositionMil,
                component
            ) > AltiumScene3dRepeatedModelOwnerRepair.#MIN_OWNER_DISTANCE_MIL
        )
    }

    /**
     * Centers a generic passive body on its resolved owner when the body anchor
     * carries a moderate source-origin offset.
     * @param {object} placement Scene placement.
     * @param {object | undefined} component Resolved owner.
     * @param {object} board Scene board metadata.
     * @returns {object}
     */
    static #withPassiveOwnerCenter(placement, component, board) {
        if (
            !component ||
            String(placement?.projection?.source || '') !== 'pad-fallback' ||
            !AltiumScene3dRepeatedModelOwnerRepair.#isPassivePlacement(
                placement,
                component
            )
        ) {
            return placement
        }

        const offset = {
            x:
                Number(placement?.bodyPositionMil?.x || 0) -
                Number(component?.x || 0),
            y:
                Number(placement?.bodyPositionMil?.y || 0) -
                Number(component?.y || 0)
        }
        if (
            Math.hypot(offset.x, offset.y) <=
            AltiumScene3dRepeatedModelOwnerRepair.#MIN_OWNER_DISTANCE_MIL
        ) {
            return placement
        }

        return AltiumScene3dRepeatedModelOwnerRepair.#withOwner(
            placement,
            component,
            board,
            offset
        )
    }

    /**
     * Checks whether a placement/component pair describes a generic passive.
     * @param {object} placement Scene placement.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isPassivePlacement(placement, component) {
        return PASSIVE_BODY_PATTERN.test(
            [
                placement?.designator,
                placement?.externalModel?.name,
                component?.pattern,
                component?.source,
                component?.description
            ]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Matches one repeated placement group to compatible components.
     * @param {{ placement: object }[]} records Group records.
     * @param {object[]} components PCB components.
     * @returns {{ record: object, component: object, offset: object }[] | null}
     */
    static #matchGroupOwners(records, components) {
        const candidates =
            AltiumScene3dRepeatedModelOwnerRepair.#compatibleComponents(
                records[0]?.placement,
                components
            )
        const connectorMatches =
            AltiumScene3dRepeatedModelOwnerRepair.#matchCandidateOwners(
                records,
                candidates
            )
        if (connectorMatches) {
            return connectorMatches
        }

        return AltiumScene3dRepeatedModelOwnerRepair.#matchCandidateOwners(
            records,
            AltiumScene3dRepeatedModelOwnerRepair.#compatibleTimingComponents(
                records[0]?.placement,
                components
            )
        )
    }

    /**
     * Matches records against one candidate component set.
     * @param {{ placement: object }[]} records Group records.
     * @param {object[]} candidates Candidate components.
     * @returns {{ record: object, component: object, offset: object }[] | null}
     */
    static #matchCandidateOwners(records, candidates) {
        if (candidates.length < records.length) {
            return null
        }

        const attempts = records.flatMap((record) =>
            candidates.map((component) => ({
                x:
                    Number(record.placement.bodyPositionMil?.x || 0) -
                    Number(component?.x || 0),
                y:
                    Number(record.placement.bodyPositionMil?.y || 0) -
                    Number(component?.y || 0)
            }))
        )
        const matches = attempts
            .map((offset) => ({
                offset,
                matches:
                    AltiumScene3dRepeatedModelOwnerRepair.#matchesForOffset(
                        records,
                        candidates,
                        offset
                    )
            }))
            .filter((attempt) => attempt.matches.length === records.length)
            .sort(
                (left, right) =>
                    AltiumScene3dRepeatedModelOwnerRepair.#matchError(
                        left.matches
                    ) -
                    AltiumScene3dRepeatedModelOwnerRepair.#matchError(
                        right.matches
                    )
            )

        return matches[0]?.matches || null
    }

    /**
     * Resolves compatible components for one placement group.
     * @param {object} placement Representative placement.
     * @param {object[]} components PCB components.
     * @returns {object[]}
     */
    static #compatibleComponents(placement, components) {
        const mountSide = String(placement?.mountSide || '').toLowerCase()
        const rotation = AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
            placement?.rotationDeg
        )

        return components.filter(
            (component) =>
                AltiumScene3dRepeatedModelOwnerRepair.#mountSide(component) ===
                    mountSide &&
                AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                    component?.rotation
                ) === rotation &&
                AltiumScene3dRepeatedModelOwnerRepair.#connectorScore(
                    component
                ) >= 2
        )
    }

    /**
     * Resolves timing-package candidates for repeated bodies with shared
     * source-origin offsets.
     * @param {object} placement Representative placement.
     * @param {object[]} components PCB components.
     * @returns {object[]}
     */
    static #compatibleTimingComponents(placement, components) {
        if (
            !AltiumScene3dRepeatedModelOwnerRepair.#isTimingPlacement(placement)
        ) {
            return []
        }

        const mountSide = String(placement?.mountSide || '').toLowerCase()
        const rotation = AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
            placement?.rotationDeg
        )

        return components.filter(
            (component) =>
                AltiumScene3dRepeatedModelOwnerRepair.#mountSide(component) ===
                    mountSide &&
                AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                    component?.rotation
                ) === rotation &&
                AltiumScene3dRepeatedModelOwnerRepair.#isTimingComponent(
                    component
                )
        )
    }

    /**
     * Matches records to components for one candidate shared offset.
     * @param {{ placement: object }[]} records Group records.
     * @param {object[]} components Compatible components.
     * @param {{ x: number, y: number }} offset Candidate offset.
     * @returns {{ record: object, component: object, offset: object, error: number }[]}
     */
    static #matchesForOffset(records, components, offset) {
        const unused = new Set(components)
        const matches = []

        for (const record of records) {
            const match =
                AltiumScene3dRepeatedModelOwnerRepair.#nearestOffsetComponent(
                    record.placement,
                    unused,
                    offset
                )
            if (!match) {
                return matches
            }

            unused.delete(match.component)
            matches.push({ record, ...match, offset })
        }

        return matches
    }

    /**
     * Finds the unused component whose center plus offset reaches a body.
     * @param {object} placement Scene placement.
     * @param {Set<object>} components Unused compatible components.
     * @param {{ x: number, y: number }} offset Candidate offset.
     * @returns {{ component: object, error: number } | null}
     */
    static #nearestOffsetComponent(placement, components, offset) {
        const body = placement?.bodyPositionMil || {}
        const matches = [...components]
            .map((component) => ({
                component,
                error: Math.hypot(
                    Number(component?.x || 0) +
                        Number(offset?.x || 0) -
                        Number(body.x || 0),
                    Number(component?.y || 0) +
                        Number(offset?.y || 0) -
                        Number(body.y || 0)
                )
            }))
            .filter(
                (match) =>
                    match.error <=
                    AltiumScene3dRepeatedModelOwnerRepair.#OFFSET_TOLERANCE_MIL
            )
            .sort((left, right) => left.error - right.error)

        return matches[0] || null
    }

    /**
     * Sums offset match error.
     * @param {{ error: number }[]} matches Offset matches.
     * @returns {number}
     */
    static #matchError(matches) {
        return matches.reduce(
            (total, match) => total + Number(match?.error || 0),
            0
        )
    }

    /**
     * Applies a resolved component owner and centers the model on it.
     * @param {object} placement Scene placement.
     * @param {object} component Resolved owner.
     * @param {object} board Scene board metadata.
     * @param {{ x: number, y: number }} offset Source-origin offset.
     * @returns {object}
     */
    static #withOwner(placement, component, board, offset) {
        const mountSide =
            AltiumScene3dRepeatedModelOwnerRepair.#mountSide(component) ||
            placement.mountSide

        return {
            ...placement,
            designator: String(component?.designator || placement.designator),
            mountSide,
            rotationDeg: AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                component?.rotation
            ),
            positionMil: {
                ...placement.positionMil,
                x: Number(component?.x || 0) - Number(board?.centerX || 0),
                y: Number(component?.y || 0) - Number(board?.centerY || 0),
                z: AltiumScene3dRepeatedModelOwnerRepair.#faceZ(
                    mountSide,
                    board
                )
            },
            modelTransform: {
                ...(placement.modelTransform || {}),
                ownerAnchorOffsetMil: {
                    x: Number(offset?.x || 0),
                    y: Number(offset?.y || 0)
                }
            }
        }
    }

    /**
     * Scores connector-like identity tokens on one component.
     * @param {object} component PCB component.
     * @returns {number}
     */
    static #connectorScore(component) {
        return new Set(
            AltiumScene3dRepeatedModelOwnerRepair.#identityText(component)
                .split(/[^a-zA-Z0-9]+/gu)
                .map((token) => token.toLowerCase())
                .filter((token) => CONNECTOR_TOKENS.has(token))
        ).size
    }

    /**
     * Checks whether one placement identifies a timing package model.
     * @param {object} placement External model placement.
     * @returns {boolean}
     */
    static #isTimingPlacement(placement) {
        return TIMING_PACKAGE_PATTERN.test(
            [
                placement?.designator,
                placement?.externalModel?.name,
                placement?.externalModel?.sourceStream
            ]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Checks whether one component is a timing package owner.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isTimingComponent(component) {
        const designator = String(component?.designator || '').trim()

        return (
            TIMING_DESIGNATOR_PATTERN.test(designator) ||
            TIMING_PACKAGE_PATTERN.test(
                AltiumScene3dRepeatedModelOwnerRepair.#identityText(component)
            )
        )
    }

    /**
     * Builds component identity text.
     * @param {object} component PCB component.
     * @returns {string}
     */
    static #identityText(component) {
        return [
            component?.pattern,
            component?.source,
            component?.description,
            ...Object.values(component?.parameters || {})
        ]
            .map((value) => String(value || ''))
            .join(' ')
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
     * Resolves one board face Z coordinate.
     * @param {string} mountSide Mount side.
     * @param {object} board Board metadata.
     * @returns {number}
     */
    static #faceZ(mountSide, board) {
        const thickness = Number(board?.thicknessMil) || 63
        const halfThickness = thickness / 2

        return String(mountSide || '').toLowerCase() === 'bottom'
            ? -halfThickness
            : halfThickness
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
