// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Static FTP hosting serves raw browser modules, so this parser import must
// resolve through one vendored browser file instead of a bare package
// specifier.
import { unzlibSync } from 'fflate'
import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'
import { PcbShapeBasedBodyGeometryParser } from './PcbShapeBasedBodyGeometryParser.mjs'

/**
 * Extracts embedded 3D model payloads and component-body placement metadata
 * from PCB compound-document streams.
 */
export class PcbEmbeddedModelExtractor {
    /**
     * Extracts embedded model payloads and component-body placements from one
     * stream map.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ models: { id: string, checksum: number, name: string, format: string, payloadText: string, sourceStream: string, transform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number } }[], componentBodies: { sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null, modelType?: number, modelTypeName?: string, bodyColor?: object, bodyOpacity?: number, staticGeometry?: object }[] }}
     */
    static extractFromStreams(streams) {
        const modelStreamPrefix =
            PcbEmbeddedModelExtractor.#resolveModelStreamPrefix(streams)
        const modelMetadataRecords =
            PcbEmbeddedModelExtractor.#parseModelMetadataStream(
                streams.get(modelStreamPrefix + '/Data')
            )
        const modelMetadataRows = modelMetadataRecords.map((fields, index) => ({
            fields,
            index,
            sourceStream: modelStreamPrefix + '/' + index,
            id: PcbEmbeddedModelExtractor.#getField(fields, 'ID'),
            name: PcbEmbeddedModelExtractor.#getField(fields, 'NAME'),
            checksum: PcbEmbeddedModelExtractor.#normalizeChecksum(
                PcbEmbeddedModelExtractor.#parseIntegerField(fields, 'CHECKSUM')
            )
        }))
        const models = modelMetadataRows
            .map((row) =>
                PcbEmbeddedModelExtractor.#normalizeEmbeddedModel(
                    row.fields,
                    streams.get(row.sourceStream),
                    row.sourceStream
                )
            )
            .filter(Boolean)
        const componentBodies =
            PcbEmbeddedModelExtractor.#dedupeComponentBodies([
                ...PcbEmbeddedModelExtractor.#parseComponentBodyStream(
                    streams.get('ComponentBodies6/Data'),
                    'ComponentBodies6/Data'
                ),
                ...PcbEmbeddedModelExtractor.#parseShapeBasedComponentBodyStream(
                    streams.get('ShapeBasedComponentBodies6/Data'),
                    'ShapeBasedComponentBodies6/Data'
                )
            ])
        const integrity = PcbEmbeddedModelExtractor.#buildIntegrityReport(
            modelMetadataRows,
            models,
            componentBodies,
            streams
        )

        return {
            models,
            componentBodies,
            integrity,
            diagnostics: integrity.issues
        }
    }

    /**
     * Resolves the embedded-model stream folder used by the compound document.
     * @param {Map<string, Uint8Array>} streams
     * @returns {string}
     */
    static #resolveModelStreamPrefix(streams) {
        if (streams.has('Models/Data')) {
            return 'Models'
        }

        if (streams.has('Library/Models/Data')) {
            return 'Library/Models'
        }

        return 'Models'
    }

    /**
     * Parses the length-prefixed model metadata stream.
     * @param {Uint8Array | undefined} bytes
     * @returns {Record<string, string | string[]>[]}
     */
    static #parseModelMetadataStream(bytes) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return []
        }

        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        )
        const records = []
        let offset = 0

        while (offset + 4 <= bytes.byteLength) {
            const recordLength = view.getUint32(offset, true)
            offset += 4

            if (recordLength <= 0 || offset + recordLength > bytes.byteLength) {
                break
            }

            const fields = PcbEmbeddedModelExtractor.#parseFieldRecordBytes(
                bytes.subarray(offset, offset + recordLength)
            )
            offset += recordLength

            if (
                PcbEmbeddedModelExtractor.#getField(fields, 'ID') ||
                PcbEmbeddedModelExtractor.#getField(fields, 'NAME')
            ) {
                records.push(fields)
            }
        }

        return records
    }

    /**
     * Parses one component-body printable stream into model-placement records.
     * @param {Uint8Array | undefined} bytes
     * @param {string} sourceStream
     * @param {{ inferStaticGeometry?: boolean }} [options]
     * @returns {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null, modelType?: number, modelTypeName?: string, bodyColor?: object, bodyOpacity?: number, staticGeometry?: object }[]}
     */
    static #parseComponentBodyStream(bytes, sourceStream, options = {}) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return []
        }

        const arrayBuffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )

        return PrintableTextDecoder.extractRunBytes(arrayBuffer)
            .map((runBytes) =>
                PcbEmbeddedModelExtractor.#parseFieldRecordBytes(runBytes)
            )
            .map((fields) =>
                PcbEmbeddedModelExtractor.#normalizeComponentBody(
                    fields,
                    sourceStream,
                    options.inferStaticGeometry
                        ? {
                              staticGeometry:
                                  PcbShapeBasedBodyGeometryParser.buildStaticGeometry(
                                      fields,
                                      []
                                  )
                          }
                        : {}
                )
            )
            .filter(Boolean)
    }

    /**
     * Parses shape-based component bodies, including optional vertex payloads.
     * @param {Uint8Array | undefined} bytes
     * @param {string} sourceStream
     * @returns {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null, modelType?: number, modelTypeName?: string, bodyColor?: object, bodyOpacity?: number, staticGeometry?: object }[]}
     */
    static #parseShapeBasedComponentBodyStream(bytes, sourceStream) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return []
        }

        const records = PcbShapeBasedBodyGeometryParser.parse(bytes)

        if (records.length) {
            return records
                .map((record) =>
                    PcbEmbeddedModelExtractor.#normalizeComponentBody(
                        record.fields,
                        sourceStream,
                        { staticGeometry: record.staticGeometry }
                    )
                )
                .filter(Boolean)
        }

        return PcbEmbeddedModelExtractor.#parseComponentBodyStream(
            bytes,
            sourceStream,
            { inferStaticGeometry: true }
        )
    }

    /**
     * Parses one printable field record without requiring a specific leading
     * marker such as `|RECORD=` or `|KIND=`.
     * @param {Uint8Array} bytes
     * @returns {Record<string, string | string[]>}
     */
    static #parseFieldRecordBytes(bytes) {
        const fields = {}
        const text = PrintableTextDecoder.decodeBytes(bytes)
            .replaceAll('\u0000', '')
            .trim()

        for (const segment of text.split('|')) {
            const trimmedSegment = segment.trim()
            if (!trimmedSegment) {
                continue
            }

            const separatorIndex = trimmedSegment.indexOf('=')
            if (separatorIndex === -1) {
                continue
            }

            const key = trimmedSegment.slice(0, separatorIndex).trim()
            const value = trimmedSegment.slice(separatorIndex + 1).trim()

            if (!key) {
                continue
            }

            PcbEmbeddedModelExtractor.#appendFieldValue(fields, key, value)
        }

        return fields
    }

    /**
     * Normalizes one embedded model metadata record and its payload stream.
     * @param {Record<string, string | string[]>} fields
     * @param {Uint8Array | undefined} bytes
     * @param {string} sourceStream
     * @returns {{ id: string, checksum: number, name: string, format: string, payloadText: string, sourceStream: string, transform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number } } | null}
     */
    static #normalizeEmbeddedModel(fields, bytes, sourceStream) {
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
            return null
        }

        const id = PcbEmbeddedModelExtractor.#getField(fields, 'ID')
        const name = PcbEmbeddedModelExtractor.#getField(fields, 'NAME')
        const checksum = PcbEmbeddedModelExtractor.#normalizeChecksum(
            PcbEmbeddedModelExtractor.#parseIntegerField(fields, 'CHECKSUM')
        )

        if (!id || !name || checksum === null) {
            return null
        }

        const payloadBytes =
            PcbEmbeddedModelExtractor.#inflateModelPayload(bytes)
        const payloadText = new TextDecoder('utf-8').decode(payloadBytes).trim()

        if (!payloadText) {
            return null
        }

        return {
            id,
            checksum,
            name,
            format: PcbEmbeddedModelExtractor.#resolveModelFormat(
                name,
                payloadText
            ),
            payloadText,
            sourceStream,
            transform: {
                rotationDeg: {
                    x:
                        PcbEmbeddedModelExtractor.#parseNumberField(
                            fields,
                            'ROTX'
                        ) || 0,
                    y:
                        PcbEmbeddedModelExtractor.#parseNumberField(
                            fields,
                            'ROTY'
                        ) || 0,
                    z:
                        PcbEmbeddedModelExtractor.#parseNumberField(
                            fields,
                            'ROTZ'
                        ) || 0
                },
                dzMil:
                    PcbEmbeddedModelExtractor.#parseMilLikeField(
                        fields,
                        'DZ'
                    ) || 0
            }
        }
    }

    /**
     * Normalizes one component-body record into model-placement metadata.
     * @param {Record<string, string | string[]>} fields
     * @param {string} sourceStream
     * @param {{ staticGeometry?: object }} [extra]
     * @returns {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null, modelType?: number, modelTypeName?: string, bodyColor?: object, bodyOpacity?: number, staticGeometry?: object } | null}
     */
    static #normalizeComponentBody(fields, sourceStream, extra = {}) {
        const modelId = PcbEmbeddedModelExtractor.#getField(fields, 'MODELID')
        const name = PcbEmbeddedModelExtractor.#getField(fields, 'MODEL.NAME')

        if (!modelId && !name) {
            return null
        }

        return {
            sourceStream,
            layer: PcbEmbeddedModelExtractor.#getField(fields, 'V7_LAYER'),
            identifier: PcbEmbeddedModelExtractor.#decodeIdentifier(
                PcbEmbeddedModelExtractor.#getField(fields, 'IDENTIFIER')
            ),
            modelId,
            checksum: PcbEmbeddedModelExtractor.#normalizeChecksum(
                PcbEmbeddedModelExtractor.#parseIntegerField(
                    fields,
                    'MODEL.CHECKSUM'
                )
            ),
            embedded: /^TRUE$/i.test(
                PcbEmbeddedModelExtractor.#getField(fields, 'MODEL.EMBED')
            ),
            name,
            positionMil: {
                x:
                    PcbEmbeddedModelExtractor.#parseMilLikeField(
                        fields,
                        'MODEL.2D.X'
                    ) || 0,
                y:
                    PcbEmbeddedModelExtractor.#parseMilLikeField(
                        fields,
                        'MODEL.2D.Y'
                    ) || 0
            },
            rotationDeg:
                PcbEmbeddedModelExtractor.#parseNumberField(
                    fields,
                    'MODEL.2D.ROTATION'
                ) || 0,
            modelRotationDeg: {
                x:
                    PcbEmbeddedModelExtractor.#parseNumberField(
                        fields,
                        'MODEL.3D.ROTX'
                    ) || 0,
                y:
                    PcbEmbeddedModelExtractor.#parseNumberField(
                        fields,
                        'MODEL.3D.ROTY'
                    ) || 0,
                z:
                    PcbEmbeddedModelExtractor.#parseNumberField(
                        fields,
                        'MODEL.3D.ROTZ'
                    ) || 0
            },
            dzMil:
                PcbEmbeddedModelExtractor.#parseMilLikeField(
                    fields,
                    'MODEL.3D.DZ'
                ) || 0,
            overallHeightMil: PcbEmbeddedModelExtractor.#parseMilLikeField(
                fields,
                'OVERALLHEIGHT'
            ),
            standoffHeightMil: PcbEmbeddedModelExtractor.#parseMilLikeField(
                fields,
                'STANDOFFHEIGHT'
            ),
            ...PcbEmbeddedModelExtractor.#shapeBodyMetadata(fields),
            ...PcbEmbeddedModelExtractor.#stripUndefined(extra)
        }
    }

    /**
     * Normalizes shape-based body display metadata.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @returns {object}
     */
    static #shapeBodyMetadata(fields) {
        const modelType = PcbEmbeddedModelExtractor.#parseIntegerField(
            fields,
            'MODEL.MODELTYPE'
        )
        const bodyColorRaw = PcbEmbeddedModelExtractor.#parseIntegerField(
            fields,
            'BODYCOLOR3D'
        )
        const bodyOpacity = PcbEmbeddedModelExtractor.#parseNumberField(
            fields,
            'BODYOPACITY3D'
        )

        return PcbEmbeddedModelExtractor.#stripUndefined({
            modelType: modelType === null ? undefined : modelType,
            modelTypeName:
                modelType === null
                    ? undefined
                    : PcbEmbeddedModelExtractor.#modelTypeName(modelType),
            bodyColor:
                bodyColorRaw === null
                    ? undefined
                    : PcbEmbeddedModelExtractor.#decodeBodyColor(bodyColorRaw),
            bodyOpacity:
                PcbEmbeddedModelExtractor.#normalizeBodyOpacity(bodyOpacity)
        })
    }

    /**
     * Normalizes native body opacity metadata to authored translucency only.
     * @param {number | null} bodyOpacity Native body opacity value.
     * @returns {number | undefined}
     */
    static #normalizeBodyOpacity(bodyOpacity) {
        if (!Number.isFinite(bodyOpacity) || Number(bodyOpacity) <= 0) {
            return undefined
        }

        return bodyOpacity
    }

    /**
     * Maps a numeric body model type to a stable semantic label.
     * @param {number} modelType Numeric model type.
     * @returns {string}
     */
    static #modelTypeName(modelType) {
        const modelTypeNames = new Map([
            [0, 'extruded-polygon'],
            [1, 'cone'],
            [2, 'cylinder'],
            [3, 'sphere']
        ])

        return modelTypeNames.get(modelType) || 'unknown-' + modelType
    }

    /**
     * Decodes one packed native RGB color value.
     * @param {number} rawColor Packed color value.
     * @returns {{ raw: number, hex: string, rgb: { red: number, green: number, blue: number } }}
     */
    static #decodeBodyColor(rawColor) {
        const red = rawColor & 0xff
        const green = (rawColor >> 8) & 0xff
        const blue = (rawColor >> 16) & 0xff

        return {
            raw: rawColor,
            hex:
                '#' +
                [red, green, blue]
                    .map((component) => component.toString(16).padStart(2, '0'))
                    .join(''),
            rgb: { red, green, blue }
        }
    }

    /**
     * Inflates one zlib model payload and falls back to the raw bytes when the
     * stream is already plain text.
     * @param {Uint8Array} bytes
     * @returns {Uint8Array}
     */
    static #inflateModelPayload(bytes) {
        try {
            return Uint8Array.from(unzlibSync(bytes))
        } catch {
            return bytes
        }
    }

    /**
     * Deduplicates shape-based body records shared across body streams.
     * @param {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null, modelType?: number, modelTypeName?: string, bodyColor?: object, bodyOpacity?: number, staticGeometry?: object }[]} componentBodies
     * @returns {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null, modelType?: number, modelTypeName?: string, bodyColor?: object, bodyOpacity?: number, staticGeometry?: object }[]}
     */
    static #dedupeComponentBodies(componentBodies) {
        const uniqueBodies = new Map()

        for (const componentBody of componentBodies) {
            const key = [
                componentBody.modelId,
                componentBody.checksum,
                componentBody.name,
                componentBody.positionMil.x,
                componentBody.positionMil.y,
                componentBody.rotationDeg,
                componentBody.modelRotationDeg.x,
                componentBody.modelRotationDeg.y,
                componentBody.modelRotationDeg.z,
                componentBody.dzMil
            ].join('\u0000')

            const existingBody = uniqueBodies.get(key)
            if (
                !existingBody ||
                PcbEmbeddedModelExtractor.#shouldPreferComponentBody(
                    componentBody,
                    existingBody
                )
            ) {
                uniqueBodies.set(key, componentBody)
            }
        }

        return [...uniqueBodies.values()]
    }

    /**
     * Checks whether one component-body row carries better static geometry.
     * @param {{ staticGeometry?: object }} candidate Candidate body row.
     * @param {{ staticGeometry?: object }} existing Existing body row.
     * @returns {boolean}
     */
    static #shouldPreferComponentBody(candidate, existing) {
        return (
            PcbEmbeddedModelExtractor.#staticGeometryRank(candidate) >
            PcbEmbeddedModelExtractor.#staticGeometryRank(existing)
        )
    }

    /**
     * Ranks static geometry completeness for duplicate body rows.
     * @param {{ staticGeometry?: object }} componentBody Component body row.
     * @returns {number}
     */
    static #staticGeometryRank(componentBody) {
        if (componentBody?.staticGeometry?.status === 'complete') {
            return 2
        }

        if (componentBody?.staticGeometry) {
            return 1
        }

        return 0
    }

    /**
     * Builds model metadata and payload integrity diagnostics.
     * @param {object[]} metadataRows Parsed model metadata rows.
     * @param {object[]} models Recovered payload models.
     * @param {object[]} componentBodies Recovered component bodies.
     * @param {Map<string, Uint8Array>} streams Compound streams.
     * @returns {{ schema: string, issues: object[] }}
     */
    static #buildIntegrityReport(
        metadataRows,
        models,
        componentBodies,
        streams
    ) {
        const issues = [
            ...PcbEmbeddedModelExtractor.#missingPayloadIssues(
                metadataRows,
                models,
                streams
            ),
            ...PcbEmbeddedModelExtractor.#duplicateChecksumIssues(metadataRows),
            ...PcbEmbeddedModelExtractor.#unresolvedBodyIssues(
                componentBodies,
                models
            ),
            ...PcbEmbeddedModelExtractor.#unreferencedModelIssues(
                models,
                componentBodies
            )
        ]

        return {
            schema: 'altium-toolkit.pcb.embedded-model-integrity.a1',
            issues
        }
    }

    /**
     * Reports metadata rows without a recoverable payload stream.
     * @param {object[]} metadataRows Parsed metadata rows.
     * @param {object[]} models Recovered model rows.
     * @param {Map<string, Uint8Array>} streams Compound streams.
     * @returns {object[]}
     */
    static #missingPayloadIssues(metadataRows, models, streams) {
        return (metadataRows || [])
            .filter(
                (row) =>
                    !streams.has(row.sourceStream) ||
                    !models.some((model) => model.id === row.id)
            )
            .map((row) => ({
                code: streams.has(row.sourceStream)
                    ? 'pcb.model.payload-unreadable'
                    : 'pcb.model.payload-missing',
                severity: 'warning',
                modelId: row.id,
                checksum: row.checksum,
                name: row.name,
                sourceStream: row.sourceStream,
                message: streams.has(row.sourceStream)
                    ? 'Embedded model payload stream could not be decoded.'
                    : 'Embedded model metadata references a missing payload stream.'
            }))
    }

    /**
     * Reports duplicate authored model checksums.
     * @param {object[]} metadataRows Parsed metadata rows.
     * @returns {object[]}
     */
    static #duplicateChecksumIssues(metadataRows) {
        const rowsByChecksum = new Map()

        for (const row of metadataRows || []) {
            if (!Number.isInteger(row.checksum)) {
                continue
            }
            if (!rowsByChecksum.has(row.checksum)) {
                rowsByChecksum.set(row.checksum, [])
            }
            rowsByChecksum.get(row.checksum).push(row)
        }

        return [...rowsByChecksum.entries()]
            .filter(([, rows]) => rows.length > 1)
            .map(([checksum, rows]) => ({
                code: 'pcb.model.checksum-duplicate',
                severity: 'warning',
                checksum,
                modelIds: rows.map((row) => row.id).filter(Boolean),
                sourceStreams: rows.map((row) => row.sourceStream),
                message:
                    'Multiple embedded model metadata rows share one checksum.'
            }))
    }

    /**
     * Reports component bodies that reference no recovered model.
     * @param {object[]} componentBodies Component-body rows.
     * @param {object[]} models Recovered model rows.
     * @returns {object[]}
     */
    static #unresolvedBodyIssues(componentBodies, models) {
        return (componentBodies || [])
            .filter(
                (componentBody) =>
                    componentBody.embedded &&
                    !PcbEmbeddedModelExtractor.#bodyMatchesAnyModel(
                        componentBody,
                        models
                    )
            )
            .map((componentBody) => ({
                code: 'pcb.model.body-unresolved',
                severity: 'warning',
                modelId: componentBody.modelId,
                checksum: componentBody.checksum,
                name: componentBody.name,
                sourceStream: componentBody.sourceStream,
                message:
                    'Component body references an embedded model that was not recovered.'
            }))
    }

    /**
     * Reports recovered model payloads not referenced by any component body.
     * @param {object[]} models Recovered model rows.
     * @param {object[]} componentBodies Component-body rows.
     * @returns {object[]}
     */
    static #unreferencedModelIssues(models, componentBodies) {
        if (!(componentBodies || []).length) {
            return []
        }

        return (models || [])
            .filter(
                (model) =>
                    !(componentBodies || []).some((componentBody) =>
                        PcbEmbeddedModelExtractor.#bodyMatchesModel(
                            componentBody,
                            model
                        )
                    )
            )
            .map((model) => ({
                code: 'pcb.model.payload-unreferenced',
                severity: 'info',
                modelId: model.id,
                checksum: model.checksum,
                name: model.name,
                sourceStream: model.sourceStream,
                message:
                    'Embedded model payload was recovered but no component body references it.'
            }))
    }

    /**
     * Returns true when a component body matches any recovered model.
     * @param {object} componentBody Component body.
     * @param {object[]} models Recovered models.
     * @returns {boolean}
     */
    static #bodyMatchesAnyModel(componentBody, models) {
        return (models || []).some((model) =>
            PcbEmbeddedModelExtractor.#bodyMatchesModel(componentBody, model)
        )
    }

    /**
     * Returns true when a component body references a model.
     * @param {object} componentBody Component body.
     * @param {object} model Recovered model.
     * @returns {boolean}
     */
    static #bodyMatchesModel(componentBody, model) {
        return (
            (componentBody.modelId && componentBody.modelId === model.id) ||
            (Number.isInteger(componentBody.checksum) &&
                componentBody.checksum === model.checksum) ||
            (componentBody.name &&
                String(componentBody.name).toLowerCase() ===
                    String(model.name || '').toLowerCase())
        )
    }

    /**
     * Resolves one model format from metadata and payload text.
     * @param {string} name
     * @param {string} payloadText
     * @returns {string}
     */
    static #resolveModelFormat(name, payloadText) {
        const normalizedName = String(name || '').toLowerCase()

        if (
            normalizedName.endsWith('.step') ||
            normalizedName.endsWith('.stp') ||
            payloadText.startsWith('ISO-10303-21')
        ) {
            return 'step'
        }

        if (
            normalizedName.endsWith('.wrl') ||
            normalizedName.endsWith('.vrml')
        ) {
            return 'wrl'
        }

        if (
            normalizedName.endsWith('.sldprt') ||
            normalizedName.endsWith('.sldasm')
        ) {
            return 'solidworks'
        }

        if (
            normalizedName.endsWith('.x_t') ||
            normalizedName.endsWith('.xmt_txt')
        ) {
            return 'parasolid-text'
        }

        if (
            normalizedName.endsWith('.x_b') ||
            normalizedName.endsWith('.xmt_bin')
        ) {
            return 'parasolid-binary'
        }

        return 'unknown'
    }

    /**
     * Returns the latest meaningful field value from one parsed field map.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {string}
     */
    static #getField(fields, key) {
        const raw = fields[key]
        const values = Array.isArray(raw) ? raw : [raw]

        return (
            values
                .map((value) => String(value || '').trim())
                .findLast((value) => value.length > 0) || ''
        )
    }

    /**
     * Appends one field value while preserving duplicate keys.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @param {string} value
     * @returns {void}
     */
    static #appendFieldValue(fields, key, value) {
        if (!(key in fields)) {
            fields[key] = value
            return
        }

        const previous = fields[key]
        if (Array.isArray(previous)) {
            previous.push(value)
            return
        }

        fields[key] = [previous, value]
    }

    /**
     * Parses one floating-point field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {number | null}
     */
    static #parseNumberField(fields, key) {
        const raw = PcbEmbeddedModelExtractor.#getField(fields, key)
        const match = raw.match(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/i)

        if (!match) {
            return null
        }

        const parsed = Number(match[0])
        return Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Parses one integer-like field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {number | null}
     */
    static #parseIntegerField(fields, key) {
        const parsed = PcbEmbeddedModelExtractor.#parseNumberField(fields, key)
        if (!Number.isFinite(parsed)) {
            return null
        }

        return Math.trunc(parsed)
    }

    /**
     * Parses one mil-like field from text or 1/10000 mil integer storage.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {number | null}
     */
    static #parseMilLikeField(fields, key) {
        const raw = PcbEmbeddedModelExtractor.#getField(fields, key)
        const parsed = PcbEmbeddedModelExtractor.#parseNumberField(fields, key)

        if (!Number.isFinite(parsed)) {
            return null
        }

        return /mil/i.test(raw) ? parsed : parsed / 10000
    }

    /**
     * Normalizes one signed or unsigned 32-bit checksum to its unsigned form.
     * @param {number | null} checksum
     * @returns {number | null}
     */
    static #normalizeChecksum(checksum) {
        if (!Number.isInteger(checksum)) {
            return null
        }

        return checksum >>> 0
    }

    /**
     * Decodes one comma-separated identifier byte list.
     * @param {string} rawIdentifier
     * @returns {string}
     */
    static #decodeIdentifier(rawIdentifier) {
        const trimmed = String(rawIdentifier || '').trim()

        if (!trimmed) {
            return ''
        }

        if (!/^\d+(?:,\d+)*$/.test(trimmed)) {
            return trimmed
        }

        return String.fromCharCode(
            ...trimmed
                .split(',')
                .map((value) => Number.parseInt(value, 10))
                .filter(Number.isInteger)
        )
    }

    /**
     * Removes undefined values from a normalized metadata row.
     * @param {object} row Metadata row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
