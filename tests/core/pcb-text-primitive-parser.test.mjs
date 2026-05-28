// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'

/**
 * Builds synthetic PCB text streams for primitive parser tests.
 */
class PcbTextPrimitiveTestFactory {
    /**
     * Creates one text stream where adjacent records use different payload
     * sizes, forcing the boundary scanner to accept any plausible next text
     * record length rather than only the previous payload length.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createMixedPayloadTextStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbTextPrimitiveTestFactory.#createTextRecord({
            payloadLength: 64,
            text: 'FIRST_MARK',
            layerId: 32,
            ownerIndex: -1,
            x: 100,
            y: 200,
            height: 12,
            kind: 1,
            visibilityFlags: 0
        })
        const secondRecord = PcbTextPrimitiveTestFactory.#createTextRecord({
            payloadLength: 72,
            text: 'SECOND_MARK',
            layerId: 33,
            ownerIndex: 8,
            x: 300,
            y: 400,
            height: 16,
            kind: 2,
            visibilityFlags: 0x00010000
        })
        const dataBytes = new Uint8Array(
            firstRecord.byteLength + secondRecord.byteLength
        )

        headerView.setUint32(0, 2, true)
        dataBytes.set(firstRecord, 0)
        dataBytes.set(secondRecord, firstRecord.byteLength)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one TrueType text stream with extended font metadata fields.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createTrueTypeTextStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const dataBytes = PcbTextPrimitiveTestFactory.#createTextRecord({
            payloadLength: 137,
            text: 'FONT_MARK',
            layerId: 33,
            ownerIndex: 2,
            x: 125,
            y: 225,
            height: 18,
            kind: 1,
            visibilityFlags: 0,
            rotation: 37.5,
            fontType: 1,
            isBold: true,
            isItalic: true,
            fontName: 'Synthetic Sans',
            strokeWidth: 3,
            wideStringIndex: 6
        })

        headerView.setUint32(0, 1, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one Texts6 designator record whose text content is stored in the
     * WideStrings6 table.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createWideStringDesignatorTextStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const dataBytes = PcbTextPrimitiveTestFactory.#createTextRecord({
            payloadLength: 123,
            text: '',
            layerId: 33,
            ownerIndex: 4,
            x: 125,
            y: 225,
            height: 18,
            kind: 0,
            visibilityFlags: 0,
            fontType: 1,
            fontName: 'Synthetic Sans',
            strokeWidth: 3,
            wideStringIndex: 6,
            designatorFlag: true
        })

        headerView.setUint32(0, 1, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one unresolved component comment placeholder text stream.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createCommentPlaceholderTextStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const dataBytes = PcbTextPrimitiveTestFactory.#createTextRecord({
            payloadLength: 123,
            text: 'Comment',
            layerId: 33,
            ownerIndex: 2,
            x: 125,
            y: 225,
            height: 18,
            kind: 1,
            visibilityFlags: 0,
            fontType: 1,
            fontName: 'Synthetic Sans',
            strokeWidth: 3
        })

        headerView.setUint32(0, 1, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one unresolved component comment placeholder stream where the
     * text role must be inferred from ownership and placeholder content.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createMissingRoleCommentPlaceholderTextStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const dataBytes = PcbTextPrimitiveTestFactory.#createTextRecord({
            payloadLength: 123,
            text: 'Comment',
            layerId: 33,
            ownerIndex: 7,
            x: 125,
            y: 225,
            height: 18,
            kind: 2,
            visibilityFlags: 0,
            fontType: 1,
            fontName: 'Synthetic Sans',
            strokeWidth: 3
        })

        headerView.setUint32(0, 1, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one object-id/payload-length text record with a variable text
     * tail.
     * @param {{ payloadLength: number, text: string, layerId: number, ownerIndex: number, x: number, y: number, height: number, kind: number, visibilityFlags: number, rotation?: number, fontType?: number, isBold?: boolean, isItalic?: boolean, fontName?: string, strokeWidth?: number, wideStringIndex?: number, designatorFlag?: boolean }} options
     * @returns {Uint8Array}
     */
    static #createTextRecord(options) {
        const textBytes = new TextEncoder().encode(options.text)
        const dataBytes = new Uint8Array(
            5 + options.payloadLength + textBytes.byteLength
        )
        const dataView = new DataView(dataBytes.buffer)
        const payloadOffset = 5

        dataView.setUint8(0, 5)
        dataView.setUint32(1, options.payloadLength, true)
        dataView.setUint8(payloadOffset, options.layerId)
        dataView.setInt16(payloadOffset + 7, options.ownerIndex, true)
        PcbTextPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 13,
            options.x
        )
        PcbTextPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 17,
            options.y
        )
        PcbTextPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 21,
            options.height
        )
        dataView.setUint32(payloadOffset + 25, options.kind, true)
        if (Number.isFinite(options.rotation)) {
            dataView.setFloat64(payloadOffset + 27, options.rotation, true)
        }
        if (Number.isFinite(options.strokeWidth)) {
            PcbTextPrimitiveTestFactory.#writeMil(
                dataView,
                payloadOffset + 36,
                options.strokeWidth
            )
        }
        dataView.setUint32(payloadOffset + 41, options.visibilityFlags, true)
        if (Number.isFinite(options.fontType)) {
            dataView.setUint8(payloadOffset + 43, options.fontType)
        }
        if (options.designatorFlag) {
            dataView.setUint8(payloadOffset + 41, 1)
        }
        if (options.isBold) {
            dataView.setUint8(payloadOffset + 44, 1)
        }
        if (options.isItalic) {
            dataView.setUint8(payloadOffset + 45, 1)
        }
        if (options.fontName) {
            dataBytes.set(
                new Uint8Array(Buffer.from(options.fontName, 'utf16le')).slice(
                    0,
                    64
                ),
                payloadOffset + 46
            )
        }
        if (Number.isFinite(options.wideStringIndex)) {
            dataView.setUint32(
                payloadOffset + 115,
                options.wideStringIndex,
                true
            )
        }
        dataBytes.set(textBytes, payloadOffset + options.payloadLength)

        return dataBytes
    }

    /**
     * Writes one standard little-endian fixed-point mil value.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeMil(dataView, offset, valueMil) {
        dataView.setInt32(offset, Math.round(valueMil * 10000), true)
    }
}

/**
 * Verifies text tails stop at the next valid text record even when the next
 * record has a different binary payload length.
 */
test('PcbBinaryPrimitiveParser splits text records with mixed payload lengths', () => {
    const { headerBytes, dataBytes } =
        PcbTextPrimitiveTestFactory.createMixedPayloadTextStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTextStream(headerBytes, dataBytes),
        [
            {
                text: 'FIRST_MARK',
                layerId: 32,
                ownerIndex: null,
                x: 100,
                y: 200,
                height: 12,
                kind: 1,
                visibilityFlags: 0,
                rotation: 0,
                mirrored: false
            },
            {
                text: 'SECOND_MARK',
                layerId: 33,
                ownerIndex: 8,
                x: 300,
                y: 400,
                height: 16,
                kind: 2,
                visibilityFlags: 0x00010000,
                rotation: 90,
                mirrored: false
            }
        ]
    )
})

/**
 * Verifies TrueType PCB text records expose font metadata needed by renderers.
 */
test('PcbBinaryPrimitiveParser extracts TrueType text font metadata', () => {
    const { headerBytes, dataBytes } =
        PcbTextPrimitiveTestFactory.createTrueTypeTextStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTextStream(headerBytes, dataBytes),
        [
            {
                text: 'FONT_MARK',
                layerId: 33,
                ownerIndex: 2,
                x: 125,
                y: 225,
                height: 18,
                kind: 1,
                visibilityFlags: 0,
                rotation: 37.5,
                mirrored: false,
                strokeFontType: 1,
                strokeWidth: 3,
                fontType: 1,
                fontTypeName: 'TrueType',
                fontName: 'Synthetic Sans',
                fontFamily: 'Synthetic Sans',
                isBold: true,
                isItalic: true,
                fontWeight: 700,
                fontStyle: 'italic',
                isInverted: false,
                marginBorderWidth: 0,
                wideStringIndex: 6,
                useInvertedRectangle: false,
                textboxRectWidth: 0,
                textboxRectHeight: 0,
                textboxRectJustification: 0,
                role: 'comment',
                isComment: true,
                componentIndex: 2
            }
        ]
    )
})

/**
 * Verifies modern Texts6 records resolve display text from the WideStrings6
 * table and expose explicit component designator ownership.
 */
test('PcbBinaryPrimitiveParser resolves Texts6 WideStrings6 designators', () => {
    const { headerBytes, dataBytes } =
        PcbTextPrimitiveTestFactory.createWideStringDesignatorTextStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTextStream(headerBytes, dataBytes, {
            wideStrings: { 6: 'J1_CH2' }
        }),
        [
            {
                text: 'J1_CH2',
                layerId: 33,
                ownerIndex: 4,
                x: 125,
                y: 225,
                height: 18,
                kind: 0,
                visibilityFlags: 0,
                rotation: 0,
                mirrored: false,
                strokeFontType: 0,
                strokeWidth: 3,
                fontType: 1,
                fontTypeName: 'TrueType',
                fontName: 'Synthetic Sans',
                fontFamily: 'Synthetic Sans',
                isBold: false,
                isItalic: false,
                fontWeight: 400,
                fontStyle: 'normal',
                isInverted: false,
                marginBorderWidth: 0,
                wideStringIndex: 6,
                textSource: 'WideStrings6/Data',
                role: 'designator',
                isDesignator: true,
                componentIndex: 4
            }
        ]
    )
})

/**
 * Verifies unresolved component comment annotation placeholders are marked once
 * during primitive parsing.
 */
test('PcbBinaryPrimitiveParser marks Texts6 comment placeholders', () => {
    const { headerBytes, dataBytes } =
        PcbTextPrimitiveTestFactory.createCommentPlaceholderTextStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTextStream(headerBytes, dataBytes),
        [
            {
                text: 'Comment',
                layerId: 33,
                ownerIndex: 2,
                x: 125,
                y: 225,
                height: 18,
                kind: 1,
                visibilityFlags: 0,
                rotation: 0,
                mirrored: false,
                strokeFontType: 1,
                strokeWidth: 3,
                fontType: 1,
                fontTypeName: 'TrueType',
                fontName: 'Synthetic Sans',
                fontFamily: 'Synthetic Sans',
                isBold: false,
                isItalic: false,
                fontWeight: 400,
                fontStyle: 'normal',
                isInverted: false,
                marginBorderWidth: 0,
                wideStringIndex: 0,
                role: 'comment',
                isComment: true,
                componentIndex: 2,
                isPlaceholder: true
            }
        ]
    )
})

/**
 * Verifies component-owned unresolved comment placeholders are still marked
 * when the text record omits an explicit comment role bit.
 */
test('PcbBinaryPrimitiveParser infers missing Texts6 comment placeholder roles', () => {
    const { headerBytes, dataBytes } =
        PcbTextPrimitiveTestFactory.createMissingRoleCommentPlaceholderTextStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTextStream(headerBytes, dataBytes),
        [
            {
                text: 'Comment',
                layerId: 33,
                ownerIndex: 7,
                x: 125,
                y: 225,
                height: 18,
                kind: 2,
                visibilityFlags: 0,
                rotation: 0,
                mirrored: false,
                strokeFontType: 2,
                strokeWidth: 3,
                fontType: 1,
                fontTypeName: 'TrueType',
                fontName: 'Synthetic Sans',
                fontFamily: 'Synthetic Sans',
                isBold: false,
                isItalic: false,
                fontWeight: 400,
                fontStyle: 'normal',
                isInverted: false,
                marginBorderWidth: 0,
                wideStringIndex: 0,
                componentIndex: 7,
                role: 'comment',
                isComment: true,
                isPlaceholder: true
            }
        ]
    )
})
