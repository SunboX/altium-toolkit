// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AltiumParser } from '../src/core/altium/AltiumParser.mjs'
import { AltiumDocumentBuilder } from '../src/convergence/AltiumDocumentBuilder.mjs'
import { AltiumWorkerClient } from '../src/convergence/AltiumWorkerClient.mjs'
import { Parser } from '../src/convergence/Parser.mjs'
import { ProjectLoader } from '../src/convergence/ProjectLoader.mjs'
import { SchematicSvgRenderer } from '../src/convergence/SchematicSvgRenderer.mjs'
import { SchematicSvgRenderer as LegacySchematicSvgRenderer } from '../src/ui/SchematicSvgRenderer.mjs'

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)))
const APPROVED = Object.freeze({
    manifestFileSha256:
        '561b9a6499f7cb5adc5db85526b9b3d7d4ca59dd0bc6bab747ae95263168cb61',
    manifestArtifactChecksum:
        'e3bfcbcdd0fdcda6de5f08c16a75949eb377749274d742a7a89ff16ad3a09c98',
    sourceCommit: '9fa22e1028d96e583275093279bf6e03e8619588',
    sourceTree: '1ddc290f5fc034454c5f33dac4de56b917070174'
})
const LIMITS = Object.freeze({
    canonicalDocument: { ratio: 2, allowanceMs: 0.5 },
    noExtensionDocument: { ratio: 1.85, allowanceMs: 0.5 },
    project: { ratio: 2.25, allowancePerUnitMs: 0.55 },
    asyncDocument: { ratio: 1.5, allowanceMs: 0.75 },
    metadataAsset: { ratio: 1.5, allowanceMs: 0.4 },
    fullAsset: { ratio: 1.75, allowanceMs: 1.5 },
    workerProtocol: { ratio: 3, allowanceMs: 2 },
    nativeRendererFacade: { ratio: 1.6, allowanceMs: 1 },
    fullExtensionMilliseconds: 250,
    largeExtensionMilliseconds: 2_000
})

/**
 * Runs provenance-bound legacy-to-canonical Altium benchmarks.
 * @param {{ quick?: boolean }} [options] Benchmark options.
 * @returns {Promise<Record<string, any>>} Benchmark report.
 */
export async function runAltiumBenchmarks(options = {}) {
    await verifyHistoricalNativeSource()
    const quick = options.quick === true
    const documentFixture = createProjectInput(quick ? 48 : 128, 'benchmark')
    const projectEntries = Array.from({ length: quick ? 4 : 12 }, (_, index) =>
        createProjectInput(quick ? 8 : 24, `entry-${index + 1}`)
    ).map((input) => ({ name: input.fileName, data: input.data }))
    const assetData = new Uint8Array(quick ? 64 * 1024 : 512 * 1024)
    assetData.fill(0xa5)
    const assetFixture = {
        ...documentFixture,
        assets: [
            {
                name: 'benchmark.bin',
                mediaType: 'application/octet-stream',
                data: assetData
            }
        ]
    }
    const legacyDocument = () =>
        standardElementCount(
            AltiumParser.parseArrayBuffer(
                documentFixture.fileName,
                documentFixture.data
            )
        )
    const canonicalDocument = () => Parser.parse(documentFixture).model.length
    const noExtensionDocument = () =>
        Parser.parse(documentFixture, { extensions: 'none' }).model.length
    const legacyProject = () =>
        projectEntries.reduce(
            (total, entry) =>
                total +
                standardElementCount(
                    AltiumParser.parseArrayBuffer(entry.name, entry.data)
                ),
            0
        )
    const canonicalProject = () =>
        ProjectLoader.load(projectEntries).documents.reduce(
            (total, document) => total + document.model.length,
            0
        )
    const noAssetPayloadDocument = () =>
        Parser.parse(assetFixture, { decodeAssets: 'none' }).model.length +
        assetData.byteLength
    const metadataAssetDocument = () => {
        const document = Parser.parse(assetFixture, {
            decodeAssets: 'metadata'
        })
        return document.model.length + document.assets[0].byteLength
    }
    const fullAssetDocument = () => {
        const document = Parser.parse(assetFixture, { decodeAssets: 'full' })
        return document.model.length + document.assets[0].data.byteLength
    }
    const asyncDocument = async () =>
        (
            await Parser.parseAsync(documentFixture, {
                worker: false
            })
        ).model.length
    assertEquivalent(legacyDocument, canonicalDocument, 'canonical document')
    assertEquivalent(
        legacyDocument,
        noExtensionDocument,
        'extension-free document'
    )
    assertEquivalent(legacyProject, canonicalProject, 'canonical project')
    if (
        metadataAssetDocument() !== noAssetPayloadDocument() ||
        fullAssetDocument() !== noAssetPayloadDocument()
    ) {
        throw new Error('Benchmark asset projection changed.')
    }

    const documentIterations = quick ? 20 : 80
    const projectIterations = quick ? 4 : 12
    const rounds = quick ? 3 : 7
    const document = measurePair(
        legacyDocument,
        canonicalDocument,
        documentIterations,
        rounds
    )
    const noExtension = measurePair(
        legacyDocument,
        noExtensionDocument,
        documentIterations,
        rounds
    )
    const project = measurePair(
        legacyProject,
        canonicalProject,
        projectIterations,
        rounds
    )
    const metadataAsset = measurePair(
        noAssetPayloadDocument,
        metadataAssetDocument,
        documentIterations,
        rounds
    )
    const fullAsset = measurePair(
        metadataAssetDocument,
        fullAssetDocument,
        documentIterations,
        rounds
    )
    const directAsync = await measureAsyncPair(
        async () => canonicalDocument(),
        asyncDocument,
        quick ? 5 : 12,
        quick ? 3 : 5
    )
    const workerProtocol = await measureWorkerProtocol(
        documentFixture,
        asyncDocument,
        quick ? 3 : 8,
        quick ? 3 : 5
    )
    const fullExtension = measure(
        () =>
            Parser.parse(documentFixture, { extensions: 'full' }).extensions
                .altium.native.summary.documentCount,
        quick ? 2 : 5,
        rounds
    )
    const largeExtensionRequest = createLargeNativeExtensionRequest(
        quick ? 15_001 : 30_001
    )
    const largeExtension = measure(
        () =>
            AltiumDocumentBuilder.build(
                largeExtensionRequest.normalized,
                largeExtensionRequest.decoded
            ).extensions.altium.native.pcb.pads.length,
        1,
        rounds
    )
    const rendererDocuments = createRendererBenchmarkDocuments(
        quick ? 1_000 : 5_000
    )
    const nativeRendererFacade = measurePair(
        () =>
            LegacySchematicSvgRenderer.render(rendererDocuments.baseline)
                .length,
        () => SchematicSvgRenderer.render(rendererDocuments.candidate).length,
        quick ? 3 : 6,
        rounds
    )
    const cases = [
        ratioCase('canonical-document', document, LIMITS.canonicalDocument),
        ratioCase(
            'no-extension-document',
            noExtension,
            LIMITS.noExtensionDocument
        ),
        ratioCase(
            'canonical-project',
            project,
            LIMITS.project,
            projectEntries.length
        ),
        ratioCase(
            'metadata-asset-document',
            metadataAsset,
            LIMITS.metadataAsset
        ),
        ratioCase('full-asset-document', fullAsset, LIMITS.fullAsset),
        ratioCase('async-direct-document', directAsync, LIMITS.asyncDocument),
        ratioCase(
            'worker-protocol-roundtrip',
            workerProtocol,
            LIMITS.workerProtocol
        ),
        {
            id: 'full-native-extension',
            candidateMs: fullExtension.milliseconds,
            limitMs: LIMITS.fullExtensionMilliseconds,
            checksum: fullExtension.checksum,
            status:
                fullExtension.milliseconds <= LIMITS.fullExtensionMilliseconds
                    ? 'passed'
                    : 'failed'
        },
        {
            id: 'large-native-extension',
            candidateMs: largeExtension.milliseconds,
            limitMs: LIMITS.largeExtensionMilliseconds,
            checksum: largeExtension.checksum,
            status:
                largeExtension.milliseconds <= LIMITS.largeExtensionMilliseconds
                    ? 'passed'
                    : 'failed'
        },
        ratioCase(
            'native-renderer-facade',
            nativeRendererFacade,
            LIMITS.nativeRendererFacade
        )
    ]
    return {
        schema: 'altium-toolkit.benchmark-report.v1',
        provenance: {
            packageVersion: '1.1.41',
            sourceCommit: APPROVED.sourceCommit,
            sourceTree: APPROVED.sourceTree,
            manifestFileSha256: APPROVED.manifestFileSha256
        },
        quick,
        cases,
        passed: cases.every((row) => row.status === 'passed')
    }
}

/**
 * Builds equivalent historical and visibility-aware renderer documents for
 * measuring convergence facade overhead independently from parsing.
 * @param {number} componentCount Hidden component count.
 * @returns {{ baseline: Record<string, any>, candidate: Record<string, any> }} Renderer documents.
 */
function createRendererBenchmarkDocuments(componentCount) {
    const candidateComponents = Array.from(
        { length: componentCount },
        (_, index) => ({
            x: 20 + (index % 80),
            y: 20 + (index % 60),
            designator: `H${index + 1}`,
            uniqueId: `BENCH-${index + 1}`,
            schematicDesignatorVisible: false
        })
    )
    const baselineComponents = candidateComponents.map((component) => ({
        ...component,
        designator: ''
    }))
    const document = {
        summary: { title: 'Native renderer facade benchmark' },
        schematic: {
            sheet: { width: 140, height: 100 },
            lines: [],
            texts: [],
            pins: [],
            ports: [],
            crosses: []
        }
    }

    return {
        baseline: {
            ...document,
            schematic: {
                ...document.schematic,
                components: baselineComponents
            }
        },
        candidate: {
            ...document,
            schematic: {
                ...document.schematic,
                components: candidateComponents
            }
        }
    }
}

/**
 * Builds one predecoded large native PCB extension request without measuring
 * native source parsing or CircuitJSON adaptation.
 * @param {number} padCount Native pad count.
 * @returns {{ normalized: Record<string, any>, decoded: Record<string, any> }} Builder request.
 */
function createLargeNativeExtensionRequest(padCount) {
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
    return {
        normalized: {
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
        decoded: { native, model: [], nativeSidecarCount: 0 }
    }
}

/**
 * Measures the shared browser-worker request/response path with a deterministic
 * same-process worker double so startup and scheduler noise do not mask
 * protocol regressions.
 * @param {Record<string, any>} input Parser input.
 * @param {Function} baseline Direct async baseline.
 * @param {number} iterations Iterations per round.
 * @param {number} rounds Measurement rounds.
 * @returns {Promise<Record<string, number>>} Paired worker timing.
 */
async function measureWorkerProtocol(input, baseline, iterations, rounds) {
    const originalWorker = globalThis.Worker
    AltiumWorkerClient.dispose()
    globalThis.Worker = BenchmarkWorker
    try {
        return await measureAsyncPair(
            baseline,
            async () =>
                (
                    await Parser.parseAsync(input, {
                        worker: true
                    })
                ).model.length,
            iterations,
            rounds
        )
    } finally {
        AltiumWorkerClient.dispose()
        if (originalWorker === undefined) delete globalThis.Worker
        else globalThis.Worker = originalWorker
    }
}

/**
 * Browser-compatible deterministic worker double for protocol throughput.
 */
class BenchmarkWorker {
    #listeners = new Map()

    /**
     * Registers one worker event listener.
     * @param {string} type Event type.
     * @param {Function} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
        this.#listeners.get(type).add(listener)
    }

    /**
     * Removes one worker event listener.
     * @param {string} type Event type.
     * @param {Function} listener Event listener.
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * Runs one parse and emits the exact shared result-protocol shape.
     * @param {Record<string, any>} message Worker request.
     * @returns {void}
     */
    postMessage(message) {
        const value = Parser.parse(message.input, {
            ...(message.options || {}),
            worker: false
        })
        const response = {
            protocol: 'ecad-toolkit.worker.v1',
            type: 'result',
            requestId: message.requestId,
            value: JSON.parse(JSON.stringify(value))
        }
        queueMicrotask(() => {
            for (const listener of this.#listeners.get('message') || []) {
                listener({ data: response })
            }
        })
    }

    /** Releases all worker listeners. @returns {void} */
    terminate() {
        this.#listeners.clear()
    }
}

/**
 * Verifies every historical native module against a hard-coded manifest.
 * @returns {Promise<void>}
 */
async function verifyHistoricalNativeSource() {
    const path = resolve(ROOT, 'spec/native-source-manifest-v1.1.41.json')
    const bytes = await readFile(path)
    if (sha256(bytes) !== APPROVED.manifestFileSha256) {
        throw new Error('Historical native-source manifest bytes changed.')
    }
    const manifest = JSON.parse(bytes.toString('utf8'))
    if (
        manifest.artifactChecksum !== APPROVED.manifestArtifactChecksum ||
        manifest.provenance?.sourceCommit !== APPROVED.sourceCommit ||
        manifest.provenance?.sourceTree !== APPROVED.sourceTree
    ) {
        throw new Error('Historical native-source provenance changed.')
    }
    for (const row of manifest.files) {
        const current = await readFile(resolve(ROOT, row.path))
        if (sha256(current) !== row.sha256) {
            throw new Error(`Historical native source changed: ${row.path}`)
        }
    }
}

/**
 * Creates deterministic synthetic Altium project metadata.
 * @param {number} documentCount Project document count.
 * @param {string} name Project base name.
 * @returns {{ fileName: string, data: ArrayBuffer }} Parser input.
 */
function createProjectInput(documentCount, name) {
    let source = '[Design]\r\nVersion=1.0\r\nCurrentVariant=\r\n'
    for (let index = 1; index <= documentCount; index += 1) {
        source +=
            `\r\n[Document${index}]\r\n` +
            `DocumentPath=${name}-${index}.SchDoc\r\n` +
            `DocumentUniqueId=${name.toUpperCase()}-${index}\r\n`
    }
    return {
        fileName: `${name}.PrjPcb`,
        data: new TextEncoder().encode(source).buffer
    }
}

/**
 * Counts standard CircuitJSON elements in the historical return shape.
 * @param {object[]} model Historical model.
 * @returns {number} Standard element count.
 */
function standardElementCount(model) {
    let count = 0
    for (const element of model) {
        if (!String(element?.type || '').startsWith('altium_toolkit_')) {
            count += 1
        }
    }
    return count
}

/**
 * Requires legacy and canonical projections to remain equivalent.
 * @param {Function} baseline Baseline operation.
 * @param {Function} candidate Candidate operation.
 * @param {string} label Case label.
 * @returns {void}
 */
function assertEquivalent(baseline, candidate, label) {
    if (baseline() !== candidate()) {
        throw new Error(`Benchmark projection changed: ${label}.`)
    }
}

/**
 * Measures paired operations in alternating order.
 * @param {Function} baseline Baseline operation.
 * @param {Function} candidate Candidate operation.
 * @param {number} iterations Iterations per round.
 * @param {number} rounds Measurement rounds.
 * @returns {{ baselineMs: number, candidateMs: number, baselineChecksum: number, candidateChecksum: number }} Timing pair.
 */
function measurePair(baseline, candidate, iterations, rounds) {
    warm(baseline)
    warm(candidate)
    const baselineRows = []
    const candidateRows = []
    for (let round = 0; round < rounds; round += 1) {
        if (round % 2 === 0) {
            baselineRows.push(measureOnce(baseline, iterations))
            candidateRows.push(measureOnce(candidate, iterations))
        } else {
            candidateRows.push(measureOnce(candidate, iterations))
            baselineRows.push(measureOnce(baseline, iterations))
        }
    }
    return {
        baselineMs: median(baselineRows.map((row) => row.milliseconds)),
        candidateMs: median(candidateRows.map((row) => row.milliseconds)),
        baselineChecksum: baselineRows.at(-1).checksum,
        candidateChecksum: candidateRows.at(-1).checksum
    }
}

/**
 * Measures paired asynchronous operations in alternating order.
 * @param {Function} baseline Baseline operation.
 * @param {Function} candidate Candidate operation.
 * @param {number} iterations Iterations per round.
 * @param {number} rounds Measurement rounds.
 * @returns {Promise<{ baselineMs: number, candidateMs: number, baselineChecksum: number, candidateChecksum: number }>} Timing pair.
 */
async function measureAsyncPair(baseline, candidate, iterations, rounds) {
    await warmAsync(baseline)
    await warmAsync(candidate)
    const baselineRows = []
    const candidateRows = []
    for (let round = 0; round < rounds; round += 1) {
        if (round % 2 === 0) {
            baselineRows.push(await measureAsyncOnce(baseline, iterations))
            candidateRows.push(await measureAsyncOnce(candidate, iterations))
        } else {
            candidateRows.push(await measureAsyncOnce(candidate, iterations))
            baselineRows.push(await measureAsyncOnce(baseline, iterations))
        }
    }
    return {
        baselineMs: median(baselineRows.map((row) => row.milliseconds)),
        candidateMs: median(candidateRows.map((row) => row.milliseconds)),
        baselineChecksum: baselineRows.at(-1).checksum,
        candidateChecksum: candidateRows.at(-1).checksum
    }
}

/**
 * Measures one unpaired operation.
 * @param {Function} operation Benchmark operation.
 * @param {number} iterations Iterations per round.
 * @param {number} rounds Measurement rounds.
 * @returns {{ milliseconds: number, checksum: number }} Timing.
 */
function measure(operation, iterations, rounds) {
    warm(operation)
    const rows = Array.from({ length: rounds }, () =>
        measureOnce(operation, iterations)
    )
    return {
        milliseconds: median(rows.map((row) => row.milliseconds)),
        checksum: rows.at(-1).checksum
    }
}

/** @param {Function} operation Operation. @returns {void} */
function warm(operation) {
    for (let index = 0; index < 5; index += 1) operation()
}

/** @param {Function} operation Async operation. @returns {Promise<void>} */
async function warmAsync(operation) {
    for (let index = 0; index < 3; index += 1) await operation()
}

/**
 * Times one round and consumes every result.
 * @param {Function} operation Operation.
 * @param {number} iterations Iteration count.
 * @returns {{ milliseconds: number, checksum: number }} Timing row.
 */
function measureOnce(operation, iterations) {
    let checksum = 0
    const started = performance.now()
    for (let index = 0; index < iterations; index += 1) {
        checksum += Number(operation())
    }
    return {
        milliseconds: (performance.now() - started) / iterations,
        checksum
    }
}

/**
 * Times one asynchronous round and consumes every result.
 * @param {Function} operation Async operation.
 * @param {number} iterations Iteration count.
 * @returns {Promise<{ milliseconds: number, checksum: number }>} Timing row.
 */
async function measureAsyncOnce(operation, iterations) {
    let checksum = 0
    const started = performance.now()
    for (let index = 0; index < iterations; index += 1) {
        checksum += Number(await operation())
    }
    return {
        milliseconds: (performance.now() - started) / iterations,
        checksum
    }
}

/**
 * Builds one ratio-gated report row.
 * @param {string} id Case id.
 * @param {Record<string, number>} timing Timing pair.
 * @param {{ ratio: number, allowanceMs?: number, allowancePerUnitMs?: number }} limit Speed budget.
 * @param {number} [units] Work-unit count for scaled envelope overhead.
 * @returns {Record<string, any>} Report row.
 */
function ratioCase(id, timing, limit, units = 1) {
    const ratio = timing.candidateMs / Math.max(timing.baselineMs, 0.001)
    const allowanceMs =
        limit.allowanceMs ?? limit.allowancePerUnitMs * Math.max(units, 1)
    const limitMs = timing.baselineMs * limit.ratio + allowanceMs
    return {
        id,
        baselineMs: timing.baselineMs,
        candidateMs: timing.candidateMs,
        ratio,
        ratioLimit: limit.ratio,
        allowanceMs,
        limitMs,
        baselineChecksum: timing.baselineChecksum,
        candidateChecksum: timing.candidateChecksum,
        status: timing.candidateMs <= limitMs ? 'passed' : 'failed'
    }
}

/** @param {number[]} values Values. @returns {number} Median. */
function median(values) {
    const sorted = [...values].sort((left, right) => left - right)
    return sorted[Math.floor(sorted.length / 2)]
}

/** @param {string | Uint8Array} value Hash input. @returns {string} SHA-256. */
function sha256(value) {
    return createHash('sha256').update(value).digest('hex')
}
