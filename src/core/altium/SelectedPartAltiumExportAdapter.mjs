// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumPcbLibExporter } from './AltiumPcbLibExporter.mjs'
import { AltiumSchLibExporter } from './AltiumSchLibExporter.mjs'
import { SourceBundleExporter } from './SourceBundleExporter.mjs'

/**
 * Builds Altium library exports from normalized selected-part data.
 */
export class SelectedPartAltiumExportAdapter {
    /**
     * Exports one selected-part bundle to Altium library entries.
     * @param {object} selectedPart Selected part data.
     * @param {{ models?: object[], partName?: string, libraryBasePath?: string, sourceBasePath?: string }} [options] Export options.
     * @returns {{ bundle: object, entries: { path: string, bytes: Uint8Array, contentType: string }[] }}
     */
    static export(selectedPart, options = {}) {
        const partName = SelectedPartAltiumExportAdapter.#safeFileName(
            options.partName ||
                selectedPart?.footprint?.name ||
                selectedPart?.symbol?.name ||
                selectedPart?.designator ||
                'selected-part'
        )
        const bundle = SelectedPartAltiumExportAdapter.buildBundle(
            selectedPart,
            options.models,
            partName
        )
        const libraryBasePath = SelectedPartAltiumExportAdapter.#basePath(
            options.libraryBasePath,
            'altium'
        )
        const sourceBasePath = SelectedPartAltiumExportAdapter.#basePath(
            options.sourceBasePath,
            'source'
        )
        const sourceEntries = SourceBundleExporter.export(bundle, {
            includeModels: true
        }).entries.map((entry) => ({
            ...entry,
            path:
                entry.path === 'manifest.json'
                    ? SelectedPartAltiumExportAdapter.#joinPath(
                          sourceBasePath,
                          'manifest.json'
                      )
                    : entry.path
        }))

        return {
            bundle,
            entries: [
                {
                    path: SelectedPartAltiumExportAdapter.#joinPath(
                        libraryBasePath,
                        partName + '.SchLib'
                    ),
                    bytes: AltiumSchLibExporter.export([bundle]),
                    contentType: 'application/octet-stream'
                },
                {
                    path: SelectedPartAltiumExportAdapter.#joinPath(
                        libraryBasePath,
                        partName + '.PcbLib'
                    ),
                    bytes: AltiumPcbLibExporter.export([bundle]),
                    contentType: 'application/octet-stream'
                },
                ...sourceEntries
            ]
        }
    }

    /**
     * Builds a source-compatible component bundle from selected-part data.
     * @param {object} selectedPart Selected part data.
     * @param {object[]} [models] Packaged 3D model assets.
     * @param {string} [partName] Export artifact name.
     * @returns {object}
     */
    static buildBundle(selectedPart, models = [], partName = '') {
        const bundleName =
            partName || selectedPart?.designator || 'Selected part'

        return {
            id: selectedPart?.designator || 'selected-part',
            name: bundleName,
            metadata: {
                name: bundleName,
                partNumber: selectedPart?.symbol?.value || ''
            },
            symbol: {
                name:
                    selectedPart?.symbol?.name ||
                    selectedPart?.designator ||
                    'Selected part',
                pins: selectedPart?.symbol?.pins || [],
                primitives: SelectedPartAltiumExportAdapter.#symbolPrimitives(
                    selectedPart?.symbol
                ),
                raw: selectedPart?.symbol?.raw || {}
            },
            footprint: {
                name:
                    selectedPart?.footprint?.name ||
                    selectedPart?.designator ||
                    'Selected part',
                component: selectedPart?.footprint?.component || {},
                pads: selectedPart?.footprint?.pads || [],
                tracks: selectedPart?.footprint?.tracks || [],
                arcs: selectedPart?.footprint?.arcs || [],
                fills: selectedPart?.footprint?.fills || [],
                texts: selectedPart?.footprint?.texts || [],
                primitives: [],
                raw: selectedPart?.footprint?.raw || {}
            },
            models: SelectedPartAltiumExportAdapter.#array(models),
            sourceJson: {
                selectedPart
            }
        }
    }

    /**
     * Builds Altium schematic primitive rows from the selected symbol.
     * @param {object} symbol Selected symbol.
     * @returns {object[]}
     */
    static #symbolPrimitives(symbol = {}) {
        return [
            ...SelectedPartAltiumExportAdapter.#typedPrimitives(
                symbol?.rectangles,
                'rectangle'
            ),
            ...SelectedPartAltiumExportAdapter.#typedPrimitives(
                symbol?.lines,
                'line'
            ),
            ...SelectedPartAltiumExportAdapter.#typedPrimitives(
                symbol?.arcs,
                'arc'
            ),
            ...SelectedPartAltiumExportAdapter.#typedPrimitives(
                symbol?.ellipses,
                'ellipse'
            ),
            ...SelectedPartAltiumExportAdapter.#typedPrimitives(
                symbol?.polygons,
                'polygon'
            )
        ]
    }

    /**
     * Adds a primitive type to each entry.
     * @param {unknown} primitives Primitive candidates.
     * @param {string} type Primitive type.
     * @returns {object[]}
     */
    static #typedPrimitives(primitives, type) {
        return SelectedPartAltiumExportAdapter.#array(primitives).map(
            (primitive) => ({
                type,
                ...primitive
            })
        )
    }

    /**
     * Normalizes an export base path.
     * @param {unknown} value Candidate path.
     * @param {string} fallback Fallback path.
     * @returns {string}
     */
    static #basePath(value, fallback) {
        return String(value || fallback)
            .replace(/^\/+/u, '')
            .replace(/\/+$/u, '')
    }

    /**
     * Joins one base path and file path.
     * @param {string} basePath Base path.
     * @param {string} filePath File path.
     * @returns {string}
     */
    static #joinPath(basePath, filePath) {
        const cleanFilePath = String(filePath || '').replace(/^\/+/u, '')
        return basePath ? basePath + '/' + cleanFilePath : cleanFilePath
    }

    /**
     * Normalizes a possible array.
     * @param {unknown} value Candidate array.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Creates a safe file name.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #safeFileName(value) {
        return String(value || 'selected-part').replace(
            /[\\/:\u0000-\u001f]/gu,
            '_'
        )
    }
}
