// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Decodes nullable owner indexes shared by binary PCB primitive records.
 */
export class PcbPrimitiveOwnershipIndexParser {
    /**
     * Reads component, net, and polygon ownership indexes from one record.
     * @param {DataView} view
     * @param {{ component: number, net: number, polygon: number }} offsets
     * @returns {{ componentIndex: number | null, netIndex: number | null, polygonIndex: number | null }}
     */
    static readOwnershipIndexes(view, offsets) {
        return {
            componentIndex: PcbPrimitiveOwnershipIndexParser.readComponentIndex(
                view,
                offsets.component
            ),
            netIndex: PcbPrimitiveOwnershipIndexParser.readLinkIndex(
                view,
                offsets.net
            ),
            polygonIndex: PcbPrimitiveOwnershipIndexParser.readLinkIndex(
                view,
                offsets.polygon
            )
        }
    }

    /**
     * Reads one nullable component index.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static readComponentIndex(view, offset) {
        return PcbPrimitiveOwnershipIndexParser.readLinkIndex(view, offset)
    }

    /**
     * Reads one nullable two-byte Altium object link index.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static readLinkIndex(view, offset) {
        if (
            !Number.isInteger(offset) ||
            offset < 0 ||
            offset + 2 > view.byteLength
        ) {
            return null
        }

        const value = view.getUint16(offset, true)
        return value === 0xffff ? null : value
    }
}
