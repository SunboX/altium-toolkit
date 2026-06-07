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
        const fields =
            format === 'stackupx'
                ? PcbLayerStackInterchangeParser.#stackupxFields(text)
                : PcbLayerStackInterchangeParser.#stackupFields(text)
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
            IsAdhesive: 'ISADHESIVE',
            IsStiffener: 'ISSTIFFENER',
            SurfaceFinish: 'SURFACEFINISH',
            SourceRecordId: 'SOURCE_RECORD_ID',
            SourceKeys: 'SOURCE_KEYS',
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
