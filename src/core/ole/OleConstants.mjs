/**
 * Shared OLE Compound Document constants.
 */
export class OleConstants {
    /**
     * @returns {number}
     */
    static get HEADER_BYTE_LENGTH() {
        return 512
    }

    /**
     * @returns {number}
     */
    static get DIRECTORY_ENTRY_BYTE_LENGTH() {
        return 128
    }

    /**
     * @returns {number[]}
     */
    static get HEADER_SIGNATURE() {
        return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    }

    /**
     * @returns {number}
     */
    static get FREE_SECTOR() {
        return -1
    }

    /**
     * @returns {number}
     */
    static get END_OF_CHAIN() {
        return -2
    }

    /**
     * @returns {number}
     */
    static get FAT_SECTOR() {
        return -3
    }

    /**
     * @returns {number}
     */
    static get DIFAT_SECTOR() {
        return -4
    }

    /**
     * @returns {number}
     */
    static get NO_STREAM() {
        return -1
    }
}
