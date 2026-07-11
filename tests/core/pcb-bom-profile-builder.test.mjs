// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/legacy-parser.mjs'

/**
 * Builds one synthetic PCB component record.
 * @param {object} fields Component fields.
 * @returns {{ sourceStream: string, fields: object }}
 */
function componentRecord(fields) {
    return {
        sourceStream: 'Components6/Data',
        fields: {
            SOURCEDESIGNATOR: fields.designator,
            PATTERN: fields.pattern,
            SOURCELIBREFERENCE: fields.source,
            SOURCEDESCRIPTION: fields.description,
            X: String(fields.x || 0),
            Y: String(fields.y || 0),
            LAYER: fields.layer || 'TOP',
            ROTATION: String(fields.rotation || 0),
            ...fields.native
        }
    }
}

test('PcbModelParser exposes a PCB-only BOM normalization profile', () => {
    const model = PcbModelParser.parse('bom-profile.PcbDoc', [
        componentRecord({
            designator: 'R1',
            pattern: 'R0603',
            source: 'GEN_RES',
            description: '10k',
            native: {
                PARAMETERCOUNT: '5',
                PARAMETER0NAME: 'Manufacturer',
                PARAMETER0VALUE: 'Acme',
                PARAMETER1NAME: 'Manufacturer Part Number',
                PARAMETER1VALUE: 'RC0603-10K',
                PARAMETER2NAME: 'JLCPCB Part #',
                PARAMETER2VALUE: 'C123',
                PARAMETER3NAME: 'Category',
                PARAMETER3VALUE: 'Resistor',
                PARAMETER4NAME: 'Comment',
                PARAMETER4VALUE: '10k'
            }
        }),
        componentRecord({
            designator: 'R2',
            pattern: 'R0603',
            source: 'GEN_RES',
            description: '10k',
            native: {
                PARAMETERCOUNT: '4',
                PARAMETER0NAME: 'MFR',
                PARAMETER0VALUE: 'Acme',
                PARAMETER1NAME: 'MPN',
                PARAMETER1VALUE: 'RC0603-10K',
                PARAMETER2NAME: 'Supplier Part Number',
                PARAMETER2VALUE: 'C123',
                PARAMETER3NAME: 'Category',
                PARAMETER3VALUE: 'Resistor'
            }
        }),
        componentRecord({
            designator: 'TP1',
            pattern: 'TP_FAKE',
            source: 'GEN_TP',
            description: 'Test point',
            native: {
                COMPONENTKIND: '5',
                COMPONENTKINDVERSION2: '5'
            }
        })
    ])

    assert.deepEqual(model.pcb.bomProfile, {
        schema: 'altium-toolkit.pcb.bom-profile.a1',
        source: 'pcb-document',
        summary: {
            componentCount: 3,
            includedComponentCount: 2,
            excludedComponentCount: 1,
            groupCount: 1,
            normalizedParameterCount: 8
        },
        groups: [
            {
                key: 'Acme|RC0603-10K|C123|R0603|10k',
                quantity: 2,
                designators: ['R1', 'R2'],
                pattern: 'R0603',
                source: 'GEN_RES',
                value: '10k',
                normalizedParameters: {
                    manufacturer: 'Acme',
                    manufacturerPartNumber: 'RC0603-10K',
                    supplierPartNumber: 'C123',
                    supplier: 'JLCPCB',
                    category: 'Resistor'
                }
            }
        ],
        components: [
            {
                designator: 'R1',
                includeInBom: true,
                componentKind: 'standard',
                pattern: 'R0603',
                source: 'GEN_RES',
                value: '10k',
                normalizedParameters: {
                    manufacturer: 'Acme',
                    manufacturerPartNumber: 'RC0603-10K',
                    supplierPartNumber: 'C123',
                    supplier: 'JLCPCB',
                    category: 'Resistor',
                    comment: '10k'
                },
                sourceParameterNames: [
                    'Manufacturer',
                    'Manufacturer Part Number',
                    'JLCPCB Part #',
                    'Category',
                    'Comment'
                ]
            },
            {
                designator: 'R2',
                includeInBom: true,
                componentKind: 'standard',
                pattern: 'R0603',
                source: 'GEN_RES',
                value: '10k',
                normalizedParameters: {
                    manufacturer: 'Acme',
                    manufacturerPartNumber: 'RC0603-10K',
                    supplierPartNumber: 'C123',
                    category: 'Resistor'
                },
                sourceParameterNames: [
                    'MFR',
                    'MPN',
                    'Supplier Part Number',
                    'Category'
                ]
            },
            {
                designator: 'TP1',
                includeInBom: false,
                componentKind: 'standard-no-bom',
                pattern: 'TP_FAKE',
                source: 'GEN_TP',
                value: 'Test point',
                normalizedParameters: {},
                sourceParameterNames: []
            }
        ],
        exclusions: [
            {
                designator: 'TP1',
                reason: 'component-kind:no-bom'
            }
        ]
    })
})
