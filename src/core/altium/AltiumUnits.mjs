// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Provides deterministic conversions for common Altium length units.
 */
export class AltiumUnits {
    static RAW_UNITS_PER_MIL = 10000

    static MM_PER_MIL = 0.0254

    static MIL_PER_INCH = 1000

    /**
     * Converts millimeters to mils.
     * @param {number} value Length in millimeters.
     * @returns {number}
     */
    static mmToMil(value) {
        return AltiumUnits.#round(Number(value) / AltiumUnits.MM_PER_MIL)
    }

    /**
     * Converts mils to millimeters.
     * @param {number} value Length in mils.
     * @returns {number}
     */
    static milToMm(value) {
        return AltiumUnits.#round(Number(value) * AltiumUnits.MM_PER_MIL)
    }

    /**
     * Converts inches to mils.
     * @param {number} value Length in inches.
     * @returns {number}
     */
    static inchToMil(value) {
        return AltiumUnits.#round(Number(value) * AltiumUnits.MIL_PER_INCH)
    }

    /**
     * Converts mils to inches.
     * @param {number} value Length in mils.
     * @returns {number}
     */
    static milToInch(value) {
        return AltiumUnits.#round(Number(value) / AltiumUnits.MIL_PER_INCH)
    }

    /**
     * Converts raw Altium coordinate units to mils.
     * @param {number} value Raw coordinate units.
     * @returns {number}
     */
    static rawToMil(value) {
        return AltiumUnits.#round(Number(value) / AltiumUnits.RAW_UNITS_PER_MIL)
    }

    /**
     * Converts mils to raw Altium coordinate units.
     * @param {number} value Length in mils.
     * @returns {number}
     */
    static milToRaw(value) {
        return AltiumUnits.#round(Number(value) * AltiumUnits.RAW_UNITS_PER_MIL)
    }

    /**
     * Parses one numeric or textual length into a deterministic unit bundle.
     * @param {unknown} value Length value.
     * @param {{ defaultUnit?: 'mil' | 'mm' | 'in' | 'raw' }} [options]
     * @returns {{ value: number, unit: string, mil: number, mm: number, inch: number, raw: number } | null}
     */
    static parseLength(value, options = {}) {
        const parsed = AltiumUnits.#parseNumericAndUnit(value, options)
        if (!parsed) return null

        const mil = AltiumUnits.#toMil(parsed.value, parsed.unit)
        if (!Number.isFinite(mil)) return null

        return {
            value: AltiumUnits.#round(parsed.value),
            unit: parsed.unit,
            mil: AltiumUnits.#round(mil),
            mm: AltiumUnits.milToMm(mil),
            inch: AltiumUnits.milToInch(mil),
            raw: AltiumUnits.milToRaw(mil)
        }
    }

    /**
     * Formats a mil value in the requested target unit.
     * @param {number} value Length in mils.
     * @param {'mil' | 'mm' | 'in' | 'raw'} [unit]
     * @returns {string}
     */
    static formatMil(value, unit = 'mil') {
        const mil = Number(value)
        if (!Number.isFinite(mil)) return ''

        const normalizedUnit = AltiumUnits.#normalizeUnit(unit)
        if (normalizedUnit === 'mm') {
            return AltiumUnits.#formatNumber(AltiumUnits.milToMm(mil)) + 'mm'
        }
        if (normalizedUnit === 'in') {
            return AltiumUnits.#formatNumber(AltiumUnits.milToInch(mil)) + 'in'
        }
        if (normalizedUnit === 'raw') {
            return AltiumUnits.#formatNumber(AltiumUnits.milToRaw(mil)) + 'raw'
        }
        return AltiumUnits.#formatNumber(mil) + 'mil'
    }

    /**
     * Parses an input value into a number and normalized unit token.
     * @param {unknown} value Length input.
     * @param {{ defaultUnit?: string }} options Parse options.
     * @returns {{ value: number, unit: 'mil' | 'mm' | 'in' | 'raw' } | null}
     */
    static #parseNumericAndUnit(value, options) {
        const defaultUnit = AltiumUnits.#normalizeUnit(
            options?.defaultUnit || 'mil'
        )

        if (typeof value === 'number') {
            return Number.isFinite(value) ? { value, unit: defaultUnit } : null
        }

        const text = String(value ?? '').trim()
        const match = text.match(
            /^([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)\s*([A-Za-z]*)$/u
        )
        if (!match) return null

        const numericValue = Number(match[1])
        if (!Number.isFinite(numericValue)) return null

        return {
            value: numericValue,
            unit: AltiumUnits.#normalizeUnit(match[2] || defaultUnit)
        }
    }

    /**
     * Converts one normalized length value to mils.
     * @param {number} value Numeric length.
     * @param {'mil' | 'mm' | 'in' | 'raw'} unit Length unit.
     * @returns {number}
     */
    static #toMil(value, unit) {
        if (unit === 'mm') return AltiumUnits.mmToMil(value)
        if (unit === 'in') return AltiumUnits.inchToMil(value)
        if (unit === 'raw') return AltiumUnits.rawToMil(value)
        return Number(value)
    }

    /**
     * Normalizes one unit label.
     * @param {unknown} unit Unit label.
     * @returns {'mil' | 'mm' | 'in' | 'raw'}
     */
    static #normalizeUnit(unit) {
        const normalized = String(unit || '')
            .trim()
            .toLowerCase()
        if (
            normalized === 'mm' ||
            normalized === 'millimeter' ||
            normalized === 'millimeters'
        ) {
            return 'mm'
        }
        if (
            normalized === 'in' ||
            normalized === 'inch' ||
            normalized === 'inches'
        ) {
            return 'in'
        }
        if (normalized === 'raw') {
            return 'raw'
        }
        return 'mil'
    }

    /**
     * Formats a number without unstable floating-point tails.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #formatNumber(value) {
        return String(AltiumUnits.#round(value))
    }

    /**
     * Rounds a numeric value to stable JSON/report precision.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? Number(numeric.toFixed(9)) : numeric
    }
}
