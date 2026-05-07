// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Applies component annotations recovered from PCB sidecar streams.
 */
export class PcbComponentAnnotationNormalizer {
    /**
     * Enriches component records with Texts6 designators and parameters.
     * @param {{ componentIndex: number, designator: string, uniqueId?: string, description?: string, parameters?: Record<string, string> }[]} components
     * @param {{ text?: string, ownerIndex?: number | null, componentIndex?: number | null, role?: string, isDesignator?: boolean }[]} texts
     * @param {{ byPrimitiveId?: Record<string, Record<string, string>>, groups?: { primitiveId: string, parameters: Record<string, string> }[] } | undefined} primitiveParameters
     * @returns {object[]}
     */
    static enrichComponents(components, texts, primitiveParameters) {
        return PcbComponentAnnotationNormalizer.#applyPrimitiveParameters(
            PcbComponentAnnotationNormalizer.#applyTextDesignators(
                components,
                texts
            ),
            PcbComponentAnnotationNormalizer.#primitiveParameterLookup(
                primitiveParameters
            )
        )
    }

    /**
     * Marks decoded PCB text primitives as visible or hidden based on linked
     * component display flags.
     * @param {{ text: string, ownerIndex?: number | null, componentIndex?: number | null, kind?: number, visibilityFlags?: number, role?: string, isDesignator?: boolean }[]} texts
     * @param {{ componentIndex: number, designator: string, nameOn: boolean, commentOn: boolean }[]} components
     * @returns {object[]}
     */
    static normalizeTexts(texts, components) {
        return (texts || []).map((text) => ({
            ...text,
            visible: PcbComponentAnnotationNormalizer.#isVisibleText(
                text,
                components
            )
        }))
    }

    /**
     * Applies Texts6-owned designator strings to their native component.
     * @param {{ componentIndex: number, designator: string }[]} components
     * @param {{ text?: string, ownerIndex?: number | null, componentIndex?: number | null, role?: string, isDesignator?: boolean }[]} texts
     * @returns {object[]}
     */
    static #applyTextDesignators(components, texts) {
        const designatorsByComponentIndex =
            PcbComponentAnnotationNormalizer.#textDesignatorLookup(texts)

        return (components || []).map((component) => {
            const displayDesignator = designatorsByComponentIndex.get(
                Number(component.componentIndex)
            )

            if (
                !displayDesignator ||
                PcbComponentAnnotationNormalizer.#normalizeText(
                    displayDesignator
                ) ===
                    PcbComponentAnnotationNormalizer.#normalizeText(
                        component.designator
                    )
            ) {
                return component
            }

            return {
                ...component,
                baseDesignator: component.designator,
                designator: displayDesignator,
                displayDesignator,
                designatorSource: 'Texts6/Data'
            }
        })
    }

    /**
     * Builds a component-indexed lookup from explicit Texts6 designators.
     * @param {{ text?: string, ownerIndex?: number | null, componentIndex?: number | null, role?: string, isDesignator?: boolean }[]} texts
     * @returns {Map<number, string>}
     */
    static #textDesignatorLookup(texts) {
        const designatorsByComponentIndex = new Map()

        for (const text of texts || []) {
            const componentIndex =
                PcbComponentAnnotationNormalizer.#textComponentIndex(text)
            if (
                !Number.isInteger(componentIndex) ||
                !PcbComponentAnnotationNormalizer.#isDesignatorTextPrimitive(
                    text
                ) ||
                !text.text
            ) {
                continue
            }

            designatorsByComponentIndex.set(componentIndex, String(text.text))
        }

        return designatorsByComponentIndex
    }

    /**
     * Resolves the native component index from a decoded text primitive.
     * @param {{ ownerIndex?: number | null, componentIndex?: number | null }} text
     * @returns {number | null}
     */
    static #textComponentIndex(text) {
        const componentIndex = Number(text?.componentIndex)
        if (Number.isInteger(componentIndex)) {
            return componentIndex
        }

        const ownerIndex = Number(text?.ownerIndex)
        return Number.isInteger(ownerIndex) ? ownerIndex : null
    }

    /**
     * Returns true when one text primitive explicitly represents a designator.
     * @param {{ role?: string, isDesignator?: boolean }} text
     * @returns {boolean}
     */
    static #isDesignatorTextPrimitive(text) {
        return text?.isDesignator === true || text?.role === 'designator'
    }

    /**
     * Applies PrimitiveParameters/Data values to components by unique ID.
     * @param {{ uniqueId?: string, description?: string, parameters?: Record<string, string> }[]} components
     * @param {Map<string, Record<string, string>>} parametersByPrimitiveId
     * @returns {object[]}
     */
    static #applyPrimitiveParameters(components, parametersByPrimitiveId) {
        return (components || []).map((component) => {
            const primitiveId = String(component.uniqueId || '')
            const parameters = primitiveId
                ? parametersByPrimitiveId.get(primitiveId)
                : null

            if (!parameters) {
                return component
            }

            const mergedParameters = {
                ...(component.parameters || {}),
                ...parameters
            }

            return {
                ...component,
                description:
                    component.description ||
                    PcbComponentAnnotationNormalizer.#firstParameterValue(
                        mergedParameters,
                        ['Description', 'Comment', 'Value']
                    ),
                parameters: mergedParameters,
                parameterSource: 'PrimitiveParameters/Data'
            }
        })
    }

    /**
     * Builds a primitive-parameter lookup from supported extraction shapes.
     * @param {{ byPrimitiveId?: Record<string, Record<string, string>>, groups?: { primitiveId: string, parameters: Record<string, string> }[] } | undefined} primitiveParameters
     * @returns {Map<string, Record<string, string>>}
     */
    static #primitiveParameterLookup(primitiveParameters) {
        const lookup = new Map()

        for (const [primitiveId, parameters] of Object.entries(
            primitiveParameters?.byPrimitiveId || {}
        )) {
            lookup.set(String(primitiveId), { ...(parameters || {}) })
        }

        for (const group of primitiveParameters?.groups || []) {
            if (group?.primitiveId && !lookup.has(String(group.primitiveId))) {
                lookup.set(String(group.primitiveId), {
                    ...(group.parameters || {})
                })
            }
        }

        return lookup
    }

    /**
     * Returns the first non-empty parameter value using case-insensitive names.
     * @param {Record<string, string>} parameters
     * @param {string[]} names
     * @returns {string}
     */
    static #firstParameterValue(parameters, names) {
        const normalizedParameters = new Map(
            Object.entries(parameters || {}).map(([name, value]) => [
                name.toLowerCase(),
                String(value || '')
            ])
        )

        for (const name of names) {
            const value = normalizedParameters.get(name.toLowerCase())
            if (value) {
                return value
            }
        }

        return ''
    }

    /**
     * Returns true when one PCB text primitive should render in board view.
     * @param {{ text: string, ownerIndex?: number | null, componentIndex?: number | null, kind?: number, visibilityFlags?: number, role?: string, isDesignator?: boolean }} text
     * @param {{ componentIndex: number, designator: string, nameOn: boolean, commentOn: boolean }[]} components
     * @returns {boolean}
     */
    static #isVisibleText(text, components) {
        const componentIndex =
            PcbComponentAnnotationNormalizer.#textComponentIndex(text)

        if (!Number.isInteger(componentIndex)) {
            return true
        }

        const component =
            PcbComponentAnnotationNormalizer.#componentByNativeIndex(
                components,
                componentIndex
            )
        if (!component) {
            return (Number(text?.visibilityFlags || 0) & 1) === 0
        }

        if (PcbComponentAnnotationNormalizer.#isDesignatorTextPrimitive(text)) {
            return component.nameOn
        }

        if (
            PcbComponentAnnotationNormalizer.#normalizeText(text.text) ===
            PcbComponentAnnotationNormalizer.#normalizeText(
                component.designator
            )
        ) {
            return component.nameOn
        }

        if (Number(text?.kind) === 1) {
            return component.commentOn
        }

        if ((Number(text?.visibilityFlags || 0) & 1) !== 0) {
            return component.nameOn
        }

        return true
    }

    /**
     * Finds one normalized component by native component table index.
     * @param {{ componentIndex: number }[]} components
     * @param {number} componentIndex
     * @returns {object | null}
     */
    static #componentByNativeIndex(components, componentIndex) {
        return (
            (components || []).find(
                (component) =>
                    Number(component?.componentIndex) === componentIndex
            ) || null
        )
    }

    /**
     * Normalizes text for display-flag comparisons.
     * @param {unknown} text
     * @returns {string}
     */
    static #normalizeText(text) {
        return String(text || '')
            .trim()
            .toUpperCase()
    }
}
