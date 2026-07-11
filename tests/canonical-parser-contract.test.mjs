// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { ToolkitContractFixtures } from 'circuitjson-toolkit/testing'

import { AltiumParser } from '../src/core/altium/AltiumParser.mjs'
import { AltiumDocumentBuilder } from '../src/convergence/AltiumDocumentBuilder.mjs'
import { Parser } from '../src/convergence/Parser.mjs'

const FIXTURE = ToolkitContractFixtures.altium().parserInput

test('parser rejects accessor-backed input and options without invoking accessors', () => {
    let reads = 0
    const accessorInput = {
        fileName: FIXTURE.fileName,
        get data() {
            reads += 1
            return FIXTURE.data
        }
    }
    assert.equal(Parser.supports(accessorInput), false)
    assert.throws(
        () => Parser.parse(accessorInput),
        (error) => error?.code === 'ERR_ALTIUM_PARSE'
    )

    const accessorOptions = {
        get worker() {
            reads += 1
            return false
        }
    }
    assert.throws(
        () => Parser.parse(FIXTURE, accessorOptions),
        (error) => error?.code === 'ERR_ALTIUM_PARSE'
    )
    assert.equal(reads, 0)
})

test('parser field copies cannot be redirected through an own __proto__ field', () => {
    let reads = 0
    const input = Object.create(null)
    Object.defineProperty(input, '__proto__', {
        enumerable: true,
        value: {
            get data() {
                reads += 1
                return FIXTURE.data
            },
            get fileName() {
                reads += 1
                return FIXTURE.fileName
            }
        }
    })

    assert.equal(Parser.supports(input), false)
    assert.throws(
        () => Parser.parse(input),
        (error) => error?.code === 'ERR_ALTIUM_PARSE'
    )
    assert.equal(reads, 0)
})

test('parser preserves the exact Uint8Array window and caller bytes', () => {
    const encoded = new TextEncoder().encode(FIXTURE.data)
    const container = new Uint8Array(encoded.byteLength + 8)
    container.fill(0xa5)
    container.set(encoded, 4)
    const before = container.slice()

    const document = Parser.parse({
        fileName: FIXTURE.fileName,
        data: container.subarray(4, 4 + encoded.byteLength)
    })

    assert.equal(document.source.format, 'altium')
    assert.deepEqual(container, before)
})

test('parser executes the native Altium parser exactly once per request', () => {
    const original = AltiumParser.parseArrayBufferToRendererModel
    let calls = 0
    AltiumParser.parseArrayBufferToRendererModel = (...arguments_) => {
        calls += 1
        return Reflect.apply(original, AltiumParser, arguments_)
    }
    try {
        Parser.parse(FIXTURE)
        assert.equal(calls, 1)
    } finally {
        AltiumParser.parseArrayBufferToRendererModel = original
    }
})

test('explicit native extension owns more than fifteen thousand PCB pads', () => {
    const padCount = 15_001
    const native = {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileType: 'pcbdoc',
        summary: { title: 'Large neutral board' },
        diagnostics: [],
        pcb: {
            pads: Array.from({ length: padCount }, (_, index) => ({
                x: index,
                y: index + 1,
                sizeTopX: 20,
                sizeTopY: 10,
                rotation: index % 360,
                layer: 'Top Layer',
                ownerIndex: index,
                designator: String(index + 1)
            }))
        }
    }
    const document = AltiumDocumentBuilder.build(
        {
            input: {
                fileName: 'large-neutral.PcbDoc',
                data: new ArrayBuffer(0),
                assets: []
            },
            sourceReference: {},
            options: {
                decodeAssets: 'metadata',
                extensions: ['altium.native-model'],
                preserveRaw: false,
                retainSource: 'none'
            }
        },
        { native, model: [], nativeSidecarCount: 0 }
    )

    assert.equal(document.extensions.altium.native.pcb.pads.length, padCount)
    assert.notEqual(document.extensions.altium.native, native)
    assert.equal(Object.isFrozen(document.extensions.altium.native), true)
})

test('async progress reports decode before validate and honors validate cancellation', async () => {
    const original = AltiumParser.parseArrayBufferToRendererModel
    const controller = new AbortController()
    const progress = []
    let nativeCalls = 0
    AltiumParser.parseArrayBufferToRendererModel = (...arguments_) => {
        nativeCalls += 1
        return Reflect.apply(original, AltiumParser, arguments_)
    }
    try {
        await assert.rejects(
            Parser.parseAsync(FIXTURE, {
                worker: false,
                signal: controller.signal,
                onProgress: (row) => {
                    progress.push({ stage: row.stage, nativeCalls })
                    if (row.stage === 'validate') controller.abort()
                }
            }),
            (error) => error?.code === 'ERR_CANCELLED'
        )
        assert.deepEqual(progress, [
            { stage: 'detect', nativeCalls: 0 },
            { stage: 'decode', nativeCalls: 0 },
            { stage: 'validate', nativeCalls: 1 }
        ])
        assert.equal(nativeCalls, 1)
    } finally {
        AltiumParser.parseArrayBufferToRendererModel = original
    }
})

test('parser applies common extension selection modes deterministically', () => {
    const none = Parser.parse(FIXTURE, { extensions: 'none' })
    assert.deepEqual(none.extensions, {})

    const metadata = Parser.parse(FIXTURE, { extensions: 'metadata' })
    assert.equal(metadata.extensions.altium.$meta.completeness, 'metadata')
    assert.equal(Object.hasOwn(metadata.extensions.altium, 'native'), false)

    const canonical = Parser.parse(FIXTURE)
    assert.equal(canonical.extensions.altium.$meta.completeness, 'canonical')
    assert.equal(Object.hasOwn(canonical.extensions.altium, 'native'), false)

    const full = Parser.parse(FIXTURE, { extensions: 'full' })
    assert.equal(full.extensions.altium.$meta.completeness, 'full')
    assert.equal(Object.hasOwn(full.extensions.altium, 'native'), true)

    const selected = Parser.parse(FIXTURE, {
        extensions: ['altium.native-model']
    })
    assert.deepEqual(selected.extensions.altium.$meta.included, [
        'altium.summary',
        'altium.project-context',
        'altium.native-model'
    ])
    assert.equal(Object.hasOwn(selected.extensions.altium, 'native'), true)

    const projectContext = Parser.parse(FIXTURE, {
        extensions: ['altium.project-context']
    })
    assert.equal(
        Object.hasOwn(projectContext.extensions.altium, 'projectContext'),
        true
    )
    assert.equal(
        Object.hasOwn(projectContext.extensions.altium, 'native'),
        false
    )

    const preserved = Parser.parse(FIXTURE, { preserveRaw: true })
    assert.equal(Object.hasOwn(preserved.extensions.altium, 'native'), true)

    assert.throws(
        () => Parser.parse(FIXTURE, { extensions: ['unknown.feature'] }),
        (error) => error?.code === 'ERR_CAPABILITY_UNAVAILABLE'
    )
})

test('public extension resolver exposes retained native models without legacy document shims', async () => {
    const { AltiumExtensionResolver } = await import('../src/extensions.mjs')
    const canonical = Parser.parse(FIXTURE)
    const retained = Parser.parse(FIXTURE, {
        extensions: ['altium.native-model']
    })

    assert.equal(AltiumExtensionResolver.nativeModel(canonical), null)
    assert.equal(
        AltiumExtensionResolver.nativeModel(retained),
        retained.extensions.altium.native
    )
    assert.equal(AltiumExtensionResolver.hasNativeModel(retained), true)
    assert.equal(Object.hasOwn(retained, 'schematic'), false)
    assert.equal(Object.hasOwn(retained, 'pcb'), false)

    const legacy = AltiumParser.parseArrayBufferToRendererModel(
        FIXTURE.fileName,
        new TextEncoder().encode(FIXTURE.data).buffer
    )
    assert.equal(AltiumExtensionResolver.nativeModel(legacy), legacy)
})

test('unsupported report errors retain the requested report ids', () => {
    assert.throws(
        () => Parser.parse(FIXTURE, { reports: ['native.inventory'] }),
        (error) =>
            error?.code === 'ERR_CAPABILITY_UNAVAILABLE' &&
            error?.details?.reports?.[0] === 'native.inventory'
    )
})

test('parser delegates dense descriptor-safe asset modes to CircuitJSON', () => {
    const source = new Uint8Array([1, 2, 3, 4])
    const metadata = Parser.parse(
        {
            ...FIXTURE,
            assets: [{ name: 'contract.bin', data: source }]
        },
        { decodeAssets: 'metadata' }
    )
    assert.equal(metadata.assets[0].byteLength, 4)
    assert.equal(metadata.assets[0].data, null)

    const full = Parser.parse(
        {
            ...FIXTURE,
            assets: [{ name: 'contract.bin', data: source }]
        },
        { decodeAssets: 'full' }
    )
    assert.deepEqual(full.assets[0].data, source)
    full.assets[0].data[0] = 99
    assert.deepEqual(source, new Uint8Array([1, 2, 3, 4]))
    assert.deepEqual(full.assets[0].data, new Uint8Array([1, 2, 3, 4]))

    let reads = 0
    const accessorAsset = {
        name: 'invalid.bin',
        get data() {
            reads += 1
            return source
        }
    }
    assert.throws(
        () =>
            Parser.parse(
                { ...FIXTURE, assets: [accessorAsset] },
                { decodeAssets: 'metadata' }
            ),
        (error) => error?.code === 'ERR_ALTIUM_PARSE'
    )
    const sparse = new Array(1)
    assert.throws(
        () =>
            Parser.parse(
                { ...FIXTURE, assets: sparse },
                { decodeAssets: 'metadata' }
            ),
        (error) => error?.code === 'ERR_ALTIUM_PARSE'
    )
    assert.equal(reads, 0)
})

test('async parser signal accepts null and rejects other non-signals', async () => {
    assert.equal(
        (
            await Parser.parseAsync(FIXTURE, {
                worker: false,
                signal: null
            })
        ).source.format,
        'altium'
    )
    for (const signal of [false, 0, '']) {
        await assert.rejects(
            Parser.parseAsync(FIXTURE, { worker: false, signal }),
            (error) => error?.code === 'ERR_ALTIUM_PARSE'
        )
    }
})
