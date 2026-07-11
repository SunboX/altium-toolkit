// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicImageDiagnosticsBuilder } from '../../src/legacy-parser.mjs'

test('SchematicImageDiagnosticsBuilder classifies embedded, external, missing, and unsupported images', () => {
    const report = SchematicImageDiagnosticsBuilder.build({
        schematic: {
            images: [
                {
                    fileName: 'panel-preview.bmp',
                    embedded: true,
                    mimeType: 'image/png',
                    sourceMimeType: 'image/bmp',
                    dataBase64: 'AA==',
                    diagnosticState: 'embedded',
                    hasAlpha: true
                },
                {
                    fileName: 'linked-logo.png',
                    embedded: false,
                    diagnosticState: 'external'
                },
                {
                    fileName: 'missing-glyph.bmp',
                    embedded: true,
                    diagnosticState: 'missing-embedded-payload'
                },
                {
                    fileName: 'unknown-payload.bin',
                    embedded: true,
                    mimeType: '',
                    dataBase64: 'AQ==',
                    diagnosticState: 'embedded'
                }
            ]
        }
    })

    assert.equal(report.schema, 'altium-toolkit.schematic.image-diagnostics.a1')
    assert.deepEqual(report.summary, {
        imageCount: 4,
        embeddedImageCount: 3,
        embeddedPayloadCount: 2,
        externalReferenceCount: 1,
        missingPayloadCount: 1,
        unsupportedMimeTypeCount: 1,
        convertedPayloadCount: 1,
        alphaPayloadCount: 1,
        findingCount: 4
    })
    assert.deepEqual(
        report.findings.map((finding) => ({
            code: finding.code,
            imageKey: finding.imageKey,
            severity: finding.severity
        })),
        [
            {
                code: 'schematic.image.converted-payload',
                imageKey: 'schematic-image-0',
                severity: 'info'
            },
            {
                code: 'schematic.image.external-reference',
                imageKey: 'schematic-image-1',
                severity: 'info'
            },
            {
                code: 'schematic.image.missing-embedded-payload',
                imageKey: 'schematic-image-2',
                severity: 'warning'
            },
            {
                code: 'schematic.image.unsupported-mime-type',
                imageKey: 'schematic-image-3',
                severity: 'warning'
            }
        ]
    )
})
