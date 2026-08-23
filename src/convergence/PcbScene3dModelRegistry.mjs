// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dModelRegistry as HistoricalPcbScene3dModelRegistry } from '../ui/PcbScene3dModelRegistry.mjs'

const MILS_PER_METER = 39370.07874015748
const MILS_PER_INCH = 1000

/**
 * Adds signed STEP source bounds to the preserved native model registry.
 */
export class PcbScene3dModelRegistry {
    #registry

    /**
     * Creates one converged registry around either a preserved native registry
     * or the native constructor's normalized model rows.
     * @param {HistoricalPcbScene3dModelRegistry | object[]} registryOrModelFiles Native registry or normalized session models.
     * @param {object[]} embeddedModels Normalized embedded models.
     */
    constructor(registryOrModelFiles, embeddedModels) {
        this.#registry =
            registryOrModelFiles instanceof HistoricalPcbScene3dModelRegistry
                ? registryOrModelFiles
                : new HistoricalPcbScene3dModelRegistry(
                      registryOrModelFiles,
                      embeddedModels
                  )
    }

    /**
     * Creates one model registry from session and embedded model assets.
     * @param {{ name?: string, relativePath?: string, source?: string }[]} sessionFiles Session model files.
     * @param {{ id?: string, checksum?: number | null, name?: string, format?: string, payloadText?: string, sourceStream?: string, transform?: object }[]} [embeddedModels] Embedded model payloads.
     * @returns {PcbScene3dModelRegistry}
     */
    static create(sessionFiles, embeddedModels = []) {
        return new PcbScene3dModelRegistry(
            HistoricalPcbScene3dModelRegistry.create(
                sessionFiles,
                embeddedModels
            )
        )
    }

    /**
     * Resolves the best available model for one component.
     * @param {{ pattern?: string, source?: string, modelPath?: string }} component Component metadata.
     * @returns {object | null}
     */
    resolveComponentModel(component) {
        return this.#registry.resolveComponentModel(component)
    }

    /**
     * Resolves a component-body model and exposes its signed STEP bounds.
     * @param {{ modelId?: string, checksum?: number | null, name?: string }} componentBody Component-body metadata.
     * @returns {object | null}
     */
    resolveComponentBodyModel(componentBody) {
        const model = this.#registry.resolveComponentBodyModel(componentBody)
        const sourceBoundsMil =
            PcbScene3dModelRegistry.#resolveSourceBoundsMil(model)

        return sourceBoundsMil ? { ...model, sourceBoundsMil } : model
    }

    /**
     * Resolves a project-level full-board assembly model.
     * @param {{ fileName?: string }} documentModel Document metadata.
     * @returns {object | null}
     */
    resolveBoardAssemblyModel(documentModel) {
        return this.#registry.resolveBoardAssemblyModel(documentModel)
    }

    /**
     * Resolves signed bounds for one inline STEP model.
     * @param {{ format?: string, payloadText?: string } | null} model Resolved model.
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number } | null}
     */
    static #resolveSourceBoundsMil(model) {
        const format = String(model?.format || '').toLowerCase()
        if ((format !== 'step' && format !== 'stp') || !model?.payloadText) {
            return null
        }

        const text = String(model.payloadText)
        const points = []
        const pointPattern =
            /CARTESIAN_POINT\s*\(\s*(?:'[^']*'|[^,]*),\s*\(([^)]*)\)\s*\)/giu
        let match = pointPattern.exec(text)

        while (match) {
            const coordinates = String(match[1] || '')
                .split(',')
                .slice(0, 3)
                .map((value) => Number(value.trim()))
            if (
                coordinates.length === 3 &&
                coordinates.every((value) => Number.isFinite(value))
            ) {
                points.push(coordinates)
            }
            match = pointPattern.exec(text)
        }

        if (points.length < 2) {
            return null
        }

        const [firstPoint] = points
        const bounds = {
            minX: firstPoint[0],
            maxX: firstPoint[0],
            minY: firstPoint[1],
            maxY: firstPoint[1],
            minZ: firstPoint[2],
            maxZ: firstPoint[2]
        }
        points.slice(1).forEach(([x, y, z]) => {
            bounds.minX = Math.min(bounds.minX, x)
            bounds.maxX = Math.max(bounds.maxX, x)
            bounds.minY = Math.min(bounds.minY, y)
            bounds.maxY = Math.max(bounds.maxY, y)
            bounds.minZ = Math.min(bounds.minZ, z)
            bounds.maxZ = Math.max(bounds.maxZ, z)
        })

        const scale = PcbScene3dModelRegistry.#resolveStepMilScale(text)
        return Object.fromEntries(
            Object.entries(bounds).map(([key, value]) => [key, value * scale])
        )
    }

    /**
     * Resolves the STEP length-unit scale to mils.
     * @param {string} payloadText STEP text payload.
     * @returns {number}
     */
    static #resolveStepMilScale(payloadText) {
        const text = String(payloadText || '').toUpperCase()
        if (/\bINCH\b|\.INCH\./u.test(text)) {
            return MILS_PER_INCH
        }

        const siUnitMatch = text.match(
            /SI_UNIT\s*\(\s*(\.[A-Z]+\.|\$)\s*,\s*\.METRE\.\s*\)/u
        )
        return (
            PcbScene3dModelRegistry.#resolveSiPrefixScale(siUnitMatch?.[1]) *
            MILS_PER_METER
        )
    }

    /**
     * Resolves one STEP SI length prefix to a meter multiplier.
     * @param {string | undefined} prefix STEP SI prefix.
     * @returns {number}
     */
    static #resolveSiPrefixScale(prefix) {
        const scales = {
            '.EXA.': 1e18,
            '.PETA.': 1e15,
            '.TERA.': 1e12,
            '.GIGA.': 1e9,
            '.MEGA.': 1e6,
            '.KILO.': 1e3,
            '.HECTO.': 1e2,
            '.DECA.': 1e1,
            $: 1,
            '.DECI.': 1e-1,
            '.CENTI.': 1e-2,
            '.MILLI.': 1e-3,
            '.MICRO.': 1e-6,
            '.NANO.': 1e-9,
            '.PICO.': 1e-12,
            '.FEMTO.': 1e-15,
            '.ATTO.': 1e-18
        }

        return scales[prefix || '.MILLI.'] ?? 1e-3
    }
}
