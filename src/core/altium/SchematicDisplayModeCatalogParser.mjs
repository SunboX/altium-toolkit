// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

/**
 * Catalogues all schematic component parts and display modes.
 */
export class SchematicDisplayModeCatalogParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.display-modes.a1'

    /**
     * Parses all component display-mode metadata.
     * @param {object[]} records Schematic records.
     * @returns {object | null}
     */
    static parse(records) {
        const components = (records || [])
            .filter((record) => getField(record.fields, 'RECORD') === '1')
            .map((record) =>
                SchematicDisplayModeCatalogParser.#componentCatalog(
                    record,
                    records
                )
            )
            .filter(Boolean)

        if (!components.length) {
            return null
        }

        return {
            schema: SchematicDisplayModeCatalogParser.SCHEMA_ID,
            components
        }
    }

    /**
     * Builds one component display-mode catalog row.
     * @param {object} componentRecord Component record.
     * @param {object[]} records All schematic records.
     * @returns {object}
     */
    static #componentCatalog(componentRecord, records) {
        const indexInSheet = parseNumericField(
            componentRecord.fields,
            'IndexInSheet'
        )
        const ownerIndex = String(indexInSheet ?? componentRecord.recordIndex)
        const children = SchematicDisplayModeCatalogParser.#ownerChildren(
            records,
            ownerIndex
        )
        const declaredPartCount =
            parseNumericField(componentRecord.fields, 'PartCount') || 1
        const declaredDisplayModeCount =
            parseNumericField(componentRecord.fields, 'DisplayModeCount') || 1
        const currentPartId =
            parseNumericField(componentRecord.fields, 'CurrentPartId') || 1
        const partIds = SchematicDisplayModeCatalogParser.#collectPartIds(
            children,
            declaredPartCount
        )

        return {
            componentKey: 'schematic-component-' + ownerIndex,
            recordKey:
                'schematic-record-' + String(componentRecord.recordIndex ?? 0),
            uniqueId: getField(componentRecord.fields, 'UniqueID'),
            libReference:
                getField(componentRecord.fields, 'LibReference') ||
                getField(componentRecord.fields, 'DesignItemId'),
            partCount: declaredPartCount,
            displayModeCount: declaredDisplayModeCount,
            currentPartId,
            partIdLocked: parseBoolean(componentRecord.fields.PartIDLocked),
            allPinCount:
                parseNumericField(componentRecord.fields, 'AllPinCount') ||
                children.filter(
                    (child) => getField(child.fields, 'RECORD') === '2'
                ).length,
            parts: partIds.map((partId) =>
                SchematicDisplayModeCatalogParser.#partCatalog(
                    partId,
                    currentPartId,
                    declaredDisplayModeCount,
                    children
                )
            )
        }
    }

    /**
     * Returns child records with owner part/display metadata.
     * @param {object[]} records All schematic records.
     * @param {string} ownerIndex Component owner index.
     * @returns {object[]}
     */
    static #ownerChildren(records, ownerIndex) {
        return (records || []).filter(
            (record) =>
                getField(record.fields, 'OwnerIndex') === ownerIndex &&
                parseNumericField(record.fields, 'OwnerPartID') !== null
        )
    }

    /**
     * Collects declared and observed part ids.
     * @param {object[]} children Owner child records.
     * @param {number} declaredPartCount Declared part count.
     * @returns {number[]}
     */
    static #collectPartIds(children, declaredPartCount) {
        const ids = new Set()

        for (let partId = 1; partId <= declaredPartCount; partId += 1) {
            ids.add(partId)
        }
        for (const child of children) {
            const partId = parseNumericField(child.fields, 'OwnerPartID')
            if (partId !== null && partId > 0) ids.add(partId)
        }

        return [...ids].sort((left, right) => left - right)
    }

    /**
     * Builds one part catalog row.
     * @param {number} partId Native part id.
     * @param {number} currentPartId Active part id.
     * @param {number} declaredDisplayModeCount Declared display-mode count.
     * @param {object[]} children Owner child records.
     * @returns {object}
     */
    static #partCatalog(
        partId,
        currentPartId,
        declaredDisplayModeCount,
        children
    ) {
        const partChildren = children.filter(
            (child) => parseNumericField(child.fields, 'OwnerPartID') === partId
        )
        const displayModeIds =
            SchematicDisplayModeCatalogParser.#collectDisplayModeIds(
                partChildren,
                declaredDisplayModeCount
            )

        return {
            partId,
            isCurrent: partId === currentPartId,
            primitiveCount: partChildren.length,
            pinCount: SchematicDisplayModeCatalogParser.#pinCount(partChildren),
            displayModes: displayModeIds.map((displayMode) =>
                SchematicDisplayModeCatalogParser.#displayModeCatalog(
                    displayMode,
                    partId,
                    currentPartId,
                    partChildren
                )
            )
        }
    }

    /**
     * Collects observed display-mode ids for a part.
     * @param {object[]} partChildren Child records for one part.
     * @param {number} declaredDisplayModeCount Declared display-mode count.
     * @returns {number[]}
     */
    static #collectDisplayModeIds(partChildren, declaredDisplayModeCount) {
        const ids = new Set()

        for (const child of partChildren) {
            const displayMode = parseNumericField(
                child.fields,
                'OwnerPartDisplayMode'
            )
            ids.add(displayMode || 1)
        }
        if (!ids.size && declaredDisplayModeCount > 0) {
            ids.add(1)
        }

        return [...ids].sort((left, right) => left - right)
    }

    /**
     * Builds one display-mode catalog row.
     * @param {number} displayMode Native display-mode id.
     * @param {number} partId Native part id.
     * @param {number} currentPartId Active part id.
     * @param {object[]} partChildren Child records for one part.
     * @returns {object}
     */
    static #displayModeCatalog(
        displayMode,
        partId,
        currentPartId,
        partChildren
    ) {
        const displayChildren = partChildren.filter(
            (child) =>
                (parseNumericField(child.fields, 'OwnerPartDisplayMode') ||
                    1) === displayMode
        )

        return {
            displayMode,
            isActive: partId === currentPartId && displayMode === 1,
            primitiveCount: displayChildren.length,
            pinCount:
                SchematicDisplayModeCatalogParser.#pinCount(displayChildren)
        }
    }

    /**
     * Counts pin records in a child record list.
     * @param {object[]} records Child records.
     * @returns {number}
     */
    static #pinCount(records) {
        return records.filter(
            (record) => getField(record.fields, 'RECORD') === '2'
        ).length
    }
}
