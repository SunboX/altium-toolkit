// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { PcbBoardRegionSemanticsParser } from './PcbBoardRegionSemanticsParser.mjs'
import { PcbLayerStackReadModelBuilder } from './PcbLayerStackReadModelBuilder.mjs'

/**
 * Parses read-only layer-stack interchange text into the PCB stack sidecar.
 */
export class PcbLayerStackInterchangeParser {
    /**
     * Parses a UTF-8 layer-stack interchange buffer.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer} arrayBuffer Source bytes.
     * @returns {object}
     */
    static parseArrayBuffer(fileName, arrayBuffer) {
        return PcbLayerStackInterchangeParser.parseText(
            fileName,
            new TextDecoder().decode(arrayBuffer)
        )
    }

    /**
     * Parses layer-stack interchange text.
     * @param {string} fileName Source file name.
     * @param {string} text Source text.
     * @returns {object}
     */
    static parseText(fileName, text) {
        const format = PcbLayerStackInterchangeParser.#format(fileName, text)
        const fields = PcbLayerStackInterchangeParser.parseTextToFields(text, {
            format
        })
        const layers = AltiumLayoutParser.parseLayerStack(fields)
        const layerSubstacks =
            PcbBoardRegionSemanticsParser.parseLayerSubstacks([fields])
        const model = PcbLayerStackReadModelBuilder.build({
            fileName,
            boardRecords: [{ fields }],
            streamNames: [],
            layers,
            primitiveLayers: [],
            layerSubstacks,
            boardRegions: []
        })

        return {
            ...model,
            source: {
                ...model.source,
                interchangeFormat: format
            }
        }
    }

    /**
     * Converts layer-stack interchange text into board-compatible fields.
     * @param {string} text Source text.
     * @param {{ format?: 'stackup' | 'stackupx' }} options Parse options.
     * @returns {Record<string, string>}
     */
    static parseTextToFields(text, options = {}) {
        const format =
            options.format || PcbLayerStackInterchangeParser.#format('', text)

        return format === 'stackupx'
            ? PcbLayerStackInterchangeParser.#stackupxFields(text)
            : PcbLayerStackInterchangeParser.#stackupFields(text)
    }

    /**
     * Detects the interchange format.
     * @param {string} fileName Source file name.
     * @param {string} text Source text.
     * @returns {'stackup' | 'stackupx'}
     */
    static #format(fileName, text) {
        const lowerName = String(fileName || '').toLowerCase()
        if (lowerName.endsWith('.stackupx')) return 'stackupx'
        if (
            String(text || '')
                .trimStart()
                .startsWith('<')
        )
            return 'stackupx'
        return 'stackup'
    }

    /**
     * Converts simple sectioned stackup text into board fields.
     * @param {string} text Source text.
     * @returns {Record<string, string>}
     */
    static #stackupFields(text) {
        const fields = {}
        let section = ''

        for (const rawLine of String(text || '').split(/\r?\n/u)) {
            const line = rawLine.trim()
            if (!line || line.startsWith('#')) continue
            const sectionMatch = /^\[([^\]]+)\]$/u.exec(line)
            if (sectionMatch) {
                section = sectionMatch[1]
                continue
            }

            const separator = line.indexOf('=')
            if (separator < 0 || !section) continue
            PcbLayerStackInterchangeParser.#assignSectionField(
                fields,
                section,
                line.slice(0, separator).trim(),
                line.slice(separator + 1).trim()
            )
        }

        return fields
    }

    /**
     * Converts XML-like stackup text into board fields.
     * @param {string} text Source XML text.
     * @returns {Record<string, string>}
     */
    static #stackupxFields(text) {
        const fields = {}

        if (PcbLayerStackInterchangeParser.#hasTag(text, 'StackupDocument')) {
            PcbLayerStackInterchangeParser.#assignStackupDocumentFields(
                fields,
                text
            )
            return fields
        }

        for (const layer of PcbLayerStackInterchangeParser.#tagFields(text, [
            'Layer'
        ])) {
            const index = Number.parseInt(layer.Index || layer.index || '0', 10)
            PcbLayerStackInterchangeParser.#assignLayerFields(
                fields,
                index,
                layer
            )
        }
        for (const substack of PcbLayerStackInterchangeParser.#tagFields(text, [
            'Substack'
        ])) {
            const index = Number.parseInt(
                substack.Index || substack.index || '0',
                10
            )
            PcbLayerStackInterchangeParser.#assignSubstackFields(
                fields,
                index,
                substack
            )
        }
        for (const branch of PcbLayerStackInterchangeParser.#tagBlocks(text, [
            'Branch'
        ])) {
            const index = Number.parseInt(
                branch.fields.Index || branch.fields.index || '0',
                10
            )
            PcbLayerStackInterchangeParser.#assignBranchFields(
                fields,
                index,
                branch.fields,
                branch.body
            )
        }
        for (const span of PcbLayerStackInterchangeParser.#tagFields(text, [
            'ViaSpan',
            'BackdrillSpan'
        ])) {
            const index = Number.parseInt(span.Index || span.index || '0', 10)
            const prefix =
                span.__tagName === 'ViaSpan' ? 'VIASPAN' : 'BACKDRILLSPAN'
            PcbLayerStackInterchangeParser.#assignIndexedFields(
                fields,
                prefix,
                index,
                span
            )
        }

        return fields
    }

    /**
     * Converts StackupDocument XML into board-compatible fields.
     * @param {Record<string, string>} fields Target fields.
     * @param {string} text Source XML text.
     * @returns {void}
     */
    static #assignStackupDocumentFields(fields, text) {
        const document = PcbLayerStackInterchangeParser.#tagBlocks(text, [
            'StackupDocument'
        ])[0]

        if (!document) {
            return
        }

        PcbLayerStackInterchangeParser.#assignTopLevelFields(
            fields,
            'STACKUPX',
            document.fields,
            {
                SerializerVersion: 'SERIALIZER_VERSION',
                RevisionId: 'REVISION_ID'
            }
        )
        PcbLayerStackInterchangeParser.#assignStackupFeatures(
            fields,
            document.body
        )

        const stackup = PcbLayerStackInterchangeParser.#tagBlocks(
            document.body,
            ['Stackup']
        )[0]

        if (!stackup) {
            return
        }

        PcbLayerStackInterchangeParser.#assignTopLevelFields(
            fields,
            'STACKUPX',
            stackup.fields,
            {
                Type: 'TYPE',
                RoughnessType: 'ROUGHNESS_TYPE',
                RoughnessFactorSR: 'ROUGHNESS_FACTOR_SR',
                RoughnessFactor: 'ROUGHNESS_FACTOR',
                RealisticRatio: 'REALISTIC_RATIO'
            }
        )

        const stacks = PcbLayerStackInterchangeParser.#stackupStacks(
            stackup.body
        )
        let nextLayerIndex = 1

        stacks.forEach((stack, stackIndex) => {
            const layers = PcbLayerStackInterchangeParser.#stackLayers(
                stack.body
            )
            const layerIds = []

            PcbLayerStackInterchangeParser.#assignSubstackFields(
                fields,
                stackIndex,
                {
                    Id: stack.fields.Id || stack.fields.ID || '',
                    Name: stack.fields.Name || '',
                    IsFlex: stack.fields.IsFlex || '',
                    StackType: stack.fields.Type || ''
                }
            )

            for (const layer of layers) {
                const layerIndex =
                    PcbLayerStackInterchangeParser.#positiveInteger(
                        layer.fields.Index || layer.fields.index
                    ) || nextLayerIndex
                const layerId =
                    PcbLayerStackInterchangeParser.#positiveInteger(
                        layer.fields.LayerId || layer.fields.LayerID
                    ) || layerIndex
                const properties =
                    PcbLayerStackInterchangeParser.#layerProperties(layer.body)
                const layerValues =
                    PcbLayerStackInterchangeParser.#stackupDocumentLayerValues(
                        layer,
                        layerId,
                        properties
                    )

                PcbLayerStackInterchangeParser.#assignLayerFields(
                    fields,
                    layerIndex,
                    layerValues
                )
                layerIds.push(layerId)
                nextLayerIndex = Math.max(nextLayerIndex, layerIndex + 1)
            }

            if (layerIds.length) {
                fields['V9_SUBSTACK' + stackIndex + '_LAYERS'] =
                    layerIds.join(',')
            }
        })
    }

    /**
     * Assigns StackupDocument feature rows.
     * @param {Record<string, string>} fields Target fields.
     * @param {string} body Document body.
     * @returns {void}
     */
    static #assignStackupFeatures(fields, body) {
        const features = PcbLayerStackInterchangeParser.#tagBlocks(body, [
            'Feature'
        ])

        features.forEach((feature, index) => {
            const prefix = 'STACKUPX_FEATURE' + index + '_'
            const featureId = feature.fields.Id || feature.fields.ID || ''
            const featureKind =
                PcbLayerStackInterchangeParser.#featureKindFromId(featureId)

            fields[prefix + 'ID'] = featureId
            fields[prefix + 'NAME'] =
                PcbLayerStackInterchangeParser.#decodeXmlText(feature.body)
            if (featureKind) {
                fields[prefix + 'KIND'] = featureKind
            }
        })
    }

    /**
     * Finds stack rows inside the Stackup/Stacks container.
     * @param {string} stackupBody Stackup XML body.
     * @returns {{ tagName: string, fields: Record<string, string>, body: string }[]}
     */
    static #stackupStacks(stackupBody) {
        const stacksContainer = PcbLayerStackInterchangeParser.#tagBlocks(
            stackupBody,
            ['Stacks']
        )[0]

        return PcbLayerStackInterchangeParser.#tagBlocks(
            stacksContainer?.body || '',
            ['Stack']
        )
    }

    /**
     * Finds layer rows inside one Stack/Layers container.
     * @param {string} stackBody Stack XML body.
     * @returns {{ tagName: string, fields: Record<string, string>, body: string }[]}
     */
    static #stackLayers(stackBody) {
        const layersContainer = PcbLayerStackInterchangeParser.#tagBlocks(
            stackBody,
            ['Layers']
        )[0]

        return PcbLayerStackInterchangeParser.#tagBlocks(
            layersContainer?.body || '',
            ['Layer']
        )
    }

    /**
     * Converts one StackupDocument Layer element into known field names.
     * @param {{ fields: Record<string, string>, body: string }} layer Layer block.
     * @param {number} layerId Normalized layer id.
     * @param {Record<string, string>} properties Layer properties.
     * @returns {Record<string, string>}
     */
    static #stackupDocumentLayerValues(layer, layerId, properties) {
        const typeId = layer.fields.TypeId || layer.fields.TypeID || ''
        const values = {
            Name: layer.fields.Name || '',
            LayerId: String(layerId),
            Kind:
                layer.fields.Kind ||
                layer.fields.Type ||
                PcbLayerStackInterchangeParser.#kindFromLayerTypeId(typeId),
            SourceRecordId: layer.fields.Id || layer.fields.ID || '',
            StackupxShared: layer.fields.IsShared || '',
            StackupxProperties:
                PcbLayerStackInterchangeParser.#propertiesField(properties)
        }

        const propertyValueNames = {
            Material: 'Material',
            Thickness: 'Thickness',
            Weight: 'CopperWeight',
            CopperThickness: 'CopperThickness',
            DielectricConstant: 'Dk',
            LossTangent: 'Df',
            Process: 'Process',
            PullbackDistance: 'PullbackDistance',
            CopperOrientation: 'CopperOrientation',
            Orientation: 'Orientation',
            Note: 'Note',
            Comment: 'Comment',
            'Material.Manufacturer': 'MaterialManufacturer',
            'Material.Description': 'MaterialDescription',
            'Material.GlassTransitionTemp': 'MaterialGlassTransitionTemp',
            GlassTransTemp: 'GlassTransitionTemp',
            DielectricStrength: 'DielectricStrength',
            VolumeResistivity: 'VolumeResistivity',
            Resin: 'Resin',
            Solid: 'Solid',
            'Material.Frequency': 'MaterialFrequency',
            Frequency: 'Frequency',
            Constructions: 'Constructions',
            CoverlayExpansion: 'CoverlayExpansion'
        }

        for (const [propertyName, valueName] of Object.entries(
            propertyValueNames
        )) {
            PcbLayerStackInterchangeParser.#assignPropertyValue(
                values,
                properties,
                propertyName,
                valueName
            )
        }

        if (PcbLayerStackInterchangeParser.#isAdhesiveLayerType(typeId)) {
            values.IsAdhesive = 'true'
        }
        if (PcbLayerStackInterchangeParser.#isStiffenerLayerType(typeId)) {
            values.IsStiffener = 'true'
        }

        return values
    }

    /**
     * Assigns one sectioned text field.
     * @param {Record<string, string>} fields Target fields.
     * @param {string} section Section name.
     * @param {string} key Key.
     * @param {string} value Value.
     * @returns {void}
     */
    static #assignSectionField(fields, section, key, value) {
        const match =
            /^(Layer|Substack|Branch|ImpedanceProfile|TransmissionLine|ViaSpan|BackdrillSpan)(\d+)$/u.exec(
                section
            )
        if (!match) return

        const [, family, indexText] = match
        const index = Number.parseInt(indexText, 10)
        if (family === 'Layer') {
            PcbLayerStackInterchangeParser.#assignLayerField(
                fields,
                index,
                key,
                value
            )
            return
        }
        if (family === 'Substack') {
            PcbLayerStackInterchangeParser.#assignSubstackField(
                fields,
                index,
                key,
                value
            )
            return
        }

        const prefix =
            family === 'ImpedanceProfile'
                ? 'IMPEDANCEPROFILE'
                : family.toUpperCase()
        fields[prefix + index + '_' + key.toUpperCase()] = value
    }

    /**
     * Assigns XML layer fields.
     * @param {Record<string, string>} fields Target fields.
     * @param {number} index Layer index.
     * @param {Record<string, string>} values Source values.
     * @returns {void}
     */
    static #assignLayerFields(fields, index, values) {
        for (const [key, value] of Object.entries(values)) {
            PcbLayerStackInterchangeParser.#assignLayerField(
                fields,
                index,
                key,
                value
            )
        }
    }

    /**
     * Assigns one layer field.
     * @param {Record<string, string>} fields Target fields.
     * @param {number} index Layer index.
     * @param {string} key Source key.
     * @param {string} value Source value.
     * @returns {void}
     */
    static #assignLayerField(fields, index, key, value) {
        const suffixByKey = {
            Name: 'NAME',
            LayerId: 'LAYERID',
            Kind: 'KIND',
            Material: 'MATERIAL',
            Thickness: 'THICKNESS',
            CopperThickness: 'COPPERTHICKNESS',
            Dk: 'DK',
            Df: 'DF',
            Process: 'PROCESS',
            PullbackDistance: 'PULLBACKDISTANCE',
            CopperOrientation: 'COPPERORIENTATION',
            Orientation: 'ORIENTATION',
            Note: 'NOTE',
            Comment: 'COMMENT',
            MaterialManufacturer: 'MATERIALMANUFACTURER',
            MaterialDescription: 'MATERIALDESCRIPTION',
            MaterialGlassTransitionTemp: 'MATERIALGLASSTRANSITIONTEMP',
            GlassTransitionTemp: 'GLASSTRANSITIONTEMP',
            DielectricStrength: 'DIELECTRICSTRENGTH',
            VolumeResistivity: 'VOLUMERESISTIVITY',
            Resin: 'RESIN',
            Solid: 'SOLID',
            MaterialFrequency: 'MATERIALFREQUENCY',
            Frequency: 'FREQUENCY',
            Constructions: 'CONSTRUCTIONS',
            IsAdhesive: 'ISADHESIVE',
            IsStiffener: 'ISSTIFFENER',
            CopperWeight: 'COPPERWEIGHT',
            CoverlayExpansion: 'COVERLAYEXPANSION',
            SurfaceFinish: 'SURFACEFINISH',
            SourceRecordId: 'SOURCE_RECORD_ID',
            SourceKeys: 'SOURCE_KEYS',
            StackupxShared: 'STACKUPX_SHARED',
            StackupxProperties: 'STACKUPX_PROPERTIES'
        }
        const suffix = suffixByKey[key]
        if (!suffix) return
        fields['V9_STACK_LAYER' + index + '_' + suffix] = value
    }

    /**
     * Assigns XML substack fields.
     * @param {Record<string, string>} fields Target fields.
     * @param {number} index Substack index.
     * @param {Record<string, string>} values Source values.
     * @returns {void}
     */
    static #assignSubstackFields(fields, index, values) {
        for (const [key, value] of Object.entries(values)) {
            PcbLayerStackInterchangeParser.#assignSubstackField(
                fields,
                index,
                key,
                value
            )
        }
    }

    /**
     * Assigns one substack field.
     * @param {Record<string, string>} fields Target fields.
     * @param {number} index Substack index.
     * @param {string} key Source key.
     * @param {string} value Source value.
     * @returns {void}
     */
    static #assignSubstackField(fields, index, key, value) {
        const suffixByKey = {
            Id: 'ID',
            Name: 'NAME',
            IsFlex: 'ISFLEX',
            Layers: 'LAYERS',
            StackupxShared: 'STACKUPX_SHARED',
            StackType: 'STACKUPX_STACKTYPE'
        }
        const suffix = suffixByKey[key]
        if (!suffix) return
        fields['V9_SUBSTACK' + index + '_' + suffix] = value
    }

    /**
     * Assigns one branch and nested section/stack fields.
     * @param {Record<string, string>} fields Target fields.
     * @param {number} index Branch index.
     * @param {Record<string, string>} values Branch fields.
     * @param {string} body Branch body.
     * @returns {void}
     */
    static #assignBranchFields(fields, index, values, body) {
        fields['STACKBRANCH' + index + '_ID'] = values.Id || values.ID || ''
        fields['STACKBRANCH' + index + '_NAME'] = values.Name || ''

        for (const section of PcbLayerStackInterchangeParser.#tagBlocks(body, [
            'Section'
        ])) {
            const sectionIndex = Number.parseInt(
                section.fields.Index || '0',
                10
            )
            const sectionPrefix =
                'STACKBRANCH' + index + '_SECTION' + sectionIndex
            fields[sectionPrefix + '_ID'] = section.fields.Id || ''
            fields[sectionPrefix + '_NAME'] = section.fields.Name || ''
            fields[sectionPrefix + '_PARENTID'] = section.fields.ParentId || ''

            for (const stack of PcbLayerStackInterchangeParser.#tagFields(
                section.body,
                ['Stack']
            )) {
                const stackIndex = Number.parseInt(stack.Index || '0', 10)
                const stackPrefix = sectionPrefix + '_STACK' + stackIndex
                PcbLayerStackInterchangeParser.#assignStackFields(
                    fields,
                    stackPrefix,
                    stack
                )
            }
        }
    }

    /**
     * Assigns branch stack fields.
     * @param {Record<string, string>} fields Target fields.
     * @param {string} prefix Field prefix.
     * @param {Record<string, string>} stack Stack fields.
     * @returns {void}
     */
    static #assignStackFields(fields, prefix, stack) {
        const keyMap = {
            Ref: 'REF',
            MaterialUsage: 'MATERIALUSAGE',
            Source: 'SOURCE',
            IntrusionLeftBottom: 'INTRUSIONLEFTBOTTOM',
            IntrusionLeftTop: 'INTRUSIONLEFTTOP',
            IntrusionRightBottom: 'INTRUSIONRIGHTBOTTOM',
            IntrusionRightTop: 'INTRUSIONRIGHTTOP'
        }

        for (const [sourceKey, suffix] of Object.entries(keyMap)) {
            if (stack[sourceKey])
                fields[prefix + '_' + suffix] = stack[sourceKey]
        }
    }

    /**
     * Assigns indexed span fields.
     * @param {Record<string, string>} fields Target fields.
     * @param {string} prefix Field prefix.
     * @param {number} index Row index.
     * @param {Record<string, string>} values Source values.
     * @returns {void}
     */
    static #assignIndexedFields(fields, prefix, index, values) {
        const keyMap = {
            Id: 'ID',
            Name: 'NAME',
            StartLayer: 'STARTLAYER',
            EndLayer: 'ENDLAYER',
            TargetStub: 'TARGETSTUB'
        }

        for (const [sourceKey, suffix] of Object.entries(keyMap)) {
            if (values[sourceKey]) {
                fields[prefix + index + '_' + suffix] = values[sourceKey]
            }
        }
    }

    /**
     * Assigns top-level scalar fields using one prefix.
     * @param {Record<string, string>} fields Target fields.
     * @param {string} prefix Field prefix.
     * @param {Record<string, string>} values Source attributes.
     * @param {Record<string, string>} keyMap Source-to-target suffixes.
     * @returns {void}
     */
    static #assignTopLevelFields(fields, prefix, values, keyMap) {
        for (const [sourceKey, suffix] of Object.entries(keyMap)) {
            if (values[sourceKey]) {
                fields[prefix + '_' + suffix] = values[sourceKey]
            }
        }
    }

    /**
     * Assigns one known property value to layer values.
     * @param {Record<string, string>} values Target values.
     * @param {Record<string, string>} properties Source properties.
     * @param {string} propertyName Source property name.
     * @param {string} valueName Target value name.
     * @returns {void}
     */
    static #assignPropertyValue(values, properties, propertyName, valueName) {
        if (properties[propertyName]) {
            values[valueName] = properties[propertyName]
        }
    }

    /**
     * Parses nested layer Property elements into a key/value map.
     * @param {string} body Layer XML body.
     * @returns {Record<string, string>}
     */
    static #layerProperties(body) {
        const propertiesContainer = PcbLayerStackInterchangeParser.#tagBlocks(
            body,
            ['Properties']
        )[0]
        const properties = {}

        for (const property of PcbLayerStackInterchangeParser.#tagBlocks(
            propertiesContainer?.body || '',
            ['Property']
        )) {
            const name = property.fields.Name || property.fields.name || ''
            if (!name) {
                continue
            }

            properties[name] = PcbLayerStackInterchangeParser.#decodeXmlText(
                property.body
            )
        }

        return properties
    }

    /**
     * Serializes property rows into the existing key/value sidecar field.
     * @param {Record<string, string>} properties Source properties.
     * @returns {string}
     */
    static #propertiesField(properties) {
        return Object.entries(properties)
            .map(([key, value]) => key + '=' + value)
            .join('|')
    }

    /**
     * Resolves a positive integer.
     * @param {string | number | undefined} value Source value.
     * @returns {number}
     */
    static #positiveInteger(value) {
        const parsed = Number.parseInt(String(value || ''), 10)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
    }

    /**
     * Returns true when text contains the requested XML-like tag.
     * @param {string} text Source text.
     * @param {string} tagName Tag name.
     * @returns {boolean}
     */
    static #hasTag(text, tagName) {
        return new RegExp('<\\s*' + tagName + '\\b', 'iu').test(
            String(text || '')
        )
    }

    /**
     * Decodes simple XML text content used by stack metadata.
     * @param {string} value Encoded text.
     * @returns {string}
     */
    static #decodeXmlText(value) {
        return String(value || '')
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
            .replace(/&quot;/gu, '"')
            .replace(/&apos;/gu, "'")
            .replace(/&lt;/gu, '<')
            .replace(/&gt;/gu, '>')
            .replace(/&amp;/gu, '&')
            .trim()
    }

    /**
     * Maps known stack layer type ids to broad layer kinds.
     * @param {string} typeId Source type id.
     * @returns {string}
     */
    static #kindFromLayerTypeId(typeId) {
        const normalized = PcbLayerStackInterchangeParser.#normalizeGuid(typeId)
        const kindByTypeId = new Map([
            ['31E48829-E750-4C28-95E0-1A8313F0158E', 'signal'],
            ['F59FAB94-C5ED-467D-94CD-F60A323C5D5B', 'plane'],
            ['F4ECCD87-2CFB-4F37-BE50-4F3A272B4D01', 'signal'],
            ['B0827674-798C-4CF8-807C-8E6C2A11C145', 'finish'],
            ['92B02D5E-8D69-48A8-880E-AC4B77DB099D', 'dielectric'],
            ['136C62EF-1FA6-4897-AE71-7E797B632B92', 'dielectric'],
            ['1A79611A-039D-4D40-A204-53C26C50F8B5', 'dielectric'],
            ['90B89AA0-A48A-45F4-82F5-B3ECA4EC8CCE', 'plating'],
            ['448F9952-79BA-41D8-A8F4-4713EE7A3828', 'mechanical'],
            ['9FD889FA-C97A-401C-A066-E5F746678381', 'mechanical'],
            ['786B5F28-F093-4084-BBA7-46E8F4F24F55', 'mechanical'],
            ['886956F5-B2E9-4114-93F3-F69AF872BFFB', 'marking']
        ])

        return kindByTypeId.get(normalized) || ''
    }

    /**
     * Maps known stackup feature ids to stable feature kinds.
     * @param {string} featureId Source feature id.
     * @returns {string}
     */
    static #featureKindFromId(featureId) {
        const normalized =
            PcbLayerStackInterchangeParser.#normalizeGuid(featureId)
        const kindByFeatureId = new Map([
            ['C8939E8A-FD0E-4D52-8860-B7A98F452016', 'standard-stackup'],
            ['E3DF2B86-5F1B-49CA-B266-D1AE57F0BA6F', 'impedance-calculator'],
            ['5277E6A4-9E5F-4F54-951F-DC18CFEB7530', 'rigid-flex'],
            ['68E477FE-0406-4BD2-AD1D-6DD49217052C', 'printed-electronics'],
            ['0A82BA33-E4D8-43F3-9C01-412DC26BDD5E', 'back-drills'],
            ['231FB828-14F8-43F8-9DDF-B2A90A4C5283', 'generic-stackup']
        ])

        return kindByFeatureId.get(normalized) || ''
    }

    /**
     * Normalizes GUID text for case-insensitive lookup.
     * @param {string} value Source GUID text.
     * @returns {string}
     */
    static #normalizeGuid(value) {
        return String(value || '')
            .trim()
            .replace(/[{}]/gu, '')
            .toUpperCase()
    }

    /**
     * Returns true for known adhesive layer type ids.
     * @param {string} typeId Source type id.
     * @returns {boolean}
     */
    static #isAdhesiveLayerType(typeId) {
        return (
            PcbLayerStackInterchangeParser.#normalizeGuid(typeId) ===
            '448F9952-79BA-41D8-A8F4-4713EE7A3828'
        )
    }

    /**
     * Returns true for known stiffener layer type ids.
     * @param {string} typeId Source type id.
     * @returns {boolean}
     */
    static #isStiffenerLayerType(typeId) {
        return (
            PcbLayerStackInterchangeParser.#normalizeGuid(typeId) ===
            '9FD889FA-C97A-401C-A066-E5F746678381'
        )
    }

    /**
     * Extracts XML-like tag fields.
     * @param {string} text Source text.
     * @param {string[]} tagNames Tag names.
     * @returns {Record<string, string>[]}
     */
    static #tagFields(text, tagNames) {
        return PcbLayerStackInterchangeParser.#tagBlocks(text, tagNames).map(
            (block) => ({
                __tagName: block.tagName,
                ...block.fields
            })
        )
    }

    /**
     * Extracts XML-like tag blocks.
     * @param {string} text Source text.
     * @param {string[]} tagNames Tag names.
     * @returns {{ tagName: string, fields: Record<string, string>, body: string }[]}
     */
    static #tagBlocks(text, tagNames) {
        const names = tagNames
            .map((tagName) => tagName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
            .join('|')
        const pattern = new RegExp(
            '<\\s*(' +
                names +
                ')\\b([^>]*)>([\\s\\S]*?)<\\/\\s*\\1\\s*>|<\\s*(' +
                names +
                ')\\b([^>]*)\\/>',
            'giu'
        )
        const blocks = []
        let match = pattern.exec(text || '')
        while (match) {
            blocks.push({
                tagName: match[1] || match[4],
                fields: PcbLayerStackInterchangeParser.#attributes(
                    match[2] || match[5] || ''
                ),
                body: match[3] || ''
            })
            match = pattern.exec(text || '')
        }
        return blocks
    }

    /**
     * Parses XML-like attributes.
     * @param {string} text Attribute text.
     * @returns {Record<string, string>}
     */
    static #attributes(text) {
        const fields = {}
        const pattern = /([A-Za-z0-9_.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gu
        let match = pattern.exec(text || '')
        while (match) {
            fields[match[1]] = match[3] ?? match[4] ?? ''
            match = pattern.exec(text || '')
        }
        return fields
    }
}
