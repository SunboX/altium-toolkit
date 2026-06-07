// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { HostCapabilityDiagnosticsBuilder } from '../../src/parser.mjs'

test('HostCapabilityDiagnosticsBuilder emits structured fallback diagnostics', () => {
    const diagnostics = HostCapabilityDiagnosticsBuilder.build({
        host: {
            runtime: 'ci-node',
            platform: 'test'
        },
        capabilities: {
            fontMetrics: false,
            textOutlines: false,
            stepBounds: true,
            webgl: false
        },
        fallbacks: [
            {
                code: 'render.font.family-fallback',
                severity: 'info',
                target: 'schematic-title',
                from: 'Fixture Sans',
                to: 'Arial'
            },
            {
                code: 'model.bounds.unavailable',
                severity: 'warning',
                target: 'body-1',
                fallback: 'pad-anchor-bounds'
            }
        ]
    })

    assert.deepEqual(diagnostics, {
        schema: 'altium-toolkit.host-capabilities.a1',
        host: {
            runtime: 'ci-node',
            platform: 'test'
        },
        summary: {
            capabilityCount: 4,
            unsupportedCapabilityCount: 3,
            fallbackCount: 2,
            warningCount: 4
        },
        capabilities: [
            {
                key: 'fontMetrics',
                supported: false,
                diagnosticCode: 'host.capability.fontMetrics.unsupported'
            },
            {
                key: 'stepBounds',
                supported: true
            },
            {
                key: 'textOutlines',
                supported: false,
                diagnosticCode: 'host.capability.textOutlines.unsupported'
            },
            {
                key: 'webgl',
                supported: false,
                diagnosticCode: 'host.capability.webgl.unsupported'
            }
        ],
        diagnostics: [
            {
                code: 'host.capability.fontMetrics.unsupported',
                severity: 'warning',
                capability: 'fontMetrics',
                message: 'Host capability fontMetrics is unavailable.'
            },
            {
                code: 'host.capability.textOutlines.unsupported',
                severity: 'warning',
                capability: 'textOutlines',
                message: 'Host capability textOutlines is unavailable.'
            },
            {
                code: 'host.capability.webgl.unsupported',
                severity: 'warning',
                capability: 'webgl',
                message: 'Host capability webgl is unavailable.'
            },
            {
                code: 'render.font.family-fallback',
                severity: 'info',
                target: 'schematic-title',
                from: 'Fixture Sans',
                to: 'Arial',
                message: 'Host fallback render.font.family-fallback was used.'
            },
            {
                code: 'model.bounds.unavailable',
                severity: 'warning',
                target: 'body-1',
                fallback: 'pad-anchor-bounds',
                message: 'Host fallback model.bounds.unavailable was used.'
            }
        ]
    })
})

test('HostCapabilityDiagnosticsBuilder groups host support readiness by category', () => {
    const diagnostics = HostCapabilityDiagnosticsBuilder.build({
        host: {
            runtime: 'ci-node',
            platform: 'test'
        },
        capabilities: {
            compressedContainers: false,
            fontMetrics: false,
            pngCodec: true,
            stepBounds: true,
            webpCodec: false
        },
        fallbacks: [
            {
                code: 'image.codec.preview-fallback',
                category: 'image-codecs',
                severity: 'warning'
            },
            {
                code: 'text.metrics.svg-approximation',
                category: 'text-rendering',
                severity: 'info'
            }
        ],
        readinessCategories: [
            {
                key: 'text-rendering',
                displayName: 'Text rendering',
                capabilityKeys: ['fontMetrics']
            },
            {
                key: 'model-projection',
                displayName: '3D model projection',
                capabilityKeys: ['stepBounds']
            },
            {
                key: 'image-codecs',
                displayName: 'Image codecs',
                capabilityKeys: ['pngCodec', 'webpCodec']
            },
            {
                key: 'container-extraction',
                displayName: 'Compressed container extraction',
                capabilityKeys: ['compressedContainers']
            }
        ]
    })

    assert.deepEqual(diagnostics.readiness, {
        status: 'limited',
        categories: [
            {
                key: 'text-rendering',
                displayName: 'Text rendering',
                status: 'unsupported',
                capabilityKeys: ['fontMetrics'],
                supportedCapabilityCount: 0,
                unsupportedCapabilityCount: 1,
                fallbackCount: 1,
                diagnosticCodes: [
                    'host.capability.fontMetrics.unsupported',
                    'text.metrics.svg-approximation'
                ]
            },
            {
                key: 'model-projection',
                displayName: '3D model projection',
                status: 'supported',
                capabilityKeys: ['stepBounds'],
                supportedCapabilityCount: 1,
                unsupportedCapabilityCount: 0,
                fallbackCount: 0,
                diagnosticCodes: []
            },
            {
                key: 'image-codecs',
                displayName: 'Image codecs',
                status: 'limited',
                capabilityKeys: ['pngCodec', 'webpCodec'],
                supportedCapabilityCount: 1,
                unsupportedCapabilityCount: 1,
                fallbackCount: 1,
                diagnosticCodes: [
                    'host.capability.webpCodec.unsupported',
                    'image.codec.preview-fallback'
                ]
            },
            {
                key: 'container-extraction',
                displayName: 'Compressed container extraction',
                status: 'unsupported',
                capabilityKeys: ['compressedContainers'],
                supportedCapabilityCount: 0,
                unsupportedCapabilityCount: 1,
                fallbackCount: 0,
                diagnosticCodes: [
                    'host.capability.compressedContainers.unsupported'
                ]
            }
        ]
    })
    assert.equal(diagnostics.summary.readinessStatus, 'limited')
    assert.equal(diagnostics.summary.readinessCategoryCount, 4)
})
