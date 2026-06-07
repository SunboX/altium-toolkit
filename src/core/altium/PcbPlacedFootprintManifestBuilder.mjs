// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds read-only extraction manifests for placed PCB footprints.
 */
export class PcbPlacedFootprintManifestBuilder {
    static SCHEMA = 'altium-toolkit.pcb.placed-footprint-extraction.a1'

    /**
     * Builds a placed-footprint extraction manifest.
     * @param {{ fileName?: string, components?: object[], componentPrimitiveGroups?: object[], embeddedModels?: object[] }} context Manifest context.
     * @returns {object}
     */
    static build(context = {}) {
        const outputs = (context.componentPrimitiveGroups || []).map(
            (group, index) =>
                PcbPlacedFootprintManifestBuilder.#output(context, group, index)
        )
        const embeddedAssetCount = outputs.reduce(
            (total, output) => total + output.embeddedAssets.length,
            0
        )

        return {
            schema: PcbPlacedFootprintManifestBuilder.SCHEMA,
            sourceDocument: String(context.fileName || ''),
            summary: {
                componentCount: (context.components || []).length,
                extractableFootprintCount: outputs.length,
                embeddedAssetCount
            },
            outputs,
            indexes: PcbPlacedFootprintManifestBuilder.#indexes(outputs)
        }
    }

    /**
     * Builds one placed-footprint output descriptor.
     * @param {object} context Manifest context.
     * @param {object} group Component primitive group.
     * @param {number} index Group index.
     * @returns {object}
     */
    static #output(context, group, index) {
        const component =
            (context.components || []).find(
                (candidate) =>
                    Number(candidate.componentIndex) ===
                    Number(group.componentIndex)
            ) || {}
        const designator = group.designator || component.designator || ''
        const pattern = component.pattern || ''
        const footprintKey =
            'footprint-extract-' +
            index +
            '-' +
            PcbPlacedFootprintManifestBuilder.#slug(
                [designator, pattern].filter(Boolean).join('-') || index
            )

        return {
            kind: 'placed-footprint',
            footprintKey,
            designator,
            pattern,
            componentIndex: Number(group.componentIndex),
            outputLibraryKey: 'pcb-extract/' + footprintKey + '.PcbLib',
            renderManifestKey: 'pcb-extract/' + footprintKey + '.render.json',
            primitiveCounts:
                PcbPlacedFootprintManifestBuilder.#primitiveCounts(group),
            layers: PcbPlacedFootprintManifestBuilder.#layers(group),
            embeddedAssets: PcbPlacedFootprintManifestBuilder.#embeddedAssets(
                group,
                context.embeddedModels || []
            ),
            diagnostics: PcbPlacedFootprintManifestBuilder.#diagnostics(group)
        }
    }

    /**
     * Counts footprint-owned primitive families.
     * @param {object} group Component primitive group.
     * @returns {object}
     */
    static #primitiveCounts(group) {
        return {
            pads: (group.pads || []).length,
            tracks: (group.tracks || []).length,
            arcs: (group.arcs || []).length,
            fills: (group.fills || []).length,
            vias: (group.vias || []).length,
            regions: (group.regions || []).length,
            shapeBasedRegions: (group.shapeBasedRegions || []).length,
            texts: (group.texts || []).length,
            componentBodies: (group.componentBodies || []).length
        }
    }

    /**
     * Builds layer descriptors touched by one footprint.
     * @param {object} group Component primitive group.
     * @returns {object[]}
     */
    static #layers(group) {
        const layerMap = new Map()
        for (const primitive of PcbPlacedFootprintManifestBuilder.#primitives(
            group
        )) {
            const layer =
                PcbPlacedFootprintManifestBuilder.#layerDescriptor(primitive)
            if (layer) {
                layerMap.set(layer.layerKey, layer)
            }
        }
        return [...layerMap.values()].sort((left, right) =>
            left.layerKey.localeCompare(right.layerKey, undefined, {
                numeric: true
            })
        )
    }

    /**
     * Collects embedded assets referenced by component bodies.
     * @param {object} group Component primitive group.
     * @param {object[]} embeddedModels Embedded model rows.
     * @returns {object[]}
     */
    static #embeddedAssets(group, embeddedModels) {
        return PcbPlacedFootprintManifestBuilder.#dedupe(
            (group.componentBodies || []).flatMap((body) => {
                const model =
                    PcbPlacedFootprintManifestBuilder.#matchingModel(
                        body,
                        embeddedModels
                    ) || body
                return [
                    PcbPlacedFootprintManifestBuilder.#stripUndefined({
                        key: model.id || body.modelId || model.name,
                        format: model.format,
                        sourceStream: model.sourceStream,
                        name: model.name || body.name
                    })
                ]
            })
        )
    }

    /**
     * Builds extraction diagnostics for one group.
     * @param {object} group Component primitive group.
     * @returns {object[]}
     */
    static #diagnostics(group) {
        const diagnostics = []
        if (!PcbPlacedFootprintManifestBuilder.#hasOwnedGeometry(group)) {
            diagnostics.push({
                code: 'pcb-footprint-extract.empty-geometry',
                severity: 'warning',
                message: 'Placed component has no owned footprint geometry.'
            })
        }
        return diagnostics
    }

    /**
     * Builds manifest lookup indexes.
     * @param {object[]} outputs Output descriptors.
     * @returns {object}
     */
    static #indexes(outputs) {
        const outputsByDesignator = {}
        const outputsByPattern = {}

        outputs.forEach((output, index) => {
            if (output.designator)
                outputsByDesignator[output.designator] = index
            if (output.pattern) {
                outputsByPattern[output.pattern] =
                    outputsByPattern[output.pattern] || []
                outputsByPattern[output.pattern].push(index)
            }
        })

        return {
            outputsByDesignator,
            outputsByPattern
        }
    }

    /**
     * Returns all geometry primitives from a group.
     * @param {object} group Component primitive group.
     * @returns {object[]}
     */
    static #primitives(group) {
        return [
            ...(group.pads || []),
            ...(group.tracks || []),
            ...(group.arcs || []),
            ...(group.fills || []),
            ...(group.vias || []),
            ...(group.regions || []),
            ...(group.shapeBasedRegions || []),
            ...(group.texts || [])
        ]
    }

    /**
     * Returns true when a component has any extractable geometry.
     * @param {object} group Component primitive group.
     * @returns {boolean}
     */
    static #hasOwnedGeometry(group) {
        return (
            PcbPlacedFootprintManifestBuilder.#primitives(group).length > 0 ||
            (group.componentBodies || []).length > 0
        )
    }

    /**
     * Builds a normalized layer descriptor.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #layerDescriptor(primitive) {
        const layerId = Number.isInteger(primitive?.layerId)
            ? primitive.layerId
            : null
        const displayName = String(
            primitive?.layerName || primitive?.layer || ''
        ).trim()
        if (layerId === null && !displayName) {
            return null
        }
        const layerKey =
            layerId === null
                ? 'layer-' +
                  PcbPlacedFootprintManifestBuilder.#slug(displayName)
                : 'L' + layerId

        return PcbPlacedFootprintManifestBuilder.#stripUndefined({
            layerKey,
            layerId: layerId === null ? undefined : layerId,
            displayName: displayName || layerKey
        })
    }

    /**
     * Resolves an embedded model row for one component body.
     * @param {object} body Component body row.
     * @param {object[]} embeddedModels Embedded model rows.
     * @returns {object | null}
     */
    static #matchingModel(body, embeddedModels) {
        return (
            (embeddedModels || []).find(
                (model) =>
                    PcbPlacedFootprintManifestBuilder.#same(
                        model.id,
                        body.modelId
                    ) ||
                    PcbPlacedFootprintManifestBuilder.#same(
                        model.checksum,
                        body.checksum
                    ) ||
                    PcbPlacedFootprintManifestBuilder.#same(
                        model.name,
                        body.name
                    )
            ) || null
        )
    }

    /**
     * Compares two non-empty values.
     * @param {unknown} left First value.
     * @param {unknown} right Second value.
     * @returns {boolean}
     */
    static #same(left, right) {
        return (
            left !== null &&
            left !== undefined &&
            left !== '' &&
            right !== null &&
            right !== undefined &&
            right !== '' &&
            String(left) === String(right)
        )
    }

    /**
     * Deduplicates objects by their JSON form.
     * @param {object[]} rows Candidate rows.
     * @returns {object[]}
     */
    static #dedupe(rows) {
        const seen = new Set()
        const deduped = []
        for (const row of rows || []) {
            const key = JSON.stringify(row)
            if (seen.has(key)) continue
            seen.add(key)
            deduped.push(row)
        }
        return deduped
    }

    /**
     * Converts a value to a deterministic lowercase key segment.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #slug(value) {
        return (
            String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '') || 'item'
        )
    }

    /**
     * Removes undefined fields from one object.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }
}
