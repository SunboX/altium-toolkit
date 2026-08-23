// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgRenderer as LegacySchematicSvgRenderer } from '../ui/SchematicSvgRenderer.mjs'
import { AltiumSchematicImageNormalizer } from './AltiumSchematicImageNormalizer.mjs'
import { AltiumSchematicNativeFooterOwnerAligner } from './AltiumSchematicNativeFooterOwnerAligner.mjs'

/**
 * Renders native Altium schematic models through the preserved historical
 * renderer while applying convergence-owned visibility semantics.
 */
export class SchematicSvgRenderer {
    static #frozenRenderDocuments = new WeakMap()

    /**
     * Renders one native Altium schematic document as SVG markup.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @param {Record<string, any>} [options] Historical renderer options.
     * @returns {string} Rendered SVG panel markup.
     */
    static render(documentModel, options = {}) {
        const normalized =
            AltiumSchematicImageNormalizer.normalize(documentModel)
        const aligned =
            AltiumSchematicNativeFooterOwnerAligner.align(normalized)
        return LegacySchematicSvgRenderer.render(
            SchematicSvgRenderer.#visibilityAwareDocument(aligned),
            options
        )
    }

    /**
     * Builds a shallow render view that prevents hidden source designators from
     * being synthesized as fallback labels by the historical renderer.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @returns {Record<string, any>} Visibility-aware render document.
     */
    static #visibilityAwareDocument(documentModel) {
        const components = documentModel?.schematic?.components
        if (!Array.isArray(components)) return documentModel

        const cached =
            SchematicSvgRenderer.#frozenRenderDocuments.get(documentModel)
        if (cached) return cached

        const firstHiddenIndex = components.findIndex(
            (component) => component?.schematicDesignatorVisible === false
        )
        const renderDocument =
            firstHiddenIndex < 0
                ? documentModel
                : SchematicSvgRenderer.#withoutHiddenDesignators(
                      documentModel,
                      components,
                      firstHiddenIndex
                  )

        if (
            SchematicSvgRenderer.#hasImmutableVisibilityInputs(
                documentModel,
                components
            )
        ) {
            SchematicSvgRenderer.#frozenRenderDocuments.set(
                documentModel,
                renderDocument
            )
        }
        return renderDocument
    }

    /**
     * Returns true only when every container and row that controls the
     * visibility rewrite is immutable for the lifetime of a cache entry.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @param {Record<string, any>[]} components Native schematic components.
     * @returns {boolean} Whether the visibility-aware view can be cached.
     */
    static #hasImmutableVisibilityInputs(documentModel, components) {
        if (
            !Object.isFrozen(documentModel) ||
            !Object.isFrozen(documentModel.schematic) ||
            !Object.isFrozen(components)
        ) {
            return false
        }
        for (const component of components) {
            if (
                !component ||
                typeof component !== 'object' ||
                !Object.isFrozen(component)
            ) {
                return false
            }
        }
        return true
    }

    /**
     * Copies only the document path and component rows affected by hidden
     * designator visibility, leaving every other native object shared.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @param {Record<string, any>[]} components Native schematic components.
     * @param {number} firstHiddenIndex First component requiring adaptation.
     * @returns {Record<string, any>} Render-only native document view.
     */
    static #withoutHiddenDesignators(
        documentModel,
        components,
        firstHiddenIndex
    ) {
        const renderComponents = components.slice()
        for (
            let index = firstHiddenIndex;
            index < renderComponents.length;
            index += 1
        ) {
            const component = renderComponents[index]
            if (component?.schematicDesignatorVisible === false) {
                renderComponents[index] = { ...component, designator: '' }
            }
        }

        return {
            ...documentModel,
            schematic: {
                ...documentModel.schematic,
                components: renderComponents
            }
        }
    }
}
