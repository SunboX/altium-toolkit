// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { OleCompoundDocumentWriter } from '../ole/OleCompoundDocumentWriter.mjs'
import { AltiumLibraryRecordBuilder } from './AltiumLibraryRecordBuilder.mjs'
import { SourceComponentBundleNormalizer } from './SourceComponentBundleNormalizer.mjs'

/**
 * Exports normalized bundles into a compact OLE-backed footprint library.
 */
export class AltiumPcbLibExporter {
    /**
     * Exports one or more component bundles as `.PcbLib` bytes.
     * @param {object[] | object} bundles Component bundles.
     * @returns {Uint8Array}
     */
    static export(bundles) {
        const normalizedBundles =
            AltiumPcbLibExporter.#normalizeBundles(bundles)
        const streams = new Map()
        const modelRows = AltiumPcbLibExporter.#collectModels(normalizedBundles)

        streams.set(
            'Library/Data',
            AltiumLibraryRecordBuilder.buildPcbLibraryData(normalizedBundles)
        )
        streams.set(
            'Library/ComponentParamsTOC/Data',
            AltiumLibraryRecordBuilder.buildComponentParamsToc(
                normalizedBundles
            )
        )
        streams.set(
            'SectionKeys',
            AltiumLibraryRecordBuilder.buildSectionKeys(normalizedBundles)
        )

        for (const bundle of normalizedBundles) {
            const storageName = AltiumLibraryRecordBuilder.sanitizeStorageName(
                bundle.footprint.name
            )
            streams.set(
                storageName + '/Header',
                AltiumLibraryRecordBuilder.createCountHeader(0)
            )
            streams.set(
                storageName + '/Parameters',
                AltiumLibraryRecordBuilder.buildFootprintParameters(bundle)
            )
            streams.set(
                storageName + '/Data',
                AltiumLibraryRecordBuilder.buildFootprintData(bundle)
            )
            streams.set(
                storageName + '/SourceRecord',
                new TextEncoder().encode(
                    AltiumLibraryRecordBuilder.buildPcbFootprintRecord(bundle)
                )
            )
        }

        if (modelRows.length) {
            streams.set(
                'Models/Data',
                AltiumLibraryRecordBuilder.buildModelsData(modelRows)
            )
            modelRows.forEach((row, index) => {
                streams.set('Models/' + index, row.model.bytes)
            })
        }

        return OleCompoundDocumentWriter.write({ streams })
    }

    /**
     * Collects model rows with deterministic generated ids.
     * @param {object[]} bundles Normalized bundles.
     * @returns {{ model: object, id: string, checksum: number }[]}
     */
    static #collectModels(bundles) {
        return bundles.flatMap((bundle, bundleIndex) =>
            bundle.models.map((model, modelIndex) => ({
                model,
                id: 'model-' + bundleIndex + '-' + modelIndex,
                checksum: AltiumLibraryRecordBuilder.checksumBytes(model.bytes)
            }))
        )
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
