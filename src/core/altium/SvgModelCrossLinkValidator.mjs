// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Validates that semantic SVG links point back to normalized model entries.
 */
export class SvgModelCrossLinkValidator {
    static SCHEMA = 'altium-toolkit.svg-model-cross-link.a1'

    /**
     * Validates semantic SVG data attributes against a normalized model.
     * @param {object} documentModel Normalized schematic or PCB model.
     * @param {string} svgMarkup SVG markup.
     * @returns {object}
     */
    static validate(documentModel, svgMarkup) {
        return SvgModelCrossLinkValidator.validateSet(documentModel, [
            svgMarkup
        ])
    }

    /**
     * Validates a set of semantic SVG fragments against one normalized model.
     * @param {object} documentModel Normalized schematic or PCB model.
     * @param {string[]} svgMarkups SVG markup strings.
     * @returns {object}
     */
    static validateSet(documentModel, svgMarkups) {
        const documentKind =
            SvgModelCrossLinkValidator.#documentKind(documentModel)
        const expectedElements =
            SvgModelCrossLinkValidator.#expectedElements(documentModel)
        const expectedByKey = new Map(
            expectedElements.map((element) => [element.elementKey, element])
        )
        const svgElements = (svgMarkups || []).flatMap((svgMarkup) =>
            SvgModelCrossLinkValidator.#svgElements(svgMarkup)
        )
        const renderedKeys = new Set(
            svgElements.map((element) => element.elementKey).filter(Boolean)
        )
        const orphanElements = SvgModelCrossLinkValidator.#orphanElements(
            svgElements,
            expectedByKey,
            documentKind
        )
        const missingElements = SvgModelCrossLinkValidator.#missingElements(
            expectedElements,
            renderedKeys,
            documentModel.diagnostics || []
        )
        const unresolvedReferences =
            SvgModelCrossLinkValidator.#unresolvedReferences(
                documentModel,
                svgElements
            )
        const metadata = SvgModelCrossLinkValidator.#metadataSet(svgMarkups)

        return {
            schema: SvgModelCrossLinkValidator.SCHEMA,
            documentKind,
            summary: {
                svgCount: (svgMarkups || []).length,
                expectedElementCount: expectedElements.length,
                renderedElementCount: renderedKeys.size,
                linkedElementCount:
                    expectedElements.length - missingElements.length,
                missingElementCount: missingElements.length,
                orphanElementCount: orphanElements.length,
                unresolvedReferenceCount: unresolvedReferences.length,
                metadataElementCount: metadata.elements.length
            },
            missingElements,
            orphanElements,
            unresolvedReferences,
            metadata
        }
    }

    /**
     * Determines the model kind for report output.
     * @param {object} documentModel Normalized document model.
     * @returns {'schematic' | 'pcb' | 'unknown'}
     */
    static #documentKind(documentModel) {
        if (documentModel?.schematic) return 'schematic'
        if (documentModel?.pcb) return 'pcb'
        return 'unknown'
    }

    /**
     * Builds expected semantic element keys from a normalized model.
     * @param {object} documentModel Normalized document model.
     * @returns {object[]}
     */
    static #expectedElements(documentModel) {
        if (documentModel?.schematic) {
            return SvgModelCrossLinkValidator.#schematicExpectedElements(
                documentModel.schematic
            )
        }
        if (documentModel?.pcb) {
            return SvgModelCrossLinkValidator.#pcbExpectedElements(
                documentModel.pcb
            )
        }
        return []
    }

    /**
     * Builds expected schematic element descriptors.
     * @param {object} schematic Normalized schematic payload.
     * @returns {object[]}
     */
    static #schematicExpectedElements(schematic) {
        return SvgModelCrossLinkValidator.#collectionElements('schematic', [
            ['lines', 'line', schematic?.lines || []],
            ['polygons', 'polygon', schematic?.polygons || []],
            ['rectangles', 'rectangle', schematic?.rectangles || []],
            [
                'roundedRectangles',
                'rounded-rectangle',
                schematic?.roundedRectangles || []
            ],
            ['ellipses', 'ellipse', schematic?.ellipses || []],
            ['arcs', 'arc', schematic?.arcs || []],
            ['beziers', 'bezier', schematic?.beziers || []],
            ['pies', 'pie', schematic?.pies || []],
            ['ieeeSymbols', 'ieee-symbol', schematic?.ieeeSymbols || []],
            ['texts', 'text', schematic?.texts || []],
            ['pins', 'pin', schematic?.pins || []],
            ['ports', 'port', schematic?.ports || []],
            ['directives', 'directive', schematic?.directives || []]
        ])
    }

    /**
     * Builds expected PCB element descriptors.
     * @param {object} pcb Normalized PCB payload.
     * @returns {object[]}
     */
    static #pcbExpectedElements(pcb) {
        return SvgModelCrossLinkValidator.#collectionElements('pcb', [
            ['polygons', 'polygon', pcb?.polygons || []],
            ['fills', 'fill', pcb?.fills || []],
            ['tracks', 'track', pcb?.tracks || []],
            ['arcs', 'arc', pcb?.arcs || []],
            ['vias', 'via', pcb?.vias || []],
            ['pads', 'pad', pcb?.pads || []],
            ['texts', 'text', pcb?.texts || []],
            ['components', 'component', pcb?.components || []]
        ])
    }

    /**
     * Builds descriptors for primitive collections.
     * @param {'schematic' | 'pcb'} prefix SVG element prefix.
     * @param {[string, string, object[]][]} collections Collections to inspect.
     * @returns {object[]}
     */
    static #collectionElements(prefix, collections) {
        const elements = []
        for (const [collectionKey, primitiveKind, records] of collections) {
            for (const [index, record] of (records || []).entries()) {
                elements.push({
                    elementKey: prefix + '-' + primitiveKind + '-' + index,
                    collectionKey,
                    primitiveKind,
                    recordId:
                        record?.recordId ??
                        record?.sourceRecordId ??
                        record?.sourceRecordIndex ??
                        ''
                })
            }
        }
        return elements
    }

    /**
     * Extracts SVG elements that carry semantic data attributes.
     * @param {string} svgMarkup SVG markup.
     * @returns {object[]}
     */
    static #svgElements(svgMarkup) {
        const elements = []
        const tagPattern = /<[^>]+data-element-key="[^"]+"[^>]*>/gu
        let match = tagPattern.exec(String(svgMarkup || ''))
        while (match) {
            const attrs = SvgModelCrossLinkValidator.#dataAttributes(match[0])
            elements.push({
                elementKey: attrs.elementKey || '',
                primitive: attrs.primitive || '',
                component: attrs.component || '',
                net: attrs.net || '',
                pin: attrs.pin || '',
                attrs
            })
            match = tagPattern.exec(String(svgMarkup || ''))
        }
        return elements
    }

    /**
     * Extracts data attributes from one SVG tag.
     * @param {string} tag SVG tag markup.
     * @returns {Record<string, string>}
     */
    static #dataAttributes(tag) {
        const attrs = {}
        const attrPattern = /data-([a-z0-9-]+)="([^"]*)"/giu
        let match = attrPattern.exec(tag || '')
        while (match) {
            attrs[SvgModelCrossLinkValidator.#camelCase(match[1])] =
                SvgModelCrossLinkValidator.#decodeEntities(match[2])
            match = attrPattern.exec(tag || '')
        }
        return attrs
    }

    /**
     * Finds rendered elements not represented by the normalized model.
     * @param {object[]} svgElements Rendered semantic SVG rows.
     * @param {Map<string, object>} expectedByKey Expected element map.
     * @param {'schematic' | 'pcb' | 'unknown'} documentKind Document kind.
     * @returns {object[]}
     */
    static #orphanElements(svgElements, expectedByKey, documentKind) {
        return svgElements
            .filter(
                (element) =>
                    !expectedByKey.has(element.elementKey) &&
                    !SvgModelCrossLinkValidator.#isRendererOwnedElement(
                        element.elementKey,
                        documentKind
                    )
            )
            .map((element) => ({
                elementKey: element.elementKey,
                primitive: element.primitive || ''
            }))
    }

    /**
     * Finds normalized elements that are not represented in SVG output.
     * @param {object[]} expectedElements Expected model element rows.
     * @param {Set<string>} renderedKeys Rendered SVG element keys.
     * @param {object[]} diagnostics Model diagnostics.
     * @returns {object[]}
     */
    static #missingElements(expectedElements, renderedKeys, diagnostics) {
        return expectedElements
            .filter(
                (element) =>
                    !renderedKeys.has(element.elementKey) &&
                    !SvgModelCrossLinkValidator.#hasDiagnostic(
                        element,
                        diagnostics
                    )
            )
            .map((element) => ({
                elementKey: element.elementKey,
                collectionKey: element.collectionKey,
                primitiveKind: element.primitiveKind,
                recordId: element.recordId || undefined
            }))
    }

    /**
     * Checks whether a missing element has an explicit diagnostic.
     * @param {object} element Expected element row.
     * @param {object[]} diagnostics Model diagnostics.
     * @returns {boolean}
     */
    static #hasDiagnostic(element, diagnostics) {
        return (diagnostics || []).some((diagnostic) => {
            const message = String(diagnostic?.message || '')
            return (
                diagnostic?.elementKey === element.elementKey ||
                (element.recordId &&
                    diagnostic?.recordId === element.recordId) ||
                message.includes(element.elementKey)
            )
        })
    }

    /**
     * Finds component/net references that cannot be resolved in the model.
     * @param {object} documentModel Normalized document model.
     * @param {object[]} svgElements Rendered semantic SVG rows.
     * @returns {object[]}
     */
    static #unresolvedReferences(documentModel, svgElements) {
        const components =
            SvgModelCrossLinkValidator.#componentNames(documentModel)
        const nets = SvgModelCrossLinkValidator.#netNames(documentModel)
        const unresolved = []

        for (const element of svgElements) {
            if (element.component && !components.has(element.component)) {
                unresolved.push({
                    elementKey: element.elementKey,
                    referenceKind: 'component',
                    value: element.component
                })
            }
            if (element.net && !nets.has(element.net)) {
                unresolved.push({
                    elementKey: element.elementKey,
                    referenceKind: 'net',
                    value: element.net
                })
            }
        }

        return unresolved
    }

    /**
     * Collects normalized component designators.
     * @param {object} documentModel Normalized document model.
     * @returns {Set<string>}
     */
    static #componentNames(documentModel) {
        const components =
            documentModel?.schematic?.components ||
            documentModel?.pcb?.components ||
            []
        return new Set(
            components
                .map((component) => String(component?.designator || ''))
                .filter(Boolean)
        )
    }

    /**
     * Collects normalized net names.
     * @param {object} documentModel Normalized document model.
     * @returns {Set<string>}
     */
    static #netNames(documentModel) {
        const nets =
            documentModel?.schematic?.nets || documentModel?.pcb?.nets || []
        return new Set(
            nets.map((net) => String(net?.name || '')).filter(Boolean)
        )
    }

    /**
     * Returns true for renderer-owned semantic helpers.
     * @param {string} elementKey SVG element key.
     * @param {'schematic' | 'pcb' | 'unknown'} documentKind Document kind.
     * @returns {boolean}
     */
    static #isRendererOwnedElement(elementKey, documentKind) {
        if (documentKind !== 'pcb') return false
        return (
            elementKey === 'pcb-board-outline' ||
            elementKey === 'pcb-board-outline-stroke' ||
            /^pcb-board-cutout-\d+$/u.test(elementKey) ||
            /^pcb-(via|pad)-hole-\d+$/u.test(elementKey)
        )
    }

    /**
     * Extracts the semantic metadata JSON sidecar when present.
     * @param {string} svgMarkup SVG markup.
     * @returns {{ schema: string, elements: object[] }}
     */
    static #metadata(svgMarkup) {
        const match = String(svgMarkup || '').match(
            /<metadata id="(?:schematic|pcb)-semantic-metadata"[^>]*>([^<]*)<\/metadata>/u
        )
        if (!match) {
            return { schema: '', elements: [] }
        }
        try {
            const metadata = JSON.parse(
                SvgModelCrossLinkValidator.#decodeEntities(match[1])
            )
            return {
                schema: metadata.schema || '',
                elements: Array.isArray(metadata.elements)
                    ? metadata.elements
                    : []
            }
        } catch {
            return { schema: '', elements: [] }
        }
    }

    /**
     * Extracts semantic metadata from a set of SVG fragments.
     * @param {string[]} svgMarkups SVG markup strings.
     * @returns {{ schema: string, elements: object[] }}
     */
    static #metadataSet(svgMarkups) {
        const metadataRows = (svgMarkups || []).map((svgMarkup) =>
            SvgModelCrossLinkValidator.#metadata(svgMarkup)
        )
        const schema =
            metadataRows.find((metadata) => metadata.schema)?.schema || ''

        return {
            schema,
            elements: metadataRows.flatMap((metadata) => metadata.elements)
        }
    }

    /**
     * Converts a data attribute token to a camelCase object key.
     * @param {string} value Attribute token.
     * @returns {string}
     */
    static #camelCase(value) {
        return String(value || '').replace(/-([a-z0-9])/giu, (_match, char) =>
            String(char).toUpperCase()
        )
    }

    /**
     * Decodes basic XML entities.
     * @param {string} value Encoded value.
     * @returns {string}
     */
    static #decodeEntities(value) {
        return String(value || '')
            .replace(/&quot;/gu, '"')
            .replace(/&apos;/gu, "'")
            .replace(/&lt;/gu, '<')
            .replace(/&gt;/gu, '>')
            .replace(/&amp;/gu, '&')
    }
}
