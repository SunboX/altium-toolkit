// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { OleCompoundDocumentWriter } from '../ole/OleCompoundDocumentWriter.mjs'
import { AltiumLibraryRecordBuilder } from './AltiumLibraryRecordBuilder.mjs'
import { SourceComponentBundleNormalizer } from './SourceComponentBundleNormalizer.mjs'

/**
 * Exports normalized bundles into a compact OLE-backed schematic library.
 */
export class AltiumSchLibExporter {
    /**
     * Exports one or more component bundles as `.SchLib` bytes.
     * @param {object[] | object} bundles Component bundles.
     * @returns {Uint8Array}
     */
    static export(bundles) {
        const normalizedBundles =
            AltiumSchLibExporter.#normalizeBundles(bundles)
        const streams = new Map()
        const libraryRecord = normalizedBundles
            .map((bundle) =>
                AltiumLibraryRecordBuilder.buildSchematicComponentRecord(bundle)
            )
            .join('\n')

        streams.set('Library/Data', new TextEncoder().encode(libraryRecord))
        for (const bundle of normalizedBundles) {
            streams.set(
                'Components/' +
                    AltiumLibraryRecordBuilder.sanitizeStorageName(
                        bundle.symbol.name
                    ) +
                    '/Data',
                new TextEncoder().encode(
                    AltiumLibraryRecordBuilder.buildSchematicComponentRecord(
                        bundle
                    )
                )
            )
        }

        return OleCompoundDocumentWriter.write({ streams })
    }

    /**
     * Normalizes one or more bundles.
     * @param {object[] | object} bundles Bundle input.
     * @returns {object[]}
     */
    static #normalizeBundles(bundles) {
        return (Array.isArray(bundles) ? bundles : [bundles]).map((bundle) =>
            SourceComponentBundleNormalizer.normalize(bundle)
        )
    }
}
