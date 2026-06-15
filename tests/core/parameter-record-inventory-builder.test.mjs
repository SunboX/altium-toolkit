// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies the parameter inventory exposes delimiter structure, duplicate
 * fields, UTF-8 markers, and typed values without changing parser semantics.
 */
test('ParameterRecordInventoryBuilder scans parameter record structure', async () => {
    const { ParameterRecordInventoryBuilder } =
        await import('../../src/parser.mjs')

    const report = ParameterRecordInventoryBuilder.build({
        records: [
            {
                sourceStream: 'FileHeader',
                recordIndex: 3,
                raw:
                    '|RECORD=1||Name=RESET|%UTF8%Text=Micro' +
                    '|Name=RESET_N`Nested=42|Enabled=T|Ratio=1.5|Enabled=F'
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.parameter-record-inventory.a1')
    assert.deepEqual(report.summary, {
        recordCount: 1,
        fieldCount: 8,
        duplicateFieldCount: 2,
        duplicateOccurrenceCount: 2,
        utf8FieldCount: 1,
        nestedFieldCount: 1,
        emptyEntryCount: 1,
        typedFieldCount: 5
    })
    assert.deepEqual(report.records[0].duplicateFields, [
        {
            key: 'Enabled',
            count: 2,
            firstValue: 'T',
            lastValue: 'F'
        },
        {
            key: 'Name',
            count: 2,
            firstValue: 'RESET',
            lastValue: 'RESET_N'
        }
    ])
    assert.deepEqual(
        report.records[0].fields.map((field) => ({
            key: field.key,
            delimiter: field.delimiter,
            level: field.level,
            occurrence: field.occurrence,
            isUtf8: field.isUtf8,
            typedValue: field.typedValue
        })),
        [
            {
                key: 'RECORD',
                delimiter: '|',
                level: 0,
                occurrence: 1,
                isUtf8: false,
                typedValue: { kind: 'integer', value: 1 }
            },
            {
                key: 'Name',
                delimiter: '|',
                level: 0,
                occurrence: 1,
                isUtf8: false,
                typedValue: null
            },
            {
                key: 'Text',
                delimiter: '|',
                level: 0,
                occurrence: 1,
                isUtf8: true,
                typedValue: null
            },
            {
                key: 'Name',
                delimiter: '|',
                level: 0,
                occurrence: 2,
                isUtf8: false,
                typedValue: null
            },
            {
                key: 'Nested',
                delimiter: '`',
                level: 1,
                occurrence: 1,
                isUtf8: false,
                typedValue: { kind: 'integer', value: 42 }
            },
            {
                key: 'Enabled',
                delimiter: '|',
                level: 0,
                occurrence: 1,
                isUtf8: false,
                typedValue: { kind: 'boolean', value: true }
            },
            {
                key: 'Ratio',
                delimiter: '|',
                level: 0,
                occurrence: 1,
                isUtf8: false,
                typedValue: { kind: 'number', value: 1.5 }
            },
            {
                key: 'Enabled',
                delimiter: '|',
                level: 0,
                occurrence: 2,
                isUtf8: false,
                typedValue: { kind: 'boolean', value: false }
            }
        ]
    )
})

/**
 * Verifies the scanner accepts parameter text without an initial pipe marker.
 */
test('ParameterRecordInventoryBuilder scans records without a leading separator', async () => {
    const { ParameterRecordInventoryBuilder } =
        await import('../../src/parser.mjs')

    const record = ParameterRecordInventoryBuilder.scanRecord(
        'Alpha=1|Beta=TRUE',
        { sourceStream: 'LooseRecord', recordIndex: 0 }
    )

    assert.deepEqual(
        record.fields.map((field) => ({
            key: field.key,
            value: field.value,
            typedValue: field.typedValue
        })),
        [
            {
                key: 'Alpha',
                value: '1',
                typedValue: { kind: 'integer', value: 1 }
            },
            {
                key: 'Beta',
                value: 'TRUE',
                typedValue: { kind: 'boolean', value: true }
            }
        ]
    )
    assert.equal(record.emptyEntryCount, 0)
})
