// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerStackReadModelBuilder } from '../../src/core/altium/PcbLayerStackReadModelBuilder.mjs'
import { PcbLayerStackSourceMetadataParser } from '../../src/core/altium/PcbLayerStackSourceMetadataParser.mjs'

/**
 * Wraps fields in the same case-insensitive lookup shape used by parsed
 * printable records while exposing key enumeration counts.
 * @param {Record<string, string>} fields Source fields.
 * @param {() => void} onOwnKeys Own-key enumeration callback.
 * @returns {Record<string, string>}
 */
function caseInsensitiveFields(fields, onOwnKeys) {
    const keyByLowercase = new Map(
        Object.keys(fields).map((key) => [key.toLowerCase(), key])
    )

    return new Proxy(fields, {
        get(target, property, receiver) {
            if (typeof property !== 'string' || property in target) {
                return Reflect.get(target, property, receiver)
            }
            const realKey = keyByLowercase.get(property.toLowerCase())
            return realKey ? Reflect.get(target, realKey, receiver) : undefined
        },
        has(target, property) {
            if (typeof property !== 'string' || property in target) {
                return Reflect.has(target, property)
            }
            return keyByLowercase.has(property.toLowerCase())
        },
        ownKeys(target) {
            onOwnKeys()
            return Reflect.ownKeys(target)
        }
    })
}

test('PcbLayerStackSourceMetadataParser uses proxy field lookups directly', () => {
    let ownKeyReads = 0
    const fields = caseInsensitiveFields(
        {
            v9_stack_layer1_family: 'copper',
            v9_stack_layer1_sourcefamily: 'native',
            v9_stack_layer1_source_record_id: 'layer-1',
            v9_stack_layer1_source_keys: 'L1',
            v9_stack_layer1_registryref: 'reg-1',
            v9_stack_layer1_modelid: 'model-1',
            v9_stack_layer1_aliases: 'Top',
            v9_stack_layer1_materialcolor: '#ff0000',
            v9_stack_layer1_surfacefinish: 'ENIG',
            v9_stack_layer1_plating: 'gold',
            v9_stack_layer1_coverlayexpansion: '2mil',
            v9_stack_layer1_isstiffener: 'false',
            v9_stack_layer1_isadhesive: 'false',
            v9_stack_layer1_shared: 'true',
            v9_stack_layer1_stackupx_properties: 'foo=bar'
        },
        () => {
            ownKeyReads += 1
        }
    )

    const layerSource = PcbLayerStackSourceMetadataParser.layerSourceFields(
        fields,
        1
    )

    assert.equal(layerSource.family, 'copper')
    assert.equal(layerSource.surfaceFinish, 'ENIG')
    assert.equal(ownKeyReads, 1)
})

test('PcbLayerStackSourceMetadataParser exposes manufacturing layer properties', () => {
    const layerSource = PcbLayerStackSourceMetadataParser.layerSourceFields(
        {
            V9_STACK_LAYER1_PROCESS: 'ED',
            V9_STACK_LAYER1_PULLBACK_DISTANCE: '5mil',
            V9_STACK_LAYER1_COPPER_ORIENTATION: 'Above',
            V9_STACK_LAYER1_ORIENTATION: 'Top',
            V9_STACK_LAYER1_NOTE: 'Primary foil',
            V9_STACK_LAYER1_COMMENT: 'Checked',
            V9_STACK_LAYER1_MATERIAL_MANUFACTURER: 'Maker A',
            V9_STACK_LAYER1_MATERIAL_DESCRIPTION: 'Copper Foil',
            V9_STACK_LAYER1_MATERIAL_GLASS_TRANSITION_TEMP: '180C',
            V9_STACK_LAYER1_GLASS_TRANSITION_TEMP: '175C',
            V9_STACK_LAYER1_DIELECTRIC_STRENGTH: '42kV/mm',
            V9_STACK_LAYER1_VOLUME_RESISTIVITY: '1E12Ohm-m',
            V9_STACK_LAYER1_RESIN: '48%',
            V9_STACK_LAYER1_SOLID: '52%',
            V9_STACK_LAYER1_MATERIAL_FREQUENCY: '1GHz',
            V9_STACK_LAYER1_FREQUENCY: '2GHz',
            V9_STACK_LAYER1_CONSTRUCTIONS: '1080'
        },
        1
    )

    assert.deepEqual(layerSource, {
        process: 'ED',
        pullbackDistance: '5mil',
        copperOrientation: 'Above',
        orientation: 'Top',
        note: 'Primary foil',
        comment: 'Checked',
        materialManufacturer: 'Maker A',
        materialDescription: 'Copper Foil',
        materialGlassTransitionTemp: '180C',
        glassTransitionTemp: '175C',
        dielectricStrength: '42kV/mm',
        volumeResistivity: '1E12Ohm-m',
        resin: '48%',
        solid: '52%',
        materialFrequency: '1GHz',
        frequency: '2GHz',
        constructions: '1080'
    })
})

test('PcbLayerStackReadModelBuilder orders fallback layers from Board6 links', () => {
    const readModel = PcbLayerStackReadModelBuilder.build({
        fileName: 'native-order.PcbDoc',
        boardRecords: [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    LAYER1NAME: 'Top Layer',
                    LAYER1PREV: '0',
                    LAYER1NEXT: '39',
                    LAYER39NAME: 'Plane 1',
                    LAYER39PREV: '1',
                    LAYER39NEXT: '2',
                    LAYER2NAME: 'Mid Layer 1',
                    LAYER2PREV: '39',
                    LAYER2NEXT: '32',
                    LAYER32NAME: 'Bottom Layer',
                    LAYER32PREV: '2',
                    LAYER32NEXT: '0'
                }
            }
        ],
        layers: [],
        primitiveLayers: [
            { layerId: 2, name: 'Mid Layer 1', kind: 'signal' },
            { layerId: 32, name: 'Bottom Layer', kind: 'signal' },
            { layerId: 1, name: 'Top Layer', kind: 'signal' },
            { layerId: 39, name: 'Plane 1', kind: 'power' }
        ],
        layerSubstacks: [],
        boardRegions: []
    })

    assert.deepEqual(
        readModel.layers.map((layer) => ({
            index: layer.index,
            layerId: layer.layerId,
            name: layer.name,
            nativeOrderIndex: layer.nativeOrderIndex
        })),
        [
            {
                index: 1,
                layerId: 1,
                name: 'Top Layer',
                nativeOrderIndex: 1
            },
            { index: 2, layerId: 39, name: 'Plane 1', nativeOrderIndex: 2 },
            {
                index: 3,
                layerId: 2,
                name: 'Mid Layer 1',
                nativeOrderIndex: 3
            },
            {
                index: 4,
                layerId: 32,
                name: 'Bottom Layer',
                nativeOrderIndex: 4
            }
        ]
    )
    assert.deepEqual(readModel.nativeLayerOrder, {
        source: 'Board6/Data',
        layerIds: [1, 39, 2, 32],
        complete: true
    })
})
