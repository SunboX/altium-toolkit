// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { LibraryCompatibilityGeometry } from './LibraryCompatibilityGeometry.mjs'
import { LibraryCompatibilityModelHintBuilder } from './LibraryCompatibilityModelHintBuilder.mjs'

/**
 * Builds source-neutral compatibility diagnostics for parsed library models.
 */
export class LibraryCompatibilityReportBuilder {
    static SCHEMA_ID = 'altium-toolkit.library.compatibility.a1'

    /**
     * Builds a read-only compatibility report.
     * @param {{ schematicLibraries?: object[], pcbLibraries?: object[] }} options Library collections.
     * @returns {object}
     */
    static build(options = {}) {
        const schematicLibraries = Array.isArray(options.schematicLibraries)
            ? options.schematicLibraries
            : []
        const pcbLibraries = Array.isArray(options.pcbLibraries)
            ? options.pcbLibraries
            : []
        const symbolPins =
            LibraryCompatibilityReportBuilder.#symbolPinRows(schematicLibraries)
        const hiddenPins = symbolPins
            .filter((pin) => pin.hidden)
            .map((pin) => LibraryCompatibilityReportBuilder.#hiddenPinRow(pin))
        const symbolBounds =
            LibraryCompatibilityReportBuilder.#symbolBoundsRows(
                schematicLibraries
            )
        const fieldPlacementRisks =
            LibraryCompatibilityReportBuilder.#fieldPlacementRisks(
                schematicLibraries,
                symbolBounds
            )
        const footprintBounds =
            LibraryCompatibilityReportBuilder.#footprintBoundsRows(pcbLibraries)
        const padDiagnostics =
            LibraryCompatibilityReportBuilder.#padDiagnostics(pcbLibraries)
        const modelSuggestions =
            LibraryCompatibilityModelHintBuilder.build(pcbLibraries)
        const issues = [
            ...hiddenPins.map((pin) =>
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.hidden-pin',
                    severity: 'info',
                    target:
                        pin.symbolName +
                        ':' +
                        (pin.designator || pin.name || 'hidden'),
                    libraryFileName: pin.libraryFileName,
                    symbolName: pin.symbolName,
                    designator: pin.designator,
                    name: pin.name,
                    partId: pin.partId,
                    placementHint: pin.placementHint,
                    reason: pin.reason
                })
            ),
            ...fieldPlacementRisks,
            ...padDiagnostics,
            ...modelSuggestions.map((suggestion) =>
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.model-name-suggestion',
                    severity: 'info',
                    target: suggestion.footprintName,
                    libraryFileName: suggestion.libraryFileName,
                    footprintName: suggestion.footprintName,
                    packageClass: suggestion.packageClass,
                    keys: suggestion.keys,
                    pinOneDesignator: suggestion.pinOneDesignator,
                    pinOnePosition: suggestion.pinOnePosition,
                    rotationHint: suggestion.rotationHint,
                    reason: suggestion.reason
                })
            )
        ]

        return {
            schema: LibraryCompatibilityReportBuilder.SCHEMA_ID,
            summary: LibraryCompatibilityReportBuilder.#summary(
                schematicLibraries,
                pcbLibraries,
                symbolPins,
                hiddenPins,
                symbolBounds,
                fieldPlacementRisks,
                footprintBounds,
                padDiagnostics,
                modelSuggestions,
                issues
            ),
            symbolPins,
            hiddenPins,
            symbolBounds,
            fieldPlacementRisks,
            footprintBounds,
            padDiagnostics,
            modelSuggestions,
            issues
        }
    }

    /**
     * Builds top-level report counters.
     * @param {object[]} schematicLibraries Schematic library models.
     * @param {object[]} pcbLibraries PCB library models.
     * @param {object[]} symbolPins Symbol pin rows.
     * @param {object[]} hiddenPins Hidden pin rows.
     * @param {object[]} symbolBounds Symbol bounds rows.
     * @param {object[]} fieldPlacementRisks Field placement risk rows.
     * @param {object[]} footprintBounds Footprint bounds rows.
     * @param {object[]} padDiagnostics Pad diagnostic rows.
     * @param {object[]} modelSuggestions Model suggestion rows.
     * @param {object[]} issues Flattened issue rows.
     * @returns {object}
     */
    static #summary(
        schematicLibraries,
        pcbLibraries,
        symbolPins,
        hiddenPins,
        symbolBounds,
        fieldPlacementRisks,
        footprintBounds,
        padDiagnostics,
        modelSuggestions,
        issues
    ) {
        return {
            schematicLibraryCount: schematicLibraries.length,
            pcbLibraryCount: pcbLibraries.length,
            symbolPinCount: symbolPins.length,
            hiddenPinCount: hiddenPins.length,
            symbolBoundsCount: symbolBounds.length,
            fieldPlacementRiskCount: fieldPlacementRisks.length,
            footprintBoundsCount: footprintBounds.length,
            padDiagnosticCount: padDiagnostics.length,
            modelSuggestionCount: modelSuggestions.length,
            issuesBySeverity:
                LibraryCompatibilityReportBuilder.#issueSeverityCounts(issues),
            issueCount: issues.length
        }
    }

    /**
     * Builds normalized pin rows for schematic library symbols.
     * @param {object[]} schematicLibraries Schematic library models.
     * @returns {object[]}
     */
    static #symbolPinRows(schematicLibraries) {
        const rows = []

        for (const library of schematicLibraries || []) {
            const libraryFileName = String(library?.fileName || '')
            for (const symbol of library?.schematicLibrary?.symbols || []) {
                const symbolName = String(symbol?.name || '')
                for (const pin of symbol?.pins || []) {
                    const hidden =
                        Boolean(pin?.hidden) || Boolean(pin?.isHidden)
                    const row = LibraryCompatibilityReportBuilder.#stripEmpty({
                        libraryFileName,
                        symbolName,
                        designator: pin?.designator,
                        name: pin?.name,
                        partId: pin?.partId,
                        electricalRole:
                            LibraryCompatibilityReportBuilder.#electricalRole(
                                pin?.electricalType ?? pin?.electrical
                            ),
                        edgeShape:
                            LibraryCompatibilityReportBuilder.#edgeShape(pin),
                        hidden,
                        labelVisibility: hidden ? 'hidden' : 'visible',
                        ...(hidden
                            ? {
                                  placementHint:
                                      LibraryCompatibilityReportBuilder.#hiddenPinPlacementHint(
                                          pin
                                      )
                              }
                            : {})
                    })
                    rows.push(row)
                }
            }
        }

        return rows
    }

    /**
     * Builds one hidden pin metadata row.
     * @param {object} pin Normalized symbol pin row.
     * @returns {object}
     */
    static #hiddenPinRow(pin) {
        return LibraryCompatibilityReportBuilder.#stripEmpty({
            libraryFileName: pin.libraryFileName,
            symbolName: pin.symbolName,
            designator: pin.designator,
            name: pin.name,
            partId: pin.partId,
            placementHint: pin.placementHint,
            reason:
                pin.placementHint === 'top'
                    ? 'hidden pin carries a power-oriented label'
                    : 'hidden pin carries a reference-oriented label'
        })
    }

    /**
     * Resolves one pin electrical role.
     * @param {unknown} value Raw electrical type.
     * @returns {string}
     */
    static #electricalRole(value) {
        const text = String(value ?? '')
            .trim()
            .toLowerCase()
        const numericRoles = new Map([
            ['0', 'input'],
            ['1', 'bidirectional'],
            ['2', 'output'],
            ['3', 'open-collector'],
            ['4', 'passive'],
            ['5', 'high-impedance'],
            ['6', 'open-emitter'],
            ['7', 'power']
        ])
        const textRoles = new Map([
            ['input', 'input'],
            ['bidirectional', 'bidirectional'],
            ['i/o', 'bidirectional'],
            ['io', 'bidirectional'],
            ['output', 'output'],
            ['open collector', 'open-collector'],
            ['opencollector', 'open-collector'],
            ['passive', 'passive'],
            ['hiz', 'high-impedance'],
            ['high impedance', 'high-impedance'],
            ['open emitter', 'open-emitter'],
            ['openemitter', 'open-emitter'],
            ['power', 'power'],
            ['powerin', 'power'],
            ['powerout', 'power']
        ])

        return numericRoles.get(text) || textRoles.get(text) || 'unknown'
    }

    /**
     * Resolves one decorative pin edge shape.
     * @param {object} pin Source pin row.
     * @returns {string}
     */
    static #edgeShape(pin) {
        const inner = LibraryCompatibilityReportBuilder.#edgeToken(
            pin?.symbolInner ?? pin?.symbolInside
        )
        const outer = LibraryCompatibilityReportBuilder.#edgeToken(
            pin?.symbolOuter ?? pin?.symbolOutside
        )

        if (inner === 'clock' && outer === 'dot') return 'inverted-clock'
        if (inner === 'clock' && outer === 'low-input') return 'low-clock'
        if (inner === 'clock') return 'clock'
        if (outer === 'logic-not') return 'logic-not'
        if (outer === 'dot') return 'inverted'
        if (outer === 'low-input') return 'low-input'
        if (outer === 'low-output') return 'low-output'

        return 'line'
    }

    /**
     * Normalizes one symbolic pin-edge token.
     * @param {unknown} value Raw edge value.
     * @returns {string}
     */
    static #edgeToken(value) {
        const text = String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/[_\s]+/gu, '-')
        const numeric = new Map([
            ['1', 'dot'],
            ['3', 'clock'],
            ['4', 'low-input'],
            ['6', 'logic-not'],
            ['17', 'low-output']
        ])
        const aliases = new Map([
            ['invert', 'dot'],
            ['inverted', 'dot'],
            ['dot', 'dot'],
            ['clock', 'clock'],
            ['lowinput', 'low-input'],
            ['low-input', 'low-input'],
            ['lowoutput', 'low-output'],
            ['low-output', 'low-output'],
            ['logicnot', 'logic-not'],
            ['logic-not', 'logic-not']
        ])

        return numeric.get(text) || aliases.get(text) || ''
    }

    /**
     * Resolves a hidden pin placement hint from its label.
     * @param {object} pin Source pin row.
     * @returns {'top' | 'bottom'}
     */
    static #hiddenPinPlacementHint(pin) {
        const name = String(pin?.name || pin?.designator || '')
            .trim()
            .toUpperCase()

        if (/^(VCC|VDD|V\+|VBAT|VIN|AVDD|DVDD|PVDD)$/u.test(name)) {
            return 'top'
        }

        return 'bottom'
    }

    /**
     * Builds one bounds row per bounded schematic library symbol.
     * @param {object[]} schematicLibraries Schematic library models.
     * @returns {object[]}
     */
    static #symbolBoundsRows(schematicLibraries) {
        const rows = []

        for (const library of schematicLibraries || []) {
            const libraryFileName = String(library?.fileName || '')
            for (const symbol of library?.schematicLibrary?.symbols || []) {
                const bounds = LibraryCompatibilityGeometry.symbolBounds(symbol)
                if (!bounds) continue

                rows.push({
                    libraryFileName,
                    symbolName: String(symbol?.name || ''),
                    ...bounds
                })
            }
        }

        return rows
    }

    /**
     * Builds visible field-placement risk rows for bounded symbols.
     * @param {object[]} schematicLibraries Schematic library models.
     * @param {object[]} symbolBounds Symbol bounds rows.
     * @returns {object[]}
     */
    static #fieldPlacementRisks(schematicLibraries, symbolBounds) {
        const boundsBySymbol = new Map(
            symbolBounds.map((row) => [
                LibraryCompatibilityReportBuilder.#symbolKey(
                    row.libraryFileName,
                    row.symbolName
                ),
                row.bounds
            ])
        )
        const rows = []

        for (const library of schematicLibraries || []) {
            const libraryFileName = String(library?.fileName || '')
            for (const symbol of library?.schematicLibrary?.symbols || []) {
                const symbolName = String(symbol?.name || '')
                const bounds = boundsBySymbol.get(
                    LibraryCompatibilityReportBuilder.#symbolKey(
                        libraryFileName,
                        symbolName
                    )
                )
                if (!bounds) continue

                for (const field of symbol?.texts || []) {
                    const fieldName = String(field?.name || field?.t || '')
                    if (
                        !LibraryCompatibilityReportBuilder.#fieldCanAffectPlacement(
                            field,
                            fieldName
                        )
                    ) {
                        continue
                    }

                    const position =
                        LibraryCompatibilityReportBuilder.#point(field)
                    if (
                        position &&
                        LibraryCompatibilityReportBuilder.#pointInsideBounds(
                            position,
                            bounds
                        )
                    ) {
                        rows.push(
                            LibraryCompatibilityReportBuilder.#issue({
                                code: 'library.compatibility.symbol-field-inside-bounds',
                                severity: 'warning',
                                target: symbolName + ':' + fieldName,
                                libraryFileName,
                                symbolName,
                                fieldName,
                                fieldText: field?.text ?? field?.value,
                                position,
                                reason: 'visible symbol field is placed inside the symbol bounds'
                            })
                        )
                    }
                }
            }
        }

        return rows
    }

    /**
     * Builds a stable symbol lookup key.
     * @param {string} libraryFileName Source library file name.
     * @param {string} symbolName Symbol name.
     * @returns {string}
     */
    static #symbolKey(libraryFileName, symbolName) {
        return libraryFileName + '\u0000' + symbolName
    }

    /**
     * Returns true when a visible field can affect deterministic field
     * placement.
     * @param {object} field Field row.
     * @param {string} fieldName Field name.
     * @returns {boolean}
     */
    static #fieldCanAffectPlacement(field, fieldName) {
        if (field?.hidden || field?.isHidden) return false

        return ['designator', 'comment', 'value'].includes(
            String(fieldName || '').toLowerCase()
        )
    }

    /**
     * Returns one finite point from a row with x/y fields.
     * @param {object} value Candidate row.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        const x = LibraryCompatibilityReportBuilder.#finiteNumber(value?.x)
        const y = LibraryCompatibilityReportBuilder.#finiteNumber(value?.y)

        if (x === null || y === null) return null

        return { x, y }
    }

    /**
     * Returns true when a point is inside normalized bounds.
     * @param {{ x: number, y: number }} point Point row.
     * @param {object} bounds Bounds row.
     * @returns {boolean}
     */
    static #pointInsideBounds(point, bounds) {
        return (
            point.x >= Number(bounds.minX) &&
            point.x <= Number(bounds.maxX) &&
            point.y >= Number(bounds.minY) &&
            point.y <= Number(bounds.maxY)
        )
    }

    /**
     * Builds one bounds row per bounded footprint.
     * @param {object[]} pcbLibraries PCB library models.
     * @returns {object[]}
     */
    static #footprintBoundsRows(pcbLibraries) {
        const rows = []

        for (const library of pcbLibraries || []) {
            const libraryFileName = String(library?.fileName || '')
            for (const footprint of library?.pcbLibrary?.footprints || []) {
                const bounds =
                    LibraryCompatibilityReportBuilder.#footprintBounds(
                        footprint
                    )
                if (!bounds) continue

                rows.push({
                    libraryFileName,
                    footprintName: String(footprint?.name || ''),
                    bounds,
                    courtyard: LibraryCompatibilityGeometry.courtyard(bounds),
                    sourceCounts:
                        LibraryCompatibilityGeometry.sourceCounts(footprint)
                })
            }
        }

        return rows
    }

    /**
     * Computes merged footprint bounds.
     * @param {object} footprint Footprint row.
     * @returns {object | null}
     */
    static #footprintBounds(footprint) {
        return LibraryCompatibilityGeometry.footprintBounds(footprint)
    }

    /**
     * Builds pad diagnostics across PCB libraries.
     * @param {object[]} pcbLibraries PCB library models.
     * @returns {object[]}
     */
    static #padDiagnostics(pcbLibraries) {
        const diagnostics = []

        for (const library of pcbLibraries || []) {
            const libraryFileName = String(library?.fileName || '')
            for (const footprint of library?.pcbLibrary?.footprints || []) {
                const footprintName = String(footprint?.name || '')
                for (const pad of footprint?.pads || []) {
                    diagnostics.push(
                        ...LibraryCompatibilityReportBuilder.#padDiagnosticRows(
                            libraryFileName,
                            footprintName,
                            pad
                        )
                    )
                }
            }
        }

        return diagnostics
    }

    /**
     * Builds diagnostics for one pad row.
     * @param {string} libraryFileName Source library file name.
     * @param {string} footprintName Footprint name.
     * @param {object} pad Pad row.
     * @returns {object[]}
     */
    static #padDiagnosticRows(libraryFileName, footprintName, pad) {
        const rows = []
        const target =
            footprintName + ':' + String(pad?.designator || rows.length)
        const top = {
            width: LibraryCompatibilityReportBuilder.#finiteNumber(
                pad?.sizeTopX
            ),
            height: LibraryCompatibilityReportBuilder.#finiteNumber(
                pad?.sizeTopY
            )
        }
        const bottom = {
            width: LibraryCompatibilityReportBuilder.#finiteNumber(
                pad?.sizeBottomX
            ),
            height: LibraryCompatibilityReportBuilder.#finiteNumber(
                pad?.sizeBottomY
            )
        }

        if (
            top.width !== null &&
            top.height !== null &&
            bottom.width !== null &&
            bottom.height !== null &&
            (top.width !== bottom.width || top.height !== bottom.height)
        ) {
            rows.push(
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.pad-top-bottom-size-mismatch',
                    severity: 'warning',
                    target,
                    libraryFileName,
                    footprintName,
                    padDesignator: pad?.designator,
                    top,
                    bottom,
                    reason: 'top and bottom pad sizes differ'
                })
            )
        }

        if (
            LibraryCompatibilityReportBuilder.#hasExplicitPadSize(pad) &&
            (!LibraryCompatibilityReportBuilder.#padWidth(pad) ||
                !LibraryCompatibilityReportBuilder.#padHeight(pad))
        ) {
            rows.push(
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.pad-zero-size',
                    severity: 'warning',
                    target,
                    libraryFileName,
                    footprintName,
                    padDesignator: pad?.designator,
                    reason: 'pad has an explicit zero width or height'
                })
            )
        }

        const unknownShape =
            LibraryCompatibilityReportBuilder.#unknownPadShape(pad)
        if (unknownShape) {
            rows.push(
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.pad-unknown-shape',
                    severity: 'warning',
                    target,
                    libraryFileName,
                    footprintName,
                    padDesignator: pad?.designator,
                    shape: unknownShape,
                    reason: 'pad uses an unknown shape code'
                })
            )
        }

        if (
            LibraryCompatibilityReportBuilder.#hasExplicitPadSize(pad) &&
            (pad?.layerId === null || pad?.layerId === undefined)
        ) {
            rows.push(
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.pad-unknown-layer',
                    severity: 'warning',
                    target,
                    libraryFileName,
                    footprintName,
                    padDesignator: pad?.designator,
                    reason: 'pad has geometry but no resolved layer id'
                })
            )
        }

        rows.push(
            ...LibraryCompatibilityReportBuilder.#customPadDiagnosticRows(
                libraryFileName,
                footprintName,
                pad,
                target
            )
        )

        return rows
    }

    /**
     * Builds custom-pad shape diagnostics for one pad.
     * @param {string} libraryFileName Source library file name.
     * @param {string} footprintName Footprint name.
     * @param {object} pad Pad row.
     * @param {string} target Issue target.
     * @returns {object[]}
     */
    static #customPadDiagnosticRows(
        libraryFileName,
        footprintName,
        pad,
        target
    ) {
        const rows = []
        const layers = Array.isArray(pad?.customShape?.layers)
            ? pad.customShape.layers
            : []
        if (!layers.length) return rows

        const sideBounds = new Map()

        for (const layer of layers) {
            const bounds =
                LibraryCompatibilityGeometry.customShapeLayerBounds(layer)
            const side =
                LibraryCompatibilityReportBuilder.#customShapeSide(layer)

            if (bounds) {
                rows.push(
                    LibraryCompatibilityReportBuilder.#issue({
                        code: 'library.compatibility.pad-custom-shape-outline',
                        severity: 'info',
                        target,
                        libraryFileName,
                        footprintName,
                        padDesignator: pad?.designator,
                        layer: layer?.layer,
                        layerId: layer?.layerId,
                        bounds,
                        reason: 'pad uses custom outline geometry'
                    })
                )
                if (side) sideBounds.set(side, bounds)
            } else {
                rows.push(
                    LibraryCompatibilityReportBuilder.#issue({
                        code: 'library.compatibility.pad-custom-shape-missing-geometry',
                        severity: 'warning',
                        target,
                        libraryFileName,
                        footprintName,
                        padDesignator: pad?.designator,
                        layer: layer?.layer,
                        layerId: layer?.layerId,
                        reason: 'custom pad shape layer has no resolved geometry'
                    })
                )
            }

            if (LibraryCompatibilityGeometry.hasZeroArea(bounds)) {
                rows.push(
                    LibraryCompatibilityReportBuilder.#issue({
                        code: 'library.compatibility.pad-custom-shape-zero-area',
                        severity: 'warning',
                        target,
                        libraryFileName,
                        footprintName,
                        padDesignator: pad?.designator,
                        layer: layer?.layer,
                        layerId: layer?.layerId,
                        bounds,
                        reason: 'custom pad shape outline has zero area'
                    })
                )
            }
        }

        const topBounds = sideBounds.get('top') || null
        const bottomBounds = sideBounds.get('bottom') || null
        if (
            (topBounds || bottomBounds) &&
            !LibraryCompatibilityGeometry.sameBounds(topBounds, bottomBounds)
        ) {
            rows.push(
                LibraryCompatibilityReportBuilder.#issue({
                    code: 'library.compatibility.pad-custom-shape-side-asymmetry',
                    severity: 'warning',
                    target,
                    libraryFileName,
                    footprintName,
                    padDesignator: pad?.designator,
                    topBounds,
                    bottomBounds,
                    reason: 'custom pad shape top and bottom outlines differ'
                })
            )
        }

        return rows
    }

    /**
     * Resolves one custom-shape layer side.
     * @param {object} layer Custom-shape layer row.
     * @returns {'top' | 'bottom' | ''}
     */
    static #customShapeSide(layer) {
        const layerId = Number(layer?.layerId)
        const layerText = String(layer?.layer || '').toLowerCase()

        if (layerId === 1 || /\b(top|f\.cu|front)\b/u.test(layerText)) {
            return 'top'
        }
        if (
            layerId === 32 ||
            layerId === 74 ||
            /\b(bottom|b\.cu|back)\b/u.test(layerText)
        ) {
            return 'bottom'
        }

        return ''
    }

    /**
     * Finds the first unknown pad shape label.
     * @param {object} pad Pad row.
     * @returns {string | null}
     */
    static #unknownPadShape(pad) {
        const shapes = [
            pad?.shapeTopName,
            pad?.shapeMidName,
            pad?.shapeBottomName,
            pad?.padShapeNames?.top,
            pad?.padShapeNames?.middle,
            pad?.padShapeNames?.bottom
        ]
            .map((shape) => String(shape || ''))
            .filter(Boolean)

        return shapes.find((shape) => shape.startsWith('unknown-')) || null
    }

    /**
     * Returns true when a pad exposes explicit size fields.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasExplicitPadSize(pad) {
        return [
            pad?.sizeTopX,
            pad?.sizeTopY,
            pad?.sizeMidX,
            pad?.sizeMidY,
            pad?.sizeBottomX,
            pad?.sizeBottomY
        ].some((value) => value !== null && value !== undefined)
    }

    /**
     * Resolves the effective pad width.
     * @param {object} pad Pad row.
     * @returns {number | null}
     */
    static #padWidth(pad) {
        return LibraryCompatibilityReportBuilder.#maxPositive([
            pad?.sizeTopX,
            pad?.sizeMidX,
            pad?.sizeBottomX,
            ...(pad?.padStack?.layers || []).map((layer) => layer?.width),
            ...(pad?.localPadStack?.layers || []).map((layer) => layer?.width)
        ])
    }

    /**
     * Resolves the effective pad height.
     * @param {object} pad Pad row.
     * @returns {number | null}
     */
    static #padHeight(pad) {
        return LibraryCompatibilityReportBuilder.#maxPositive([
            pad?.sizeTopY,
            pad?.sizeMidY,
            pad?.sizeBottomY,
            ...(pad?.padStack?.layers || []).map((layer) => layer?.height),
            ...(pad?.localPadStack?.layers || []).map((layer) => layer?.height)
        ])
    }

    /**
     * Finds the largest finite absolute value from a list.
     * @param {unknown[]} values Candidate values.
     * @returns {number | null}
     */
    static #maxPositive(values) {
        const finiteValues = (values || [])
            .map((value) =>
                LibraryCompatibilityReportBuilder.#finiteNumber(value)
            )
            .filter((value) => value !== null)
            .map((value) => Math.abs(value))

        if (!finiteValues.length) return null
        return Math.max(...finiteValues)
    }

    /**
     * Converts one value to a finite number.
     * @param {unknown} value Candidate number.
     * @returns {number | null}
     */
    static #finiteNumber(value) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : null
    }

    /**
     * Rounds floating-point report values.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        return Number(Number(value).toFixed(6))
    }

    /**
     * Builds one issue row.
     * @param {object} issue Issue fields.
     * @returns {object}
     */
    static #issue(issue) {
        return LibraryCompatibilityReportBuilder.#stripEmpty(issue)
    }

    /**
     * Counts issues by severity.
     * @param {object[]} issues Issue rows.
     * @returns {{ error: number, warning: number, info: number }}
     */
    static #issueSeverityCounts(issues) {
        const counts = { error: 0, warning: 0, info: 0 }

        for (const issue of issues || []) {
            const severity = String(issue?.severity || 'warning').toLowerCase()
            if (Object.prototype.hasOwnProperty.call(counts, severity)) {
                counts[severity] += 1
            } else {
                counts.warning += 1
            }
        }

        return counts
    }

    /**
     * Removes undefined and empty string fields from an object.
     * @param {object} value Source row.
     * @returns {object}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) =>
                    entryValue !== undefined && entryValue !== ''
            )
        )
    }
}
