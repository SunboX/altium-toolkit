// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { DocumentResult, ToolkitAsset } from 'circuitjson-toolkit/parser'

import { AltiumParser } from '../core/altium/AltiumParser.mjs'
import { CircuitJsonModelAdapter } from '../core/circuit-json/CircuitJsonModelAdapter.mjs'
import { CircuitJsonSchematicImageProjection } from '../core/circuit-json/CircuitJsonSchematicImageProjection.mjs'
import { AltiumCircuitJsonProjection } from './AltiumCircuitJsonProjection.mjs'
import { AltiumSchematicImageNormalizer } from './AltiumSchematicImageNormalizer.mjs'
import { ParserInput } from './ParserInput.mjs'

/**
 * Converts one native parse into a canonical CircuitJSON document envelope.
 */
export class AltiumDocumentBuilder {
    /**
     * Runs the native parser and CircuitJSON adapter exactly once.
     * @param {{ input: { fileName: string, data: string | ArrayBuffer | Uint8Array } }} normalized Normalized request.
     * @returns {{ native: Record<string, any>, model: object[], nativeSidecarCount: number }} Decoded source data.
     */
    static decode(normalized) {
        const buffer = ParserInput.arrayBuffer(normalized.input.data)
        const native = AltiumSchematicImageNormalizer.normalize(
            AltiumParser.parseArrayBufferToRendererModel(
                normalized.input.fileName,
                buffer
            )
        )
        const adapted = CircuitJsonModelAdapter.fromRendererModel(native)
        const projected = AltiumCircuitJsonProjection.project(adapted, native)
        const model = projected.filter(
            (element) =>
                !String(element?.type || '').startsWith('altium_toolkit_')
        )
        return {
            native,
            model,
            nativeSidecarCount: projected.length - model.length
        }
    }

    /**
     * Parses and validates one normalized request exactly once.
     * @param {{ input: { fileName: string, data: string | ArrayBuffer | Uint8Array, assets: object[] }, sourceReference: object, options: Record<string, any> }} normalized Normalized request.
     * @param {{ native: Record<string, any>, model: object[], nativeSidecarCount: number } | null} [decoded] Previously decoded source data.
     * @returns {Record<string, any>} Canonical immutable document.
     */
    static build(normalized, decoded = null) {
        const prepared = decoded || AltiumDocumentBuilder.decode(normalized)
        const { model, native } = prepared
        const extension = AltiumDocumentBuilder.#extension(
            native,
            normalized.options
        )
        const runtime =
            normalized.options.retainSource === 'reference'
                ? { sourceReference: normalized.sourceReference }
                : {}
        return DocumentResult.createValidatedOwned(
            {
                model,
                source: {
                    format: 'altium',
                    fileName: normalized.input.fileName,
                    fileType: ParserInput.suffix(normalized.input.fileName)
                },
                extensions: extension ? { altium: extension } : {},
                assets: AltiumDocumentBuilder.#assets(
                    normalized.input.assets,
                    normalized.options.decodeAssets,
                    native
                ),
                diagnostics: [
                    ...(native.diagnostics || []),
                    ...CircuitJsonSchematicImageProjection.diagnostics(native)
                ],
                statistics: {
                    elementCount: model.length,
                    nativeSidecarCount: prepared.nativeSidecarCount,
                    nativeKind: String(native.kind || '')
                }
            },
            runtime
        )
    }

    /**
     * Selects source-native extension facts according to common options.
     * @param {Record<string, any>} native Native renderer model.
     * @param {Record<string, any>} options Common options.
     * @returns {Record<string, any> | null} Extension payload or null.
     */
    static #extension(native, options) {
        if (
            options.extensions === 'none' ||
            (Array.isArray(options.extensions) && !options.extensions.length)
        ) {
            return null
        }
        const includeNative =
            options.extensions === 'full' ||
            options.preserveRaw ||
            (Array.isArray(options.extensions) &&
                options.extensions.includes('altium.native-model'))
        const completeness =
            options.extensions === 'full'
                ? 'full'
                : options.extensions === 'metadata'
                  ? 'metadata'
                  : 'canonical'
        const projectContext = AltiumDocumentBuilder.#projectContext(native)
        const metadata = {
            $meta: {
                schema: 'ecad-toolkit.extension.v1',
                completeness,
                included: [
                    'altium.summary',
                    ...(projectContext ? ['altium.project-context'] : []),
                    ...(includeNative ? ['altium.native-model'] : [])
                ],
                omitted: []
            },
            kind: String(native.kind || ''),
            fileType: String(native.fileType || ''),
            summary: native.summary || {},
            ...(projectContext ? { projectContext } : {})
        }
        return includeNative ? { ...metadata, native } : metadata
    }

    /**
     * Selects compact project facts required to resolve canonical schematics.
     * @param {Record<string, any>} native Native renderer model.
     * @returns {{ parameters: Record<string, string>, documents: string[] } | null} Project facts.
     */
    static #projectContext(native) {
        if (native?.kind !== 'project' || !native.project) return null
        const parameters = Object.fromEntries(
            (native.project.parameters?.list || []).map((parameter) => [
                String(parameter?.name || ''),
                String(parameter?.value || '')
            ])
        )
        const documents = (native.project.documents || []).map((document) =>
            String(document?.normalizedPath || document?.path || '')
        )
        return { parameters, documents }
    }

    /**
     * Applies the common asset decode policy without sharing caller buffers.
     * @param {object[]} assets Caller-supplied assets.
     * @param {string} mode Decode mode.
     * @param {Record<string, unknown>} native Native renderer model.
     * @returns {object[]} Canonical asset records.
     */
    static #assets(assets, mode, native) {
        return [
            ...ToolkitAsset.prepareAll(assets, { mode }),
            ...ToolkitAsset.prepareAll(
                CircuitJsonSchematicImageProjection.assets(native),
                { mode }
            )
        ]
    }
}

Object.freeze(AltiumDocumentBuilder.prototype)
Object.freeze(AltiumDocumentBuilder)
