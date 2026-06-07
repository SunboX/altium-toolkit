// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { DraftsmanBoardViewMetadataBuilder } from './DraftsmanBoardViewMetadataBuilder.mjs'
import { DraftsmanImagePayloadManifestBuilder } from './DraftsmanImagePayloadManifestBuilder.mjs'

/**
 * Builds a read-only digest for Draftsman drawing containers.
 */
export class DraftsmanDigestParser {
    static DIGEST_SCHEMA = 'altium-toolkit.draftsman.digest.a1'

    static #LZ4_FRAME_MAGIC = 0x184d2204

    /**
     * Parses one Draftsman container payload into a normalized digest model.
     * @param {string} fileName Draftsman file name.
     * @param {ArrayBuffer} arrayBuffer File bytes.
     * @returns {object}
     */
    static parse(fileName, arrayBuffer) {
        const decoded = DraftsmanDigestParser.#decodePayload(arrayBuffer)
        const text = decoded.text
        if (!DraftsmanDigestParser.#looksLikeTextContainer(text)) {
            return DraftsmanDigestParser.#emptyModel(fileName, [
                ...decoded.diagnostics,
                {
                    severity: 'warning',
                    code: 'draftsman.digest.unsupported-container',
                    message:
                        'Draftsman container is not a supported text-backed digest payload.'
                }
            ])
        }

        const rootFields = DraftsmanDigestParser.#rootFields(text)
        const pages = DraftsmanDigestParser.#pages(text)
        const styles = DraftsmanDigestParser.#styleCatalog(text)
        const unsupportedRawItemCount = pages.reduce(
            (total, page) => total + page.unsupportedRawItems.length,
            0
        )
        const imagePayloads = DraftsmanImagePayloadManifestBuilder.build(pages)
        const boardViewMetadata = DraftsmanBoardViewMetadataBuilder.build(
            text,
            pages
        )
        const diagnostics =
            unsupportedRawItemCount > 0
                ? [
                      ...decoded.diagnostics,
                      {
                          severity: 'warning',
                          code: 'draftsman.digest.unsupported-item',
                          message:
                              'Draftsman digest preserved unsupported drawing items.'
                      }
                  ]
                : decoded.diagnostics

        return DraftsmanDigestParser.#model(fileName, {
            sourceDocumentName:
                rootFields.SourceDocumentName ||
                rootFields.SourceDocument ||
                rootFields.PcbDoc ||
                rootFields.DocumentName ||
                '',
            documentOptions: DraftsmanDigestParser.#documentOptions(rootFields),
            styles,
            pages,
            imagePayloads,
            boardViewMetadata,
            diagnostics
        })
    }

    /**
     * Builds an empty digest model.
     * @param {string} fileName File name.
     * @param {object[]} diagnostics Parser diagnostics.
     * @returns {object}
     */
    static #emptyModel(fileName, diagnostics) {
        return DraftsmanDigestParser.#model(fileName, {
            sourceDocumentName: '',
            pages: [],
            diagnostics
        })
    }

    /**
     * Builds the normalized parser root model.
     * @param {string} fileName File name.
     * @param {{ sourceDocumentName: string, documentOptions?: object, styles?: object, pages: object[], imagePayloads?: object, diagnostics: object[] }} digest Digest payload.
     * @returns {object}
     */
    static #model(fileName, digest) {
        const noteCount = digest.pages.reduce(
            (total, page) => total + page.notes.length,
            0
        )
        const imageCount = digest.pages.reduce(
            (total, page) => total + page.images.length,
            0
        )
        const unsupportedRawItemCount = digest.pages.reduce(
            (total, page) => total + page.unsupportedRawItems.length,
            0
        )
        const fontStyleCount = (digest.styles?.fontStyles || []).length

        return NormalizedModelSchema.attach({
            kind: 'draftsman',
            fileType: 'PCBDwf',
            fileName,
            summary: {
                title: fileName,
                pageCount: digest.pages.length,
                noteCount,
                imageCount,
                fontStyleCount,
                unsupportedRawItemCount
            },
            diagnostics: digest.diagnostics,
            draftsman: {
                schema: DraftsmanDigestParser.DIGEST_SCHEMA,
                sourceDocumentName: digest.sourceDocumentName,
                documentOptions: digest.documentOptions,
                styles: digest.styles,
                pages: digest.pages,
                imagePayloads: digest.imagePayloads,
                ...(digest.boardViewMetadata
                    ? { boardViewMetadata: digest.boardViewMetadata }
                    : {}),
                indexes: DraftsmanDigestParser.#indexes(digest.pages)
            },
            bom: []
        })
    }

    /**
     * Builds page lookup indexes.
     * @param {object[]} pages Digest pages.
     * @returns {object}
     */
    static #indexes(pages) {
        const pagesById = {}
        const pagesByName = {}
        const itemsById = {}
        const imagesById = {}
        for (const page of pages) {
            if (page.id) pagesById[page.id] = page.index
            if (page.name) pagesByName[page.name] = page.index
            for (const [index, item] of (page.items || []).entries()) {
                if (!item.id) continue
                itemsById[item.id] = { pageIndex: page.index, index }
            }
            for (const [index, image] of (page.images || []).entries()) {
                if (!image.id) continue
                imagesById[image.id] = { pageIndex: page.index, index }
            }
        }
        return { pagesById, pagesByName, itemsById, imagesById }
    }

    /**
     * Decodes either a plain text-backed container or a legacy compressed text
     * container.
     * @param {ArrayBuffer} arrayBuffer File bytes.
     * @returns {{ text: string, diagnostics: object[] }}
     */
    static #decodePayload(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer || new ArrayBuffer(0))
        const decompressed = DraftsmanDigestParser.#decodeLz4Frame(bytes)
        if (decompressed) {
            return {
                text: DraftsmanDigestParser.#decodeTextBytes(
                    decompressed.bytes
                ),
                diagnostics: [
                    {
                        severity: 'info',
                        code: 'draftsman.digest.lz4-container',
                        message:
                            'Decoded a compressed Draftsman text container.'
                    }
                ]
            }
        }

        return {
            text: DraftsmanDigestParser.#decodeTextBytes(bytes),
            diagnostics: []
        }
    }

    /**
     * Decodes likely text-backed container payload bytes.
     * @param {Uint8Array} bytes File bytes.
     * @returns {string}
     */
    static #decodeTextBytes(bytes) {
        for (const encoding of ['utf-8', 'windows-1252']) {
            try {
                return new TextDecoder(encoding, { fatal: true }).decode(bytes)
            } catch {
                // Try the next text-compatible legacy encoding.
            }
        }
        return new TextDecoder('windows-1252').decode(bytes)
    }

    /**
     * Decodes a small subset of LZ4 frame containers.
     * @param {Uint8Array} bytes Container bytes.
     * @returns {{ bytes: Uint8Array } | null}
     */
    static #decodeLz4Frame(bytes) {
        if (!DraftsmanDigestParser.#isLz4Frame(bytes)) {
            return null
        }

        try {
            return {
                bytes: DraftsmanDigestParser.#readLz4Frame(bytes)
            }
        } catch {
            return null
        }
    }

    /**
     * Returns true when bytes start with the LZ4 frame magic.
     * @param {Uint8Array} bytes Candidate bytes.
     * @returns {boolean}
     */
    static #isLz4Frame(bytes) {
        return (
            bytes.byteLength >= 4 &&
            new DataView(
                bytes.buffer,
                bytes.byteOffset,
                bytes.byteLength
            ).getUint32(0, true) === DraftsmanDigestParser.#LZ4_FRAME_MAGIC
        )
    }

    /**
     * Reads concatenated blocks from an LZ4 frame.
     * @param {Uint8Array} bytes Frame bytes.
     * @returns {Uint8Array}
     */
    static #readLz4Frame(bytes) {
        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        )
        let offset = 4

        if (offset + 3 > bytes.byteLength) {
            throw new Error('Truncated LZ4 frame header')
        }

        const flags = view.getUint8(offset)
        offset += 1
        offset += 1
        offset += DraftsmanDigestParser.#lz4OptionalHeaderByteLength(flags)
        offset += 1

        const chunks = []
        while (offset + 4 <= bytes.byteLength) {
            const blockSizeField = view.getUint32(offset, true)
            offset += 4
            if (blockSizeField === 0) {
                break
            }

            const isUncompressed = (blockSizeField & 0x80000000) !== 0
            const blockSize = blockSizeField & 0x7fffffff
            if (offset + blockSize > bytes.byteLength) {
                throw new Error('Truncated LZ4 block')
            }

            const block = bytes.subarray(offset, offset + blockSize)
            chunks.push(
                isUncompressed
                    ? new Uint8Array(block)
                    : DraftsmanDigestParser.#decodeLz4Block(block)
            )
            offset += blockSize
        }

        return DraftsmanDigestParser.#concatBytes(chunks)
    }

    /**
     * Computes optional frame-header byte length from FLG bits.
     * @param {number} flags LZ4 frame FLG byte.
     * @returns {number}
     */
    static #lz4OptionalHeaderByteLength(flags) {
        let byteLength = 0
        if (flags & 0x08) byteLength += 8
        if (flags & 0x01) byteLength += 4
        return byteLength
    }

    /**
     * Decodes one raw LZ4 block.
     * @param {Uint8Array} block LZ4 block bytes.
     * @returns {Uint8Array}
     */
    static #decodeLz4Block(block) {
        const output = []
        let offset = 0

        while (offset < block.byteLength) {
            const token = block[offset]
            offset += 1
            const literalLength = DraftsmanDigestParser.#readLz4Length(
                block,
                token >> 4,
                () => offset++,
                (index) => {
                    offset = index
                }
            )

            if (offset + literalLength > block.byteLength) {
                throw new Error('Truncated LZ4 literal')
            }
            for (let index = 0; index < literalLength; index += 1) {
                output.push(block[offset + index])
            }
            offset += literalLength
            if (offset >= block.byteLength) {
                break
            }

            if (offset + 2 > block.byteLength) {
                throw new Error('Truncated LZ4 offset')
            }
            const matchOffset = block[offset] | (block[offset + 1] << 8)
            offset += 2
            if (matchOffset <= 0 || matchOffset > output.length) {
                throw new Error('Invalid LZ4 match offset')
            }

            const matchLength =
                DraftsmanDigestParser.#readLz4Length(
                    block,
                    token & 0x0f,
                    () => offset++,
                    (index) => {
                        offset = index
                    }
                ) + 4
            const start = output.length - matchOffset
            for (let index = 0; index < matchLength; index += 1) {
                output.push(output[start + index])
            }
        }

        return new Uint8Array(output)
    }

    /**
     * Reads an extended LZ4 literal or match length.
     * @param {Uint8Array} bytes Block bytes.
     * @param {number} nibble Initial nibble value.
     * @param {() => number} nextIndex Returns and advances the byte index.
     * @param {(index: number) => void} setIndex Stores the final byte index.
     * @returns {number}
     */
    static #readLz4Length(bytes, nibble, nextIndex, setIndex) {
        let length = nibble
        if (nibble !== 15) {
            return length
        }

        let index = nextIndex()
        while (index < bytes.byteLength) {
            const value = bytes[index]
            length += value
            index += 1
            if (value !== 255) {
                setIndex(index)
                return length
            }
        }

        throw new Error('Truncated LZ4 length')
    }

    /**
     * Concatenates byte chunks into one array.
     * @param {Uint8Array[]} chunks Byte chunks.
     * @returns {Uint8Array}
     */
    static #concatBytes(chunks) {
        const byteLength = chunks.reduce(
            (total, chunk) => total + chunk.byteLength,
            0
        )
        const bytes = new Uint8Array(byteLength)
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes
    }

    /**
     * Returns true when a payload looks like a text/XML digest.
     * @param {string} text Decoded payload.
     * @returns {boolean}
     */
    static #looksLikeTextContainer(text) {
        return /<\s*(DraftsmanDocument|Document|Page)\b/iu.test(text || '')
    }

    /**
     * Extracts root element attributes.
     * @param {string} text Decoded payload.
     * @returns {Record<string, string>}
     */
    static #rootFields(text) {
        const match = String(text || '').match(
            /<\s*(DraftsmanDocument|Document)\b([^>]*)>/iu
        )
        return DraftsmanDigestParser.#attributes(match?.[2] || '')
    }

    /**
     * Normalizes document-level display and sheet options.
     * @param {Record<string, string>} fields Root element attributes.
     * @returns {object}
     */
    static #documentOptions(fields) {
        return DraftsmanDigestParser.#stripEmpty({
            defaultFontName:
                fields.DefaultFontName ||
                fields.FontName ||
                fields.DefaultFont ||
                undefined,
            documentId: fields.DocumentId || fields.DocumentID,
            revision: fields.Revision || fields.DocumentRevision,
            gridSize: DraftsmanDigestParser.#number(fields.GridSize),
            showGrid: DraftsmanDigestParser.#boolean(fields.ShowGrid),
            sheetColor: fields.SheetColor,
            backgroundColor: fields.BackgroundColor,
            borderColor: fields.BorderColor,
            gridColor: fields.GridColor,
            fields
        })
    }

    /**
     * Extracts page digests.
     * @param {string} text Decoded payload.
     * @returns {object[]}
     */
    static #pages(text) {
        const pages = []
        const pagePattern =
            /<Page\b([^>]*)>([\s\S]*?)<\/Page>|<Page\b([^>]*)\/>/giu
        let match = pagePattern.exec(text || '')
        while (match) {
            const fields = DraftsmanDigestParser.#attributes(
                match[1] || match[3] || ''
            )
            const body = match[2] || ''
            pages.push(DraftsmanDigestParser.#page(fields, body, pages.length))
            match = pagePattern.exec(text || '')
        }
        return pages
    }

    /**
     * Builds one page digest.
     * @param {Record<string, string>} fields Page attributes.
     * @param {string} body Page body markup.
     * @param {number} index Page index.
     * @returns {object}
     */
    static #page(fields, body, index) {
        const name = fields.Name || fields.Title || fields.Id || ''
        return DraftsmanDigestParser.#stripEmpty({
            index,
            id: fields.Id || fields.ID || '',
            name,
            title: fields.Title || name || 'Page ' + (index + 1),
            pageSetup: DraftsmanDigestParser.#pageSetup(fields),
            titleBlocks: DraftsmanDigestParser.#titleBlocks(body),
            notes: DraftsmanDigestParser.#notes(body),
            images: DraftsmanDigestParser.#images(body),
            zones: DraftsmanDigestParser.#zones(body),
            items: DraftsmanDigestParser.#items(body),
            unsupportedRawItems:
                DraftsmanDigestParser.#unsupportedRawItems(body)
        })
    }

    /**
     * Normalizes page dimensions and margins.
     * @param {Record<string, string>} fields Page attributes.
     * @returns {object}
     */
    static #pageSetup(fields) {
        const margins = DraftsmanDigestParser.#stripEmpty({
            left: DraftsmanDigestParser.#number(fields.MarginLeft),
            right: DraftsmanDigestParser.#number(fields.MarginRight),
            top: DraftsmanDigestParser.#number(fields.MarginTop),
            bottom: DraftsmanDigestParser.#number(fields.MarginBottom)
        })

        const setup = DraftsmanDigestParser.#stripEmpty({
            width: DraftsmanDigestParser.#number(
                fields.Width || fields.SheetWidth
            ),
            height: DraftsmanDigestParser.#number(
                fields.Height || fields.SheetHeight
            ),
            standardSheetSize:
                fields.StandardSheetSize || fields.SheetSize || undefined,
            sheetTemplate: fields.SheetTemplate || fields.Template,
            borderStyle: fields.BorderStyle,
            orientation: fields.Orientation,
            margins: Object.keys(margins).length ? margins : undefined
        })

        return Object.keys(setup).length ? setup : undefined
    }

    /**
     * Extracts title-block rows from a page body.
     * @param {string} body Page body.
     * @returns {object[]}
     */
    static #titleBlocks(body) {
        return DraftsmanDigestParser.#tagFields(body, ['TitleBlock']).map(
            (fields) =>
                DraftsmanDigestParser.#stripEmpty({
                    id: fields.Id || fields.ID,
                    title: fields.Title,
                    documentNumber: fields.DocumentNumber,
                    fields
                })
        )
    }

    /**
     * Extracts note/text rows from a page body.
     * @param {string} body Page body.
     * @returns {object[]}
     */
    static #notes(body) {
        return DraftsmanDigestParser.#tagFields(body, ['Note', 'Text']).map(
            (fields) => {
                const border = DraftsmanDigestParser.#stripEmpty({
                    width: DraftsmanDigestParser.#number(fields.BorderWidth),
                    style: DraftsmanDigestParser.#lower(fields.BorderStyle),
                    color: fields.BorderColor,
                    visible: DraftsmanDigestParser.#boolean(fields.ShowBorder)
                })

                return DraftsmanDigestParser.#stripEmpty({
                    id: fields.Id || fields.ID,
                    text: fields.Text || fields.Value || fields.Name,
                    x: DraftsmanDigestParser.#number(fields.X),
                    y: DraftsmanDigestParser.#number(fields.Y),
                    width: DraftsmanDigestParser.#number(fields.Width),
                    height: DraftsmanDigestParser.#number(fields.Height),
                    alignment: DraftsmanDigestParser.#lower(
                        fields.Alignment || fields.HorizontalAlignment
                    ),
                    verticalAlignment: DraftsmanDigestParser.#lower(
                        fields.VerticalAlignment
                    ),
                    fontStyleId: fields.FontStyleId || fields.FontStyleID,
                    border: Object.keys(border).length ? border : undefined,
                    fillColor: fields.FillColor || fields.AreaColor,
                    fields
                })
            }
        )
    }

    /**
     * Extracts image rows from a page body.
     * @param {string} body Page body.
     * @returns {object[]}
     */
    static #images(body) {
        return DraftsmanDigestParser.#tagFields(body, ['Image', 'Picture']).map(
            (fields) =>
                DraftsmanDigestParser.#stripEmpty({
                    id: fields.Id || fields.ID,
                    name: fields.Name || fields.FileName,
                    nativeFormat: fields.NativeFormat || fields.Format,
                    wrapperType: fields.WrapperType || fields.Wrapper,
                    byteSize: DraftsmanDigestParser.#integer(fields.ByteSize),
                    x: DraftsmanDigestParser.#number(fields.X),
                    y: DraftsmanDigestParser.#number(fields.Y),
                    width: DraftsmanDigestParser.#number(fields.Width),
                    height: DraftsmanDigestParser.#number(fields.Height),
                    rotation: DraftsmanDigestParser.#number(fields.Rotation),
                    fields
                })
        )
    }

    /**
     * Extracts typed style rows from a Draftsman text container.
     * @param {string} text Decoded payload.
     * @returns {{ fontStyles: object[] }}
     */
    static #styleCatalog(text) {
        return {
            fontStyles: DraftsmanDigestParser.#shallowTagFields(text, [
                'FontStyle'
            ]).map((fields) =>
                DraftsmanDigestParser.#stripEmpty({
                    id: fields.Id || fields.ID,
                    fontName:
                        fields.FontName || fields.Name || fields.FamilyName,
                    size: DraftsmanDigestParser.#number(
                        fields.Size || fields.FontSize
                    ),
                    bold: DraftsmanDigestParser.#boolean(fields.Bold),
                    italic: DraftsmanDigestParser.#boolean(fields.Italic),
                    underline: DraftsmanDigestParser.#boolean(fields.Underline),
                    color: fields.Color,
                    fields
                })
            )
        }
    }

    /**
     * Extracts selected tags without consuming parent/child subtrees.
     * @param {string} body Markup body.
     * @param {string[]} tagNames Tag names.
     * @returns {Record<string, string>[]}
     */
    static #shallowTagFields(body, tagNames) {
        const selected = new Set(tagNames)
        const fields = []
        const tagPattern = /<([A-Za-z][A-Za-z0-9_]*)\b([^>]*?)(?:\/?)>/gu
        let match = tagPattern.exec(body || '')

        while (match) {
            if (selected.has(match[1])) {
                fields.push(DraftsmanDigestParser.#attributes(match[2]))
            }
            match = tagPattern.exec(body || '')
        }

        return fields
    }

    /**
     * Extracts page zone rows.
     * @param {string} body Page body.
     * @returns {object[]}
     */
    static #zones(body) {
        return DraftsmanDigestParser.#tagFields(body, [
            'Zone',
            'SheetZone'
        ]).map((fields) =>
            DraftsmanDigestParser.#stripEmpty({
                id: fields.Id || fields.ID,
                name: fields.Name || fields.Title,
                row: fields.Row,
                column: fields.Column,
                x1: DraftsmanDigestParser.#number(fields.X1),
                y1: DraftsmanDigestParser.#number(fields.Y1),
                x2: DraftsmanDigestParser.#number(fields.X2),
                y2: DraftsmanDigestParser.#number(fields.Y2),
                fields
            })
        )
    }

    /**
     * Extracts a stable item index for review tooling.
     * @param {string} body Page body.
     * @returns {object[]}
     */
    static #items(body) {
        return DraftsmanDigestParser.#tags(body).map((tag) =>
            DraftsmanDigestParser.#stripEmpty({
                kind: DraftsmanDigestParser.#itemKind(tag.kind),
                id: tag.fields.Id || tag.fields.ID,
                name: tag.fields.Name || tag.fields.Title || tag.fields.Text
            })
        )
    }

    /**
     * Extracts unsupported drawing item descriptors.
     * @param {string} body Page body.
     * @returns {object[]}
     */
    static #unsupportedRawItems(body) {
        const supported = new Set([
            'TitleBlock',
            'Note',
            'Text',
            'Image',
            'Picture',
            'Zone',
            'SheetZone'
        ])
        return DraftsmanDigestParser.#tags(body)
            .filter((tag) => !supported.has(tag.kind))
            .map((tag) =>
                DraftsmanDigestParser.#stripEmpty({
                    kind: tag.kind,
                    id: tag.fields.Id || tag.fields.ID,
                    name: tag.fields.Name || tag.fields.Title,
                    rawXml: tag.rawXml,
                    fields: tag.fields
                })
            )
    }

    /**
     * Extracts attributes for selected tag names.
     * @param {string} body Page body.
     * @param {string[]} tagNames Tag names.
     * @returns {Record<string, string>[]}
     */
    static #tagFields(body, tagNames) {
        const selected = new Set(tagNames)
        return DraftsmanDigestParser.#tags(body)
            .filter((tag) => selected.has(tag.kind))
            .map((tag) => tag.fields)
    }

    /**
     * Extracts all start-tag descriptors from markup.
     * @param {string} body Markup body.
     * @returns {{ kind: string, fields: Record<string, string>, rawXml: string }[]}
     */
    static #tags(body) {
        const tags = []
        const tagPattern = /<([A-Za-z][A-Za-z0-9_]*)\b([^>]*?)(\/?)>/gu
        let match = tagPattern.exec(body || '')
        while (match) {
            const rawXml = DraftsmanDigestParser.#rawXmlForTag(
                body || '',
                match,
                tagPattern
            )
            tags.push({
                kind: match[1],
                fields: DraftsmanDigestParser.#attributes(match[2]),
                rawXml
            })
            if (rawXml.length > match[0].length) {
                tagPattern.lastIndex = match.index + rawXml.length
            }
            match = tagPattern.exec(body || '')
        }
        return tags
    }

    /**
     * Extracts one raw XML item, including nested child markup when present.
     * @param {string} body Page body.
     * @param {RegExpExecArray} match Opening tag match.
     * @param {RegExp} tagPattern Reusable tag pattern.
     * @returns {string}
     */
    static #rawXmlForTag(body, match, tagPattern) {
        if (match[3] === '/') {
            return match[0]
        }

        const closeEnd = DraftsmanDigestParser.#matchingCloseTagEnd(
            body,
            match[1],
            tagPattern.lastIndex
        )

        return closeEnd === null ? match[0] : body.slice(match.index, closeEnd)
    }

    /**
     * Finds the end offset for a matching close tag.
     * @param {string} body Page body.
     * @param {string} kind Tag name.
     * @param {number} startOffset Search start offset.
     * @returns {number | null}
     */
    static #matchingCloseTagEnd(body, kind, startOffset) {
        const escapedKind = kind.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
        const tagPattern = new RegExp(
            '<(/?)' + escapedKind + '\\b([^>]*?)(/?)>',
            'giu'
        )
        tagPattern.lastIndex = startOffset
        let depth = 1
        let match = tagPattern.exec(body)

        while (match) {
            if (match[1] === '/') {
                depth -= 1
            } else if (match[3] !== '/') {
                depth += 1
            }

            if (depth === 0) {
                return tagPattern.lastIndex
            }
            match = tagPattern.exec(body)
        }

        return null
    }

    /**
     * Parses XML-like attributes.
     * @param {string} text Attribute text.
     * @returns {Record<string, string>}
     */
    static #attributes(text) {
        const fields = {}
        const attrPattern = /([A-Za-z0-9_.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gu
        let match = attrPattern.exec(text || '')
        while (match) {
            fields[match[1]] = DraftsmanDigestParser.#decodeEntities(
                match[3] ?? match[4] ?? ''
            )
            match = attrPattern.exec(text || '')
        }
        return fields
    }

    /**
     * Decodes basic XML entities.
     * @param {string} value Encoded value.
     * @returns {string}
     */
    static #decodeEntities(value) {
        return String(value || '')
            .replace(/&quot;/gu, '"')
            .replace(/&apos;/gu, "'")
            .replace(/&lt;/gu, '<')
            .replace(/&gt;/gu, '>')
            .replace(/&amp;/gu, '&')
    }

    /**
     * Parses a finite number.
     * @param {string | undefined} value Raw value.
     * @returns {number | undefined}
     */
    static #number(value) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    /**
     * Parses a finite integer.
     * @param {string | undefined} value Raw value.
     * @returns {number | undefined}
     */
    static #integer(value) {
        const numeric = Number.parseInt(String(value || ''), 10)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    /**
     * Parses an optional boolean value.
     * @param {string | undefined} value Raw value.
     * @returns {boolean | undefined}
     */
    static #boolean(value) {
        if (value === undefined || value === null || value === '') {
            return undefined
        }
        return /^(?:1|true|yes)$/iu.test(String(value).trim())
    }

    /**
     * Lowercases non-empty enum-like text.
     * @param {string | undefined} value Raw value.
     * @returns {string | undefined}
     */
    static #lower(value) {
        const text = String(value || '').trim()
        return text ? text.toLowerCase() : undefined
    }

    /**
     * Normalizes one XML tag name into a digest item kind.
     * @param {string} kind Tag name.
     * @returns {string}
     */
    static #itemKind(kind) {
        const normalized = String(kind || '')
        if (normalized === 'TitleBlock') return 'title-block'
        if (normalized === 'Note' || normalized === 'Text') return 'note'
        if (normalized === 'Image' || normalized === 'Picture') return 'image'
        if (normalized === 'Zone' || normalized === 'SheetZone') return 'zone'
        return normalized.replace(/([a-z])([A-Z])/gu, '$1-$2').toLowerCase()
    }

    /**
     * Removes undefined fields from one descriptor.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value).filter(([, entry]) => entry !== undefined)
        )
    }
}
