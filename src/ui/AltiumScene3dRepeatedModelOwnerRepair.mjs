import { PcbScene3dPackageDimensionResolver } from './PcbScene3dPackageDimensionResolver.mjs'
import { AltiumScene3dRepeatedFullFootprintBodyCollapse } from './AltiumScene3dRepeatedFullFootprintBodyCollapse.mjs'

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
const COMPACT_IC_BODY_PATTERN =
    /(?:^|[^a-z0-9])(?:u?qfn(?:[-_ ]?\d+)?|dfn(?:[-_ ]?\d+)?|qfp(?:[-_ ]?\d+)?|bga(?:[-_ ]?\d+)?|lga(?:[-_ ]?\d+)?)(?:$|[^a-z0-9])/i
const MODEL_BOUNDS_CORNER_ORIGIN_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:[a-z0-9]*qfn[a-z0-9]*|[a-z0-9]*dfn[a-z0-9]*|qfp|lqfp|tqfp|bga|lga)(?:[-_ ]?\d+)?(?:$|[^a-z0-9])/i
const TIMING_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:clock|crystal|osc|oscillator|resonator|tcxo|txco|xtal)(?:$|[^a-z0-9])/i
const TIMING_DESIGNATOR_PATTERN = /^(?:y|xo)\d+[a-z]?$/i
const AUTHORED_ANCHOR_IDENTITY_PATTERN =
    /(?:^|[^a-z0-9])(?:antenna|coax|connector|edge|header|jack|mechanical|module|mount|shield|sma|socket)(?:$|[^a-z0-9])/i
const PAD_FALLBACK_AUTHORED_ANCHOR_PATTERN =
    /(?:^|[^a-z0-9])(?:antenna|coax|conn|connector|edge|flex|fpc|frame|hardware|header|jack|mechanical|module|shield|sma|socket)(?:$|[^a-z0-9])/i
const USB_ANCHOR_IDENTITY_PATTERN = /(?:^|[^a-z0-9])usb(?:$|[^a-z0-9])/i
const INTEGRATED_CIRCUIT_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:u?qfn|v?qfn|dfn|qfp|lqfp|tqfp|bga|lga|sop|soic|ssop|tssop|msop|so[-_ ]?\d+)(?:[-_ ]?\d+)?(?:$|[^a-z0-9])/i
const SHIELD_COVER_TOKEN_PATTERN =
    /(?:^|[^a-z0-9])(?:rf|emi|rfi|shield|cover)(?:$|[^a-z0-9])/gi

/**
 * Repairs repeated Altium model-anchor bodies by matching their shared source
 * origin offset to repeated compatible footprint owners.
 */
export class AltiumScene3dRepeatedModelOwnerRepair {
    static #OFFSET_TOLERANCE_MIL = 8
    static #MIN_OWNER_DISTANCE_MIL = 25
    static #MIN_PAD_FALLBACK_OWNER_OFFSET_MIL = 1

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
        const pads = Array.isArray(documentModel?.pcb?.pads)
            ? documentModel.pcb.pads
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
        const collapsedPlacements =
            AltiumScene3dRepeatedFullFootprintBodyCollapse.apply(
                sceneDescription.externalPlacements,
                componentByDesignator,
                pads
            )
        const placements = collapsedPlacements.map((placement) =>
            AltiumScene3dRepeatedModelOwnerRepair.#withSingleOwnerCenter(
                placement,
                componentByDesignator.get(String(placement?.designator || '')),
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
     * Centers a single body on its resolved owner when the body anchor carries
     * a source-origin offset that is not an authored mechanical anchor.
     * @param {object} placement Scene placement.
     * @param {object | undefined} component Resolved owner.
     * @param {object} board Scene board metadata.
     * @returns {object}
     */
    static #withSingleOwnerCenter(placement, component, board) {
        const projectionSource = String(
            placement?.projection?.source || ''
        ).toLowerCase()
        if (
            !component ||
            (projectionSource !== 'pad-fallback' &&
                projectionSource !== 'model-bounds') ||
            AltiumScene3dRepeatedModelOwnerRepair.#isAuthoredAnchorPlacement(
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
            AltiumScene3dRepeatedModelOwnerRepair
                .#MIN_PAD_FALLBACK_OWNER_OFFSET_MIL
        ) {
            return placement
        }
        if (
            projectionSource === 'model-bounds' &&
            !AltiumScene3dRepeatedModelOwnerRepair.#hasModelBoundsCornerSourceOriginOffset(
                placement,
                component,
                offset
            )
        ) {
            return placement
        }

        return AltiumScene3dRepeatedModelOwnerRepair.#withOwner(
            placement,
            component,
            board,
            offset,
            {
                preserveRotation: true,
                carryRenderableSourceOffset: projectionSource !== 'model-bounds'
            }
        )
    }

    /**
     * Checks whether a model-bounds IC body uses a package-corner source
     * origin rather than an authored mechanical anchor.
     * @param {object} placement Scene placement.
     * @param {object} component PCB component.
     * @param {{ x: number, y: number }} offset Body anchor offset from owner.
     * @returns {boolean}
     */
    static #hasModelBoundsCornerSourceOriginOffset(
        placement,
        component,
        offset
    ) {
        const identityText =
            AltiumScene3dRepeatedModelOwnerRepair.#identityTextForPlacement(
                placement,
                component
            )
        if (!MODEL_BOUNDS_CORNER_ORIGIN_PACKAGE_PATTERN.test(identityText)) {
            return false
        }

        const offsetWidth = Math.abs(Number(offset?.x || 0)) * 2
        const offsetDepth = Math.abs(Number(offset?.y || 0)) * 2

        return AltiumScene3dRepeatedModelOwnerRepair.#matchesCornerOriginBounds(
            offsetWidth,
            offsetDepth,
            placement?.projection?.boundsMil
        )
    }

    /**
     * Checks whether a placement/component pair describes an authored hardware
     * anchor whose source body position should remain authoritative.
     * @param {object} placement Scene placement.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isAuthoredAnchorPlacement(placement, component) {
        const identityText =
            AltiumScene3dRepeatedModelOwnerRepair.#identityTextForPlacement(
                placement,
                component
            )
        if (PASSIVE_BODY_PATTERN.test(identityText)) {
            return false
        }

        if (
            String(placement?.projection?.source || '').toLowerCase() ===
            'pad-fallback'
        ) {
            if (
                AltiumScene3dRepeatedModelOwnerRepair.#hasShieldCoverSourceOriginOffset(
                    placement,
                    component,
                    identityText
                )
            ) {
                return false
            }

            return (
                AltiumScene3dRepeatedModelOwnerRepair.#hasPadFallbackAuthoredAnchorIdentity(
                    identityText
                ) ||
                AltiumScene3dRepeatedModelOwnerRepair.#hasCompactIcSourceOriginOffset(
                    placement,
                    component,
                    identityText
                )
            )
        }

        return AltiumScene3dRepeatedModelOwnerRepair.#hasAuthoredAnchorIdentity(
            identityText
        )
    }

    /**
     * Checks whether pad-fallback identity describes an authored hardware
     * anchor instead of a source-origin-biased IC body.
     * @param {string} identityText Searchable package identity.
     * @returns {boolean}
     */
    static #hasPadFallbackAuthoredAnchorIdentity(identityText) {
        return (
            PAD_FALLBACK_AUTHORED_ANCHOR_PATTERN.test(identityText) ||
            AltiumScene3dRepeatedModelOwnerRepair.#hasUsbHardwareAnchorIdentity(
                identityText
            )
        )
    }

    /**
     * Checks whether non-pad-fallback identity describes authored hardware.
     * @param {string} identityText Searchable package identity.
     * @returns {boolean}
     */
    static #hasAuthoredAnchorIdentity(identityText) {
        return (
            AUTHORED_ANCHOR_IDENTITY_PATTERN.test(identityText) ||
            AltiumScene3dRepeatedModelOwnerRepair.#hasUsbHardwareAnchorIdentity(
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
            USB_ANCHOR_IDENTITY_PATTERN.test(identityText) &&
            !INTEGRATED_CIRCUIT_PACKAGE_PATTERN.test(identityText)
        )
    }

    /**
     * Checks whether a shield cover body origin is a package corner.
     * @param {object} placement Scene placement.
     * @param {object} component PCB component.
     * @param {string} identityText Searchable package identity.
     * @returns {boolean}
     */
    static #hasShieldCoverSourceOriginOffset(
        placement,
        component,
        identityText
    ) {
        const tokens = new Set(
            [...String(identityText || '').matchAll(SHIELD_COVER_TOKEN_PATTERN)]
                .map((match) => String(match[0] || '').toLowerCase())
                .map((token) => token.replace(/[^a-z0-9]+/giu, ''))
        )
        if (
            !tokens.has('cover') ||
            !['rf', 'emi', 'rfi', 'shield'].some((token) => tokens.has(token))
        ) {
            return false
        }

        const size =
            PcbScene3dPackageDimensionResolver.resolvePlanarSize(component)
        if (!size) {
            return false
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
            !Number.isFinite(offset.x) ||
            !Number.isFinite(offset.y) ||
            Math.hypot(offset.x, offset.y) <=
                AltiumScene3dRepeatedModelOwnerRepair
                    .#MIN_PAD_FALLBACK_OWNER_OFFSET_MIL
        ) {
            return false
        }

        return AltiumScene3dRepeatedModelOwnerRepair.#matchesCornerOriginSize(
            Math.abs(offset.x) * 2,
            Math.abs(offset.y) * 2,
            size
        )
    }

    /**
     * Checks whether doubled owner offset matches package dimensions.
     * @param {number} offsetWidth Doubled X offset.
     * @param {number} offsetDepth Doubled Y offset.
     * @param {{ width: number, depth: number }} size Explicit package size.
     * @returns {boolean}
     */
    static #matchesCornerOriginSize(offsetWidth, offsetDepth, size) {
        return (
            (AltiumScene3dRepeatedModelOwnerRepair.#matchesDimension(
                offsetWidth,
                size.width
            ) &&
                AltiumScene3dRepeatedModelOwnerRepair.#matchesDimension(
                    offsetDepth,
                    size.depth
                )) ||
            (AltiumScene3dRepeatedModelOwnerRepair.#matchesDimension(
                offsetWidth,
                size.depth
            ) &&
                AltiumScene3dRepeatedModelOwnerRepair.#matchesDimension(
                    offsetDepth,
                    size.width
                ))
        )
    }

    /**
     * Checks whether doubled owner offsets match any planar pair from measured
     * model bounds. Tilted STEP bodies often expose package height on `depth`
     * and package width/depth on `width` plus `height`.
     * @param {number} offsetWidth Doubled X offset.
     * @param {number} offsetDepth Doubled Y offset.
     * @param {{ width?: number, depth?: number, height?: number } | null | undefined} bounds Model bounds.
     * @returns {boolean}
     */
    static #matchesCornerOriginBounds(offsetWidth, offsetDepth, bounds) {
        const dimensions = [
            Number(bounds?.width),
            Number(bounds?.depth),
            Number(bounds?.height)
        ].filter((dimension) => Number.isFinite(dimension) && dimension > 0)

        return dimensions.some((width, widthIndex) =>
            dimensions.some(
                (depth, depthIndex) =>
                    widthIndex !== depthIndex &&
                    AltiumScene3dRepeatedModelOwnerRepair.#matchesCornerOriginSize(
                        offsetWidth,
                        offsetDepth,
                        { width, depth }
                    )
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
     * Checks whether a compact IC uses a small authored source-origin offset.
     * @param {object} placement Scene placement.
     * @param {object} component PCB component.
     * @param {string} identityText Searchable package identity.
     * @returns {boolean}
     */
    static #hasCompactIcSourceOriginOffset(placement, component, identityText) {
        const distance = AltiumScene3dRepeatedModelOwnerRepair.#distance(
            placement?.bodyPositionMil,
            component
        )

        return (
            COMPACT_IC_BODY_PATTERN.test(identityText) &&
            distance >
                AltiumScene3dRepeatedModelOwnerRepair
                    .#MIN_PAD_FALLBACK_OWNER_OFFSET_MIL &&
            distance <
                AltiumScene3dRepeatedModelOwnerRepair.#MIN_OWNER_DISTANCE_MIL
        )
    }

    /**
     * Builds searchable identity text for placement-owner policy checks.
     * @param {object} placement Scene placement.
     * @param {object} component PCB component.
     * @returns {string}
     */
    static #identityTextForPlacement(placement, component) {
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
     * @param {{ preserveRotation?: boolean, carryRenderableSourceOffset?: boolean }} [options] Repair options.
     * @returns {object}
     */
    static #withOwner(placement, component, board, offset, options = {}) {
        const mountSide =
            AltiumScene3dRepeatedModelOwnerRepair.#mountSide(component) ||
            placement.mountSide
        const rotationDeg = options?.preserveRotation
            ? AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                  placement?.rotationDeg
              )
            : AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                  component?.rotation
              )
        const renderableOffset =
            options?.carryRenderableSourceOffset === false
                ? AltiumScene3dRepeatedModelOwnerRepair.#renderableZOffset(
                      placement?.modelTransform
                  )
                : AltiumScene3dRepeatedModelOwnerRepair.#renderableOwnerAnchorOffset(
                      { mountSide, rotationDeg },
                      offset,
                      placement?.modelTransform
                  )

        return {
            ...placement,
            designator: String(component?.designator || placement.designator),
            mountSide,
            rotationDeg,
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
                offsetMil: renderableOffset,
                ownerAnchorOffsetMil: {
                    x: Number(offset?.x || 0),
                    y: Number(offset?.y || 0)
                }
            }
        }
    }

    /**
     * Preserves authored model Z offset while suppressing lateral render shift.
     * @param {object | undefined} modelTransform Existing model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #renderableZOffset(modelTransform) {
        const z = Number(
            modelTransform?.offsetMil?.z ?? modelTransform?.dzMil ?? 0
        )

        return { x: 0, y: 0, z: Number.isFinite(z) ? z : 0 }
    }

    /**
     * Converts a board-space source-origin offset into mount-rig local XY.
     * @param {{ mountSide?: string, rotationDeg?: number }} placement Resolved placement fields.
     * @param {{ x: number, y: number }} offset Board-space owner offset.
     * @param {object | undefined} modelTransform Existing model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #renderableOwnerAnchorOffset(placement, offset, modelTransform) {
        const rotationRad =
            (-AltiumScene3dRepeatedModelOwnerRepair.#normalizeAngle(
                Number(placement?.rotationDeg || 0)
            ) *
                Math.PI) /
            180
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)
        const sourceY =
            AltiumScene3dRepeatedModelOwnerRepair.#isBottomPlacement(placement)
                ? -Number(offset?.y || 0)
                : Number(offset?.y || 0)
        const x = Number(offset?.x || 0) * cos - sourceY * sin
        const y = Number(offset?.x || 0) * sin + sourceY * cos
        const z = Number(
            modelTransform?.offsetMil?.z ?? modelTransform?.dzMil ?? 0
        )

        return {
            x: Math.abs(x) < Number.EPSILON ? 0 : Number(x.toFixed(10)),
            y: AltiumScene3dRepeatedModelOwnerRepair.#isBottomPlacement(
                placement
            )
                ? Math.abs(y) < Number.EPSILON
                    ? 0
                    : Number((-y).toFixed(10))
                : Math.abs(y) < Number.EPSILON
                  ? 0
                  : Number(y.toFixed(10)),
            z: Number.isFinite(z) ? z : 0
        }
    }

    /**
     * Checks whether one placement mounts on the board bottom face.
     * @param {{ mountSide?: string } | null | undefined} placement Placement.
     * @returns {boolean}
     */
    static #isBottomPlacement(placement) {
        return String(placement?.mountSide || '').toLowerCase() === 'bottom'
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
