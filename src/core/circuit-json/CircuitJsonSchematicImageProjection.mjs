// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { CircuitJsonModelAdapterPrimitives } from './CircuitJsonModelAdapterPrimitives.mjs'

const Primitives = CircuitJsonModelAdapterPrimitives

/**
 * Shares canonical schematic-image row, asset, and diagnostic identity.
 */
export class CircuitJsonSchematicImageProjection {
    /**
     * Builds one asset-backed canonical image row.
     * @param {Record<string, unknown>} image Native image placement.
     * @param {number} index Native image index.
     * @param {string} idScope Deterministic document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {Record<string, unknown> | null}
     */
    static element(image, index, idScope, ownerIds) {
        const bounds = CircuitJsonSchematicImageProjection.#bounds(image)
        if (!bounds) return null
        const sourcePath = String(image?.fileName || '').trim()
        const row = {
            type: 'schematic_image',
            schematic_image_id: Primitives.id(idScope, [
                'schematic_image',
                CircuitJsonSchematicImageProjection.#identity(image, index)
            ]),
            asset_id: CircuitJsonSchematicImageProjection.assetId(
                image,
                index,
                idScope
            ),
            center: bounds.center,
            size: bounds.size,
            rotation: -(Primitives.number(image?.rotation, 0) || 0),
            preserve_aspect_ratio: image?.keepAspect !== false,
            render_order: CircuitJsonSchematicImageProjection.#renderOrder(
                image,
                index
            ),
            ...(sourcePath ? { source_path: sourcePath } : {}),
            ...(sourcePath
                ? {
                      source_name:
                          CircuitJsonSchematicImageProjection.#baseName(
                              sourcePath
                          )
                  }
                : {})
        }
        const opacity = Primitives.number(image?.opacity, null)
        if (opacity !== null && opacity >= 0 && opacity <= 1) {
            row.opacity = opacity
        }
        const ownerId = ownerIds.get(String(image?.ownerIndex || ''))
        if (ownerId) row.schematic_component_id = ownerId
        return row
    }

    /**
     * Builds canonical raw asset candidates for every valid native image.
     * @param {Record<string, unknown>} model Native renderer model.
     * @returns {Record<string, unknown>[]}
     */
    static assets(model) {
        const sourceFormat = Primitives.sourceFormat(model)
        const idScope = Primitives.idScope(model, sourceFormat)
        return Primitives.array(model?.schematic?.images).flatMap(
            (image, index) => {
                if (!CircuitJsonSchematicImageProjection.#bounds(image)) {
                    return []
                }
                const sourcePath = String(image?.fileName || '').trim()
                const name =
                    CircuitJsonSchematicImageProjection.#baseName(sourcePath) ||
                    `schematic-image-${index + 1}`
                return [
                    {
                        id: CircuitJsonSchematicImageProjection.assetId(
                            image,
                            index,
                            idScope
                        ),
                        kind: 'schematic-image',
                        name,
                        mediaType:
                            CircuitJsonSchematicImageProjection.#mediaType(
                                image,
                                sourcePath
                            ),
                        data: CircuitJsonSchematicImageProjection.#payload(
                            image?.dataBase64
                        ),
                        source: {
                            format: 'altium',
                            path: sourcePath,
                            embedded: image?.embedded === true,
                            state: String(image?.diagnosticState || '')
                        }
                    }
                ]
            }
        )
    }

    /**
     * Builds diagnostics for image placements that cannot render exactly.
     * @param {Record<string, unknown>} model Native renderer model.
     * @returns {Record<string, unknown>[]}
     */
    static diagnostics(model) {
        return Primitives.array(model?.schematic?.images).flatMap(
            (image, index) => {
                const sourcePath = String(image?.fileName || '').trim()
                if (!CircuitJsonSchematicImageProjection.#bounds(image)) {
                    return [
                        {
                            severity: 'warning',
                            code: 'altium.schematic.image.geometry-invalid',
                            message:
                                'Schematic image geometry is empty or invalid for ' +
                                (sourcePath || `image ${index + 1}`) +
                                '.'
                        }
                    ]
                }
                if (
                    CircuitJsonSchematicImageProjection.#payload(
                        image?.dataBase64
                    )
                ) {
                    return []
                }
                return [
                    {
                        severity: 'warning',
                        code: 'altium.schematic.image.asset-unresolved',
                        message:
                            'Schematic image asset could not be resolved for ' +
                            (sourcePath || `image ${index + 1}`) +
                            '.'
                    }
                ]
            }
        )
    }

    /**
     * Returns the exact canonical asset id for one image.
     * @param {Record<string, unknown>} image Native image placement.
     * @param {number} index Native image index.
     * @param {string} idScope Deterministic document id scope.
     * @returns {string}
     */
    static assetId(image, index, idScope) {
        return Primitives.id(idScope, [
            'asset',
            'schematic_image',
            CircuitJsonSchematicImageProjection.#identity(image, index)
        ])
    }

    /**
     * Resolves canonical center and positive size.
     * @param {Record<string, unknown>} image Native image placement.
     * @returns {{ center: { x: number, y: number }, size: { width: number, height: number } } | null}
     */
    static #bounds(image) {
        const x = Primitives.number(image?.x, null)
        const y = Primitives.number(image?.y, null)
        const cornerX = Primitives.number(image?.cornerX, null)
        const cornerY = Primitives.number(image?.cornerY, null)
        if (x === null || y === null || cornerX === null || cornerY === null) {
            return null
        }
        const width = Math.abs(cornerX - x)
        const height = Math.abs(cornerY - y)
        if (!(width > 0 && height > 0)) return null
        return {
            center: Primitives.point((x + cornerX) / 2, (y + cornerY) / 2),
            size: {
                width: Primitives.round(width),
                height: Primitives.round(height)
            }
        }
    }

    /**
     * Builds a stable identity that distinguishes repeated source names.
     * @param {Record<string, unknown>} image Native image placement.
     * @param {number} index Native image index.
     * @returns {unknown[]}
     */
    static #identity(image, index) {
        return [
            image?.uniqueId || image?.recordId || image?.fileName || 'image',
            CircuitJsonSchematicImageProjection.#renderOrder(image, index),
            index
        ]
    }

    /**
     * Resolves a safe authored image order.
     * @param {Record<string, unknown>} image Native image placement.
     * @param {number} fallback Fallback order.
     * @returns {number}
     */
    static #renderOrder(image, fallback) {
        const order = Primitives.number(image?.renderOrder, fallback)
        return Number.isSafeInteger(order) ? order : fallback
    }

    /**
     * Extracts a source basename from slash variants.
     * @param {string} path Source path.
     * @returns {string}
     */
    static #baseName(path) {
        return (
            String(path || '')
                .replaceAll('\\', '/')
                .split('/')
                .filter(Boolean)
                .at(-1) || ''
        )
    }

    /**
     * Resolves a usable image media type.
     * @param {Record<string, unknown>} image Native image placement.
     * @param {string} sourcePath Source path.
     * @returns {string}
     */
    static #mediaType(image, sourcePath) {
        const explicit = String(image?.mimeType || '')
            .trim()
            .toLowerCase()
        if (explicit) return explicit
        const suffix = sourcePath.toLowerCase().split('.').at(-1)
        return (
            {
                bmp: 'image/bmp',
                gif: 'image/gif',
                jpeg: 'image/jpeg',
                jpg: 'image/jpeg',
                png: 'image/png',
                webp: 'image/webp'
            }[suffix] || 'application/octet-stream'
        )
    }

    /**
     * Decodes one exact base64 payload without Node-only dependencies.
     * @param {unknown} value Base64 payload.
     * @returns {Uint8Array | null}
     */
    static #payload(value) {
        const encoded = String(value || '').replace(/\s+/gu, '')
        if (!encoded) return null
        try {
            const binary = atob(encoded)
            const bytes = new Uint8Array(binary.length)
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index)
            }
            return bytes
        } catch {
            return null
        }
    }
}

Object.freeze(CircuitJsonSchematicImageProjection.prototype)
Object.freeze(CircuitJsonSchematicImageProjection)
