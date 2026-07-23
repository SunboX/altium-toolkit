// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { ToolkitContractFixtures } from 'circuitjson-toolkit/testing'

import { AltiumProjectDocumentResolver } from '../src/convergence/AltiumProjectDocumentResolver.mjs'
import { AltiumWorkerClient } from '../src/convergence/AltiumWorkerClient.mjs'
import { Parser } from '../src/convergence/Parser.mjs'
import { ProjectLoader } from '../src/convergence/ProjectLoader.mjs'
import {
    AltiumExtensionResolver,
    SchematicSvgRenderer
} from '../src/extensions.mjs'

const FIXTURES = ToolkitContractFixtures.altium()
const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PROJECT_RESOLUTION_EXCEPTION_PROBE = `
import inspector from 'node:inspector'
import { Parser } from './src/convergence/Parser.mjs'
import { AltiumProjectDocumentResolver } from './src/convergence/AltiumProjectDocumentResolver.mjs'

const schematic = Parser.parse(
    {
        fileName: 'Sheets/Fake.SchDoc',
        data:
            '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=120|CUSTOMY=80|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|TITLEBLOCKON=F|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial' +
            '|RECORD=4|LOCATION.X=20|LOCATION.Y=40|FONTID=1|TEXT==ProjectName'
    },
    { extensions: ['altium.native-model'] }
)
const project = {
    source: { fileType: 'prjpcb', fileName: 'Fake.PrjPcb' },
    extensions: {
        altium: {
            projectContext: {
                parameters: {},
                documents: ['Sheets/Fake.SchDoc']
            }
        }
    }
}
const session = new inspector.Session()
session.connect()
const post = (method, parameters = {}) =>
    new Promise((resolve, reject) =>
        session.post(method, parameters, (error, result) =>
            error ? reject(error) : resolve(result)
        )
    )

let binaryBrandProbes = 0
session.on('Debugger.paused', (message) => {
    if (
        message.params.callFrames.some(
            (frame) => frame.functionName === '#callLength'
        )
    ) {
        binaryBrandProbes += 1
    }
    session.post('Debugger.resume')
})

await post('Debugger.enable')
await post('Debugger.setPauseOnExceptions', { state: 'all' })
AltiumProjectDocumentResolver.resolve(
    { projectEntry: { name: 'Fake.PrjPcb' } },
    [project, schematic],
    ['altium.native-model']
)
await new Promise((resolve) => setImmediate(resolve))
await post('Debugger.setPauseOnExceptions', { state: 'none' })
session.disconnect()
process.stdout.write(String(binaryBrandProbes))
`

test('project resolution avoids defensive binary brand probes for toolkit-owned rebuilds', () => {
    const result = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', PROJECT_RESOLUTION_EXCEPTION_PROBE],
        {
            cwd: PROJECT_ROOT,
            encoding: 'utf8',
            timeout: 10_000
        }
    )

    assert.equal(result.status, 0, result.stderr)
    assert.ok(Number(result.stdout.trim()) <= 2)
})

test('project loader resolves schematic project strings before returning canonical documents', () => {
    const entries = [
        {
            name: 'Neutral_Project.PrjPcb',
            data: `[Design]
Version=1.0

[Document1]
DocumentPath=Sheets/01_Neutral.SchDoc

[Parameter1]
Name=Organization
Value=NEUTRAL LAB
`
        },
        {
            name: 'Sheets/01_Neutral.SchDoc',
            data:
                '|HEADER=Schematic Document' +
                '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
                '|BORDERON=T|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
                '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
                '|RECORD=4|LOCATION.X=20|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT==ProjectName' +
                '|RECORD=4|LOCATION.X=20|LOCATION.Y=130|COLOR=8388608|FONTID=1|TEXT==DocumentName' +
                '|RECORD=4|LOCATION.X=20|LOCATION.Y=110|COLOR=8388608|FONTID=1|TEXT==Organization'
        }
    ]
    const project = ProjectLoader.load(entries)
    const schematic = project.documents.find(
        (document) => document.source.fileType === 'schdoc'
    )
    const projectDocument = project.documents.find(
        (document) => document.source.fileType === 'prjpcb'
    )
    const texts = schematic.model
        .filter((element) => element.type === 'schematic_text')
        .map((element) => element.text)

    assert.deepEqual(texts, [
        'Neutral_Project.PrjPcb',
        '01_Neutral.SchDoc',
        'NEUTRAL LAB'
    ])
    assert.equal(Object.isFrozen(schematic), true)
    assert.equal(Object.isFrozen(schematic.model), true)
    assert.equal(
        projectDocument.extensions.altium.projectContext.parameters
            .Organization,
        'NEUTRAL LAB'
    )
    assert.deepEqual(
        projectDocument.extensions.altium.projectContext.documents,
        ['Sheets/01_Neutral.SchDoc']
    )

    const retainedProject = ProjectLoader.load(entries, {
        extensions: ['altium.native-model']
    })
    const retainedSchematic = retainedProject.documents.find(
        (document) => document.source.fileType === 'schdoc'
    )
    const native = AltiumExtensionResolver.nativeModel(retainedSchematic)
    const nativeTexts = native.schematic.texts.map((text) => text.text)
    const nativeMarkup = SchematicSvgRenderer.render(native)

    assert.deepEqual(nativeTexts, texts)
    assert.match(nativeMarkup, /Neutral_Project\.PrjPcb/u)
    assert.match(nativeMarkup, /01_Neutral\.SchDoc/u)
    assert.match(nativeMarkup, /NEUTRAL LAB/u)

    const withoutExtensions = ProjectLoader.load(entries, {
        extensions: 'none'
    })
    const schematicWithoutExtensions = withoutExtensions.documents.find(
        (document) => document.source.fileType === 'schdoc'
    )
    const projectWithoutExtensions = withoutExtensions.documents.find(
        (document) => document.source.fileType === 'prjpcb'
    )
    assert.deepEqual(
        schematicWithoutExtensions.model
            .filter((element) => element.type === 'schematic_text')
            .map((element) => element.text),
        texts
    )
    assert.deepEqual(projectWithoutExtensions.extensions, {})
    assert.deepEqual(schematicWithoutExtensions.extensions, {})
})

test('project resolution omits hidden project context before its only validated rebuild', () => {
    const schematic = Parser.parse(
        {
            fileName: 'Sheets/01_Neutral.SchDoc',
            data:
                '|HEADER=Schematic Document' +
                '|RECORD=31|CUSTOMX=120|CUSTOMY=80|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
                '|BORDERON=F|TITLEBLOCKON=F|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial' +
                '|RECORD=4|LOCATION.X=20|LOCATION.Y=40|FONTID=1|TEXT==ProjectName'
        },
        { extensions: 'none' }
    )
    let accessorReads = 0
    const altium = {
        projectContext: {
            parameters: {},
            documents: ['Sheets/01_Neutral.SchDoc']
        }
    }
    Object.defineProperty(altium, 'intermediateOnly', {
        enumerable: true,
        get() {
            accessorReads += 1
            return 'must not be inspected'
        }
    })
    const projectDocument = {
        source: {
            fileType: 'prjpcb',
            fileName: 'Neutral_Project.PrjPcb'
        },
        extensions: { altium }
    }
    const [project, resolved] = AltiumProjectDocumentResolver.resolve(
        { projectEntry: { name: 'Neutral_Project.PrjPcb' } },
        [projectDocument, { ...schematic, extensions: { altium } }],
        'none'
    )

    for (const document of [project, resolved]) {
        assert.deepEqual(document.extensions, {})
    }
    assert.equal(
        resolved.model.find((element) => element.type === 'schematic_text')
            .text,
        'Neutral_Project.PrjPcb'
    )
    assert.equal(accessorReads, 0)
})

test('project loader validates common options at its public boundary', () => {
    assert.throws(
        () => ProjectLoader.load(FIXTURES.projectEntries, []),
        (error) =>
            error?.code === 'ERR_PROJECT_INPUT' &&
            error?.category === 'validation'
    )
    assert.throws(
        () =>
            ProjectLoader.load(FIXTURES.projectEntries, {
                worker: 'sometimes'
            }),
        (error) => error?.code === 'ERR_PROJECT_INPUT'
    )
})

test('project tryLoad preserves a nonempty diagnostic for empty input failures', () => {
    const result = ProjectLoader.tryLoad([])

    assert.equal(result.ok, false)
    assert.equal(result.diagnostics.length, 1)
    assert.equal(result.diagnostics[0].severity, 'error')
    assert.equal(result.diagnostics[0].code, result.error.code)
    assert.equal(result.diagnostics[0].message, result.error.message)
})

test('project option copies cannot inherit through an own __proto__ field', () => {
    let reads = 0
    const options = Object.create(null)
    Object.defineProperty(options, '__proto__', {
        enumerable: true,
        value: {
            get archiveLimits() {
                reads += 1
                return { maxEntries: 1 }
            }
        }
    })

    const project = ProjectLoader.load(FIXTURES.projectEntries, options)
    assert.equal(project.documents.length, 1)
    assert.equal(reads, 0)
})

test('project entry collections must be dense and never use caller iteration', () => {
    const sparse = new Array(1)
    assert.throws(
        () => ProjectLoader.load(sparse),
        (error) => error?.code === 'ERR_PROJECT_INPUT'
    )

    let reads = 0
    const accessorEntries = new Array(1)
    Object.defineProperty(accessorEntries, 0, {
        enumerable: true,
        get() {
            reads += 1
            return FIXTURES.projectEntries[0]
        }
    })
    assert.throws(
        () => ProjectLoader.load(accessorEntries),
        (error) => error?.code === 'ERR_PROJECT_INPUT'
    )

    const customIterator = [...FIXTURES.projectEntries]
    Object.defineProperty(customIterator, Symbol.iterator, {
        value: () => {
            reads += 1
            return [][Symbol.iterator]()
        }
    })
    assert.throws(
        () => ProjectLoader.load(customIterator),
        (error) => error?.code === 'ERR_PROJECT_INPUT'
    )
    assert.equal(reads, 0)
})

test('project loader applies shared archive limits and normalized path uniqueness', () => {
    const duplicateEntries = [
        FIXTURES.projectEntries[0],
        { ...FIXTURES.projectEntries[0], name: './contract.PrjPcb' }
    ]
    assert.throws(
        () => ProjectLoader.load(duplicateEntries),
        (error) => error?.code === 'ERR_ARCHIVE_DUPLICATE_ENTRY'
    )

    assert.throws(
        () =>
            ProjectLoader.load(duplicateEntries, {
                archiveLimits: { maxEntries: 1 }
            }),
        (error) =>
            error?.code === 'ERR_ARCHIVE_LIMIT_EXCEEDED' &&
            error?.details?.limit === 'maxEntries'
    )
})

test('project loader exposes companion assets through the common decode modes', () => {
    const model = new Uint8Array([1, 2, 3, 4])
    const project = ProjectLoader.load(
        [
            ...FIXTURES.projectEntries,
            { name: 'models/contract.step', data: model }
        ],
        { decodeAssets: 'full' }
    )

    assert.equal(project.assets.length, 1)
    assert.equal(project.assets[0].name, 'models/contract.step')
    assert.deepEqual(project.assets[0].data, model)
})

test('project archive limits include attached parser assets', () => {
    const sourceBytes = new TextEncoder().encode(
        FIXTURES.projectEntries[0].data
    ).byteLength
    const entries = [
        {
            ...FIXTURES.projectEntries[0],
            assets: [
                {
                    name: 'large.bin',
                    data: new Uint8Array(1024 * 1024)
                }
            ]
        }
    ]

    assert.throws(
        () =>
            ProjectLoader.load(entries, {
                decodeAssets: 'full',
                archiveLimits: {
                    maxEntryBytes: sourceBytes,
                    maxTotalBytes: sourceBytes
                }
            }),
        (error) =>
            error?.code === 'ERR_ARCHIVE_LIMIT_EXCEEDED' &&
            error?.details?.actual === sourceBytes + 1024 * 1024
    )
})

test('project asset preflight rejects accessors without invoking them', () => {
    let reads = 0
    const asset = {
        name: 'invalid.bin',
        get data() {
            reads += 1
            return new Uint8Array(1)
        }
    }
    assert.throws(
        () =>
            ProjectLoader.load([
                { ...FIXTURES.projectEntries[0], assets: [asset] }
            ]),
        (error) => error?.code === 'ERR_PROJECT_INPUT'
    )
    assert.equal(reads, 0)
})

test('project extension modes match parser selection semantics', () => {
    const expectations = new Map([
        ['metadata', ['metadata', ['altium.entry-order']]],
        ['canonical', ['canonical', ['altium.entry-order']]],
        ['full', ['full', ['altium.entry-order']]]
    ])
    for (const [mode, [completeness, included]] of expectations) {
        const project = ProjectLoader.load(FIXTURES.projectEntries, {
            extensions: mode
        })
        assert.equal(project.extensions.altium.$meta.completeness, completeness)
        assert.deepEqual(project.extensions.altium.$meta.included, included)
    }

    const none = ProjectLoader.load(FIXTURES.projectEntries, {
        extensions: 'none'
    })
    assert.deepEqual(none.extensions, {})

    const noneSelected = ProjectLoader.load(FIXTURES.projectEntries, {
        extensions: []
    })
    assert.deepEqual(noneSelected.extensions, {})

    const selected = ProjectLoader.load(FIXTURES.projectEntries, {
        extensions: ['altium.entry-order']
    })
    assert.deepEqual(selected.extensions.altium.$meta.included, [
        'altium.entry-order'
    ])
})

test('direct asynchronous project loading emits common ordered progress', async () => {
    const progress = []
    await ProjectLoader.loadAsync(FIXTURES.projectEntries, {
        worker: false,
        onProgress: (row) => progress.push(row)
    })

    assert.deepEqual(
        progress.map((row) => row.stage),
        ['detect', 'project', 'project', 'complete']
    )
    assert.equal(progress[1].completed, 0)
    assert.equal(progress[2].completed, 1)
})

test('direct asynchronous project loading honors cancellation', async () => {
    const controller = new AbortController()
    controller.abort()

    await assert.rejects(
        ProjectLoader.loadAsync(FIXTURES.projectEntries, {
            worker: false,
            signal: controller.signal
        }),
        (error) => error?.code === 'ERR_CANCELLED'
    )
})

test('project signal accepts null and rejects other non-signals', async () => {
    assert.equal(
        ProjectLoader.load(FIXTURES.projectEntries, { signal: null }).documents
            .length,
        1
    )
    assert.equal(
        (
            await ProjectLoader.loadAsync(FIXTURES.projectEntries, {
                worker: false,
                signal: null
            })
        ).documents.length,
        1
    )
    for (const signal of [false, 0, '']) {
        await assert.rejects(
            ProjectLoader.loadAsync(FIXTURES.projectEntries, {
                worker: false,
                signal
            }),
            (error) => error?.code === 'ERR_PROJECT_INPUT'
        )
    }
})

test('direct project progress callback errors preserve host identity', async () => {
    const sentinel = new Error('host progress failed')
    await assert.rejects(
        ProjectLoader.loadAsync(FIXTURES.projectEntries, {
            worker: false,
            onProgress: () => {
                throw sentinel
            }
        }),
        (error) => error === sentinel
    )
})

test('direct project loading prefers MessageChannel to timer fallback', async () => {
    const originalMessageChannel = globalThis.MessageChannel
    const originalSetImmediate = globalThis.setImmediate
    const originalSetTimeout = globalThis.setTimeout
    let channels = 0
    let timeouts = 0
    class CountingMessageChannel extends originalMessageChannel {
        /** Creates one counted host channel. */
        constructor() {
            super()
            channels += 1
        }
    }
    globalThis.MessageChannel = CountingMessageChannel
    globalThis.setImmediate = undefined
    globalThis.setTimeout = (callback) => {
        timeouts += 1
        queueMicrotask(callback)
        return 0
    }
    try {
        await ProjectLoader.loadAsync(FIXTURES.projectEntries, {
            worker: false
        })
        assert.equal(channels, 2)
        assert.equal(timeouts, 0)
    } finally {
        globalThis.MessageChannel = originalMessageChannel
        globalThis.setImmediate = originalSetImmediate
        globalThis.setTimeout = originalSetTimeout
    }
})

test('reference retention bypasses auto worker dispatch', async () => {
    const original = globalThis.Worker
    let constructions = 0
    class UnexpectedWorker {
        /** Records forbidden construction. */
        constructor() {
            constructions += 1
            throw new Error('Worker must not be constructed.')
        }
    }

    AltiumWorkerClient.dispose()
    globalThis.Worker = UnexpectedWorker
    try {
        const project = await ProjectLoader.loadAsync(FIXTURES.projectEntries, {
            retainSource: 'reference',
            worker: 'auto'
        })
        assert.equal(project.documents.length, 1)
        assert.equal(constructions, 0)
    } finally {
        AltiumWorkerClient.dispose()
        if (original === undefined) delete globalThis.Worker
        else globalThis.Worker = original
    }
})
