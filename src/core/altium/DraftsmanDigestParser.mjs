// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'

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
        const unsupportedRawItemCount = pages.reduce(
            (total, page) => total + page.unsupportedRawItems.length,
            0
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
            pages,
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
     * @param {{ sourceDocumentName: string, pages: object[], diagnostics: object[] }} digest Digest payload.
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

        return NormalizedModelSchema.attach({
            kind: 'draftsman',
            fileType: 'PCBDwf',
            fileName,
            summary: {
                title: fileName,
                pageCount: digest.pages.length,
                noteCount,
                imageCount,
                unsupportedRawItemCount
            },
            diagnostics: digest.diagnostics,
            draftsman: {
                schema: DraftsmanDigestParser.DIGEST_SCHEMA,
                sourceDocumentName: digest.sourceDocumentName,
                pages: digest.pages,
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
        for (const page of pages) {
            if (page.id) pagesById[page.id] = page.index
            if (page.name) pagesByName[page.name] = page.index
        }
        return { pagesById, pagesByName }
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
        return {
            index,
            id: fields.Id || fields.ID || '',
            name,
            title: fields.Title || name || 'Page ' + (index + 1),
            titleBlocks: DraftsmanDigestParser.#titleBlocks(body),
            notes: DraftsmanDigestParser.#notes(body),
            images: DraftsmanDigestParser.#images(body),
            unsupportedRawItems:
                DraftsmanDigestParser.#unsupportedRawItems(body)
        }
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
            (fields) =>
                DraftsmanDigestParser.#stripEmpty({
                    id: fields.Id || fields.ID,
                    text: fields.Text || fields.Value || fields.Name,
                    x: DraftsmanDigestParser.#number(fields.X),
                    y: DraftsmanDigestParser.#number(fields.Y),
                    fields
                })
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
                    byteSize: DraftsmanDigestParser.#integer(fields.ByteSize),
                    fields
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
            'Picture'
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
