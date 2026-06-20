const MIN_GROUP_PAD_COUNT = 4
const MIN_ASPECT_RATIO = 1.4
const MIN_DIRECTION_STABILITY = 0.35
const PARALLEL_TOLERANCE_DEG = 30
const MIN_PARALLEL_RATIO = 0.6
const ROW_GAP_SHORT_SIZE_FACTOR = 1.5

/**
 * Normalizes rectangular pad axes for parsed two-row surface-mount footprints.
 */
export class PcbFootprintPadAxisNormalizer {
    static #documentCache = new WeakMap()

    /**
     * Returns a document model with row-parallel rectangular pads turned across
     * their owning two-row footprint.
     * @param {object} documentModel Document model.
     * @returns {object}
     */
    static apply(documentModel) {
        if (!PcbFootprintPadAxisNormalizer.#canCache(documentModel)) {
            return documentModel
        }

        const cachedDocument =
            PcbFootprintPadAxisNormalizer.#documentCache.get(documentModel)
        if (cachedDocument) return cachedDocument

        const pcb = documentModel?.pcb
        const sourcePads =
            PcbFootprintPadAxisNormalizer.#firstPadList(pcb) || []
        const updates =
            PcbFootprintPadAxisNormalizer.#resolvePadRotationUpdates(sourcePads)
        if (!updates.objects.size && !updates.signatures.size) {
            PcbFootprintPadAxisNormalizer.#documentCache.set(
                documentModel,
                documentModel
            )
            return documentModel
        }

        const normalizedDocument =
            PcbFootprintPadAxisNormalizer.#applyPadUpdatesToDocument(
                documentModel,
                updates
            )
        PcbFootprintPadAxisNormalizer.#documentCache.set(
            documentModel,
            normalizedDocument
        )
        return normalizedDocument
    }

    /**
     * Returns true when a value can be used as a WeakMap key.
     * @param {unknown} value Value to test.
     * @returns {boolean}
     */
    static #canCache(value) {
        return (
            value !== null &&
            (typeof value === 'object' || typeof value === 'function')
        )
    }

    /**
     * Returns the first PCB pad list present in the document model.
     * @param {object | null | undefined} pcb PCB model.
     * @returns {object[] | null}
     */
    static #firstPadList(pcb) {
        if (Array.isArray(pcb?.pads)) return pcb.pads
        if (Array.isArray(pcb?.kicadBoard?.pads)) return pcb.kicadBoard.pads
        return null
    }

    /**
     * Resolves pad rotation updates keyed by object identity and signature.
     * @param {object[]} pads PCB pad list.
     * @returns {{ objects: Map<object, number>, signatures: Map<string, number> }}
     */
    static #resolvePadRotationUpdates(pads) {
        const updates = {
            objects: new Map(),
            signatures: new Map()
        }
        const groups = PcbFootprintPadAxisNormalizer.#groupPadsByOwner(pads)

        for (const groupPads of groups.values()) {
            PcbFootprintPadAxisNormalizer.#addGroupPadRotationUpdates(
                groupPads,
                updates
            )
        }

        return updates
    }

    /**
     * Groups pads by their owning component or footprint.
     * @param {object[]} pads PCB pad list.
     * @returns {Map<string, object[]>}
     */
    static #groupPadsByOwner(pads) {
        const groups = new Map()

        for (const pad of pads || []) {
            const key = PcbFootprintPadAxisNormalizer.#padOwnerKey(pad)
            if (!key) continue

            const group = groups.get(key) || []
            group.push(pad)
            groups.set(key, group)
        }

        return groups
    }

    /**
     * Adds inferred rotation updates for one footprint pad group.
     * @param {object[]} groupPads Pads owned by one footprint.
     * @param {{ objects: Map<object, number>, signatures: Map<string, number> }} updates Rotation updates.
     * @returns {void}
     */
    static #addGroupPadRotationUpdates(groupPads, updates) {
        const candidates = groupPads.filter((pad) =>
            PcbFootprintPadAxisNormalizer.#isCandidateSurfacePad(pad)
        )
        if (candidates.length < MIN_GROUP_PAD_COUNT) return

        const rowAngle =
            PcbFootprintPadAxisNormalizer.#resolveNearestNeighborLineAngle(
                candidates
            )
        if (rowAngle === null) return
        if (
            !PcbFootprintPadAxisNormalizer.#hasSeparatedRows(
                candidates,
                rowAngle
            )
        ) {
            return
        }

        const parallelPads = candidates.filter((pad) =>
            PcbFootprintPadAxisNormalizer.#isPadLongAxisParallelToRow(
                pad,
                rowAngle
            )
        )
        const minimumParallelPads = Math.max(
            MIN_GROUP_PAD_COUNT,
            Math.ceil(candidates.length * MIN_PARALLEL_RATIO)
        )
        if (parallelPads.length < minimumParallelPads) return

        for (const pad of parallelPads) {
            const rotation = PcbFootprintPadAxisNormalizer.#normalizeAngle(
                Number(pad?.rotation || 0) + 90
            )
            updates.objects.set(pad, rotation)
            updates.signatures.set(
                PcbFootprintPadAxisNormalizer.#padSignature(pad),
                rotation
            )
        }
    }

    /**
     * Returns true when one pad is a rectangular-ish surface pad with a clear
     * long axis.
     * @param {object} pad PCB pad.
     * @returns {boolean}
     */
    static #isCandidateSurfacePad(pad) {
        if (PcbFootprintPadAxisNormalizer.#hasDrill(pad)) return false

        const dimensions = PcbFootprintPadAxisNormalizer.#padDimensions(pad)
        if (!dimensions) return false

        const shortest = Math.min(dimensions.width, dimensions.height)
        const longest = Math.max(dimensions.width, dimensions.height)
        if (shortest <= 0) return false

        return longest / shortest >= MIN_ASPECT_RATIO
    }

    /**
     * Returns true when one pad has a drill hole or slot.
     * @param {object} pad PCB pad.
     * @returns {boolean}
     */
    static #hasDrill(pad) {
        const values = [
            pad?.holeDiameter,
            pad?.drillDiameter,
            pad?.holeSize,
            pad?.slotLength,
            pad?.holeSlotLength
        ]

        return values.some(
            (value) =>
                Number.isFinite(Number(value)) && Math.abs(Number(value)) > 0
        )
    }

    /**
     * Resolves the visible rectangular pad dimensions.
     * @param {object} pad PCB pad.
     * @returns {{ width: number, height: number } | null}
     */
    static #padDimensions(pad) {
        const width = PcbFootprintPadAxisNormalizer.#firstFiniteNumber([
            pad?.width,
            pad?.sizeTopX,
            pad?.sizeBottomX
        ])
        const height = PcbFootprintPadAxisNormalizer.#firstFiniteNumber([
            pad?.height,
            pad?.sizeTopY,
            pad?.sizeBottomY
        ])

        if (!Number.isFinite(width) || !Number.isFinite(height)) return null
        if (width <= 0 || height <= 0) return null

        return { width, height }
    }

    /**
     * Returns the first finite numeric value in a list.
     * @param {unknown[]} values Values to scan.
     * @returns {number}
     */
    static #firstFiniteNumber(values) {
        for (const value of values) {
            const number = Number(value)
            if (Number.isFinite(number)) return number
        }

        return NaN
    }

    /**
     * Resolves the dominant nearest-neighbor line angle for one two-row group.
     * @param {object[]} pads Candidate pads.
     * @returns {number | null}
     */
    static #resolveNearestNeighborLineAngle(pads) {
        const angles = []

        for (const pad of pads) {
            const neighbor = PcbFootprintPadAxisNormalizer.#nearestNeighbor(
                pad,
                pads
            )
            if (!neighbor) continue

            const angle =
                (Math.atan2(
                    Number(neighbor.y) - Number(pad.y),
                    Number(neighbor.x) - Number(pad.x)
                ) *
                    180) /
                Math.PI
            angles.push(
                PcbFootprintPadAxisNormalizer.#normalizeLineAngle(angle)
            )
        }

        return PcbFootprintPadAxisNormalizer.#meanLineAngle(angles)
    }

    /**
     * Finds the nearest distinct neighboring pad.
     * @param {object} pad Source pad.
     * @param {object[]} pads Candidate pads.
     * @returns {object | null}
     */
    static #nearestNeighbor(pad, pads) {
        let nearest = null
        let nearestDistance = Infinity

        for (const candidate of pads) {
            if (candidate === pad) continue

            const dx = Number(candidate?.x) - Number(pad?.x)
            const dy = Number(candidate?.y) - Number(pad?.y)
            const distance = dx * dx + dy * dy
            if (!Number.isFinite(distance) || distance <= 0) continue
            if (distance >= nearestDistance) continue

            nearest = candidate
            nearestDistance = distance
        }

        return nearest
    }

    /**
     * Returns the mean line angle using doubled-angle vector averaging.
     * @param {number[]} angles Line angles in degrees.
     * @returns {number | null}
     */
    static #meanLineAngle(angles) {
        if (!angles.length) return null

        let x = 0
        let y = 0
        for (const angle of angles) {
            const radians =
                (PcbFootprintPadAxisNormalizer.#normalizeLineAngle(angle) *
                    Math.PI *
                    2) /
                180
            x += Math.cos(radians)
            y += Math.sin(radians)
        }

        const magnitude = Math.hypot(x, y) / angles.length
        if (magnitude < MIN_DIRECTION_STABILITY) return null

        return PcbFootprintPadAxisNormalizer.#normalizeLineAngle(
            (Math.atan2(y, x) * 90) / Math.PI
        )
    }

    /**
     * Returns true when candidate pads form at least two separated rows.
     * @param {object[]} pads Candidate pads.
     * @param {number} rowAngle Row line angle in degrees.
     * @returns {boolean}
     */
    static #hasSeparatedRows(pads, rowAngle) {
        const radians = (rowAngle * Math.PI) / 180
        const sin = Math.sin(radians)
        const cos = Math.cos(radians)
        const values = pads
            .map((pad) => -sin * Number(pad?.x) + cos * Number(pad?.y))
            .filter((value) => Number.isFinite(value))
            .sort((a, b) => a - b)
        if (values.length < MIN_GROUP_PAD_COUNT) return false

        let gap = 0
        let gapIndex = -1
        for (let index = 1; index < values.length; index += 1) {
            const nextGap = values[index] - values[index - 1]
            if (nextGap > gap) {
                gap = nextGap
                gapIndex = index - 1
            }
        }

        if (gapIndex < 1) return false
        if (values.length - gapIndex - 1 < 2) return false

        const shortSize =
            PcbFootprintPadAxisNormalizer.#medianPadShortSize(pads)
        return gap > Math.max(shortSize * ROW_GAP_SHORT_SIZE_FACTOR, 0.001)
    }

    /**
     * Resolves the median short side for candidate pad rectangles.
     * @param {object[]} pads Candidate pads.
     * @returns {number}
     */
    static #medianPadShortSize(pads) {
        const values = pads
            .map((pad) => {
                const dimensions =
                    PcbFootprintPadAxisNormalizer.#padDimensions(pad)
                if (!dimensions) return null
                return Math.min(dimensions.width, dimensions.height)
            })
            .filter((value) => Number.isFinite(value))
            .sort((a, b) => a - b)
        if (!values.length) return 0

        return values[Math.floor(values.length / 2)]
    }

    /**
     * Returns true when a pad's long rectangle axis is parallel to its row.
     * @param {object} pad PCB pad.
     * @param {number} rowAngle Row line angle.
     * @returns {boolean}
     */
    static #isPadLongAxisParallelToRow(pad, rowAngle) {
        const dimensions = PcbFootprintPadAxisNormalizer.#padDimensions(pad)
        if (!dimensions) return false

        const longAxisAngle =
            Number(pad?.rotation || 0) +
            (dimensions.height > dimensions.width ? 90 : 0)
        const delta = PcbFootprintPadAxisNormalizer.#lineAngleDelta(
            longAxisAngle,
            rowAngle
        )

        return delta <= PARALLEL_TOLERANCE_DEG
    }

    /**
     * Applies resolved pad updates to all pad lists in a document.
     * @param {object} documentModel Document model.
     * @param {{ objects: Map<object, number>, signatures: Map<string, number> }} updates Rotation updates.
     * @returns {object}
     */
    static #applyPadUpdatesToDocument(documentModel, updates) {
        const pcb = documentModel?.pcb || {}
        const pads = Array.isArray(pcb.pads)
            ? PcbFootprintPadAxisNormalizer.#applyPadUpdates(pcb.pads, updates)
            : pcb.pads
        const kicadBoard =
            PcbFootprintPadAxisNormalizer.#applyKicadBoardPadUpdates(
                pcb,
                pads,
                updates
            )

        return {
            ...documentModel,
            pcb: {
                ...pcb,
                pads,
                kicadBoard
            }
        }
    }

    /**
     * Applies resolved pad updates to a KiCad board pad list.
     * @param {object} pcb PCB model.
     * @param {object[] | undefined} pads Updated top-level pad list.
     * @param {{ objects: Map<object, number>, signatures: Map<string, number> }} updates Rotation updates.
     * @returns {object | undefined}
     */
    static #applyKicadBoardPadUpdates(pcb, pads, updates) {
        const kicadBoard = pcb?.kicadBoard
        if (!kicadBoard || !Array.isArray(kicadBoard.pads)) {
            return kicadBoard
        }

        return {
            ...kicadBoard,
            pads:
                kicadBoard.pads === pcb.pads
                    ? pads
                    : PcbFootprintPadAxisNormalizer.#applyPadUpdates(
                          kicadBoard.pads,
                          updates
                      )
        }
    }

    /**
     * Applies resolved pad updates to one pad list.
     * @param {object[] | undefined} pads PCB pads.
     * @param {{ objects: Map<object, number>, signatures: Map<string, number> }} updates Rotation updates.
     * @returns {object[] | undefined}
     */
    static #applyPadUpdates(pads, updates) {
        if (!Array.isArray(pads)) return pads

        return pads.map((pad) => {
            const rotation =
                updates.objects.get(pad) ??
                updates.signatures.get(
                    PcbFootprintPadAxisNormalizer.#padSignature(pad)
                )
            if (rotation === undefined) return pad
            if (
                PcbFootprintPadAxisNormalizer.#anglesEqual(
                    rotation,
                    pad?.rotation
                )
            ) {
                return pad
            }

            return {
                ...pad,
                rotation
            }
        })
    }

    /**
     * Resolves a stable owner key for one pad.
     * @param {object} pad PCB pad.
     * @returns {string}
     */
    static #padOwnerKey(pad) {
        const componentIndex = PcbFootprintPadAxisNormalizer.#firstPresent([
            pad?.componentIndex,
            pad?.ownerIndex
        ])
        if (componentIndex !== null) return 'component:' + componentIndex

        const footprintId = PcbFootprintPadAxisNormalizer.#trimmedString(
            pad?.footprintId
        )
        if (footprintId) return 'footprint:' + footprintId

        const reference = PcbFootprintPadAxisNormalizer.#trimmedString(
            pad?.footprintReference ?? pad?.designator ?? pad?.ref
        )
        return reference ? 'reference:' + reference : ''
    }

    /**
     * Resolves a stable signature for matching cloned pad lists.
     * @param {object} pad PCB pad.
     * @returns {string}
     */
    static #padSignature(pad) {
        return [
            PcbFootprintPadAxisNormalizer.#padOwnerKey(pad),
            PcbFootprintPadAxisNormalizer.#trimmedString(
                pad?.number ?? pad?.name ?? pad?.id
            ),
            PcbFootprintPadAxisNormalizer.#signatureNumber(pad?.x),
            PcbFootprintPadAxisNormalizer.#signatureNumber(pad?.y),
            PcbFootprintPadAxisNormalizer.#signatureNumber(pad?.rotation)
        ].join('|')
    }

    /**
     * Resolves the first non-empty value.
     * @param {unknown[]} values Values to scan.
     * @returns {string | number | null}
     */
    static #firstPresent(values) {
        for (const value of values) {
            if (value === undefined || value === null || value === '') continue
            return value
        }

        return null
    }

    /**
     * Converts one value to a trimmed string.
     * @param {unknown} value Value to stringify.
     * @returns {string}
     */
    static #trimmedString(value) {
        return String(value ?? '').trim()
    }

    /**
     * Formats a number for a cloned-pad signature.
     * @param {unknown} value Numeric value.
     * @returns {string}
     */
    static #signatureNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number.toFixed(6) : ''
    }

    /**
     * Returns true when two rotations are equal after normalization.
     * @param {unknown} left First angle.
     * @param {unknown} right Second angle.
     * @returns {boolean}
     */
    static #anglesEqual(left, right) {
        return (
            Math.abs(
                PcbFootprintPadAxisNormalizer.#normalizeAngle(left) -
                    PcbFootprintPadAxisNormalizer.#normalizeAngle(right)
            ) < 0.001
        )
    }

    /**
     * Resolves the acute delta between two line angles.
     * @param {number} left First angle.
     * @param {number} right Second angle.
     * @returns {number}
     */
    static #lineAngleDelta(left, right) {
        const delta = Math.abs(
            PcbFootprintPadAxisNormalizer.#normalizeLineAngle(left) -
                PcbFootprintPadAxisNormalizer.#normalizeLineAngle(right)
        )
        return Math.min(delta, 180 - delta)
    }

    /**
     * Normalizes an angle into [0, 360).
     * @param {unknown} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const value = Number(angle) || 0
        return ((value % 360) + 360) % 360
    }

    /**
     * Normalizes an angle into [0, 180).
     * @param {unknown} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeLineAngle(angle) {
        return PcbFootprintPadAxisNormalizer.#normalizeAngle(angle) % 180
    }
}
