// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Converts Altium legacy and V7 saved layer identifiers into stable layer IDs.
 */
export class PcbLayerIdCodec {
    static #TOP_SIGNAL_LAYER_ID = 1

    static #BOTTOM_SIGNAL_LAYER_ID = 32

    static #INTERNAL_PLANE_1_LAYER_ID = 39

    static #MECHANICAL_1_LAYER_ID = 57

    static #SIGNAL_LAYER_PREFIX = 0x01000000

    static #INTERNAL_PLANE_PREFIX = 0x01010000

    static #MECHANICAL_LAYER_PREFIX = 0x01020000

    static #SYSTEM_LAYER_PREFIX = 0x01030000

    /**
     * Decodes a V7 saved layer id into the corresponding legacy layer id.
     * @param {unknown} savedLayerId
     * @returns {number | null}
     */
    static legacyLayerIdFromV7SaveId(savedLayerId) {
        const saved = Number(savedLayerId)
        if (!Number.isInteger(saved) || saved === 0) {
            return null
        }

        if (saved >= 0x01000001 && saved <= 0x0100001f) {
            return saved - PcbLayerIdCodec.#SIGNAL_LAYER_PREFIX
        }
        if (saved === 0x0100ffff) {
            return PcbLayerIdCodec.#BOTTOM_SIGNAL_LAYER_ID
        }
        if (saved >= 0x01010001 && saved <= 0x01010010) {
            return (
                PcbLayerIdCodec.#INTERNAL_PLANE_1_LAYER_ID +
                (saved - 0x01010001)
            )
        }
        if (saved >= 0x01020001 && saved <= 0x01020010) {
            return PcbLayerIdCodec.#MECHANICAL_1_LAYER_ID + (saved - 0x01020001)
        }
        if ((saved & 0xffff0000) === PcbLayerIdCodec.#SYSTEM_LAYER_PREFIX) {
            return PcbLayerIdCodec.#systemLayerIdFromPartition(saved & 0xffff)
        }

        return null
    }

    /**
     * Builds the V7 saved-layer id for a known legacy layer id.
     * @param {unknown} layerId
     * @returns {number | null}
     */
    static v7SaveIdFromLegacyLayerId(layerId) {
        const legacy = Number(layerId)
        if (!Number.isInteger(legacy) || legacy <= 0) {
            return null
        }

        if (
            legacy >= PcbLayerIdCodec.#TOP_SIGNAL_LAYER_ID &&
            legacy < PcbLayerIdCodec.#BOTTOM_SIGNAL_LAYER_ID
        ) {
            return PcbLayerIdCodec.#SIGNAL_LAYER_PREFIX + legacy
        }
        if (legacy === PcbLayerIdCodec.#BOTTOM_SIGNAL_LAYER_ID) {
            return 0x0100ffff
        }
        if (legacy >= 39 && legacy <= 54) {
            return PcbLayerIdCodec.#INTERNAL_PLANE_PREFIX + (legacy - 38)
        }
        if (legacy >= 57 && legacy <= 72) {
            return PcbLayerIdCodec.#MECHANICAL_LAYER_PREFIX + (legacy - 56)
        }

        return PcbLayerIdCodec.#systemPartitionFromLayerId(legacy)
    }

    /**
     * Converts one fixed V7 system-layer partition into a legacy layer id.
     * @param {number} partition
     * @returns {number | null}
     */
    static #systemLayerIdFromPartition(partition) {
        return (
            {
                6: 33,
                7: 34,
                8: 35,
                9: 36,
                10: 37,
                11: 38,
                12: 55,
                13: 56,
                14: 73,
                15: 74,
                16: 75
            }[partition] || null
        )
    }

    /**
     * Converts one fixed legacy system layer into a V7 saved-layer id.
     * @param {number} layerId
     * @returns {number | null}
     */
    static #systemPartitionFromLayerId(layerId) {
        const partition =
            {
                33: 6,
                34: 7,
                35: 8,
                36: 9,
                37: 10,
                38: 11,
                55: 12,
                56: 13,
                73: 14,
                74: 15,
                75: 16
            }[layerId] || null

        return partition === null
            ? null
            : PcbLayerIdCodec.#SYSTEM_LAYER_PREFIX + partition
    }
}
