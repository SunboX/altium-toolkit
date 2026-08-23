// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from '../core/altium/ParserUtils.mjs'
import { SchematicTypography } from '../ui/SchematicTypography.mjs'
import { SchematicRotatedOwnerTextPlacement } from '../ui/SchematicRotatedOwnerTextPlacement.mjs'

const PRIMITIVE_FAMILIES = Object.freeze([
    'lines',
    'polygons',
    'rectangles',
    'roundedRectangles',
    'ellipses',
    'arcs',
    'pies'
])

/**
 * Repairs render-only schematic fidelity from the native ownership sidecar
 * without changing the preserved historical parser or renderer contracts.
 */
export class AltiumSchematicFidelityNormalizer {
    /**
     * Builds a shallow normalized view for convergence rendering.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @returns {Record<string, any>} Fidelity-normalized render document.
     */
    static normalize(documentModel) {
        const schematic = documentModel?.schematic
        if (!schematic) return documentModel

        const records = schematic.ownership?.records || []
        const sheet = AltiumSchematicFidelityNormalizer.#normalizeSheet(
            schematic,
            records
        )
        const ownerBounds =
            AltiumSchematicFidelityNormalizer.#collectOwnerBounds(schematic)
        const footerTexts =
            AltiumSchematicFidelityNormalizer.#resolveFooterTexts(
                schematic.texts || [],
                records,
                sheet
            )
        const texts = AltiumSchematicFidelityNormalizer.#placeOwnerTexts(
            footerTexts,
            ownerBounds
        ).filter((text) => String(text?.recordType || '') !== '217')
        const harnesses = AltiumSchematicFidelityNormalizer.#normalizeHarnesses(
            schematic.harnesses,
            records
        )

        if (
            sheet === schematic.sheet &&
            texts === schematic.texts &&
            harnesses === schematic.harnesses
        ) {
            return documentModel
        }

        return {
            ...documentModel,
            schematic: {
                ...schematic,
                sheet,
                texts,
                ...(harnesses ? { harnesses } : {})
            }
        }
    }

    /**
     * Restores a proven embedded native frame from source sheet dimensions.
     * @param {Record<string, any>} schematic Native schematic model.
     * @param {Record<string, any>[]} records Ownership records.
     * @returns {Record<string, any>} Original or normalized sheet.
     */
    static #normalizeSheet(schematic, records) {
        const sheet = schematic.sheet || {}
        const sourceWidth = Number(sheet.sourceWidth || 0)
        const sourceHeight = Number(sheet.sourceHeight || 0)
        const margin = Math.max(Number(sheet.marginWidth || 20), 20)
        const sheetRecord = records.find(
            (record) =>
                AltiumSchematicFidelityNormalizer.#recordType(record) === '31'
        )
        const sheetStyle = Number(
            AltiumSchematicFidelityNormalizer.#field(
                sheetRecord?.fields,
                'SheetStyle'
            ) || 0
        )

        if (
            sheetStyle !== 1 ||
            !sheet.borderOn ||
            !sheet.paperSize ||
            sourceWidth <= margin * 2 ||
            sourceHeight <= margin * 2 ||
            Number(sheet.width) >= Number(sheet.height) !==
                sourceWidth >= sourceHeight ||
            !AltiumSchematicFidelityNormalizer.#hasNativeFrameEdge(
                schematic,
                sourceWidth,
                sourceHeight,
                margin
            )
        ) {
            return sheet
        }

        if (
            Number(sheet.width) === sourceWidth &&
            Number(sheet.height) === sourceHeight
        ) {
            return sheet
        }

        return {
            ...sheet,
            width: sourceWidth,
            height: sourceHeight,
            sourceWidth,
            sourceHeight
        }
    }

    /**
     * Returns true when owner chrome reaches the stored native frame edge and
     * all authored geometry remains inside that frame.
     * @param {Record<string, any>} schematic Native schematic model.
     * @param {number} sourceWidth Stored sheet width.
     * @param {number} sourceHeight Stored sheet height.
     * @param {number} margin Sheet margin.
     * @returns {boolean} Whether the source frame is structurally proven.
     */
    static #hasNativeFrameEdge(schematic, sourceWidth, sourceHeight, margin) {
        const primitives = PRIMITIVE_FAMILIES.flatMap(
            (family) => schematic[family] || []
        )
        const bounds = primitives
            .map((primitive) => ({
                ownerIndex: String(primitive?.ownerIndex || '').trim(),
                bounds: AltiumSchematicFidelityNormalizer.#bounds(primitive)
            }))
            .filter((entry) => entry.bounds)
        const frameEdge = sourceWidth - margin

        return (
            bounds.some(
                (entry) =>
                    entry.ownerIndex &&
                    Math.abs(entry.bounds.maxX - frameEdge) <= 0.01
            ) &&
            bounds.every(
                (entry) =>
                    entry.bounds.maxX <= sourceWidth - margin + 0.01 &&
                    entry.bounds.maxY <= sourceHeight - margin + 0.01
            )
        )
    }

    /**
     * Resolves every text placeholder in a native footer owner group.
     * @param {Record<string, any>[]} texts Normalized visible texts.
     * @param {Record<string, any>[]} records Ownership records.
     * @param {Record<string, any>} sheet Normalized sheet.
     * @returns {Record<string, any>[]} Original or resolved texts.
     */
    static #resolveFooterTexts(texts, records, sheet) {
        const metadata = new Map()
        for (const record of records) {
            if (AltiumSchematicFidelityNormalizer.#owner(record)) continue
            const name = AltiumSchematicFidelityNormalizer.#field(
                record.fields,
                'Name'
            )
            const value = AltiumSchematicFidelityNormalizer.#field(
                record.fields,
                'Text'
            )
            if (name && value) {
                metadata.set(name.toLowerCase(), value)
            }
        }

        const footerOwners = new Set(
            records
                .filter((record) =>
                    AltiumSchematicFidelityNormalizer.#isFooterSeedRecord(
                        record,
                        sheet
                    )
                )
                .map((record) =>
                    AltiumSchematicFidelityNormalizer.#owner(record)
                )
                .filter(Boolean)
        )
        if (!footerOwners.size || !metadata.size) return texts

        let changed = false
        const resolvedTexts = texts.map((text) => {
            const sourceText = String(text?.text || '').trim()
            if (
                !footerOwners.has(String(text?.ownerIndex || '').trim()) ||
                !sourceText.startsWith('=')
            ) {
                return text
            }

            const replacement = metadata.get(sourceText.slice(1).toLowerCase())
            if (!replacement) return text

            changed = true
            return { ...text, text: replacement }
        })

        return changed ? resolvedTexts : texts
    }

    /**
     * Returns true when an ownership record seeds the lower-right footer.
     * @param {Record<string, any>} record Ownership record.
     * @param {Record<string, any>} sheet Sheet metadata.
     * @returns {boolean} Whether the record belongs to a footer owner.
     */
    static #isFooterSeedRecord(record, sheet) {
        if (AltiumSchematicFidelityNormalizer.#recordType(record) !== '4') {
            return false
        }

        const x = Number(
            AltiumSchematicFidelityNormalizer.#field(
                record.fields,
                'Location.X'
            )
        )
        const y = Number(
            AltiumSchematicFidelityNormalizer.#field(
                record.fields,
                'Location.Y'
            )
        )

        return (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            x >= Number(sheet?.width || 0) * 0.55 &&
            y <= 100
        )
    }

    /**
     * Moves right-side vertical component parameters clear of owner bodies.
     * @param {Record<string, any>[]} texts Schematic text rows.
     * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} ownerBounds Owner bounds.
     * @returns {Record<string, any>[]} Original or placed texts.
     */
    static #placeOwnerTexts(texts, ownerBounds) {
        let changed = false
        const placedTexts = texts.map((text) => {
            const viewerFontSize =
                SchematicTypography.resolveViewerFontSize(text?.fontSize) || 0
            const x = SchematicRotatedOwnerTextPlacement.resolveX(
                text,
                text?.x,
                viewerFontSize,
                ownerBounds
            )
            if (x === Number(text?.x)) return text

            changed = true
            return { ...text, x }
        })

        return changed ? placedTexts : texts
    }

    /**
     * Completes harness child ownership from explicit and additional-list rows.
     * @param {Record<string, any> | null | undefined} harnesses Harness model.
     * @param {Record<string, any>[]} records Ownership records.
     * @returns {Record<string, any> | null | undefined} Completed harness model.
     */
    static #normalizeHarnesses(harnesses, records) {
        if (!harnesses?.connectors?.length) return harnesses

        let changed = false
        const connectors = harnesses.connectors.map((connector) => {
            const connectorRecord = records.find(
                (record) =>
                    record.key === connector.recordKey ||
                    String(record.recordId || '') ===
                        String(connector.recordId || '')
            )
            if (!connectorRecord) return connector

            const children = AltiumSchematicFidelityNormalizer.#harnessChildren(
                connectorRecord,
                records
            )
            const entryRecords = children.filter(
                (record) =>
                    AltiumSchematicFidelityNormalizer.#recordType(record) ===
                    '216'
            )
            const typeRecord = children.find(
                (record) =>
                    AltiumSchematicFidelityNormalizer.#recordType(record) ===
                    '217'
            )
            if (!entryRecords.length && !typeRecord) return connector

            changed = true
            return {
                ...connector,
                entries: entryRecords.map((record) =>
                    AltiumSchematicFidelityNormalizer.#harnessEntry(record)
                ),
                ...(typeRecord
                    ? {
                          typeLabel:
                              AltiumSchematicFidelityNormalizer.#harnessTypeLabel(
                                  typeRecord
                              )
                      }
                    : {})
            }
        })
        if (!changed) return harnesses

        return {
            ...harnesses,
            connectors,
            bundleLinks: (harnesses.bundleLinks || []).map((link, index) => {
                const connector = connectors[index]
                return {
                    ...link,
                    harnessType:
                        connector?.typeLabel?.text ||
                        connector?.entries?.find((entry) => entry.harnessType)
                            ?.harnessType,
                    entries: (connector?.entries || []).map(
                        (entry) => entry.name
                    )
                }
            })
        }
    }

    /**
     * Collects connector children using native explicit and list ownership.
     * @param {Record<string, any>} connectorRecord Connector ownership row.
     * @param {Record<string, any>[]} records Ownership records.
     * @returns {Record<string, any>[]} Child rows.
     */
    static #harnessChildren(connectorRecord, records) {
        const position = records.indexOf(connectorRecord)
        const ownerKeys = new Set([
            String(connectorRecord.recordIndex ?? ''),
            String(Number(connectorRecord.recordIndex ?? -1) + 1),
            AltiumSchematicFidelityNormalizer.#field(
                connectorRecord.fields,
                'IndexInSheet'
            ),
            String(
                Number(
                    AltiumSchematicFidelityNormalizer.#field(
                        connectorRecord.fields,
                        'IndexInSheet'
                    ) || -1
                ) + 1
            )
        ])
        const children = records.filter((record) => {
            const recordType =
                AltiumSchematicFidelityNormalizer.#recordType(record)
            return (
                (recordType === '216' || recordType === '217') &&
                ownerKeys.has(AltiumSchematicFidelityNormalizer.#owner(record))
            )
        })

        for (let index = position + 1; position >= 0; index += 1) {
            const record = records[index]
            const recordType =
                AltiumSchematicFidelityNormalizer.#recordType(record)
            if (recordType !== '216' && recordType !== '217') break
            if (
                AltiumSchematicFidelityNormalizer.#owner(record) ||
                !ParserUtils.parseBoolean(
                    AltiumSchematicFidelityNormalizer.#field(
                        record.fields,
                        'OwnerIndexAdditionalList'
                    )
                )
            ) {
                break
            }
            if (!children.includes(record)) children.push(record)
        }

        return children
    }

    /**
     * Builds one normalized harness entry.
     * @param {Record<string, any>} record Ownership row.
     * @returns {Record<string, any>} Harness entry.
     */
    static #harnessEntry(record) {
        const fields = record.fields || {}
        const whole = Number(
            AltiumSchematicFidelityNormalizer.#field(
                fields,
                'DistanceFromTop'
            ) || 0
        )
        const fraction = Number(
            AltiumSchematicFidelityNormalizer.#field(
                fields,
                'DistanceFromTop_Frac1'
            ) || 0
        )

        return AltiumSchematicFidelityNormalizer.#stripEmpty({
            key: 'harness-entry-' + String(record.recordIndex ?? 0),
            recordKey: record.key,
            name: AltiumSchematicFidelityNormalizer.#field(fields, 'Name'),
            side: AltiumSchematicFidelityNormalizer.#side(
                AltiumSchematicFidelityNormalizer.#field(fields, 'Side')
            ),
            distanceFromTop: Number(
                (whole * 10 + fraction / 100000).toFixed(4)
            ),
            harnessType: AltiumSchematicFidelityNormalizer.#field(
                fields,
                'HarnessType'
            ),
            textStyle: AltiumSchematicFidelityNormalizer.#textStyle(
                AltiumSchematicFidelityNormalizer.#field(fields, 'TextStyle')
            ),
            textColor: ParserUtils.toColor(fields.TEXTCOLOR, '#000000')
        })
    }

    /**
     * Builds one normalized harness type label.
     * @param {Record<string, any>} record Ownership row.
     * @returns {Record<string, any>} Harness type label.
     */
    static #harnessTypeLabel(record) {
        const fields = record.fields || {}
        return {
            key: 'harness-type-' + String(record.recordIndex ?? 0),
            recordKey: record.key,
            text: AltiumSchematicFidelityNormalizer.#field(fields, 'Text'),
            x: Number(
                AltiumSchematicFidelityNormalizer.#field(
                    fields,
                    'Location.X'
                ) || 0
            ),
            y: Number(
                AltiumSchematicFidelityNormalizer.#field(
                    fields,
                    'Location.Y'
                ) || 0
            ),
            color: ParserUtils.toColor(fields.COLOR, '#000000')
        }
    }

    /**
     * Collects owner envelopes for rotated parameter placement.
     * @param {Record<string, any>} schematic Native schematic model.
     * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
     */
    static #collectOwnerBounds(schematic) {
        const ownerBounds = new Map()
        for (const primitive of PRIMITIVE_FAMILIES.flatMap(
            (family) => schematic[family] || []
        )) {
            const owner = String(primitive?.ownerIndex || '').trim()
            const bounds = AltiumSchematicFidelityNormalizer.#bounds(primitive)
            if (!owner || !bounds) continue

            const current = ownerBounds.get(owner)
            if (!current) {
                ownerBounds.set(owner, { ...bounds })
                continue
            }
            current.minX = Math.min(current.minX, bounds.minX)
            current.minY = Math.min(current.minY, bounds.minY)
            current.maxX = Math.max(current.maxX, bounds.maxX)
            current.maxY = Math.max(current.maxY, bounds.maxY)
        }
        return ownerBounds
    }

    /**
     * Resolves primitive coordinate bounds.
     * @param {Record<string, any>} primitive Primitive row.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #bounds(primitive) {
        const points = []
        if (Array.isArray(primitive?.points)) points.push(...primitive.points)
        if (
            Number.isFinite(Number(primitive?.x1)) &&
            Number.isFinite(Number(primitive?.y1)) &&
            Number.isFinite(Number(primitive?.x2)) &&
            Number.isFinite(Number(primitive?.y2))
        ) {
            points.push(
                { x: Number(primitive.x1), y: Number(primitive.y1) },
                { x: Number(primitive.x2), y: Number(primitive.y2) }
            )
        } else if (
            Number.isFinite(Number(primitive?.x)) &&
            Number.isFinite(Number(primitive?.y)) &&
            Number.isFinite(Number(primitive?.width)) &&
            Number.isFinite(Number(primitive?.height))
        ) {
            points.push(
                { x: Number(primitive.x), y: Number(primitive.y) },
                {
                    x: Number(primitive.x) + Number(primitive.width),
                    y: Number(primitive.y) + Number(primitive.height)
                }
            )
        } else if (
            Number.isFinite(Number(primitive?.x)) &&
            Number.isFinite(Number(primitive?.y)) &&
            (Number.isFinite(Number(primitive?.radius)) ||
                Number.isFinite(Number(primitive?.radiusX)))
        ) {
            const radiusX = Math.abs(
                Number(primitive.radiusX ?? primitive.radius)
            )
            const radiusY = Math.abs(
                Number(primitive.radiusY ?? primitive.radius)
            )
            points.push(
                {
                    x: Number(primitive.x) - radiusX,
                    y: Number(primitive.y) - radiusY
                },
                {
                    x: Number(primitive.x) + radiusX,
                    y: Number(primitive.y) + radiusY
                }
            )
        }

        const finitePoints = points.filter(
            (point) =>
                Number.isFinite(Number(point?.x)) &&
                Number.isFinite(Number(point?.y))
        )
        if (!finitePoints.length) return null

        return {
            minX: Math.min(...finitePoints.map((point) => Number(point.x))),
            minY: Math.min(...finitePoints.map((point) => Number(point.y))),
            maxX: Math.max(...finitePoints.map((point) => Number(point.x))),
            maxY: Math.max(...finitePoints.map((point) => Number(point.y)))
        }
    }

    /**
     * Resolves one ownership record type.
     * @param {Record<string, any> | undefined} record Ownership row.
     * @returns {string} Record type.
     */
    static #recordType(record) {
        return String(
            record?.recordType ??
                AltiumSchematicFidelityNormalizer.#field(
                    record?.fields,
                    'Record'
                ) ??
                ''
        )
    }

    /**
     * Resolves one ownership key.
     * @param {Record<string, any> | undefined} record Ownership row.
     * @returns {string} Owner key.
     */
    static #owner(record) {
        return String(
            record?.ownerIndex ??
                AltiumSchematicFidelityNormalizer.#field(
                    record?.fields,
                    'OwnerIndex'
                ) ??
                ''
        ).trim()
    }

    /**
     * Reads one case-insensitive raw field.
     * @param {Record<string, any> | undefined} fields Raw fields.
     * @param {string} name Field name.
     * @returns {string} Field value.
     */
    static #field(fields, name) {
        if (!fields) return ''
        const key = Object.keys(fields).find(
            (candidate) => candidate.toLowerCase() === name.toLowerCase()
        )
        const value = key ? fields[key] : ''
        return String(Array.isArray(value) ? value.at(-1) || '' : value || '')
    }

    /**
     * Resolves native side codes.
     * @param {string | number} value Native side code.
     * @returns {'left' | 'right' | 'top' | 'bottom'} Side label.
     */
    static #side(value) {
        return ['left', 'right', 'top', 'bottom'][Number(value)] || 'left'
    }

    /**
     * Resolves native harness entry text style.
     * @param {string} value Native style.
     * @returns {string} Normalized style.
     */
    static #textStyle(value) {
        const normalized = String(value || '').toLowerCase()
        if (normalized === '1' || normalized === 'abbreviated') {
            return 'abbreviated'
        }
        if (normalized === '2' || normalized === 'short') return 'short'
        return 'full'
    }

    /**
     * Removes empty fields while retaining false and zero.
     * @param {Record<string, any>} value Candidate record.
     * @returns {Record<string, any>} Compact record.
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value).filter(
                ([, fieldValue]) =>
                    fieldValue !== null &&
                    fieldValue !== undefined &&
                    fieldValue !== ''
            )
        )
    }
}

Object.freeze(AltiumSchematicFidelityNormalizer.prototype)
Object.freeze(AltiumSchematicFidelityNormalizer)
