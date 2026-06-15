// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'
import { SchematicFieldCoverageReportBuilder } from './SchematicFieldCoverageReportBuilder.mjs'

const { parseBoolean, parseNumericField, toColor } = ParserUtils

/**
 * Builds deterministic read-only QA summaries for schematic documents.
 */
export class SchematicQaReportBuilder {
    static SCHEMA_ID = 'altium-toolkit.schematic.qa.a1'

    /**
     * Builds a schematic QA report from parsed records and geometry.
     * @param {{ records: object[], sheet?: object, lines?: object[], texts?: object[] }} input QA input.
     * @returns {object}
     */
    static build(input) {
        const records = input?.records || []
        const fonts = SchematicQaReportBuilder.#fonts(input?.sheet)
        const colors = SchematicQaReportBuilder.#colors(records)
        const lineWidths = SchematicQaReportBuilder.#lineWidths(records)
        const unresolvedParameters =
            SchematicQaReportBuilder.#unresolvedParameters(records)
        const titleBlockResidue =
            SchematicQaReportBuilder.#titleBlockResidue(records)
        const findings = [
            ...SchematicQaReportBuilder.#fontFindings(fonts),
            ...SchematicQaReportBuilder.#unresolvedFindings(
                unresolvedParameters
            ),
            ...SchematicQaReportBuilder.#titleBlockFindings(
                records,
                titleBlockResidue
            )
        ]

        return {
            schema: SchematicQaReportBuilder.SCHEMA_ID,
            summary: {
                recordCount: records.length,
                fontFamilyCount: fonts.families.length,
                colorCount: colors.values.length,
                lineWidthCount: lineWidths.values.length,
                unresolvedParameterCount: unresolvedParameters.length,
                findingCount: findings.length
            },
            fonts,
            colors,
            lineWidths,
            unresolvedParameters,
            titleBlockResidue,
            geometryFallbacks: SchematicQaReportBuilder.#geometryFallbacks(
                input?.texts
            ),
            fieldCoverage: SchematicFieldCoverageReportBuilder.build(records),
            findings
        }
    }

    /**
     * Summarizes sheet fonts.
     * @param {object | undefined} sheet Parsed sheet model.
     * @returns {{ families: string[], entries: object[] }}
     */
    static #fonts(sheet) {
        const entries = Object.entries(sheet?.fonts || {})
            .map(([fontId, font]) => ({
                fontId,
                family: String(font?.family || '').trim(),
                size: Number(font?.size || 0),
                bold: font?.bold === true,
                italic: font?.italic === true
            }))
            .filter((font) => font.family)
            .sort(
                (left, right) =>
                    left.family.localeCompare(right.family) ||
                    String(left.fontId).localeCompare(String(right.fontId))
            )

        return {
            families: [...new Set(entries.map((font) => font.family))],
            entries
        }
    }

    /**
     * Summarizes schematic colors.
     * @param {object[]} records Schematic records.
     * @returns {{ values: string[], records: object[] }}
     */
    static #colors(records) {
        const rows = []

        for (const record of records || []) {
            for (const key of ['Color', 'TextColor', 'AreaColor']) {
                if (!(key in (record.fields || {}))) {
                    continue
                }

                rows.push({
                    recordKey: SchematicQaReportBuilder.#recordKey(record),
                    field: key,
                    color: toColor(record.fields[key], '#000000')
                })
            }
        }

        return {
            values: [...new Set(rows.map((row) => row.color))].sort(),
            records: rows
        }
    }

    /**
     * Summarizes authored line widths.
     * @param {object[]} records Schematic records.
     * @returns {{ values: number[], records: object[] }}
     */
    static #lineWidths(records) {
        const rows = (records || [])
            .map((record) => ({
                recordKey: SchematicQaReportBuilder.#recordKey(record),
                width: parseNumericField(record.fields, 'LineWidth')
            }))
            .filter((row) => row.width !== null)

        return {
            values: [...new Set(rows.map((row) => row.width))].sort(
                (left, right) => left - right
            ),
            records: rows
        }
    }

    /**
     * Collects unresolved `=Parameter` placeholders.
     * @param {object[]} records Schematic records.
     * @returns {string[]}
     */
    static #unresolvedParameters(records) {
        const unresolved = []

        for (const record of records || []) {
            const text = SchematicQaReportBuilder.#displayText(record.fields)
            const match = text.match(/^=([A-Za-z_][\w.]*)$/)
            if (!match) {
                continue
            }
            unresolved.push(match[1])
        }

        return [...new Set(unresolved)].sort()
    }

    /**
     * Builds nonstandard-font findings.
     * @param {{ families: string[] }} fonts Font summary.
     * @returns {object[]}
     */
    static #fontFindings(fonts) {
        const preferred = new Set(['Arial', 'Times New Roman'])

        return (fonts.families || [])
            .filter((family) => !preferred.has(family))
            .map((family) => ({
                code: 'schematic.font.nonstandard-family',
                severity: 'info',
                family,
                message:
                    'Schematic uses a font family outside the default parser baseline.'
            }))
    }

    /**
     * Builds unresolved-parameter findings.
     * @param {string[]} parameters Unresolved parameters.
     * @returns {object[]}
     */
    static #unresolvedFindings(parameters) {
        return (parameters || []).map((parameter) => ({
            code: 'schematic.text.unresolved-parameter',
            severity: 'warning',
            parameter,
            message:
                'Schematic text contains an unresolved project or document parameter.'
        }))
    }

    /**
     * Builds title-block findings.
     * @param {object[]} records Schematic records.
     * @param {object[]} titleBlockResidue Hidden title-block residue rows.
     * @returns {object[]}
     */
    static #titleBlockFindings(records, titleBlockResidue) {
        const sheet = (records || []).find(
            (record) =>
                SchematicQaReportBuilder.#field(record.fields, 'RECORD') ===
                '31'
        )
        if (!sheet || parseBoolean(sheet.fields.TitleBlockOn)) {
            return []
        }

        return titleBlockResidue.length
            ? [
                  {
                      code: 'schematic.title-block.hidden-residue',
                      severity: 'info',
                      count: titleBlockResidue.length,
                      message:
                          'Hidden title-block parameter records remain while the title block is disabled.'
                  }
              ]
            : []
    }

    /**
     * Collects hidden title-block-like parameter rows.
     * @param {object[]} records Schematic records.
     * @returns {object[]}
     */
    static #titleBlockResidue(records) {
        const titleBlockNames = new Set([
            'title',
            'revision',
            'documentnumber',
            'sheetnumber',
            'sheettotal',
            'date',
            'drawnby'
        ])

        const residue = []

        for (const record of records || []) {
            const fields = record.fields || {}
            if (
                SchematicQaReportBuilder.#field(fields, 'RECORD') !== '41' ||
                !parseBoolean(
                    SchematicQaReportBuilder.#rawField(fields, 'IsHidden')
                )
            ) {
                continue
            }

            const name = SchematicQaReportBuilder.#field(fields, 'Name')
            if (!titleBlockNames.has(name.replace(/\s+/g, '').toLowerCase())) {
                continue
            }

            residue.push({
                recordKey: SchematicQaReportBuilder.#recordKey(record),
                name,
                value: SchematicQaReportBuilder.#displayText(fields)
            })
        }

        return residue
    }

    /**
     * Collects text geometry fallback diagnostics already attached by parsers.
     * @param {object[] | undefined} texts Parsed text rows.
     * @returns {object[]}
     */
    static #geometryFallbacks(texts) {
        return (texts || [])
            .filter((text) => text?.diagnosticState)
            .map((text, index) => ({
                key: 'schematic-text-' + index,
                state: text.diagnosticState,
                text: text.text || ''
            }))
    }

    /**
     * Builds a stable schematic record key.
     * @param {object} record Schematic record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }

    /**
     * Reads one common field without invoking generic field-cache bookkeeping.
     * @param {Record<string, string | string[]> | undefined} fields Record fields.
     * @param {string} key Requested key.
     * @returns {string}
     */
    static #field(fields, key) {
        return SchematicQaReportBuilder.#pickFieldValue(
            SchematicQaReportBuilder.#rawField(fields, key),
            false
        )
    }

    /**
     * Returns the best schematic display text without shared field-cache overhead.
     * @param {Record<string, string | string[]> | undefined} fields Record fields.
     * @returns {string}
     */
    static #displayText(fields) {
        return (
            SchematicQaReportBuilder.#pickFieldValue(
                SchematicQaReportBuilder.#rawField(fields, 'UTF8:Text'),
                true
            ) ||
            SchematicQaReportBuilder.#pickFieldValue(
                SchematicQaReportBuilder.#rawField(fields, 'Text'),
                true
            )
        )
    }

    /**
     * Reads one raw field from parsed records or simple fixture objects.
     * @param {Record<string, string | string[]> | undefined} fields Record fields.
     * @param {string} key Requested key.
     * @returns {string | string[] | undefined}
     */
    static #rawField(fields, key) {
        if (!fields || typeof fields !== 'object') {
            return undefined
        }

        const direct = fields[key]
        if (direct !== undefined) {
            return direct
        }

        const upperKey = key.toUpperCase()
        return upperKey === key ? undefined : fields[upperKey]
    }

    /**
     * Returns the last meaningful value from one field payload.
     * @param {string | string[] | undefined} raw Raw field payload.
     * @param {boolean} skipAsterisk Whether placeholder asterisks are ignored.
     * @returns {string}
     */
    static #pickFieldValue(raw, skipAsterisk) {
        if (!Array.isArray(raw)) {
            const value = String(raw || '').trim()
            return value && (!skipAsterisk || value !== '*') ? value : ''
        }

        for (let index = raw.length - 1; index >= 0; index -= 1) {
            const value = String(raw[index] || '').trim()
            if (value && (!skipAsterisk || value !== '*')) {
                return value
            }
        }

        return ''
    }
}
