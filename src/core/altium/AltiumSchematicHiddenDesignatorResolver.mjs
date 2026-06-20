import { AsciiRecordParser } from './AsciiRecordParser.mjs'

/**
 * Marks Altium schematic components whose native designator labels are hidden.
 */
export class AltiumSchematicHiddenDesignatorResolver {
    /**
     * Annotates parsed components with schematic designator visibility metadata.
     * @param {object} documentModel Parsed document model.
     * @param {ArrayBuffer} arrayBuffer Source document bytes.
     * @returns {object}
     */
    static annotate(documentModel, arrayBuffer) {
        if (!documentModel?.schematic?.components?.length || !arrayBuffer) {
            return documentModel
        }

        const hiddenDesignatorIds =
            AltiumSchematicHiddenDesignatorResolver.#hiddenDesignatorUniqueIds(
                arrayBuffer
            )

        if (!hiddenDesignatorIds.size) {
            return documentModel
        }

        for (const component of documentModel.schematic.components) {
            if (hiddenDesignatorIds.has(String(component.uniqueId || ''))) {
                component.schematicDesignatorVisible = false
            }
        }

        return documentModel
    }

    /**
     * Finds component IDs whose owner designator record is explicitly hidden.
     * @param {ArrayBuffer} arrayBuffer Source document bytes.
     * @returns {Set<string>}
     */
    static #hiddenDesignatorUniqueIds(arrayBuffer) {
        let records = []
        try {
            records = AsciiRecordParser.parse(arrayBuffer)
        } catch {
            return new Set()
        }

        const hiddenUniqueIds = new Set()

        for (let index = 0; index < records.length; index += 1) {
            const record = records[index]
            if (
                !AltiumSchematicHiddenDesignatorResolver.#isComponentRecord(
                    record
                )
            ) {
                continue
            }

            const uniqueId =
                AltiumSchematicHiddenDesignatorResolver.#field(
                    record.fields,
                    'UniqueID'
                ) ||
                AltiumSchematicHiddenDesignatorResolver.#field(
                    record.fields,
                    'UniqueId'
                )
            if (!uniqueId) {
                continue
            }

            const visibility =
                AltiumSchematicHiddenDesignatorResolver.#ownerDesignatorVisibility(
                    records,
                    index + 1
                )
            if (
                visibility.hasHiddenDesignator &&
                !visibility.hasVisibleDesignator
            ) {
                hiddenUniqueIds.add(uniqueId)
            }
        }

        return hiddenUniqueIds
    }

    /**
     * Resolves designator visibility in the records following one component.
     * @param {{ fields: Record<string, string | string[]> }[]} records Parsed records.
     * @param {number} startIndex First record after the component.
     * @returns {{ hasHiddenDesignator: boolean, hasVisibleDesignator: boolean }}
     */
    static #ownerDesignatorVisibility(records, startIndex) {
        let hasHiddenDesignator = false
        let hasVisibleDesignator = false

        for (let index = startIndex; index < records.length; index += 1) {
            const record = records[index]
            if (
                AltiumSchematicHiddenDesignatorResolver.#isComponentRecord(
                    record
                )
            ) {
                break
            }

            if (
                !AltiumSchematicHiddenDesignatorResolver.#isDesignatorRecord(
                    record
                )
            ) {
                continue
            }

            if (
                AltiumSchematicHiddenDesignatorResolver.#isHiddenRecord(record)
            ) {
                hasHiddenDesignator = true
                continue
            }

            hasVisibleDesignator = true
        }

        return { hasHiddenDesignator, hasVisibleDesignator }
    }

    /**
     * Returns true when one raw record is a component placement.
     * @param {{ fields?: Record<string, string | string[]> }} record Raw record.
     * @returns {boolean}
     */
    static #isComponentRecord(record) {
        return (
            AltiumSchematicHiddenDesignatorResolver.#field(
                record?.fields,
                'RECORD'
            ) === '1'
        )
    }

    /**
     * Returns true when one raw record is a component designator label.
     * @param {{ fields?: Record<string, string | string[]> }} record Raw record.
     * @returns {boolean}
     */
    static #isDesignatorRecord(record) {
        return (
            AltiumSchematicHiddenDesignatorResolver.#field(
                record?.fields,
                'Name'
            )
                .trim()
                .toLowerCase() === 'designator'
        )
    }

    /**
     * Returns true when one raw record is explicitly hidden.
     * @param {{ fields?: Record<string, string | string[]> }} record Raw record.
     * @returns {boolean}
     */
    static #isHiddenRecord(record) {
        return (
            AltiumSchematicHiddenDesignatorResolver.#field(
                record?.fields,
                'IsHidden'
            )
                .trim()
                .toUpperCase() === 'T'
        )
    }

    /**
     * Reads one string field from parser records.
     * @param {Record<string, string | string[]> | undefined} fields Field map.
     * @param {string} key Field key.
     * @returns {string}
     */
    static #field(fields, key) {
        const value = fields?.[key]
        if (Array.isArray(value)) {
            return String(value[0] || '')
        }

        return String(value || '')
    }
}
