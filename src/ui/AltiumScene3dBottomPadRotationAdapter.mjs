const BOTTOM_LAYER_ID = 32

/**
 * Pre-compensates Altium bottom-side pad rotations for shared 3D mirroring.
 */
export class AltiumScene3dBottomPadRotationAdapter {
    /**
     * Returns a scene with bottom-side pad rotations mirrored for rendering.
     * @param {object} sceneDescription Scene description.
     * @returns {object}
     */
    static apply(sceneDescription) {
        const detail = sceneDescription?.detail || {}
        const detailPads = Array.isArray(detail.pads)
            ? AltiumScene3dBottomPadRotationAdapter.#mapPads(detail.pads)
            : detail.pads
        const scenePads = Array.isArray(sceneDescription?.pads)
            ? sceneDescription.pads === detail.pads
                ? detailPads
                : AltiumScene3dBottomPadRotationAdapter.#mapPads(
                      sceneDescription.pads
                  )
            : sceneDescription?.pads

        if (
            detailPads === detail.pads &&
            scenePads === sceneDescription?.pads
        ) {
            return sceneDescription
        }

        return {
            ...sceneDescription,
            pads: scenePads,
            detail: {
                ...detail,
                pads: detailPads
            }
        }
    }

    /**
     * Maps bottom-side pad rotations in one pad list.
     * @param {object[]} pads Scene pad list.
     * @returns {object[]}
     */
    static #mapPads(pads) {
        let changed = false
        const mappedPads = pads.map((pad) => {
            if (!AltiumScene3dBottomPadRotationAdapter.#isBottomPad(pad)) {
                return pad
            }

            const rotation =
                AltiumScene3dBottomPadRotationAdapter.#normalizeAngle(
                    -Number(pad?.rotation || 0)
                )
            if (
                AltiumScene3dBottomPadRotationAdapter.#anglesEqual(
                    rotation,
                    pad?.rotation
                )
            ) {
                return pad
            }

            changed = true
            return {
                ...pad,
                rotation
            }
        })

        return changed ? mappedPads : pads
    }

    /**
     * Returns true when one pad belongs to bottom copper.
     * @param {object} pad Scene pad.
     * @returns {boolean}
     */
    static #isBottomPad(pad) {
        const layerId = Number(
            pad?.layerId ?? pad?.layerCode ?? pad?.sourceLayerId
        )
        if (Number.isFinite(layerId) && layerId === BOTTOM_LAYER_ID) {
            return true
        }

        const layerName = String(pad?.layer || pad?.layerName || '')
            .trim()
            .toUpperCase()
        if (layerName === 'B.CU' || layerName.includes('BOTTOM')) {
            return true
        }

        const sideName = String(pad?.side || pad?.mountSide || '')
            .trim()
            .toLowerCase()
        return sideName === 'bottom' || sideName === 'back'
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
                AltiumScene3dBottomPadRotationAdapter.#normalizeAngle(left) -
                    AltiumScene3dBottomPadRotationAdapter.#normalizeAngle(right)
            ) < 0.001
        )
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
}
