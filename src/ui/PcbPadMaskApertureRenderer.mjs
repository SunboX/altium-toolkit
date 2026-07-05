// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders pad-derived paste and solder-mask apertures as independent SVG layers.
 */
export class PcbPadMaskApertureRenderer {
    static #PAD_SHAPE_RECTANGULAR = 2
    static #SPECS = [
        {
            flag: 'hasTopPasteMaskOpening',
            kind: 'paste',
            primitiveKind: 'pad-paste',
            side: 'top',
            layerId: 35,
            layerName: 'Top Paste',
            expansionKey: 'effectivePasteMaskExpansion'
        },
        {
            flag: 'hasBottomPasteMaskOpening',
            kind: 'paste',
            primitiveKind: 'pad-paste',
            side: 'bottom',
            layerId: 36,
            layerName: 'Bottom Paste',
            expansionKey: 'effectivePasteMaskExpansion'
        },
        {
            flag: 'hasTopSolderMaskOpening',
            kind: 'solder-mask',
            primitiveKind: 'pad-solder-mask',
            side: 'top',
            layerId: 37,
            layerName: 'Top Solder',
            expansionKey: 'effectiveSolderMaskExpansion'
        },
        {
            flag: 'hasBottomSolderMaskOpening',
            kind: 'solder-mask',
            primitiveKind: 'pad-solder-mask',
            side: 'bottom',
            layerId: 38,
            layerName: 'Bottom Solder',
            expansionKey: 'effectiveSolderMaskExpansion'
        }
    ]

    /**
     * Builds one SVG group containing all derived pad mask apertures.
     * @param {object[]} pads Normalized pad records.
     * @param {{ attributes?: (aperture: object) => string, padIndex?: (pad: object, index: number) => number }} [options]
     * @returns {string}
     */
    static render(pads, options = {}) {
        const apertures = []

        for (const [fallbackIndex, pad] of (pads || []).entries()) {
            const padIndex = PcbPadMaskApertureRenderer.#padIndex(
                pad,
                fallbackIndex,
                options
            )
            for (const [specIndex, spec] of this.#SPECS.entries()) {
                if (!pad?.[spec.flag]) continue
                const aperture = this.#apertureForPad(
                    pad,
                    padIndex,
                    specIndex,
                    spec
                )
                if (!aperture) continue
                apertures.push(
                    this.#renderAperture(aperture, options.attributes)
                )
            }
        }

        if (!apertures.length) return ''

        return '<g class="pcb-pad-mask-layers">' + apertures.join('') + '</g>'
    }

    /**
     * Resolves one stable pad index.
     * @param {object} pad Pad record.
     * @param {number} fallbackIndex Array index.
     * @param {{ padIndex?: (pad: object, index: number) => number }} options
     * @returns {number}
     */
    static #padIndex(pad, fallbackIndex, options) {
        const resolved = options.padIndex?.(pad, fallbackIndex)
        return Number.isInteger(resolved) ? resolved : fallbackIndex
    }

    /**
     * Builds one normalized aperture descriptor for a pad/spec pair.
     * @param {object} pad Pad record.
     * @param {number} padIndex Stable pad index.
     * @param {number} specIndex Spec index.
     * @param {object} spec Aperture layer spec.
     * @returns {object | null}
     */
    static #apertureForPad(pad, padIndex, specIndex, spec) {
        const size = this.#sizeForPad(pad, spec)
        if (size.width <= 0 || size.height <= 0) return null

        return {
            pad,
            padIndex,
            index: padIndex * this.#SPECS.length + specIndex,
            spec,
            size,
            primitive: {
                ...pad,
                layerId: spec.layerId,
                layerCode: spec.layerId,
                legacyLayerId: spec.layerId,
                layerName: spec.layerName
            }
        }
    }

    /**
     * Resolves aperture dimensions after the parsed mask expansion.
     * @param {object} pad Pad record.
     * @param {object} spec Aperture layer spec.
     * @returns {{ width: number, height: number }}
     */
    static #sizeForPad(pad, spec) {
        const side = spec.side === 'bottom' ? 'Bottom' : 'Top'
        const width = Number(pad?.['size' + side + 'X'] || pad?.sizeMidX || 0)
        const height = Number(pad?.['size' + side + 'Y'] || pad?.sizeMidY || 0)
        const expansion = Number(pad?.[spec.expansionKey] || 0)

        return {
            width: Math.max(width + expansion * 2, 0),
            height: Math.max(height + expansion * 2, 0)
        }
    }

    /**
     * Renders one aperture shape.
     * @param {object} aperture Aperture descriptor.
     * @param {(aperture: object) => string | undefined} attributes Attribute callback.
     * @returns {string}
     */
    static #renderAperture(aperture, attributes) {
        const className =
            'pcb-detail-fill pcb-detail-fill--' +
            (aperture.spec.kind === 'solder-mask' ? 'mask' : 'paste') +
            ' pcb-pad-mask-aperture pcb-pad-mask-aperture--' +
            aperture.spec.kind
        const renderedAttributes = attributes?.(aperture) || ''

        return PcbPadMaskApertureRenderer.#isRoundAperture(aperture)
            ? PcbPadMaskApertureRenderer.#renderCircle(
                  aperture,
                  className,
                  renderedAttributes
              )
            : PcbPadMaskApertureRenderer.#renderRect(
                  aperture,
                  className,
                  renderedAttributes
              )
    }

    /**
     * Renders one circular aperture.
     * @param {object} aperture Aperture descriptor.
     * @param {string} className SVG class list.
     * @param {string} attributes SVG attributes.
     * @returns {string}
     */
    static #renderCircle(aperture, className, attributes) {
        const { pad, size } = aperture
        const radius = Math.max(size.width, size.height) / 2

        return (
            '<circle class="' +
            className +
            '" cx="' +
            SchematicSvgUtils.formatNumber(Number(pad.x || 0)) +
            '" cy="' +
            SchematicSvgUtils.formatNumber(Number(pad.y || 0)) +
            '" r="' +
            SchematicSvgUtils.formatNumber(radius) +
            '"' +
            attributes +
            ' />'
        )
    }

    /**
     * Renders one rectangular aperture.
     * @param {object} aperture Aperture descriptor.
     * @param {string} className SVG class list.
     * @param {string} attributes SVG attributes.
     * @returns {string}
     */
    static #renderRect(aperture, className, attributes) {
        const { pad, size } = aperture
        const x = Number(pad.x || 0) - size.width / 2
        const y = Number(pad.y || 0) - size.height / 2

        return (
            '<rect class="' +
            className +
            '" x="' +
            SchematicSvgUtils.formatNumber(x) +
            '" y="' +
            SchematicSvgUtils.formatNumber(y) +
            '" width="' +
            SchematicSvgUtils.formatNumber(size.width) +
            '" height="' +
            SchematicSvgUtils.formatNumber(size.height) +
            '" rx="' +
            SchematicSvgUtils.formatNumber(
                PcbPadMaskApertureRenderer.#cornerRadius(aperture)
            ) +
            '" transform="rotate(' +
            SchematicSvgUtils.formatNumber(Number(pad.rotation || 0)) +
            ' ' +
            SchematicSvgUtils.formatNumber(Number(pad.x || 0)) +
            ' ' +
            SchematicSvgUtils.formatNumber(Number(pad.y || 0)) +
            ')"' +
            attributes +
            ' />'
        )
    }

    /**
     * Returns true when one aperture should be rendered as a circle.
     * @param {object} aperture Aperture descriptor.
     * @returns {boolean}
     */
    static #isRoundAperture(aperture) {
        const shape = PcbPadMaskApertureRenderer.#shapeForAperture(aperture)
        return (
            shape !== PcbPadMaskApertureRenderer.#PAD_SHAPE_RECTANGULAR &&
            Math.abs(aperture.size.width - aperture.size.height) < 0.001
        )
    }

    /**
     * Resolves the side-specific pad shape code.
     * @param {object} aperture Aperture descriptor.
     * @returns {number}
     */
    static #shapeForAperture(aperture) {
        const side = aperture.spec.side === 'bottom' ? 'Bottom' : 'Top'
        if (
            side === 'Top' &&
            aperture.pad?.hasRoundedRect &&
            Number.isInteger(aperture.pad.roundedRectShapeTop)
        ) {
            return Number(aperture.pad.roundedRectShapeTop)
        }
        return Number(aperture.pad?.['shape' + side] || 0)
    }

    /**
     * Resolves rectangle corner radius for rounded pad shapes.
     * @param {object} aperture Aperture descriptor.
     * @returns {number}
     */
    static #cornerRadius(aperture) {
        if (
            aperture.spec.side === 'top' &&
            aperture.pad?.hasRoundedRect &&
            Number.isFinite(aperture.pad.cornerRadiusTop)
        ) {
            return (
                Math.min(aperture.size.width, aperture.size.height) *
                (Number(aperture.pad.cornerRadiusTop) / 100)
            )
        }
        if (PcbPadMaskApertureRenderer.#shapeForAperture(aperture) === 1) {
            return Math.min(aperture.size.width, aperture.size.height) / 2
        }

        return 0
    }
}
