// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT_NAMES = [
    'inspect-board',
    'inspect-schematic',
    'extract-bom',
    'generate-pnp',
    'net-report',
    'library-catalog',
    'validate-library',
    'corpus-smoke'
]

/**
 * Builds a small printable schematic with one owned component, one pin, one
 * named net, and one additive field for coverage reporting.
 * @returns {string}
 */
function schematicInspectionSample() {
    return (
        '|HEADER=Schematic Document' +
        '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0|SheetMystery=Y' +
        '|RECORD=1|IndexInSheet=20|LibReference=Part|DesignItemId=Part' +
        '|Location.X=120|Location.Y=40|CurrentPartID=1|PartCount=1' +
        '|RECORD=34|OwnerIndex=20|Name=Designator|Text=U1|IsHidden=F' +
        '|RECORD=27|LocationCount=2|X1=40|Y1=40|X2=120|Y2=40|Color=128|LineWidth=1' +
        '|RECORD=25|Location.X=80|Location.Y=40|Text=GOOD|Color=255|FontID=1' +
        '|RECORD=2|OwnerIndex=20|OwnerPartID=1|PinConglomerate=58|PinLength=20' +
        '|Location.X=120|Location.Y=40|Name=IN|Designator=1'
    )
}

/**
 * Verifies each read-only example script exposes a runnable help surface.
 */
test('read-only example scripts expose help without loading files', async () => {
    for (const scriptName of SCRIPT_NAMES) {
        const { stdout } = await execFileAsync(
            process.execPath,
            ['examples/' + scriptName + '.mjs', '--help'],
            {
                cwd: REPO_ROOT
            }
        )

        assert.match(stdout, new RegExp('Usage: ' + scriptName))
        assert.match(stdout, /read-only/i)
    }
})

/**
 * Verifies the examples index documents the read-only scripts without naming
 * external implementation sources.
 */
test('examples README lists read-only utility scripts generically', async () => {
    const readme = await readFile(resolve(REPO_ROOT, 'examples/README.md'), {
        encoding: 'utf8'
    })

    for (const scriptName of SCRIPT_NAMES) {
        assert.match(readme, new RegExp('examples/' + scriptName + '\\.mjs'))
    }
})

/**
 * Verifies the corpus smoke example scans caller-provided directories without
 * requiring committed native fixtures.
 */
test('corpus-smoke summarizes generated local sample files', async () => {
    const corpusDir = await mkdtemp(join(tmpdir(), 'altium-toolkit-corpus-'))

    try {
        await writeFile(
            join(corpusDir, 'valid.SchDoc'),
            '|HEADER=Schematic Document' +
                '|RECORD=31|CustomX=120|CustomY=80|VisibleGridSize=10|SnapGridSize=5' +
                '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
                '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0'
        )
        await mkdir(join(corpusDir, 'nested'))
        await writeFile(join(corpusDir, 'nested', 'invalid.IntLib'), 'invalid')

        const { stdout } = await execFileAsync(
            process.execPath,
            ['examples/corpus-smoke.mjs', corpusDir, '--json'],
            {
                cwd: REPO_ROOT
            }
        )
        const report = JSON.parse(stdout)
        const validRow = report.files.find(
            (file) => file.relativePath === 'valid.SchDoc'
        )
        const invalidRow = report.files.find(
            (file) => file.relativePath === 'nested/invalid.IntLib'
        )

        assert.deepEqual(report.summary, {
            fileCount: 2,
            parsedCount: 1,
            failedCount: 1
        })
        assert.equal(validRow.status, 'parsed')
        assert.equal(validRow.fileType, 'SchDoc')
        assert.equal(validRow.kind, 'schematic')
        assert.equal(invalidRow.status, 'failed')
        assert.equal(typeof invalidRow.message, 'string')
        assert.notEqual(invalidRow.message, '')
    } finally {
        await rm(corpusDir, { recursive: true, force: true })
    }
})

/**
 * Verifies the corpus smoke example can emit parser coverage counters for
 * caller-owned local sample directories.
 */
test('corpus-smoke reports generated local sample coverage', async () => {
    const corpusDir = await mkdtemp(join(tmpdir(), 'altium-toolkit-corpus-'))

    try {
        await writeFile(
            join(corpusDir, 'valid.SchDoc'),
            '|HEADER=Schematic Document' +
                '|RECORD=31|CustomX=120|CustomY=80|VisibleGridSize=10|SnapGridSize=5' +
                '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
                '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0|SheetMystery=Y' +
                '|RECORD=4|Location.X=40|Location.Y=120|Color=255|FontID=1|Text=FIRST|ExperimentalOffset=12' +
                '|RECORD=4|Location.X=80|Location.Y=120|Color=255|FontID=1|Text=SECOND|ExperimentalOffset=24' +
                '|RECORD=999|Location.X=10|Location.Y=10|Value=OPAQUE'
        )
        await writeFile(join(corpusDir, 'invalid.IntLib'), 'invalid')

        const { stdout } = await execFileAsync(
            process.execPath,
            ['examples/corpus-smoke.mjs', corpusDir, '--json', '--coverage'],
            {
                cwd: REPO_ROOT
            }
        )
        const report = JSON.parse(stdout)

        assert.deepEqual(report.coverage.summary, {
            parsedFileCount: 1,
            fileTypeCount: 1,
            kindCount: 1,
            recordTypeCount: 3,
            unsupportedRecordTypeCount: 1,
            diagnosticCount: 3,
            fieldGapRecordTypeCount: 3,
            unrecognizedFieldCount: 3,
            unrecognizedFieldOccurrenceCount: 4
        })
        assert.deepEqual(report.coverage.fileTypes, [
            {
                fileType: 'SchDoc',
                count: 1
            }
        ])
        assert.deepEqual(report.coverage.kinds, [
            {
                kind: 'schematic',
                count: 1
            }
        ])
        assert.deepEqual(report.coverage.recordTypes, [
            {
                recordType: 4,
                name: 'label',
                family: 'annotation',
                supported: true,
                count: 2,
                fileCount: 1
            },
            {
                recordType: 31,
                name: 'sheet',
                family: 'sheet',
                supported: true,
                count: 1,
                fileCount: 1
            },
            {
                recordType: 999,
                name: 'unknown-999',
                family: 'unknown',
                supported: false,
                count: 1,
                fileCount: 1
            }
        ])
        assert.deepEqual(report.coverage.unsupportedRecordTypes, [
            {
                recordType: 999,
                name: 'unknown-999',
                family: 'unknown',
                supported: false,
                count: 1,
                fileCount: 1
            }
        ])
        assert.deepEqual(report.coverage.fieldGaps, [
            {
                recordType: 4,
                name: 'label',
                family: 'annotation',
                supported: true,
                recordCount: 2,
                fileCount: 1,
                unrecognizedFieldCount: 1,
                unrecognizedOccurrenceCount: 2,
                unrecognizedFields: [
                    {
                        name: 'ExperimentalOffset',
                        count: 2,
                        fileCount: 1
                    }
                ]
            },
            {
                recordType: 31,
                name: 'sheet',
                family: 'sheet',
                supported: true,
                recordCount: 1,
                fileCount: 1,
                unrecognizedFieldCount: 1,
                unrecognizedOccurrenceCount: 1,
                unrecognizedFields: [
                    {
                        name: 'SheetMystery',
                        count: 1,
                        fileCount: 1
                    }
                ]
            },
            {
                recordType: 999,
                name: 'unknown-999',
                family: 'unknown',
                supported: false,
                recordCount: 1,
                fileCount: 1,
                unrecognizedFieldCount: 1,
                unrecognizedOccurrenceCount: 1,
                unrecognizedFields: [
                    {
                        name: 'Value',
                        count: 1,
                        fileCount: 1
                    }
                ]
            }
        ])
        assert.deepEqual(report.coverage.topUnrecognizedFields, [
            {
                recordType: 4,
                recordName: 'label',
                family: 'annotation',
                supported: true,
                fieldName: 'ExperimentalOffset',
                count: 2,
                fileCount: 1
            },
            {
                recordType: 31,
                recordName: 'sheet',
                family: 'sheet',
                supported: true,
                fieldName: 'SheetMystery',
                count: 1,
                fileCount: 1
            },
            {
                recordType: 999,
                recordName: 'unknown-999',
                family: 'unknown',
                supported: false,
                fieldName: 'Value',
                count: 1,
                fileCount: 1
            }
        ])
    } finally {
        await rm(corpusDir, { recursive: true, force: true })
    }
})

/**
 * Verifies the schematic inspection example exposes flat records, hierarchy,
 * parts, nets, and summary views from the normalized parser model.
 */
test('inspect-schematic emits selectable schematic JSON views', async () => {
    const corpusDir = await mkdtemp(join(tmpdir(), 'altium-toolkit-inspect-'))
    const filePath = join(corpusDir, 'synthetic.SchDoc')

    try {
        await writeFile(filePath, schematicInspectionSample())

        const summary = await inspectSchematicJson(filePath, 'summary')
        const flat = await inspectSchematicJson(filePath, 'flat')
        const hierarchy = await inspectSchematicJson(filePath, 'hierarchy')
        const parts = await inspectSchematicJson(filePath, 'parts')
        const nets = await inspectSchematicJson(filePath, 'nets')
        const all = await inspectSchematicJson(filePath, 'all')

        assert.equal(summary.view, 'summary')
        assert.deepEqual(summary.summary, {
            recordCount: 6,
            topLevelRecordCount: 4,
            componentCount: 1,
            netCount: 1,
            diagnosticCount: 3,
            fieldGapRecordTypeCount: 1,
            unrecognizedFieldCount: 1
        })
        assert.equal(flat.view, 'flat')
        assert.equal(flat.records.length, 6)
        assert.equal(flat.records[1].recordType, '1')
        assert.equal(hierarchy.view, 'hierarchy')
        assert.equal(hierarchy.hierarchy.length, 4)
        assert.equal(hierarchy.hierarchy[1].children.length, 2)
        assert.deepEqual(parts.parts, [
            {
                designator: 'U1',
                libReference: 'Part',
                value: '',
                uniqueId: '',
                x: 120,
                y: 40,
                pinCount: 1
            }
        ])
        assert.equal(nets.view, 'nets')
        assert.equal(nets.nets.length, 1)
        assert.equal(nets.nets[0].name, 'GOOD')
        assert.equal(nets.nets[0].pins[0].componentDesignator, 'U1')
        assert.equal(all.view, 'all')
        assert.deepEqual(all.summary, summary.summary)
        assert.equal(all.flat.length, flat.records.length)
        assert.deepEqual(all.hierarchy, hierarchy.hierarchy)
        assert.deepEqual(all.parts, parts.parts)
        assert.deepEqual(all.nets, nets.nets)
    } finally {
        await rm(corpusDir, { recursive: true, force: true })
    }
})

/**
 * Runs the schematic inspection example and parses JSON output.
 * @param {string} filePath Input schematic path.
 * @param {string} view Requested view.
 * @returns {Promise<object>}
 */
async function inspectSchematicJson(filePath, view) {
    const { stdout } = await execFileAsync(
        process.execPath,
        ['examples/inspect-schematic.mjs', filePath, '--json', '--view', view],
        {
            cwd: REPO_ROOT
        }
    )

    return JSON.parse(stdout)
}

/**
 * Verifies an opt-in local corpus path can be exercised by CI or developers
 * without committing native sample documents to the repository.
 */
test(
    'corpus-smoke can scan an opt-in local corpus directory',
    { skip: !process.env.ALTIUM_TOOLKIT_CORPUS_DIR },
    async () => {
        const { stdout } = await execFileAsync(
            process.execPath,
            [
                'examples/corpus-smoke.mjs',
                process.env.ALTIUM_TOOLKIT_CORPUS_DIR,
                '--json',
                '--coverage'
            ],
            {
                cwd: REPO_ROOT
            }
        )
        const report = JSON.parse(stdout)

        assert.equal(
            report.summary.fileCount,
            report.summary.parsedCount + report.summary.failedCount
        )
        assert.equal(typeof report.coverage.summary.parsedFileCount, 'number')
    }
)
