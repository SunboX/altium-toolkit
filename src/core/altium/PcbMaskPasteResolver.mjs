// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves effective paste/solder mask expansion from primitive, sidecar,
 * rule, and document-default sources.
 */
export class PcbMaskPasteResolver {
    static SCHEMA_ID = 'altium-toolkit.pcb.mask-paste.a1'

    /**
     * Builds and attaches effective mask/paste metadata.
     * @param {{ pads?: object[], vias?: object[], rules?: object[], defaults?: object | null }} context Resolver context.
     * @returns {object}
     */
    static build(context) {
        const pads = Array.isArray(context?.pads) ? context.pads : []
        const vias = Array.isArray(context?.vias) ? context.vias : []
        const defaults = context?.defaults || null
        const rules = Array.isArray(context?.rules) ? context.rules : []
        const primitiveRows = [
            ...PcbMaskPasteResolver.#resolveFamily(
                'pad',
                pads,
                defaults,
                rules
            ),
            ...PcbMaskPasteResolver.#resolveFamily('via', vias, defaults, rules)
        ]
        const summary = PcbMaskPasteResolver.#summarize(primitiveRows)

        return {
            schema: PcbMaskPasteResolver.SCHEMA_ID,
            summary,
            defaults: defaults?.maskPaste || {},
            rules: PcbMaskPasteResolver.#maskRules(rules),
            primitives: primitiveRows
        }
    }

    /**
     * Resolves one primitive family and attaches primitive metadata.
     * @param {'pad' | 'via'} primitiveKind Primitive kind.
     * @param {object[]} primitives Family primitives.
     * @param {object | null} defaults Board defaults.
     * @param {object[]} rules Parsed rule rows.
     * @returns {object[]}
     */
    static #resolveFamily(primitiveKind, primitives, defaults, rules) {
        return primitives.flatMap((primitive, index) => {
            const primitiveIndex = Number.isInteger(primitive.primitiveIndex)
                ? primitive.primitiveIndex
                : index
            const effectiveMaskPaste = {
                paste: PcbMaskPasteResolver.#resolveSide(
                    primitive,
                    'paste',
                    defaults,
                    rules
                ),
                solder: PcbMaskPasteResolver.#resolveSide(
                    primitive,
                    'solder',
                    defaults,
                    rules
                )
            }

            if (
                effectiveMaskPaste.paste.source === 'unresolved' &&
                effectiveMaskPaste.solder.source === 'unresolved'
            ) {
                return []
            }

            primitive.effectiveMaskPaste = effectiveMaskPaste

            return [
                {
                    primitiveKey: primitiveKind + '-' + String(primitiveIndex),
                    primitiveKind,
                    primitiveIndex,
                    ...effectiveMaskPaste
                }
            ]
        })
    }

    /**
     * Resolves one mask side with source precedence.
     * @param {object} primitive Primitive row.
     * @param {'paste' | 'solder'} side Mask side.
     * @param {object | null} defaults Board defaults.
     * @param {object[]} rules Parsed rules.
     * @returns {object}
     */
    static #resolveSide(primitive, side, defaults, rules) {
        const sidecar = PcbMaskPasteResolver.#sidecarValue(primitive, side)
        if (sidecar) return sidecar

        const primitiveValue = PcbMaskPasteResolver.#primitiveValue(
            primitive,
            side
        )
        if (primitiveValue) return primitiveValue

        const ruleValue = PcbMaskPasteResolver.#ruleValue(rules, side)
        if (ruleValue) return ruleValue

        const defaultExpansion = PcbMaskPasteResolver.#defaultExpansion(
            defaults,
            side
        )
        if (defaultExpansion !== null) {
            return {
                source: 'document-default',
                expansionMil: defaultExpansion,
                unit: 'mil'
            }
        }

        return {
            source: 'unresolved',
            expansionMil: null,
            unit: 'mil'
        }
    }

    /**
     * Returns a manual sidecar value when present.
     * @param {object} primitive Primitive row.
     * @param {'paste' | 'solder'} side Mask side.
     * @returns {object | null}
     */
    static #sidecarValue(primitive, side) {
        const sidecar =
            primitive?.extendedPrimitiveInformation?.maskExpansion?.[side]
        if (
            sidecar?.manualExpansion === null ||
            sidecar?.manualExpansion === undefined
        ) {
            return null
        }

        const manualExpansion = Number(sidecar.manualExpansion)

        if (Number.isFinite(manualExpansion)) {
            return {
                source: 'sidecar-manual',
                mode: Number.isInteger(sidecar.mode) ? sidecar.mode : null,
                expansionMil: manualExpansion,
                unit: 'mil'
            }
        }

        return null
    }

    /**
     * Returns a primitive-local mask value when present.
     * @param {object} primitive Primitive row.
     * @param {'paste' | 'solder'} side Mask side.
     * @returns {object | null}
     */
    static #primitiveValue(primitive, side) {
        const prefix = side === 'paste' ? 'paste' : 'solder'
        const mode = PcbMaskPasteResolver.#numberOrNull(
            primitive?.[prefix + 'MaskExpansionMode']
        )
        const rawExpansion = PcbMaskPasteResolver.#numberOrNull(
            primitive?.[prefix + 'MaskExpansion']
        )
        const effectiveExpansion = PcbMaskPasteResolver.#numberOrNull(
            primitive?.[
                'effective' +
                    PcbMaskPasteResolver.#title(prefix) +
                    'MaskExpansion'
            ]
        )

        if (mode === 1) {
            return {
                source: 'rule',
                mode,
                expansionMil: effectiveExpansion ?? rawExpansion,
                unit: 'mil'
            }
        }
        if (mode === 2) {
            return {
                source: 'primitive-manual',
                mode,
                expansionMil: effectiveExpansion ?? rawExpansion,
                unit: 'mil'
            }
        }

        return null
    }

    /**
     * Returns the first matching rule-derived expansion.
     * @param {object[]} rules Parsed rules.
     * @param {'paste' | 'solder'} side Mask side.
     * @returns {object | null}
     */
    static #ruleValue(rules, side) {
        const rule = PcbMaskPasteResolver.#maskRules(rules).find(
            (candidate) => candidate.side === side
        )

        if (!rule || rule.expansionMil === null) {
            return null
        }

        return {
            source: 'rule',
            ruleName: rule.name,
            ruleKind: rule.ruleKind,
            expansionMil: rule.expansionMil,
            unit: 'mil'
        }
    }

    /**
     * Extracts mask/paste rule summaries.
     * @param {object[]} rules Parsed rules.
     * @returns {object[]}
     */
    static #maskRules(rules) {
        return (rules || [])
            .map((rule) => PcbMaskPasteResolver.#maskRule(rule))
            .filter(Boolean)
    }

    /**
     * Extracts one mask/paste rule summary.
     * @param {object} rule Parsed rule.
     * @returns {object | null}
     */
    static #maskRule(rule) {
        const token = [
            rule?.ruleKind,
            rule?.ruleType?.kind,
            rule?.ruleType?.displayName,
            rule?.name
        ]
            .join(' ')
            .toLowerCase()
        const side = token.includes('paste')
            ? 'paste'
            : token.includes('solder') || token.includes('mask')
              ? 'solder'
              : ''

        if (!side) {
            return null
        }

        return {
            name: rule.name || '',
            ruleKind: rule.ruleKind || '',
            side,
            expansionMil: PcbMaskPasteResolver.#firstConstraintMil(rule) ?? null
        }
    }

    /**
     * Returns the first length-valued constraint in mils.
     * @param {object} rule Parsed rule.
     * @returns {number | null}
     */
    static #firstConstraintMil(rule) {
        for (const value of Object.values(rule?.constraintValues || {})) {
            if (Number.isFinite(value?.valueMil)) return value.valueMil
            if (
                value?.type === 'number' &&
                Number.isFinite(Number(value.value))
            ) {
                return Number(value.value)
            }
        }

        return null
    }

    /**
     * Returns the document default expansion for one side.
     * @param {object | null} defaults Board defaults.
     * @param {'paste' | 'solder'} side Mask side.
     * @returns {number | null}
     */
    static #defaultExpansion(defaults, side) {
        const expansion = Number(defaults?.maskPaste?.[side]?.expansionMil)
        return Number.isFinite(expansion) ? expansion : null
    }

    /**
     * Builds summary counts from resolved primitive rows.
     * @param {object[]} primitiveRows Resolved primitive rows.
     * @returns {object}
     */
    static #summarize(primitiveRows) {
        const summary = {
            primitiveCount: primitiveRows.length,
            manualCount: 0,
            ruleCount: 0,
            defaultCount: 0,
            unresolvedCount: 0
        }

        for (const row of primitiveRows) {
            for (const side of ['paste', 'solder']) {
                const source = row[side]?.source || 'unresolved'
                if (
                    source === 'sidecar-manual' ||
                    source === 'primitive-manual'
                ) {
                    summary.manualCount += 1
                } else if (source === 'rule') {
                    summary.ruleCount += 1
                } else if (source === 'document-default') {
                    summary.defaultCount += 1
                } else {
                    summary.unresolvedCount += 1
                }
            }
        }

        return summary
    }

    /**
     * Converts a value to a finite number or null.
     * @param {unknown} value Source value.
     * @returns {number | null}
     */
    static #numberOrNull(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number : null
    }

    /**
     * Title-cases one ASCII token.
     * @param {string} value Token.
     * @returns {string}
     */
    static #title(value) {
        return String(value || '').replace(/^./u, (letter) =>
            letter.toUpperCase()
        )
    }
}
